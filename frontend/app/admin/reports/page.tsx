'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/shared/AppShell';
import { api, unwrap } from '@/lib/api/client';
import { BarChart3, Download, Calendar, Users, Phone, Clock, TrendingUp, AlertCircle } from 'lucide-react';

interface Overview {
  total: number;
  answered: number;
  abandoned: number;
  missed: number;
  avg_duration_seconds: number;
  avg_wait_seconds: number;
  service_level_pct?: number;
}

interface AgentRow { agent_id: number; agent_name: string; total: number; answered: number; avg_handle_time: number; }
interface QueueRow { queue_id: number; queue_name: string; total: number; answered: number; abandoned: number; avg_wait: number; }
interface HourRow { hour: number; total: number; }

function todayMinus(days: number) {
  const d = new Date(); d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

export default function ReportsPage() {
  const [from, setFrom] = useState(todayMinus(7));
  const [to, setTo] = useState(todayMinus(0));
  const [overview, setOverview] = useState<Overview | null>(null);
  const [byAgent, setByAgent] = useState<AgentRow[]>([]);
  const [byQueue, setByQueue] = useState<QueueRow[]>([]);
  const [hourly, setHourly] = useState<HourRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function loadAll() {
    setLoading(true);
    const params = { from, to };
    Promise.all([
      api.get('/reports/overview', { params }).then(r => unwrap<Overview>(r)).catch(() => null),
      api.get('/reports/by-agent', { params }).then(r => unwrap<AgentRow[]>(r)).catch(() => []),
      api.get('/reports/by-queue', { params }).then(r => unwrap<QueueRow[]>(r)).catch(() => []),
      api.get('/reports/hourly', { params }).then(r => unwrap<HourRow[]>(r)).catch(() => []),
    ]).then(([ov, ag, qu, hr]) => {
      setOverview(ov);
      setByAgent(ag);
      setByQueue(qu);
      setHourly(hr);
      setError(null);
    }).catch(e => setError(e?.response?.data?.error?.message ?? 'Error al cargar reportes'))
    .finally(() => setLoading(false));
  }
  useEffect(() => { loadAll(); /* eslint-disable-next-line */ }, []);

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
  const maxAgent = Math.max(1, ...byAgent.map(a => a.total));
  const maxQueue = Math.max(1, ...byQueue.map(q => q.total));
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

        {/* Filtros de fecha */}
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

        {/* KPI cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-xs uppercase tracking-wide text-slate-500">Total llamadas</div>
                <div className="mt-2 text-2xl font-semibold text-slate-900">{fmt(overview?.total)}</div>
              </div>
              <Phone className="w-6 h-6 text-brand-600" />
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-xs uppercase tracking-wide text-slate-500">Atendidas</div>
                <div className="mt-2 text-2xl font-semibold text-emerald-700">{fmt(overview?.answered)}</div>
                <div className="text-xs text-slate-500 mt-1">{overview && overview.total > 0 ? `${((overview.answered / overview.total) * 100).toFixed(1)}%` : '—'}</div>
              </div>
              <TrendingUp className="w-6 h-6 text-emerald-600" />
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-xs uppercase tracking-wide text-slate-500">Abandonadas</div>
                <div className="mt-2 text-2xl font-semibold text-rose-700">{fmt(overview?.abandoned)}</div>
                <div className="text-xs text-slate-500 mt-1">{overview && overview.total > 0 ? `${((overview.abandoned / overview.total) * 100).toFixed(1)}%` : '—'}</div>
              </div>
              <AlertCircle className="w-6 h-6 text-rose-600" />
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-xs uppercase tracking-wide text-slate-500">Duración prom.</div>
                <div className="mt-2 text-2xl font-semibold text-slate-900">{fmtSecs(overview?.avg_duration_seconds)}</div>
                <div className="text-xs text-slate-500 mt-1">Espera: {fmtSecs(overview?.avg_wait_seconds)}</div>
              </div>
              <Clock className="w-6 h-6 text-amber-600" />
            </div>
          </div>
        </div>

        {/* Distribución horaria - bar chart CSS */}
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-brand-600" /> Distribución horaria
          </h3>
          {hourly.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-8">Sin datos en el período seleccionado.</p>
          ) : (
            <div className="grid grid-cols-24 gap-1 items-end h-40">
              {Array.from({ length: 24 }, (_, h) => {
                const row = hourly.find(x => x.hour === h);
                const v = row?.total ?? 0;
                const pct = (v / maxHour) * 100;
                return (
                  <div key={h} className="flex flex-col items-center gap-1">
                    <div className="w-full flex-1 flex items-end">
                      <div className="w-full bg-brand-500 rounded-t" style={{ height: `${pct}%`, minHeight: v > 0 ? '4px' : '0' }} title={`${v} llamadas`} />
                    </div>
                    <div className="text-[10px] text-slate-500">{h}</div>
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
                  <div className="w-40 text-sm text-slate-700 truncate">{a.agent_name}</div>
                  <div className="flex-1 bg-slate-100 rounded-full h-6 relative overflow-hidden">
                    <div className="absolute inset-y-0 left-0 bg-brand-500 rounded-full" style={{ width: `${(a.total / maxAgent) * 100}%` }} />
                    <div className="relative px-2 text-xs leading-6 font-medium text-slate-700">{a.total} ({a.answered} atendidas)</div>
                  </div>
                  <div className="w-20 text-xs text-slate-500 text-right">AHT {fmtSecs(a.avg_handle_time)}</div>
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
                    <td className="py-2 text-slate-900 font-medium">{q.queue_name}</td>
                    <td className="py-2 text-right text-slate-700">{q.total}</td>
                    <td className="py-2 text-right text-emerald-700">{q.answered}</td>
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
