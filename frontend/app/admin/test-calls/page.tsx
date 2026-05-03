'use client';

import { FormEvent, useEffect, useState } from 'react';
import { AppShell } from '@/components/shared/AppShell';
import { api, unwrap } from '@/lib/api/client';
import { CheckCircle2, AlertCircle, PhoneOutgoing, PhoneIncoming, Activity, Server, Headphones, ArrowRight, Phone, X, User } from 'lucide-react';
import Link from 'next/link';

interface Trunk {
  id: number;
  name: string;
  host: string;
  direction: string;
  status?: string;
  is_active?: boolean;
}

interface AgentEndpoint {
  id?: number;
  extension: string;
  display_name?: string;
  online?: boolean;
}

interface AsteriskStatus {
  ari_connected?: boolean;
  ami_connected?: boolean;
  endpoint_count?: number;
  online_count?: number;
}

export default function TestCallsPage() {
  const [trunks, setTrunks] = useState<Trunk[]>([]);
  const [agents, setAgents] = useState<AgentEndpoint[]>([]);
  const [asteriskStatus, setAsteriskStatus] = useState<AsteriskStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState<number | null>(null);
  const [testResult, setTestResult] = useState<Record<number, { ok: boolean; msg: string }>>({});

  // Selector de agente para las pruebas — el admin/super_admin elige a
  // que agente disparar la prueba (porque ellos no son agentes y no
  // pueden marcar desde su propio softphone).
  const [selectedAgentId, setSelectedAgentId] = useState<number | null>(null);
  const [testCallModal, setTestCallModal] = useState<'outbound' | 'inbound' | null>(null);
  const [destNumber, setDestNumber] = useState('');
  const [callResult, setCallResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [callRunning, setCallRunning] = useState(false);

  function reload() {
    setLoading(true);
    Promise.all([
      api.get('/sip-trunks').then(r => unwrap<Trunk[]>(r)).catch(() => []),
      api.get('/agents').then(r => unwrap<any[]>(r)).catch(() => []),
      api.get('/asterisk/status').then(r => unwrap<AsteriskStatus>(r)).catch(() => null),
    ]).then(([t, a, s]) => {
      setTrunks(t);
      // Online = current_status !== 'offline'. El backend no devuelve `online`
      // como campo, lo derivamos. Cuando el agente entra al dialer + SIP
      // se registra, su status cambia a 'available' (ver dialer/page.tsx
      // useEffect). Si lo cambian a pausa/almuerzo/etc tambien cuenta como
      // online. Solo 'offline' explicito = no conectado.
      const mapped = a.map((x: any) => {
        const status = x.currentStatus ?? x.current_status ?? 'offline';
        return {
          id: x.id,
          extension: x.extension,
          display_name: x.display_name ?? x.displayName,
          online: status !== 'offline',
        };
      });
      setAgents(mapped);
      if (mapped.length > 0 && selectedAgentId == null) {
        setSelectedAgentId(mapped[0].id ?? null);
      }
      setAsteriskStatus(s);
    }).finally(() => setLoading(false));
  }

  useEffect(() => { reload(); }, []);

  const selectedAgent = agents.find(a => a.id === selectedAgentId);

  async function runOutboundTest(e: FormEvent) {
    e.preventDefault();
    if (!destNumber.trim()) { setCallResult({ ok: false, msg: 'Ingresá un número' }); return; }
    if (!selectedAgent) { setCallResult({ ok: false, msg: 'Selecciona un agente' }); return; }
    setCallRunning(true); setCallResult(null);
    try {
      // Endpoint /dial requiere ser agente. Como admin no es agente, usamos
      // /dial/originate-as (si existe) o pedimos al admin que use el
      // softphone del agente seleccionado.
      const res = await api.post('/dial', { number: destNumber.trim(), agent_id: selectedAgent.id });
      const data = unwrap<any>(res);
      setCallResult({ ok: true, msg: `Llamada originada (call_id=${data?.callId ?? data?.call_id ?? '?'}). Asegurate de que el agente ${selectedAgent.extension} tenga el softphone abierto para contestar la pata WebRTC.` });
    } catch (err: any) {
      setCallResult({ ok: false, msg: err?.response?.data?.error?.message ?? 'Error' });
    } finally {
      setCallRunning(false);
    }
  }

  async function testTrunk(id: number) {
    setTesting(id);
    try {
      const res = await api.post(`/sip-trunks/${id}/test`);
      const data = unwrap<{ success: boolean; line?: string; error?: string; ms?: number }>(res);
      setTestResult(p => ({ ...p, [id]: { ok: data.success, msg: data.success ? `OK (${data.ms ?? '?'} ms): ${data.line ?? ''}` : (data.error ?? 'Falló') } }));
    } catch (e: any) {
      setTestResult(p => ({ ...p, [id]: { ok: false, msg: e?.response?.data?.error?.message ?? 'Error' } }));
    } finally {
      setTesting(null);
    }
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Pruebas de telefonía</h2>
          <p className="text-slate-500 mt-1">Verificá el estado del stack de telefonía: Asterisk, troncales SIP y agentes registrados.</p>
        </div>

        {/* Estado de Asterisk */}
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <Server className="w-5 h-5 text-brand-600" /> Estado de Asterisk
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatusCard label="ARI" ok={asteriskStatus?.ari_connected ?? false} />
            <StatusCard label="AMI" ok={asteriskStatus?.ami_connected ?? false} />
            <InfoCard label="Endpoints totales" value={String(asteriskStatus?.endpoint_count ?? '—')} />
            <InfoCard label="Endpoints online" value={String(asteriskStatus?.online_count ?? '—')} />
          </div>
        </div>

        {/* Troncales SIP */}
        <div className="rounded-xl border border-slate-200 bg-white">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-semibold text-slate-900 flex items-center gap-2">
              <Activity className="w-5 h-5 text-brand-600" /> Troncales SIP
            </h3>
            <Link href="/admin/sip-trunks" className="text-xs text-brand-600 hover:text-brand-700 inline-flex items-center gap-1">
              Gestionar troncales <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          {loading ? (
            <div className="p-6 text-center text-slate-500">Cargando…</div>
          ) : trunks.length === 0 ? (
            <div className="p-12 text-center text-slate-500">Sin troncales configuradas.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
                <tr>
                  <th className="text-left px-4 py-2">Nombre</th>
                  <th className="text-left px-4 py-2">Host</th>
                  <th className="text-left px-4 py-2">Dirección</th>
                  <th className="text-left px-4 py-2">Estado</th>
                  <th className="text-right px-4 py-2">Test</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {trunks.map(t => (
                  <tr key={t.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium">{t.name}</td>
                    <td className="px-4 py-3 font-mono text-xs">{t.host}</td>
                    <td className="px-4 py-3"><code className="text-xs bg-slate-100 px-1.5 rounded">{t.direction}</code></td>
                    <td className="px-4 py-3">
                      {testResult[t.id] ? (
                        <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${testResult[t.id].ok ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                          {testResult[t.id].ok ? <CheckCircle2 className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                          {testResult[t.id].msg}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">— Sin probar —</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => testTrunk(t.id)}
                        disabled={testing === t.id}
                        className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium disabled:opacity-50"
                      >
                        {testing === t.id ? 'Probando…' : 'Probar conexión'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Agentes registrados */}
        <div className="rounded-xl border border-slate-200 bg-white">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-semibold text-slate-900 flex items-center gap-2">
              <Headphones className="w-5 h-5 text-brand-600" /> Agentes ({agents.length})
            </h3>
            <Link href="/admin/agents" className="text-xs text-brand-600 hover:text-brand-700 inline-flex items-center gap-1">
              Gestionar agentes <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          {loading ? (
            <div className="p-6 text-center text-slate-500">Cargando…</div>
          ) : agents.length === 0 ? (
            <div className="p-12 text-center text-slate-500">Sin agentes configurados.</div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {agents.map(a => (
                <li key={a.extension} className="px-5 py-3 flex items-center justify-between">
                  <div>
                    <div className="font-medium text-slate-900">{a.display_name ?? `Ext ${a.extension}`}</div>
                    <div className="text-xs text-slate-500">Extensión <code>{a.extension}</code></div>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${a.online ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                    ● {a.online ? 'online' : 'offline'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Selector de agente para las pruebas */}
        <div className="rounded-xl border border-slate-300 bg-white p-4">
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            <User className="w-4 h-4 inline mr-1 text-brand-600" /> Agente para las pruebas
          </label>
          <select value={selectedAgentId ?? ''} onChange={e => setSelectedAgentId(e.target.value ? Number(e.target.value) : null)}
            className="w-full max-w-md px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white">
            <option value="">— Selecciona un agente —</option>
            {agents.map(a => (
              <option key={a.id} value={a.id}>
                {a.display_name ?? `Ext ${a.extension}`} (Ext {a.extension}) {a.online ? '🟢' : '⚫'}
              </option>
            ))}
          </select>
          <p className="text-xs text-slate-500 mt-1.5">
            Como admin no sos agente, las pruebas se ejecutan EN NOMBRE de un agente seleccionado. Asegurate de que esté online para que pueda contestar la pata WebRTC.
          </p>
        </div>

        {/* Pruebas funcionales */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5">
            <h3 className="font-semibold text-emerald-900 mb-2 flex items-center gap-2">
              <PhoneOutgoing className="w-5 h-5" /> Prueba saliente
            </h3>
            <p className="text-sm text-emerald-800 mb-3">
              Originar una llamada desde el agente seleccionado a un número externo. Verificás que la troncal saliente funciona.
            </p>
            <button onClick={() => { setTestCallModal('outbound'); setCallResult(null); setDestNumber(''); }}
              disabled={!selectedAgent}
              className="inline-flex items-center gap-2 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium">
              <Phone className="w-4 h-4" /> Iniciar prueba saliente
            </button>
          </div>

          <div className="rounded-xl border border-blue-200 bg-blue-50 p-5">
            <h3 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
              <PhoneIncoming className="w-5 h-5" /> Prueba entrante
            </h3>
            <ol className="list-decimal list-inside text-sm text-blue-800 space-y-1 mb-3">
              <li>Asegurate que el agente seleccionado tenga el softphone abierto</li>
              <li>Llamá desde un celular externo al DID configurado</li>
              <li>Verificá que el banner del agente muestre el número del que llama y suene</li>
              <li>El log abajo te dice si llegó el INVITE</li>
            </ol>
            <Link href="/agent/dialer" className="inline-flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium">
              Abrir Marcador del agente <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>

      {/* Modal prueba saliente */}
      {testCallModal === 'outbound' && selectedAgent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                <PhoneOutgoing className="w-5 h-5 text-emerald-600" /> Prueba saliente
              </h3>
              <button onClick={() => setTestCallModal(null)} className="text-slate-400"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={runOutboundTest} className="px-5 py-4 space-y-3">
              <p className="text-sm text-slate-700">
                Llamada saliente desde <strong>{selectedAgent.display_name ?? `Ext ${selectedAgent.extension}`}</strong> a:
              </p>
              <input type="text" value={destNumber} onChange={e => setDestNumber(e.target.value)}
                placeholder="Ej. 3001234567" required disabled={callRunning}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
              {callResult && (
                <div className={`text-xs px-3 py-2 rounded-lg ${callResult.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                  {callResult.ok ? <CheckCircle2 className="w-4 h-4 inline mr-1" /> : <AlertCircle className="w-4 h-4 inline mr-1" />}
                  {callResult.msg}
                </div>
              )}
              <div className="flex gap-2 justify-end pt-2">
                <button type="button" onClick={() => setTestCallModal(null)} className="px-4 py-2 text-sm">Cerrar</button>
                <button type="submit" disabled={callRunning}
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium disabled:opacity-50">
                  {callRunning ? 'Llamando…' : 'Llamar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}

function StatusCard({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className={`rounded-lg border p-3 ${ok ? 'border-emerald-200 bg-emerald-50' : 'border-rose-200 bg-rose-50'}`}>
      <div className="flex items-center gap-2">
        {ok ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertCircle className="w-4 h-4 text-rose-600" />}
        <span className={`text-xs uppercase font-medium ${ok ? 'text-emerald-700' : 'text-rose-700'}`}>{label}</span>
      </div>
      <div className={`text-sm font-bold mt-1 ${ok ? 'text-emerald-900' : 'text-rose-900'}`}>
        {ok ? 'Conectado' : 'Desconectado'}
      </div>
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="text-xs uppercase font-medium text-slate-500">{label}</div>
      <div className="text-lg font-bold text-slate-900 mt-1">{value}</div>
    </div>
  );
}
