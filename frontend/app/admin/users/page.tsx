'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/shared/AppShell';
import { api, unwrap } from '@/lib/api/client';
import { Plus, Users as UsersIcon } from 'lucide-react';
import { UserFormModal } from './UserFormModal';

interface User {
  id: number;
  email: string;
  full_name: string;
  status: string;
  roles?: string[];
  created_at: string;
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openCreate, setOpenCreate] = useState(false);

  function reload() {
    setLoading(true);
    api.get('/users')
      .then(res => setUsers(unwrap<User[]>(res)))
      .catch(e => setError(e?.response?.data?.error?.message ?? 'Error al cargar usuarios'))
      .finally(() => setLoading(false));
  }
  useEffect(() => { reload(); }, []);

  return (
    <AppShell>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-slate-900">Usuarios</h2>
            <p className="text-slate-500 mt-1">Gestiona los usuarios de tu empresa.</p>
          </div>
          <button onClick={() => setOpenCreate(true)} className="inline-flex items-center gap-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 text-sm font-medium">
            <Plus className="w-4 h-4" /> Nuevo usuario
          </button>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Nombre</th>
                <th className="text-left px-4 py-3 font-medium">Email</th>
                <th className="text-left px-4 py-3 font-medium">Roles</th>
                <th className="text-left px-4 py-3 font-medium">Estado</th>
                <th className="text-left px-4 py-3 font-medium">Creado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">Cargando…</td></tr>}
              {error && <tr><td colSpan={5} className="px-4 py-8 text-center text-rose-600">{error}</td></tr>}
              {!loading && !error && users.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500"><UsersIcon className="w-8 h-8 mx-auto mb-2 text-slate-300" />No hay usuarios todavía.</td></tr>
              )}
              {users.map(u => (
                <tr key={u.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">{u.full_name}</td>
                  <td className="px-4 py-3 text-slate-700">{u.email}</td>
                  <td className="px-4 py-3 text-slate-700">{u.roles?.join(', ') ?? '—'}</td>
                  <td className="px-4 py-3"><span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">{u.status}</span></td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{new Date(u.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {openCreate && <UserFormModal onClose={() => setOpenCreate(false)} onSaved={reload} />}
    </AppShell>
  );
}
