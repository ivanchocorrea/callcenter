'use client';

import { FormEvent, useEffect, useState } from 'react';
import { AppShell } from '@/components/shared/AppShell';
import { api, unwrap } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/auth-context';
import { Building2, Globe, Save, AlertCircle, CheckCircle2 } from 'lucide-react';

interface Company {
  id: number;
  slug: string;
  display_name: string;
  legal_name: string;
  tax_id: string | null;
  country: string | null;
  timezone: string | null;
  default_locale: string | null;
  primary_email: string | null;
  primary_phone: string | null;
  logo_url: string | null;
  status: string;
}

export default function SettingsPage() {
  const { user } = useAuth();
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  // form fields
  const [displayName, setDisplayName] = useState('');
  const [legalName, setLegalName] = useState('');
  const [taxId, setTaxId] = useState('');
  const [country, setCountry] = useState('');
  const [timezone, setTimezone] = useState('');
  const [defaultLocale, setDefaultLocale] = useState('');
  const [primaryEmail, setPrimaryEmail] = useState('');
  const [primaryPhone, setPrimaryPhone] = useState('');
  const [logoUrl, setLogoUrl] = useState('');

  useEffect(() => {
    if (!user?.company_id) { setLoading(false); return; }
    api.get(`/companies/${user.company_id}`)
      .then(res => {
        const c = unwrap<any>(res);
        const norm: Company = {
          id: c.id,
          slug: c.slug,
          display_name: c.displayName ?? c.display_name,
          legal_name: c.legalName ?? c.legal_name,
          tax_id: c.taxId ?? c.tax_id,
          country: c.country,
          timezone: c.timezone,
          default_locale: c.defaultLocale ?? c.default_locale,
          primary_email: c.primaryEmail ?? c.primary_email,
          primary_phone: c.primaryPhone ?? c.primary_phone,
          logo_url: c.logoUrl ?? c.logo_url,
          status: c.status,
        };
        setCompany(norm);
        setDisplayName(norm.display_name);
        setLegalName(norm.legal_name);
        setTaxId(norm.tax_id ?? '');
        setCountry(norm.country ?? '');
        setTimezone(norm.timezone ?? '');
        setDefaultLocale(norm.default_locale ?? '');
        setPrimaryEmail(norm.primary_email ?? '');
        setPrimaryPhone(norm.primary_phone ?? '');
        setLogoUrl(norm.logo_url ?? '');
      })
      .catch(e => setError(e?.response?.data?.error?.message ?? 'Error al cargar empresa'))
      .finally(() => setLoading(false));
  }, [user?.company_id]);

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    if (!company) return;
    setError(null); setSavedAt(null);
    setSaving(true);
    try {
      await api.patch(`/companies/${company.id}`, {
        display_name: displayName,
        legal_name: legalName,
        tax_id: taxId || undefined,
        country: country || undefined,
        timezone: timezone || undefined,
        default_locale: defaultLocale || undefined,
        primary_email: primaryEmail || undefined,
        primary_phone: primaryPhone || undefined,
        logo_url: logoUrl || undefined,
      });
      setSavedAt(new Date());
    } catch (e: any) {
      const msg = e?.response?.data?.error?.message ?? 'Error al guardar';
      setError(Array.isArray(msg) ? msg.join(', ') : String(msg));
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <AppShell><div className="text-slate-500">Cargando…</div></AppShell>;

  if (!user?.company_id) {
    return (
      <AppShell>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-amber-800">
          <AlertCircle className="w-5 h-5 inline-block mr-2" />
          Esta vista es para Company Admins. Como super admin, edita las empresas desde <a href="/super-admin/companies" className="underline">/super-admin/companies</a>.
        </div>
      </AppShell>
    );
  }

  if (!company) return <AppShell><div className="text-rose-600">No se encontró tu empresa.</div></AppShell>;

  return (
    <AppShell>
      <div className="space-y-6 max-w-3xl">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Configuración de empresa</h2>
          <p className="text-slate-500 mt-1">Datos generales de tu empresa.</p>
        </div>

        <form onSubmit={handleSave} className="space-y-5">
          {error && <div className="rounded-lg bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-700 flex items-center gap-2"><AlertCircle className="w-4 h-4" /> {error}</div>}
          {savedAt && <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-700 flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> Guardado a las {savedAt.toLocaleTimeString()}</div>}

          <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
            <h3 className="font-semibold text-slate-900 flex items-center gap-2"><Building2 className="w-5 h-5 text-brand-600" /> Datos de empresa</h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nombre comercial</label>
                <input type="text" value={displayName} onChange={e => setDisplayName(e.target.value)} required
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Razón social</label>
                <input type="text" value={legalName} onChange={e => setLegalName(e.target.value)} required
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">NIT / Tax ID</label>
                <input type="text" value={taxId} onChange={e => setTaxId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Slug (no editable)</label>
                <input type="text" value={company.slug} disabled
                  className="w-full px-3 py-2 border border-slate-200 bg-slate-50 rounded-lg text-sm font-mono text-slate-500" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">URL del logo (opcional)</label>
              <input type="url" value={logoUrl} onChange={e => setLogoUrl(e.target.value)}
                placeholder="https://..."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
            <h3 className="font-semibold text-slate-900 flex items-center gap-2"><Globe className="w-5 h-5 text-brand-600" /> Localización</h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">País</label>
                <select value={country} onChange={e => setCountry(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
                  <option value="">— Sin definir —</option>
                  <option value="CO">Colombia</option>
                  <option value="MX">México</option>
                  <option value="AR">Argentina</option>
                  <option value="PE">Perú</option>
                  <option value="CL">Chile</option>
                  <option value="EC">Ecuador</option>
                  <option value="VE">Venezuela</option>
                  <option value="ES">España</option>
                  <option value="US">Estados Unidos</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Zona horaria</label>
                <input type="text" value={timezone} onChange={e => setTimezone(e.target.value)}
                  placeholder="America/Bogota"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Idioma</label>
                <input type="text" value={defaultLocale} onChange={e => setDefaultLocale(e.target.value)}
                  placeholder="es-CO"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono" />
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
            <h3 className="font-semibold text-slate-900">Contacto principal</h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                <input type="email" value={primaryEmail} onChange={e => setPrimaryEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Teléfono</label>
                <input type="tel" value={primaryPhone} onChange={e => setPrimaryPhone(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono" />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end">
            <button type="submit" disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-sm font-medium">
              <Save className="w-4 h-4" /> {saving ? 'Guardando…' : 'Guardar cambios'}
            </button>
          </div>
        </form>
      </div>
    </AppShell>
  );
}
