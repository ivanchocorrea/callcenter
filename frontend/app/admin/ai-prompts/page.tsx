'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/shared/AppShell';
import { api, unwrap } from '@/lib/api/client';
import { Plus, Wrench } from 'lucide-react';
import { PromptFormModal } from './PromptFormModal';

interface Prompt {
  id: number;
  slug: string;
  name: string;
  category: string;
  is_active: boolean;
}

export default function AiPromptsPage() {
  const [items, setItems] = useState<Prompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openCreate, setOpenCreate] = useState(false);

  function reload() {
    setLoading(true);
    api.get('/ai/prompts')
      .then(res => setItems(unwrap<Prompt[]>(res)))
      .catch(e => setError(e?.response?.data?.error?.message ?? 'Error al cargar prompts'))
      .finally(() => setLoading(false));
  }
  useEffect(() => { reload(); }, []);

  return (
    <AppShell>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-slate-900">Prompts de IA</h2>
            <p className="text-slate-500 mt-1">Plantillas reutilizables para los bots conversacionales.</p>
          </div>
          <button onClick={() => setOpenCreate(true)} className="inline-flex items-center gap-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 text-sm font-medium">
            <Plus className="w-4 h-4" /> Nuevo prompt
          </button>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Nombre</th>
                <th className="text-left px-4 py-3 font-medium">Slug</th>
                <th className="text-left px-4 py-3 font-medium">Categoría</th>
                <th className="text-left px-4 py-3 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-500">Cargando…</td></tr>}
              {error && <tr><td colSpan={4} className="px-4 py-8 text-center text-rose-600">{error}</td></tr>}
              {!loading && !error && items.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-12 text-center text-slate-500"><Wrench className="w-8 h-8 mx-auto mb-2 text-slate-300" />No hay prompts todavía.</td></tr>
              )}
              {items.map(p => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">{p.name}</td>
                  <td className="px-4 py-3"><code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs">{p.slug}</code></td>
                  <td className="px-4 py-3 text-slate-700">{p.category}</td>
                  <td className="px-4 py-3"><span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${p.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700'}`}>{p.is_active ? 'activo' : 'inactivo'}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {openCreate && <PromptFormModal onClose={() => setOpenCreate(false)} onSaved={reload} />}
    </AppShell>
  );
}
