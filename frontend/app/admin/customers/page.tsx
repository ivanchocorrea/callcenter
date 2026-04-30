'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/shared/AppShell';
import { api, unwrap } from '@/lib/api/client';
import { Search, Plus, Star, Phone, Building2 } from 'lucide-react';
import Link from 'next/link';

interface Customer {
  id: number;
  full_name: string;
  primary_phone: string | null;
  email: string | null;
  document_number: string | null;
  company_name: string | null;
  status: string;
  is_vip: boolean;
  last_interaction_at: string | null;
  created_at: string;
}

export default function CustomersPage() {
  const [items, setItems] = useState<Customer[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [vipOnly, setVipOnly] = useState(false);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const r = await api.get('/customers', { params: { search, vip: vipOnly ? 'true' : undefined, limit: 100 } });
      const data = unwrap<any>(r);
      const list = (data.items ?? []).map((c: any) => ({
        id: c.id,
        full_name: c.fullName ?? c.full_name,
        primary_phone: c.primaryPhone ?? c.primary_phone,
        email: c.email,
        document_number: c.documentNumber ?? c.document_number,
        company_name: c.companyName ?? c.company_name,
        status: c.status,
        is_vip: c.isVip ?? c.is_vip,
        last_interaction_at: c.lastInteractionAt ?? c.last_interaction_at,
        created_at: c.createdAt ?? c.created_at,
      }));
      setItems(list);
      setTotal(data.total ?? list.length);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  return (
    <AppShell>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-slate-900">Clientes / CRM</h2>
            <p className="text-slate-500 mt-1">Total: {total.toLocaleString()}</p>
          </div>
          <Link
            href="/admin/customers/new"
            className="inline-flex items-center gap-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 text-sm font-medium"
          >
            <Plus className="w-4 h-4" /> Nuevo cliente
          </Link>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-3 flex gap-3">
          <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-50 border border-slate-200">
            <Search className="w-4 h-4 text-slate-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') load(); }}
              placeholder="Buscar por nombre, teléfono, documento, email…"
              className="flex-1 bg-transparent outline-none text-sm"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={vipOnly} onChange={e => setVipOnly(e.target.checked)} />
            Solo VIP
          </label>
          <button onClick={load} className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-sm">
            Buscar
          </button>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Nombre</th>
                <th className="text-left px-4 py-3 font-medium">Teléfono</th>
                <th className="text-left px-4 py-3 font-medium">Documento</th>
                <th className="text-left px-4 py-3 font-medium">Empresa</th>
                <th className="text-left px-4 py-3 font-medium">Estado</th>
                <th className="text-left px-4 py-3 font-medium">Últ. interacción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">Cargando…</td></tr>
              )}
              {!loading && items.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">Sin resultados.</td></tr>
              )}
              {items.map(c => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <Link href={`/admin/customers/${c.id}`} className="flex items-center gap-2 font-medium text-slate-900 hover:text-brand-700">
                      {c.is_vip && <Star className="w-4 h-4 text-amber-500 fill-amber-400" />}
                      {c.full_name}
                    </Link>
                    {c.email && <div className="text-xs text-slate-500">{c.email}</div>}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">
                    {c.primary_phone ? (
                      <span className="inline-flex items-center gap-1"><Phone className="w-3 h-3" /> {c.primary_phone}</span>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3 text-slate-700">{c.document_number ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-700">
                    {c.company_name ? (
                      <span className="inline-flex items-center gap-1"><Building2 className="w-3 h-3" /> {c.company_name}</span>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                      c.status === 'active' ? 'bg-emerald-100 text-emerald-700' :
                      c.status === 'blocked' ? 'bg-rose-100 text-rose-700' :
                      'bg-slate-100 text-slate-700'
                    }`}>{c.status}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {c.last_interaction_at ? new Date(c.last_interaction_at).toLocaleDateString() : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
