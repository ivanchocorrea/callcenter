'use client';

import { useState } from 'react';
import { maintenanceApi, type SystemError } from '@/lib/api/maintenance';
import { AlertCircle, AlertTriangle, ChevronDown, ChevronRight, FileJson, FileText, RefreshCw } from 'lucide-react';

const SEV_TONE: Record<string, string> = {
  critical: 'bg-rose-100 text-rose-800 border-rose-200',
  error:    'bg-red-100 text-red-800 border-red-200',
  warning:  'bg-amber-100 text-amber-800 border-amber-200',
  info:     'bg-sky-100 text-sky-800 border-sky-200',
};

const STATUS_LABEL: Record<string, string> = {
  open: 'Abierto', acknowledged: 'En revisión', resolved: 'Resuelto', ignored: 'Ignorado',
};

export function ErrorsTable({
  errors, onUpdate, onToast,
}: {
  errors: SystemError[];
  onUpdate: () => void;
  onToast: (msg: string, tone?: 'ok' | 'warn' | 'err') => void;
}) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [filter, setFilter] = useState<'all' | 'open' | 'critical'>('open');

  const filtered = errors.filter(e => {
    if (filter === 'open')     return e.status === 'open';
    if (filter === 'critical') return e.severity === 'critical';
    return true;
  });

  const critical = errors.filter(e => e.severity === 'critical' && e.status === 'open').length;

  function toggle(id: number) {
    const n = new Set(expanded);
    n.has(id) ? n.delete(id) : n.add(id);
    setExpanded(n);
  }

  async function changeStatus(id: number, newStatus: SystemError['status']) {
    try {
      await maintenanceApi.updateErrorStatus(id, newStatus);
      onToast('Estado del error actualizado', 'ok');
      onUpdate();
    } catch (e: any) {
      onToast(`No se pudo actualizar: ${e?.response?.data?.message ?? e.message}`, 'err');
    }
  }

  function downloadLogs(format: 'txt' | 'json') {
    // Forzamos descarga via fetch + blob para incluir el token de auth
    fetch(maintenanceApi.downloadLogsUrl(format), {
      headers: { Authorization: `Bearer ${localStorage.getItem('cc_access') ?? ''}` },
    })
      .then(r => r.ok ? r.blob() : Promise.reject(new Error('No autorizado')))
      .then(blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `system-logs-${Date.now()}.${format}`;
        a.click();
        URL.revokeObjectURL(url);
        onToast('Descarga iniciada', 'ok');
      })
      .catch(err => onToast(`Error al descargar: ${err.message}`, 'err'));
  }

  return (
    <div className="space-y-4">
      {critical > 0 && (
        <div className="rounded-xl border-2 border-rose-300 bg-rose-50 p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-rose-600 mt-0.5" />
          <div>
            <div className="font-semibold text-rose-800">
              {critical} error{critical === 1 ? '' : 'es'} crítico{critical === 1 ? '' : 's'} sin atender
            </div>
            <p className="text-sm text-rose-700 mt-1">
              Le recomendamos revisar y atender estos errores cuanto antes.
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 justify-between">
        <div className="flex gap-2">
          {(['open', 'critical', 'all'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-md text-sm border ${
                filter === f
                  ? 'bg-brand-600 text-white border-brand-600'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
              }`}
            >
              {f === 'open' ? 'Solo abiertos' : f === 'critical' ? 'Solo críticos' : 'Todos'}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <button onClick={() => downloadLogs('txt')}  className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-white border border-slate-300 text-sm hover:bg-slate-50">
            <FileText className="w-4 h-4" /> Descargar .txt
          </button>
          <button onClick={() => downloadLogs('json')} className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-white border border-slate-300 text-sm hover:bg-slate-50">
            <FileJson className="w-4 h-4" /> Descargar .json
          </button>
          <button onClick={onUpdate} className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-white border border-slate-300 text-sm hover:bg-slate-50">
            <RefreshCw className="w-4 h-4" /> Buscar errores
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            <AlertCircle className="w-6 h-6 mx-auto opacity-50" />
            <p className="mt-2">No hay errores que mostrar con este filtro.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-3 py-2 text-left w-8"></th>
                <th className="px-3 py-2 text-left">Fecha</th>
                <th className="px-3 py-2 text-left">Módulo</th>
                <th className="px-3 py-2 text-left">Gravedad</th>
                <th className="px-3 py-2 text-left">Mensaje</th>
                <th className="px-3 py-2 text-left">Estado</th>
                <th className="px-3 py-2 text-right">Acción</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(e => (
                <FragmentRow
                  key={e.id} err={e} expanded={expanded.has(e.id)}
                  onToggle={() => toggle(e.id)} onChange={changeStatus}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function FragmentRow({
  err, expanded, onToggle, onChange,
}: {
  err: SystemError; expanded: boolean; onToggle: () => void;
  onChange: (id: number, s: SystemError['status']) => void;
}) {
  return (
    <>
      <tr className="border-t border-slate-100 hover:bg-slate-50">
        <td className="px-3 py-2">
          <button onClick={onToggle} className="text-slate-500">
            {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
        </td>
        <td className="px-3 py-2 text-slate-600 whitespace-nowrap">
          {new Date(err.occurred_at).toLocaleString()}
        </td>
        <td className="px-3 py-2">
          <div className="font-medium text-slate-900">{err.module}</div>
          <div className="text-xs text-slate-500">{err.source}</div>
        </td>
        <td className="px-3 py-2">
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${SEV_TONE[err.severity]}`}>
            {err.severity.toUpperCase()}
          </span>
        </td>
        <td className="px-3 py-2 max-w-md">
          <div className="text-slate-900">{err.friendly_message}</div>
          {err.recommendation && (
            <div className="text-xs text-slate-500 mt-0.5">→ {err.recommendation}</div>
          )}
        </td>
        <td className="px-3 py-2 text-slate-600">{STATUS_LABEL[err.status]}</td>
        <td className="px-3 py-2 text-right">
          {err.status === 'open' && (
            <div className="flex gap-1 justify-end">
              <button
                onClick={() => onChange(err.id, 'acknowledged')}
                className="px-2 py-1 text-xs rounded bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100"
              >Tomar</button>
              <button
                onClick={() => onChange(err.id, 'resolved')}
                className="px-2 py-1 text-xs rounded bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100"
              >Resolver</button>
            </div>
          )}
        </td>
      </tr>
      {expanded && (
        <tr className="bg-slate-50">
          <td colSpan={7} className="px-6 py-3">
            <div className="text-xs uppercase tracking-wide text-slate-500">Detalle técnico</div>
            <pre className="mt-1 whitespace-pre-wrap text-xs text-slate-700 bg-white p-3 rounded border border-slate-200 max-h-56 overflow-auto">
{err.technical_message}
            </pre>
          </td>
        </tr>
      )}
    </>
  );
}
