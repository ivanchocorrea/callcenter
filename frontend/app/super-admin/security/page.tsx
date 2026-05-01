'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/shared/AppShell';
import { api, unwrap } from '@/lib/api/client';
import { Shield, AlertTriangle, Ban, Eye, RefreshCw } from 'lucide-react';

interface Overview {
  active_bans: number;
  expired_bans: number;
  total_attacks: number;
  attacks_24h: number;
  attacks_by_jail: Array<{ jail: string; count: number }>;
  top_attackers: Array<{ ip: string; attempts: number }>;
}

interface Ban {
  id: number;
  ip: string;
  jail: string;
  banned_at: string;
  unbanned_at: string | null;
  ban_count: number;
  status: string;
}

interface Attack {
  ip: string;
  jail: string;
  attempted_user: string | null;
  detected_at: string;
}

export default function SecurityPage() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [bans, setBans] = useState<Ban[]>([]);
  const [attacks, setAttacks] = useState<Attack[]>([]);
  const [statusFilter, setStatusFilter] = useState<'active'|'expired'|'manual_unban'>('active');
  const [loading, setLoading] = useState(true);

  function reload() {
    setLoading(true);
    Promise.all([
      api.get('/security/overview').then(r => unwrap<Overview>(r)).catch(() => null),
      api.get(`/security/bans?status=${statusFilter}`).then(r => unwrap<Ban[]>(r)).catch(() => []),
      api.get('/security/attacks/recent').then(r => unwrap<Attack[]>(r)).catch(() => []),
    ]).then(([o, b, a]) => { setOverview(o); setBans(b); setAttacks(a); }).finally(() => setLoading(false));
  }
  useEffect(() => { reload(); const i = setInterval(reload, 30000); return () => clearInterval(i); }, [statusFilter]);

  async function unban(id: number, ip: string) {
    if (!confirm(`¿Desbanear ${ip}?`)) return;
    await api.delete(`/security/bans/${id}`);
    reload();
  }

  async function whitelist(ip: string) {
    if (!confirm(`¿Agregar ${ip} a whitelist (no se va a banear más)?`)) return;
    await api.post('/security/whitelist', { ip });
    reload();
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-slate-900 flex items-center gap-2">
              <Shield className="w-7 h-7 text-emerald-600" /> Seguridad — fail2ban
            </h2>
            <p className="text-slate-500 mt-1">Monitoreo de ataques + IPs baneadas. Auto-refresh 30s.</p>
          </div>
          <button onClick={reload} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-sm">
            <RefreshCw className="w-4 h-4" /> Refrescar
          </button>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-5">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-xs uppercase text-rose-700 font-medium">IPs baneadas activas</div>
                <div className="mt-2 text-3xl font-bold text-rose-700">{overview?.active_bans ?? '—'}</div>
              </div>
              <Ban className="w-7 h-7 text-rose-600" />
            </div>
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-xs uppercase text-amber-700 font-medium">Ataques últimas 24h</div>
                <div className="mt-2 text-3xl font-bold text-amber-700">{overview?.attacks_24h?.toLocaleString() ?? '—'}</div>
              </div>
              <AlertTriangle className="w-7 h-7 text-amber-600" />
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="text-xs uppercase text-slate-500 font-medium">Total histórico ataques</div>
            <div className="mt-2 text-3xl font-bold text-slate-900">{overview?.total_attacks?.toLocaleString() ?? '—'}</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="text-xs uppercase text-slate-500 font-medium">Bans expirados</div>
            <div className="mt-2 text-3xl font-bold text-slate-900">{overview?.expired_bans ?? '—'}</div>
          </div>
        </div>

        {/* Top attackers + jails */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h3 className="font-semibold text-slate-900 mb-3">🥇 Top atacantes (24h)</h3>
            {!overview?.top_attackers?.length ? (
              <p className="text-sm text-slate-500">Sin actividad en 24h.</p>
            ) : (
              <table className="w-full text-sm">
                <tbody className="divide-y divide-slate-100">
                  {overview.top_attackers.map(a => (
                    <tr key={a.ip}>
                      <td className="py-2"><code className="bg-slate-100 px-2 py-1 rounded font-mono text-xs">{a.ip}</code></td>
                      <td className="py-2 text-right font-semibold">{a.attempts.toLocaleString()} intentos</td>
                      <td className="py-2 text-right">
                        <button onClick={() => whitelist(a.ip)} className="text-xs text-brand-600 hover:underline">Whitelist</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h3 className="font-semibold text-slate-900 mb-3">📊 Ataques por jail (24h)</h3>
            {!overview?.attacks_by_jail?.length ? (
              <p className="text-sm text-slate-500">Sin ataques.</p>
            ) : (
              <ul className="space-y-2">
                {overview.attacks_by_jail.map(j => (
                  <li key={j.jail} className="flex items-center justify-between text-sm">
                    <code className="bg-slate-100 px-2 py-1 rounded text-xs">{j.jail}</code>
                    <span className="font-semibold">{j.count.toLocaleString()}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Tabla de bans */}
        <div className="rounded-xl border border-slate-200 bg-white">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-semibold text-slate-900">IPs gestionadas ({bans.length})</h3>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)}
              className="px-3 py-1.5 border border-slate-300 rounded text-sm">
              <option value="active">🔴 Activos (baneados)</option>
              <option value="expired">⏱️ Expirados</option>
              <option value="manual_unban">🟢 Whitelisted</option>
            </select>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
              <tr>
                <th className="text-left px-4 py-2 font-medium">IP</th>
                <th className="text-left px-4 py-2 font-medium">Jail</th>
                <th className="text-left px-4 py-2 font-medium">Bans</th>
                <th className="text-left px-4 py-2 font-medium">Baneado</th>
                <th className="text-left px-4 py-2 font-medium">Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-500">Cargando…</td></tr>}
              {!loading && bans.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">Sin IPs en este estado.</td></tr>
              )}
              {bans.map(b => (
                <tr key={b.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2"><code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs font-mono">{b.ip}</code></td>
                  <td className="px-4 py-2"><code className="text-xs">{b.jail}</code></td>
                  <td className="px-4 py-2 font-semibold">{b.ban_count}</td>
                  <td className="px-4 py-2 text-xs text-slate-500">{new Date(b.banned_at).toLocaleString()}</td>
                  <td className="px-4 py-2">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                      b.status === 'active' ? 'bg-rose-100 text-rose-700' :
                      b.status === 'expired' ? 'bg-slate-100 text-slate-700' :
                      'bg-emerald-100 text-emerald-700'
                    }`}>{b.status}</span>
                  </td>
                  <td className="px-4 py-2 text-right">
                    {b.status === 'active' && (
                      <button onClick={() => unban(b.id, b.ip)} className="text-xs text-brand-600 hover:underline">Desbanear</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Logs recientes */}
        <div className="rounded-xl border border-slate-200 bg-white">
          <div className="px-5 py-4 border-b border-slate-100">
            <h3 className="font-semibold text-slate-900 flex items-center gap-2"><Eye className="w-5 h-5" /> Ataques recientes (últimos 200)</h3>
          </div>
          <div className="max-h-96 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase sticky top-0">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">IP</th>
                  <th className="text-left px-4 py-2 font-medium">Jail</th>
                  <th className="text-left px-4 py-2 font-medium">User intentado</th>
                  <th className="text-left px-4 py-2 font-medium">Hora</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {attacks.length === 0 ? (
                  <tr><td colSpan={4} className="px-4 py-6 text-center text-slate-500">Sin ataques registrados.</td></tr>
                ) : attacks.map((a, i) => (
                  <tr key={i}>
                    <td className="px-4 py-1.5"><code className="text-xs">{a.ip}</code></td>
                    <td className="px-4 py-1.5"><code className="text-xs text-slate-500">{a.jail}</code></td>
                    <td className="px-4 py-1.5 font-mono text-xs">{a.attempted_user ?? '—'}</td>
                    <td className="px-4 py-1.5 text-xs text-slate-500">{new Date(a.detected_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
