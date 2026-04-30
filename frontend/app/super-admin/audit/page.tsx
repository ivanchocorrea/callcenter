'use client';

import { AppShell } from '@/components/shared/AppShell';
import { ShieldCheck, Info } from 'lucide-react';

export default function AuditPage() {
  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Auditoría</h2>
          <p className="text-slate-500 mt-1">
            Registro de acciones sensibles realizadas en la plataforma.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-xs uppercase tracking-wide text-slate-500">Acciones hoy</div>
                <div className="mt-2 text-2xl font-semibold text-slate-900">0</div>
              </div>
              <ShieldCheck className="w-6 h-6 text-brand-600" />
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="text-xs uppercase tracking-wide text-slate-500">Esta semana</div>
            <div className="mt-2 text-2xl font-semibold text-slate-900">0</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="text-xs uppercase tracking-wide text-slate-500">Este mes</div>
            <div className="mt-2 text-2xl font-semibold text-slate-900">0</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="text-xs uppercase tracking-wide text-slate-500">Críticas</div>
            <div className="mt-2 text-2xl font-semibold text-slate-900">0</div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-slate-900">Actividad reciente</h3>
              <p className="text-xs text-slate-500 mt-0.5">Últimas 50 acciones registradas</p>
            </div>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Fecha</th>
                <th className="text-left px-4 py-3 font-medium">Usuario</th>
                <th className="text-left px-4 py-3 font-medium">Acción</th>
                <th className="text-left px-4 py-3 font-medium">Recurso</th>
                <th className="text-left px-4 py-3 font-medium">IP</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-slate-500">
                  <Info className="w-5 h-5 mx-auto mb-2 text-slate-400" />
                  <p>No hay registros de auditoría todavía.</p>
                  <p className="text-xs text-slate-400 mt-1">
                    Las acciones sensibles aparecerán aquí: logins, cambios de configuración, eliminaciones.
                  </p>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
            <div>
              <p className="font-medium text-amber-900">Vista en desarrollo</p>
              <p className="text-amber-800 mt-1">
                Esta sección consultará la tabla <code className="bg-white px-1.5 py-0.5 rounded text-xs">audit_logs</code> cuando se implemente el endpoint del backend.
                Por ahora puedes consultar los logs directamente con SQL.
              </p>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
