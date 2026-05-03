'use client';

import { useEffect, useMemo, useState } from 'react';
import { AppShell } from '@/components/shared/AppShell';
import { api, unwrap, tokens } from '@/lib/api/client';
import { Phone, PhoneIncoming, PhoneOutgoing, PhoneOff, Search, Filter, Mic, Play, Pause, ChevronLeft, ChevronRight, Calendar, Clock, X, Hash } from 'lucide-react';

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
  durationSeconds?: number | null;
  duration_seconds?: number | null;
  startedAt?: string;
  started_at?: string;
  recordingId?: number | null;
  recording_id?: number | null;
}

type CallType = 'all' | 'inbound' | 'outbound' | 'abandoned' | 'missed';

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  completed:  { label: 'Contestada', color: 'bg-emerald-100 text-emerald-700' },
  answered:   { label: 'Contestada', color: 'bg-emerald-100 text-emerald-700' },
  missed:     { label: 'Perdida',    color: 'bg-rose-100 text-rose-700' },
  no_answer:  { label: 'No contesta', color: 'bg-rose-100 text-rose-700' },
  failed:     { label: 'Fallida',    color: 'bg-rose-100 text-rose-700' },
  busy:       { label: 'Ocupada',    color: 'bg-amber-100 text-amber-700' },
  rejected:   { label: 'Rechazada',  color: 'bg-rose-100 text-rose-700' },
  abandoned:  { label: 'Abandonada', color: 'bg-amber-100 text-amber-700' },
  ringing:    { label: 'Sonando',    color: 'bg-blue-100 text-blue-700' },
  initiated:  { label: 'Iniciando',  color: 'bg-slate-100 text-slate-700' },
};

function fmtDur(s: number | null | undefined): string {
  if (s == null || s <= 0) return '—';
  const min = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${min}:${String(sec).padStart(2, '0')}`;
}

function fmtDate(d: string | undefined): string {
  if (!d) return '—';
  try {
    const dt = new Date(d);
    return dt.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' }) +
      ' ' + dt.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch { return d; }
}

function todayMinus(days: number): string {
  const d = new Date(); d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

export default function RecordingsPage() {
  const [calls, setCalls] = useState<Call[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtros
  const [search, setSearch] = useState('');
  const [type, setType] = useState<CallType>('all');
  const [from, setFrom] = useState(todayMinus(7));
  const [to, setTo] = useState(todayMinus(0));
  const [minDur, setMinDur] = useState<string>('');
  const [maxDur, setMaxDur] = useState<string>('');

  // Paginación
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 25;

  // Reproductor inline
  const [playingId, setPlayingId] = useState<number | null>(null);

  function reload() {
    setLoading(true);
    api.get('/calls?limit=500')
      .then(r => setCalls(unwrap<Call[]>(r) ?? []))
      .catch(() => setCalls([]))
      .finally(() => setLoading(false));
  }
  useEffect(() => { reload(); }, []);

  // Aplicar filtros (en memoria por ahora; cuando el backend tenga query
  // params, mover esto al servidor para consultas masivas)
  const filtered = useMemo(() => {
    const fromTs = from ? new Date(from + 'T00:00:00').getTime() : 0;
    const toTs = to ? new Date(to + 'T23:59:59').getTime() : Infinity;
    const minD = minDur ? Number(minDur) : 0;
    const maxD = maxDur ? Number(maxDur) : Infinity;
    const q = search.trim().toLowerCase();
    return calls.filter(c => {
      const t = new Date(c.startedAt ?? c.started_at ?? '').getTime();
      if (t < fromTs || t > toTs) return false;
      const dur = c.durationSeconds ?? c.duration_seconds ?? 0;
      if (dur < minD || dur > maxD) return false;
      // Type filter
      if (type === 'inbound' && c.direction !== 'inbound') return false;
      if (type === 'outbound' && c.direction !== 'outbound') return false;
      if (type === 'abandoned' && c.status !== 'abandoned') return false;
      if (type === 'missed' && !['missed','no_answer','rejected','failed'].includes(c.status)) return false;
      // Search en numeros
      if (q) {
        const fr = (c.fromNumber ?? c.from_number ?? '').toLowerCase();
        const tn = (c.toNumber ?? c.to_number ?? '').toLowerCase();
        const cid = (c.asteriskUniqueid ?? c.asterisk_uniqueid ?? '').toLowerCase();
        if (!fr.includes(q) && !tn.includes(q) && !cid.includes(q)) return false;
      }
      return true;
    });
  }, [calls, search, type, from, to, minDur, maxDur]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageData = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  useEffect(() => { setPage(1); }, [search, type, from, to, minDur, maxDur]);

  function clearFilters() {
    setSearch(''); setType('all'); setMinDur(''); setMaxDur('');
    setFrom(todayMinus(7)); setTo(todayMinus(0));
  }

  function recordingStreamUrl(callId: number, recordingId: number): string {
    const base = api.defaults.baseURL ?? '/api';
    const token = tokens.getAccess() ?? '';
    return `${base}/recordings/${recordingId}/stream?token=${encodeURIComponent(token)}`;
  }

  return (
    <AppShell>
      <div className="space-y-5">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Registro de llamadas (CDR) y grabaciones</h2>
          <p className="text-slate-500 mt-1">Búsqueda avanzada de todas las llamadas + reproductor de grabaciones inline.</p>
        </div>

        {/* Filtros */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <Filter className="w-4 h-4 text-brand-600" /> Filtros
            </h3>
            <button onClick={clearFilters} className="text-xs text-slate-500 hover:text-slate-700 inline-flex items-center gap-1">
              <X className="w-3 h-3" /> Limpiar
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">Buscar (número o call_id)</label>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="3001234567..."
                  className="w-full pl-8 pr-3 py-2 text-sm rounded-lg border border-slate-300" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Tipo</label>
              <select value={type} onChange={e => setType(e.target.value as CallType)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white">
                <option value="all">Todas</option>
                <option value="inbound">Entrantes</option>
                <option value="outbound">Salientes</option>
                <option value="abandoned">Abandonadas</option>
                <option value="missed">Perdidas / fallidas</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Desde</label>
              <input type="date" value={from} onChange={e => setFrom(e.target.value)}
                className="w-full px-2 py-2 text-sm rounded-lg border border-slate-300" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Hasta</label>
              <input type="date" value={to} onChange={e => setTo(e.target.value)}
                className="w-full px-2 py-2 text-sm rounded-lg border border-slate-300" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Duración (seg)</label>
              <div className="flex items-center gap-1">
                <input type="number" placeholder="min" min={0} value={minDur} onChange={e => setMinDur(e.target.value)}
                  className="w-full px-2 py-2 text-sm rounded-lg border border-slate-300" />
                <input type="number" placeholder="max" min={0} value={maxDur} onChange={e => setMaxDur(e.target.value)}
                  className="w-full px-2 py-2 text-sm rounded-lg border border-slate-300" />
              </div>
            </div>
          </div>
          <div className="text-xs text-slate-500">
            {loading ? 'Cargando…' : `${filtered.length} resultado${filtered.length === 1 ? '' : 's'} en el rango.`}
          </div>
        </div>

        {/* Tabla CDR */}
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
              <tr>
                <th className="text-left px-4 py-2 font-medium">Tipo</th>
                <th className="text-left px-4 py-2 font-medium">Origen</th>
                <th className="text-left px-4 py-2 font-medium">Destino</th>
                <th className="text-left px-4 py-2 font-medium">Fecha y hora</th>
                <th className="text-right px-4 py-2 font-medium">Duración</th>
                <th className="text-left px-4 py-2 font-medium">Estado</th>
                <th className="text-left px-4 py-2 font-medium">Call ID</th>
                <th className="text-right px-4 py-2 font-medium">Grabación</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && (
                <tr><td colSpan={8} className="px-4 py-12 text-center text-slate-500">Cargando…</td></tr>
              )}
              {!loading && pageData.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-12 text-center text-slate-500">
                  <Mic className="w-8 h-8 mx-auto mb-2 text-slate-300" /> Sin llamadas en el rango seleccionado.
                </td></tr>
              )}
              {pageData.map(c => {
                const dir = c.direction;
                const from = c.fromNumber ?? c.from_number ?? '—';
                const to = c.toNumber ?? c.to_number ?? '—';
                const dur = c.durationSeconds ?? c.duration_seconds;
                const started = c.startedAt ?? c.started_at;
                const callId = c.asteriskUniqueid ?? c.asterisk_uniqueid ?? `db-${c.id}`;
                const recId = c.recordingId ?? c.recording_id;
                const statusInfo = STATUS_LABEL[c.status] ?? { label: c.status, color: 'bg-slate-100 text-slate-700' };
                return (
                  <>
                    <tr key={c.id} className="hover:bg-slate-50">
                      <td className="px-4 py-2">
                        {dir === 'inbound' ? (
                          <span className="inline-flex items-center gap-1 text-emerald-600" title="Entrante"><PhoneIncoming className="w-4 h-4" /> Entrante</span>
                        ) : dir === 'outbound' ? (
                          <span className="inline-flex items-center gap-1 text-blue-600" title="Saliente"><PhoneOutgoing className="w-4 h-4" /> Saliente</span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-slate-600"><Phone className="w-4 h-4" /> {dir}</span>
                        )}
                      </td>
                      <td className="px-4 py-2 font-mono text-xs">{from}</td>
                      <td className="px-4 py-2 font-mono text-xs">{to}</td>
                      <td className="px-4 py-2 text-slate-700">{fmtDate(started)}</td>
                      <td className="px-4 py-2 text-right font-mono">{fmtDur(dur)}</td>
                      <td className="px-4 py-2">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${statusInfo.color}`}>
                          {statusInfo.label}
                        </span>
                      </td>
                      <td className="px-4 py-2 font-mono text-[10px] text-slate-500" title={callId}>
                        {callId.length > 16 ? callId.slice(0, 16) + '…' : callId}
                      </td>
                      <td className="px-4 py-2 text-right">
                        {recId ? (
                          <button
                            onClick={() => setPlayingId(playingId === c.id ? null : c.id)}
                            className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${
                              playingId === c.id ? 'bg-brand-600 text-white' : 'bg-slate-100 hover:bg-brand-100 hover:text-brand-700 text-slate-700'
                            }`}
                            title={playingId === c.id ? 'Ocultar' : 'Mostrar grabación'}
                          >
                            {playingId === c.id ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                            {playingId === c.id ? 'Ocultar' : 'Escuchar'}
                          </button>
                        ) : (
                          <span className="text-slate-300 text-xs">—</span>
                        )}
                      </td>
                    </tr>
                    {/* Reproductor inline (toggle) — lazy loading: el <audio> solo se monta cuando el usuario clickea */}
                    {playingId === c.id && recId && (
                      <tr className="bg-brand-50/30">
                        <td colSpan={8} className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <Mic className="w-4 h-4 text-brand-600 shrink-0" />
                            <audio
                              src={recordingStreamUrl(c.id, recId)}
                              controls
                              autoPlay
                              preload="none"  /* no carga hasta interaccion */
                              className="flex-1"
                            >
                              Tu navegador no soporta audio HTML5.
                            </audio>
                            <a
                              href={recordingStreamUrl(c.id, recId)}
                              download={`grabacion-${callId}.mp3`}
                              className="text-xs text-brand-600 hover:text-brand-700 inline-flex items-center gap-1"
                              title="Descargar"
                            >
                              ↓ Descargar
                            </a>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>

          {/* Paginación */}
          {filtered.length > PAGE_SIZE && (
            <div className="border-t border-slate-100 px-4 py-3 flex items-center justify-between text-sm">
              <div className="text-xs text-slate-500">
                Mostrando {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} de {filtered.length}
              </div>
              <div className="inline-flex items-center gap-1">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-1.5 rounded text-slate-600 hover:bg-slate-100 disabled:opacity-30"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="px-2 text-xs text-slate-700">
                  {page} / {totalPages}
                </span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="p-1.5 rounded text-slate-600 hover:bg-slate-100 disabled:opacity-30"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900">
          <strong>⚠️ Sobre las grabaciones de audio:</strong> el módulo de grabación automática
          (<code>RecordingsModule</code>) está deshabilitado en este deploy. Cuando se active, las
          grabaciones aparecerán en la columna "Grabación" con botón "Escuchar" → reproductor inline
          (sin descarga completa, streaming HTTP con <code>preload="none"</code> + range requests).
          La búsqueda y filtros ya funcionan sobre todas las llamadas registradas.
        </div>
      </div>
    </AppShell>
  );
}
