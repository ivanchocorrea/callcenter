'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/shared/AppShell';
import { api, unwrap } from '@/lib/api/client';
import { Plus, HeadphonesIcon, Trash2, Pause, Play, KeyRound, Pencil } from 'lucide-react';
import { AgentFormModal } from './AgentFormModal';
import { ConfirmDialog, Toast, DialogIcons } from '@/components/shared/Dialog';

interface Agent {
  id: number;
  user_id: number;
  display_name: string;
  extension: string;
  status: string;
  department: string | null;
  is_active?: boolean;
}

type ConfirmAction =
  | { kind: 'suspend'; agent: Agent }
  | { kind: 'activate'; agent: Agent }
  | { kind: 'delete'; agent: Agent }
  | { kind: 'regen-secret'; agent: Agent }
  | null;

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openCreate, setOpenCreate] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [toast, setToast] = useState<{ msg: React.ReactNode; variant: 'success' | 'danger' | 'info' } | null>(null);
  const [newSecret, setNewSecret] = useState<{ name: string; secret: string } | null>(null);

  function reload() {
    setLoading(true);
    api.get('/agents')
      .then(res => {
        const list = unwrap<any[]>(res);
        // Backend TypeORM entrega camelCase (displayName, userId, isActive)
        // Frontend espera snake_case — mapeamos.
        setAgents(list.map(a => ({
          id: Number(a.id),
          user_id: Number(a.userId ?? a.user_id),
          display_name: a.displayName ?? a.display_name ?? '',
          extension: a.extension ?? '',
          status: a.status ?? 'unknown',
          department: a.department ?? null,
          is_active: a.isActive ?? a.is_active,
        })));
      })
      .catch(e => setError(e?.response?.data?.error?.message ?? 'Error al cargar agentes'))
      .finally(() => setLoading(false));
  }
  useEffect(() => { reload(); }, []);

  async function executeAction() {
    if (!confirmAction) return;
    const { kind, agent } = confirmAction;
    setActionLoading(true);
    setBusyId(agent.id);
    try {
      if (kind === 'suspend') {
        await api.patch(`/agents/${agent.id}`, { is_active: false });
        setToast({ msg: `Agente "${agent.display_name}" suspendido`, variant: 'success' });
      } else if (kind === 'activate') {
        await api.patch(`/agents/${agent.id}`, { is_active: true });
        setToast({ msg: `Agente "${agent.display_name}" activado`, variant: 'success' });
      } else if (kind === 'delete') {
        await api.delete(`/agents/${agent.id}`);
        setToast({ msg: `Agente "${agent.display_name}" eliminado`, variant: 'success' });
      } else if (kind === 'regen-secret') {
        const res = await api.post(`/agents/${agent.id}/regenerate-secret`, {});
        const data = unwrap<{ sip_secret: string }>(res);
        setNewSecret({ name: agent.display_name, secret: data.sip_secret });
      }
      setConfirmAction(null);
      reload();
    } catch (e: any) {
      const msg = e?.response?.data?.error?.message ?? 'Error en la operación';
      setToast({ msg, variant: 'danger' });
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
            <h2 className="text-2xl font-semibold text-slate-900">Agentes</h2>
            <p className="text-slate-500 mt-1">Operadores que atienden llamadas con WebRTC.</p>
          </div>
          <button onClick={() => setOpenCreate(true)} className="inline-flex items-center gap-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 text-sm font-medium shadow-sm">
            <Plus className="w-4 h-4" /> Nuevo agente
          </button>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Agente</th>
                <th className="text-left px-4 py-3 font-medium">Extensión</th>
                <th className="text-left px-4 py-3 font-medium">Departamento</th>
                <th className="text-left px-4 py-3 font-medium">Estado</th>
                <th className="text-right px-4 py-3 font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">Cargando…</td></tr>}
              {error && <tr><td colSpan={5} className="px-4 py-8 text-center text-rose-600">{error}</td></tr>}
              {!loading && !error && agents.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-12 text-center text-slate-500">
                  <HeadphonesIcon className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                  <p>No hay agentes todavía.</p>
                  <p className="text-xs text-slate-400 mt-1">Primero crea un Usuario con rol "agent", luego conviértelo en agente aquí.</p>
                </td></tr>
              )}
              {agents.map(a => {
                const isInactive = a.is_active === false;
                return (
                  <tr key={a.id} className="group hover:bg-slate-50 transition">
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {a.display_name}
                      {isInactive && <span className="ml-2 text-xs text-slate-400">(suspendido)</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-700"><code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs font-mono">{a.extension}</code></td>
                    <td className="px-4 py-3 text-slate-700">{a.department ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                        isInactive ? 'bg-slate-100 text-slate-500' :
                        a.status === 'available' ? 'bg-emerald-100 text-emerald-700' :
                        a.status === 'on_call' ? 'bg-amber-100 text-amber-700' :
                        'bg-blue-100 text-blue-700'
                      }`}>
                        {isInactive ? 'inactivo' : a.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-1 opacity-30 group-hover:opacity-100 transition">
                        <button
                          onClick={() => setEditId(a.id)}
                          disabled={busyId === a.id}
                          title="Editar datos del agente"
                          className="p-1.5 rounded text-slate-500 hover:bg-blue-100 hover:text-blue-700 disabled:opacity-50">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setConfirmAction({ kind: 'regen-secret', agent: a })}
                          disabled={busyId === a.id}
                          title="Regenerar contraseña SIP"
                          className="p-1.5 rounded text-slate-500 hover:bg-amber-100 hover:text-amber-700 disabled:opacity-50">
                          <KeyRound className="w-4 h-4" />
                        </button>
                        {isInactive ? (
                          <button
                            onClick={() => setConfirmAction({ kind: 'activate', agent: a })}
                            disabled={busyId === a.id}
                            title="Activar"
                            className="p-1.5 rounded text-slate-500 hover:bg-emerald-100 hover:text-emerald-700 disabled:opacity-50">
                            <Play className="w-4 h-4" />
                          </button>
                        ) : (
                          <button
                            onClick={() => setConfirmAction({ kind: 'suspend', agent: a })}
                            disabled={busyId === a.id}
                            title="Suspender"
                            className="p-1.5 rounded text-slate-500 hover:bg-amber-100 hover:text-amber-700 disabled:opacity-50">
                            <Pause className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => setConfirmAction({ kind: 'delete', agent: a })}
                          disabled={busyId === a.id}
                          title="Eliminar"
                          className="p-1.5 rounded text-slate-500 hover:bg-rose-100 hover:text-rose-700 disabled:opacity-50">
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
      </div>
      {openCreate && <AgentFormModal onClose={() => setOpenCreate(false)} onSaved={reload} />}
      {editId !== null && <AgentFormModal editId={editId} onClose={() => setEditId(null)} onSaved={reload} />}

      <ConfirmDialog
        open={confirmAction?.kind === 'suspend'}
        title="Suspender agente"
        message={confirmAction?.kind === 'suspend' ? <>Vas a suspender a <strong>{confirmAction.agent.display_name}</strong>. No podrá atender llamadas hasta que lo reactives.</> : ''}
        variant="warning"
        icon={DialogIcons.Lock}
        confirmText="Sí, suspender"
        onConfirm={executeAction}
        onCancel={() => !actionLoading && setConfirmAction(null)}
        loading={actionLoading}
      />

      <ConfirmDialog
        open={confirmAction?.kind === 'activate'}
        title="Activar agente"
        message={confirmAction?.kind === 'activate' ? <>Vas a reactivar a <strong>{confirmAction.agent.display_name}</strong>. Podrá iniciar sesión y atender llamadas.</> : ''}
        variant="success"
        icon={DialogIcons.Unlock}
        confirmText="Sí, activar"
        onConfirm={executeAction}
        onCancel={() => !actionLoading && setConfirmAction(null)}
        loading={actionLoading}
      />

      <ConfirmDialog
        open={confirmAction?.kind === 'delete'}
        title="Eliminar agente"
        message={confirmAction?.kind === 'delete' ? (
          <>
            Vas a eliminar al agente <strong>{confirmAction.agent.display_name}</strong>.
            <br /><span className="text-xs text-slate-500 mt-1 block">El usuario NO se elimina, solo su perfil de agente. Las llamadas históricas se conservan.</span>
          </>
        ) : ''}
        variant="danger"
        icon={DialogIcons.Trash}
        confirmText="Sí, eliminar"
        onConfirm={executeAction}
        onCancel={() => !actionLoading && setConfirmAction(null)}
        loading={actionLoading}
      />

      <ConfirmDialog
        open={confirmAction?.kind === 'regen-secret'}
        title="Regenerar contraseña SIP"
        message={confirmAction?.kind === 'regen-secret' ? (
          <>
            Vas a generar una NUEVA contraseña SIP para <strong>{confirmAction.agent.display_name}</strong>.
            <br /><span className="text-xs text-amber-600 mt-2 block">El softphone actual del agente dejará de funcionar hasta actualizar con la nueva contraseña.</span>
          </>
        ) : ''}
        variant="warning"
        icon={DialogIcons.Key}
        confirmText="Sí, generar nueva"
        onConfirm={executeAction}
        onCancel={() => !actionLoading && setConfirmAction(null)}
        loading={actionLoading}
      />

      <ConfirmDialog
        open={newSecret !== null}
        title="Nueva contraseña SIP generada"
        message={newSecret ? (
          <div>
            <p className="mb-3">Contraseña para <strong>{newSecret.name}</strong>:</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-slate-900 text-emerald-300 px-3 py-2 rounded-lg font-mono text-sm select-all break-all">{newSecret.secret}</code>
              <button
                onClick={() => { navigator.clipboard.writeText(newSecret.secret); setToast({ msg: 'Copiado al portapapeles', variant: 'success' }); }}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-medium text-slate-700">
                Copiar
              </button>
            </div>
            <p className="mt-3 text-xs text-amber-700 bg-amber-50 p-2 rounded">
              ⚠️ Guarda esta contraseña ahora. No la verás de nuevo.
            </p>
          </div>
        ) : ''}
        variant="success"
        icon={DialogIcons.Key}
        confirmText="Listo, ya la guardé"
        cancelText="Cerrar"
        onConfirm={() => setNewSecret(null)}
        onCancel={() => setNewSecret(null)}
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
