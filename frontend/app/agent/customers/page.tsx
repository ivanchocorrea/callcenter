'use client';
import { AppShell } from '@/components/shared/AppShell';
import { Users } from 'lucide-react';

export default function AgentCustomersPage() {
  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Mis clientes</h2>
          <p className="text-slate-500 mt-1">Clientes asignados a tu cartera.</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-12 text-center">
          <Users className="w-12 h-12 mx-auto text-slate-300" />
          <p className="mt-4 text-slate-600">No tienes clientes asignados.</p>
        </div>
      </div>
    </AppShell>
  );
}
