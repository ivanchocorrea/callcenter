'use client';

import { FormEvent, useState } from 'react';
import { api } from '@/lib/api/client';
import { X, Eye, EyeOff } from 'lucide-react';

interface Props { onClose: () => void; onSaved: () => void; }

const PROVIDER_INFO: Record<string, { label: string; placeholder: string; defaultBaseUrl?: string; defaultModel?: string }> = {
  openai: { label: 'OpenAI (GPT-4, GPT-4o)', placeholder: 'sk-proj-...', defaultModel: 'gpt-4o-mini' },
  anthropic: { label: 'Anthropic (Claude)', placeholder: 'sk-ant-...', defaultModel: 'claude-3-5-sonnet-20241022' },
  google: { label: 'Google (Gemini)', placeholder: 'AIza...', defaultModel: 'gemini-1.5-flash' },
  azure_openai: { label: 'Azure OpenAI', placeholder: 'tu-azure-key', defaultBaseUrl: 'https://YOUR-RESOURCE.openai.azure.com' },
  generic_http: { label: 'Generic HTTP (custom)', placeholder: 'tu-api-key', defaultBaseUrl: 'https://api.tu-proveedor.com' },
  deepgram: { label: 'Deepgram (STT)', placeholder: 'tu-deepgram-key' },
  whisper: { label: 'Whisper local', placeholder: '(opcional)' },
};

export function AiProviderFormModal({ onClose, onSaved }: Props) {
  const [providerType, setProviderType] = useState<keyof typeof PROVIDER_INFO>('openai');
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [baseUrl, setBaseUrl] = useState('');
  const [organizationId, setOrganizationId] = useState('');
  const [defaultModel, setDefaultModel] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleProviderChange(t: keyof typeof PROVIDER_INFO) {
    setProviderType(t);
    const info = PROVIDER_INFO[t];
    if (!baseUrl && info.defaultBaseUrl) setBaseUrl(info.defaultBaseUrl);
    if (!defaultModel && info.defaultModel) setDefaultModel(info.defaultModel);
    if (!name) setName(info.label.split(' ')[0]);
    if (!slug) setSlug(t);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name) return setError('Nombre requerido');
    if (!slug) return setError('Slug requerido');
    if (!apiKey && providerType !== 'whisper') return setError('API key requerida');

    setSubmitting(true);
    try {
      await api.post('/ai/providers', {
        slug, name,
        provider_type: providerType,
        api_key: apiKey || undefined,
        base_url: baseUrl || undefined,
        organization_id: organizationId || undefined,
        default_model: defaultModel || undefined,
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 sticky top-0 bg-white">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Nuevo proveedor de IA</h3>
            <p className="text-xs text-slate-500 mt-0.5">Tu API key se cifra con AES-256-GCM antes de guardarla.</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {error && <div className="rounded-lg bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-700">{error}</div>}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Tipo de proveedor <span className="text-rose-500">*</span></label>
            <select
              value={providerType}
              onChange={e => handleProviderChange(e.target.value as keyof typeof PROVIDER_INFO)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
            >
              {(Object.keys(PROVIDER_INFO) as Array<keyof typeof PROVIDER_INFO>).map(t => (
                <option key={t} value={t}>{PROVIDER_INFO[t].label} ({t})</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Nombre <span className="text-rose-500">*</span></label>
              <input type="text" value={name} onChange={e => setName(e.target.value)} required
                placeholder="OpenAI Producción"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Slug <span className="text-rose-500">*</span></label>
              <input type="text" value={slug} onChange={e => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))} required
                placeholder="openai-prod"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              API Key {providerType !== 'whisper' && <span className="text-rose-500">*</span>}
            </label>
            <div className="relative">
              <input type={showApiKey ? 'text' : 'password'} value={apiKey} onChange={e => setApiKey(e.target.value)}
                placeholder={PROVIDER_INFO[providerType].placeholder}
                className="w-full px-3 py-2 pr-10 border border-slate-300 rounded-lg text-sm font-mono" />
              <button type="button" onClick={() => setShowApiKey(s => !s)} className="absolute right-2 top-2 text-slate-400 hover:text-slate-600">
                {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-xs text-slate-500 mt-1">Se guarda cifrada. No la verás en texto plano después.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Base URL (opcional)</label>
            <input type="text" value={baseUrl} onChange={e => setBaseUrl(e.target.value)}
              placeholder={PROVIDER_INFO[providerType].defaultBaseUrl ?? 'Solo si usas un endpoint custom'}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Modelo por defecto</label>
              <input type="text" value={defaultModel} onChange={e => setDefaultModel(e.target.value)}
                placeholder={PROVIDER_INFO[providerType].defaultModel ?? 'gpt-4o-mini'}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Organization ID (OpenAI)</label>
              <input type="text" value={organizationId} onChange={e => setOrganizationId(e.target.value)}
                placeholder="org-..."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={isDefault} onChange={e => setIsDefault(e.target.checked)} />
            Usar como proveedor por defecto
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
