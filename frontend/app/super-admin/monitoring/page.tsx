'use client';

import { AppShell } from '@/components/shared/AppShell';
import { Activity, Server, Database, Cpu, HardDrive, Wifi, AlertTriangle } from 'lucide-react';

interface ServiceStatus {
  name: string;
  status: 'up' | 'down' | 'unknown';
  description: string;
  icon: React.ReactNode;
}

const SERVICES: ServiceStatus[] = [
  { name: 'Backend API', status: 'up', description: 'NestJS — REST + Socket.IO', icon: <Server className="w-5 h-5" /> },
  { name: 'Frontend', status: 'up', description: 'Next.js SSR', icon: <Wifi className="w-5 h-5" /> },
  { name: 'MySQL', status: 'up', description: 'Base de datos principal', icon: <Database className="w-5 h-5" /> },
  { name: 'Redis', status: 'up', description: 'Cache + pub/sub', icon: <Cpu className="w-5 h-5" /> },
  { name: 'Asterisk', status: 'unknown', description: 'PBX telefonía (pendiente configurar)', icon: <Activity className="w-5 h-5" /> },
  { name: 'Storage', status: 'up', description: 'Local — /var/recordings', icon: <HardDrive className="w-5 h-5" /> },
];

function statusColor(s: ServiceStatus['status']) {
  return s === 'up' ? 'bg-emerald-100 text-emerald-700' :
         s === 'down' ? 'bg-rose-100 text-rose-700' :
         'bg-slate-100 text-slate-600';
}

function statusLabel(s: ServiceStatus['status']) {
  return s === 'up' ? '● Operativo' : s === 'down' ? '● Caído' : '● Desconocido';
}

export default function MonitoringPage() {
  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Monitoreo</h2>
          <p className="text-slate-500 mt-1">
            Estado de los servicios del sistema y métricas operativas.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {SERVICES.map(s => (
            <div key={s.name} className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="text-brand-600">{s.icon}</div>
                <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${statusColor(s.status)}`}>
                  {statusLabel(s.status)}
                </span>
              </div>
              <div className="font-semibold text-slate-900">{s.name}</div>
              <p className="text-xs text-slate-500 mt-1">{s.description}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h3 className="text-base font-semibold text-slate-900 mb-3">Métricas globales</h3>
            <dl className="space-y-3">
              <div className="flex items-center justify-between">
                <dt className="text-sm text-slate-600">Empresas activas</dt>
                <dd className="text-sm font-semibold text-slate-900">0</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-sm text-slate-600">Usuarios totales</dt>
                <dd className="text-sm font-semibold text-slate-900">1</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-sm text-slate-600">Llamadas (último 24h)</dt>
                <dd className="text-sm font-semibold text-slate-900">0</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-sm text-slate-600">Espacio en grabaciones</dt>
                <dd className="text-sm font-semibold text-slate-900">0 MB</dd>
              </div>
            </dl>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h3 className="text-base font-semibold text-slate-900 mb-3">Salud del sistema</h3>
            <dl className="space-y-3">
              <div className="flex items-center justify-between">
                <dt className="text-sm text-slate-600">Health check API</dt>
                <dd className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">OK</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-sm text-slate-600">Health check BD</dt>
                <dd className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">OK</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-sm text-slate-600">Health check Redis</dt>
                <dd className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">OK</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-sm text-slate-600">Asterisk</dt>
                <dd className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">No configurado</dd>
              </div>
            </dl>
          </div>
        </div>

        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
            <div>
              <p className="font-medium text-amber-900">Métricas en tiempo real próximamente</p>
              <p className="text-amber-800 mt-1">
                El backend expone métricas Prometheus en <code className="bg-white px-1.5 py-0.5 rounded text-xs">/metrics</code>.
                Esta vista se conectará a un endpoint de monitoreo en una versión futura.
              </p>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
