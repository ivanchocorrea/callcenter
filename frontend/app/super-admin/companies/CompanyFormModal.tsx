'use client';

import { FormEvent, useState } from 'react';
import { api } from '@/lib/api/client';
import { X } from 'lucide-react';

interface Props {
  onClose: () => void;
  onSaved: () => void;
}

interface FormData {
  slug: string;
  legal_name: string;
  display_name: string;
  tax_id?: string;
  country?: string;
  timezone?: string;
  default_locale?: string;
  primary_email?: string;
  primary_phone?: string;
}

const DEFAULTS: FormData = {
  slug: '',
  legal_name: '',
  display_name: '',
  country: 'CO',
  timezone: 'America/Bogota',
  default_locale: 'es-CO',
};

export function CompanyFormModal({ onClose, onSaved }: Props) {
  const [data, setData] = useState<FormData>(DEFAULTS);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof FormData>(key: K, value: FormData[K]) {
    setData(prev => ({ ...prev, [key]: value }));
  }

  // Auto-generar slug desde display_name
  function setDisplayName(v: string) {
    update('display_name', v);
    if (!data.slug || data.slug === slugify(data.display_name)) {
      update('slug', slugify(v));
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!data.slug || !/^[a-z0-9-]+$/.test(data.slug)) {
      setError('El slug debe ser kebab-case (ej. acme-corp)');
      return;
    }
    if (!data.legal_name || data.legal_name.length < 2) {
      setError('Razón social requerida');
      return;
    }
    if (!data.display_name || data.display_name.length < 2) {
      setError('Nombre comercial requerido');
      return;
    }

    setSubmitting(true);
    try {
      const payload: any = {
        slug: data.slug,
        legal_name: data.legal_name,
        display_name: data.display_name,
      };
      if (data.tax_id) payload.tax_id = data.tax_id;
      if (data.country) payload.country = data.country;
      if (data.timezone) payload.timezone = data.timezone;
      if (data.default_locale) payload.default_locale = data.default_locale;
      if (data.primary_email) payload.primary_email = data.primary_email;
      if (data.primary_phone) payload.primary_phone = data.primary_phone;

      await api.post('/companies', payload);
      onSaved();
      onClose();
    } catch (e: any) {
      const msg = e?.response?.data?.error?.message
        ?? e?.response?.data?.message
        ?? 'Error al crear empresa';
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
            <h3 className="text-lg font-semibold text-slate-900">Nueva empresa</h3>
            <p className="text-xs text-slate-500 mt-0.5">Crea un nuevo tenant en el SaaS.</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {error && (
            <div className="rounded-lg bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Nombre comercial <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={data.display_name}
              onChange={e => setDisplayName(e.target.value)}
              placeholder="Ej. ACME"
              required
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Razón social <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={data.legal_name}
              onChange={e => update('legal_name', e.target.value)}
              placeholder="Ej. ACME Corporation S.A.S."
              required
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Slug (URL-friendly) <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={data.slug}
              onChange={e => update('slug', e.target.value.toLowerCase())}
              placeholder="acme-corp"
              required
              pattern="^[a-z0-9-]+$"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
            />
            <p className="text-xs text-slate-500 mt-1">Solo minúsculas, números y guiones.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">NIT / Tax ID</label>
              <input
                type="text"
                value={data.tax_id ?? ''}
                onChange={e => update('tax_id', e.target.value)}
                placeholder="900.123.456-7"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">País</label>
              <select
                value={data.country ?? 'CO'}
                onChange={e => update('country', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
              >
                <option value="CO">Colombia</option>
                <option value="MX">México</option>
                <option value="AR">Argentina</option>
                <option value="PE">Perú</option>
                <option value="CL">Chile</option>
                <option value="EC">Ecuador</option>
                <option value="VE">Venezuela</option>
                <option value="ES">España</option>
                <option value="US">Estados Unidos</option>
                <option value="">Otro</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Zona horaria</label>
              <input
                type="text"
                value={data.timezone ?? ''}
                onChange={e => update('timezone', e.target.value)}
                placeholder="America/Bogota"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Idioma por defecto</label>
              <input
                type="text"
                value={data.default_locale ?? ''}
                onChange={e => update('default_locale', e.target.value)}
                placeholder="es-CO"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email principal</label>
              <input
                type="email"
                value={data.primary_email ?? ''}
                onChange={e => update('primary_email', e.target.value)}
                placeholder="contacto@empresa.com"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Teléfono principal</label>
              <input
                type="text"
                value={data.primary_phone ?? ''}
                onChange={e => update('primary_phone', e.target.value)}
                placeholder="+57 300 123 4567"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
              />
            </div>
          </div>
        </form>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-200 bg-slate-50 sticky bottom-0">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 text-sm font-medium text-slate-700 hover:text-slate-900 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSubmit as any}
            disabled={submitting}
            className="px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-sm font-medium"
          >
            {submitting ? 'Creando…' : 'Crear empresa'}
          </button>
        </div>
      </div>
    </div>
  );
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 60);
}
