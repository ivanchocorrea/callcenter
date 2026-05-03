'use client';

import { useEffect, useMemo, useState } from 'react';
import { AppShell } from '@/components/shared/AppShell';
import {
  Phone, PhoneOff, PhoneOutgoing, PhoneIncoming, PhoneMissed, PhoneForwarded,
  Delete, Mic, MicOff, Volume2, VolumeX, Pause, Play,
  Search, ChevronLeft, ChevronRight, FileText, History, X,
  Coffee, GraduationCap, Power, ChevronDown, Save, StickyNote, User,
} from 'lucide-react';
import { api, unwrap } from '@/lib/api/client';
import { useSip } from '@/lib/webrtc/sip-context';

// ===================================================================
// Tipos
// ===================================================================

interface RecentCall {
  id: number;
  to_number: string;
  from_number: string | null;
  direction: 'outbound' | 'inbound' | string;
  status: string;
  duration_seconds: number | null;
  started_at: string;
}

interface CallScript {
  id: number;
  name: string;
  content: string;
  script_type: 'outbound' | 'inbound' | 'both';
  sort_order: number;
}

interface HistoryResponse { items: any[]; total: number; page: number; limit: number }
interface AgentSettings { allow_agent_reject_inbound: boolean }

interface QueuedCall {
  id: number;
  from_number: string | null;
  to_number: string;
  started_at: string;
}

interface CustomerInfo {
  id: number;
  name: string;
  primary_phone?: string | null;
  email?: string | null;
  is_vip?: boolean;
  important_notes?: string | null;
  [k: string]: any;
}

interface Disposition {
  id: number;
  slug: string;
  label: string;
  parent_id: number | null;
  is_positive?: boolean;
  is_callback?: boolean;
  color?: string | null;
}

type AgentStatus = 'available' | 'busy' | 'paused' | 'lunch' | 'training' | 'offline';

const AGENT_STATUSES: { key: AgentStatus; label: string; icon: any; dot: string; bg: string }[] = [
  { key: 'available', label: 'Disponible',  icon: Phone,           dot: 'bg-emerald-500', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { key: 'busy',      label: 'Ocupado',     icon: PhoneIncoming,   dot: 'bg-amber-500',   bg: 'bg-amber-50 text-amber-700 border-amber-200' },
  { key: 'paused',    label: 'En pausa',    icon: Pause,           dot: 'bg-slate-400',   bg: 'bg-slate-50 text-slate-700 border-slate-200' },
  { key: 'lunch',     label: 'Almuerzo',    icon: Coffee,          dot: 'bg-orange-500',  bg: 'bg-orange-50 text-orange-700 border-orange-200' },
  { key: 'training',  label: 'Capacitación',icon: GraduationCap,   dot: 'bg-indigo-500',  bg: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  { key: 'offline',   label: 'Offline',     icon: Power,           dot: 'bg-slate-700',   bg: 'bg-slate-100 text-slate-700 border-slate-300' },
];

const KEYS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['*', '0', '#'],
];

type ScriptTab = 'outbound' | 'inbound';

// ===================================================================
// Componente principal
// ===================================================================

export default function DialerPage() {
  const sip = useSip();
  const [num, setNum] = useState('');
  const [calling, setCalling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Historial
  const [recent, setRecent] = useState<RecentCall[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');

  // Guiones
  const [scripts, setScripts] = useState<CallScript[]>([]);
  const [scriptTab, setScriptTab] = useState<ScriptTab>('outbound');
  const [activeScriptId, setActiveScriptId] = useState<number | null>(null);

  // Settings de la empresa (puede rechazar entrantes?)
  const [agentSettings, setAgentSettings] = useState<AgentSettings>({ allow_agent_reject_inbound: true });

  // Controles del dialer (sincronizados con el audio real)
  const [volume, setVolumeState] = useState(80);
  const [speakerOn, setSpeakerOnState] = useState(true);

  // Aplica el volumen al audio real cada vez que cambia
  useEffect(() => { sip.setVolume(volume); }, [volume, sip.active]);
  // Aplica el toggle de altavoz al audio real
  useEffect(() => { sip.setSpeaker(speakerOn); }, [speakerOn, sip.active]);

  // Transferir
  const [showTransfer, setShowTransfer] = useState(false);
  const [transferDest, setTransferDest] = useState('');
  const [transferring, setTransferring] = useState(false);
  const [activeCallId, setActiveCallId] = useState<number | null>(null);

  // Cola de llamadas entrantes (visible a todos los agentes)
  const [queuedCalls, setQueuedCalls] = useState<QueuedCall[]>([]);

  // Datos del cliente que está llamando (lookup por teléfono)
  const [incomingCustomer, setIncomingCustomer] = useState<CustomerInfo | null>(null);

  // Estado del agente (Disponible, Ocupado, etc) — dropdown
  const [agentStatus, setAgentStatus] = useState<AgentStatus>('offline');
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);

  // Notas y tipificación de la llamada activa.
  // Separamos parent/child porque el dropdown de sub-tipificación no podía
  // coexistir con un solo `dispositionId` (cuando se elegía child, el parent
  // se "perdía" en el dropdown principal). Al guardar enviamos el id MÁS
  // específico (child si hay, sino parent).
  const [callNotes, setCallNotes] = useState('');
  const [dispositionParentId, setDispositionParentId] = useState<number | null>(null);
  const [dispositionChildId, setDispositionChildId] = useState<number | null>(null);
  const [dispositions, setDispositions] = useState<Disposition[]>([]);
  const [savingNotes, setSavingNotes] = useState(false);
  const [notesSaved, setNotesSaved] = useState(false);

  // Duración de la llamada en vivo (segundos)
  const [callDuration, setCallDuration] = useState(0);
  const [showKeypad, setShowKeypad] = useState(false);
  const [activeCallTab, setActiveCallTab] = useState<'acciones' | 'info' | 'historia'>('acciones');

  // Último número que el agente marcó (para mostrarlo como destino en la tarjeta
  // de llamada activa — el remoteUri que devuelve Asterisk es el CallerID de
  // la troncal, no el destino real, que es lo que el agente quiere ver).
  const [lastDialedNumber, setLastDialedNumber] = useState<string | null>(null);

  // ----------------- Cargar historial (3 columnas, sin paginación) -----------------
  async function loadHistory(p = page, q = search) {
    try {
      // Limit alto para tener llamadas suficientes para distribuir en las 3 columnas.
      const res = await api.get('/dial/history', { params: { page: p, limit: 100, q: q || undefined } });
      const data = unwrap<HistoryResponse>(res);
      setRecent(data.items.map((c: any) => ({
        id: c.id,
        to_number: c.toNumber ?? c.to_number ?? '',
        from_number: c.fromNumber ?? c.from_number ?? null,
        direction: c.direction,
        status: c.status,
        duration_seconds: c.durationSeconds ?? c.duration_seconds ?? null,
        started_at: c.startedAt ?? c.started_at,
      })));
      setTotal(data.total);
    } catch { /* ignore */ }
  }

  async function loadScripts() {
    try {
      const res = await api.get('/call-scripts/active');
      const data = unwrap<CallScript[]>(res);
      setScripts(data);
    } catch { /* ignore */ }
  }

  async function loadAgentSettings() {
    try {
      const res = await api.get('/companies/me/agent-settings');
      setAgentSettings(unwrap<AgentSettings>(res));
    } catch { /* ignore — default permitido */ }
  }

  async function loadQueue() {
    try {
      const res = await api.get('/dial/queue', { params: { limit: 5 } });
      const data = unwrap<any[]>(res);
      setQueuedCalls(data.map(c => ({
        id: c.id,
        from_number: c.fromNumber ?? c.from_number ?? null,
        to_number: c.toNumber ?? c.to_number ?? '',
        started_at: c.startedAt ?? c.started_at,
      })));
    } catch { /* ignore */ }
  }

  // Lookup del cliente cuando entra una llamada
  async function lookupCustomer(phone: string) {
    if (!phone) { setIncomingCustomer(null); return; }
    try {
      const res = await api.get('/customers/lookup', { params: { phone } });
      const data = unwrap<any>(res);
      setIncomingCustomer(data ?? null);
    } catch { setIncomingCustomer(null); }
  }

  async function loadDispositions() {
    try {
      const res = await api.get('/dispositions');
      setDispositions(unwrap<Disposition[]>(res));
    } catch { /* ignore */ }
  }

  async function loadMyStatus() {
    try {
      const res = await api.get('/agents/me/status');
      const s = unwrap<{ status: AgentStatus }>(res);
      setAgentStatus(s.status);
    } catch { /* ignore */ }
  }

  async function changeStatus(s: AgentStatus) {
    setAgentStatus(s);
    setStatusMenuOpen(false);
    try { await api.put('/agents/me/status', { status: s }); } catch { /* revert? */ }
  }

  async function saveNotes(opts: { silent?: boolean } = {}) {
    if (!activeCallId || savingNotes) return;
    // Nada que guardar — evita request vacío al auto-guardar
    if (!callNotes && !dispositionParentId && !dispositionChildId) return;
    setSavingNotes(true);
    if (!opts.silent) setNotesSaved(false);
    try {
      await api.patch(`/calls/${activeCallId}/notes`, {
        notes: callNotes || null,
        disposition_id: dispositionChildId ?? dispositionParentId,
      });
      if (!opts.silent) {
        setNotesSaved(true);
        setTimeout(() => setNotesSaved(false), 2500);
      }
    } catch { /* ignore */ } finally { setSavingNotes(false); }
  }

  // Resolver activeCallId también para llamadas ENTRANTES — el INVITE entrante
  // no nos da call_id (sí en outbound vía /dial). Polleamos /dial/current
  // mientras haya llamada SIP activa hasta que aparezca el id.
  async function fetchCurrentCallId() {
    try {
      const res = await api.get('/dial/current');
      const data = unwrap<{ call_id: number } | null>(res);
      if (data?.call_id) setActiveCallId(Number(data.call_id));
    } catch { /* ignore */ }
  }

  useEffect(() => {
    loadHistory(1, ''); loadScripts(); loadAgentSettings(); loadQueue();
    loadDispositions(); loadMyStatus();
  }, []);
  useEffect(() => {
    const interval = setInterval(loadQueue, 8000);
    return () => clearInterval(interval);
  }, []);

  // Auto-guardar notas/tipificación cuando la llamada termina (sip.active
  // pasó de truthy a null) — evita perder notas si el agente colgó sin
  // hacer click en "Guardar". Después limpia el panel para la próxima.
  useEffect(() => {
    if (!sip.active && !sip.incoming && activeCallId) {
      void (async () => {
        await saveNotes({ silent: true });
        setActiveCallId(null);
        setCallNotes('');
        setDispositionParentId(null);
        setDispositionChildId(null);
        setLastDialedNumber(null);
        setIncomingCustomer(null);
      })();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sip.active, sip.incoming]);

  // Cuando entra una llamada ENTRANTE y el agente está conectado (sip.active),
  // resolvemos el call_id desde el backend. Reintenta cada 2s mientras no haya id.
  useEffect(() => {
    if (!sip.active || activeCallId) return;
    void fetchCurrentCallId();
    const interval = setInterval(fetchCurrentCallId, 2000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sip.active, activeCallId]);

  // Timer de duración en vivo cuando hay llamada activa
  useEffect(() => {
    if (!sip.active) { setCallDuration(0); return; }
    const startedAt = sip.active.startedAt instanceof Date
      ? sip.active.startedAt.getTime()
      : Date.now();
    const tick = () => setCallDuration(Math.floor((Date.now() - startedAt) / 1000));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [sip.active]);
  useEffect(() => { loadHistory(page, search); }, [page]);
  useEffect(() => {
    const t = setTimeout(() => { setPage(1); loadHistory(1, search); }, 300);
    return () => clearTimeout(t);
  }, [search]);

  // Auto-cambiar tab del guion según hay llamada activa entrante/saliente
  useEffect(() => {
    if (sip.incoming) setScriptTab('inbound');
  }, [sip.incoming]);

  // Cuando se cambia de tab, seleccionar primer script visible
  const visibleScripts = useMemo(
    () => scripts.filter(s => s.script_type === scriptTab || s.script_type === 'both'),
    [scripts, scriptTab],
  );
  useEffect(() => {
    if (visibleScripts.length > 0 && !visibleScripts.find(s => s.id === activeScriptId)) {
      setActiveScriptId(visibleScripts[0].id);
    }
    if (visibleScripts.length === 0) setActiveScriptId(null);
  }, [visibleScripts, activeScriptId]);

  // Refresca historial cuando termina una llamada
  useEffect(() => {
    if (!sip.active && !sip.incoming) {
      const t = setTimeout(() => loadHistory(page, search), 1500);
      return () => clearTimeout(t);
    }
  }, [sip.active, sip.incoming]);

  // ----------------- Acciones -----------------
  const press = (k: string) => setNum(v => (v + k).slice(0, 25));

  async function call(dest?: string) {
    const number = (dest ?? num).trim();
    if (!number || calling || sip.active) return;
    setCalling(true);
    setError(null);
    try {
      sip.markPendingOutbound(20000);
      setLastDialedNumber(number);  // recordamos para mostrar en la tarjeta
      void lookupCustomer(number);  // lookup del destino para mostrar nombre si existe
      const res = await api.post('/dial', { number });
      const data = unwrap<any>(res);
      if (data?.callId) setActiveCallId(Number(data.callId));
      if (!dest) setNum('');
      setTimeout(() => loadHistory(1, ''), 1500);
      setPage(1);
    } catch (err: any) {
      setError(err?.response?.data?.error?.message ?? 'Error al iniciar llamada');
    } finally {
      setCalling(false);
    }
  }

  async function doTransfer() {
    if (!transferDest.trim() || !activeCallId || transferring) return;
    setTransferring(true);
    try {
      await api.post(`/dial/${activeCallId}/transfer`, { destination: transferDest.trim() });
      setShowTransfer(false);
      setTransferDest('');
    } catch (err: any) {
      setError(err?.response?.data?.error?.message ?? 'Error al transferir');
    } finally {
      setTransferring(false);
    }
  }

  // ----------------- Render -----------------
  const groupedHistory = useMemo(() => groupByDay(recent), [recent]);
  const totalPages = Math.max(1, Math.ceil(total / 20));
  const activeScript = scripts.find(s => s.id === activeScriptId) ?? null;

  const currentStatus = AGENT_STATUSES.find(s => s.key === agentStatus) ?? AGENT_STATUSES[5];
  const StatusIcon = currentStatus.icon;

  return (
    <AppShell>
      <div className="space-y-4">
        {/* ============ BARRA SUPERIOR: estado del agente ============ */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm px-4 py-2.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Mi estado</span>
            <div className="relative">
              <button
                onClick={() => setStatusMenuOpen(v => !v)}
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-medium ${currentStatus.bg}`}
              >
                <span className={`w-2 h-2 rounded-full ${currentStatus.dot}`} />
                <StatusIcon className="w-3.5 h-3.5" />
                {currentStatus.label}
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
              {statusMenuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setStatusMenuOpen(false)} />
                  <div className="absolute z-20 left-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg p-1 w-56">
                    {AGENT_STATUSES.map(s => {
                      const Icon = s.icon;
                      const isCurrent = s.key === agentStatus;
                      return (
                        <button
                          key={s.key}
                          onClick={() => changeStatus(s.key)}
                          className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left transition ${
                            isCurrent ? 'bg-brand-50 text-brand-700' : 'hover:bg-slate-50 text-slate-700'
                          }`}
                        >
                          <span className={`w-2 h-2 rounded-full ${s.dot}`} />
                          <Icon className="w-4 h-4" />
                          <span className="flex-1">{s.label}</span>
                          {isCurrent && <span className="text-xs text-brand-600">●</span>}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </div>
          {queuedCalls.length > 0 && (
            <div className="flex items-center gap-2 text-xs">
              <span className="px-2 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-full font-medium animate-pulse">
                {queuedCalls.length} en cola
              </span>
              <span className="text-slate-500 truncate max-w-xs">
                {queuedCalls.slice(0, 3).map(c => c.from_number ?? '?').join(' · ')}
              </span>
            </div>
          )}
        </div>

        {/* Fila superior: dialer ancho fijo (~380px) + script ocupa el resto */}
        <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-4">
          {/* ============ DIALER ============ */}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="border-b border-slate-100 px-5 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2 text-slate-700">
                <Phone className="w-4 h-4 text-brand-600" />
                <span className="text-sm font-semibold">Marcador</span>
              </div>
              <StatusPill state={sip.state} active={!!sip.active} />
            </div>

            {/* ============ LLAMADA ENTRANTE — diseño "iPhone llamando" ============ */}
            {sip.incoming && (
              <IncomingCallBanner
                fromNumber={sip.incoming.fromNumber}
                displayName={sip.incoming.displayName}
                customer={incomingCustomer}
                allowReject={agentSettings.allow_agent_reject_inbound}
                onAnswer={() => sip.answer()}
                onReject={() => sip.hangup()}
              />
            )}

            <div className="p-4">
              {sip.active ? (
                /* ============ TARJETA SOFTPHONE (con llamada activa) ============ */
                (() => {
                  // Determinar qué mostrar como destino:
                  // - Si es saliente (lastDialedNumber existe): el número que el agente marcó
                  // - Si es entrante: el remoteUri (número del que llama)
                  const isOutbound = !!lastDialedNumber;
                  const destNumber = isOutbound ? lastDialedNumber : sip.active.remoteUri;
                  const customerName = incomingCustomer?.name;
                  const displayName = customerName ?? (isOutbound ? null : sip.active.displayName);
                  const tipoLlamada = isOutbound ? 'Saliente' : 'Entrante';
                  return (
                    <div className="rounded-2xl bg-gradient-to-br from-brand-600 to-brand-700 text-white p-5 shadow-lg">
                      <div className="flex items-start gap-3">
                        <div className="w-14 h-14 rounded-full bg-white/20 backdrop-blur flex items-center justify-center ring-2 ring-white/30">
                          <User className="w-7 h-7 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[10px] uppercase tracking-widest text-white/70 font-bold">
                            {tipoLlamada}
                          </div>
                          <div className="font-bold text-lg truncate">
                            {displayName ?? destNumber}
                          </div>
                          {displayName && (
                            <div className="text-sm text-white/80 font-mono truncate">{destNumber}</div>
                          )}
                          {incomingCustomer?.is_vip && (
                            <span className="inline-block mt-1 text-[10px] uppercase tracking-wide bg-amber-400 text-amber-900 px-1.5 py-0.5 rounded font-bold">
                              ⭐ VIP
                            </span>
                          )}
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-white/70 uppercase tracking-wide">Duración</div>
                          <div className="text-2xl font-mono font-bold tabular-nums">{formatDuration(callDuration)}</div>
                          {sip.active.onHold && (
                            <span className="inline-block mt-0.5 text-[10px] uppercase tracking-wide bg-amber-300 text-amber-900 px-1.5 py-0.5 rounded font-bold">
                              ⏸ EN ESPERA
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })()
              ) : (
                /* ============ DISPLAY + KEYPAD (sin llamada) ============ */
                <>
                  <input
                    value={num}
                    onChange={e => setNum(e.target.value.replace(/[^\d+*#]/g, ''))}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && num && !calling) {
                        e.preventDefault();
                        void call();
                      }
                    }}
                    placeholder="3001234567"
                    autoFocus
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-lg font-mono tracking-wider text-center outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200 focus:bg-white transition"
                  />
                  <div className="mt-3 grid grid-cols-3 gap-1.5 max-w-[280px] mx-auto">
                    {KEYS.flat().map(k => (
                      <button
                        key={k}
                        onClick={() => press(k)}
                        className="h-11 rounded-lg bg-white hover:bg-brand-50 hover:border-brand-300 border border-slate-200 text-base font-medium text-slate-700 transition active:scale-95 shadow-sm"
                      >
                        {k}
                      </button>
                    ))}
                  </div>
                </>
              )}

              {error && (
                <div className="mt-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-sm p-2.5">
                  {error}
                </div>
              )}

              {/* Botón principal: Llamar / Colgar */}
              <div className="mt-3 grid grid-cols-3 gap-2">
                {sip.active ? (
                  <>
                    <button
                      onClick={() => setShowKeypad(v => !v)}
                      title="Mostrar teclado para enviar tonos (ej: presione 1 en menús IVR)"
                      className={`rounded-xl py-2.5 text-xs font-medium flex items-center justify-center gap-1 transition ${
                        showKeypad
                          ? 'bg-brand-100 text-brand-700 border border-brand-300'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                      }`}
                    >
                      ⚏ Teclado
                    </button>
                    <button
                      onClick={() => sip.hangup()}
                      className="col-span-2 rounded-xl bg-rose-500 hover:bg-rose-600 text-white py-2.5 text-sm font-semibold flex items-center justify-center gap-2 shadow-sm transition"
                    >
                      <PhoneOff className="w-4 h-4" /> Colgar
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => setNum(v => v.slice(0, -1))}
                      className="rounded-xl bg-slate-100 hover:bg-slate-200 py-2.5 text-slate-700 text-sm flex items-center justify-center gap-1.5 transition"
                    >
                      <Delete className="w-4 h-4" /> Borrar
                    </button>
                    <button
                      disabled={num.length === 0 || calling}
                      onClick={() => call()}
                      className="col-span-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed text-white py-2.5 text-sm font-semibold flex items-center justify-center gap-2 shadow-sm transition"
                    >
                      <Phone className="w-4 h-4" /> {calling ? 'Llamando…' : 'Llamar'}
                    </button>
                  </>
                )}
              </div>

              {/* DTMF keypad mini cuando está en llamada (para tonos de menú IVR) */}
              {sip.active && showKeypad && (
                <div className="mt-3 grid grid-cols-3 gap-1">
                  {KEYS.flat().map(k => (
                    <button
                      key={k}
                      onClick={() => sip.sendDtmf(k)}
                      className="h-9 rounded-md bg-slate-50 hover:bg-brand-50 border border-slate-200 text-sm font-mono transition active:scale-95"
                    >
                      {k}
                    </button>
                  ))}
                </div>
              )}

              {/* Controles (incl. transferir) */}
              <div className="mt-3 pt-3 border-t border-slate-100">
                <div className="grid grid-cols-5 gap-1.5">
                  <CtrlButton
                    icon={sip.active?.muted ? MicOff : Mic}
                    label="Mute"
                    active={sip.active?.muted ?? false}
                    disabled={!sip.active}
                    onClick={() => sip.toggleMute()}
                  />
                  <CtrlButton
                    icon={sip.active?.onHold ? Play : Pause}
                    label={sip.active?.onHold ? 'Reanudar' : 'En espera'}
                    active={sip.active?.onHold ?? false}
                    disabled={!sip.active}
                    onClick={() => sip.toggleHold()}
                  />
                  <CtrlButton
                    icon={PhoneForwarded}
                    label="Transferir"
                    active={false}
                    disabled={!sip.active || !activeCallId}
                    onClick={() => setShowTransfer(true)}
                  />
                  <CtrlButton
                    icon={speakerOn ? Volume2 : VolumeX}
                    label={speakerOn ? 'Altavoz' : 'Silenciado'}
                    active={!speakerOn}
                    onClick={() => setSpeakerOnState(v => !v)}
                  />
                  <div className="flex flex-col items-center justify-center gap-1 px-2 py-1.5 rounded-xl bg-slate-50 border border-slate-200">
                    <Volume2 className="w-4 h-4 text-slate-600" />
                    <input
                      type="range" min={0} max={100} value={volume}
                      onChange={e => setVolumeState(parseInt(e.target.value, 10))}
                      className="w-full h-1 accent-brand-600"
                      title={`Volumen ${volume}%`}
                    />
                    <span className="text-[10px] text-slate-500">{volume}%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ============ PANEL DE GUIÓN ============ */}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden flex flex-col">
            <div className="border-b border-slate-100 px-5 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2 text-slate-700">
                <FileText className="w-4 h-4 text-brand-600" />
                <span className="text-sm font-semibold">Guion de llamada</span>
              </div>
              {/* Selector saliente / entrante */}
              <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-xs">
                <button
                  onClick={() => setScriptTab('outbound')}
                  className={`px-3 py-1 rounded-md font-medium transition ${
                    scriptTab === 'outbound' ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-600'
                  }`}
                >
                  <PhoneOutgoing className="w-3.5 h-3.5 inline mr-1" /> Salientes
                </button>
                <button
                  onClick={() => setScriptTab('inbound')}
                  className={`px-3 py-1 rounded-md font-medium transition ${
                    scriptTab === 'inbound' ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-600'
                  }`}
                >
                  <PhoneIncoming className="w-3.5 h-3.5 inline mr-1" /> Entrantes
                </button>
              </div>
            </div>

            {/* Tabs por guion (cuando hay varios del mismo tipo) */}
            {visibleScripts.length > 1 && (
              <div className="border-b border-slate-100 px-2 py-1 flex gap-1 overflow-x-auto">
                {visibleScripts.map(s => (
                  <button
                    key={s.id}
                    onClick={() => setActiveScriptId(s.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition ${
                      activeScriptId === s.id
                        ? 'bg-brand-50 text-brand-700 border border-brand-200'
                        : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            )}

            <div className="flex-1 overflow-y-auto p-5 min-h-[400px] max-h-[600px]">
              {activeScript ? (
                <ScriptContent content={activeScript.content} />
              ) : (
                <div className="text-sm text-slate-500 italic flex flex-col items-center justify-center h-full text-center gap-2">
                  <FileText className="w-8 h-8 text-slate-300" />
                  <p>No hay guiones {scriptTab === 'outbound' ? 'salientes' : 'entrantes'} configurados.</p>
                  <p className="text-xs text-slate-400">
                    Un administrador puede crearlos desde la API <code className="bg-slate-100 px-1.5 py-0.5 rounded">POST /api/call-scripts</code>.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ============ NOTAS Y TIPIFICACIÓN (siempre visible, deshabilitado si no hay llamada) ============ */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-slate-100 px-5 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-slate-700">
              <StickyNote className="w-4 h-4 text-brand-600" />
              <span className="text-sm font-semibold">Notas y tipificación</span>
              {!sip.active && !activeCallId && (
                <span className="text-xs text-slate-400 ml-2">(disponible cuando esté en llamada)</span>
              )}
            </div>
            {activeCallId && (
              <button
                onClick={() => saveNotes()}
                disabled={savingNotes}
                className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-lg bg-brand-600 hover:bg-brand-700 text-white disabled:opacity-50 transition"
              >
                <Save className="w-3.5 h-3.5" />
                {savingNotes ? 'Guardando…' : notesSaved ? '✓ Guardado' : 'Guardar'}
              </button>
            )}
          </div>
          <div className="p-5 space-y-3">
            <textarea
              value={callNotes}
              onChange={e => setCallNotes(e.target.value)}
              placeholder="Escribe notas durante o después de la llamada…"
              disabled={!activeCallId}
              className="w-full min-h-[100px] rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200 disabled:bg-slate-50 disabled:text-slate-400 transition"
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">Tipificación</label>
                <select
                  value={dispositionParentId ?? ''}
                  onChange={e => {
                    const v = e.target.value ? Number(e.target.value) : null;
                    setDispositionParentId(v);
                    setDispositionChildId(null); // resetea sub-tipificación al cambiar la principal
                  }}
                  disabled={!activeCallId}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200 disabled:bg-slate-50 disabled:text-slate-400"
                >
                  <option value="">— Seleccionar —</option>
                  {dispositions.filter(d => d.parent_id == null).map(d => (
                    <option key={d.id} value={d.id}>{d.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">Resultado / sub-tipificación</label>
                <select
                  disabled={!activeCallId || !dispositionParentId}
                  value={dispositionChildId ?? ''}
                  onChange={e => setDispositionChildId(e.target.value ? Number(e.target.value) : null)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200 disabled:bg-slate-50 disabled:text-slate-400"
                >
                  <option value="">
                    {dispositions.some(d => d.parent_id === dispositionParentId)
                      ? '— Seleccionar sub-tipificación —'
                      : '— Sin sub-tipificación —'}
                  </option>
                  {dispositions.filter(d => d.parent_id === dispositionParentId).map(d => (
                    <option key={d.id} value={d.id}>{d.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* ============ HISTORIAL EN 3 COLUMNAS ============ */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-slate-100 px-5 py-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-slate-700">
              <History className="w-4 h-4 text-brand-600" />
              <span className="text-sm font-semibold">Historial reciente</span>
              <span className="text-xs text-slate-400">(últimos 2 días · {recent.length} llamadas)</span>
            </div>
            <div className="flex items-center gap-2 flex-1 max-w-md ml-auto">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Buscar por número…"
                  className="w-full pl-8 pr-3 py-1.5 text-sm rounded-lg border border-slate-200 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-200">
            <HistoryColumn
              title="Entrantes"
              icon={PhoneIncoming}
              accentColor="emerald"
              calls={recent.filter(c => c.direction === 'inbound' && !['missed','failed','no_answer','rejected','abandoned'].includes(c.status))}
              onCall={(target) => !sip.active && void call(target)}
              callDisabled={!!sip.active}
              emptyMsg={search ? 'Sin resultados.' : 'Sin llamadas entrantes recientes.'}
            />
            <HistoryColumn
              title="Salientes"
              icon={PhoneOutgoing}
              accentColor="blue"
              calls={recent.filter(c => c.direction === 'outbound')}
              onCall={(target) => !sip.active && void call(target)}
              callDisabled={!!sip.active}
              emptyMsg={search ? 'Sin resultados.' : 'Sin llamadas salientes recientes.'}
            />
            <HistoryColumn
              title="Perdidas / Abandonadas"
              icon={PhoneMissed}
              accentColor="rose"
              calls={recent.filter(c => c.direction === 'inbound' && ['missed','failed','no_answer','rejected','abandoned'].includes(c.status))}
              onCall={(target) => !sip.active && void call(target)}
              callDisabled={!!sip.active}
              emptyMsg={search ? 'Sin resultados.' : 'Sin llamadas perdidas. ¡Bien hecho!'}
            />
          </div>
        </div>
      </div>

      {/* MODAL DE TRANSFERENCIA */}
      {showTransfer && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                <PhoneForwarded className="w-4 h-4 text-brand-600" /> Transferir llamada
              </h3>
              <button onClick={() => setShowTransfer(false)} className="p-1 hover:bg-slate-100 rounded">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-500 mb-3">
              Escribe la extensión interna (3 dígitos) o un número externo. La llamada se transfiere
              ciegamente: tú sales y el otro lado queda hablando con el destino.
            </p>
            <input
              value={transferDest}
              onChange={e => setTransferDest(e.target.value.replace(/[^\d*#+]/g, ''))}
              onKeyDown={e => { if (e.key === 'Enter') void doTransfer(); }}
              placeholder="002 o 3001234567"
              autoFocus
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-lg font-mono text-center outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
            />
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setShowTransfer(false)}
                className="flex-1 rounded-lg bg-slate-100 hover:bg-slate-200 py-2 text-sm text-slate-700"
              >
                Cancelar
              </button>
              <button
                onClick={doTransfer}
                disabled={!transferDest.trim() || transferring}
                className="flex-1 rounded-lg bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white py-2 text-sm font-medium"
              >
                {transferring ? 'Transfiriendo…' : 'Transferir'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}

// ===================================================================
// Sub-componentes
// ===================================================================

/**
 * Banner de llamada entrante estilo "iPhone llamando":
 * - Gradiente azul→púrpura con animación pulsante.
 * - Avatar grande con halo de 2 anillos (animate-ping con delays distintos).
 * - Datos del cliente: nombre, número, badge VIP, notas importantes.
 * - Timer de cuánto lleva sonando.
 * - Timbre con Web Audio API (sin archivo mp3 que dé 404).
 * - Botones grandes Aceptar (verde) / Rechazar (rojo, oculto si admin lo deshabilita).
 */
function IncomingCallBanner({ fromNumber, displayName, customer, allowReject, onAnswer, onReject }: {
  fromNumber: string;
  displayName: string | null;
  customer: CustomerInfo | null;
  allowReject: boolean;
  onAnswer: () => void;
  onReject: () => void;
}) {
  const [ringingFor, setRingingFor] = useState(0);
  const [ringMuted, setRingMuted] = useState(false);
  // Lock para evitar dobles clicks (el handler async tarda y el usuario
  // pulsa varias veces creyendo que no respondio).
  const [answering, setAnswering] = useState(false);
  const [rejecting, setRejecting] = useState(false);

  const handleAnswer = () => {
    if (answering) return;
    setAnswering(true);
    onAnswer();
    // No reseteamos answering — cuando el banner desaparece (state incoming
    // pasa a null), el componente se desmonta entero.
  };
  const handleReject = () => {
    if (rejecting) return;
    setRejecting(true);
    onReject();
  };

  // Timer
  useEffect(() => {
    const t = setInterval(() => setRingingFor(s => s + 1), 1000);
    return () => clearInterval(t);
  }, []);

  // Timbre con Web Audio API (sin archivo)
  useEffect(() => {
    if (ringMuted) return;
    const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    let stopped = false;
    function beep() {
      if (stopped) return;
      try {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.frequency.setValueAtTime(440, ctx.currentTime);
        osc.frequency.setValueAtTime(480, ctx.currentTime + 0.4);
        gain.gain.setValueAtTime(0.001, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.4);
        osc.start();
        osc.stop(ctx.currentTime + 1.5);
      } catch { /* ignore */ }
      setTimeout(beep, 2500);
    }
    beep();
    return () => { stopped = true; ctx.close().catch(() => undefined); };
  }, [ringMuted]);

  const name = customer?.name ?? displayName ?? fromNumber;
  const isVip = customer?.is_vip;

  return (
    <div className="relative overflow-hidden">
      {/* Gradiente animado de fondo */}
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-600 via-blue-600 to-cyan-600 animate-gradient-x" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.15),transparent_70%)]" />

      <div className="relative px-6 py-5 text-white">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[11px] font-bold uppercase tracking-widest text-white/90">Llamada entrante</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono tabular-nums text-white/80">{formatDuration(ringingFor)}</span>
            <button
              onClick={() => setRingMuted(v => !v)}
              className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 transition"
              title={ringMuted ? 'Activar timbre' : 'Silenciar timbre'}
            >
              {ringMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Avatar con halos pulsantes */}
        <div className="flex items-center gap-4">
          <div className="relative shrink-0">
            <div className="absolute inset-0 rounded-full bg-white/40 animate-ping" />
            <div className="absolute inset-0 rounded-full bg-white/20 animate-ping" style={{ animationDelay: '0.5s' }} />
            <div className="relative w-16 h-16 rounded-full bg-white/25 backdrop-blur ring-2 ring-white/60 flex items-center justify-center">
              <User className="w-8 h-8 text-white" />
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-xl truncate">{name}</div>
            <div className="text-sm text-white/80 font-mono truncate">{fromNumber}</div>
            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
              {isVip && (
                <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wide bg-amber-400 text-amber-900 px-1.5 py-0.5 rounded font-bold">
                  ⭐ VIP
                </span>
              )}
              {customer && (
                <span className="text-[10px] uppercase tracking-wide bg-white/15 text-white px-1.5 py-0.5 rounded font-medium">
                  Cliente registrado
                </span>
              )}
              {!customer && (
                <span className="text-[10px] uppercase tracking-wide bg-white/15 text-white px-1.5 py-0.5 rounded font-medium">
                  Número desconocido
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Notas importantes del cliente */}
        {customer?.important_notes && (
          <div className="mt-3 rounded-lg bg-amber-300/30 backdrop-blur border border-amber-200/40 px-3 py-2 text-xs">
            <strong>📌 Nota:</strong> {customer.important_notes}
          </div>
        )}

        {/* Botones — el children con pointer-events-none evita que el icono
            capture el click y pierda el evento. */}
        <div className="mt-5 flex gap-3">
          <button
            onClick={handleAnswer}
            disabled={answering}
            className="flex-1 rounded-2xl bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white py-3.5 text-sm font-bold flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/30 transition disabled:opacity-70 disabled:cursor-wait"
          >
            <Phone className="w-5 h-5 pointer-events-none" />
            <span className="pointer-events-none">{answering ? 'Conectando…' : 'Contestar'}</span>
          </button>
          {allowReject && (
            <button
              onClick={handleReject}
              disabled={rejecting}
              className="flex-1 rounded-2xl bg-rose-500 hover:bg-rose-600 active:scale-95 text-white py-3.5 text-sm font-bold flex items-center justify-center gap-2 shadow-lg shadow-rose-900/30 transition disabled:opacity-70 disabled:cursor-wait"
            >
              <PhoneOff className="w-5 h-5 pointer-events-none" />
              <span className="pointer-events-none">{rejecting ? 'Rechazando…' : 'Rechazar'}</span>
            </button>
          )}
        </div>
      </div>

      <style jsx>{`
        @keyframes gradient-x {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        :global(.animate-gradient-x) {
          background-size: 200% 200%;
          animation: gradient-x 3s ease infinite;
        }
      `}</style>
    </div>
  );
}

/** Columna del historial: agrupa llamadas por día con scroll interno. */
function HistoryColumn({ title, icon: Icon, accentColor, calls, onCall, callDisabled, emptyMsg }: {
  title: string;
  icon: any;
  accentColor: 'emerald' | 'blue' | 'rose';
  calls: RecentCall[];
  onCall: (target: string) => void;
  callDisabled: boolean;
  emptyMsg: string;
}) {
  const colorMap = {
    emerald: { text: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200', icon: 'text-emerald-500' },
    blue:    { text: 'text-blue-700',    bg: 'bg-blue-50',    border: 'border-blue-200',    icon: 'text-blue-500' },
    rose:    { text: 'text-rose-700',    bg: 'bg-rose-50',    border: 'border-rose-200',    icon: 'text-rose-500' },
  }[accentColor];

  const grouped = useMemo(() => {
    const groups: Record<string, RecentCall[]> = {};
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
    for (const c of calls) {
      const d = new Date(c.started_at); d.setHours(0, 0, 0, 0);
      let label: string;
      if (d.getTime() === today.getTime()) label = 'Hoy';
      else if (d.getTime() === yesterday.getTime()) label = 'Ayer';
      else label = d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' });
      if (!groups[label]) groups[label] = [];
      groups[label].push(c);
    }
    return groups;
  }, [calls]);

  return (
    <div className="flex flex-col">
      {/* Header de la columna */}
      <div className={`px-4 py-2.5 flex items-center gap-2 border-b ${colorMap.border} ${colorMap.bg}`}>
        <Icon className={`w-4 h-4 ${colorMap.icon}`} />
        <span className={`text-sm font-semibold ${colorMap.text}`}>{title}</span>
        <span className={`ml-auto text-xs font-bold px-2 py-0.5 rounded-full bg-white ${colorMap.text}`}>
          {calls.length}
        </span>
      </div>

      {/* Lista con scroll */}
      <div className="flex-1 overflow-y-auto max-h-[420px]">
        {calls.length === 0 ? (
          <div className="px-4 py-8 text-center text-xs text-slate-400 italic">{emptyMsg}</div>
        ) : (
          Object.entries(grouped).map(([day, list]) => (
            <div key={day}>
              <div className="px-3 py-1 text-[10px] font-bold text-slate-500 uppercase tracking-wide bg-slate-50 sticky top-0 z-10">
                {day}
              </div>
              <ul className="divide-y divide-slate-100">
                {list.map(c => {
                  const target = c.direction === 'outbound' ? c.to_number : (c.from_number ?? c.to_number);
                  return (
                    <li key={c.id} className="px-3 py-2 hover:bg-slate-50 transition group">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="font-mono text-sm text-slate-800 truncate">{target}</div>
                          <div className="text-[11px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                            <span>{new Date(c.started_at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}</span>
                            {c.duration_seconds != null && c.duration_seconds > 0 && (
                              <>
                                <span className="text-slate-300">·</span>
                                <span className="font-mono">{formatDuration(c.duration_seconds)}</span>
                              </>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => target && onCall(target)}
                          disabled={callDisabled}
                          className={`opacity-0 group-hover:opacity-100 transition shrink-0 inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg border ${colorMap.border} ${colorMap.bg} ${colorMap.text} hover:brightness-95 disabled:opacity-30 disabled:cursor-not-allowed`}
                          title="Volver a marcar"
                        >
                          <Phone className="w-3 h-3" />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function StatusPill({ state, active }: { state: string; active: boolean }) {
  const map: Record<string, { text: string; cls: string; dot: string }> = {
    registered: { text: active ? 'En llamada' : 'Listo', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
    connecting: { text: 'Conectando…', cls: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500' },
    failed: { text: 'Error SIP', cls: 'bg-rose-50 text-rose-700 border-rose-200', dot: 'bg-rose-500' },
    unregistered: { text: 'Desconectado', cls: 'bg-slate-50 text-slate-600 border-slate-200', dot: 'bg-slate-400' },
    idle: { text: 'Inactivo', cls: 'bg-slate-50 text-slate-600 border-slate-200', dot: 'bg-slate-400' },
  };
  const s = map[state] ?? map.idle;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-xs font-medium ${s.cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot} ${active ? 'animate-pulse' : ''}`} />
      {s.text}
    </span>
  );
}

function CtrlButton({ icon: Icon, label, active, disabled, onClick }: {
  icon: any; label: string; active: boolean; disabled?: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex flex-col items-center gap-1 px-2 py-1.5 rounded-xl border transition ${
        active
          ? 'bg-brand-50 border-brand-300 text-brand-700'
          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
      } ${disabled ? 'opacity-40 cursor-not-allowed hover:bg-slate-50' : ''}`}
    >
      <Icon className="w-4 h-4" />
      <span className="text-[10px] leading-none">{label}</span>
    </button>
  );
}

function DirectionIcon({ direction, status }: { direction: string; status: string }) {
  const isMissed = ['missed', 'failed', 'no_answer', 'rejected'].includes(status);
  if (isMissed && direction === 'inbound') return <PhoneMissed className="w-4 h-4 text-rose-500 shrink-0" />;
  if (direction === 'outbound') {
    return <PhoneOutgoing className={`w-4 h-4 shrink-0 ${isMissed ? 'text-rose-500' : 'text-blue-500'}`} />;
  }
  return <PhoneIncoming className="w-4 h-4 text-emerald-500 shrink-0" />;
}

function CallTypeBadge({ direction, status }: { direction: string; status: string }) {
  const isMissed = ['missed', 'failed', 'no_answer', 'rejected'].includes(status);
  if (isMissed && direction === 'inbound') return <span className="text-rose-600 font-medium">Perdida</span>;
  if (isMissed) return <span className="text-rose-600 font-medium">Sin contestar</span>;
  if (direction === 'outbound') return <span className="text-blue-600 font-medium">Saliente</span>;
  return <span className="text-emerald-600 font-medium">Entrante</span>;
}

function ScriptContent({ content }: { content: string }) {
  if (/<(p|h[1-6]|div|ul|ol|li|strong|em|br|hr)[\s>]/i.test(content)) {
    return <div className="prose prose-sm prose-slate max-w-none" dangerouslySetInnerHTML={{ __html: content }} />;
  }
  const html = content
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/^### (.*)$/gm, '<h3 class="text-sm font-semibold text-slate-800 mt-3 mb-1">$1</h3>')
    .replace(/^## (.*)$/gm, '<h2 class="text-base font-bold text-slate-900 mt-4 mb-2">$1</h2>')
    .replace(/^# (.*)$/gm, '<h1 class="text-lg font-bold text-slate-900 mt-4 mb-2">$1</h1>')
    .replace(/^---$/gm, '<hr class="my-3 border-slate-200" />')
    .replace(/^- \[ \] (.*)$/gm, '<div class="flex gap-2 my-1"><input type="checkbox" class="mt-1" /><span>$1</span></div>')
    .replace(/^- (.*)$/gm, '<li class="ml-4 list-disc">$1</li>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code class="bg-slate-100 px-1 rounded text-xs">$1</code>')
    .replace(/\n\n/g, '</p><p class="my-2">')
    .replace(/\n/g, '<br />');
  return <div className="text-sm text-slate-700 leading-relaxed" dangerouslySetInnerHTML={{ __html: `<p>${html}</p>` }} />;
}

// ===================================================================
// Helpers
// ===================================================================

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Saca iniciales de un nombre o número (ej "Javier Torres" → "JT", "+57300..." → "30"). */
function getInitials(s: string | null | undefined): string {
  if (!s) return '?';
  const t = s.trim();
  // Si parece un número (tiene muchos dígitos), tomamos los 2 últimos
  if (/^\+?\d[\d\s-]+$/.test(t)) {
    const digits = t.replace(/\D/g, '');
    return digits.slice(-2);
  }
  // Sino, primera letra de las primeras 2 palabras
  const words = t.split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

function groupByDay(items: RecentCall[]): Record<string, RecentCall[]> {
  const groups: Record<string, RecentCall[]> = {};
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  for (const c of items) {
    const d = new Date(c.started_at); d.setHours(0, 0, 0, 0);
    let label: string;
    if (d.getTime() === today.getTime()) label = 'Hoy';
    else if (d.getTime() === yesterday.getTime()) label = 'Ayer';
    else label = d.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'short' });
    if (!groups[label]) groups[label] = [];
    groups[label].push(c);
  }
  return groups;
}
