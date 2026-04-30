'use client';

import { AppShell } from '@/components/shared/AppShell';
import { StatCard } from '@/components/shared/StatCard';
import { Building2, Users, Activity, AlertTriangle } from 'lucide-react';

export default function SuperAdminHome() {
  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Panel Super Admin</h2>
          <p className="text-slate-500 mt-1">Vista global del SaaS.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Empresas activas" value="0" icon={<Building2 className="w-6 h-6" />} />
          <StatCard label="Usuarios totales" value="1" hint="Tú mismo" icon={<Users className="w-6 h-6" />} />
          <StatCard label="Llamadas hoy" value="0" icon={<Activity className="w-6 h-6" />} />
          <StatCard label="Alertas" value="0" icon={<AlertTriangle className="w-6 h-6" />} />
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <h3 className="text-base font-semibold text-slate-900">Próximos pasos</h3>
          <ul className="mt-3 space-y-2 text-sm text-slate-600 list-disc pl-5">
            <li>Crear la primera empresa desde <strong>Empresas → Nueva</strong>.</li>
            <li>Crear el <code>company_admin</code> de esa empresa.</li>
            <li>Configurar la troncal SIP del proveedor.</li>
            <li>Crear agentes y darles credenciales WebRTC.</li>
          </ul>
        </div>
      </div>
    </AppShell>
  );
}
