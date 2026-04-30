'use client';

import { useState } from 'react';
import { maintenanceApi, type OutdatedReport, type OutdatedItem } from '@/lib/api/maintenance';
import { Loader2, RefreshCw, Search, ShieldCheck, AlertTriangle } from 'lucide-react';
import { ConfirmDialog } from './ConfirmDialog';

const TYPE_TONE: Record<string, string> = {
  patch: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  minor: 'bg-sky-100 text-sky-800 border-sky-200',
  major: 'bg-rose-100 text-rose-800 border-rose-200',
  none:  'bg-slate-100 text-slate-700 border-slate-200',
};

export function UpdatesPanel({
  updates, setUpdates, onToast,
}: {
  updates: OutdatedReport | null;
  setUpdates: (r: OutdatedReport | null) => void;
  onToast: (msg: string, tone?: 'ok' | 'warn' | 'err') => void;
}) {
  const [busy, setBusy] = useState<'check' | 'apply' | null>(null);
  const [confirmApply, setConfirmApply] = useState<'backend' | 'frontend' | 'all' | null>(null);

  async function check() {
    setBusy('check');
    try {
      const r = await maintenanceApi.checkUpdates();
      setUpdates(r);
      onToast(`Análisis completado: ${r.summary.total} paquetes con actualizaciones`, 'ok');
    } catch (e: any) {
      onToast(`Error: ${e?.response?.data?.message ?? e.message}`, 'err');
    } finally { setBusy(null); }
  }

  async function apply(project: 'backend' | 'frontend' | 'all') {
    setBusy('apply');
    try {
      const r = await maintenanceApi.applySafeUpdates(project);
      onToast(r.message, r.success ? 'ok' : 'warn');
      // refrescar el listado
      const fresh = await maintenanceApi.checkUpdates();
      setUpdates(fresh);
    } catch (e: any) {
      onToast(`Error al actualizar: ${e?.response?.data?.message ?? e.message}`, 'err');
    } finally { setBusy(null); setConfirmApply(null); }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-emerald-600 mt-0.5" />
          <div className="flex-1">
            <div className="font-semibold text-slate-900">Actualizaciones seguras</div>
            <p className="text-sm text-slate-600 mt-1">
              Solo se aplican actualizaciones <b>menores</b> y <b>parches</b> de seguridad.
              Las versiones <b>mayores</b> requieren intervención del desarrollador para evitar romper el sistema.
              Antes de cualquier actualización se crea un respaldo automático.
            </p>
          </div>
          <button
            onClick={check} disabled={busy !== null}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-brand-600 text-white text-sm hover:bg-brand-700 disabled:opacity-50"
          >
            {busy === 'check' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            Buscar actualizaciones
          </button>
        </div>
      </div>

      {updates && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Pill label="Total"   value={updates.summary.total}   />
            <Pill label="Parches" value={updates.summary.patches} tone="emerald" />
            <Pill label="Menores" value={updates.summary.minor}   tone="sky" />
            <Pill label="Mayores" value={updates.summary.major}   tone="rose" />
          </div>

          {updates.summary.major > 0 && (
            <div className="rounded-xl border-2 border-amber-300 bg-amber-50 p-4 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-700 mt-0.5" />
              <div className="text-sm text-amber-900">
                Hay <b>{updates.summary.major}</b> librería{updates.summary.major === 1 ? '' : 's'} con
                actualización <b>mayor</b>. <b>No se recomienda actualizar automáticamente</b>. Solicítelo al equipo de desarrollo.
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ProjectTable title="Backend"  items={updates.backend}  onApply={() => setConfirmApply('backend')}  busy={busy === 'apply'} />
            <ProjectTable title="Frontend" items={updates.frontend} onApply={() => setConfirmApply('frontend')} busy={busy === 'apply'} />
          </div>

          {updates.summary.patches + updates.summary.minor > 0 && (
            <div className="flex justify-end">
              <button
                onClick={() => setConfirmApply('all')}
                disabled={busy !== null}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-emerald-600 text-white text-sm hover:bg-emerald-700 disabled:opacity-50"
              >
                {busy === 'apply' ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                Actualizar librerías seguras (todo)
              </button>
            </div>
          )}
        </>
      )}

      <ConfirmDialog
        open={confirmApply !== null}
        title="Aplicar actualizaciones seguras"
        message={
          confirmApply === 'all'
            ? 'Se actualizarán los paquetes patch/minor de backend y frontend. Antes se creará un respaldo automático. ¿Continuar?'
            : `Se actualizarán los paquetes patch/minor de ${confirmApply}. Antes se creará un respaldo automático. ¿Continuar?`
        }
        confirmText="Sí, actualizar"
        confirmTone="emerald"
        onCancel={() => setConfirmApply(null)}
        onConfirm={() => confirmApply && apply(confirmApply)}
      />
    </div>
  );
}

function Pill({ label, value, tone = 'slate' }: { label: string; value: number; tone?: string }) {
  const map: Record<string, string> = {
    slate: 'bg-slate-100 text-slate-800',
    emerald: 'bg-emerald-100 text-emerald-800',
    sky: 'bg-sky-100 text-sky-800',
    rose: 'bg-rose-100 text-rose-800',
  };
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${map[tone]}`}>{label}</div>
      <div className="mt-2 text-2xl font-semibold text-slate-900">{value}</div>
    </div>
  );
}

function ProjectTable({ title, items, onApply, busy }: {
  title: string; items: OutdatedItem[]; onApply: () => void; busy: boolean;
}) {
  const safeCount = items.filter(i => i.isSafe).length;
  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
        <div className="font-semibold text-slate-900">{title}</div>
        <button
          disabled={busy || safeCount === 0}
          onClick={onApply}
          className="text-sm px-3 py-1.5 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          Actualizar seguros ({safeCount})
        </button>
      </div>
      {items.length === 0 ? (
        <div className="p-6 text-sm text-slate-500 text-center">No hay paquetes desactualizados.</div>
      ) : (
        <div className="max-h-96 overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600 sticky top-0">
              <tr>
                <th className="px-3 py-2 text-left">Paquete</th>
                <th className="px-3 py-2 text-left">Actual</th>
                <th className="px-3 py-2 text-left">Última</th>
                <th className="px-3 py-2 text-left">Tipo</th>
              </tr>
            </thead>
            <tbody>
              {items.map(it => (
                <tr key={it.package} className="border-t border-slate-100">
                  <td className="px-3 py-1.5 font-mono text-xs">{it.package}</td>
                  <td className="px-3 py-1.5 text-slate-700">{it.current}</td>
                  <td className="px-3 py-1.5 text-slate-700">{it.latest}</td>
                  <td className="px-3 py-1.5">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs border ${TYPE_TONE[it.type]}`}>
                      {it.type}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
