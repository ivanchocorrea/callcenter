'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/shared/AppShell';
import { StatCard } from '@/components/shared/StatCard';
import { api, unwrap } from '@/lib/api/client';
import { PhoneCall, Headphones, ListTree, Bot, CheckCircle2, Circle, PhoneIncoming, PhoneOutgoing, PhoneOff, Clock, Users, Activity, ArrowRight } from 'lucide-react';
import Link from 'next/link';

interface Agent {
  id: number;
  extension: string;
  display_name?: string;
  displayName?: string;
  is_active?: boolean;
  current_status?: string;
  currentStatus?: string;
}

interface Call {
  id: number;
  direction: string;
  status: string;
  started_at?: string;
  startedAt?: string;
  duration_seconds?: number | null;
  durationSeconds?: number | null;
  from_number?: string;
  fromNumber?: string;
  to_number?: string;
  toNumber?: string;
}

function fmtDur(s: number | null | undefined): string {
  if (!s || s <= 0) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, '0')}`;
}

export default function CompanyAdminHome() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [calls, setCalls] = useState<Call[]>([]);
  const [trunks, setTrunks] = useState<any[]>([]);
  const [queues, setQueues] = useState<any[]>([]);
  const [bots, setBots] = useState<any[]>([]);
  const [ivrs, setIvrs] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  function reload() {
    setLoading(true);
    Promise.all([
      api.get('/agents').then(r => unwrap<Agent[]>(r)).catch(() => []),
      api.get('/calls?limit=200').then(r => unwrap<Call[]>(r)).catch(() => []),
      api.get('/sip-trunks').then(r => unwrap<any[]>(r)).catch(() => []),
      api.get('/queues').then(r => unwrap<any[]>(r)).catch(() => []),
      api.get('/ai/bots').then(r => unwrap<any[]>(r)).catch(() => []),
      api.get('/ivr').then(r => unwrap<any[]>(r)).catch(() => []),
      api.get('/customers?limit=10').then(r => unwrap<any[]>(r)).catch(() => []),
    ])
      .then(([ag, cs, tr, qs, bs, iv, cu]) => {
        setAgents(ag); setCalls(cs); setTrunks(tr); setQueues(qs); setBots(bs); setIvrs(iv); setCustomers(cu);
      })
      .finally(() => setLoading(false));
  }
  useEffect(() => { reload(); const i = setInterval(reload, 15000); return () => clearInterval(i); }, []);

  // KPIs hoy
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const todayCalls = calls.filter(c => {
    const t = new Date(c.startedAt ?? c.started_at ?? '').getTime();
    return t >= todayStart.getTime();
  });
  const todayInbound = todayCalls.filter(c => c.direction === 'inbound').length;
  const todayOutbound = todayCalls.filter(c => c.direction === 'outbound').length;
  const todayAnswered = todayCalls.filter(c => c.status === 'completed' || c.status === 'answered').length;
  const todayMissed = todayCalls.filter(c => ['missed','no_answer','failed','rejected'].includes(c.status)).length;
  const todayAbandoned = todayCalls.filter(c => c.status === 'abandoned').length;
  const durations = todayCalls.filter(c => (c.durationSeconds ?? c.duration_seconds ?? 0) > 0).map(c => c.durationSeconds ?? c.duration_seconds ?? 0);
  const avgDuration = durations.length ? Math.round(durations.reduce((s, d) => s + d, 0) / durations.length) : 0;

  const agentsActive = agents.filter(a => (a.currentStatus ?? a.current_status) !== 'offline').length;

  // Checklist
  const checklist = [
    { label: 'Configurar troncal SIP', done: trunks.length > 0, link: '/admin/sip-trunks' },
    { label: 'Crear agentes', done: agents.length > 0, link: '/admin/agents' },
    { label: 'Crear primera cola', done: queues.length > 0, link: '/admin/queues' },
    { label: 'Configurar IVR de bienvenida', done: ivrs.length > 0, link: '/admin/ivr' },
    { label: 'Importar clientes', done: customers.length > 0, link: '/admin/imports' },
  ];

  // Actividad reciente: últimas 5 llamadas
  const recent = calls.slice(0, 5);

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap">
          <div>
            <h2 className="text-2xl font-semibold text-slate-900">Panel de administración</h2>
            <p className="text-slate-500 mt-1">Resumen del Call Center · auto-refresh cada 15s.</p>
          </div>
          <Link href="/admin/live" className="inline-flex items-center gap-2 px-3 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-medium">
            <Activity className="w-4 h-4" /> Ver monitoreo en vivo
          </Link>
        </div>

        {/* KPIs principales */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Llamadas hoy" value={loading ? '—' : String(todayCalls.length)} icon={<PhoneCall className="w-6 h-6" />} />
          <StatCard label="Agentes conectados" value={loading ? '—' : `${agentsActive}/${agents.length}`} icon={<Headphones className="w-6 h-6" />} />
          <StatCard label="Colas activas" value={loading ? '—' : String(queues.length)} icon={<ListTree className="w-6 h-6" />} />
          <StatCard label="Bots IA" value={loading ? '—' : String(bots.length)} icon={<Bot className="w-6 h-6" />} />
        </div>

        {/* KPIs detalle hoy */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <MiniStat icon={PhoneIncoming} label="Entrantes" value={todayInbound} color="text-emerald-700 bg-emerald-50" />
          <MiniStat icon={PhoneOutgoing} label="Salientes" value={todayOutbound} color="text-blue-700 bg-blue-50" />
          <MiniStat icon={CheckCircle2} label="Atendidas" value={todayAnswered} color="text-emerald-700 bg-emerald-50" />
          <MiniStat icon={PhoneOff} label="Perdidas" value={todayMissed} color="text-rose-700 bg-rose-50" />
          <MiniStat icon={Clock} label="Dur prom" value={fmtDur(avgDuration)} color="text-slate-700 bg-slate-50" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Checklist de configuración */}
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <h3 className="text-base font-semibold text-slate-900 mb-3">Checklist de configuración</h3>
            <ul className="space-y-2 text-sm">
              {checklist.map(item => (
                <li key={item.label}>
                  <Link href={item.link} className="flex items-center gap-2 text-slate-600 hover:text-brand-600 hover:bg-slate-50 px-2 py-1 rounded">
                    {item.done ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 fill-emerald-100" />
                    ) : (
                      <Circle className="w-5 h-5 text-slate-300" />
                    )}
                    <span className={item.done ? 'text-slate-900 line-through opacity-70' : ''}>{item.label}</span>
                    <ArrowRight className="w-3.5 h-3.5 ml-auto opacity-50" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Actividad reciente */}
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-semibold text-slate-900">Actividad reciente</h3>
              <Link href="/admin/recordings" className="text-xs text-brand-600 hover:text-brand-700">Ver todo →</Link>
            </div>
            {loading ? (
              <p className="text-sm text-slate-500">Cargando…</p>
            ) : recent.length === 0 ? (
              <p className="text-sm text-slate-500">Sin actividad todavía.</p>
            ) : (
              <ul className="divide-y divide-slate-100 -mx-6">
                {recent.map(c => {
                  const dir = c.direction;
                  const fr = c.fromNumber ?? c.from_number ?? '?';
                  const to = c.toNumber ?? c.to_number ?? '?';
                  const dur = c.durationSeconds ?? c.duration_seconds;
                  const time = new Date(c.startedAt ?? c.started_at ?? '').toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
                  return (
                    <li key={c.id} className="px-6 py-2 flex items-center gap-3 text-sm">
                      {dir === 'inbound' ? <PhoneIncoming className="w-4 h-4 text-emerald-600" /> : <PhoneOutgoing className="w-4 h-4 text-blue-600" />}
                      <span className="font-mono text-xs flex-1">{dir === 'inbound' ? fr : to}</span>
                      <span className="text-xs text-slate-500 font-mono">{fmtDur(dur)}</span>
                      <span className="text-xs text-slate-400">{time}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function MiniStat({ icon: Icon, label, value, color }: { icon: any; label: string; value: number | string; color: string }) {
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
