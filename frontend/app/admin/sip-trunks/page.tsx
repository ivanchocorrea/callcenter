'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/shared/AppShell';
import { api, unwrap } from '@/lib/api/client';
import { Plus, PhoneCall, AlertCircle, CheckCircle2, Settings2 } from 'lucide-react';
import { TrunkFormModal } from './TrunkFormModal';
import { confirmAsync, toastShow } from '@/lib/ui/dialog-helper';

interface Trunk {
  id: number;
  name: string;
  host: string;
  port: number;
  username: string;
  transport: string;
  status: string;
  direction: string;
  priority: number;
  last_registered_at: string | null;
  last_error: string | null;
}

export default function SipTrunksPage() {
  const [trunks, setTrunks] = useState<Trunk[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openCreate, setOpenCreate] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [testingId, setTestingId] = useState<number | null>(null);
  const [testResult, setTestResult] = useState<{ id: number; success: boolean; line?: string; error?: string; ms?: number } | null>(null);

  async function reload() {
    setLoading(true);
    try {
      const res = await api.get('/sip-trunks');
      setTrunks(unwrap<Trunk[]>(res));
      setError(null);
    } catch (e: any) {
      setError(e?.response?.data?.error?.message ?? 'Error al cargar troncales');
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { reload(); }, []);

  async function testTrunk(id: number) {
    setTestingId(id);
    setTestResult(null);
    try {
      const res = await api.post(`/sip-trunks/${id}/test`);
      const data = unwrap<any>(res);
      setTestResult({
        id,
        success: data.success,
        line: data.responseLine,
        error: data.error,
        ms: data.latencyMs,
      });
      // Refresca para ver el nuevo status
      reload();
    } catch (e: any) {
      setTestResult({ id, success: false, error: e?.response?.data?.error?.message ?? 'Error de prueba' });
    } finally {
      setTestingId(null);
    }
  }

  async function deleteTrunk(id: number) {
    const ok = await confirmAsync({
      title: 'Eliminar troncal SIP',
      message: <>Vas a eliminar esta troncal. Las llamadas que la usen dejarán de funcionar inmediatamente.</>,
      variant: 'danger',
      confirmText: 'Sí, eliminar',
    });
    if (!ok) return;
    try {
      await api.delete(`/sip-trunks/${id}`);
      toastShow('Troncal eliminada', 'success');
      reload();
    } catch (e: any) {
      toastShow(e?.response?.data?.error?.message ?? 'Error al eliminar', 'danger');
    }
  }

  return (
    <AppShell>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-slate-900">Troncales SIP</h2>
            <p className="text-slate-500 mt-1">Configura los proveedores VoIP de tu empresa.</p>
          </div>
          <button
            onClick={() => { setEditingId(null); setOpenCreate(true); }}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 text-sm font-medium"
          >
            <Plus className="w-4 h-4" /> Nueva troncal
          </button>
        </div>

        {testResult && (
          <div className={`rounded-lg border px-4 py-3 text-sm ${
            testResult.success
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}>
            <div className="flex items-center gap-2 font-medium">
              {testResult.success ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
              Trunk #{testResult.id}: {testResult.success ? 'conexión OK' : 'fallo'}
              {testResult.ms != null && <span className="text-xs opacity-70">({testResult.ms} ms)</span>}
            </div>
            <div className="text-xs mt-1 font-mono opacity-80">{testResult.line ?? testResult.error}</div>
          </div>
        )}

        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Nombre</th>
                <th className="text-left px-4 py-3 font-medium">Host</th>
                <th className="text-left px-4 py-3 font-medium">Transport</th>
                <th className="text-left px-4 py-3 font-medium">Dirección</th>
                <th className="text-left px-4 py-3 font-medium">Estado</th>
                <th className="text-left px-4 py-3 font-medium">Último OK</th>
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
              {!loading && !error && trunks.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-500">No hay troncales todavía. Crea la primera.</td></tr>
              )}
              {trunks.map(t => (
                <tr key={t.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">{t.name}</div>
                    <div className="text-xs text-slate-500">prio {t.priority}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-700 font-mono text-xs">{t.host}:{t.port}</td>
                  <td className="px-4 py-3"><code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded uppercase">{t.transport}</code></td>
                  <td className="px-4 py-3 text-slate-700">{t.direction}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                      t.status === 'active' ? 'bg-emerald-100 text-emerald-700' :
                      t.status === 'error'  ? 'bg-rose-100 text-rose-700'      :
                      t.status === 'registering' ? 'bg-amber-100 text-amber-700' :
                                                'bg-slate-100 text-slate-700'
                    }`}>
                      <PhoneCall className="w-3 h-3" /> {t.status}
                    </span>
                    {t.last_error && <div className="text-xs text-rose-600 mt-1 truncate max-w-xs">{t.last_error}</div>}
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs">
                    {t.last_registered_at ? new Date(t.last_registered_at).toLocaleString() : '—'}
                  </td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <button
                      onClick={() => testTrunk(t.id)}
                      disabled={testingId === t.id}
                      className="text-xs px-2 py-1 rounded border border-slate-200 hover:bg-slate-100 disabled:opacity-50"
                    >
                      {testingId === t.id ? 'Probando…' : 'Probar'}
                    </button>
                    <button
                      onClick={() => { setEditingId(t.id); setOpenCreate(true); }}
                      className="text-xs px-2 py-1 rounded border border-slate-200 hover:bg-slate-100 inline-flex items-center gap-1"
                    >
                      <Settings2 className="w-3 h-3" /> Editar
                    </button>
                    <button
                      onClick={() => deleteTrunk(t.id)}
                      className="text-xs px-2 py-1 rounded border border-rose-200 text-rose-600 hover:bg-rose-50"
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {openCreate && (
        <TrunkFormModal
          trunkId={editingId}
          onClose={() => { setOpenCreate(false); setEditingId(null); }}
          onSaved={() => { setOpenCreate(false); setEditingId(null); reload(); }}
        />
      )}
    </AppShell>
  );
}
