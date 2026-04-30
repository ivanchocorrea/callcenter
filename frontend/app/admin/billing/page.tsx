'use client';

import { AppShell } from '@/components/shared/AppShell';
import { CreditCard } from 'lucide-react';

export default function BillingPage() {
  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Facturación</h2>
          <p className="text-slate-500 mt-1">Plan actual, consumo, facturas y métodos de pago.</p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="text-xs uppercase tracking-wide text-slate-500">Plan actual</div>
            <div className="mt-2 text-2xl font-semibold text-slate-900">Free</div>
            <p className="text-xs text-slate-500 mt-1">Hasta 2 agentes</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="text-xs uppercase tracking-wide text-slate-500">Consumo del mes</div>
            <div className="mt-2 text-2xl font-semibold text-slate-900">0 min</div>
            <p className="text-xs text-slate-500 mt-1">de 100 incluidos</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="text-xs uppercase tracking-wide text-slate-500">Próxima factura</div>
            <div className="mt-2 text-2xl font-semibold text-slate-900">$0.00</div>
            <p className="text-xs text-slate-500 mt-1">USD</p>
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-12 text-center">
          <CreditCard className="w-12 h-12 mx-auto text-slate-300" />
          <p className="mt-4 text-slate-600">Sin facturas todavía.</p>
        </div>
      </div>
    </AppShell>
  );
}
