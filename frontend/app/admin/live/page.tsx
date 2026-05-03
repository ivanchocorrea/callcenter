'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/shared/AppShell';
import { api, unwrap } from '@/lib/api/client';
import { Phone, PhoneIncoming, PhoneOutgoing, PhoneOff, Clock, Users, Activity, Coffee, GraduationCap, Power, Pause } from 'lucide-react';

type AgentStatus = 'available' | 'busy' | 'paused' | 'lunch' | 'training' | 'offline' | string;

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
  direction: string;
  from_number?: string;
  fromNumber?: string;
  to_number?: string;
  toNumber?: string;
  status: string;
  started_at?: string;
  startedAt?: string;
  agent_id?: number | null;
  agentId?: number | null;
  duration_seconds?: number | null;
  durationSeconds?: number | null;
}

const STATUS_INFO: Record<string, { label: string; color: string; icon: any }> = {
  available: { label: 'Disponible', color: 'bg-emerald-100 text-emerald-700', icon: Phone },
  busy:      { label: 'En llamada', color: 'bg-amber-100 text-amber-700', icon: PhoneIncoming },
  paused:    { label: 'Pausa',      color: 'bg-slate-100 text-slate-700', icon: Pause },
  lunch:     { label: 'Almuerzo',   color: 'bg-orange-100 text-orange-700', icon: Coffee },
  training:  { label: 'Capacitación', color: 'bg-indigo-100 text-indigo-700', icon: GraduationCap },
  offline:   { label: 'Offline',    color: 'bg-slate-200 text-slate-600', icon: Power },
};

function fmtDur(s: number | null | undefined): string {
  if (s == null || s <= 0) return '—';
  const min = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${min}:${String(sec).padStart(2, '0')}`;
}

function timeSince(iso: string | undefined): string {
  if (!iso) return '—';
  const diff = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  return fmtDur(diff);
}

export default function LivePage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [activeCalls, setActiveCalls] = useState<Call[]>([]);
  const [queuedCalls, setQueuedCalls] = useState<Call[]>([]);
  const [todayStats, setTodayStats] = useState<{ total: number; answered: number; missed: number; abandoned: number } | null>(null);
  const [tick, setTick] = useState(0);

  function reload() {
    Promise.all([
      api.get('/agents').then(r => unwrap<Agent[]>(r)).catch(() => []),
      // Llamadas en cola entrantes
      api.get('/dial/queue?limit=20').then(r => unwrap<Call[]>(r)).catch(() => []),
      // Llamadas activas (status answered o ringing): traer ultimas y filtrar
      api.get('/calls?limit=100').then(r => unwrap<Call[]>(r)).catch(() => []),
    ]).then(([ags, q, cs]) => {
      setAgents(ags);
      setQueuedCalls(q);
      // Activas: status answered/ringing en este momento
      const active = cs.filter(c => ['answered', 'ringing', 'initiated'].includes(c.status));
      setActiveCalls(active);

      // Stats de hoy: filtrar por started_at >= hoy 00:00
      const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
      const today = cs.filter(c => {
        const t = new Date(c.startedAt ?? c.started_at ?? '').getTime();
        return t >= todayStart.getTime();
      });
      setTodayStats({
        total: today.length,
        answered: today.filter(c => c.status === 'completed' || c.status === 'answered').length,
        missed: today.filter(c => ['missed', 'no_answer', 'failed', 'rejected'].includes(c.status)).length,
        abandoned: today.filter(c => c.status === 'abandoned').length,
      });
    });
  }

  useEffect(() => { reload(); }, []);
  useEffect(() => {
    const i = setInterval(() => { reload(); setTick(t => t + 1); }, 5000);
    return () => clearInterval(i);
  }, []);

  const statusCounts = agents.reduce((acc, a) => {
    const s = a.currentStatus ?? a.current_status ?? 'offline';
    acc[s] = (acc[s] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-slate-900">Monitoreo en vivo</h2>
            <p className="text-slate-500 mt-1">Estado de agentes, llamadas activas y cola en tiempo real (auto-refresh cada 5s).</p>
          </div>
          <div className="text-xs text-slate-500">
            <span className="inline-flex items-center gap-1 text-emerald-600">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> En vivo
            </span>
          </div>
        </div>

        {/* KPIs estado de agentes */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          {(['available', 'busy', 'paused', 'lunch', 'training', 'offline'] as AgentStatus[]).map(s => {
            const info = STATUS_INFO[s];
            const Icon = info.icon;
            return (
              <div key={s} className={`rounded-xl border border-slate-200 bg-white p-3 ${statusCounts[s] ? '' : 'opacity-60'}`}>
                <div className={`inline-flex items-center justify-center w-8 h-8 rounded-lg ${info.color}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="mt-2 text-2xl font-bold text-slate-900">{statusCounts[s] ?? 0}</div>
                <div className="text-[11px] text-slate-500">{info.label}</div>
              </div>
            );
          })}
        </div>

        {/* KPIs del día */}
        {todayStats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard icon={Phone} label="Llamadas hoy" value={String(todayStats.total)} color="bg-slate-50 text-slate-700" />
            <KpiCard icon={PhoneIncoming} label="Atendidas" value={String(todayStats.answered)} color="bg-emerald-50 text-emerald-700" />
            <KpiCard icon={PhoneOff} label="Perdidas" value={String(todayStats.missed)} color="bg-rose-50 text-rose-700" />
            <KpiCard icon={Clock} label="Abandonadas" value={String(todayStats.abandoned)} color="bg-amber-50 text-amber-700" />
          </div>
        )}

        {/* Llamadas en cola */}
        <div className="rounded-xl border border-amber-200 bg-amber-50/30">
          <div className="px-5 py-3 border-b border-amber-200 flex items-center justify-between">
            <h3 className="font-semibold text-amber-900 flex items-center gap-2">
              <Clock className="w-5 h-5" /> En cola ahora ({queuedCalls.length})
            </h3>
            {queuedCalls.length > 0 && <span className="text-xs text-amber-700 animate-pulse">⏳ esperando contestar</span>}
          </div>
          {queuedCalls.length === 0 ? (
            <p className="p-6 text-center text-amber-700 text-sm">Sin llamadas en cola.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-amber-800">
                <tr>
                  <th className="text-left px-4 py-2">Número</th>
                  <th className="text-left px-4 py-2">DID</th>
                  <th className="text-right px-4 py-2">Esperando hace</th>
                </tr>
              </thead>
              <tbody>
                {queuedCalls.map(c => (
                  <tr key={c.id} className="border-t border-amber-100">
                    <td className="px-4 py-2 font-mono">{c.fromNumber ?? c.from_number ?? '?'}</td>
                    <td className="px-4 py-2 font-mono text-xs">{c.toNumber ?? c.to_number ?? '?'}</td>
                    <td className="px-4 py-2 text-right font-mono">{timeSince(c.startedAt ?? c.started_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Llamadas activas en curso */}
        <div className="rounded-xl border border-slate-200 bg-white">
          <div className="px-5 py-3 border-b border-slate-100">
            <h3 className="font-semibold text-slate-900 flex items-center gap-2">
              <Activity className="w-5 h-5 text-brand-600" /> Llamadas en curso ({activeCalls.length})
            </h3>
          </div>
          {activeCalls.length === 0 ? (
            <p className="p-6 text-center text-slate-500 text-sm">Sin llamadas activas en este momento.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-slate-500 bg-slate-50">
                <tr>
                  <th className="text-left px-4 py-2">Dirección</th>
                  <th className="text-left px-4 py-2">De</th>
                  <th className="text-left px-4 py-2">A</th>
                  <th className="text-left px-4 py-2">Estado</th>
                  <th className="text-left px-4 py-2">Agente</th>
                  <th className="text-right px-4 py-2">Iniciada hace</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {activeCalls.map(c => {
                  const ag = agents.find(a => a.id === (c.agentId ?? c.agent_id));
                  return (
                    <tr key={c.id} className="hover:bg-slate-50">
                      <td className="px-4 py-2">
                        {c.direction === 'inbound' ? <PhoneIncoming className="w-4 h-4 text-emerald-600 inline" /> : <PhoneOutgoing className="w-4 h-4 text-blue-600 inline" />}
                      </td>
                      <td className="px-4 py-2 font-mono text-xs">{c.fromNumber ?? c.from_number ?? '?'}</td>
                      <td className="px-4 py-2 font-mono text-xs">{c.toNumber ?? c.to_number ?? '?'}</td>
                      <td className="px-4 py-2"><code className="text-xs bg-slate-100 px-1.5 rounded">{c.status}</code></td>
                      <td className="px-4 py-2">{ag ? (ag.displayName ?? ag.display_name ?? `Ext ${ag.extension}`) : <span className="text-slate-400 text-xs">— sin agente —</span>}</td>
                      <td className="px-4 py-2 text-right font-mono">{timeSince(c.startedAt ?? c.started_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Lista detallada de agentes */}
        <div className="rounded-xl border border-slate-200 bg-white">
          <div className="px-5 py-3 border-b border-slate-100">
            <h3 className="font-semibold text-slate-900 flex items-center gap-2">
              <Users className="w-5 h-5 text-brand-600" /> Agentes ({agents.length})
            </h3>
          </div>
          {agents.length === 0 ? (
            <p className="p-6 text-center text-slate-500">Sin agentes configurados.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-slate-500 bg-slate-50">
                <tr>
                  <th className="text-left px-4 py-2">Agente</th>
                  <th className="text-left px-4 py-2">Extensión</th>
                  <th className="text-left px-4 py-2">Estado</th>
                  <th className="text-right px-4 py-2">Hace</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {agents.map(a => {
                  const status = (a.currentStatus ?? a.current_status ?? 'offline') as AgentStatus;
                  const info = STATUS_INFO[status] ?? STATUS_INFO.offline;
                  const Icon = info.icon;
                  const since = a.currentStatusChangedAt ?? a.current_status_changed_at;
                  return (
                    <tr key={a.id} className="hover:bg-slate-50">
                      <td className="px-4 py-2 font-medium">{a.displayName ?? a.display_name ?? `Ext ${a.extension}`}</td>
                      <td className="px-4 py-2 font-mono text-xs">{a.extension}</td>
                      <td className="px-4 py-2">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${info.color}`}>
                          <Icon className="w-3 h-3" /> {info.label}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-right font-mono text-xs text-slate-500">{timeSince(since)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </AppShell>
  );
}

function KpiCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: string; color: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className={`inline-flex items-center justify-center w-9 h-9 rounded-xl ${color}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="mt-2 text-xl font-bold text-slate-900">{value}</div>
      <div className="text-[11px] text-slate-500">{label}</div>
    </div>
  );
}
