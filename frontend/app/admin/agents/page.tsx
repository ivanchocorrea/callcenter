'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/shared/AppShell';
import { api, unwrap } from '@/lib/api/client';
import { Plus, HeadphonesIcon, Pencil, Trash2, Pause, Play, KeyRound } from 'lucide-react';
import { AgentFormModal } from './AgentFormModal';

interface Agent {
  id: number;
  user_id: number;
  display_name: string;
  extension: string;
  status: string;
  department: string | null;
  is_active?: boolean;
}

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openCreate, setOpenCreate] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  function reload() {
    setLoading(true);
    api.get('/agents')
      .then(res => setAgents(unwrap<Agent[]>(res)))
      .catch(e => setError(e?.response?.data?.error?.message ?? 'Error al cargar agentes'))
      .finally(() => setLoading(false));
  }
  useEffect(() => { reload(); }, []);

  async function suspendAgent(id: number, name: string) {
    if (!confirm(`¿Suspender al agente "${name}"? Quedará inactivo y no podrá atender llamadas.`)) return;
    setBusyId(id);
    try {
      await api.patch(`/agents/${id}`, { is_active: false });
      reload();
    } catch (e: any) {
      alert(e?.response?.data?.error?.message ?? 'Error al suspender');
    } finally { setBusyId(null); }
  }

  async function activateAgent(id: number) {
    setBusyId(id);
    try {
      await api.patch(`/agents/${id}`, { is_active: true });
      reload();
    } catch (e: any) {
      alert(e?.response?.data?.error?.message ?? 'Error al activar');
    } finally { setBusyId(null); }
  }

  async function deleteAgent(id: number, name: string) {
    if (!confirm(`⚠️ ¿ELIMINAR permanentemente al agente "${name}"?\n\nEsto NO elimina al usuario, solo su perfil de agente. Sus llamadas históricas se conservan.`)) return;
    setBusyId(id);
    try {
      await api.delete(`/agents/${id}`);
      reload();
    } catch (e: any) {
      alert(e?.response?.data?.error?.message ?? 'Error al eliminar');
    } finally { setBusyId(null); }
  }

  async function regenerateSecret(id: number, name: string) {
    if (!confirm(`Generar NUEVA contraseña SIP para "${name}"?\n\n⚠️ El softphone actual del agente dejará de funcionar hasta que se actualice con la nueva.`)) return;
    setBusyId(id);
    try {
      const res = await api.post(`/agents/${id}/regenerate-secret`, {});
      const data = unwrap<{ sip_secret: string }>(res);
      alert(`✅ Nueva contraseña SIP:\n\n${data.sip_secret}\n\n📋 Cópiala y guárdala — no la verás de nuevo.`);
      reload();
    } catch (e: any) {
      alert(e?.response?.data?.error?.message ?? 'Endpoint no disponible aún. Recrea el agente para nuevo secret.');
    } finally { setBusyId(null); }
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
                          onClick={() => regenerateSecret(a.id, a.display_name)}
                          disabled={busyId === a.id}
                          title="Regenerar contraseña SIP"
                          className="p-1.5 rounded text-slate-500 hover:bg-amber-100 hover:text-amber-700 disabled:opacity-50">
                          <KeyRound className="w-4 h-4" />
                        </button>
                        {isInactive ? (
                          <button
                            onClick={() => activateAgent(a.id)}
                            disabled={busyId === a.id}
                            title="Activar"
                            className="p-1.5 rounded text-slate-500 hover:bg-emerald-100 hover:text-emerald-700 disabled:opacity-50">
                            <Play className="w-4 h-4" />
                          </button>
                        ) : (
                          <button
                            onClick={() => suspendAgent(a.id, a.display_name)}
                            disabled={busyId === a.id}
                            title="Suspender"
                            className="p-1.5 rounded text-slate-500 hover:bg-amber-100 hover:text-amber-700 disabled:opacity-50">
                            <Pause className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => deleteAgent(a.id, a.display_name)}
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
    </AppShell>
  );
}
