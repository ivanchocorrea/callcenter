'use client';

import { useEffect, useMemo, useState } from 'react';
import { AppShell } from '@/components/shared/AppShell';
import { api, unwrap, tokens } from '@/lib/api/client';
import {
  Phone, PhoneIncoming, PhoneOutgoing, PhoneOff, Search, Mic, Play, Pause, ChevronLeft, ChevronRight,
  Calendar, Clock, X, Hash, MessageSquare, User, Filter, RotateCcw, Download, AudioLines, FileAudio,
} from 'lucide-react';

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
  agentId?: number | null;
  agent_id?: number | null;
}

interface Agent {
  id: number;
  extension: string;
  display_name?: string;
  displayName?: string;
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

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function RecordingsPage() {
  const [calls, setCalls] = useState<Call[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtros (estilo dashboard PBX)
  const [agentFilter, setAgentFilter] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<CallType>('all');
  const [search, setSearch] = useState('');
  const [fromDate, setFromDate] = useState(todayISO());
  const [fromTime, setFromTime] = useState('00:00:00');
  const [toDate, setToDate] = useState(todayISO());
  const [toTime, setToTime] = useState('23:59:59');

  // Paginación
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 25;

  // Reproductor inline
  const [playingId, setPlayingId] = useState<number | null>(null);

  function reload() {
    setLoading(true);
    Promise.all([
      api.get('/calls?limit=500').then(r => unwrap<Call[]>(r) ?? []).catch(() => []),
      api.get('/agents').then(r => unwrap<Agent[]>(r) ?? []).catch(() => []),
    ])
      .then(([cs, ags]) => { setCalls(cs); setAgents(ags); })
      .finally(() => setLoading(false));
  }
  useEffect(() => { reload(); }, []);

  function clearFilters() {
    setAgentFilter(''); setTypeFilter('all'); setSearch('');
    setFromDate(todayISO()); setFromTime('00:00:00');
    setToDate(todayISO()); setToTime('23:59:59');
  }

  const filtered = useMemo(() => {
    const fromTs = new Date(`${fromDate}T${fromTime || '00:00:00'}`).getTime();
    const toTs = new Date(`${toDate}T${toTime || '23:59:59'}`).getTime();
    const q = search.trim().toLowerCase();
    return calls.filter(c => {
      const t = new Date(c.startedAt ?? c.started_at ?? '').getTime();
      if (t < fromTs || t > toTs) return false;
      if (agentFilter && String(c.agentId ?? c.agent_id ?? '') !== agentFilter) return false;
      if (typeFilter === 'inbound' && c.direction !== 'inbound') return false;
      if (typeFilter === 'outbound' && c.direction !== 'outbound') return false;
      if (typeFilter === 'abandoned' && c.status !== 'abandoned') return false;
      if (typeFilter === 'missed' && !['missed','no_answer','rejected','failed'].includes(c.status)) return false;
      if (q) {
        const fr = (c.fromNumber ?? c.from_number ?? '').toLowerCase();
        const tn = (c.toNumber ?? c.to_number ?? '').toLowerCase();
        const cid = (c.asteriskUniqueid ?? c.asterisk_uniqueid ?? '').toLowerCase();
        if (!fr.includes(q) && !tn.includes(q) && !cid.includes(q)) return false;
      }
      return true;
    });
  }, [calls, agentFilter, typeFilter, search, fromDate, fromTime, toDate, toTime]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageData = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  useEffect(() => { setPage(1); }, [agentFilter, typeFilter, search, fromDate, fromTime, toDate, toTime]);

  function recordingStreamUrl(recordingId: number): string {
    const base = api.defaults.baseURL ?? '/api';
    const token = tokens.getAccess() ?? '';
    return `${base}/recordings/${recordingId}/stream?token=${encodeURIComponent(token)}`;
  }

  function exportCsv() {
    const headers = ['ID', 'Origen', 'Destino', 'Tipo', 'Fecha', 'Duracion(s)', 'Estado', 'CallID', 'Agente'];
    const rows = filtered.map(c => {
      const ag = agents.find(a => a.id === (c.agentId ?? c.agent_id));
      return [
        c.id,
        c.fromNumber ?? c.from_number ?? '',
        c.toNumber ?? c.to_number ?? '',
        c.direction,
        c.startedAt ?? c.started_at ?? '',
        c.durationSeconds ?? c.duration_seconds ?? 0,
        c.status,
        c.asteriskUniqueid ?? c.asterisk_uniqueid ?? '',
        ag ? (ag.displayName ?? ag.display_name ?? `Ext ${ag.extension}`) : '',
      ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',');
    });
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `grabaciones-${todayISO()}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <AppShell>
      <div className="space-y-4">
        {/* === HEADER ESTILO DASHBOARD PBX === */}
        <div className="flex items-center justify-center gap-3 py-2">
          <div className="w-12 h-12 rounded-xl border-2 border-brand-500 bg-white flex items-center justify-center">
            <Play className="w-6 h-6 text-brand-600 fill-brand-600" />
          </div>
          <h1 className="text-2xl font-light text-brand-700">Grabaciones</h1>
        </div>

        {/* === BARRA DE FILTROS HORIZONTAL === */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-3">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Agente */}
            <FilterPill icon={User} title="Filtrar por agente">
              <select value={agentFilter} onChange={e => setAgentFilter(e.target.value)} className="bg-transparent text-sm border-0 outline-none cursor-pointer min-w-[140px]">
                <option value="">Todos los agentes</option>
                {agents.map(a => (
                  <option key={a.id} value={a.id}>{a.displayName ?? a.display_name ?? `Ext ${a.extension}`}</option>
                ))}
              </select>
            </FilterPill>

            {/* Tipo */}
            <FilterPill icon={Filter} title="Tipo de llamada">
              <select value={typeFilter} onChange={e => setTypeFilter(e.target.value as CallType)} className="bg-transparent text-sm border-0 outline-none cursor-pointer min-w-[120px]">
                <option value="all">Todas</option>
                <option value="inbound">Entrantes</option>
                <option value="outbound">Salientes</option>
                <option value="abandoned">Abandonadas</option>
                <option value="missed">Perdidas</option>
              </select>
            </FilterPill>

            {/* Buscar número */}
            <FilterPill icon={Hash} title="Buscar por número o call_id">
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar..."
                className="bg-transparent text-sm border-0 outline-none min-w-[140px] placeholder-slate-400" />
            </FilterPill>

            {/* Desde */}
            <FilterPill icon={Calendar}>
              <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
                className="bg-transparent text-sm border-0 outline-none cursor-pointer" />
            </FilterPill>
            <FilterPill icon={Clock}>
              <input type="time" step="1" value={fromTime} onChange={e => setFromTime(e.target.value)}
                className="bg-transparent text-sm border-0 outline-none cursor-pointer w-[80px]" />
            </FilterPill>

            <span className="text-sm text-slate-600 font-medium px-1">Hasta</span>

            <FilterPill icon={Calendar}>
              <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
                className="bg-transparent text-sm border-0 outline-none cursor-pointer" />
            </FilterPill>
            <FilterPill icon={Clock}>
              <input type="time" step="1" value={toTime} onChange={e => setToTime(e.target.value)}
                className="bg-transparent text-sm border-0 outline-none cursor-pointer w-[80px]" />
            </FilterPill>

            <div className="flex-1" />

            {/* Botón refresh */}
            <button onClick={reload} title="Recargar"
              className="w-9 h-9 rounded-full border-2 border-slate-300 hover:border-brand-500 hover:bg-brand-50 text-slate-500 hover:text-brand-600 inline-flex items-center justify-center transition">
              <RotateCcw className="w-4 h-4" />
            </button>

            {/* Botón exportar */}
            <button onClick={exportCsv} title="Exportar CSV"
              className="w-9 h-9 rounded-full bg-rose-500 hover:bg-rose-600 text-white inline-flex items-center justify-center transition">
              <Download className="w-4 h-4" />
            </button>

            {/* Limpiar filtros */}
            {(agentFilter || typeFilter !== 'all' || search) && (
              <button onClick={clearFilters} title="Limpiar filtros"
                className="text-xs text-slate-500 hover:text-slate-700 px-2">
                <X className="w-3 h-3 inline" /> Limpiar
              </button>
            )}
          </div>
        </div>

        {/* === TABLA: cabecera con iconos (estilo dashboard) === */}
        <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
          {/* Header con SOLO iconos */}
          <div className="grid grid-cols-12 gap-2 py-4 border-b border-slate-200 bg-slate-50/50">
            <HeaderIcon icon={MessageSquare} colSpan={2} tooltip="Origen / Destino" />
            <HeaderIcon icon={Calendar} colSpan={2} tooltip="Fecha y hora" />
            <HeaderIcon icon={Filter} colSpan={1} tooltip="Tipo" />
            <HeaderIcon icon={User} colSpan={2} tooltip="Agente" />
            <HeaderIcon icon={Clock} colSpan={1} tooltip="Duración" />
            <HeaderIcon icon={Mic} colSpan={2} tooltip="Estado" />
            <HeaderIcon icon={AudioLines} colSpan={2} tooltip="Reproducir grabación" />
          </div>

          {/* Filas */}
          {loading ? (
            <div className="px-4 py-16 text-center text-slate-500">Cargando…</div>
          ) : pageData.length === 0 ? (
            <div className="px-4 py-16 text-center text-slate-400 italic">
              No hay grabaciones
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {pageData.map(c => {
                const dir = c.direction;
                const from = c.fromNumber ?? c.from_number ?? '—';
                const to = c.toNumber ?? c.to_number ?? '—';
                const dur = c.durationSeconds ?? c.duration_seconds;
                const started = c.startedAt ?? c.started_at;
                const ag = agents.find(a => a.id === (c.agentId ?? c.agent_id));
                const recId = c.recordingId ?? c.recording_id;
                const statusInfo = STATUS_LABEL[c.status] ?? { label: c.status, color: 'bg-slate-100 text-slate-700' };
                return (
                  <div key={c.id}>
                    <div className="grid grid-cols-12 gap-2 px-3 py-3 items-center hover:bg-slate-50 text-sm">
                      <div className="col-span-2">
                        <div className="font-mono text-xs text-slate-700">{dir === 'inbound' ? from : to}</div>
                        <div className="font-mono text-[10px] text-slate-400">{dir === 'inbound' ? `→ ${to}` : `← ${from}`}</div>
                      </div>
                      <div className="col-span-2 text-xs text-slate-700">{fmtDate(started)}</div>
                      <div className="col-span-1">
                        {dir === 'inbound' ? (
                          <span className="inline-flex items-center gap-1 text-emerald-600 text-xs"><PhoneIncoming className="w-3.5 h-3.5" /></span>
                        ) : dir === 'outbound' ? (
                          <span className="inline-flex items-center gap-1 text-blue-600 text-xs"><PhoneOutgoing className="w-3.5 h-3.5" /></span>
                        ) : (
                          <Phone className="w-3.5 h-3.5 text-slate-500" />
                        )}
                      </div>
                      <div className="col-span-2 text-xs">
                        {ag ? (
                          <>
                            <div className="text-slate-900 font-medium truncate">{ag.displayName ?? ag.display_name ?? `Ext ${ag.extension}`}</div>
                            <div className="text-slate-400 font-mono text-[10px]">Ext {ag.extension}</div>
                          </>
                        ) : (
                          <span className="text-slate-400">— sin agente —</span>
                        )}
                      </div>
                      <div className="col-span-1 text-right font-mono text-xs">{fmtDur(dur)}</div>
                      <div className="col-span-2">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium ${statusInfo.color}`}>
                          {statusInfo.label}
                        </span>
                      </div>
                      <div className="col-span-2 text-right">
                        {recId ? (
                          <button
                            onClick={() => setPlayingId(playingId === c.id ? null : c.id)}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition ${
                              playingId === c.id
                                ? 'bg-brand-600 text-white shadow-md'
                                : 'bg-slate-100 hover:bg-brand-100 hover:text-brand-700 text-slate-700'
                            }`}
                            title={playingId === c.id ? 'Ocultar reproductor' : 'Mostrar reproductor'}
                          >
                            {playingId === c.id ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                            {playingId === c.id ? 'Ocultar' : 'Escuchar'}
                          </button>
                        ) : (
                          <span className="text-slate-300 text-xs italic">sin audio</span>
                        )}
                      </div>
                    </div>
                    {/* Reproductor inline (lazy: el <audio> solo se monta al click) */}
                    {playingId === c.id && recId && (
                      <div className="px-3 py-3 bg-brand-50/40 border-t border-brand-100">
                        <div className="flex items-center gap-3">
                          <FileAudio className="w-5 h-5 text-brand-600 shrink-0" />
                          <audio
                            src={recordingStreamUrl(recId)}
                            controls autoPlay preload="none"
                            className="flex-1 h-10"
                          >
                            Tu navegador no soporta audio.
                          </audio>
                          <a href={recordingStreamUrl(recId)}
                            download={`grabacion-${c.asteriskUniqueid ?? c.id}.mp3`}
                            className="text-xs text-brand-600 hover:text-brand-700 inline-flex items-center gap-1 px-2 py-1 rounded hover:bg-brand-100"
                            title="Descargar">
                            <Download className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* === FOOTER CON CONTEO Y PAGINACIÓN === */}
        <div className="flex items-center justify-between py-2">
          <div className="text-sm text-slate-600">
            <span className="text-2xl font-light text-slate-900">{filtered.length}</span>
            <span className="ml-2">{filtered.length === 1 ? 'Grabación' : 'Grabaciones'}</span>
          </div>
          {filtered.length > PAGE_SIZE && (
            <div className="inline-flex items-center gap-2 text-sm">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="p-1.5 rounded-full border border-slate-300 text-slate-600 hover:bg-slate-100 disabled:opacity-30">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs text-slate-700 px-2">
                Página {page} de {totalPages}
              </span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="p-1.5 rounded-full border border-slate-300 text-slate-600 hover:bg-slate-100 disabled:opacity-30">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900">
          <strong>⚠️ Sobre las grabaciones de audio:</strong> el módulo de grabación automática
          (<code>RecordingsModule</code>) está deshabilitado. Cuando se active, aparecerá el botón
          "Escuchar" en cada llamada con audio guardado y abrirá el reproductor inline (streaming
          HTTP, sin descarga completa). Por ahora la búsqueda y filtros ya funcionan sobre todas
          las llamadas registradas.
        </div>
      </div>
    </AppShell>
  );
}

function FilterPill({ icon: Icon, title, children }: { icon: any; title?: string; children: React.ReactNode }) {
  return (
    <div title={title} className="inline-flex items-center gap-2 pl-3 pr-3 py-1.5 rounded-full border border-slate-300 bg-white hover:border-brand-500 transition">
      <Icon className="w-4 h-4 text-brand-500" />
      {children}
    </div>
  );
}

function HeaderIcon({ icon: Icon, colSpan, tooltip }: { icon: any; colSpan: number; tooltip: string }) {
  return (
    <div className={`col-span-${colSpan} flex items-center justify-center`} title={tooltip}>
      <Icon className="w-5 h-5 text-brand-500" />
    </div>
  );
}
