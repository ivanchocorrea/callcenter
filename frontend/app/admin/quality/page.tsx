'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/shared/AppShell';
import { api, unwrap } from '@/lib/api/client';
import { Plus, ClipboardCheck, Trash2 } from 'lucide-react';
import { QualityFormModal } from './QualityFormModal';

interface QForm {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  schema: any;
  max_score: number;
  is_active: boolean;
}

export default function QualityPage() {
  const [forms, setForms] = useState<QForm[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openCreate, setOpenCreate] = useState(false);

  function reload() {
    setLoading(true);
    api.get('/quality/forms')
      .then(res => setForms(unwrap<QForm[]>(res).map((f: any) => ({
        ...f,
        schema: typeof f.schema === 'string' ? JSON.parse(f.schema) : f.schema,
      }))))
      .catch(e => setError(e?.response?.data?.error?.message ?? 'Error al cargar'))
      .finally(() => setLoading(false));
  }
  useEffect(() => { reload(); }, []);

  return (
    <AppShell>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-slate-900">Calidad</h2>
            <p className="text-slate-500 mt-1">Formularios para evaluar llamadas y agentes con scoring ponderado.</p>
          </div>
          <button onClick={() => setOpenCreate(true)} className="inline-flex items-center gap-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 text-sm font-medium">
            <Plus className="w-4 h-4" /> Nuevo formulario
          </button>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Formulario</th>
                <th className="text-left px-4 py-3 font-medium">Slug</th>
                <th className="text-left px-4 py-3 font-medium">Criterios</th>
                <th className="text-left px-4 py-3 font-medium">Puntaje máx</th>
                <th className="text-left px-4 py-3 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">Cargando…</td></tr>}
              {error && <tr><td colSpan={5} className="px-4 py-8 text-center text-rose-600">{error}</td></tr>}
              {!loading && !error && forms.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-12 text-center text-slate-500">
                  <ClipboardCheck className="w-8 h-8 mx-auto mb-2 text-slate-300" />Sin formularios. Crea el primero.
                </td></tr>
              )}
              {forms.map(f => (
                <tr key={f.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">{f.name}</div>
                    {f.description && <div className="text-xs text-slate-500 mt-0.5">{f.description}</div>}
                  </td>
                  <td className="px-4 py-3"><code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs">{f.slug}</code></td>
                  <td className="px-4 py-3 text-slate-700">{f.schema?.criteria?.length ?? 0}</td>
                  <td className="px-4 py-3 text-slate-700">{f.max_score}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${f.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700'}`}>
                      {f.is_active ? 'activo' : 'inactivo'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {openCreate && <QualityFormModal onClose={() => setOpenCreate(false)} onSaved={reload} />}
    </AppShell>
  );
}
