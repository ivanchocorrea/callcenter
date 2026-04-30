'use client';

import { ReactNode } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';

const TONE_MAP: Record<string, string> = {
  amber:   'bg-amber-600 hover:bg-amber-700',
  rose:    'bg-rose-600 hover:bg-rose-700',
  emerald: 'bg-emerald-600 hover:bg-emerald-700',
  brand:   'bg-brand-600 hover:bg-brand-700',
};

export function ConfirmDialog({
  open, title, message, confirmText = 'Confirmar', confirmTone = 'amber',
  onCancel, onConfirm, busy = false,
}: {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmText?: string;
  confirmTone?: 'amber' | 'rose' | 'emerald' | 'brand';
  onCancel: () => void;
  onConfirm: () => void;
  busy?: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl border border-slate-200 max-w-md w-full p-6">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-6 h-6 text-amber-600" />
          <div>
            <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
            <div className="text-sm text-slate-600 mt-1">{message}</div>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={onCancel} disabled={busy}
            className="px-4 py-2 rounded-md bg-white border border-slate-300 text-sm hover:bg-slate-50 disabled:opacity-50"
          >Cancelar</button>
          <button
            onClick={onConfirm} disabled={busy}
            className={`px-4 py-2 rounded-md text-white text-sm disabled:opacity-50 inline-flex items-center gap-2 ${TONE_MAP[confirmTone]}`}
          >
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
