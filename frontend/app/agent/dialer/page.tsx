'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/shared/AppShell';
import { Phone, Delete, History, PhoneOff } from 'lucide-react';
import { api, unwrap } from '@/lib/api/client';
import { useSip } from '@/lib/webrtc/sip-context';

const KEYS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['*', '0', '#'],
];

interface RecentCall {
  id: number;
  to_number: string;
  from_number: string | null;
  direction: string;
  status: string;
  duration_seconds: number | null;
  started_at: string;
}

export default function DialerPage() {
  const sip = useSip();
  const [num, setNum] = useState('');
  const [calling, setCalling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recent, setRecent] = useState<RecentCall[]>([]);

  async function reload() {
    try {
      const r = await api.get('/dial/recent', { params: { limit: 30 } });
      setRecent(unwrap<any[]>(r).map(c => ({
        id: c.id,
        to_number: c.toNumber ?? c.to_number ?? '',
        from_number: c.fromNumber ?? c.from_number ?? null,
        direction: c.direction,
        status: c.status,
        duration_seconds: c.durationSeconds ?? c.duration_seconds ?? null,
        started_at: c.startedAt ?? c.started_at,
      })));
    } catch { /* ignore */ }
  }
  useEffect(() => { reload(); }, []);

  const press = (k: string) => setNum(v => (v + k).slice(0, 25));

  async function call() {
    if (!num) return;
    setCalling(true);
    setError(null);
    try {
      await api.post('/dial', { number: num });
      // El popup local NO aparece para outbound; SIP.js mostrará la sesión
      // cuando Asterisk conecte. Refrescamos el historial al terminar.
      setNum('');
      setTimeout(reload, 1500);
    } catch (err: any) {
      setError(err?.response?.data?.error?.message ?? 'Error al iniciar llamada');
    } finally {
      setCalling(false);
    }
  }

  return (
    <AppShell>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <div className="text-xs uppercase tracking-wide text-slate-500 mb-3">Marcador</div>
            <input
              value={num}
              onChange={e => setNum(e.target.value.replace(/[^\d+*#]/g, ''))}
              placeholder="+57 300 000 0000"
              className="w-full rounded-lg border border-slate-200 px-3 py-3 text-2xl font-mono tracking-widest text-center outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
            />
            <div className="mt-4 grid grid-cols-3 gap-2">
              {KEYS.flat().map(k => (
                <button
                  key={k}
                  onClick={() => press(k)}
                  className="aspect-square rounded-xl border border-slate-200 bg-white hover:bg-brand-50 hover:border-brand-300 text-2xl font-medium text-slate-700 transition"
                >
                  {k}
                </button>
              ))}
            </div>

            {error && (
              <div className="mt-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-sm p-3">
                {error}
              </div>
            )}

            <div className="mt-4 grid grid-cols-3 gap-2">
              <button
                onClick={() => setNum(v => v.slice(0, -1))}
                className="rounded-lg bg-slate-100 hover:bg-slate-200 py-3 text-slate-700 text-sm flex items-center justify-center gap-2"
              >
                <Delete className="w-4 h-4" /> Borrar
              </button>
              {sip.active ? (
                <button
                  onClick={() => sip.hangup()}
                  className="col-span-2 rounded-lg bg-rose-500 hover:bg-rose-600 text-white py-3 text-sm font-medium flex items-center justify-center gap-2"
                >
                  <PhoneOff className="w-4 h-4" /> Colgar
                </button>
              ) : (
                <button
                  disabled={num.length === 0 || calling}
                  onClick={call}
                  className="col-span-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white py-3 text-sm font-medium flex items-center justify-center gap-2"
                >
                  <Phone className="w-4 h-4" /> {calling ? 'Llamando…' : 'Llamar'}
                </button>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-2">
              SIP {sip.state} · {sip.active ? 'En llamada' : 'Inactivo'}
            </p>
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-slate-900">Historial reciente</h3>
              <History className="w-5 h-5 text-slate-400" />
            </div>
            {recent.length === 0 ? (
              <div className="text-sm text-slate-500">Aún no hay llamadas en tu historial.</div>
            ) : (
              <ul className="divide-y divide-slate-100 -mx-2">
                {recent.map(c => (
                  <li key={c.id} className="px-2 py-2 flex items-center justify-between hover:bg-slate-50 rounded">
                    <div className="flex items-center gap-3">
                      <Phone className={`w-4 h-4 ${c.direction === 'outbound' ? 'text-blue-500' : 'text-emerald-500'}`} />
                      <div>
                        <div className="font-mono text-sm">{c.direction === 'outbound' ? c.to_number : c.from_number}</div>
                        <div className="text-xs text-slate-500">
                          {new Date(c.started_at).toLocaleString()} · {c.status}
                          {c.duration_seconds != null && ` · ${formatDuration(c.duration_seconds)}`}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => setNum((c.direction === 'outbound' ? c.to_number : c.from_number) ?? '')}
                      className="text-xs px-2 py-1 rounded border border-slate-200 hover:bg-slate-100"
                    >
                      Volver a marcar
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
