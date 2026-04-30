'use client';

import { FormEvent, useEffect, useState } from 'react';
import { api, unwrap } from '@/lib/api/client';
import { X, AlertCircle, CreditCard, Users, Headphones, Phone } from 'lucide-react';

interface Props { companyId: number; companyName: string; onClose: () => void; onSaved: () => void; }

interface Plan {
  id: number;
  slug: string;
  name: string;
  description: string;
  price_monthly: number;
  max_users: number | null;
  max_agents: number | null;
  max_concurrent_calls: number | null;
  included_minutes: number | null;
}

interface Limits {
  plan_slug: string | null;
  max_users: number | null;
  max_agents: number | null;
  max_concurrent_calls: number | null;
  current: { users: number; agents: number };
}

export function PlanChangeModal({ companyId, companyName, onClose, onSaved }: Props) {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [currentLimits, setCurrentLimits] = useState<Limits | null>(null);
  const [planSlug, setPlanSlug] = useState('');
  const [isTrial, setIsTrial] = useState(false);
  const [trialDays, setTrialDays] = useState(14);
  const [overrideUsers, setOverrideUsers] = useState('');
  const [overrideAgents, setOverrideAgents] = useState('');
  const [overrideConcurrent, setOverrideConcurrent] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api.get('/billing/plans').then(r => unwrap<Plan[]>(r)),
      api.get(`/billing/companies/${companyId}/limits`).then(r => unwrap<Limits>(r)).catch(() => null),
    ]).then(([ps, lim]) => {
      setPlans(ps);
      if (lim) {
        setCurrentLimits(lim);
        setPlanSlug(lim.plan_slug ?? ps[0]?.slug ?? '');
      } else {
        setPlanSlug(ps[0]?.slug ?? '');
      }
    }).finally(() => setLoading(false));
  }, [companyId]);

  async function handleChangePlan(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!planSlug) return setError('Selecciona un plan');

    setSubmitting(true);
    try {
      // 1. cambiar plan
      await api.post(`/billing/companies/${companyId}/change-plan`, {
        plan_slug: planSlug,
        is_trial: isTrial,
        trial_days: trialDays,
      });
      // 2. aplicar overrides si los hay
      const overrides: any = {};
      if (overrideUsers) overrides.max_users = parseInt(overrideUsers, 10);
      if (overrideAgents) overrides.max_agents = parseInt(overrideAgents, 10);
      if (overrideConcurrent) overrides.max_concurrent_calls = parseInt(overrideConcurrent, 10);
      if (Object.keys(overrides).length > 0) {
        await api.post(`/billing/companies/${companyId}/limits`, overrides);
      }
      onSaved();
      onClose();
    } catch (e: any) {
      const msg = e?.response?.data?.error?.message ?? e?.response?.data?.message ?? 'Error al cambiar plan';
      setError(Array.isArray(msg) ? msg.join(', ') : String(msg));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
        <div className="bg-white rounded-xl p-8 text-slate-500">Cargando…</div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 sticky top-0 bg-white">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-brand-600" /> Plan de "{companyName}"
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">Asigna plan + override de límites custom.</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>

        <form onSubmit={handleChangePlan} className="px-6 py-5 space-y-5">
          {error && <div className="rounded-lg bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-700">{error}</div>}

          {currentLimits && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs uppercase tracking-wide text-slate-500 mb-2">Estado actual</div>
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div>
                  <div className="text-xs text-slate-500 flex items-center gap-1"><Users className="w-3 h-3" /> Usuarios</div>
                  <div className="text-slate-900 mt-0.5"><strong>{currentLimits.current.users}</strong> / {currentLimits.max_users ?? '∞'}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500 flex items-center gap-1"><Headphones className="w-3 h-3" /> Agentes</div>
                  <div className="text-slate-900 mt-0.5"><strong>{currentLimits.current.agents}</strong> / {currentLimits.max_agents ?? '∞'}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500 flex items-center gap-1"><Phone className="w-3 h-3" /> Llam. simult.</div>
                  <div className="text-slate-900 mt-0.5">{currentLimits.max_concurrent_calls ?? '∞'}</div>
                </div>
              </div>
              <div className="mt-2 text-xs text-slate-500">Plan vigente: <code className="bg-white px-1.5 py-0.5 rounded">{currentLimits.plan_slug ?? 'sin plan'}</code></div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Nuevo plan</label>
            <div className="space-y-2">
              {plans.map(p => (
                <label key={p.slug} className={`flex items-start gap-3 px-3 py-3 border rounded-lg cursor-pointer ${planSlug === p.slug ? 'border-brand-500 bg-brand-50' : 'border-slate-200 hover:bg-slate-50'}`}>
                  <input type="radio" name="plan" value={p.slug} checked={planSlug === p.slug} onChange={() => setPlanSlug(p.slug)} className="mt-1" />
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <div className="font-medium text-slate-900">{p.name}</div>
                      <div className="text-sm font-semibold text-slate-900">${p.price_monthly}/mes</div>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">{p.description}</p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-slate-600">
                      <span>👤 {p.max_users ?? '∞'} usuarios</span>
                      <span>🎧 {p.max_agents ?? '∞'} agentes</span>
                      <span>📞 {p.max_concurrent_calls ?? '∞'} simult.</span>
                      <span>⏱ {p.included_minutes?.toLocaleString() ?? '∞'} min</span>
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-amber-900">Override custom de límites (opcional)</p>
                <p className="text-xs text-amber-800 mt-0.5">Sólo si el cliente VIP necesita MÁS de lo que da el plan estándar. Deja vacío para usar los del plan.</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 mt-3">
              <div>
                <label className="block text-xs font-medium text-amber-900 mb-1">Max usuarios</label>
                <input type="number" value={overrideUsers} onChange={e => setOverrideUsers(e.target.value)}
                  placeholder="del plan" min={1}
                  className="w-full px-2 py-1.5 border border-amber-300 rounded text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-amber-900 mb-1">Max agentes</label>
                <input type="number" value={overrideAgents} onChange={e => setOverrideAgents(e.target.value)}
                  placeholder="del plan" min={1}
                  className="w-full px-2 py-1.5 border border-amber-300 rounded text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-amber-900 mb-1">Llam. simult.</label>
                <input type="number" value={overrideConcurrent} onChange={e => setOverrideConcurrent(e.target.value)}
                  placeholder="del plan" min={1}
                  className="w-full px-2 py-1.5 border border-amber-300 rounded text-sm" />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 text-sm">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={isTrial} onChange={e => setIsTrial(e.target.checked)} />
              <span>Asignar como periodo de prueba (trial)</span>
            </label>
            {isTrial && (
              <input type="number" value={trialDays} onChange={e => setTrialDays(parseInt(e.target.value, 10))} min={1} max={90}
                className="w-16 px-2 py-1 border border-slate-300 rounded text-sm" />
            )}
            {isTrial && <span className="text-xs text-slate-500">días</span>}
          </div>
        </form>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-200 bg-slate-50 sticky bottom-0">
          <button type="button" onClick={onClose} disabled={submitting} className="px-4 py-2 text-sm font-medium text-slate-700 disabled:opacity-50">Cancelar</button>
          <button type="button" onClick={handleChangePlan as any} disabled={submitting} className="px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-sm font-medium">
            {submitting ? 'Guardando…' : 'Aplicar plan + límites'}
          </button>
        </div>
      </div>
    </div>
  );
}
