'use client';

import { AppShell } from '@/components/shared/AppShell';
import { StatCard } from '@/components/shared/StatCard';
import { PhoneCall, Users, Clock, ListTree } from 'lucide-react';

export default function DashboardPage() {
  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Bienvenido</h2>
          <p className="text-slate-500 mt-1">Vista general de tu centro de contacto.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Llamadas hoy" value="—" hint="Aún sin datos" icon={<PhoneCall className="w-6 h-6" />} />
          <StatCard label="Agentes online" value="—" icon={<Users className="w-6 h-6" />} />
          <StatCard label="Tiempo medio espera" value="—" icon={<Clock className="w-6 h-6" />} />
          <StatCard label="Llamadas en cola" value="—" icon={<ListTree className="w-6 h-6" />} />
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
          Cuando configures tus troncales SIP y agentes (Fase 3 y 5), este dashboard mostrará métricas en tiempo real.
        </div>
      </div>
    </AppShell>
  );
}
