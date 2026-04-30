'use client';
import { AppShell } from '@/components/shared/AppShell';
import { ClipboardCheck } from 'lucide-react';

export default function SupervisorQualityPage() {
  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Calidad</h2>
          <p className="text-slate-500 mt-1">Evaluaciones de calidad realizadas a llamadas.</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-12 text-center">
          <ClipboardCheck className="w-12 h-12 mx-auto text-slate-300" />
          <p className="mt-4 text-slate-600">Sin evaluaciones todavía.</p>
        </div>
      </div>
    </AppShell>
  );
}
