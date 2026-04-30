'use client';

import { AppShell } from '@/components/shared/AppShell';
import { Phone, PhoneOff, Volume2, AlertCircle } from 'lucide-react';

/**
 * Pantalla de llamada entrante (preview UI).
 * En Fase 6 se conecta con el evento Socket.IO `call.incoming` y reproduce timbre.
 */
export default function IncomingCallPage() {
  return (
    <AppShell>
      <div className="max-w-3xl mx-auto">
        <div className="rounded-2xl border-4 border-brand-500 bg-white shadow-xl p-8 animate-pulse-slow">
          <div className="flex items-center gap-3 text-brand-600">
            <Phone className="w-6 h-6 animate-pulse" />
            <span className="text-sm font-semibold uppercase tracking-wide">Llamada entrante</span>
          </div>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <div className="text-3xl font-bold text-slate-900">Iván Correa</div>
              <div className="mt-1 text-slate-500">+57 300 111 2233</div>
              <div className="mt-3 inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 text-xs font-medium">
                <AlertCircle className="w-3.5 h-3.5" /> Cliente VIP
              </div>
            </div>
            <div className="text-sm text-slate-600 space-y-1">
              <div><span className="text-slate-400">Cola:</span> Soporte</div>
              <div><span className="text-slate-400">Última llamada:</span> ayer</div>
              <div><span className="text-slate-400">Tickets abiertos:</span> 1</div>
              <div><span className="text-slate-400">Citas próximas:</span> mañana 10:00 a.m.</div>
            </div>
          </div>

          <div className="mt-6 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
            <strong>Nota importante:</strong> Cliente reportó cobro duplicado el mes pasado. Revisar antes de confirmar pagos.
          </div>

          <div className="mt-6 flex gap-3">
            <button className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-4 text-base font-semibold">
              <Phone className="w-5 h-5" /> Contestar
            </button>
            <button className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-rose-500 hover:bg-rose-600 text-white px-6 py-4 text-base font-semibold">
              <PhoneOff className="w-5 h-5" /> Rechazar
            </button>
            <button className="rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-4">
              <Volume2 className="w-5 h-5" />
            </button>
          </div>
        </div>

        <p className="text-xs text-slate-400 text-center mt-4">
          Vista previa. En Fase 6 se conectará al evento Socket.IO real y reproducirá el timbre del navegador.
        </p>
      </div>
    </AppShell>
  );
}
