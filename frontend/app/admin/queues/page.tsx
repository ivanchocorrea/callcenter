'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/shared/AppShell';
import { api, unwrap } from '@/lib/api/client';
import { Plus, ListTree, Pencil, Trash2 } from 'lucide-react';
import { QueueFormModal, QueueFormInitial } from './QueueFormModal';
import { ConfirmDialog, Toast, DialogIcons } from '@/components/shared/Dialog';

interface Queue {
  id: number;
  name: string;
  slug?: string;
  strategy: string;
  max_wait_seconds: number;
  music_on_hold?: string;
  is_active: boolean;
}

export default function QueuesPage() {
  const [items, setItems] = useState<Queue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<QueueFormInitial | null>(null);
  const [openCreate, setOpenCreate] = useState(false);
  const [confirmDel, setConfirmDel] = useState<Queue | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState<{ msg: string; variant: 'success' | 'danger' | 'info' } | null>(null);

  function reload() {
    setLoading(true);
    api.get('/queues')
      .then(res => setItems(unwrap<Queue[]>(res)))
      .catch(e => setError(e?.response?.data?.error?.message ?? 'Error al cargar colas'))
      .finally(() => setLoading(false));
  }
  useEffect(() => { reload(); }, []);

  async function executeDelete() {
    if (!confirmDel) return;
    setDeleting(true);
    try {
      await api.delete(`/queues/${confirmDel.id}`);
      setToast({ msg: `Cola "${confirmDel.name}" eliminada`, variant: 'success' });
      setConfirmDel(null);
      reload();
    } catch (e: any) {
      setToast({ msg: e?.response?.data?.error?.message ?? 'Error al eliminar', variant: 'danger' });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <AppShell>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-slate-900">Colas</h2>
            <p className="text-slate-500 mt-1">Distribuye las llamadas entrantes entre agentes.</p>
          </div>
          <button onClick={() => setOpenCreate(true)} className="inline-flex items-center gap-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 text-sm font-medium">
            <Plus className="w-4 h-4" /> Nueva cola
          </button>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Nombre</th>
                <th className="text-left px-4 py-3 font-medium">Estrategia</th>
                <th className="text-left px-4 py-3 font-medium">Espera máx.</th>
                <th className="text-left px-4 py-3 font-medium">Estado</th>
                <th className="text-right px-4 py-3 font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">Cargando…</td></tr>}
              {error && <tr><td colSpan={5} className="px-4 py-8 text-center text-rose-600">{error}</td></tr>}
              {!loading && !error && items.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-12 text-center text-slate-500"><ListTree className="w-8 h-8 mx-auto mb-2 text-slate-300" />No hay colas todavía.</td></tr>
              )}
              {items.map(q => (
                <tr key={q.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">{q.name}</td>
                  <td className="px-4 py-3 text-slate-700"><code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs">{q.strategy}</code></td>
                  <td className="px-4 py-3 text-slate-700">{q.max_wait_seconds}s</td>
                  <td className="px-4 py-3"><span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${q.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700'}`}>{q.is_active ? 'activa' : 'inactiva'}</span></td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex gap-1">
                      <button onClick={() => setEditing(q)}
                        title="Editar"
                        className="p-1.5 rounded text-slate-500 hover:bg-slate-100 hover:text-slate-900">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={() => setConfirmDel(q)}
                        title="Eliminar"
                        className="p-1.5 rounded text-slate-400 hover:bg-rose-50 hover:text-rose-600">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {openCreate && <QueueFormModal onClose={() => setOpenCreate(false)} onSaved={reload} />}
      {editing && <QueueFormModal initial={editing} onClose={() => setEditing(null)} onSaved={reload} />}
      <ConfirmDialog
        open={confirmDel !== null}
        title="Eliminar cola"
        message={confirmDel && (
          <>Vas a eliminar <strong>"{confirmDel.name}"</strong>. Si está en uso por un IVR, ese IVR perderá su destino.</>
        )}
        variant="danger"
        icon={DialogIcons.Trash}
        confirmText="Sí, eliminar"
        onConfirm={executeDelete}
        onCancel={() => !deleting && setConfirmDel(null)}
        loading={deleting}
      />
      <Toast open={toast !== null} message={toast?.msg ?? ''} variant={toast?.variant ?? 'info'} onClose={() => setToast(null)} />
    </AppShell>
  );
}
