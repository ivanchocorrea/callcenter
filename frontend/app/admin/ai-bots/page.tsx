'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/shared/AppShell';
import { api, unwrap } from '@/lib/api/client';
import { Plus, Bot, Sparkles } from 'lucide-react';
import { BotFormModal } from './BotFormModal';

interface BotItem {
  id: number;
  name: string;
  provider: string;
  model: string;
  status: string;
}

export default function AiBotsPage() {
  const [bots, setBots] = useState<BotItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openCreate, setOpenCreate] = useState(false);

  function reload() {
    setLoading(true);
    api.get('/ai/bots')
      .then(res => setBots(unwrap<BotItem[]>(res)))
      .catch(e => setError(e?.response?.data?.error?.message ?? 'Error al cargar bots'))
      .finally(() => setLoading(false));
  }
  useEffect(() => { reload(); }, []);

  return (
    <AppShell>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-slate-900">Bots de IA</h2>
            <p className="text-slate-500 mt-1">Asistentes conversacionales para atender llamadas con IA.</p>
          </div>
          <button onClick={() => setOpenCreate(true)} className="inline-flex items-center gap-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 text-sm font-medium">
            <Plus className="w-4 h-4" /> Nuevo bot
          </button>
        </div>

        <div className="rounded-xl border border-slate-200 bg-gradient-to-r from-violet-50 to-blue-50 p-5 flex gap-3">
          <Sparkles className="w-5 h-5 text-violet-600 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-slate-900">Proveedores soportados</p>
            <p className="text-slate-600 mt-1">OpenAI (GPT-4, GPT-4o) · Anthropic (Claude 3.5) · Google (Gemini Pro) · Generic HTTP. Cada bot puede usar uno distinto.</p>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Bot</th>
                <th className="text-left px-4 py-3 font-medium">Proveedor</th>
                <th className="text-left px-4 py-3 font-medium">Modelo</th>
                <th className="text-left px-4 py-3 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-500">Cargando…</td></tr>}
              {error && <tr><td colSpan={4} className="px-4 py-8 text-center text-rose-600">{error}</td></tr>}
              {!loading && !error && bots.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-12 text-center text-slate-500"><Bot className="w-8 h-8 mx-auto mb-2 text-slate-300" />No hay bots configurados todavía.</td></tr>
              )}
              {bots.map(b => (
                <tr key={b.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">{b.name}</td>
                  <td className="px-4 py-3 text-slate-700">{b.provider}</td>
                  <td className="px-4 py-3 text-slate-700"><code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs">{b.model}</code></td>
                  <td className="px-4 py-3"><span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">{b.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {openCreate && <BotFormModal onClose={() => setOpenCreate(false)} onSaved={reload} />}
    </AppShell>
  );
}
