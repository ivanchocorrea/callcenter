'use client';

import { useState } from 'react';
import { maintenanceApi, type BackupRow } from '@/lib/api/maintenance';
import { HardDrive, Loader2, RotateCcw, Save, ShieldAlert } from 'lucide-react';

const STATUS_LABEL: Record<string, { text: string; tone: string }> = {
  running: { text: 'En curso',  tone: 'bg-sky-100 text-sky-800' },
  success: { text: 'Exitoso',   tone: 'bg-emerald-100 text-emerald-800' },
  failed:  { text: 'Falló',     tone: 'bg-rose-100 text-rose-800' },
};

export function BackupsPanel({
  backups, onRefresh, onToast,
}: {
  backups: BackupRow[];
  onRefresh: () => void;
  onToast: (msg: string, tone?: 'ok' | 'warn' | 'err') => void;
}) {
  const [creating, setCreating] = useState(false);
  const [restoreId, setRestoreId] = useState<number | null>(null);
  const [phrase, setPhrase] = useState('');
  const [check1, setCheck1] = useState(false);
  const [check2, setCheck2] = useState(false);
  const [restoring, setRestoring] = useState(false);

  async function create() {
    setCreating(true);
    try {
      const r = await maintenanceApi.createBackup('Respaldo manual desde panel');
      onToast(r.message ?? 'Respaldo creado', 'ok');
      onRefresh();
    } catch (e: any) {
      onToast(`Error al crear respaldo: ${e?.response?.data?.message ?? e.message}`, 'err');
    } finally { setCreating(false); }
  }

  async function doRestore() {
    if (!restoreId) return;
    setRestoring(true);
    try {
      const r = await maintenanceApi.restoreBackup(restoreId, phrase);
      onToast(r.message ?? 'Restauración completada', 'ok');
      setRestoreId(null); setPhrase(''); setCheck1(false); setCheck2(false);
      onRefresh();
    } catch (e: any) {
      onToast(`No se pudo restaurar: ${e?.response?.data?.message ?? e.message}`, 'err');
    } finally { setRestoring(false); }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <HardDrive className="w-5 h-5 text-slate-600 mt-0.5" />
          <div>
            <div className="font-semibold text-slate-900">Respaldos del sistema</div>
            <p className="text-sm text-slate-600 mt-1">
              Cada respaldo incluye base de datos, archivos subidos y configuración crítica.
              Las claves y secretos nunca se incluyen en texto plano.
            </p>
          </div>
        </div>
        <button
          onClick={create} disabled={creating}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-brand-600 text-white text-sm hover:bg-brand-700 disabled:opacity-50"
        >
          {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Crear respaldo ahora
        </button>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        {backups.length === 0 ? (
          <div className="p-8 text-center text-slate-500">No hay respaldos todavía.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-3 py-2 text-left">Fecha</th>
                <th className="px-3 py-2 text-left">Tipo</th>
                <th className="px-3 py-2 text-left">Contenido</th>
                <th className="px-3 py-2 text-left">Tamaño</th>
                <th className="px-3 py-2 text-left">Estado</th>
                <th className="px-3 py-2 text-right">Acción</th>
              </tr>
            </thead>
            <tbody>
              {backups.map(b => (
                <tr key={b.id} className="border-t border-slate-100">
                  <td className="px-3 py-2 whitespace-nowrap">
                    {new Date(b.started_at).toLocaleString()}
                  </td>
                  <td className="px-3 py-2 capitalize">{b.trigger_type.replace('_', ' ')}</td>
                  <td className="px-3 py-2 text-xs text-slate-600">
                    {b.includes_db ? 'BD ' : ''}
                    {b.includes_uploads ? '· Archivos ' : ''}
                    {b.includes_config ? '· Config' : ''}
                  </td>
                  <td className="px-3 py-2">
                    {b.file_size_bytes ? `${(b.file_size_bytes / 1024 ** 2).toFixed(1)} MB` : '—'}
                  </td>
                  <td className="px-3 py-2">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs ${STATUS_LABEL[b.status]?.tone}`}>
                      {STATUS_LABEL[b.status]?.text ?? b.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    {b.status === 'success' && (
                      <button
                        onClick={() => setRestoreId(b.id)}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100"
                      >
                        <RotateCcw className="w-3.5 h-3.5" /> Restaurar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal de restauración con DOBLE confirmación */}
      {restoreId !== null && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 max-w-lg w-full p-6">
            <div className="flex items-start gap-3">
              <ShieldAlert className="w-6 h-6 text-rose-600" />
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Restaurar respaldo #{restoreId}</h3>
                <p className="text-sm text-slate-600 mt-1">
                  Esta acción <b>reemplazará</b> los datos actuales por los del respaldo elegido.
                  Antes de continuar se creará un respaldo automático adicional.
                </p>
              </div>
            </div>

            <div className="mt-4 space-y-3 text-sm">
              <label className="flex items-start gap-2">
                <input type="checkbox" checked={check1} onChange={e => setCheck1(e.target.checked)} className="mt-1" />
                <span>Entiendo que los datos actuales se reemplazarán.</span>
              </label>
              <label className="flex items-start gap-2">
                <input type="checkbox" checked={check2} onChange={e => setCheck2(e.target.checked)} className="mt-1" />
                <span>Soy responsable de esta acción y he avisado al equipo.</span>
              </label>
              <div>
                <div className="text-slate-600 mb-1">Escriba la palabra <code className="bg-slate-100 px-1 rounded">RESTAURAR</code> para continuar:</div>
                <input
                  value={phrase} onChange={e => setPhrase(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md font-mono"
                  placeholder="RESTAURAR"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => { setRestoreId(null); setPhrase(''); setCheck1(false); setCheck2(false); }}
                className="px-4 py-2 rounded-md bg-white border border-slate-300 text-sm hover:bg-slate-50"
              >Cancelar</button>
              <button
                disabled={!check1 || !check2 || phrase.trim().toUpperCase() !== 'RESTAURAR' || restoring}
                onClick={doRestore}
                className="px-4 py-2 rounded-md bg-rose-600 text-white text-sm hover:bg-rose-700 disabled:opacity-40"
              >
                {restoring ? 'Restaurando…' : 'Restaurar ahora'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
