'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/shared/AppShell';
import { api, unwrap } from '@/lib/api/client';
import { BarChart3, Download, Calendar, Users, Phone, PhoneIncoming, PhoneOutgoing, PhoneMissed, Clock, AlertCircle } from 'lucide-react';

interface Overview {
  total: number;
  outbound: number;
  inbound: number;
  missed: number;
  abandoned?: number;
  avg_duration?: number;
  avg_inbound_duration?: number;
  avg_outbound_duration?: number;
  avg_wait?: number;
  avg_talk?: number;
}

interface AgentRow { agent_id: number; display_name: string; extension?: string; calls: number; completed: number; avg_talk?: number; total_talk?: number; }
interface QueueRow { queue_id: number; name: string; calls: number; abandoned: number; avg_wait?: number; avg_talk?: number; }
interface HourRow { hour: number; total: number; outbound: number; inbound: number; missed: number; }

function todayMinus(days: number) {
  const d = new Date(); d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

export default function ReportsPage() {
  const [from, setFrom] = useState(todayMinus(7));
  const [to, setTo] = useState(todayMinus(0));
  const [agentId, setAgentId] = useState<number | ''>('');
  const [agentsList, setAgentsList] = useState<{ id: number; display_name: string }[]>([]);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [byAgent, setByAgent] = useState<AgentRow[]>([]);
  const [byQueue, setByQueue] = useState<QueueRow[]>([]);
  const [hourly, setHourly] = useState<HourRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function loadAll() {
    setLoading(true);
    const params: any = { from, to };
    if (agentId) params.agent_id = agentId;
    Promise.all([
      api.get('/reports/overview', { params }).then(r => unwrap<Overview>(r)).catch(() => null),
      api.get('/reports/by-agent', { params }).then(r => unwrap<any[]>(r)).catch(() => []),
      api.get('/reports/by-queue', { params }).then(r => unwrap<any[]>(r)).catch(() => []),
      api.get('/reports/hourly', { params }).then(r => unwrap<any[]>(r)).catch(() => []),
    ]).then(([ov, ag, qu, hr]) => {
      setOverview(ov);
      setByAgent(ag.map((a: any) => ({
        agent_id: a.agent_id, display_name: a.display_name ?? a.agent_name ?? '?', extension: a.extension,
        calls: Number(a.calls ?? a.total ?? 0), completed: Number(a.completed ?? a.answered ?? 0),
        avg_talk: a.avg_talk != null ? Number(a.avg_talk) : undefined,
      })));
      setByQueue(qu.map((q: any) => ({
        queue_id: q.queue_id, name: q.name ?? q.queue_name ?? '?',
        calls: Number(q.calls ?? q.total ?? 0), abandoned: Number(q.abandoned ?? 0),
        avg_wait: q.avg_wait != null ? Number(q.avg_wait) : undefined,
      })));
      setHourly(hr.map((h: any) => ({
        hour: Number(h.hour), total: Number(h.total),
        outbound: Number(h.outbound ?? 0), inbound: Number(h.inbound ?? 0), missed: Number(h.missed ?? 0),
      })));
      setError(null);
    }).catch(e => setError(e?.response?.data?.error?.message ?? 'Error al cargar reportes'))
    .finally(() => setLoading(false));
  }
  useEffect(() => { loadAll(); /* eslint-disable-next-line */ }, []);

  // Cargar lista de agentes para el filtro
  useEffect(() => {
    api.get('/agents').then(r => {
      const list = unwrap<any[]>(r).map(a => ({ id: a.id, display_name: a.display_name ?? a.displayName ?? `Ext ${a.extension}` }));
      setAgentsList(list);
    }).catch(() => { /* ignore */ });
  }, []);

  function exportCsv() {
    const url = `/api/reports/export.csv?from=${from}&to=${to}`;
    window.open(`${process.env.NEXT_PUBLIC_API_URL ?? ''}${url}`, '_blank');
  }

  function fmt(n: number | undefined): string {
    if (n == null) return '—';
    return n.toLocaleString();
  }

  function fmtSecs(s: number | undefined): string {
    if (s == null) return '—';
    const m = Math.floor(s / 60);
    const r = Math.floor(s % 60);
    return m > 0 ? `${m}m ${r}s` : `${r}s`;
  }

  // Para barras CSS
  const maxAgent = Math.max(1, ...byAgent.map(a => a.calls));
  const maxHour = Math.max(1, ...hourly.map(h => h.total));

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-slate-900">Reportes</h2>
            <p className="text-slate-500 mt-1">Métricas operativas del Call Center.</p>
          </div>
          <button onClick={exportCsv} className="inline-flex items-center gap-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 text-sm font-medium">
            <Download className="w-4 h-4" /> Exportar CSV
          </button>
        </div>

        {/* Filtros de fecha + agente */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Desde</label>
            <input type="date" value={from} onChange={e => setFrom(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Hasta</label>
            <input type="date" value={to} onChange={e => setTo(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Agente</label>
            <select value={agentId} onChange={e => setAgentId(e.target.value ? Number(e.target.value) : '')}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white">
              <option value="">Todos los agentes</option>
              {agentsList.map(a => (
                <option key={a.id} value={a.id}>{a.display_name}</option>
              ))}
            </select>
          </div>
          <button onClick={loadAll} disabled={loading}
            className="px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-sm font-medium">
            {loading ? 'Cargando…' : 'Aplicar'}
          </button>
          {[
            { l: 'Hoy', from: todayMinus(0), to: todayMinus(0) },
            { l: '7 días', from: todayMinus(7), to: todayMinus(0) },
            { l: '30 días', from: todayMinus(30), to: todayMinus(0) },
            { l: '90 días', from: todayMinus(90), to: todayMinus(0) },
          ].map(p => (
            <button key={p.l} onClick={() => { setFrom(p.from); setTo(p.to); setTimeout(loadAll, 0); }}
              className="px-3 py-2 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs">
              {p.l}
            </button>
          ))}
        </div>

        {error && (
          <div className="rounded-lg bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" /> {error}
          </div>
        )}

        {/* KPI cards: Total / Salientes / Entrantes / Perdidas / Duración entrante / saliente */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <KpiCard icon={Phone} label="Total llamadas" value={fmt(overview?.total)} color="slate" />
          <KpiCard icon={PhoneOutgoing} label="Salientes" value={fmt(overview?.outbound)} color="blue" />
          <KpiCard icon={PhoneIncoming} label="Entrantes" value={fmt(overview?.inbound)} color="emerald" />
          <KpiCard icon={PhoneMissed} label="Perdidas" value={fmt(overview?.missed)} color="rose" />
          <KpiCard icon={Clock} label="Dur. prom. saliente" value={fmtSecs(overview?.avg_outbound_duration)} color="indigo" />
          <KpiCard icon={Clock} label="Dur. prom. entrante" value={fmtSecs(overview?.avg_inbound_duration)} color="teal" />
        </div>

        {/* Distribución horaria con 3 series apiladas */}
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-900 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-brand-600" /> Llamadas por hora
            </h3>
            <div className="flex items-center gap-3 text-xs">
              <Legend color="bg-blue-500" label="Salientes" />
              <Legend color="bg-emerald-500" label="Entrantes" />
              <Legend color="bg-rose-500" label="Perdidas" />
            </div>
          </div>
          {hourly.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-8">Sin datos en el período seleccionado.</p>
          ) : (
            <div className="flex items-end gap-1 h-48">
              {Array.from({ length: 24 }, (_, h) => {
                const row = hourly.find(x => x.hour === h) ?? { total: 0, outbound: 0, inbound: 0, missed: 0 } as any;
                const totalH = (row.outbound ?? 0) + (row.inbound ?? 0) + (row.missed ?? 0);
                const pct = (totalH / maxHour) * 100;
                return (
                  <div key={h} className="flex-1 flex flex-col items-center gap-1 group relative">
                    <div className="w-full flex-1 flex flex-col-reverse">
                      <div className="w-full flex flex-col-reverse" style={{ height: `${pct}%`, minHeight: totalH > 0 ? '4px' : '0' }}>
                        {row.missed > 0 && <div className="bg-rose-500 rounded-t" style={{ flex: row.missed }} />}
                        {row.inbound > 0 && <div className="bg-emerald-500" style={{ flex: row.inbound }} />}
                        {row.outbound > 0 && <div className="bg-blue-500 rounded-t" style={{ flex: row.outbound }} />}
                      </div>
                    </div>
                    <div className="text-[10px] text-slate-500">{h}</div>
                    {totalH > 0 && (
                      <div className="absolute bottom-full mb-1 hidden group-hover:flex flex-col items-start bg-slate-800 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-10">
                        <span>{h}:00 — {totalH} total</span>
                        <span className="text-blue-300">Salientes: {row.outbound}</span>
                        <span className="text-emerald-300">Entrantes: {row.inbound}</span>
                        <span className="text-rose-300">Perdidas: {row.missed}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Por agente */}
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-brand-600" /> Llamadas por agente
          </h3>
          {byAgent.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-6">Sin agentes con actividad en el período.</p>
          ) : (
            <div className="space-y-2">
              {byAgent.slice(0, 20).map(a => (
                <div key={a.agent_id} className="flex items-center gap-3">
                  <div className="w-40 text-sm text-slate-700 truncate">{a.display_name}</div>
                  <div className="flex-1 bg-slate-100 rounded-full h-6 relative overflow-hidden">
                    <div className="absolute inset-y-0 left-0 bg-brand-500 rounded-full" style={{ width: `${(a.calls / maxAgent) * 100}%` }} />
                    <div className="relative px-2 text-xs leading-6 font-medium text-slate-700">{a.calls} ({a.completed} completadas)</div>
                  </div>
                  <div className="w-20 text-xs text-slate-500 text-right">AHT {fmtSecs(a.avg_talk)}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Por cola */}
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-brand-600" /> Llamadas por cola
          </h3>
          {byQueue.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-6">Sin colas con actividad.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-slate-500">
                <tr>
                  <th className="text-left py-2 font-medium">Cola</th>
                  <th className="text-right py-2 font-medium">Total</th>
                  <th className="text-right py-2 font-medium">Atendidas</th>
                  <th className="text-right py-2 font-medium">Abandonadas</th>
                  <th className="text-right py-2 font-medium">Espera prom.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {byQueue.map(q => (
                  <tr key={q.queue_id}>
                    <td className="py-2 text-slate-900 font-medium">{q.name}</td>
                    <td className="py-2 text-right text-slate-700">{q.calls}</td>
                    <td className="py-2 text-right text-emerald-700">{q.calls - q.abandoned}</td>
                    <td className="py-2 text-right text-rose-700">{q.abandoned}</td>
                    <td className="py-2 text-right text-slate-700">{fmtSecs(q.avg_wait)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </AppShell>
  );
}

// ===================================================================
// Sub-componentes
// ===================================================================

function KpiCard({ icon: Icon, label, value, color }: {
  icon: any; label: string; value: string; color: 'slate' | 'blue' | 'emerald' | 'rose' | 'indigo' | 'teal' | 'amber';
}) {
  const colorMap = {
    slate:   'bg-slate-50 text-slate-700',
    blue:    'bg-blue-50 text-blue-700',
    emerald: 'bg-emerald-50 text-emerald-700',
    rose:    'bg-rose-50 text-rose-700',
    indigo:  'bg-indigo-50 text-indigo-700',
    teal:    'bg-teal-50 text-teal-700',
    amber:   'bg-amber-50 text-amber-700',
  };
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className={`inline-flex items-center justify-center w-9 h-9 rounded-xl ${colorMap[color]}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="mt-2 text-xl font-bold text-slate-900">{value}</div>
      <div className="text-[11px] text-slate-500">{label}</div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-slate-600">
      <span className={`w-2.5 h-2.5 rounded ${color}`} /> {label}
    </span>
  );
}
