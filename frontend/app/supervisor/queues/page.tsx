'use client';
import { AppShell } from '@/components/shared/AppShell';
import { ListTree } from 'lucide-react';

export default function SupervisorQueuesPage() {
  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Colas en vivo</h2>
          <p className="text-slate-500 mt-1">Estado en tiempo real de las colas: en espera, SLA, abandonos.</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-12 text-center">
          <ListTree className="w-12 h-12 mx-auto text-slate-300" />
          <p className="mt-4 text-slate-600">Sin colas activas en este momento.</p>
        </div>
      </div>
    </AppShell>
  );
}
