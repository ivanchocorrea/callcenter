'use client';
import { AppShell } from '@/components/shared/AppShell';
import { PhoneCall } from 'lucide-react';

export default function SupervisorCallsPage() {
  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Llamadas</h2>
          <p className="text-slate-500 mt-1">Listado de llamadas históricas con filtros y exportación.</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-12 text-center">
          <PhoneCall className="w-12 h-12 mx-auto text-slate-300" />
          <p className="mt-4 text-slate-600">No hay llamadas en el rango seleccionado.</p>
        </div>
      </div>
    </AppShell>
  );
}
