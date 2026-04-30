'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/shared/AppShell';
import { api, unwrap } from '@/lib/api/client';
import { Plus, Megaphone } from 'lucide-react';
import { CampaignFormModal } from './CampaignFormModal';

interface Campaign {
  id: number;
  name: string;
  type: string;
  status: string;
  total_records: number;
  attempted: number;
}

export default function CampaignsPage() {
  const [items, setItems] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openCreate, setOpenCreate] = useState(false);

  function reload() {
    setLoading(true);
    api.get('/campaigns')
      .then(res => setItems(unwrap<Campaign[]>(res)))
      .catch(e => setError(e?.response?.data?.error?.message ?? 'Error al cargar campañas'))
      .finally(() => setLoading(false));
  }
  useEffect(() => { reload(); }, []);

  return (
    <AppShell>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-slate-900">Campañas</h2>
            <p className="text-slate-500 mt-1">Llamadas masivas salientes (predictivas, progresivas, manuales).</p>
          </div>
          <button onClick={() => setOpenCreate(true)} className="inline-flex items-center gap-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 text-sm font-medium">
            <Plus className="w-4 h-4" /> Nueva campaña
          </button>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Nombre</th>
                <th className="text-left px-4 py-3 font-medium">Tipo</th>
                <th className="text-left px-4 py-3 font-medium">Progreso</th>
                <th className="text-left px-4 py-3 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-500">Cargando…</td></tr>}
              {error && <tr><td colSpan={4} className="px-4 py-8 text-center text-rose-600">{error}</td></tr>}
              {!loading && !error && items.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-12 text-center text-slate-500"><Megaphone className="w-8 h-8 mx-auto mb-2 text-slate-300" />No hay campañas todavía.</td></tr>
              )}
              {items.map(c => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">{c.name}</td>
                  <td className="px-4 py-3 text-slate-700">{c.type}</td>
                  <td className="px-4 py-3 text-slate-700 text-xs">{c.attempted}/{c.total_records}</td>
                  <td className="px-4 py-3"><span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">{c.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {openCreate && <CampaignFormModal onClose={() => setOpenCreate(false)} onSaved={reload} />}
    </AppShell>
  );
}
