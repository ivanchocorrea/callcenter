'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/shared/AppShell';
import { api, unwrap } from '@/lib/api/client';
import { Plus, Mic, Volume2, FileAudio } from 'lucide-react';
import Link from 'next/link';

interface Audio {
  id: number;
  name: string;
  purpose: string;
  duration_seconds?: number | null;
  durationSeconds?: number | null;
  format?: string;
}

function fmtDur(s: number | null | undefined): string {
  if (!s || s <= 0) return '—';
  const min = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${min}:${String(sec).padStart(2, '0')}`;
}

const PURPOSE_LABEL: Record<string, string> = {
  welcome: 'Bienvenida',
  menu: 'Menú',
  wait: 'Espera',
  moh: 'Música on-hold',
  out_of_hours: 'Fuera de horario',
  invalid_option: 'Opción inválida',
  timeout: 'Timeout',
  recording_disclosure: 'Aviso grabación',
  position: 'Posición en cola',
  custom: 'Personalizado',
};

export default function IvrListPage() {
  const [menus, setMenus] = useState<any[]>([]);
  const [audios, setAudios] = useState<Audio[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/ivr').then(r => unwrap<any[]>(r)).catch(() => []),
      api.get('/ivr/audios/list').then(r => unwrap<Audio[]>(r)).catch(() => []),
    ])
      .then(([m, a]) => { setMenus(m); setAudios(a); })
      .finally(() => setLoading(false));
  }, []);

  return (
    <AppShell>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-slate-900">IVR</h2>
            <p className="text-slate-500 mt-1">Menús de respuesta de voz interactiva.</p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/admin/ivr/audios"
              className="inline-flex items-center gap-2 rounded-lg bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 px-4 py-2 text-sm font-medium"
            >
              <Mic className="w-4 h-4" /> Audios
            </Link>
            <Link
              href="/admin/ivr/new"
              className="inline-flex items-center gap-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 text-sm font-medium"
            >
              <Plus className="w-4 h-4" /> Nuevo IVR
            </Link>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white">
          {loading ? (
            <div className="p-8 text-center text-slate-500">Cargando…</div>
          ) : menus.length === 0 ? (
            <div className="p-8 text-center text-slate-500">No hay IVRs configurados.</div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {menus.map(m => (
                <li key={m.id} className="px-6 py-4 hover:bg-slate-50">
                  <Link href={`/admin/ivr/${m.id}`} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Mic className="w-5 h-5 text-slate-400" />
                      <div>
                        <div className="font-medium text-slate-900">{m.name}</div>
                        <div className="text-xs text-slate-500"><code>{m.slug}</code> · timeout {m.timeoutSeconds ?? m.timeout_seconds}s · max {m.maxAttempts ?? m.max_attempts} intentos</div>
                      </div>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-xs ${m.isActive ?? m.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                      {m.isActive ?? m.is_active ? 'activo' : 'inactivo'}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Audios subidos (preview rapido) */}
        <div className="rounded-xl border border-slate-200 bg-white">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-semibold text-slate-900 flex items-center gap-2">
              <Volume2 className="w-5 h-5 text-brand-600" /> Audios subidos ({audios.length})
            </h3>
            <Link href="/admin/ivr/audios" className="text-xs text-brand-600 hover:text-brand-700">
              Gestionar audios →
            </Link>
          </div>
          {loading ? (
            <div className="p-6 text-center text-slate-500 text-sm">Cargando…</div>
          ) : audios.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-sm">
              <FileAudio className="w-8 h-8 mx-auto mb-2 text-slate-300" />
              Sin audios todavía. Subí el primero en <Link href="/admin/ivr/audios" className="text-brand-600 hover:underline">Audios</Link>.
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {audios.slice(0, 8).map(a => (
                <li key={a.id} className="px-5 py-2.5 flex items-center gap-3 text-sm">
                  <FileAudio className="w-4 h-4 text-slate-400 shrink-0" />
                  <span className="font-medium text-slate-900 truncate flex-1">{a.name}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                    {PURPOSE_LABEL[a.purpose] ?? a.purpose}
                  </span>
                  {a.format && <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">{a.format}</code>}
                  <span className="text-xs text-slate-500 font-mono">{fmtDur(a.duration_seconds ?? a.durationSeconds)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </AppShell>
  );
}
