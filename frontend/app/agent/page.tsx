'use client';

import { useState } from 'react';
import { AppShell } from '@/components/shared/AppShell';
import {
  Phone,
  PhoneOff,
  Pause,
  Play,
  Mic,
  MicOff,
  PhoneForwarded,
  PhoneIncoming,
  Coffee,
  GraduationCap,
  Power,
} from 'lucide-react';

type AgentStatus = 'available' | 'busy' | 'paused' | 'lunch' | 'training' | 'offline';

const STATUSES: { key: AgentStatus; label: string; icon: any; color: string }[] = [
  { key: 'available', label: 'Disponible', icon: Phone, color: 'bg-emerald-500' },
  { key: 'busy',      label: 'Ocupado',    icon: PhoneIncoming, color: 'bg-amber-500' },
  { key: 'paused',    label: 'En pausa',   icon: Pause, color: 'bg-slate-400' },
  { key: 'lunch',     label: 'Almuerzo',   icon: Coffee, color: 'bg-orange-500' },
  { key: 'training',  label: 'Capacitación', icon: GraduationCap, color: 'bg-indigo-500' },
  { key: 'offline',   label: 'Offline',    icon: Power, color: 'bg-slate-700' },
];

export default function AgentDesktop() {
  const [status, setStatus] = useState<AgentStatus>('offline');
  const [muted, setMuted] = useState(false);
  const [onHold, setOnHold] = useState(false);

  return (
    <AppShell>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Estado del agente + controles */}
        <div className="lg:col-span-1 space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="text-xs uppercase tracking-wide text-slate-500 mb-2">Mi estado</div>
            <div className="grid grid-cols-2 gap-2">
              {STATUSES.map(s => {
                const Icon = s.icon;
                const active = status === s.key;
                return (
                  <button
                    key={s.key}
                    onClick={() => setStatus(s.key)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition border ${
                      active
                        ? 'bg-brand-50 border-brand-300 text-brand-700'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${s.color}`} />
                    <Icon className="w-4 h-4" />
                    {s.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="text-xs uppercase tracking-wide text-slate-500 mb-2">Controles de llamada</div>
            <div className="grid grid-cols-3 gap-2">
              <button className="flex flex-col items-center gap-1 px-3 py-3 rounded-lg bg-emerald-500 text-white text-xs font-medium hover:bg-emerald-600">
                <Phone className="w-5 h-5" /> Contestar
              </button>
              <button className="flex flex-col items-center gap-1 px-3 py-3 rounded-lg bg-rose-500 text-white text-xs font-medium hover:bg-rose-600">
                <PhoneOff className="w-5 h-5" /> Colgar
              </button>
              <button
                onClick={() => setOnHold(v => !v)}
                className="flex flex-col items-center gap-1 px-3 py-3 rounded-lg bg-amber-500 text-white text-xs font-medium hover:bg-amber-600"
              >
                {onHold ? <Play className="w-5 h-5" /> : <Pause className="w-5 h-5" />}
                {onHold ? 'Reanudar' : 'En espera'}
              </button>
              <button
                onClick={() => setMuted(v => !v)}
                className={`flex flex-col items-center gap-1 px-3 py-3 rounded-lg text-white text-xs font-medium ${
                  muted ? 'bg-slate-600 hover:bg-slate-700' : 'bg-slate-500 hover:bg-slate-600'
                }`}
              >
                {muted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                {muted ? 'Activar mic' : 'Silenciar'}
              </button>
              <button className="flex flex-col items-center gap-1 px-3 py-3 rounded-lg bg-indigo-500 text-white text-xs font-medium hover:bg-indigo-600">
                <PhoneForwarded className="w-5 h-5" /> Transferir
              </button>
              <button className="flex flex-col items-center gap-1 px-3 py-3 rounded-lg bg-slate-200 text-slate-700 text-xs font-medium hover:bg-slate-300">
                Marcar salida
              </button>
            </div>
          </div>
        </div>

        {/* Llamada actual / cliente */}
        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-6 min-h-[200px]">
            <div className="text-xs uppercase tracking-wide text-slate-500">Llamada actual</div>
            <div className="mt-4 flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                <Phone className="w-7 h-7" />
              </div>
              <div>
                <div className="text-lg font-semibold text-slate-900">Sin llamada activa</div>
                <div className="text-sm text-slate-500">Cuando entre una llamada, verás aquí los datos del cliente.</div>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <div className="text-xs uppercase tracking-wide text-slate-500">Notas y tipificación</div>
            <textarea
              placeholder="Escribe notas durante o después de la llamada…"
              className="mt-3 w-full min-h-[120px] rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
              disabled
            />
            <div className="mt-3 grid grid-cols-2 gap-3">
              <select disabled className="rounded-lg border border-slate-200 px-3 py-2 text-sm bg-slate-50 text-slate-400">
                <option>Tipificación —</option>
              </select>
              <select disabled className="rounded-lg border border-slate-200 px-3 py-2 text-sm bg-slate-50 text-slate-400">
                <option>Resultado —</option>
              </select>
            </div>
            <p className="text-xs text-slate-400 mt-3">
              Funcionalidad disponible cuando esté activa una llamada (Fase 6+).
            </p>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
