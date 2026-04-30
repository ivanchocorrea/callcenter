'use client';
import { AppShell } from '@/components/shared/AppShell';
import { HeadphonesIcon } from 'lucide-react';

export default function SupervisorAgentsPage() {
  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Agentes en vivo</h2>
          <p className="text-slate-500 mt-1">Monitoreo de estado de agentes: disponible, en llamada, en pausa.</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-12 text-center">
          <HeadphonesIcon className="w-12 h-12 mx-auto text-slate-300" />
          <p className="mt-4 text-slate-600">No hay agentes conectados.</p>
        </div>
      </div>
    </AppShell>
  );
}
