'use client';

import { use, useEffect, useState } from 'react';
import { AppShell } from '@/components/shared/AppShell';
import { api, unwrap } from '@/lib/api/client';
import { ArrowLeft, Phone, User, Clock, Calendar, FileAudio, AlertCircle } from 'lucide-react';
import Link from 'next/link';

interface CallDetail {
  id: number;
  direction: string;
  status: string;
  from_number: string | null;
  to_number: string | null;
  did_number: string | null;
  agent_id: number | null;
  agent_name?: string | null;
  queue_id: number | null;
  queue_name?: string | null;
  customer_id: number | null;
  customer_name?: string | null;
  duration_seconds: number | null;
  wait_seconds: number | null;
  started_at: string;
  answered_at: string | null;
  ended_at: string | null;
  is_recorded: boolean;
  recording_id: number | null;
  hangup_cause: string | null;
  events?: Array<{ event_type: string; ts: string; payload?: any }>;
}

function fmtSecs(s: number | null): string {
  if (s == null) return '—';
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${String(r).padStart(2, '0')}`;
}

export default function CallDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = use(props.params);
  const id = parseInt(params.id, 10);
  const [call, setCall] = useState<CallDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get(`/calls/${id}`)
      .then(res => {
        const c = unwrap<any>(res);
        setCall({
          id: c.id,
          direction: c.direction,
          status: c.status,
          from_number: c.fromNumber ?? c.from_number,
          to_number: c.toNumber ?? c.to_number,
          did_number: c.didNumber ?? c.did_number,
          agent_id: c.agentId ?? c.agent_id,
          agent_name: c.agentName ?? c.agent_name,
          queue_id: c.queueId ?? c.queue_id,
          queue_name: c.queueName ?? c.queue_name,
          customer_id: c.customerId ?? c.customer_id,
          customer_name: c.customerName ?? c.customer_name,
          duration_seconds: c.durationSeconds ?? c.duration_seconds,
          wait_seconds: c.waitSeconds ?? c.wait_seconds,
          started_at: c.startedAt ?? c.started_at,
          answered_at: c.answeredAt ?? c.answered_at,
          ended_at: c.endedAt ?? c.ended_at,
          is_recorded: c.isRecorded ?? c.is_recorded ?? false,
          recording_id: c.recordingId ?? c.recording_id,
          hangup_cause: c.hangupCause ?? c.hangup_cause,
          events: c.events ?? [],
        });
      })
      .catch(e => setError(e?.response?.data?.error?.message ?? 'Error al cargar'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <AppShell><div className="text-slate-500">Cargando…</div></AppShell>;
  if (error || !call) return <AppShell><div className="text-rose-600">{error ?? 'Llamada no encontrada'}</div></AppShell>;

  return (
    <AppShell>
      <div className="space-y-6 max-w-4xl">
        <Link href="/supervisor/calls" className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900">
          <ArrowLeft className="w-4 h-4" /> Volver a llamadas
        </Link>

        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-slate-900">Llamada #{call.id}</h2>
            <div className="flex items-center gap-2 mt-2">
              <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                call.direction === 'inbound' ? 'bg-emerald-100 text-emerald-700' :
                call.direction === 'outbound' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-700'
              }`}>{call.direction}</span>
              <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                call.status === 'completed' || call.status === 'answered' ? 'bg-emerald-100 text-emerald-700' :
                call.status === 'abandoned' ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-700'
              }`}>{call.status}</span>
              {call.is_recorded && (
                <Link href={`/admin/recordings/${call.recording_id ?? call.id}`} className="inline-flex items-center gap-1 text-xs text-brand-600 hover:underline">
                  <FileAudio className="w-3 h-3" /> Ver grabación
                </Link>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
            <h3 className="font-semibold text-slate-900 flex items-center gap-2"><Phone className="w-5 h-5 text-brand-600" /> Información de la llamada</h3>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-slate-500">Desde</dt><dd className="font-mono text-xs">{call.from_number ?? '—'}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Hacia</dt><dd className="font-mono text-xs">{call.to_number ?? '—'}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">DID</dt><dd className="font-mono text-xs">{call.did_number ?? '—'}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Hangup cause</dt><dd className="text-slate-700">{call.hangup_cause ?? '—'}</dd></div>
            </dl>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
            <h3 className="font-semibold text-slate-900 flex items-center gap-2"><User className="w-5 h-5 text-brand-600" /> Personas</h3>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-500">Agente</dt>
                <dd>{call.agent_name ?? '—'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Cola</dt>
                <dd>{call.queue_name ?? '—'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Cliente</dt>
                <dd>
                  {call.customer_id ? (
                    <Link href={`/admin/customers/${call.customer_id}`} className="text-brand-600 hover:underline">
                      {call.customer_name ?? `#${call.customer_id}`}
                    </Link>
                  ) : '—'}
                </dd>
              </div>
            </dl>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="font-semibold text-slate-900 flex items-center gap-2 mb-3"><Clock className="w-5 h-5 text-brand-600" /> Tiempos</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <div>
              <div className="text-xs text-slate-500">Inicio</div>
              <div className="text-slate-900 mt-1">{new Date(call.started_at).toLocaleString()}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500">Espera</div>
              <div className="text-slate-900 mt-1 font-mono">{fmtSecs(call.wait_seconds)}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500">Atendida</div>
              <div className="text-slate-900 mt-1">{call.answered_at ? new Date(call.answered_at).toLocaleTimeString() : '—'}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500">Duración</div>
              <div className="text-slate-900 mt-1 font-mono">{fmtSecs(call.duration_seconds)}</div>
            </div>
          </div>
        </div>

        {call.events && call.events.length > 0 && (
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h3 className="font-semibold text-slate-900 flex items-center gap-2 mb-3"><Calendar className="w-5 h-5 text-brand-600" /> Eventos de la llamada</h3>
            <ul className="space-y-2">
              {call.events.map((ev, i) => (
                <li key={i} className="flex gap-3 text-sm">
                  <div className="w-2 h-2 rounded-full bg-brand-500 mt-1.5 shrink-0" />
                  <div className="flex-1">
                    <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded">{ev.event_type}</code>
                    <span className="text-xs text-slate-400 ml-2">{new Date(ev.ts).toLocaleTimeString()}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </AppShell>
  );
}
