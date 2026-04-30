'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/shared/AppShell';
import { api } from '@/lib/api/client';
import { ArrowLeft, Save } from 'lucide-react';
import Link from 'next/link';

export default function NewCustomerPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [primaryPhone, setPrimaryPhone] = useState('');
  const [email, setEmail] = useState('');
  const [documentType, setDocumentType] = useState('CC');
  const [documentNumber, setDocumentNumber] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [country, setCountry] = useState('CO');
  const [status, setStatus] = useState<'active'|'prospect'|'inactive'|'blocked'>('active');
  const [isVip, setIsVip] = useState(false);
  const [importantNotes, setImportantNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!fullName) return setError('Nombre completo requerido');

    setSubmitting(true);
    try {
      await api.post('/customers', {
        full_name: fullName,
        primary_phone: primaryPhone || undefined,
        email: email || undefined,
        document_type: documentNumber ? documentType : undefined,
        document_number: documentNumber || undefined,
        company_name: companyName || undefined,
        address: address || undefined,
        city: city || undefined,
        state: state || undefined,
        country: country || undefined,
        status,
        is_vip: isVip,
        important_notes: importantNotes || undefined,
      });
      router.push('/admin/customers');
    } catch (e: any) {
      const msg = e?.response?.data?.error?.message ?? 'Error al crear cliente';
      setError(Array.isArray(msg) ? msg.join(', ') : String(msg));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppShell>
      <div className="space-y-4 max-w-3xl">
        <Link href="/admin/customers" className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900">
          <ArrowLeft className="w-4 h-4" /> Volver a clientes
        </Link>
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Nuevo cliente</h2>
          <p className="text-slate-500 mt-1">Crea un cliente o prospecto para tu CRM.</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-5 bg-white rounded-xl border border-slate-200 p-6">
          {error && <div className="rounded-lg bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-700">{error}</div>}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Nombre completo <span className="text-rose-500">*</span></label>
            <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} required
              placeholder="Juan Pérez García"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Teléfono principal</label>
              <input type="tel" value={primaryPhone} onChange={e => setPrimaryPhone(e.target.value)}
                placeholder="+57 300 123 4567"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="cliente@email.com"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Tipo doc.</label>
              <select value={documentType} onChange={e => setDocumentType(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
                <option value="CC">CC</option>
                <option value="CE">CE</option>
                <option value="NIT">NIT</option>
                <option value="PP">Pasaporte</option>
                <option value="DNI">DNI</option>
                <option value="RUT">RUT</option>
                <option value="OTHER">Otro</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Número de documento</label>
              <input type="text" value={documentNumber} onChange={e => setDocumentNumber(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Empresa (si aplica)</label>
            <input type="text" value={companyName} onChange={e => setCompanyName(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Dirección</label>
            <input type="text" value={address} onChange={e => setAddress(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Ciudad</label>
              <input type="text" value={city} onChange={e => setCity(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Departamento/Estado</label>
              <input type="text" value={state} onChange={e => setState(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">País</label>
              <input type="text" value={country} onChange={e => setCountry(e.target.value)} maxLength={2}
                placeholder="CO"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Estado</label>
              <select value={status} onChange={e => setStatus(e.target.value as any)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
                <option value="active">Activo</option>
                <option value="prospect">Prospecto</option>
                <option value="inactive">Inactivo</option>
                <option value="blocked">Bloqueado</option>
              </select>
            </div>
            <div className="flex items-center pt-6">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={isVip} onChange={e => setIsVip(e.target.checked)} />
                ⭐ Cliente VIP
              </label>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Notas importantes</label>
            <textarea value={importantNotes} onChange={e => setImportantNotes(e.target.value)} rows={3}
              placeholder="Aparecerán destacadas en la ficha del cliente"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <Link href="/admin/customers" className="px-4 py-2 text-sm font-medium text-slate-700 hover:text-slate-900">Cancelar</Link>
            <button type="submit" disabled={submitting}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-sm font-medium">
              <Save className="w-4 h-4" /> {submitting ? 'Guardando…' : 'Guardar cliente'}
            </button>
          </div>
        </form>
      </div>
    </AppShell>
  );
}
