'use client';

import { FormEvent, useEffect, useState } from 'react';
import { api, unwrap } from '@/lib/api/client';
import { X, AlertCircle } from 'lucide-react';

interface Props { onClose: () => void; onSaved: () => void; }

interface Queue { id: number; name: string; }
interface Trunk { id: number; name: string; }

export function CampaignFormModal({ onClose, onSaved }: Props) {
  const [queues, setQueues] = useState<Queue[]>([]);
  const [trunks, setTrunks] = useState<Trunk[]>([]);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [campaignType, setCampaignType] = useState<'manual'|'preview'|'progressive'|'predictive'>('progressive');
  const [callerId, setCallerId] = useState('');
  const [queueId, setQueueId] = useState('');
  const [trunkId, setTrunkId] = useState('');
  const [maxAttempts, setMaxAttempts] = useState(3);
  const [retryDelay, setRetryDelay] = useState(3600);
  const [pacingRatio, setPacingRatio] = useState(1.5);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api.get('/queues').then(r => unwrap<Queue[]>(r)).catch(() => []),
      api.get('/sip-trunks').then(r => unwrap<Trunk[]>(r)).catch(() => []),
    ]).then(([qs, ts]) => { setQueues(qs); setTrunks(ts); });
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name) return setError('Nombre requerido');
    if (!slug) return setError('Slug requerido');
    if (!callerId) return setError('Caller ID requerido (el número que verán los clientes)');

    setSubmitting(true);
    try {
      await api.post('/campaigns', {
        slug, name,
        campaign_type: campaignType,
        caller_id: callerId,
        queue_id: queueId ? parseInt(queueId, 10) : undefined,
        trunk_id: trunkId ? parseInt(trunkId, 10) : undefined,
        max_attempts: maxAttempts,
        retry_delay_seconds: retryDelay,
        pacing_ratio: pacingRatio,
        status: 'draft',
      });
      onSaved();
      onClose();
    } catch (e: any) {
      const msg = e?.response?.data?.error?.message ?? 'Error al crear campaña';
      setError(Array.isArray(msg) ? msg.join(', ') : String(msg));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 sticky top-0 bg-white">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Nueva campaña outbound</h3>
            <p className="text-xs text-slate-500 mt-0.5">Llamadas masivas salientes con dialer.</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {error && <div className="rounded-lg bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-700">{error}</div>}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Nombre <span className="text-rose-500">*</span></label>
              <input type="text" value={name} onChange={e => { setName(e.target.value); if (!slug) setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-')); }} required
                placeholder="Promo Q1 2026"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Slug <span className="text-rose-500">*</span></label>
              <input type="text" value={slug} onChange={e => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))} required
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Tipo de dialer <span className="text-rose-500">*</span></label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {[
                { v: 'manual', l: 'Manual', d: 'El agente marca uno por uno' },
                { v: 'preview', l: 'Preview', d: 'Muestra contacto, agente decide marcar' },
                { v: 'progressive', l: 'Progressive', d: 'Marca cuando hay agente disponible (1:1)' },
                { v: 'predictive', l: 'Predictive', d: 'Marca varias en paralelo según AHT' },
              ].map(t => (
                <label key={t.v} className={`flex items-start gap-2 px-3 py-2 border rounded-lg cursor-pointer ${campaignType === t.v ? 'border-brand-500 bg-brand-50' : 'border-slate-200 hover:bg-slate-50'}`}>
                  <input type="radio" name="campaign_type" value={t.v} checked={campaignType === t.v} onChange={() => setCampaignType(t.v as any)} className="mt-1" />
                  <div className="text-sm">
                    <div className="font-medium text-slate-900">{t.l}</div>
                    <p className="text-xs text-slate-500">{t.d}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Caller ID <span className="text-rose-500">*</span></label>
            <input type="tel" value={callerId} onChange={e => setCallerId(e.target.value)} required
              placeholder="+57 1 555 0100"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono" />
            <p className="text-xs text-slate-500 mt-1">Número que verán los clientes al recibir tu llamada.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Cola asignada</label>
              <select value={queueId} onChange={e => setQueueId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
                <option value="">— Sin cola —</option>
                {queues.map(q => <option key={q.id} value={q.id}>{q.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Troncal SIP saliente</label>
              <select value={trunkId} onChange={e => setTrunkId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
                <option value="">— Por defecto —</option>
                {trunks.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Intentos máx.</label>
              <input type="number" value={maxAttempts} onChange={e => setMaxAttempts(parseInt(e.target.value, 10))} min={1} max={10}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Reintento (seg)</label>
              <input type="number" value={retryDelay} onChange={e => setRetryDelay(parseInt(e.target.value, 10))} min={60}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Pacing ratio</label>
              <input type="number" value={pacingRatio} onChange={e => setPacingRatio(parseFloat(e.target.value))} step="0.1" min={1} max={5}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
              <p className="text-xs text-slate-500 mt-1">Solo predictive: cuántas marca por agente</p>
            </div>
          </div>

          <div className="rounded-lg bg-blue-50 border border-blue-200 px-4 py-3 text-sm text-blue-800 flex gap-2">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <div>Después de crear la campaña, podrás cargar contactos por CSV y activarla con el botón "Iniciar".</div>
          </div>
        </form>
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-200 bg-slate-50 sticky bottom-0">
          <button type="button" onClick={onClose} disabled={submitting} className="px-4 py-2 text-sm font-medium text-slate-700 disabled:opacity-50">Cancelar</button>
          <button type="button" onClick={handleSubmit as any} disabled={submitting} className="px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-sm font-medium">
            {submitting ? 'Creando…' : 'Crear campaña'}
          </button>
        </div>
      </div>
    </div>
  );
}
