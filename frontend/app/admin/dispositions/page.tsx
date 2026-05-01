'use client';

import { FormEvent, useEffect, useState } from 'react';
import { AppShell } from '@/components/shared/AppShell';
import { api, unwrap } from '@/lib/api/client';
import { Plus, Tag, Trash2 } from 'lucide-react';
import { confirmAsync, toastShow } from '@/lib/ui/dialog-helper';

interface Disposition {
  id: number;
  slug: string;
  label: string;
  parent_id: number | null;
  is_positive: boolean;
  is_callback: boolean;
  is_terminal: boolean;
  color: string | null;
}

export default function DispositionsPage() {
  const [items, setItems] = useState<Disposition[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  function reload() {
    setLoading(true);
    api.get('/dispositions')
      .then(r => setItems(unwrap<Disposition[]>(r)))
      .finally(() => setLoading(false));
  }
  useEffect(() => { reload(); }, []);

  async function deleteItem(id: number, label: string) {
    const ok = await confirmAsync({
      title: 'Eliminar tipificación',
      message: <>Vas a eliminar <strong>"{label}"</strong>. Las llamadas anteriores con esta tipificación se conservan.</>,
      variant: 'danger',
      confirmText: 'Sí, eliminar',
    });
    if (!ok) return;
    try {
      await api.delete(`/dispositions/${id}`);
      toastShow(`Tipificación "${label}" eliminada`, 'success');
      reload();
    } catch (e: any) {
      toastShow(e?.response?.data?.error?.message ?? 'Error al eliminar', 'danger');
      return;
    }
    return;
  }

  return (
    <AppShell>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-slate-900">Tipificaciones de llamada</h2>
            <p className="text-slate-500 mt-1">Códigos que el agente asigna al cerrar cada llamada (ventas, no contactó, callback, etc.).</p>
          </div>
          <button onClick={() => setOpen(true)} className="inline-flex items-center gap-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 text-sm font-medium">
            <Plus className="w-4 h-4" /> Nueva tipificación
          </button>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Etiqueta</th>
                <th className="text-left px-4 py-3 font-medium">Slug</th>
                <th className="text-left px-4 py-3 font-medium">Tipo</th>
                <th className="text-left px-4 py-3 font-medium">Padre</th>
                <th></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">Cargando…</td></tr>}
              {!loading && items.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-12 text-center text-slate-500">
                  <Tag className="w-8 h-8 mx-auto mb-2 text-slate-300" />Sin tipificaciones todavía.
                </td></tr>
              )}
              {items.map(d => (
                <tr key={d.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {d.color && <div className="w-3 h-3 rounded" style={{ backgroundColor: d.color }} />}
                      <span className="font-medium text-slate-900">{d.label}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3"><code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs">{d.slug}</code></td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {d.is_positive && <span className="text-xs px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700">✓ Positivo</span>}
                      {d.is_callback && <span className="text-xs px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">📞 Callback</span>}
                      {d.is_terminal && <span className="text-xs px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-700">🏁 Terminal</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">{d.parent_id ? `#${d.parent_id}` : '—'}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => deleteItem(d.id, d.label)} className="text-slate-400 hover:text-rose-600">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {open && <DispositionModal items={items} onClose={() => setOpen(false)} onSaved={reload} />}
    </AppShell>
  );
}

function DispositionModal({ items, onClose, onSaved }: { items: Disposition[]; onClose: () => void; onSaved: () => void }) {
  const [label, setLabel] = useState('');
  const [slug, setSlug] = useState('');
  const [parentId, setParentId] = useState('');
  const [isPositive, setIsPositive] = useState(false);
  const [isCallback, setIsCallback] = useState(false);
  const [isTerminal, setIsTerminal] = useState(true);
  const [color, setColor] = useState('#10b981');
  const [submitting, setSubmitting] = useState(false);

  async function save(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post('/dispositions', {
        slug, label,
        parent_id: parentId ? parseInt(parentId, 10) : null,
        is_positive: isPositive, is_callback: isCallback, is_terminal: isTerminal, color,
      });
      onSaved(); onClose();
    } finally { setSubmitting(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h3 className="text-lg font-semibold">Nueva tipificación</h3>
          <button onClick={onClose}>✕</button>
        </div>
        <form onSubmit={save} className="px-6 py-5 space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">Etiqueta</label>
            <input value={label} onChange={e => { setLabel(e.target.value); if (!slug) setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '_')); }}
              required placeholder="Ej. Venta cerrada" className="w-full px-3 py-2 border rounded text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Slug</label>
            <input value={slug} onChange={e => setSlug(e.target.value)} required placeholder="venta_cerrada"
              className="w-full px-3 py-2 border rounded text-sm font-mono" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Padre (opcional, jerárquica)</label>
            <select value={parentId} onChange={e => setParentId(e.target.value)} className="w-full px-3 py-2 border rounded text-sm">
              <option value="">— Categoría raíz —</option>
              {items.filter(i => !i.parent_id).map(i => <option key={i.id} value={i.id}>{i.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Color</label>
            <input type="color" value={color} onChange={e => setColor(e.target.value)} className="w-full h-10 rounded border" />
          </div>
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={isPositive} onChange={e => setIsPositive(e.target.checked)} />
              ✓ Resultado positivo (venta, conversión)
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={isCallback} onChange={e => setIsCallback(e.target.checked)} />
              📞 Genera callback (volver a llamar)
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={isTerminal} onChange={e => setIsTerminal(e.target.checked)} />
              🏁 Terminal (cierra el caso, no se reintenta)
            </label>
          </div>
        </form>
        <div className="flex justify-end gap-2 px-6 py-4 border-t bg-slate-50">
          <button onClick={onClose} className="px-4 py-2 text-sm">Cancelar</button>
          <button onClick={save as any} disabled={submitting} className="px-4 py-2 rounded bg-brand-600 text-white text-sm disabled:opacity-50">
            {submitting ? 'Guardando…' : 'Crear'}
          </button>
        </div>
      </div>
    </div>
  );
}
