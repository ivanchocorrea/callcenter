'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useRealtime } from '@/lib/realtime/realtime-context';
import { useSip } from '@/lib/webrtc/sip-context';
import { Phone, PhoneOff, Volume2, VolumeX, AlertCircle } from 'lucide-react';

interface IncomingPayload {
  type: 'call.incoming';
  call_id: number;
  from_number: string;
  from_name?: string | null;
  to_number?: string | null;
  customer?: {
    id: number;
    name: string;
    is_vip: boolean;
    important_notes: string | null;
  } | null;
}

/**
 * Popup global de llamada entrante. Se muestra al recibir un evento
 * `call.incoming` por Socket.IO. Reproduce un timbre y permite contestar
 * o rechazar. Al contestar, integra con SIP.js (useSip) para conectar el audio.
 */
export function IncomingCallPopup() {
  const realtime = useRealtime();
  const sip = useSip();
  const pathname = usePathname();
  const [incoming, setIncoming] = useState<IncomingPayload | null>(null);
  const [muted, setMuted] = useState(false);
  const ringRef = useRef<HTMLAudioElement | null>(null);

  // En /agent/dialer YA hay un banner de llamada entrante integrado
  // (mucho más rico). Para evitar duplicar, ocultamos este popup global ahí.
  const isInDialer = pathname === '/agent/dialer';

  // Conectar listener
  useEffect(() => {
    const off = realtime.on('call.incoming', (payload: IncomingPayload) => {
      setIncoming(payload);
    });
    const offRinging = realtime.on('call.ringing', () => {/* opcional */});
    const offEnded = realtime.on('call.ended', () => setIncoming(null));
    return () => { off(); offRinging(); offEnded(); };
  }, [realtime]);

  // Timbre — ya no usamos /sounds/ring.mp3 (que daba 404). Generamos el
  // tono con Web Audio API, sin necesidad de archivos.
  useEffect(() => {
    if (!incoming || muted) return;
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    let stopped = false;

    function beep() {
      if (stopped) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.setValueAtTime(480, ctx.currentTime + 0.4);
      gain.gain.setValueAtTime(0.001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.4);
      osc.start();
      osc.stop(ctx.currentTime + 1.5);
      setTimeout(beep, 2500);  // patrón ring-ring cada 2.5s
    }
    beep();

    return () => { stopped = true; ctx.close().catch(() => undefined); };
  }, [incoming, muted]);

  // Si SIP recibe un INVITE en paralelo, también lo aprovechamos
  useEffect(() => {
    if (sip.incoming && !incoming) {
      // Caso fallback: solo SIP, sin Socket.IO
      setIncoming({
        type: 'call.incoming',
        call_id: 0,
        from_number: sip.incoming.fromNumber,
        from_name: sip.incoming.displayName,
        customer: null,
      });
    }
  }, [sip.incoming, incoming]);

  if (!incoming) return null;
  if (isInDialer) return null; // el dialer ya tiene su propio banner

  const customer = incoming.customer;

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        <div className="bg-gradient-to-r from-brand-600 to-brand-700 text-white p-6">
          <div className="flex items-center gap-2 text-brand-100 text-sm">
            <Phone className="w-4 h-4 animate-pulse" /> Llamada entrante
          </div>
          <div className="mt-2 text-3xl font-bold">
            {customer?.name ?? incoming.from_name ?? incoming.from_number}
          </div>
          <div className="text-brand-100">{incoming.from_number}</div>
          {customer?.is_vip && (
            <div className="mt-3 inline-flex items-center gap-1 bg-amber-400 text-amber-900 px-2 py-1 rounded-full text-xs font-semibold">
              <AlertCircle className="w-3.5 h-3.5" /> Cliente VIP
            </div>
          )}
        </div>

        {customer?.important_notes && (
          <div className="bg-amber-50 border-y border-amber-200 px-6 py-3 text-sm text-amber-900">
            <strong>Nota importante:</strong> {customer.important_notes}
          </div>
        )}

        <div className="p-6 flex gap-3">
          <button
            onClick={async () => {
              ringRef.current?.pause();
              await sip.answer().catch(() => undefined);
              setIncoming(null);
            }}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-4 text-base font-semibold"
          >
            <Phone className="w-5 h-5" /> Contestar
          </button>
          <button
            onClick={async () => {
              ringRef.current?.pause();
              await sip.hangup().catch(() => undefined);
              setIncoming(null);
            }}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-rose-500 hover:bg-rose-600 text-white px-6 py-4 text-base font-semibold"
          >
            <PhoneOff className="w-5 h-5" /> Rechazar
          </button>
          <button
            onClick={() => setMuted(m => !m)}
            className="rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-4"
            title={muted ? 'Activar timbre' : 'Silenciar timbre'}
          >
            {muted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
          </button>
        </div>
      </div>
    </div>
  );
}
