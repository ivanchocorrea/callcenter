'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/shared/AppShell';
import { api, unwrap } from '@/lib/api/client';
import { Plus, MessageSquare, Trash2 } from 'lucide-react';
import { SmsProviderFormModal } from './SmsProviderFormModal';

interface Provider {
  id: number;
  slug: string;
  name: string;
  provider_type: string;
  sender_id: string | null;
  is_default: boolean;
  is_active: boolean;
}

export default function SmsProvidersPage() {
  const [items, setItems] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openCreate, setOpenCreate] = useState(false);

  function reload() {
    setLoading(true);
    api.get('/sms/providers')
      .then(res => setItems(unwrap<Provider[]>(res)))
      .catch(e => setError(e?.response?.data?.error?.message ?? 'Error al cargar proveedores'))
      .finally(() => setLoading(false));
  }
  useEffect(() => { reload(); }, []);

  async function handleDelete(id: number, name: string) {
    if (!confirm(`¿Eliminar el proveedor "${name}"?`)) return;
    try {
      await api.delete(`/sms/providers/${id}`);
      reload();
    } catch (e: any) {
      alert(e?.response?.data?.error?.message ?? 'Error al eliminar');
    }
  }

  return (
    <AppShell>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-slate-900">Proveedores SMS</h2>
            <p className="text-slate-500 mt-1">Twilio, Plivo, Vonage, AWS SNS o HTTP custom. Credenciales cifradas con AES-256.</p>
          </div>
          <button onClick={() => setOpenCreate(true)} className="inline-flex items-center gap-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 text-sm font-medium">
            <Plus className="w-4 h-4" /> Nuevo proveedor
          </button>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Nombre</th>
                <th className="text-left px-4 py-3 font-medium">Tipo</th>
                <th className="text-left px-4 py-3 font-medium">Sender ID / From</th>
                <th className="text-left px-4 py-3 font-medium">Estado</th>
                <th className="text-right px-4 py-3 font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">Cargando…</td></tr>}
              {error && <tr><td colSpan={5} className="px-4 py-8 text-center text-rose-600">{error}</td></tr>}
              {!loading && !error && items.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-12 text-center text-slate-500">
                  <MessageSquare className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                  No hay proveedores SMS configurados.
                </td></tr>
              )}
              {items.map(p => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">{p.name}</div>
                    {p.is_default && <span className="text-xs text-emerald-600">★ Por defecto</span>}
                  </td>
                  <td className="px-4 py-3"><code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs">{p.provider_type}</code></td>
                  <td className="px-4 py-3 text-slate-700">{p.sender_id ?? '—'}</td>
                  <td className="px-4 py-3"><span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${p.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700'}`}>{p.is_active ? 'activo' : 'inactivo'}</span></td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => handleDelete(p.id, p.name)} className="text-slate-400 hover:text-rose-600">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {openCreate && <SmsProviderFormModal onClose={() => setOpenCreate(false)} onSaved={reload} />}
    </AppShell>
  );
}
