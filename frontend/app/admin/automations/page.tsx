'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/shared/AppShell';
import { api, unwrap } from '@/lib/api/client';
import { Plus, Workflow } from 'lucide-react';
import { AutomationFormModal } from './AutomationFormModal';

interface Rule {
  id: number;
  name: string;
  trigger_event: string;
  is_active: boolean;
}

export default function AutomationsPage() {
  const [items, setItems] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openCreate, setOpenCreate] = useState(false);

  function reload() {
    setLoading(true);
    api.get('/automations')
      .then(res => setItems(unwrap<Rule[]>(res)))
      .catch(e => setError(e?.response?.data?.error?.message ?? 'Error al cargar automatizaciones'))
      .finally(() => setLoading(false));
  }
  useEffect(() => { reload(); }, []);

  return (
    <AppShell>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-slate-900">Automatizaciones</h2>
            <p className="text-slate-500 mt-1">Reglas if-then para automatizar acciones (crear ticket, enviar webhook, mandar SMS, etc.).</p>
          </div>
          <button onClick={() => setOpenCreate(true)} className="inline-flex items-center gap-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 text-sm font-medium">
            <Plus className="w-4 h-4" /> Nueva regla
          </button>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Nombre</th>
                <th className="text-left px-4 py-3 font-medium">Trigger</th>
                <th className="text-left px-4 py-3 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && <tr><td colSpan={3} className="px-4 py-8 text-center text-slate-500">Cargando…</td></tr>}
              {error && <tr><td colSpan={3} className="px-4 py-8 text-center text-rose-600">{error}</td></tr>}
              {!loading && !error && items.length === 0 && (
                <tr><td colSpan={3} className="px-4 py-12 text-center text-slate-500"><Workflow className="w-8 h-8 mx-auto mb-2 text-slate-300" />No hay automatizaciones todavía.</td></tr>
              )}
              {items.map(r => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">{r.name}</td>
                  <td className="px-4 py-3"><code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs">{r.trigger_event}</code></td>
                  <td className="px-4 py-3"><span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${r.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700'}`}>{r.is_active ? 'activa' : 'inactiva'}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {openCreate && <AutomationFormModal onClose={() => setOpenCreate(false)} onSaved={reload} />}
    </AppShell>
  );
}
