'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/shared/AppShell';
import { api, unwrap } from '@/lib/api/client';
import { PhoneCall, RefreshCw, Activity, AlertCircle, CheckCircle2, FileText, HardDrive, Server } from 'lucide-react';
import { confirmAsync, toastShow } from '@/lib/ui/dialog-helper';

interface Status {
  ari_connected: boolean;
  ami_connected: boolean;
  endpoints_raw: string;
  endpoint_count: number;
  online_count: number;
  file_exists: boolean;
  file_path: string;
  file_size_bytes: number;
  file_modified: string | null;
}

export default function AsteriskAdminPage() {
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [reloading, setReloading] = useState(false);
  const [showRaw, setShowRaw] = useState(false);

  function reload() {
    setLoading(true);
    api.get('/asterisk/status')
      .then(r => { setStatus(unwrap<Status>(r)); setError(null); })
      .catch(e => setError(e?.response?.data?.error?.message ?? 'Error al cargar estado'))
      .finally(() => setLoading(false));
  }

  useEffect(() => { reload(); const t = setInterval(reload, 15_000); return () => clearInterval(t); }, []);

  async function syncAgents() {
    const ok = await confirmAsync({
      title: 'Sincronizar agentes con Asterisk',
      message: <>Vas a regenerar el archivo <code className="bg-slate-100 px-1 rounded">/etc/asterisk/agents.conf</code> con todos los agentes activos y recargar PJSIP. Los agentes en llamada actual NO se ven afectados.</>,
      variant: 'warning',
      confirmText: 'Sí, sincronizar',
    });
    if (!ok) return;
    setSyncing(true);
    try {
      const res = await api.post('/asterisk/sync-agents', {});
      const data = unwrap<{ written: number; reloaded: boolean; warnings: string[] }>(res);
      if (data.warnings?.length) {
        toastShow(<>{data.written} agentes escritos. ⚠️ Advertencias: {data.warnings.join(' · ')}</>, 'warning');
      } else {
        toastShow(`${data.written} agentes sincronizados${data.reloaded ? ' y PJSIP recargado' : ''}`, 'success');
      }
      reload();
    } catch (e: any) {
      toastShow(e?.response?.data?.error?.message ?? 'Error al sincronizar', 'danger');
    } finally {
      setSyncing(false);
    }
  }

  async function reloadPjsip() {
    setReloading(true);
    try {
      const res = await api.post('/asterisk/reload', {});
      const data = unwrap<{ reloaded: boolean }>(res);
      if (data.reloaded) toastShow('PJSIP recargado', 'success');
      else toastShow('PJSIP reload falló — AMI no conectado', 'danger');
      reload();
    } catch (e: any) {
      toastShow(e?.response?.data?.error?.message ?? 'Error', 'danger');
    } finally {
      setReloading(false);
    }
  }

  function formatSize(b: number) {
    if (b < 1024) return `${b} B`;
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
    return `${(b / 1024 / 1024).toFixed(2)} MB`;
  }

  return (
    <AppShell>
      <div className="space-y-6 max-w-5xl">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-slate-900 flex items-center gap-2">
              <Server className="w-7 h-7 text-brand-600" /> Asterisk (telefonía)
            </h2>
            <p className="text-slate-500 mt-1">Estado del motor de llamadas y sincronización de agentes WebRTC.</p>
          </div>
          <button onClick={reload} disabled={loading}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-sm">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refrescar
          </button>
        </div>

        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{error}</div>
        )}

        {/* CONEXIONES */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <ConnectionCard
            label="ARI (control llamadas)"
            connected={status?.ari_connected ?? false}
            help="WebSocket para enrutar/transferir llamadas"
          />
          <ConnectionCard
            label="AMI (gestión)"
            connected={status?.ami_connected ?? false}
            help="Manager interface para reload, status, etc."
          />
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="text-xs text-slate-500 uppercase">Endpoints PJSIP</div>
            <div className="mt-1 text-2xl font-bold text-slate-900">
              {status?.online_count ?? '—'}<span className="text-sm font-normal text-slate-500"> / {status?.endpoint_count ?? '—'}</span>
            </div>
            <div className="text-xs text-slate-500 mt-0.5">en línea / configurados</div>
          </div>
        </div>

        {/* ARCHIVO PJSIP */}
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                <FileText className="w-5 h-5 text-brand-600" /> Archivo de agentes PJSIP
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Cada vez que creas/editas un agente, debes "Sincronizar" para que Asterisk vea el cambio.
              </p>
              {status && (
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                  <div>
                    <div className="text-xs text-slate-500">Ruta</div>
                    <div className="text-slate-900"><code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs">{status.file_path}</code></div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">Estado</div>
                    <div className="text-slate-900">
                      {status.file_exists ? (
                        <span className="text-emerald-700 inline-flex items-center gap-1"><CheckCircle2 className="w-4 h-4" /> Existe ({formatSize(status.file_size_bytes)})</span>
                      ) : (
                        <span className="text-amber-700 inline-flex items-center gap-1"><AlertCircle className="w-4 h-4" /> No existe — sincroniza</span>
                      )}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">Última actualización</div>
                    <div className="text-slate-900 text-xs">
                      {status.file_modified ? new Date(status.file_modified).toLocaleString('es-CO') : '—'}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button onClick={syncAgents} disabled={syncing}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-sm font-medium shadow-sm">
              <HardDrive className="w-4 h-4" /> {syncing ? 'Sincronizando…' : 'Sincronizar agentes con Asterisk'}
            </button>
            <button onClick={reloadPjsip} disabled={reloading || !status?.ami_connected}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 text-sm font-medium border border-slate-200">
              <RefreshCw className={`w-4 h-4 ${reloading ? 'animate-spin' : ''}`} /> {reloading ? 'Recargando…' : 'Solo recargar PJSIP'}
            </button>
          </div>
        </div>

        {/* ENDPOINTS RAW */}
        <div className="rounded-xl border border-slate-200 bg-white">
          <button onClick={() => setShowRaw(s => !s)}
            className="w-full px-5 py-4 text-left flex items-center justify-between hover:bg-slate-50 rounded-xl">
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-brand-600" />
              <span className="font-semibold text-slate-900">Endpoints PJSIP (raw output)</span>
            </div>
            <span className="text-xs text-slate-500">{showRaw ? 'Ocultar' : 'Mostrar'}</span>
          </button>
          {showRaw && (
            <div className="px-5 pb-5">
              <pre className="text-xs bg-slate-900 text-emerald-300 p-3 rounded-lg overflow-auto max-h-96 whitespace-pre-wrap font-mono">
{status?.endpoints_raw ?? 'Sin datos'}
              </pre>
            </div>
          )}
        </div>

        {/* AYUDA */}
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900 space-y-2">
          <div className="flex gap-2">
            <PhoneCall className="w-5 h-5 shrink-0 mt-0.5" />
            <div>
              <strong>Cómo funciona:</strong> Cada agente tiene una extensión SIP y un secret encriptado en BD.
              Al "Sincronizar", el backend escribe esos datos a un archivo PJSIP y dice a Asterisk que recargue.
              Los agentes registran su softphone WebRTC contra <code className="bg-white px-1 rounded">wss://app.somoscallcenter.com:8089/ws</code>.
            </div>
          </div>
          <div className="flex gap-2">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <div>
              <strong>¿"AMI no conectado"?</strong> Verifica que Asterisk está corriendo (`docker compose ps`)
              y que el password AMI en .env coincide con `/etc/asterisk/manager.conf`.
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function ConnectionCard({ label, connected, help }: { label: string; connected: boolean; help: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-500 uppercase">{label}</span>
        {connected ? (
          <span className="inline-flex items-center gap-1 text-xs text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">● Conectado</span>
        ) : (
          <span className="inline-flex items-center gap-1 text-xs text-rose-700 bg-rose-100 px-2 py-0.5 rounded-full">● Desconectado</span>
        )}
      </div>
      <p className="text-xs text-slate-500 mt-1.5">{help}</p>
    </div>
  );
}
