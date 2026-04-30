'use client';

import { useState } from 'react';
import { maintenanceApi, type RestartRow } from '@/lib/api/maintenance';
import { Power, RefreshCw, Loader2, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { ConfirmDialog } from './ConfirmDialog';

const TARGETS: { value: RestartRow['target']; label: string; risk: string }[] = [
  { value: 'backend',  label: 'Servidor del sistema (backend)', risk: 'Las peticiones se cortan unos segundos.' },
  { value: 'frontend', label: 'Interfaz web (frontend)',        risk: 'Los usuarios verán "cargando" unos segundos.' },
  { value: 'asterisk', label: 'Servidor de llamadas (Asterisk)',risk: 'Las llamadas en curso se cortarán.' },
  { value: 'redis',    label: 'Caché y colas (Redis)',          risk: 'Algunas funciones pueden ir más lentas un momento.' },
  { value: 'all',      label: 'TODO el sistema',                risk: 'Solo super_admin. El servicio cae 1-2 min.' },
];

const STATUS_ICON: Record<string, any> = {
  pending: Clock, running: Loader2, success: CheckCircle2, failed: XCircle,
};

const STATUS_TONE: Record<string, string> = {
  pending: 'text-slate-500', running: 'text-sky-600',
  success: 'text-emerald-600', failed: 'text-rose-600',
};

export function RestartPanel({
  restarts, onRefresh, onToast,
}: {
  restarts: RestartRow[];
  onRefresh: () => void;
  onToast: (msg: string, tone?: 'ok' | 'warn' | 'err') => void;
}) {
  const [target, setTarget] = useState<RestartRow['target']>('backend');
  const [reason, setReason] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function doRestart() {
    setBusy(true);
    try {
      const r = await maintenanceApi.restart(target, reason || undefined);
      onToast(r.message ?? 'Reinicio en curso', 'ok');
      setConfirmOpen(false);
      setReason('');
      // refrescar tras unos segundos
      setTimeout(onRefresh, 3000);
    } catch (e: any) {
      onToast(`Error: ${e?.response?.data?.message ?? e.message}`, 'err');
    } finally { setBusy(false); }
  }

  const sel = TARGETS.find(t => t.value === target)!;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex items-start gap-3">
          <Power className="w-5 h-5 text-amber-600 mt-0.5" />
          <div className="flex-1">
            <div className="font-semibold text-slate-900">Reinicio del servidor</div>
            <p className="text-sm text-slate-600 mt-1">
              Reinicie un servicio para resolver problemas. Cada reinicio queda registrado con fecha,
              usuario y motivo. Si está dudando, primero <b>cree un respaldo</b>.
            </p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="block text-sm">
            <span className="text-slate-700">¿Qué desea reiniciar?</span>
            <select
              value={target} onChange={e => setTarget(e.target.value as any)}
              className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-md"
            >
              {TARGETS.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
            <span className="text-xs text-amber-700 mt-1 block">⚠ {sel.risk}</span>
          </label>
          <label className="block text-sm">
            <span className="text-slate-700">Motivo (opcional)</span>
            <input
              value={reason} onChange={e => setReason(e.target.value)}
              placeholder="Ej: actualizar configuración / aplicar parche"
              className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-md"
            />
          </label>
        </div>
        <div className="mt-4 flex justify-end">
          <button
            onClick={() => setConfirmOpen(true)} disabled={busy}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-amber-600 text-white text-sm hover:bg-amber-700 disabled:opacity-50"
          >
            <Power className="w-4 h-4" /> Reiniciar
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
          <div className="font-semibold text-slate-900">Historial de reinicios</div>
          <button onClick={onRefresh} className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900">
            <RefreshCw className="w-4 h-4" /> Refrescar
          </button>
        </div>
        {restarts.length === 0 ? (
          <div className="p-6 text-sm text-slate-500 text-center">No hay reinicios registrados.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-3 py-2 text-left">Fecha</th>
                <th className="px-3 py-2 text-left">Servicio</th>
                <th className="px-3 py-2 text-left">Motivo</th>
                <th className="px-3 py-2 text-left">Estado</th>
                <th className="px-3 py-2 text-left">Resultado</th>
              </tr>
            </thead>
            <tbody>
              {restarts.map(r => {
                const Icon = STATUS_ICON[r.status];
                return (
                  <tr key={r.id} className="border-t border-slate-100">
                    <td className="px-3 py-2 whitespace-nowrap">
                      {new Date(r.requested_at).toLocaleString()}
                    </td>
                    <td className="px-3 py-2 font-medium">{r.target}</td>
                    <td className="px-3 py-2 text-slate-600">{r.reason ?? '—'}</td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex items-center gap-1 ${STATUS_TONE[r.status]}`}>
                        <Icon className={`w-4 h-4 ${r.status === 'running' ? 'animate-spin' : ''}`} />
                        {r.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-600">
                      {r.error_message ?? (r.completed_at ? `Completado ${new Date(r.completed_at).toLocaleTimeString()}` : '—')}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title={`Reiniciar: ${sel.label}`}
        message={
          <>
            Está a punto de reiniciar <b>{sel.label}</b>.<br />
            <span className="text-amber-700">{sel.risk}</span><br />
            ¿Desea continuar?
          </>
        }
        confirmText="Sí, reiniciar"
        confirmTone="amber"
        onCancel={() => setConfirmOpen(false)}
        onConfirm={doRestart}
        busy={busy}
      />
    </div>
  );
}
