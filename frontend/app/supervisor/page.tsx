'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/shared/AppShell';
import { StatCard } from '@/components/shared/StatCard';
import { api, unwrap } from '@/lib/api/client';
import { useRealtime } from '@/lib/realtime/realtime-context';
import { PhoneCall, Headphones, Clock, AlertTriangle, ListTree } from 'lucide-react';

interface Snapshot {
  queues: Array<{ id: number; name: string; slug: string; waiting: number; etaSec: number; sla: number }>;
  agents: Array<{ id: number; name: string; status: string; extension: string; sinceSec: number }>;
  liveCalls: Array<{ id: number; from: string | null; to: string | null; agent: string | null; queue: string | null; durationSec: number; direction: string }>;
  abandonedToday: number;
  answeredToday: number;
  avgWaitSec: number;
}

export default function SupervisorHome() {
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const realtime = useRealtime();

  async function load() {
    try {
      const r = await api.get('/queues/snapshot');
      setSnap(unwrap<Snapshot>(r));
    } catch { /* ignore */ }
  }

  useEffect(() => {
    load();
    const i = setInterval(load, 5000);
    return () => clearInterval(i);
  }, []);

  // Refresh inmediato cuando hay un evento de cola/llamada
  useEffect(() => {
    const offs = ['queue.entered','queue.position_changed','queue.answered','queue.abandoned','call.ended','call.incoming','call.answered']
      .map(e => realtime.on(e, () => load()));
    return () => { offs.forEach(off => off()); };
  }, [realtime]);

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-slate-900">Supervisión en vivo</h2>
            <p className="text-slate-500 mt-1">Monitoreo en tiempo real.</p>
          </div>
          <div className={`text-xs px-3 py-1.5 rounded-full font-medium ${realtime.connected ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
            ● {realtime.connected ? 'Tiempo real conectado' : 'Reconectando…'}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Agentes online" value={snap?.agents.filter(a => a.status !== 'offline').length ?? 0} icon={<Headphones className="w-6 h-6" />} />
          <StatCard label="Llamadas activas" value={snap?.liveCalls.length ?? 0} icon={<PhoneCall className="w-6 h-6" />} />
          <StatCard label="Tiempo medio espera" value={fmt(snap?.avgWaitSec)} icon={<Clock className="w-6 h-6" />} />
          <StatCard label="Abandonadas hoy" value={snap?.abandonedToday ?? 0} icon={<AlertTriangle className="w-6 h-6" />} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <h3 className="text-base font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <ListTree className="w-4 h-4" /> Estado de colas
            </h3>
            {!snap?.queues.length ? (
              <div className="text-sm text-slate-500">No hay colas configuradas.</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="text-xs uppercase text-slate-500">
                  <tr>
                    <th className="text-left py-2">Cola</th>
                    <th className="text-right py-2">Esperando</th>
                    <th className="text-right py-2">ETA</th>
                    <th className="text-right py-2">SLA</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {snap.queues.map(q => (
                    <tr key={q.id}>
                      <td className="py-2"><div className="font-medium">{q.name}</div><div className="text-xs text-slate-500">{q.slug}</div></td>
                      <td className="py-2 text-right font-mono">{q.waiting}</td>
                      <td className="py-2 text-right font-mono">{fmt(q.etaSec)}</td>
                      <td className={`py-2 text-right font-mono ${q.sla >= 80 ? 'text-emerald-600' : q.sla >= 50 ? 'text-amber-600' : 'text-rose-600'}`}>{q.sla}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <h3 className="text-base font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <Headphones className="w-4 h-4" /> Agentes
            </h3>
            {!snap?.agents.length ? (
              <div className="text-sm text-slate-500">Sin agentes.</div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {snap.agents.map(a => (
                  <li key={a.id} className="py-2 flex items-center justify-between">
                    <div>
                      <div className="font-medium text-sm">{a.name}</div>
                      <div className="text-xs text-slate-500">ext {a.extension}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        a.status === 'available' ? 'bg-emerald-100 text-emerald-700' :
                        a.status === 'on_call' ? 'bg-amber-100 text-amber-700' :
                        a.status === 'wrap_up' ? 'bg-blue-100 text-blue-700' :
                        a.status === 'offline' ? 'bg-slate-100 text-slate-500' :
                        'bg-slate-100 text-slate-700'
                      }`}>{a.status}</span>
                      <span className="text-xs text-slate-400 font-mono">{fmt(a.sinceSec)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <h3 className="text-base font-semibold text-slate-900 mb-4">Llamadas en curso</h3>
          {!snap?.liveCalls.length ? (
            <div className="text-sm text-slate-500">No hay llamadas activas.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-slate-500">
                <tr>
                  <th className="text-left py-2">ID</th>
                  <th className="text-left py-2">Dirección</th>
                  <th className="text-left py-2">De</th>
                  <th className="text-left py-2">A</th>
                  <th className="text-left py-2">Agente</th>
                  <th className="text-left py-2">Cola</th>
                  <th className="text-right py-2">Duración</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {snap.liveCalls.map(c => (
                  <tr key={c.id}>
                    <td className="py-2 font-mono text-xs">#{c.id}</td>
                    <td className="py-2"><span className={`text-xs px-1.5 py-0.5 rounded ${c.direction === 'inbound' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>{c.direction}</span></td>
                    <td className="py-2 font-mono text-xs">{c.from ?? '—'}</td>
                    <td className="py-2 font-mono text-xs">{c.to ?? '—'}</td>
                    <td className="py-2">{c.agent ?? '—'}</td>
                    <td className="py-2">{c.queue ?? '—'}</td>
                    <td className="py-2 text-right font-mono">{fmt(c.durationSec)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </AppShell>
  );
}

function fmt(seconds?: number): string {
  if (seconds == null) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
