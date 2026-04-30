'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/shared/AppShell';
import { api, unwrap } from '@/lib/api/client';
import { PhoneCall, ArrowDownLeft, ArrowUpRight, Search, Download } from 'lucide-react';
import Link from 'next/link';

interface Call {
  id: number;
  direction: 'inbound' | 'outbound' | 'internal';
  status: string;
  from_number: string | null;
  to_number: string | null;
  agent_id: number | null;
  agent_name?: string | null;
  queue_id: number | null;
  queue_name?: string | null;
  duration_seconds: number | null;
  started_at: string;
  answered_at: string | null;
  ended_at: string | null;
  is_recorded: boolean;
}

function fmtSecs(s: number | null): string {
  if (s == null) return '—';
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${String(r).padStart(2, '0')}`;
}

export default function CallsPage() {
  const [calls, setCalls] = useState<Call[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterDirection, setFilterDirection] = useState<'all'|'inbound'|'outbound'>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  function reload() {
    setLoading(true);
    api.get('/calls', { params: { limit: 200 } })
      .then(res => {
        const list = unwrap<any[]>(res);
        setCalls(list.map((c: any) => ({
          id: c.id,
          direction: c.direction,
          status: c.status,
          from_number: c.fromNumber ?? c.from_number,
          to_number: c.toNumber ?? c.to_number,
          agent_id: c.agentId ?? c.agent_id,
          agent_name: c.agentName ?? c.agent_name,
          queue_id: c.queueId ?? c.queue_id,
          queue_name: c.queueName ?? c.queue_name,
          duration_seconds: c.durationSeconds ?? c.duration_seconds,
          started_at: c.startedAt ?? c.started_at,
          answered_at: c.answeredAt ?? c.answered_at,
          ended_at: c.endedAt ?? c.ended_at,
          is_recorded: c.isRecorded ?? c.is_recorded ?? false,
        })));
      })
      .catch(e => setError(e?.response?.data?.error?.message ?? 'Error al cargar llamadas'))
      .finally(() => setLoading(false));
  }
  useEffect(() => { reload(); }, []);

  const filtered = calls.filter(c => {
    if (filterDirection !== 'all' && c.direction !== filterDirection) return false;
    if (filterStatus !== 'all' && c.status !== filterStatus) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!(
        c.from_number?.toLowerCase().includes(q) ||
        c.to_number?.toLowerCase().includes(q) ||
        c.agent_name?.toLowerCase().includes(q) ||
        String(c.id).includes(q)
      )) return false;
    }
    return true;
  });

  return (
    <AppShell>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-slate-900">Llamadas</h2>
            <p className="text-slate-500 mt-1">Historial completo de llamadas. {filtered.length} de {calls.length}.</p>
          </div>
          <a href={`${process.env.NEXT_PUBLIC_API_URL ?? ''}/api/reports/export.csv`} target="_blank" rel="noopener"
            className="inline-flex items-center gap-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 text-sm font-medium">
            <Download className="w-4 h-4" /> Exportar CSV
          </a>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-3 flex flex-wrap gap-3 items-center">
          <div className="flex-1 min-w-[200px] flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200">
            <Search className="w-4 h-4 text-slate-400" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por número, agente, ID..."
              className="flex-1 bg-transparent outline-none text-sm" />
          </div>
          <select value={filterDirection} onChange={e => setFilterDirection(e.target.value as any)}
            className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm">
            <option value="all">Todas</option>
            <option value="inbound">Entrantes</option>
            <option value="outbound">Salientes</option>
          </select>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm">
            <option value="all">Cualquier estado</option>
            <option value="completed">Completada</option>
            <option value="abandoned">Abandonada</option>
            <option value="failed">Fallida</option>
            <option value="no_answer">Sin respuesta</option>
            <option value="busy">Ocupado</option>
            <option value="ringing">Sonando</option>
            <option value="answered">Atendida</option>
          </select>
          <button onClick={reload} className="px-4 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-sm">Refrescar</button>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
              <tr>
                <th className="text-left px-4 py-3 font-medium">ID</th>
                <th className="text-left px-4 py-3 font-medium">Dir.</th>
                <th className="text-left px-4 py-3 font-medium">De</th>
                <th className="text-left px-4 py-3 font-medium">Hacia</th>
                <th className="text-left px-4 py-3 font-medium">Agente</th>
                <th className="text-left px-4 py-3 font-medium">Cola</th>
                <th className="text-left px-4 py-3 font-medium">Duración</th>
                <th className="text-left px-4 py-3 font-medium">Estado</th>
                <th className="text-left px-4 py-3 font-medium">Fecha</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && <tr><td colSpan={9} className="px-4 py-8 text-center text-slate-500">Cargando…</td></tr>}
              {error && <tr><td colSpan={9} className="px-4 py-8 text-center text-rose-600">{error}</td></tr>}
              {!loading && !error && filtered.length === 0 && (
                <tr><td colSpan={9} className="px-4 py-12 text-center text-slate-500">
                  <PhoneCall className="w-8 h-8 mx-auto mb-2 text-slate-300" />Sin llamadas en este filtro.
                </td></tr>
              )}
              {filtered.map(c => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <Link href={`/supervisor/calls/${c.id}`} className="text-brand-600 font-medium hover:underline">
                      #{c.id}
                    </Link>
                    {c.is_recorded && <span className="ml-1 text-xs">🎙️</span>}
                  </td>
                  <td className="px-4 py-3">
                    {c.direction === 'inbound' ? <ArrowDownLeft className="w-4 h-4 text-emerald-600" /> :
                     c.direction === 'outbound' ? <ArrowUpRight className="w-4 h-4 text-blue-600" /> :
                     <PhoneCall className="w-4 h-4 text-slate-500" />}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{c.from_number ?? '—'}</td>
                  <td className="px-4 py-3 font-mono text-xs">{c.to_number ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-700">{c.agent_name ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-700">{c.queue_name ?? '—'}</td>
                  <td className="px-4 py-3 font-mono text-xs">{fmtSecs(c.duration_seconds)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                      c.status === 'completed' || c.status === 'answered' ? 'bg-emerald-100 text-emerald-700' :
                      c.status === 'abandoned' || c.status === 'failed' ? 'bg-rose-100 text-rose-700' :
                      c.status === 'no_answer' || c.status === 'busy' ? 'bg-amber-100 text-amber-700' :
                      'bg-slate-100 text-slate-700'
                    }`}>{c.status}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">{new Date(c.started_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
