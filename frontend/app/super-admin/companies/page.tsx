'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/shared/AppShell';
import { api, unwrap } from '@/lib/api/client';
import { Plus } from 'lucide-react';
import { CompanyFormModal } from './CompanyFormModal';

interface Company {
  id: number;
  slug: string;
  display_name: string;
  legal_name: string;
  status: string;
  country: string | null;
  primary_email: string | null;
  created_at: string;
}

export default function CompaniesListPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openCreate, setOpenCreate] = useState(false);

  function reload() {
    setLoading(true);
    api
      .get('/companies')
      .then(res => {
        const list = unwrap<any[]>(res);
        setCompanies(
          list.map(c => ({
            id: c.id,
            slug: c.slug,
            display_name: c.displayName ?? c.display_name,
            legal_name: c.legalName ?? c.legal_name,
            status: c.status,
            country: c.country,
            primary_email: c.primaryEmail ?? c.primary_email,
            created_at: c.createdAt ?? c.created_at,
          })),
        );
        setError(null);
      })
      .catch(err => setError(err?.response?.data?.error?.message ?? 'Error al cargar empresas'))
      .finally(() => setLoading(false));
  }

  useEffect(() => { reload(); }, []);

  return (
    <AppShell>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-slate-900">Empresas</h2>
            <p className="text-slate-500 mt-1">Todas las empresas del SaaS.</p>
          </div>
          <button
            onClick={() => setOpenCreate(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 text-sm font-medium"
          >
            <Plus className="w-4 h-4" /> Nueva empresa
          </button>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Empresa</th>
                <th className="text-left px-4 py-3 font-medium">Slug</th>
                <th className="text-left px-4 py-3 font-medium">País</th>
                <th className="text-left px-4 py-3 font-medium">Estado</th>
                <th className="text-left px-4 py-3 font-medium">Email</th>
                <th className="text-left px-4 py-3 font-medium">Creada</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">Cargando…</td></tr>
              )}
              {error && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-rose-600">{error}</td></tr>
              )}
              {!loading && !error && companies.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">No hay empresas todavía. Crea la primera.</td></tr>
              )}
              {companies.map(c => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">{c.display_name}</div>
                    <div className="text-xs text-slate-500">{c.legal_name}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-700"><code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded">{c.slug}</code></td>
                  <td className="px-4 py-3 text-slate-700">{c.country ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                      c.status === 'active' ? 'bg-emerald-100 text-emerald-700' :
                      c.status === 'trialing' ? 'bg-amber-100 text-amber-700' :
                      'bg-slate-100 text-slate-700'
                    }`}>{c.status}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{c.primary_email ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{new Date(c.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {openCreate && (
        <CompanyFormModal
          onClose={() => setOpenCreate(false)}
          onSaved={() => reload()}
        />
      )}
    </AppShell>
  );
}
