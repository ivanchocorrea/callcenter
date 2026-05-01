'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/shared/AppShell';
import { api, unwrap } from '@/lib/api/client';
import { Users, Building2, Search, Filter, Eye, ShieldAlert } from 'lucide-react';
import { ConfirmDialog, Toast } from '@/components/shared/Dialog';

interface UserRow {
  id: number;
  email: string;
  fullName: string;
  status: string;
  createdAt: string;
  companyId: number | null;
  companyName: string | null;
  companySlug: string | null;
  roles: string | null;
}

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-700',
  disabled: 'bg-slate-100 text-slate-500',
  locked: 'bg-rose-100 text-rose-700',
  pending: 'bg-amber-100 text-amber-700',
};

export default function AllUsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterCompany, setFilterCompany] = useState<string>('all');
  const [filterRole, setFilterRole] = useState<string>('all');
  const [impersonateTarget, setImpersonateTarget] = useState<UserRow | null>(null);
  const [impersonateLoading, setImpersonateLoading] = useState(false);
  const [toast, setToast] = useState<{ msg: string; variant: 'success' | 'danger' | 'info' } | null>(null);

  async function executeImpersonate() {
    if (!impersonateTarget) return;
    setImpersonateLoading(true);
    try {
      const res = await api.post(`/auth/impersonate/${impersonateTarget.id}`, {});
      const data = unwrap<{ access_token: string; refresh_token: string; target: any }>(res);
      // Abre nueva pestaña con la sesión del usuario destino
      const url = `/impersonate?access=${encodeURIComponent(data.access_token)}&refresh=${encodeURIComponent(data.refresh_token)}&target=${encodeURIComponent(impersonateTarget.email)}`;
      window.open(url, '_blank', 'noopener');
      setToast({ msg: `Abierta nueva pestaña como ${impersonateTarget.email}`, variant: 'success' });
      setImpersonateTarget(null);
    } catch (e: any) {
      setToast({ msg: e?.response?.data?.error?.message ?? 'Error al iniciar impersonation', variant: 'danger' });
    } finally {
      setImpersonateLoading(false);
    }
  }

  function reload() {
    setLoading(true);
    api.get('/users/all')
      .then(res => setUsers(unwrap<UserRow[]>(res)))
      .catch(e => setError(e?.response?.data?.error?.message ?? 'Error al cargar'))
      .finally(() => setLoading(false));
  }
  useEffect(() => { reload(); }, []);

  const companies = Array.from(new Set(users.map(u => u.companyName).filter(Boolean))).sort();
  const allRoles = Array.from(new Set(
    users.flatMap(u => u.roles?.split(',') ?? [])
  )).sort();

  const filtered = users.filter(u => {
    if (filterCompany !== 'all') {
      if (filterCompany === 'no-company' && u.companyId !== null) return false;
      if (filterCompany !== 'no-company' && u.companyName !== filterCompany) return false;
    }
    if (filterRole !== 'all' && !(u.roles ?? '').includes(filterRole)) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!u.email.toLowerCase().includes(q) &&
          !u.fullName.toLowerCase().includes(q) &&
          !(u.companyName ?? '').toLowerCase().includes(q)) return false;
    }
    return true;
  });

  // Stats
  const stats = {
    total: users.length,
    active: users.filter(u => u.status === 'active').length,
    superAdmins: users.filter(u => (u.roles ?? '').includes('super_admin')).length,
    noCompany: users.filter(u => u.companyId === null).length,
    companies: companies.length,
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900 flex items-center gap-2">
            <Users className="w-7 h-7 text-brand-600" /> Todos los usuarios del SaaS
          </h2>
          <p className="text-slate-500 mt-1">Vista global de TODOS los usuarios de TODAS las empresas. Para gestión por empresa, ve a <code className="bg-slate-100 px-1.5 rounded text-xs">/admin/users</code>.</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="text-xs text-slate-500 uppercase">Total usuarios</div>
            <div className="mt-1 text-2xl font-bold text-slate-900">{stats.total}</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="text-xs text-slate-500 uppercase">Activos</div>
            <div className="mt-1 text-2xl font-bold text-emerald-700">{stats.active}</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="text-xs text-slate-500 uppercase">Empresas</div>
            <div className="mt-1 text-2xl font-bold text-slate-900">{stats.companies}</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="text-xs text-slate-500 uppercase">Super admins</div>
            <div className="mt-1 text-2xl font-bold text-rose-700">{stats.superAdmins}</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="text-xs text-slate-500 uppercase">Sin empresa</div>
            <div className="mt-1 text-2xl font-bold text-amber-700">{stats.noCompany}</div>
          </div>
        </div>

        {/* Filtros */}
        <div className="rounded-xl border border-slate-200 bg-white p-3 flex flex-wrap gap-3 items-center">
          <div className="flex-1 min-w-[200px] flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200">
            <Search className="w-4 h-4 text-slate-400" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por email, nombre, empresa..."
              className="flex-1 bg-transparent outline-none text-sm" />
          </div>
          <select value={filterCompany} onChange={e => setFilterCompany(e.target.value)}
            className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm">
            <option value="all">🏢 Todas las empresas</option>
            <option value="no-company">— Sin empresa —</option>
            {companies.map(c => <option key={c} value={c!}>{c}</option>)}
          </select>
          <select value={filterRole} onChange={e => setFilterRole(e.target.value)}
            className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm">
            <option value="all">👤 Todos los roles</option>
            {allRoles.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>

        {/* Tabla */}
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 bg-slate-50 text-sm text-slate-600">
            Mostrando {filtered.length} de {users.length} usuarios
          </div>
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Usuario</th>
                <th className="text-left px-4 py-3 font-medium">Empresa</th>
                <th className="text-left px-4 py-3 font-medium">Roles</th>
                <th className="text-left px-4 py-3 font-medium">Estado</th>
                <th className="text-left px-4 py-3 font-medium">Creado</th>
                <th className="text-right px-4 py-3 font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">Cargando…</td></tr>}
              {error && <tr><td colSpan={6} className="px-4 py-8 text-center text-rose-600">{error}</td></tr>}
              {!loading && !error && filtered.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-slate-500">
                  <Users className="w-8 h-8 mx-auto mb-2 text-slate-300" />Sin usuarios.
                </td></tr>
              )}
              {filtered.map(u => (
                <tr key={u.id} className="group hover:bg-slate-50 transition">
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">{u.fullName}</div>
                    <div className="text-xs text-slate-500">{u.email}</div>
                  </td>
                  <td className="px-4 py-3">
                    {u.companyName ? (
                      <div className="flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-slate-400" />
                        <span className="text-sm text-slate-900">{u.companyName}</span>
                        <code className="text-xs bg-slate-100 px-1 rounded text-slate-500">#{u.companyId}</code>
                      </div>
                    ) : (
                      <span className="text-xs text-amber-600">— sin empresa —</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {(u.roles?.split(',') ?? []).filter(Boolean).map(r => (
                        <code key={r} className={`text-xs px-1.5 py-0.5 rounded ${
                          r === 'super_admin' ? 'bg-rose-100 text-rose-700' :
                          r === 'company_admin' ? 'bg-blue-100 text-blue-700' :
                          r === 'supervisor' ? 'bg-amber-100 text-amber-700' :
                          'bg-slate-100 text-slate-700'
                        }`}>{r}</code>
                      ))}
                      {!u.roles && <span className="text-xs text-slate-400">— sin rol —</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[u.status] ?? 'bg-slate-100'}`}>
                      {u.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">{new Date(u.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => setImpersonateTarget(u)}
                      title="Ver la plataforma como este usuario (abre en nueva pestaña)"
                      disabled={u.status !== 'active'}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-slate-600 bg-slate-100 hover:bg-amber-100 hover:text-amber-700 transition opacity-30 group-hover:opacity-100 disabled:opacity-20 disabled:cursor-not-allowed"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      Ver como
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900 flex gap-2">
          <Filter className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <strong>Diferencia clave:</strong>
            <ul className="list-disc pl-5 mt-1 space-y-0.5">
              <li><code className="bg-white px-1 rounded">/super-admin/users</code> (esta vista) — VER usuarios de TODAS las empresas</li>
              <li><code className="bg-white px-1 rounded">/admin/users</code> — CREAR/editar usuarios de UNA empresa específica</li>
              <li><strong>Botón "Ver como"</strong> — abre nueva pestaña con la sesión del usuario, sin perder la tuya. Sesión limitada a 30 min y auditada.</li>
            </ul>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={impersonateTarget !== null}
        title="Ver plataforma como este usuario"
        message={impersonateTarget && (
          <>
            Vas a abrir una nueva pestaña con la sesión de <strong>{impersonateTarget.email}</strong> ({impersonateTarget.companyName ?? 'sin empresa'}).
            <div className="mt-3 text-xs space-y-1.5 bg-amber-50 border border-amber-200 rounded-lg p-3 text-amber-800">
              <div className="flex gap-2"><ShieldAlert className="w-4 h-4 shrink-0" /><span>Tu sesión actual de super_admin <strong>NO se cierra</strong> — sigue activa en esta pestaña.</span></div>
              <div className="flex gap-2"><ShieldAlert className="w-4 h-4 shrink-0" /><span>La sesión de impersonation dura <strong>30 minutos</strong> máximo.</span></div>
              <div className="flex gap-2"><ShieldAlert className="w-4 h-4 shrink-0" /><span>Toda actividad queda <strong>auditada</strong> con tu nombre.</span></div>
            </div>
          </>
        )}
        variant="warning"
        confirmText="Sí, abrir como este usuario"
        onConfirm={executeImpersonate}
        onCancel={() => !impersonateLoading && setImpersonateTarget(null)}
        loading={impersonateLoading}
      />

      <Toast
        open={toast !== null}
        message={toast?.msg ?? ''}
        variant={toast?.variant ?? 'info'}
        onClose={() => setToast(null)}
      />
    </AppShell>
  );
}
