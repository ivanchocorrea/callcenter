'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { tokens } from '@/lib/api/client';
import { ShieldAlert } from 'lucide-react';

export default function ImpersonatePage() {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const access = params.get('access');
    const refresh = params.get('refresh');
    const target = params.get('target') ?? 'usuario';

    if (!access || !refresh) {
      setError('Faltan tokens en la URL. Vuelve a iniciar la impersonación desde super-admin.');
      return;
    }

    // Marca esta pestaña como impersonation. Usa sessionStorage = sesión independiente.
    tokens.startImpersonation(access, refresh);

    // Limpia la URL (no queremos que el access_token quede en el historial)
    window.history.replaceState({}, '', '/');

    // Pequeño delay para que el banner sea visible antes del redirect
    const t = setTimeout(() => {
      window.location.href = '/';
    }, 1500);
    return () => clearTimeout(t);
  }, [params, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 to-rose-50 p-6">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-amber-200 p-8 text-center">
        <div className="w-16 h-16 mx-auto rounded-full bg-amber-100 flex items-center justify-center mb-4">
          <ShieldAlert className="w-8 h-8 text-amber-600" />
        </div>
        <h1 className="text-xl font-bold text-slate-900">Iniciando impersonation</h1>
        {error ? (
          <p className="mt-3 text-sm text-rose-600">{error}</p>
        ) : (
          <>
            <p className="mt-3 text-sm text-slate-600">
              Esta pestaña abrirá una sesión independiente del usuario. Tu sesión de super_admin en otras pestañas no se verá afectada.
            </p>
            <p className="mt-3 text-xs text-amber-700 bg-amber-50 px-3 py-2 rounded-lg">
              Sesión limitada a 30 minutos. Toda actividad queda auditada.
            </p>
            <div className="mt-6">
              <div className="inline-block w-6 h-6 border-2 border-amber-300 border-t-amber-600 rounded-full animate-spin" />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
