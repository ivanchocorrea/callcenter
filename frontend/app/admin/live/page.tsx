'use client';

import { useEffect, useMemo, useState } from 'react';
import { AppShell } from '@/components/shared/AppShell';
import { api, unwrap } from '@/lib/api/client';
import { useRealtime } from '@/lib/realtime/realtime-context';
import {
  Phone, PhoneIncoming, PhoneOutgoing, PhoneOff, Clock, Users, Activity, Coffee,
  GraduationCap, Power, Pause, Headphones, X, Search, Filter, AlertTriangle,
  CheckCircle2, Eye, History, Hourglass, BarChart3,
} from 'lucide-react';

type AgentStatus = 'available' | 'busy' | 'paused' | 'lunch' | 'training' | 'offline' | 'ringing' | 'talking' | string;

interface Agent {
  id: number;
  extension: string;
  display_name?: string;
  displayName?: string;
  current_status?: AgentStatus;
  currentStatus?: AgentStatus;
  current_status_changed_at?: string;
  currentStatusChangedAt?: string;
  is_active?: boolean;
}

interface Call {
  id: number;
  asteriskUniqueid?: string;
  asterisk_uniqueid?: string;
  direction: 'inbound' | 'outbound' | 'internal' | string;
  fromNumber?: string;
  from_number?: string;
  toNumber?: string;
  to_number?: string;
  status: string;
  started_at?: string;
  startedAt?: string;
  agent_id?: number | null;
  agentId?: number | null;
  duration_seconds?: number | null;
  durationSeconds?: number | null;
  queue_wait_seconds?: number | null;
  queueWaitSeconds?: number | null;
  talk_seconds?: number | null;
  talkSeconds?: number | null;
  queue_id?: number | null;
  queueId?: number | null;
  campaign_id?: number | null;
  campaignId?: number | null;
}

interface Queue {
  id: number;
  name: string;
}

const STATUS_INFO: Record<string, { label: string; bg: string; text: string; dot: string; icon: any }> = {
  available: { label: 'Disponible',   bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500', icon: Phone },
  talking:   { label: 'Hablando',     bg: 'bg-blue-50',    text: 'text-blue-700',    dot: 'bg-blue-500',    icon: Headphones },
  busy:      { label: 'Hablando',     bg: 'bg-blue-50',    text: 'text-blue-700',    dot: 'bg-blue-500',    icon: Headphones },
  ringing:   { label: 'Timbrando',    bg: 'bg-amber-50',   text: 'text-amber-700',   dot: 'bg-amber-500',   icon: PhoneIncoming },
  paused:    { label: 'En pausa',     bg: 'bg-orange-50',  text: 'text-orange-700',  dot: 'bg-orange-500',  icon: Pause },
  lunch:     { label: 'Almuerzo',     bg: 'bg-orange-50',  text: 'text-orange-700',  dot: 'bg-orange-500',  icon: Coffee },
  training:  { label: 'Capacitación', bg: 'bg-purple-50',  text: 'text-purple-700',  dot: 'bg-purple-500',  icon: GraduationCap },
  offline:   { label: 'Desconectado', bg: 'bg-slate-100',  text: 'text-slate-600',   dot: 'bg-slate-400',   icon: Power },
};

function fmtDur(s: number | null | undefined): string {
  if (s == null || s <= 0) return '0:00';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
    : `${m}:${String(sec).padStart(2, '0')}`;
}

function timeSince(iso: string | undefined): number {
  if (!iso) return 0;
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
}

export default function LivePage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [activeCalls, setActiveCalls] = useState<Call[]>([]);
  const [queuedCalls, setQueuedCalls] = useState<Call[]>([]);
  const [allCallsToday, setAllCallsToday] = useState<Call[]>([]);
  const [queues, setQueues] = useState<Queue[]>([]);
  // Tick para forzar re-render cada segundo (timers)
  const [, setTick] = useState(0);

  // Filtros
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterQueue, setFilterQueue] = useState<string>('all');

  // Modales
  const [spyAgent, setSpyAgent] = useState<{ extension: string; name: string } | null>(null);
  const [callDetail, setCallDetail] = useState<Call | null>(null);

  function reload() {
    Promise.all([
      api.get('/agents').then(r => unwrap<Agent[]>(r)).catch(() => []),
      api.get('/dial/queue?limit=50').then(r => unwrap<Call[]>(r)).catch(() => []),
      api.get('/calls?limit=200').then(r => unwrap<Call[]>(r)).catch(() => []),
      api.get('/queues').then(r => unwrap<Queue[]>(r)).catch(() => []),
    ]).then(([ags, q, cs, qs]) => {
      setAgents(ags);
      setQueuedCalls(q);
      setQueues(qs);
      // Activas
      const active = cs.filter(c => ['answered', 'ringing', 'initiated', 'queued'].includes(c.status));
      setActiveCalls(active);
      // Hoy
      const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
      const today = cs.filter(c => {
        const t = new Date(c.startedAt ?? c.started_at ?? '').getTime();
        return t >= todayStart.getTime();
      });
      setAllCallsToday(today);
    });
  }

  useEffect(() => { reload(); }, []);
  useEffect(() => {
    // Polling como backup si el WebSocket se cae (cada 8s, no 3s — los
    // eventos en vivo llegan via socket.io y refrescamos antes).
    const dataTimer = setInterval(reload, 8000);
    const tickTimer = setInterval(() => setTick(t => t + 1), 1000); // timers cada 1s
    return () => { clearInterval(dataTimer); clearInterval(tickTimer); };
  }, []);

  // Suscripcion a eventos realtime via WebSocket (socket.io). El backend
  // emite estos eventos cuando AMI detecta cambios en la telefonia:
  //  - call.incoming → entrante registrada en BD
  //  - call.answered → bridge completado (agente atendio)
  //  - call.ended → hangup
  //  - agent.status_changed → cambio de estado (busy/available/etc)
  // Cuando llegan, hacemos reload inmediato → datos en VIVO real.
  const realtime = useRealtime();
  useEffect(() => {
    const events = ['call.incoming', 'call.answered', 'call.ended', 'agent.status_changed'];
    const unsubs = events.map(ev => realtime.on(ev, () => reload()));
    return () => { unsubs.forEach(u => u()); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [realtime.connected]);

  // Mapping agente → llamada activa
  const callByAgentId = useMemo(() => {
    const m = new Map<number, Call>();
    activeCalls.forEach(c => {
      const aid = c.agentId ?? c.agent_id;
      if (aid) m.set(aid, c);
    });
    return m;
  }, [activeCalls]);

  // Inferir status real del agente: si tiene llamada activa → 'talking' o 'ringing'
  const enrichedAgents = useMemo(() => {
    return agents.map(a => {
      const c = callByAgentId.get(a.id);
      let status = a.currentStatus ?? a.current_status ?? 'offline';
      if (c) {
        if (c.status === 'answered') status = 'talking';
        else if (c.status === 'ringing' || c.status === 'initiated') status = 'ringing';
      }
      return { ...a, _liveStatus: status as AgentStatus, _activeCall: c };
    });
  }, [agents, callByAgentId]);

  // Stats por estado de agente
  const statusCounts = useMemo(() => {
    return enrichedAgents.reduce((acc, a) => {
      acc[a._liveStatus] = (acc[a._liveStatus] ?? 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }, [enrichedAgents]);

  // KPIs día — calculos REALES desde tabla `calls`
  const kpis = useMemo(() => {
    const total = allCallsToday.length;
    const answered = allCallsToday.filter(c => c.status === 'completed' || c.status === 'answered').length;
    const missed = allCallsToday.filter(c => ['missed','no_answer','failed','rejected'].includes(c.status)).length;
    const abandoned = allCallsToday.filter(c => c.status === 'abandoned').length;

    // Duracion: prefiero talk_seconds (tiempo real hablando) sobre duration_seconds (incluye espera)
    const talkTimes = allCallsToday.filter(c => (c.talkSeconds ?? c.talk_seconds ?? 0) > 0).map(c => c.talkSeconds ?? c.talk_seconds ?? 0);
    const avgDuration = talkTimes.length ? talkTimes.reduce((s, d) => s + d, 0) / talkTimes.length : 0;

    // Espera promedio HOY: usa queue_wait_seconds de las llamadas atendidas hoy
    const historicalWaits = allCallsToday
      .map(c => c.queueWaitSeconds ?? c.queue_wait_seconds ?? 0)
      .filter(w => w > 0);
    // Mas espera AHORA: tiempo en cola de las llamadas que estan esperando ahora
    const currentWaits = queuedCalls.map(c => timeSince(c.startedAt ?? c.started_at));
    const allWaits = [...historicalWaits, ...currentWaits];
    const avgWait = allWaits.length ? allWaits.reduce((s, w) => s + w, 0) / allWaits.length : 0;
    const maxWait = currentWaits.length ? Math.max(...currentWaits) : (historicalWaits.length ? Math.max(...historicalWaits) : 0);

    // Service Level: % de llamadas atendidas en <=20s de espera (estandar SLA call center)
    const slaTarget = 20;
    const withinSla = allCallsToday.filter(c => {
      const w = c.queueWaitSeconds ?? c.queue_wait_seconds ?? 0;
      return (c.status === 'completed' || c.status === 'answered') && w <= slaTarget;
    }).length;
    const answeredCalls = answered + abandoned; // total de "candidatos" para SLA
    const serviceLevel = answeredCalls > 0 ? (withinSla / answeredCalls) * 100 : 0;

    const abandonRate = total > 0 ? (abandoned / total) * 100 : 0;

    return {
      total, answered, missed, abandoned,
      avgDuration: Math.round(avgDuration),
      avgWait: Math.round(avgWait),
      maxWait,
      serviceLevel: Math.round(serviceLevel),
      abandonRate: Math.round(abandonRate * 10) / 10,
    };
  }, [allCallsToday, queuedCalls]);

  // Filtros aplicados a llamadas activas
  const filteredCalls = useMemo(() => {
    return activeCalls.filter(c => {
      if (filterStatus !== 'all' && c.status !== filterStatus) return false;
      if (filterQueue !== 'all') {
        const qid = c.queueId ?? c.queue_id;
        if (String(qid) !== filterQueue) return false;
      }
      if (search) {
        const q = search.toLowerCase();
        const ag = agents.find(a => a.id === (c.agentId ?? c.agent_id));
        const agName = (ag?.displayName ?? ag?.display_name ?? '').toLowerCase();
        const agExt = (ag?.extension ?? '').toLowerCase();
        const fr = (c.fromNumber ?? c.from_number ?? '').toLowerCase();
        const tn = (c.toNumber ?? c.to_number ?? '').toLowerCase();
        if (!agName.includes(q) && !agExt.includes(q) && !fr.includes(q) && !tn.includes(q)) return false;
      }
      return true;
    });
  }, [activeCalls, agents, filterStatus, filterQueue, search]);

  // Filtros aplicados a agentes (por search)
  const filteredAgents = useMemo(() => {
    if (!search) return enrichedAgents;
    const q = search.toLowerCase();
    return enrichedAgents.filter(a => {
      const name = (a.displayName ?? a.display_name ?? '').toLowerCase();
      return name.includes(q) || a.extension.toLowerCase().includes(q);
    });
  }, [enrichedAgents, search]);

  return (
    <AppShell>
      <div className="space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h2 className="text-2xl font-semibold text-slate-900">Wallboard / Monitoreo en vivo</h2>
            <p className="text-slate-500 mt-1 text-sm">Estado de asesores, llamadas activas y métricas en tiempo real (auto-refresh 3s).</p>
          </div>
          <div className="text-xs flex items-center gap-2">
            {realtime.connected ? (
              <span className="inline-flex items-center gap-1 text-emerald-600 px-3 py-1 bg-emerald-50 rounded-full">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> En vivo (WebSocket)
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-amber-600 px-3 py-1 bg-amber-50 rounded-full" title="WebSocket caido — usando polling cada 8s">
                <span className="w-2 h-2 rounded-full bg-amber-500" /> Polling 8s
              </span>
            )}
          </div>
        </div>

        {/* ============ PANEL SUPERIOR DE ASESORES (cards horizontales) ============ */}
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-slate-900 flex items-center gap-2">
              <Users className="w-5 h-5 text-brand-600" /> Asesores ({enrichedAgents.length})
            </h3>
            <div className="flex items-center gap-1 text-xs">
              {(['available', 'talking', 'ringing', 'paused', 'offline'] as AgentStatus[]).map(s => {
                const info = STATUS_INFO[s];
                return (
                  <span key={s} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full ${info.bg} ${info.text}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${info.dot}`} />
                    {statusCounts[s] ?? 0} {info.label}
                  </span>
                );
              })}
            </div>
          </div>
          {filteredAgents.length === 0 ? (
            <p className="text-center text-slate-500 text-sm py-6">Sin asesores configurados.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {filteredAgents.map(a => {
                const info = STATUS_INFO[a._liveStatus] ?? STATUS_INFO.offline;
                const Icon = info.icon;
                const since = a.currentStatusChangedAt ?? a.current_status_changed_at;
                const sinceSecs = timeSince(since);
                const call = a._activeCall;
                const callSecs = call ? timeSince(call.startedAt ?? call.started_at) : 0;
                const queueName = call ? queues.find(q => q.id === (call.queueId ?? call.queue_id))?.name : null;
                // Alerta visual si lleva mucho en pausa o en llamada
                const tooLongPaused = a._liveStatus === 'paused' && sinceSecs > 600; // 10min
                const tooLongCall = call && callSecs > 600;
                return (
                  <div key={a.id} className={`rounded-xl border-2 ${info.bg.replace('bg-', 'border-')} ${info.bg}/30 p-3 hover:shadow-md transition`}>
                    <div className="flex items-start gap-2">
                      <div className={`w-10 h-10 rounded-full ${info.bg} flex items-center justify-center shrink-0 relative`}>
                        <Icon className={`w-5 h-5 ${info.text}`} />
                        {(tooLongPaused || tooLongCall) && (
                          <AlertTriangle className="w-3 h-3 text-amber-500 absolute -top-0.5 -right-0.5 fill-amber-100" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-slate-900 text-sm truncate">{a.displayName ?? a.display_name ?? `Ext ${a.extension}`}</div>
                        <div className="text-[11px] text-slate-500">
                          Ext <code>{a.extension}</code>
                        </div>
                        <div className="mt-1 flex items-center gap-1.5">
                          <span className={`w-1.5 h-1.5 rounded-full ${info.dot}`} />
                          <span className={`text-xs font-medium ${info.text}`}>{info.label}</span>
                          <span className={`ml-auto text-xs font-mono ${tooLongPaused || tooLongCall ? 'text-amber-700 font-bold' : 'text-slate-500'}`}>
                            {fmtDur(sinceSecs)}
                          </span>
                        </div>
                        {call && (
                          <div className="mt-2 pt-2 border-t border-slate-200/80 space-y-0.5">
                            <div className="text-[10px] uppercase tracking-wide text-slate-500 flex items-center gap-1">
                              {call.direction === 'inbound' ? <PhoneIncoming className="w-3 h-3" /> : <PhoneOutgoing className="w-3 h-3" />}
                              {call.direction === 'inbound' ? 'Entrante' : call.direction === 'outbound' ? 'Saliente' : 'Interna'}
                            </div>
                            <div className="font-mono text-xs text-slate-800 truncate">
                              {call.direction === 'inbound' ? (call.fromNumber ?? call.from_number) : (call.toNumber ?? call.to_number)}
                            </div>
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="text-slate-500">{queueName ?? 'sin cola'}</span>
                              <span className="font-mono text-blue-700 font-semibold">{fmtDur(callSecs)}</span>
                            </div>
                            <button
                              onClick={() => setSpyAgent({ extension: a.extension, name: a.displayName ?? a.display_name ?? `Ext ${a.extension}` })}
                              className="mt-1 w-full inline-flex items-center justify-center gap-1 px-2 py-1 rounded bg-purple-100 hover:bg-purple-200 text-purple-700 text-[11px] font-medium"
                            >
                              <Headphones className="w-3 h-3" /> Escuchar
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ============ KPIs en vivo ============ */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <Kpi icon={Users} label="Conectados" value={enrichedAgents.filter(a => a._liveStatus !== 'offline').length} color="bg-slate-50 text-slate-700" />
          <Kpi icon={Phone} label="Disponibles" value={statusCounts.available ?? 0} color="bg-emerald-50 text-emerald-700" />
          <Kpi icon={Headphones} label="Hablando" value={statusCounts.talking ?? 0} color="bg-blue-50 text-blue-700" />
          <Kpi icon={Pause} label="En pausa" value={(statusCounts.paused ?? 0) + (statusCounts.lunch ?? 0)} color="bg-orange-50 text-orange-700" />
          <Kpi icon={Activity} label="Activas" value={activeCalls.length} color="bg-indigo-50 text-indigo-700" />
          <Kpi icon={Hourglass} label="En cola" value={queuedCalls.length} color="bg-amber-50 text-amber-700" />
        </div>

        {/* KPIs del día */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
          <Kpi icon={PhoneIncoming} label="Atendidas hoy" value={kpis.answered} color="bg-emerald-50 text-emerald-700" />
          <Kpi icon={PhoneOff} label="Perdidas hoy" value={kpis.missed} color="bg-rose-50 text-rose-700" />
          <Kpi icon={Clock} label="Abandonadas" value={kpis.abandoned} color="bg-amber-50 text-amber-700" />
          <Kpi icon={Clock} label="Dur prom" value={fmtDur(kpis.avgDuration)} color="bg-slate-50 text-slate-700" />
          <Kpi icon={Hourglass} label="Espera prom" value={fmtDur(kpis.avgWait)} color="bg-slate-50 text-slate-700" />
          <Kpi icon={AlertTriangle} label="Espera máx" value={fmtDur(kpis.maxWait)} color="bg-amber-50 text-amber-700" />
          <Kpi icon={CheckCircle2} label="SLA <20s" value={`${kpis.serviceLevel}%`} color="bg-emerald-50 text-emerald-700" />
          <Kpi icon={PhoneOff} label="Tasa abandono" value={`${kpis.abandonRate}%`} color="bg-rose-50 text-rose-700" />
        </div>

        {/* ============ Filtros + búsqueda ============ */}
        <div className="rounded-xl border border-slate-200 bg-white p-3 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <Filter className="w-4 h-4 text-brand-600" /> Filtros:
          </div>
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Asesor, extensión o número..."
              className="w-full pl-8 pr-3 py-1.5 text-sm rounded-lg border border-slate-300" />
          </div>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            className="px-3 py-1.5 text-sm rounded-lg border border-slate-300 bg-white">
            <option value="all">Todos los estados</option>
            <option value="ringing">Timbrando</option>
            <option value="answered">Contestada</option>
            <option value="initiated">Iniciada</option>
            <option value="queued">En cola</option>
          </select>
          <select value={filterQueue} onChange={e => setFilterQueue(e.target.value)}
            className="px-3 py-1.5 text-sm rounded-lg border border-slate-300 bg-white">
            <option value="all">Todas las colas</option>
            {queues.map(q => <option key={q.id} value={q.id}>{q.name}</option>)}
          </select>
          {(search || filterStatus !== 'all' || filterQueue !== 'all') && (
            <button onClick={() => { setSearch(''); setFilterStatus('all'); setFilterQueue('all'); }}
              className="text-xs text-slate-500 hover:text-slate-700 inline-flex items-center gap-1">
              <X className="w-3 h-3" /> Limpiar
            </button>
          )}
        </div>

        {/* ============ Llamadas en cola ============ */}
        {queuedCalls.length > 0 && (
          <div className="rounded-xl border border-amber-300 bg-amber-50">
            <div className="px-5 py-3 border-b border-amber-200 flex items-center justify-between">
              <h3 className="font-semibold text-amber-900 flex items-center gap-2">
                <Hourglass className="w-5 h-5 animate-pulse" /> En cola ({queuedCalls.length})
              </h3>
              <span className="text-xs text-amber-700">⏳ esperando atención</span>
            </div>
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-amber-800 bg-amber-100/50">
                <tr>
                  <th className="text-left px-4 py-2">Origen</th>
                  <th className="text-left px-4 py-2">DID destino</th>
                  <th className="text-right px-4 py-2">Tiempo en espera</th>
                </tr>
              </thead>
              <tbody>
                {queuedCalls.map(c => {
                  const wait = timeSince(c.startedAt ?? c.started_at);
                  const overWait = wait > 60;
                  return (
                    <tr key={c.id} className="border-t border-amber-100">
                      <td className="px-4 py-2 font-mono">{c.fromNumber ?? c.from_number ?? '?'}</td>
                      <td className="px-4 py-2 font-mono text-xs">{c.toNumber ?? c.to_number ?? '?'}</td>
                      <td className={`px-4 py-2 text-right font-mono font-semibold ${overWait ? 'text-rose-700' : 'text-amber-700'}`}>
                        {fmtDur(wait)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ============ TABLA LLAMADAS ACTIVAS ============ */}
        <div className="rounded-xl border border-slate-200 bg-white">
          <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-semibold text-slate-900 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-brand-600" /> Llamadas activas ({filteredCalls.length})
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-slate-500 bg-slate-50">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">ID</th>
                  <th className="text-left px-3 py-2 font-medium">Inicio</th>
                  <th className="text-left px-3 py-2 font-medium">Tipo</th>
                  <th className="text-left px-3 py-2 font-medium">Origen</th>
                  <th className="text-left px-3 py-2 font-medium">Destino</th>
                  <th className="text-left px-3 py-2 font-medium">Asesor</th>
                  <th className="text-left px-3 py-2 font-medium">Ext</th>
                  <th className="text-left px-3 py-2 font-medium">Estado</th>
                  <th className="text-right px-3 py-2 font-medium">Duración</th>
                  <th className="text-left px-3 py-2 font-medium">Cola</th>
                  <th className="text-right px-3 py-2 font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredCalls.length === 0 && (
                  <tr><td colSpan={11} className="px-4 py-8 text-center text-slate-500">Sin llamadas activas.</td></tr>
                )}
                {filteredCalls.map(c => {
                  const ag = agents.find(a => a.id === (c.agentId ?? c.agent_id));
                  const queueName = queues.find(q => q.id === (c.queueId ?? c.queue_id))?.name;
                  const dur = timeSince(c.startedAt ?? c.started_at);
                  const started = new Date(c.startedAt ?? c.started_at ?? '');
                  return (
                    <tr key={c.id} className="hover:bg-slate-50">
                      <td className="px-3 py-2 font-mono text-xs">{c.id}</td>
                      <td className="px-3 py-2 text-xs text-slate-600">{started.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</td>
                      <td className="px-3 py-2">
                        {c.direction === 'inbound' ? <PhoneIncoming className="w-4 h-4 text-emerald-600 inline" />
                          : c.direction === 'outbound' ? <PhoneOutgoing className="w-4 h-4 text-blue-600 inline" />
                          : <Phone className="w-4 h-4 text-slate-500 inline" />}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">{c.fromNumber ?? c.from_number ?? '?'}</td>
                      <td className="px-3 py-2 font-mono text-xs">{c.toNumber ?? c.to_number ?? '?'}</td>
                      <td className="px-3 py-2">{ag ? (ag.displayName ?? ag.display_name ?? `?`) : <span className="text-slate-400 text-xs">— sin asignar —</span>}</td>
                      <td className="px-3 py-2 font-mono text-xs">{ag?.extension ?? '—'}</td>
                      <td className="px-3 py-2">
                        <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">{c.status}</span>
                      </td>
                      <td className="px-3 py-2 text-right font-mono">{fmtDur(dur)}</td>
                      <td className="px-3 py-2 text-xs text-slate-600">{queueName ?? '—'}</td>
                      <td className="px-3 py-2 text-right">
                        <div className="inline-flex gap-1">
                          <button onClick={() => setCallDetail(c)} title="Ver detalle" className="p-1.5 rounded text-slate-500 hover:bg-slate-100">
                            <Eye className="w-4 h-4" />
                          </button>
                          {ag && c.status === 'answered' && (
                            <button
                              onClick={() => setSpyAgent({ extension: ag.extension, name: ag.displayName ?? ag.display_name ?? `Ext ${ag.extension}` })}
                              title="Escuchar (ChanSpy)"
                              className="p-1.5 rounded text-purple-600 hover:bg-purple-100"
                            >
                              <Headphones className="w-4 h-4" />
                            </button>
                          )}
                          {ag && (
                            <a href={`/admin/agents/${ag.id}`} title="Ver historial del asesor" className="p-1.5 rounded text-slate-500 hover:bg-slate-100">
                              <History className="w-4 h-4" />
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {spyAgent && <SpyModal agent={spyAgent} onClose={() => setSpyAgent(null)} />}
      {callDetail && <CallDetailModal call={callDetail} agent={agents.find(a => a.id === (callDetail.agentId ?? callDetail.agent_id))} queues={queues} onClose={() => setCallDetail(null)} />}
    </AppShell>
  );
}

function Kpi({ icon: Icon, label, value, color }: { icon: any; label: string; value: number | string; color: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <div className={`inline-flex items-center justify-center w-8 h-8 rounded-lg ${color}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="mt-1.5 text-xl font-bold text-slate-900">{value}</div>
      <div className="text-[10px] text-slate-500 uppercase tracking-wide">{label}</div>
    </div>
  );
}

function SpyModal({ agent, onClose }: { agent: { extension: string; name: string }; onClose: () => void }) {
  const spyExt = `*${agent.extension}`;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <Headphones className="w-5 h-5 text-purple-600" /> Escuchar llamada
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="px-5 py-5 space-y-4 text-sm">
          <p className="text-slate-700">
            Vas a supervisar la llamada en curso de <strong>{agent.name}</strong> (ext <code className="bg-slate-100 px-1.5 py-0.5 rounded font-mono">{agent.extension}</code>).
          </p>
          <div className="rounded-lg bg-purple-50 border border-purple-200 p-4">
            <div className="text-xs uppercase tracking-wide font-semibold text-purple-700 mb-2">📋 Para escuchar:</div>
            <ol className="list-decimal list-inside space-y-1 text-slate-800 text-sm">
              <li>Abrí tu softphone (MicroSIP, Linphone, navegador con extensión SIP, etc.)</li>
              <li>Marcá: <code className="bg-white px-2 py-0.5 rounded font-mono text-base font-bold text-purple-700">{spyExt}</code></li>
              <li>Vas a escuchar en silencio (ni el asesor ni el cliente te escuchan)</li>
            </ol>
          </div>
          <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900">
            <strong>Modos durante la escucha:</strong>
            <ul className="mt-1 space-y-0.5">
              <li><kbd className="bg-white px-1 rounded">#</kbd> → Whisper (susurrar al asesor sin que el cliente escuche)</li>
              <li><kbd className="bg-white px-1 rounded">*</kbd> → Barge (los 3 hablan)</li>
            </ul>
          </div>
          <p className="text-xs text-slate-500">⚠️ Necesitás una extensión SIP propia registrada.</p>
        </div>
        <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex justify-end">
          <button onClick={onClose} className="px-4 py-2 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 text-sm font-medium">Cerrar</button>
        </div>
      </div>
    </div>
  );
}

function CallDetailModal({ call, agent, queues, onClose }: { call: Call; agent?: Agent; queues: Queue[]; onClose: () => void }) {
  const queueName = queues.find(q => q.id === (call.queueId ?? call.queue_id))?.name;
  const dur = timeSince(call.startedAt ?? call.started_at);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <Phone className="w-5 h-5 text-brand-600" /> Detalle llamada #{call.id}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="px-5 py-4 space-y-2 text-sm">
          <Row label="ID interno" value={String(call.id)} />
          <Row label="Asterisk uniqueid" value={call.asteriskUniqueid ?? call.asterisk_uniqueid ?? '—'} />
          <Row label="Dirección" value={call.direction} />
          <Row label="Origen" value={call.fromNumber ?? call.from_number ?? '—'} />
          <Row label="Destino" value={call.toNumber ?? call.to_number ?? '—'} />
          <Row label="Estado" value={call.status} />
          <Row label="Iniciada" value={new Date(call.startedAt ?? call.started_at ?? '').toLocaleString('es-CO')} />
          <Row label="Duración actual" value={fmtDur(dur)} />
          <Row label="Asesor" value={agent ? `${agent.displayName ?? agent.display_name} (Ext ${agent.extension})` : '— sin asignar —'} />
          <Row label="Cola" value={queueName ?? '—'} />
        </div>
        <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex justify-end">
          <button onClick={onClose} className="px-4 py-2 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 text-sm font-medium">Cerrar</button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 py-1 border-b border-slate-100 last:border-0">
      <span className="text-slate-500 text-xs uppercase">{label}</span>
      <span className="font-mono text-xs text-slate-900 text-right truncate">{value}</span>
    </div>
  );
}
