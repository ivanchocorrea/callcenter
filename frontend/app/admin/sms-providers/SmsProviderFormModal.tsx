'use client';

import { FormEvent, useState } from 'react';
import { api } from '@/lib/api/client';
import { X, Eye, EyeOff } from 'lucide-react';

interface Props { onClose: () => void; onSaved: () => void; }

const PROVIDER_INFO: Record<string, { label: string; keyLabel: string; secretLabel: string; senderHint: string }> = {
  twilio: { label: 'Twilio', keyLabel: 'Account SID', secretLabel: 'Auth Token', senderHint: '+12025550100 o Messaging Service SID' },
  plivo: { label: 'Plivo', keyLabel: 'Auth ID', secretLabel: 'Auth Token', senderHint: '+1...' },
  vonage: { label: 'Vonage / Nexmo', keyLabel: 'API Key', secretLabel: 'API Secret', senderHint: 'Brand name (11 chars max)' },
  aws_sns: { label: 'AWS SNS', keyLabel: 'AWS Access Key ID', secretLabel: 'AWS Secret Access Key', senderHint: '+57...' },
  generic_http: { label: 'Generic HTTP', keyLabel: 'API Key', secretLabel: 'Secret (opcional)', senderHint: '+57...' },
};

export function SmsProviderFormModal({ onClose, onSaved }: Props) {
  const [providerType, setProviderType] = useState<keyof typeof PROVIDER_INFO>('twilio');
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [senderId, setSenderId] = useState('');
  const [endpointUrl, setEndpointUrl] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleProviderChange(t: keyof typeof PROVIDER_INFO) {
    setProviderType(t);
    if (!name) setName(PROVIDER_INFO[t].label);
    if (!slug) setSlug(t);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name) return setError('Nombre requerido');
    if (!slug) return setError('Slug requerido');
    if (!apiKey) return setError(`${PROVIDER_INFO[providerType].keyLabel} requerido`);

    setSubmitting(true);
    try {
      const config: Record<string, unknown> = {};
      if (providerType === 'generic_http' && endpointUrl) config.endpoint = endpointUrl;
      if (providerType === 'aws_sns') config.region = 'us-east-1';

      await api.post('/sms/providers', {
        slug, name,
        provider_type: providerType,
        api_key: apiKey,
        api_secret: apiSecret || undefined,
        sender_id: senderId || undefined,
        config,
        is_default: isDefault,
        is_active: true,
      });
      onSaved();
      onClose();
    } catch (e: any) {
      const msg = e?.response?.data?.error?.message ?? 'Error al crear proveedor';
      setError(Array.isArray(msg) ? msg.join(', ') : String(msg));
    } finally {
      setSubmitting(false);
    }
  }

  const info = PROVIDER_INFO[providerType];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 sticky top-0 bg-white">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Nuevo proveedor SMS</h3>
            <p className="text-xs text-slate-500 mt-0.5">Credenciales cifradas con AES-256-GCM.</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {error && <div className="rounded-lg bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-700">{error}</div>}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Proveedor <span className="text-rose-500">*</span></label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {(Object.keys(PROVIDER_INFO) as Array<keyof typeof PROVIDER_INFO>).map(t => (
                <label key={t} className={`flex items-center gap-2 px-3 py-2 border rounded-lg cursor-pointer ${providerType === t ? 'border-brand-500 bg-brand-50' : 'border-slate-200 hover:bg-slate-50'}`}>
                  <input type="radio" name="provider_type" value={t} checked={providerType === t} onChange={() => handleProviderChange(t)} />
                  <span className="text-sm font-medium text-slate-900">{PROVIDER_INFO[t].label}</span>
                </label>
              ))}
            </div>
          </div>

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
            <label className="block text-sm font-medium text-slate-700 mb-1">{info.keyLabel} <span className="text-rose-500">*</span></label>
            <input type="text" value={apiKey} onChange={e => setApiKey(e.target.value)} required
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono" />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">{info.secretLabel}</label>
            <div className="relative">
              <input type={showSecret ? 'text' : 'password'} value={apiSecret} onChange={e => setApiSecret(e.target.value)}
                className="w-full px-3 py-2 pr-10 border border-slate-300 rounded-lg text-sm font-mono" />
              <button type="button" onClick={() => setShowSecret(s => !s)} className="absolute right-2 top-2 text-slate-400 hover:text-slate-600">
                {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Sender ID / Número From</label>
            <input type="text" value={senderId} onChange={e => setSenderId(e.target.value)}
              placeholder={info.senderHint}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono" />
          </div>

          {providerType === 'generic_http' && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">URL del endpoint</label>
              <input type="url" value={endpointUrl} onChange={e => setEndpointUrl(e.target.value)}
                placeholder="https://api.tu-proveedor.com/sms/send"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono" />
            </div>
          )}

          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={isDefault} onChange={e => setIsDefault(e.target.checked)} />
            Usar como proveedor por defecto para SMS de esta empresa
          </label>
        </form>
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-200 bg-slate-50 sticky bottom-0">
          <button type="button" onClick={onClose} disabled={submitting} className="px-4 py-2 text-sm font-medium text-slate-700 disabled:opacity-50">Cancelar</button>
          <button type="button" onClick={handleSubmit as any} disabled={submitting} className="px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-sm font-medium">
            {submitting ? 'Creando…' : 'Crear proveedor'}
          </button>
        </div>
      </div>
    </div>
  );
}
