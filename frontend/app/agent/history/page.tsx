'use client';
import { AppShell } from '@/components/shared/AppShell';
import { FileText } from 'lucide-react';

export default function AgentHistoryPage() {
  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Mi historial</h2>
          <p className="text-slate-500 mt-1">Tus llamadas atendidas y realizadas.</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-12 text-center">
          <FileText className="w-12 h-12 mx-auto text-slate-300" />
          <p className="mt-4 text-slate-600">Sin historial todavía.</p>
        </div>
      </div>
    </AppShell>
  );
}
