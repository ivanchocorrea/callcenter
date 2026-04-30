'use client';

import { CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';

const TONE: Record<string, { bg: string; Icon: any }> = {
  ok:   { bg: 'bg-emerald-600', Icon: CheckCircle2 },
  warn: { bg: 'bg-amber-600',   Icon: AlertTriangle },
  err:  { bg: 'bg-rose-600',    Icon: XCircle },
};

export function Toast({ msg, tone }: { msg: string; tone: 'ok' | 'warn' | 'err' }) {
  const t = TONE[tone];
  const Icon = t.Icon;
  return (
    <div className="fixed bottom-6 right-6 z-50 max-w-sm">
      <div className={`${t.bg} text-white rounded-lg shadow-lg px-4 py-3 flex items-start gap-2 text-sm`}>
        <Icon className="w-5 h-5 flex-shrink-0 mt-0.5" />
        <div>{msg}</div>
      </div>
    </div>
  );
}
