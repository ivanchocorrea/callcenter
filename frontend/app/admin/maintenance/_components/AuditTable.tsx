'use client';

import type { AuditRow } from '@/lib/api/maintenance';
import { CheckCircle2, XCircle } from 'lucide-react';

const ACTION_LABEL: Record<string, string> = {
  view_status: 'Ver estado',
  check_errors: 'Buscar errores',
  download_logs: 'Descargar logs',
  check_updates: 'Buscar actualizaciones',
  apply_safe_updates: 'Aplicar actualizaciones',
  apply_single_update: 'Actualizar paquete',
  create_backup: 'Crear respaldo',
  restore_backup: 'Restaurar respaldo',
  restart_service: 'Reiniciar servicio',
  run_tests: 'Ejecutar pruebas',
  toggle_maintenance_mode: 'Modo mantenimiento',
};

export function AuditTable({ rows }: { rows: AuditRow[] }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100">
        <div className="font-semibold text-slate-900">Auditoría de acciones</div>
        <p className="text-sm text-slate-500">Cada acción del panel queda registrada para trazabilidad.</p>
      </div>
      {rows.length === 0 ? (
        <div className="p-8 text-center text-slate-500">Sin acciones registradas.</div>
      ) : (
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-3 py-2 text-left">Fecha</th>
              <th className="px-3 py-2 text-left">Usuario</th>
              <th className="px-3 py-2 text-left">Acción</th>
              <th className="px-3 py-2 text-left">Objetivo</th>
              <th className="px-3 py-2 text-left">Resultado</th>
              <th className="px-3 py-2 text-left">Notas</th>
              <th className="px-3 py-2 text-left">IP</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id} className="border-t border-slate-100">
                <td className="px-3 py-2 whitespace-nowrap">
                  {new Date(r.occurred_at).toLocaleString()}
                </td>
                <td className="px-3 py-2 text-slate-700">{r.actor_email ?? `#${r.user_id ?? '—'}`}</td>
                <td className="px-3 py-2 font-medium">{ACTION_LABEL[r.action] ?? r.action}</td>
                <td className="px-3 py-2 text-slate-600">{r.target ?? '—'}</td>
                <td className="px-3 py-2">
                  {r.success
                    ? <span className="inline-flex items-center gap-1 text-emerald-700 text-xs"><CheckCircle2 className="w-4 h-4" /> OK</span>
                    : <span className="inline-flex items-center gap-1 text-rose-700 text-xs"><XCircle className="w-4 h-4" /> Error</span>}
                </td>
                <td className="px-3 py-2 text-slate-600 max-w-xs truncate" title={r.notes ?? ''}>{r.notes ?? '—'}</td>
                <td className="px-3 py-2 text-xs text-slate-500">{r.ip_address ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
