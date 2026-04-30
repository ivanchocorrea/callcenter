'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/shared/AppShell';
import { api } from '@/lib/api/client';
import { ArrowLeft, Save, Plus, Trash2, Mic } from 'lucide-react';
import Link from 'next/link';

interface Option {
  dtmf_key: string;
  label: string;
  destination_type: 'queue' | 'agent' | 'bot' | 'ivr' | 'voicemail' | 'webhook' | 'hangup' | 'tool' | 'external';
  destination_id?: number;
  destination_value?: string;
}

export default function NewIvrPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [timeoutSeconds, setTimeoutSeconds] = useState(5);
  const [maxAttempts, setMaxAttempts] = useState(3);
  const [options, setOptions] = useState<Option[]>([
    { dtmf_key: '1', label: 'Soporte', destination_type: 'queue' },
    { dtmf_key: '2', label: 'Ventas', destination_type: 'queue' },
    { dtmf_key: '0', label: 'Operadora', destination_type: 'agent' },
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function addOption() {
    setOptions([...options, { dtmf_key: String(options.length + 1), label: '', destination_type: 'queue' }]);
  }

  function removeOption(idx: number) {
    setOptions(options.filter((_, i) => i !== idx));
  }

  function updateOption(idx: number, key: keyof Option, value: any) {
    setOptions(options.map((o, i) => i === idx ? { ...o, [key]: value } : o));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name) return setError('Nombre requerido');
    if (!slug) return setError('Slug requerido');

    setSubmitting(true);
    try {
      await api.post('/ivr', {
        slug, name,
        description: description || undefined,
        timeout_seconds: timeoutSeconds,
        max_attempts: maxAttempts,
        options: options
          .filter(o => o.dtmf_key)
          .map(o => ({
            dtmf_key: o.dtmf_key,
            label: o.label || undefined,
            destination_type: o.destination_type,
            destination_id: o.destination_id || undefined,
            destination_value: o.destination_value || undefined,
          })),
      });
      router.push('/admin/ivr');
    } catch (e: any) {
      const msg = e?.response?.data?.error?.message ?? 'Error al crear IVR';
      setError(Array.isArray(msg) ? msg.join(', ') : String(msg));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppShell>
      <div className="space-y-4 max-w-4xl">
        <Link href="/admin/ivr" className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900">
          <ArrowLeft className="w-4 h-4" /> Volver a IVR
        </Link>
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Nuevo menú IVR</h2>
          <p className="text-slate-500 mt-1">Define un menú de respuesta de voz para enrutar llamadas entrantes.</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-5">
          {error && <div className="rounded-lg bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-700">{error}</div>}

          <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
            <h3 className="font-semibold text-slate-900 flex items-center gap-2"><Mic className="w-5 h-5 text-brand-600" /> Información general</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nombre <span className="text-rose-500">*</span></label>
                <input type="text" value={name} onChange={e => { setName(e.target.value); if (!slug) setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-')); }} required
                  placeholder="Menú principal"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Slug <span className="text-rose-500">*</span></label>
                <input type="text" value={slug} onChange={e => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))} required
                  placeholder="menu-principal"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Descripción</label>
              <input type="text" value={description} onChange={e => setDescription(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Timeout (segundos)</label>
                <input type="number" value={timeoutSeconds} onChange={e => setTimeoutSeconds(parseInt(e.target.value, 10))} min={3} max={30}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                <p className="text-xs text-slate-500 mt-1">Tiempo de espera por opción del cliente.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Intentos máximos</label>
                <input type="number" value={maxAttempts} onChange={e => setMaxAttempts(parseInt(e.target.value, 10))} min={1} max={10}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-900">Opciones del menú</h3>
              <button type="button" onClick={addOption} className="inline-flex items-center gap-1 text-sm text-brand-600 hover:text-brand-700 font-medium">
                <Plus className="w-4 h-4" /> Agregar opción
              </button>
            </div>
            {options.map((opt, idx) => (
              <div key={idx} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end p-3 border border-slate-200 rounded-lg">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-500 mb-1">Tecla</label>
                  <input type="text" value={opt.dtmf_key} onChange={e => updateOption(idx, 'dtmf_key', e.target.value)} maxLength={4}
                    className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm font-mono text-center" />
                </div>
                <div className="sm:col-span-4">
                  <label className="block text-xs font-medium text-slate-500 mb-1">Etiqueta</label>
                  <input type="text" value={opt.label} onChange={e => updateOption(idx, 'label', e.target.value)}
                    placeholder="Soporte"
                    className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm" />
                </div>
                <div className="sm:col-span-3">
                  <label className="block text-xs font-medium text-slate-500 mb-1">Destino</label>
                  <select value={opt.destination_type} onChange={e => updateOption(idx, 'destination_type', e.target.value as any)}
                    className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm">
                    <option value="queue">→ Cola</option>
                    <option value="agent">→ Agente</option>
                    <option value="bot">→ Bot IA</option>
                    <option value="ivr">→ Otro IVR</option>
                    <option value="voicemail">→ Buzón</option>
                    <option value="webhook">→ Webhook</option>
                    <option value="external">→ Número ext.</option>
                    <option value="hangup">→ Colgar</option>
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-500 mb-1">ID/Valor</label>
                  <input type="text" value={opt.destination_id ?? opt.destination_value ?? ''} onChange={e => {
                    const v = e.target.value;
                    if (/^\d+$/.test(v)) updateOption(idx, 'destination_id', parseInt(v, 10));
                    else updateOption(idx, 'destination_value', v);
                  }}
                    placeholder="ID"
                    className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm" />
                </div>
                <div className="sm:col-span-1">
                  <button type="button" onClick={() => removeOption(idx)} className="w-full p-1.5 text-rose-500 hover:bg-rose-50 rounded">
                    <Trash2 className="w-4 h-4 mx-auto" />
                  </button>
                </div>
              </div>
            ))}
            <p className="text-xs text-slate-500">⚠️ Los IDs se obtienen creando antes las colas, agentes, bots, etc. Puedes dejarlos vacíos y editarlos después.</p>
          </div>

          <div className="flex items-center justify-end gap-2">
            <Link href="/admin/ivr" className="px-4 py-2 text-sm font-medium text-slate-700">Cancelar</Link>
            <button type="submit" disabled={submitting} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-sm font-medium">
              <Save className="w-4 h-4" /> {submitting ? 'Guardando…' : 'Guardar IVR'}
            </button>
          </div>
        </form>
      </div>
    </AppShell>
  );
}
