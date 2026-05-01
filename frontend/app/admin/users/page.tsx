'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/shared/AppShell';
import { api, unwrap } from '@/lib/api/client';
import { Plus, Users as UsersIcon, KeyRound, Lock, Unlock, Trash2, AlertCircle, Pencil } from 'lucide-react';
import { UserFormModal } from './UserFormModal';
import { ConfirmDialog, PromptDialog, Toast, DialogIcons } from '@/components/shared/Dialog';

interface User {
  id: number;
  email: string;
  full_name: string;
  status: string;
  roles?: string[];
  created_at: string;
}

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-700',
  disabled: 'bg-slate-100 text-slate-500',
  locked: 'bg-rose-100 text-rose-700',
  pending: 'bg-amber-100 text-amber-700',
};

type ConfirmAction =
  | { kind: 'status'; user: User; newStatus: 'active' | 'disabled' | 'locked' }
  | { kind: 'delete'; user: User }
  | null;

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openCreate, setOpenCreate] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [pwUser, setPwUser] = useState<User | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [toast, setToast] = useState<{ msg: string; variant: 'success' | 'danger' | 'info' } | null>(null);

  function reload() {
    setLoading(true);
    api.get('/users')
      .then(res => setUsers(unwrap<User[]>(res)))
      .catch(e => setError(e?.response?.data?.error?.message ?? 'Error al cargar usuarios'))
      .finally(() => setLoading(false));
  }
  useEffect(() => { reload(); }, []);

  async function executeStatusChange() {
    if (!confirmAction || confirmAction.kind !== 'status') return;
    const { user, newStatus } = confirmAction;
    setActionLoading(true);
    setBusyId(user.id);
    try {
      await api.patch(`/users/${user.id}`, { status: newStatus });
      const labels: Record<string, string> = { active: 'reactivado', disabled: 'suspendido', locked: 'bloqueado' };
      setToast({ msg: `${user.email} ${labels[newStatus]} correctamente`, variant: 'success' });
      setConfirmAction(null);
      reload();
    } catch (e: any) {
      setToast({ msg: e?.response?.data?.error?.message ?? 'Error al cambiar estado', variant: 'danger' });
    } finally {
      setActionLoading(false);
      setBusyId(null);
    }
  }

  async function executeDelete() {
    if (!confirmAction || confirmAction.kind !== 'delete') return;
    const { user } = confirmAction;
    setActionLoading(true);
    setBusyId(user.id);
    try {
      await api.patch(`/users/${user.id}`, { status: 'disabled' });
      setToast({ msg: `${user.email} desactivado`, variant: 'success' });
      setConfirmAction(null);
      reload();
    } catch (e: any) {
      setToast({ msg: e?.response?.data?.error?.message ?? 'Error al eliminar', variant: 'danger' });
    } finally {
      setActionLoading(false);
      setBusyId(null);
    }
  }

  async function executePasswordReset(newPassword: string) {
    if (!pwUser) return;
    setActionLoading(true);
    setBusyId(pwUser.id);
    try {
      await api.patch(`/users/${pwUser.id}/password`, { password: newPassword });
      setToast({ msg: `Contraseña actualizada para ${pwUser.email}`, variant: 'success' });
      setPwUser(null);
    } catch (e: any) {
      setToast({ msg: e?.response?.data?.error?.message ?? 'Error al cambiar contraseña', variant: 'danger' });
    } finally {
      setActionLoading(false);
      setBusyId(null);
    }
  }

  return (
    <AppShell>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-slate-900">Usuarios</h2>
            <p className="text-slate-500 mt-1">Gestiona los usuarios de tu empresa.</p>
          </div>
          <button onClick={() => setOpenCreate(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 text-sm font-medium shadow-sm">
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
                <th className="text-right px-4 py-3 font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">Cargando…</td></tr>}
              {error && <tr><td colSpan={6} className="px-4 py-8 text-center text-rose-600">{error}</td></tr>}
              {!loading && !error && users.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500"><UsersIcon className="w-8 h-8 mx-auto mb-2 text-slate-300" />No hay usuarios todavía.</td></tr>
              )}
              {users.map(u => (
                <tr key={u.id} className="group hover:bg-slate-50 transition">
                  <td className="px-4 py-3 font-medium text-slate-900">{u.full_name}</td>
                  <td className="px-4 py-3 text-slate-700">{u.email}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {(u.roles ?? []).map(r => (
                        <code key={r} className="text-xs bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded">{r}</code>
                      )) || '—'}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[u.status] ?? 'bg-slate-100 text-slate-700'}`}>
                      {u.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{new Date(u.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex items-center gap-1 opacity-30 group-hover:opacity-100 transition">
                      <button
                        onClick={() => setEditId(u.id)}
                        disabled={busyId === u.id}
                        title="Editar datos"
                        className="p-1.5 rounded text-slate-500 hover:bg-blue-100 hover:text-blue-700 disabled:opacity-50">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setPwUser(u)}
                        disabled={busyId === u.id}
                        title="Cambiar contraseña"
                        className="p-1.5 rounded text-slate-500 hover:bg-amber-100 hover:text-amber-700 disabled:opacity-50">
                        <KeyRound className="w-4 h-4" />
                      </button>
                      {u.status === 'active' ? (
                        <button
                          onClick={() => setConfirmAction({ kind: 'status', user: u, newStatus: 'disabled' })}
                          disabled={busyId === u.id}
                          title="Suspender"
                          className="p-1.5 rounded text-slate-500 hover:bg-amber-100 hover:text-amber-700 disabled:opacity-50">
                          <Lock className="w-4 h-4" />
                        </button>
                      ) : (
                        <button
                          onClick={() => setConfirmAction({ kind: 'status', user: u, newStatus: 'active' })}
                          disabled={busyId === u.id}
                          title="Reactivar"
                          className="p-1.5 rounded text-slate-500 hover:bg-emerald-100 hover:text-emerald-700 disabled:opacity-50">
                          <Unlock className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => setConfirmAction({ kind: 'delete', user: u })}
                        disabled={busyId === u.id}
                        title="Eliminar"
                        className="p-1.5 rounded text-slate-500 hover:bg-rose-100 hover:text-rose-700 disabled:opacity-50">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900 flex gap-2">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <strong>Tip:</strong> Para ver usuarios de TODAS las empresas, ve a <code className="bg-white px-1 rounded">/super-admin/users</code>. Esta vista es solo para tu empresa.
          </div>
        </div>
      </div>

      {openCreate && <UserFormModal onClose={() => setOpenCreate(false)} onSaved={reload} />}
      {editId !== null && <UserFormModal editId={editId} onClose={() => setEditId(null)} onSaved={reload} />}

      <ConfirmDialog
        open={confirmAction?.kind === 'status'}
        title={
          confirmAction?.kind === 'status'
            ? confirmAction.newStatus === 'active' ? 'Reactivar usuario' : 'Suspender usuario'
            : ''
        }
        message={
          confirmAction?.kind === 'status' ? (
            <>
              {confirmAction.newStatus === 'active'
                ? <>Vas a reactivar a <strong>{confirmAction.user.email}</strong>. Podrá iniciar sesión nuevamente.</>
                : <>Vas a suspender a <strong>{confirmAction.user.email}</strong>. No podrá iniciar sesión hasta que lo reactives.</>}
            </>
          ) : ''
        }
        variant={confirmAction?.kind === 'status' && confirmAction.newStatus === 'active' ? 'success' : 'warning'}
        icon={confirmAction?.kind === 'status' && confirmAction.newStatus === 'active' ? DialogIcons.Unlock : DialogIcons.Lock}
        confirmText={confirmAction?.kind === 'status' && confirmAction.newStatus === 'active' ? 'Sí, reactivar' : 'Sí, suspender'}
        onConfirm={executeStatusChange}
        onCancel={() => !actionLoading && setConfirmAction(null)}
        loading={actionLoading}
      />

      <ConfirmDialog
        open={confirmAction?.kind === 'delete'}
        title="Eliminar usuario"
        message={
          confirmAction?.kind === 'delete' ? (
            <>
              Vas a desactivar permanentemente a <strong>{confirmAction.user.email}</strong>.
              <br /><span className="text-xs text-slate-500 mt-1 block">Su historial se conserva por GDPR. Esta acción cambia su estado a "disabled".</span>
            </>
          ) : ''
        }
        variant="danger"
        icon={DialogIcons.Trash}
        confirmText="Sí, eliminar"
        onConfirm={executeDelete}
        onCancel={() => !actionLoading && setConfirmAction(null)}
        loading={actionLoading}
      />

      <PromptDialog
        open={pwUser !== null}
        title="Cambiar contraseña"
        message={pwUser && <>Nueva contraseña para <strong>{pwUser.email}</strong></>}
        label="Nueva contraseña"
        type="password"
        placeholder="Mínimo 10 caracteres"
        minLength={10}
        helperText="Usa una combinación de letras, números y símbolos"
        confirmText="Actualizar contraseña"
        variant="warning"
        icon={DialogIcons.Key}
        onSubmit={executePasswordReset}
        onCancel={() => !actionLoading && setPwUser(null)}
        loading={actionLoading}
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
