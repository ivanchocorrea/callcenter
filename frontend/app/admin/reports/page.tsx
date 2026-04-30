'use client';

import { AppShell } from '@/components/shared/AppShell';
import { FileText, BarChart3, PhoneCall, Users, Clock } from 'lucide-react';

const REPORTS = [
  { slug: 'calls-summary', name: 'Resumen de llamadas', description: 'Totales, atendidas, abandonadas por día/semana/mes', icon: <PhoneCall className="w-5 h-5" /> },
  { slug: 'agent-performance', name: 'Desempeño de agentes', description: 'AHT, llamadas atendidas, tiempo en pausa, calidad', icon: <Users className="w-5 h-5" /> },
  { slug: 'queue-stats', name: 'Estadísticas de colas', description: 'SLA, tiempo de espera promedio, abandono por cola', icon: <Clock className="w-5 h-5" /> },
  { slug: 'campaigns', name: 'Resultados de campañas', description: 'Conversiones, contactabilidad, intentos por campaña', icon: <BarChart3 className="w-5 h-5" /> },
];

export default function ReportsPage() {
  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Reportes</h2>
          <p className="text-slate-500 mt-1">Informes operativos y métricas del Call Center.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {REPORTS.map(r => (
            <button key={r.slug} className="rounded-xl border border-slate-200 bg-white p-5 text-left hover:shadow-md hover:border-brand-300 transition">
              <div className="flex items-start gap-3">
                <div className="text-brand-600 mt-0.5">{r.icon}</div>
                <div className="flex-1">
                  <div className="font-semibold text-slate-900">{r.name}</div>
                  <p className="text-sm text-slate-500 mt-1">{r.description}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-600">
          <FileText className="w-5 h-5 text-slate-400 inline-block mr-2" />
          Los reportes consumen los endpoints <code className="bg-white px-1.5 py-0.5 rounded text-xs">/api/reports/*</code> del backend.
        </div>
      </div>
    </AppShell>
  );
}
