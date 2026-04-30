'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/shared/AppShell';
import { api, unwrap } from '@/lib/api/client';
import { Plus, Mic } from 'lucide-react';
import Link from 'next/link';

export default function IvrListPage() {
  const [menus, setMenus] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/ivr')
      .then(r => setMenus(unwrap<any[]>(r)))
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
          <Link
            href="/admin/ivr/new"
            className="inline-flex items-center gap-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 text-sm font-medium"
          >
            <Plus className="w-4 h-4" /> Nuevo IVR
          </Link>
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

        <Link
          href="/admin/ivr/audio"
          className="inline-flex items-center gap-2 text-sm text-brand-600 hover:text-brand-700"
        >
          <Mic className="w-4 h-4" /> Gestionar audios IVR →
        </Link>
      </div>
    </AppShell>
  );
}
