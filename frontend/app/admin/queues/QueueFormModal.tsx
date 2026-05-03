'use client';

import { FormEvent, useState } from 'react';
import { api } from '@/lib/api/client';
import { X } from 'lucide-react';

export interface QueueFormInitial {
  id: number;
  name: string;
  slug?: string;
  strategy: string;
  max_wait_seconds: number;
  music_on_hold?: string;
  is_active?: boolean;
}

interface Props {
  onClose: () => void;
  onSaved: () => void;
  /** Si se pasa, el modal entra en modo EDIT (hace PATCH /queues/:id). */
  initial?: QueueFormInitial;
}

export function QueueFormModal({ onClose, onSaved, initial }: Props) {
  const isEdit = !!initial;
  const [name, setName] = useState(initial?.name ?? '');
  const [slug, setSlug] = useState(initial?.slug ?? '');
  const [strategy, setStrategy] = useState(initial?.strategy ?? 'rrmemory');
  const [maxWait, setMaxWait] = useState(initial?.max_wait_seconds ?? 300);
  const [musicOnHold, setMusicOnHold] = useState(initial?.music_on_hold ?? 'default');
  const [isActive, setIsActive] = useState(initial?.is_active ?? true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name) return setError('Nombre requerido');
    if (!isEdit && !slug) return setError('Slug requerido');

    setSubmitting(true);
    try {
      const payload = {
        name,
        strategy,
        max_wait_seconds: maxWait,
        music_on_hold: musicOnHold,
        is_active: isActive,
        ...(isEdit ? {} : { slug }),  // slug solo en create (es immutable)
      };
      if (isEdit) {
        await api.patch(`/queues/${initial!.id}`, payload);
      } else {
        await api.post('/queues', payload);
      }
      onSaved();
      onClose();
    } catch (e: any) {
      const msg = e?.response?.data?.error?.message ?? `Error al ${isEdit ? 'actualizar' : 'crear'} cola`;
      setError(Array.isArray(msg) ? msg.join(', ') : String(msg));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h3 className="text-lg font-semibold text-slate-900">{isEdit ? 'Editar cola' : 'Nueva cola'}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {error && <div className="rounded-lg bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-700">{error}</div>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Nombre <span className="text-rose-500">*</span></label>
              <input type="text" value={name} onChange={e => { setName(e.target.value); if (!isEdit && !slug) setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-')); }} required
                placeholder="Ej. Soporte"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Slug {!isEdit && <span className="text-rose-500">*</span>}</label>
              <input type="text" value={slug} onChange={e => setSlug(e.target.value)} required={!isEdit} disabled={isEdit}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono disabled:bg-slate-50 disabled:text-slate-400" />
              {isEdit && <p className="text-xs text-slate-400 mt-1">El slug no se puede modificar.</p>}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Estrategia de distribución</label>
            <select value={strategy} onChange={e => setStrategy(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
              <option value="rrmemory">Round-robin con memoria</option>
              <option value="leastrecent">El menos reciente</option>
              <option value="fewestcalls">Menos llamadas</option>
              <option value="random">Aleatorio</option>
              <option value="ringall">Ring all</option>
            </select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Espera máxima (segundos)</label>
              <input type="number" value={maxWait} onChange={e => setMaxWait(parseInt(e.target.value, 10))} min={30}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Música en espera</label>
              <input type="text" value={musicOnHold} onChange={e => setMusicOnHold(e.target.value)}
                placeholder="default"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
            </div>
          </div>
          {isEdit && (
            <div className="flex items-center gap-2">
              <input type="checkbox" id="isActive" checked={isActive} onChange={e => setIsActive(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300" />
              <label htmlFor="isActive" className="text-sm text-slate-700">Cola activa</label>
            </div>
          )}
        </form>
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-200 bg-slate-50">
          <button type="button" onClick={onClose} disabled={submitting} className="px-4 py-2 text-sm font-medium text-slate-700 disabled:opacity-50">Cancelar</button>
          <button type="button" onClick={handleSubmit as any} disabled={submitting} className="px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-sm font-medium">
            {submitting ? (isEdit ? 'Guardando…' : 'Creando…') : (isEdit ? 'Guardar cambios' : 'Crear cola')}
          </button>
        </div>
      </div>
    </div>
  );
}
