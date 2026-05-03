'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AppShell } from '@/components/shared/AppShell';
import { api, unwrap } from '@/lib/api/client';
import { ArrowLeft, Save, Plus, Trash2, Mic, Volume2, Power } from 'lucide-react';
import Link from 'next/link';
import { ConfirmDialog, Toast, DialogIcons } from '@/components/shared/Dialog';

interface Option {
  id?: number;
  dtmf_key: string;
  label: string;
  destination_type: 'queue' | 'agent' | 'bot' | 'ivr' | 'voicemail' | 'webhook' | 'hangup' | 'tool' | 'external';
  destination_id?: number | null;
  destination_value?: string | null;
}

interface IvrAudio {
  id: number;
  name: string;
  purpose: string;
  duration_seconds?: number | null;
  durationSeconds?: number | null;
}

export default function EditIvrPage() {
  const params = useParams();
  const router = useRouter();
  const id = Number(params?.id);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [timeoutSeconds, setTimeoutSeconds] = useState(5);
  const [maxAttempts, setMaxAttempts] = useState(3);
  const [isActive, setIsActive] = useState(true);
  const [welcomeAudioId, setWelcomeAudioId] = useState<number | ''>('');
  const [invalidAudioId, setInvalidAudioId] = useState<number | ''>('');
  const [timeoutAudioId, setTimeoutAudioId] = useState<number | ''>('');
  const [options, setOptions] = useState<Option[]>([]);
  const [audios, setAudios] = useState<IvrAudio[]>([]);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState<{ msg: string; variant: 'success' | 'danger' | 'info' } | null>(null);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      api.get(`/ivr/${id}`).then(r => unwrap<any>(r)),
      api.get('/ivr/audios/list').then(r => unwrap<any[]>(r)).catch(() => []),
    ])
      .then(([ivr, auds]) => {
        setName(ivr.name ?? '');
        setSlug(ivr.slug ?? '');
        setDescription(ivr.description ?? '');
        setTimeoutSeconds(ivr.timeoutSeconds ?? ivr.timeout_seconds ?? 5);
        setMaxAttempts(ivr.maxAttempts ?? ivr.max_attempts ?? 3);
        setIsActive(ivr.isActive ?? ivr.is_active ?? true);
        setWelcomeAudioId(ivr.welcomeAudioId ?? ivr.welcome_audio_id ?? '');
        setInvalidAudioId(ivr.invalidAudioId ?? ivr.invalid_audio_id ?? '');
        setTimeoutAudioId(ivr.timeoutAudioId ?? ivr.timeout_audio_id ?? '');
        setOptions((ivr.options ?? []).map((o: any) => ({
          id: o.id,
          dtmf_key: o.dtmfKey ?? o.dtmf_key ?? '',
          label: o.label ?? '',
          destination_type: o.destinationType ?? o.destination_type ?? 'queue',
          destination_id: o.destinationId ?? o.destination_id ?? null,
          destination_value: o.destinationValue ?? o.destination_value ?? null,
        })));
        setAudios(auds);
      })
      .catch(e => setError(e?.response?.data?.error?.message ?? 'No se pudo cargar el IVR'))
      .finally(() => setLoading(false));
  }, [id]);

  function addOption() {
    setOptions([...options, { dtmf_key: String(options.length + 1), label: '', destination_type: 'queue' }]);
  }
  function removeOption(idx: number) { setOptions(options.filter((_, i) => i !== idx)); }
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
      await api.patch(`/ivr/${id}`, {
        slug, name,
        description: description || undefined,
        timeout_seconds: timeoutSeconds,
        max_attempts: maxAttempts,
        is_active: isActive,
        welcome_audio_id: welcomeAudioId || null,
        invalid_audio_id: invalidAudioId || null,
        timeout_audio_id: timeoutAudioId || null,
        options: options.filter(o => o.dtmf_key).map(o => ({
          dtmf_key: o.dtmf_key,
          label: o.label || undefined,
          destination_type: o.destination_type,
          destination_id: o.destination_id || undefined,
          destination_value: o.destination_value || undefined,
        })),
      });
      setToast({ msg: 'IVR guardado', variant: 'success' });
      setTimeout(() => router.push('/admin/ivr'), 1000);
    } catch (e: any) {
      const msg = e?.response?.data?.error?.message ?? 'Error al guardar';
      setError(Array.isArray(msg) ? msg.join(', ') : String(msg));
    } finally { setSubmitting(false); }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await api.delete(`/ivr/${id}`);
      setToast({ msg: 'IVR eliminado', variant: 'success' });
      setTimeout(() => router.push('/admin/ivr'), 800);
    } catch (e: any) {
      setToast({ msg: e?.response?.data?.error?.message ?? 'Error al eliminar', variant: 'danger' });
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  if (loading) return <AppShell><div className="p-8 text-center text-slate-500">Cargando IVR…</div></AppShell>;

  return (
    <AppShell>
      <div className="space-y-4 max-w-4xl">
        <Link href="/admin/ivr" className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900">
          <ArrowLeft className="w-4 h-4" /> Volver a IVR
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-slate-900">Editar IVR</h2>
            <p className="text-slate-500 mt-1">Modifica un menú de respuesta de voz existente.</p>
          </div>
          <button
            onClick={() => setConfirmDelete(true)}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 text-sm font-medium border border-rose-200"
          >
            <Trash2 className="w-4 h-4" /> Eliminar IVR
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-5">
          {error && <div className="rounded-lg bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-700">{error}</div>}

          <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
            <h3 className="font-semibold text-slate-900 flex items-center gap-2"><Mic className="w-5 h-5 text-brand-600" /> Información general</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nombre <span className="text-rose-500">*</span></label>
                <input type="text" value={name} onChange={e => setName(e.target.value)} required
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
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Timeout (segundos)</label>
                <input type="number" value={timeoutSeconds} onChange={e => setTimeoutSeconds(parseInt(e.target.value, 10))} min={3} max={30}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Intentos máximos</label>
                <input type="number" value={maxAttempts} onChange={e => setMaxAttempts(parseInt(e.target.value, 10))} min={1} max={10}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Estado</label>
                <button type="button" onClick={() => setIsActive(!isActive)}
                  className={`w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border ${isActive ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                  <Power className="w-4 h-4" /> {isActive ? 'Activo' : 'Inactivo'}
                </button>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
            <h3 className="font-semibold text-slate-900 flex items-center gap-2"><Volume2 className="w-5 h-5 text-brand-600" /> Audios del menú</h3>
            <p className="text-xs text-slate-500">Subí audios en <Link href="/admin/ivr/audios" className="text-brand-600 hover:underline">/admin/ivr/audios</Link>. Acá los asignás al IVR.</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <AudioSelect label="Bienvenida" value={welcomeAudioId} onChange={setWelcomeAudioId} audios={audios} filterPurpose="welcome" />
              <AudioSelect label="Opción inválida" value={invalidAudioId} onChange={setInvalidAudioId} audios={audios} filterPurpose="invalid_option" />
              <AudioSelect label="Timeout" value={timeoutAudioId} onChange={setTimeoutAudioId} audios={audios} filterPurpose="timeout" />
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-900">Opciones del menú</h3>
              <button type="button" onClick={addOption} className="inline-flex items-center gap-1 text-sm text-brand-600 hover:text-brand-700 font-medium">
                <Plus className="w-4 h-4" /> Agregar opción
              </button>
            </div>
            {options.length === 0 && <p className="text-sm text-slate-500 text-center py-4">Sin opciones todavía.</p>}
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
                    if (/^\d+$/.test(v)) { updateOption(idx, 'destination_id', parseInt(v, 10)); updateOption(idx, 'destination_value', null); }
                    else { updateOption(idx, 'destination_value', v); updateOption(idx, 'destination_id', null); }
                  }}
                    className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm" />
                </div>
                <div className="sm:col-span-1">
                  <button type="button" onClick={() => removeOption(idx)} className="w-full p-1.5 text-rose-500 hover:bg-rose-50 rounded">
                    <Trash2 className="w-4 h-4 mx-auto" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-end gap-2">
            <Link href="/admin/ivr" className="px-4 py-2 text-sm font-medium text-slate-700">Cancelar</Link>
            <button type="submit" disabled={submitting} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-sm font-medium">
              <Save className="w-4 h-4" /> {submitting ? 'Guardando…' : 'Guardar cambios'}
            </button>
          </div>
        </form>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="Eliminar IVR"
        message={<>¿Seguro que querés eliminar el IVR <strong>"{name}"</strong>? Esta acción es irreversible.</>}
        variant="danger"
        icon={DialogIcons.Trash}
        confirmText="Sí, eliminar"
        onConfirm={handleDelete}
        onCancel={() => !deleting && setConfirmDelete(false)}
        loading={deleting}
      />
      <Toast open={toast !== null} message={toast?.msg ?? ''} variant={toast?.variant ?? 'info'} onClose={() => setToast(null)} />
    </AppShell>
  );
}

function AudioSelect({ label, value, onChange, audios, filterPurpose }: {
  label: string;
  value: number | '';
  onChange: (v: number | '') => void;
  audios: IvrAudio[];
  filterPurpose?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      <select value={value} onChange={e => onChange(e.target.value ? Number(e.target.value) : '')}
        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white">
        <option value="">— Sin audio —</option>
        {audios.map(a => (
          <option key={a.id} value={a.id}>{a.name} {filterPurpose && a.purpose === filterPurpose ? '★' : ''}</option>
        ))}
      </select>
    </div>
  );
}
