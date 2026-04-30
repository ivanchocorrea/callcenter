'use client';

import { AppShell } from '@/components/shared/AppShell';
import { Check, X } from 'lucide-react';

interface Plan {
  slug: string;
  name: string;
  description: string;
  price: string;
  features: { label: string; included: boolean }[];
  highlight?: boolean;
}

const PLANS: Plan[] = [
  {
    slug: 'free',
    name: 'Free',
    description: 'Plan gratuito de prueba (limitado)',
    price: '$0',
    features: [
      { label: 'Hasta 3 usuarios', included: true },
      { label: 'Hasta 2 agentes', included: true },
      { label: '2 llamadas concurrentes', included: true },
      { label: '100 minutos incluidos', included: true },
      { label: 'Grabaciones', included: true },
      { label: 'Webhooks', included: true },
      { label: 'IA conversacional', included: false },
      { label: 'SMS', included: false },
      { label: 'Campañas masivas', included: false },
    ],
  },
  {
    slug: 'pro',
    name: 'Pro',
    description: 'Plan profesional con IA y SMS',
    price: '$99',
    highlight: true,
    features: [
      { label: 'Hasta 25 usuarios', included: true },
      { label: 'Hasta 25 agentes', included: true },
      { label: '25 llamadas concurrentes', included: true },
      { label: '5,000 minutos incluidos', included: true },
      { label: 'Grabaciones', included: true },
      { label: 'Webhooks', included: true },
      { label: 'IA conversacional', included: true },
      { label: 'SMS', included: true },
      { label: 'Campañas masivas', included: true },
    ],
  },
  {
    slug: 'enterprise',
    name: 'Enterprise',
    description: 'Plan empresarial sin límites',
    price: '$499',
    features: [
      { label: 'Usuarios ilimitados', included: true },
      { label: 'Agentes ilimitados', included: true },
      { label: 'Llamadas concurrentes ilimitadas', included: true },
      { label: 'Minutos ilimitados', included: true },
      { label: 'Grabaciones', included: true },
      { label: 'Webhooks', included: true },
      { label: 'IA conversacional', included: true },
      { label: 'SMS', included: true },
      { label: 'Campañas masivas', included: true },
      { label: 'Branding personalizado', included: true },
      { label: 'SSO', included: true },
      { label: 'Soporte prioritario', included: true },
    ],
  },
];

export default function PlansPage() {
  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Planes</h2>
          <p className="text-slate-500 mt-1">
            Planes disponibles para las empresas del SaaS. Estos se asignan al crear una nueva empresa.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {PLANS.map(plan => (
            <div
              key={plan.slug}
              className={`rounded-xl border bg-white p-6 shadow-sm flex flex-col ${
                plan.highlight ? 'border-brand-500 ring-2 ring-brand-500/20' : 'border-slate-200'
              }`}
            >
              {plan.highlight && (
                <div className="inline-flex self-start mb-3 px-2 py-0.5 rounded-full bg-brand-100 text-brand-700 text-xs font-medium">
                  Más popular
                </div>
              )}
              <h3 className="text-xl font-semibold text-slate-900">{plan.name}</h3>
              <p className="text-sm text-slate-500 mt-1">{plan.description}</p>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-3xl font-bold text-slate-900">{plan.price}</span>
                <span className="text-sm text-slate-500">USD/mes</span>
              </div>
              <ul className="mt-5 space-y-2 flex-1">
                {plan.features.map((f, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    {f.included ? (
                      <Check className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                    ) : (
                      <X className="w-4 h-4 text-slate-300 mt-0.5 shrink-0" />
                    )}
                    <span className={f.included ? 'text-slate-700' : 'text-slate-400 line-through'}>
                      {f.label}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="mt-6 pt-4 border-t border-slate-100">
                <code className="text-xs bg-slate-100 px-2 py-1 rounded text-slate-700">slug: {plan.slug}</code>
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-600">
          <p className="font-medium text-slate-900 mb-2">Sobre los planes</p>
          <p>
            Estos planes están definidos en la base de datos en la tabla <code className="bg-white px-1.5 py-0.5 rounded text-xs">plans</code>.
            Para editar los precios o features, hazlo directamente en la BD por ahora.
            En el futuro habrá un editor visual aquí.
          </p>
        </div>
      </div>
    </AppShell>
  );
}
