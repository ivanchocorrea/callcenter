'use client';

import { FormEvent, useState } from 'react';
import { api } from '@/lib/api/client';
import { X } from 'lucide-react';

interface Props { onClose: () => void; onSaved: () => void; }

const ALL_EVENTS = [
  'call.incoming', 'call.answered', 'call.ended',
  'agent.status_changed',
  'queue.position_changed',
  'sms.received',
  'recording.created',
  'webhook.test',
];

export function WebhookFormModal({ onClose, onSaved }: Props) {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [secret, setSecret] = useState(generateSecret());
  const [events, setEvents] = useState<string[]>(['call.ended']);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function generateSecret() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    let s = '';
    for (let i = 0; i < 32; i++) s += chars[Math.floor(Math.random() * chars.length)];
    return s;
  }

  function toggleEvent(ev: string) {
    setEvents(prev => prev.includes(ev) ? prev.filter(e => e !== ev) : [...prev, ev]);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name) return setError('Nombre requerido');
    if (!url || !url.startsWith('http')) return setError('URL inválida (debe empezar con http:// o https://)');
    if (!secret || secret.length < 16) return setError('Secret debe tener al menos 16 caracteres');
    if (events.length === 0) return setError('Selecciona al menos un evento');

    setSubmitting(true);
    try {
      await api.post('/webhooks', {
        name, url, secret, events,
        is_active: true,
        max_retries: 6,
        timeout_ms: 10000,
      });
      onSaved();
      onClose();
    } catch (e: any) {
      const msg = e?.response?.data?.error?.message ?? 'Error al crear webhook';
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
            <h3 className="text-lg font-semibold text-slate-900">Nuevo Webhook</h3>
            <p className="text-xs text-slate-500 mt-0.5">Notifica eventos a sistemas externos (CRM, n8n, WhatsApp Business...).</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {error && <div className="rounded-lg bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-700">{error}</div>}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Nombre <span className="text-rose-500">*</span></label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} required
              placeholder="Ej. WhatsApp Business / n8n"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">URL del endpoint <span className="text-rose-500">*</span></label>
            <input type="url" value={url} onChange={e => setUrl(e.target.value)} required
              placeholder="https://tu-sistema.com/webhook"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Secret HMAC <span className="text-rose-500">*</span></label>
            <div className="flex gap-2">
              <input type="text" value={secret} onChange={e => setSecret(e.target.value)} required
                className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono" />
              <button type="button" onClick={() => setSecret(generateSecret())} className="px-3 py-2 text-sm font-medium text-brand-600 hover:bg-brand-50 rounded-lg border border-brand-200">Regenerar</button>
            </div>
            <p className="text-xs text-slate-500 mt-1">El destino verificará la firma con este secreto.</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Eventos a suscribir <span className="text-rose-500">*</span></label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {ALL_EVENTS.map(ev => (
                <label key={ev} className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer">
                  <input type="checkbox" checked={events.includes(ev)} onChange={() => toggleEvent(ev)} />
                  <code className="text-xs">{ev}</code>
                </label>
              ))}
            </div>
          </div>
        </form>
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-200 bg-slate-50 sticky bottom-0">
          <button type="button" onClick={onClose} disabled={submitting} className="px-4 py-2 text-sm font-medium text-slate-700 disabled:opacity-50">Cancelar</button>
          <button type="button" onClick={handleSubmit as any} disabled={submitting} className="px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-sm font-medium">
            {submitting ? 'Creando…' : 'Crear webhook'}
          </button>
        </div>
      </div>
    </div>
  );
}
