'use client';

import { FormEvent, useEffect, useState } from 'react';
import { api, unwrap } from '@/lib/api/client';
import { X, AlertCircle } from 'lucide-react';

interface Props { onClose: () => void; onSaved: () => void; }

interface Provider { id: number; name: string; provider_type: string; }
interface Prompt { id: number; name: string; slug: string; }

const MODELS: Record<string, string[]> = {
  openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
  anthropic: ['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022', 'claude-3-opus-20240229'],
  google: ['gemini-1.5-pro', 'gemini-1.5-flash'],
  generic: ['custom'],
};

export function BotFormModal({ onClose, onSaved }: Props) {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [loadingProviders, setLoadingProviders] = useState(true);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [providerId, setProviderId] = useState('');
  const [model, setModel] = useState('');
  const [voice, setVoice] = useState('');
  const [welcomeMessage, setWelcomeMessage] = useState('Hola, ¿en qué puedo ayudarte?');
  const [fallbackMessage, setFallbackMessage] = useState('Lo siento, no entendí. ¿Puedes repetir?');
  const [promptId, setPromptId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api.get('/ai/providers').then(res => unwrap<Provider[]>(res)).catch(() => []),
      api.get('/ai/prompts').then(res => unwrap<Prompt[]>(res)).catch(() => []),
    ]).then(([provs, prms]) => {
      setProviders(provs);
      setPrompts(prms);
      setLoadingProviders(false);
    });
  }, []);

  const selectedProvider = providers.find(p => p.id === parseInt(providerId, 10));
  const availableModels = selectedProvider ? (MODELS[selectedProvider.provider_type] ?? MODELS.generic) : [];

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name) return setError('Nombre requerido');
    if (!slug) return setError('Slug requerido');
    if (!providerId) return setError('Selecciona un proveedor de IA');
    if (!model) return setError('Selecciona un modelo');

    setSubmitting(true);
    try {
      await api.post('/ai/bots', {
        slug, name,
        provider_id: parseInt(providerId, 10),
        model,
        voice: voice || undefined,
        welcome_message: welcomeMessage || undefined,
        fallback_message: fallbackMessage || undefined,
        prompt_id: promptId ? parseInt(promptId, 10) : undefined,
        is_active: true,
      });
      onSaved();
      onClose();
    } catch (e: any) {
      const msg = e?.response?.data?.error?.message ?? e?.response?.data?.message ?? 'Error al crear bot';
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
            <h3 className="text-lg font-semibold text-slate-900">Nuevo Bot IA</h3>
            <p className="text-xs text-slate-500 mt-0.5">Configura un asistente conversacional con IA.</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {error && <div className="rounded-lg bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-700">{error}</div>}

          {!loadingProviders && providers.length === 0 && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800 flex gap-2">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <strong>No hay proveedores de IA configurados.</strong> Antes de crear un bot, debes registrar al menos un proveedor con su API key. Esto se hace por SQL directamente en la tabla <code className="bg-white px-1 rounded">ai_providers</code> por ahora.
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Nombre <span className="text-rose-500">*</span></label>
              <input type="text" value={name} onChange={e => { setName(e.target.value); if (!slug) setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-')); }} required
                placeholder="Ej. Bot Soporte"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Slug <span className="text-rose-500">*</span></label>
              <input type="text" value={slug} onChange={e => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))} required
                placeholder="bot-soporte"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-brand-500 outline-none" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Proveedor de IA <span className="text-rose-500">*</span></label>
            <select value={providerId} onChange={e => { setProviderId(e.target.value); setModel(''); }} required
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
              <option value="">— Selecciona —</option>
              {providers.map(p => <option key={p.id} value={p.id}>{p.name} ({p.provider_type})</option>)}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Modelo <span className="text-rose-500">*</span></label>
              <select value={model} onChange={e => setModel(e.target.value)} required disabled={!providerId}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm disabled:bg-slate-50">
                <option value="">— Selecciona —</option>
                {availableModels.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Voz (TTS opcional)</label>
              <input type="text" value={voice} onChange={e => setVoice(e.target.value)}
                placeholder="alloy, nova, echo..."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Prompt asociado (opcional)</label>
            <select value={promptId} onChange={e => setPromptId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
              <option value="">— Sin prompt —</option>
              {prompts.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Mensaje de bienvenida</label>
            <textarea value={welcomeMessage} onChange={e => setWelcomeMessage(e.target.value)} rows={2}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Mensaje de fallback</label>
            <textarea value={fallbackMessage} onChange={e => setFallbackMessage(e.target.value)} rows={2}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
          </div>
        </form>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-200 bg-slate-50 sticky bottom-0">
          <button type="button" onClick={onClose} disabled={submitting} className="px-4 py-2 text-sm font-medium text-slate-700 hover:text-slate-900 disabled:opacity-50">Cancelar</button>
          <button type="button" onClick={handleSubmit as any} disabled={submitting || providers.length === 0} className="px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-sm font-medium">
            {submitting ? 'Creando…' : 'Crear bot'}
          </button>
        </div>
      </div>
    </div>
  );
}
