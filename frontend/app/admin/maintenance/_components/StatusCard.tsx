'use client';

import type { ComponentStatus } from '@/lib/api/maintenance';
import { CheckCircle2, AlertTriangle, XCircle, HelpCircle } from 'lucide-react';

export function StatusCard({ component, Icon }: { component: ComponentStatus; Icon: any }) {
  const tone =
    component.status === 'ok'       ? { ring: 'ring-emerald-200', bar: 'bg-emerald-500', text: 'text-emerald-700', tag: 'bg-emerald-50 text-emerald-700' } :
    component.status === 'degraded' ? { ring: 'ring-amber-200',  bar: 'bg-amber-500',   text: 'text-amber-700',   tag: 'bg-amber-50 text-amber-700' } :
    component.status === 'down'     ? { ring: 'ring-rose-200',   bar: 'bg-rose-500',    text: 'text-rose-700',    tag: 'bg-rose-50 text-rose-700' } :
                                      { ring: 'ring-slate-200',  bar: 'bg-slate-400',   text: 'text-slate-600',   tag: 'bg-slate-50 text-slate-600' };
  const StatusIcon =
    component.status === 'ok' ? CheckCircle2 :
    component.status === 'degraded' ? AlertTriangle :
    component.status === 'down' ? XCircle : HelpCircle;
  const label =
    component.status === 'ok' ? 'Activo' :
    component.status === 'degraded' ? 'Aviso' :
    component.status === 'down' ? 'Caído' : 'Desconocido';

  return (
    <div className={`rounded-xl bg-white border border-slate-200 ring-1 ${tone.ring} p-4`}>
      <div className="flex items-start justify-between">
        <div className="p-2 rounded-md bg-slate-50">
          <Icon className="w-5 h-5 text-slate-700" />
        </div>
        <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${tone.tag}`}>
          <StatusIcon className="w-3.5 h-3.5" /> {label}
        </span>
      </div>
      <div className="mt-3">
        <div className="text-sm font-semibold text-slate-900">{component.label}</div>
        <p className="text-sm text-slate-600 mt-1">{component.friendly}</p>
      </div>
      <div className={`mt-3 text-xs ${tone.text}`}>{component.message}</div>
      <div className={`mt-3 h-1 rounded-full ${tone.bar}`} />
    </div>
  );
}
