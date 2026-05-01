'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/shared/AppShell';
import { api, unwrap } from '@/lib/api/client';
import { Plus, Pencil, CreditCard, Pause, Play, Trash2 } from 'lucide-react';
import { CompanyFormModal } from './CompanyFormModal';
import { PlanChangeModal } from './PlanChangeModal';
import { ConfirmDialog, PromptDialog, Toast, DialogIcons } from '@/components/shared/Dialog';

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

type ConfirmAction =
  | { kind: 'activate'; company: Company }
  | { kind: 'delete'; company: Company }
  | null;

export default function CompaniesListPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openCreate, setOpenCreate] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [planForCompany, setPlanForCompany] = useState<{ id: number; name: string } | null>(null);

  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [suspendCompany, setSuspendCompany] = useState<Company | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [toast, setToast] = useState<{ msg: string; variant: 'success' | 'danger' | 'info' } | null>(null);

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

  async function executeSuspend(reason: string) {
    if (!suspendCompany) return;
    setActionLoading(true);
    setBusyId(suspendCompany.id);
    try {
      await api.patch(`/companies/${suspendCompany.id}/suspend`, { reason });
      setToast({ msg: `Empresa "${suspendCompany.display_name}" suspendida`, variant: 'success' });
      setSuspendCompany(null);
      reload();
    } catch (e: any) {
      setToast({ msg: e?.response?.data?.error?.message ?? 'Error al suspender', variant: 'danger' });
    } finally {
      setActionLoading(false);
      setBusyId(null);
    }
  }

  async function executeActivate() {
    if (!confirmAction || confirmAction.kind !== 'activate') return;
    const { company } = confirmAction;
    setActionLoading(true);
    setBusyId(company.id);
    try {
      await api.patch(`/companies/${company.id}/activate`, {});
      setToast({ msg: `Empresa "${company.display_name}" reactivada`, variant: 'success' });
      setConfirmAction(null);
      reload();
    } catch (e: any) {
      setToast({ msg: e?.response?.data?.error?.message ?? 'Error al activar', variant: 'danger' });
    } finally {
      setActionLoading(false);
      setBusyId(null);
    }
  }

  async function executeDelete() {
    if (!confirmAction || confirmAction.kind !== 'delete') return;
    const { company } = confirmAction;
    setActionLoading(true);
    setBusyId(company.id);
    try {
      // Soft-delete vía suspend con razón
      await api.patch(`/companies/${company.id}/suspend`, { reason: 'Eliminada por super_admin' });
      setToast({ msg: `Empresa "${company.display_name}" desactivada (soft-delete)`, variant: 'success' });
      setConfirmAction(null);
      reload();
    } catch (e: any) {
      setToast({ msg: e?.response?.data?.error?.message ?? 'Error al eliminar', variant: 'danger' });
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
                <th className="text-right px-4 py-3 font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-500">Cargando…</td></tr>
              )}
              {error && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-rose-600">{error}</td></tr>
              )}
              {!loading && !error && companies.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-500">No hay empresas todavía. Crea la primera.</td></tr>
              )}
              {companies.map(c => {
                const isSuspended = c.status === 'suspended' || c.status === 'disabled';
                return (
                  <tr key={c.id} className="group hover:bg-slate-50 transition">
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
                        c.status === 'suspended' ? 'bg-rose-100 text-rose-700' :
                        'bg-slate-100 text-slate-700'
                      }`}>{c.status}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{c.primary_email ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{new Date(c.created_at).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-1 opacity-30 group-hover:opacity-100 transition">
                        <button onClick={() => setPlanForCompany({ id: c.id, name: c.display_name })}
                          disabled={busyId === c.id}
                          className="p-1.5 rounded text-slate-500 hover:bg-blue-100 hover:text-blue-700 disabled:opacity-50" title="Plan & límites">
                          <CreditCard className="w-4 h-4" />
                        </button>
                        <button onClick={() => setEditId(c.id)}
                          disabled={busyId === c.id}
                          className="p-1.5 rounded text-slate-500 hover:bg-slate-200 hover:text-slate-900 disabled:opacity-50" title="Editar datos">
                          <Pencil className="w-4 h-4" />
                        </button>
                        {isSuspended ? (
                          <button onClick={() => setConfirmAction({ kind: 'activate', company: c })}
                            disabled={busyId === c.id}
                            className="p-1.5 rounded text-slate-500 hover:bg-emerald-100 hover:text-emerald-700 disabled:opacity-50" title="Reactivar empresa">
                            <Play className="w-4 h-4" />
                          </button>
                        ) : (
                          <button onClick={() => setSuspendCompany(c)}
                            disabled={busyId === c.id}
                            className="p-1.5 rounded text-slate-500 hover:bg-amber-100 hover:text-amber-700 disabled:opacity-50" title="Suspender empresa">
                            <Pause className="w-4 h-4" />
                          </button>
                        )}
                        <button onClick={() => setConfirmAction({ kind: 'delete', company: c })}
                          disabled={busyId === c.id}
                          className="p-1.5 rounded text-slate-500 hover:bg-rose-100 hover:text-rose-700 disabled:opacity-50" title="Eliminar empresa">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <strong>⚠️ Suspender vs Eliminar:</strong> Suspender permite reactivar después con todos los datos intactos. Eliminar es un soft-delete (los datos se conservan pero la empresa queda inaccesible). Para borrado real consulta a Anthropic/legal por GDPR.
        </div>
      </div>

      {openCreate && (
        <CompanyFormModal onClose={() => setOpenCreate(false)} onSaved={() => reload()} />
      )}
      {editId != null && (
        <CompanyFormModal editId={editId} onClose={() => setEditId(null)} onSaved={() => reload()} />
      )}
      {planForCompany && (
        <PlanChangeModal
          companyId={planForCompany.id}
          companyName={planForCompany.name}
          onClose={() => setPlanForCompany(null)}
          onSaved={() => reload()}
        />
      )}

      <PromptDialog
        open={suspendCompany !== null}
        title="Suspender empresa"
        message={suspendCompany && (
          <>Vas a suspender a <strong>{suspendCompany.display_name}</strong>. Sus usuarios no podrán iniciar sesión.</>
        )}
        label="Razón de la suspensión"
        placeholder="Ej: Falta de pago del mes de abril"
        helperText="Se guardará en el historial de auditoría"
        confirmText="Suspender empresa"
        variant="warning"
        icon={DialogIcons.Lock}
        onSubmit={executeSuspend}
        onCancel={() => !actionLoading && setSuspendCompany(null)}
        loading={actionLoading}
      />

      <ConfirmDialog
        open={confirmAction?.kind === 'activate'}
        title="Reactivar empresa"
        message={confirmAction?.kind === 'activate' ? (
          <>Vas a reactivar a <strong>{confirmAction.company.display_name}</strong>. Sus usuarios volverán a tener acceso.</>
        ) : ''}
        variant="success"
        icon={DialogIcons.Unlock}
        confirmText="Sí, reactivar"
        onConfirm={executeActivate}
        onCancel={() => !actionLoading && setConfirmAction(null)}
        loading={actionLoading}
      />

      <ConfirmDialog
        open={confirmAction?.kind === 'delete'}
        title="Eliminar empresa"
        message={confirmAction?.kind === 'delete' ? (
          <>
            Vas a eliminar a <strong>{confirmAction.company.display_name}</strong>.
            <br /><span className="text-xs text-slate-500 mt-2 block">Soft-delete: los datos se conservan en BD pero la empresa queda inaccesible. Sus usuarios no podrán iniciar sesión.</span>
          </>
        ) : ''}
        variant="danger"
        icon={DialogIcons.Trash}
        confirmText="Sí, eliminar"
        onConfirm={executeDelete}
        onCancel={() => !actionLoading && setConfirmAction(null)}
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
