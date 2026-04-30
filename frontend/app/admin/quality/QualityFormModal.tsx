'use client';

import { FormEvent, useState } from 'react';
import { api } from '@/lib/api/client';
import { X, Plus, Trash2 } from 'lucide-react';

interface Props { onClose: () => void; onSaved: () => void; }

interface Criterion {
  key: string;
  label: string;
  weight: number;
  max_score: number;
}

const DEFAULT_CRITERIA: Criterion[] = [
  { key: 'saludo', label: 'Saludo y presentación', weight: 1, max_score: 10 },
  { key: 'identificacion', label: 'Identificación del cliente', weight: 1, max_score: 10 },
  { key: 'amabilidad', label: 'Amabilidad y empatía', weight: 2, max_score: 10 },
  { key: 'resolucion', label: 'Resolución del problema', weight: 3, max_score: 10 },
  { key: 'cierre', label: 'Cierre apropiado', weight: 1, max_score: 10 },
];

export function QualityFormModal({ onClose, onSaved }: Props) {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [maxScore, setMaxScore] = useState(100);
  const [criteria, setCriteria] = useState<Criterion[]>(DEFAULT_CRITERIA);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function addCriterion() {
    setCriteria([...criteria, { key: `criterio_${criteria.length + 1}`, label: '', weight: 1, max_score: 10 }]);
  }

  function removeCriterion(i: number) {
    setCriteria(criteria.filter((_, idx) => idx !== i));
  }

  function updateCriterion(i: number, key: keyof Criterion, val: any) {
    setCriteria(criteria.map((c, idx) => idx === i ? { ...c, [key]: val } : c));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name) return setError('Nombre requerido');
    if (!slug) return setError('Slug requerido');
    if (criteria.length === 0) return setError('Agrega al menos un criterio');
    if (criteria.some(c => !c.key || !c.label)) return setError('Todos los criterios necesitan key y etiqueta');

    setSubmitting(true);
    try {
      await api.post('/quality/forms', {
        slug, name, description: description || undefined,
        schema: { criteria },
        max_score: maxScore,
      });
      onSaved();
      onClose();
    } catch (e: any) {
      const msg = e?.response?.data?.error?.message ?? 'Error al crear formulario';
      setError(Array.isArray(msg) ? msg.join(', ') : String(msg));
    } finally {
      setSubmitting(false);
    }
  }

  const totalWeight = criteria.reduce((s, c) => s + (c.weight || 0) * (c.max_score || 0), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 sticky top-0 bg-white">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Nuevo formulario de calidad</h3>
            <p className="text-xs text-slate-500 mt-0.5">Define criterios con peso para evaluar llamadas.</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
          {error && <div className="rounded-lg bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-700">{error}</div>}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Nombre <span className="text-rose-500">*</span></label>
              <input type="text" value={name} onChange={e => { setName(e.target.value); if (!slug) setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-')); }} required
                placeholder="Auditoría llamadas Tier 1"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Slug <span className="text-rose-500">*</span></label>
              <input type="text" value={slug} onChange={e => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))} required
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Descripción</label>
            <input type="text" value={description} onChange={e => setDescription(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-slate-700">Criterios de evaluación</label>
              <button type="button" onClick={addCriterion} className="text-xs text-brand-600 hover:text-brand-700 font-medium inline-flex items-center gap-1">
                <Plus className="w-3 h-3" /> Agregar criterio
              </button>
            </div>
            <div className="space-y-2">
              {criteria.map((c, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-end p-3 border border-slate-200 rounded-lg">
                  <div className="col-span-3">
                    <label className="block text-xs font-medium text-slate-500 mb-1">Key</label>
                    <input type="text" value={c.key} onChange={e => updateCriterion(i, 'key', e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                      className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs font-mono" />
                  </div>
                  <div className="col-span-5">
                    <label className="block text-xs font-medium text-slate-500 mb-1">Etiqueta</label>
                    <input type="text" value={c.label} onChange={e => updateCriterion(i, 'label', e.target.value)}
                      placeholder="Saludo correcto"
                      className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs" />
                  </div>
                  <div className="col-span-1">
                    <label className="block text-xs font-medium text-slate-500 mb-1">Peso</label>
                    <input type="number" value={c.weight} onChange={e => updateCriterion(i, 'weight', parseFloat(e.target.value))} min={0} step="0.5"
                      className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs text-center" />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-slate-500 mb-1">Max score</label>
                    <input type="number" value={c.max_score} onChange={e => updateCriterion(i, 'max_score', parseInt(e.target.value, 10))} min={1}
                      className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs text-center" />
                  </div>
                  <div className="col-span-1">
                    <button type="button" onClick={() => removeCriterion(i)} className="w-full p-1.5 text-rose-500 hover:bg-rose-50 rounded">
                      <Trash2 className="w-3 h-3 mx-auto" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Puntaje máximo del formulario</label>
              <input type="number" value={maxScore} onChange={e => setMaxScore(parseInt(e.target.value, 10))} min={1}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
              <p className="text-xs text-slate-500 mt-1">Los puntajes se normalizan a este valor.</p>
            </div>
            <div className="flex items-end">
              <div className="text-xs text-slate-500">
                <strong>Suma máx. ponderada actual:</strong> {totalWeight.toFixed(1)}
              </div>
            </div>
          </div>
        </form>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-200 bg-slate-50 sticky bottom-0">
          <button type="button" onClick={onClose} disabled={submitting} className="px-4 py-2 text-sm font-medium text-slate-700 disabled:opacity-50">Cancelar</button>
          <button type="button" onClick={handleSubmit as any} disabled={submitting} className="px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-sm font-medium">
            {submitting ? 'Creando…' : 'Crear formulario'}
          </button>
        </div>
      </div>
    </div>
  );
}
