'use client';

import { AppShell } from '@/components/shared/AppShell';
import { StatCard } from '@/components/shared/StatCard';
import { PhoneCall, Headphones, ListTree, Bot } from 'lucide-react';

export default function CompanyAdminHome() {
  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Panel de administración</h2>
          <p className="text-slate-500 mt-1">Configuración general de tu empresa.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Llamadas hoy" value="—" icon={<PhoneCall className="w-6 h-6" />} />
          <StatCard label="Agentes activos" value="—" icon={<Headphones className="w-6 h-6" />} />
          <StatCard label="Colas" value="—" icon={<ListTree className="w-6 h-6" />} />
          <StatCard label="Bots IA" value="—" icon={<Bot className="w-6 h-6" />} />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <h3 className="text-base font-semibold text-slate-900">Checklist de configuración</h3>
            <ul className="mt-3 space-y-2 text-sm">
              <li className="flex items-center gap-2 text-slate-600">
                <span className="w-5 h-5 rounded-full border-2 border-slate-300" />
                Configurar troncal SIP
              </li>
              <li className="flex items-center gap-2 text-slate-600">
                <span className="w-5 h-5 rounded-full border-2 border-slate-300" />
                Crear agentes
              </li>
              <li className="flex items-center gap-2 text-slate-600">
                <span className="w-5 h-5 rounded-full border-2 border-slate-300" />
                Configurar IVR de bienvenida
              </li>
              <li className="flex items-center gap-2 text-slate-600">
                <span className="w-5 h-5 rounded-full border-2 border-slate-300" />
                Crear primera cola
              </li>
              <li className="flex items-center gap-2 text-slate-600">
                <span className="w-5 h-5 rounded-full border-2 border-slate-300" />
                Importar clientes
              </li>
            </ul>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <h3 className="text-base font-semibold text-slate-900">Actividad reciente</h3>
            <p className="text-sm text-slate-500 mt-2">Sin actividad todavía.</p>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
