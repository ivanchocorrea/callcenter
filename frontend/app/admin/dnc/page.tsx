'use client';

import { FormEvent, useEffect, useState } from 'react';
import { AppShell } from '@/components/shared/AppShell';
import { api, unwrap } from '@/lib/api/client';
import { Plus, Ban, Trash2, Search } from 'lucide-react';

interface List {
  id: number;
  slug: string;
  name: string;
  description: string | null;
}

interface Entry {
  id: number;
  phone: string;
  reason: string | null;
  created_at: string;
}

export default function DncPage() {
  const [lists, setLists] = useState<List[]>([]);
  const [selected, setSelected] = useState<List | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [phoneToCheck, setPhoneToCheck] = useState('');
  const [checkResult, setCheckResult] = useState<any>(null);
  const [openList, setOpenList] = useState(false);

  function reload() {
    setLoading(true);
    api.get('/dnc/lists').then(r => {
      const data = unwrap<List[]>(r);
      setLists(data);
      if (!selected && data.length > 0) setSelected(data[0]);
    }).finally(() => setLoading(false));
  }
  useEffect(() => { reload(); }, []);

  useEffect(() => {
    if (!selected) return;
    api.get(`/dnc/lists/${selected.id}/entries`).then(r => setEntries(unwrap<Entry[]>(r)));
  }, [selected]);

  async function addPhone(phone: string, reason?: string) {
    if (!selected || !phone) return;
    await api.post(`/dnc/lists/${selected.id}/entries`, { phone, reason });
    api.get(`/dnc/lists/${selected.id}/entries`).then(r => setEntries(unwrap<Entry[]>(r)));
  }

  async function checkPhone() {
    if (!phoneToCheck) return;
    const r = await api.post('/dnc/check', { phone: phoneToCheck });
    setCheckResult(unwrap<any>(r));
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-slate-900">Lista DNC (Do Not Call)</h2>
            <p className="text-slate-500 mt-1">Números que NO se deben llamar (campañas, marketing).</p>
          </div>
          <button onClick={() => setOpenList(true)} className="inline-flex items-center gap-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 text-sm font-medium">
            <Plus className="w-4 h-4" /> Nueva lista
          </button>
        </div>

        {/* Verificador rápido */}
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h3 className="font-semibold mb-2 flex items-center gap-2"><Search className="w-4 h-4" /> Verificar número</h3>
          <div className="flex gap-2">
            <input value={phoneToCheck} onChange={e => setPhoneToCheck(e.target.value)} placeholder="+57..."
              className="flex-1 px-3 py-2 border rounded text-sm font-mono" />
            <button onClick={checkPhone} className="px-4 py-2 rounded bg-slate-100 hover:bg-slate-200 text-sm">Verificar</button>
          </div>
          {checkResult && (
            <div className={`mt-2 px-3 py-2 rounded text-sm ${checkResult.blocked ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'}`}>
              {checkResult.blocked ? `🚫 BLOQUEADO en lista "${checkResult.list_name}"` : `✅ Permitido (no está en ninguna lista DNC)`}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Listas */}
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h3 className="font-semibold mb-3">Listas ({lists.length})</h3>
            <ul className="space-y-1">
              {lists.length === 0 && <li className="text-sm text-slate-500">Sin listas todavía.</li>}
              {lists.map(l => (
                <li key={l.id}>
                  <button onClick={() => setSelected(l)}
                    className={`w-full text-left px-3 py-2 rounded text-sm ${selected?.id === l.id ? 'bg-brand-50 text-brand-700 font-medium' : 'hover:bg-slate-50 text-slate-700'}`}>
                    {l.name} <span className="text-xs text-slate-400">({l.slug})</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Entries */}
          <div className="lg:col-span-2 rounded-xl border border-slate-200 bg-white p-4">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <Ban className="w-4 h-4 text-rose-500" />
              {selected ? `Números en "${selected.name}" (${entries.length})` : 'Selecciona una lista'}
            </h3>
            {selected && (
              <>
                <PhoneAddForm onAdd={addPhone} />
                <div className="mt-3 max-h-96 overflow-y-auto">
                  {entries.length === 0 ? (
                    <p className="text-sm text-slate-500 text-center py-6">Sin números en esta lista.</p>
                  ) : (
                    <table className="w-full text-sm">
                      <thead className="text-xs uppercase text-slate-500">
                        <tr>
                          <th className="text-left py-1 px-2">Número</th>
                          <th className="text-left py-1 px-2">Razón</th>
                          <th className="text-left py-1 px-2">Fecha</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {entries.map(e => (
                          <tr key={e.id}>
                            <td className="py-2 px-2 font-mono text-xs">{e.phone}</td>
                            <td className="py-2 px-2 text-slate-700 text-xs">{e.reason ?? '—'}</td>
                            <td className="py-2 px-2 text-xs text-slate-500">{new Date(e.created_at).toLocaleDateString()}</td>
                            <td className="py-2 px-2 text-right">
                              <button onClick={async () => {
                                await api.delete(`/dnc/lists/${selected.id}/entries/${e.id}`);
                                setEntries(entries.filter(x => x.id !== e.id));
                              }} className="text-slate-400 hover:text-rose-600"><Trash2 className="w-3 h-3" /></button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {openList && <ListModal onClose={() => setOpenList(false)} onSaved={() => { setOpenList(false); reload(); }} />}
    </AppShell>
  );
}

function PhoneAddForm({ onAdd }: { onAdd: (p: string, r?: string) => Promise<void> }) {
  const [phone, setPhone] = useState('');
  const [reason, setReason] = useState('');
  return (
    <div className="flex gap-2">
      <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+57..."
        className="flex-1 px-3 py-2 border rounded text-sm font-mono" />
      <input value={reason} onChange={e => setReason(e.target.value)} placeholder="Razón (opcional)"
        className="flex-1 px-3 py-2 border rounded text-sm" />
      <button onClick={async () => { await onAdd(phone, reason); setPhone(''); setReason(''); }}
        className="px-3 py-2 rounded bg-brand-600 text-white text-sm">+ Agregar</button>
    </div>
  );
}

function ListModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function save(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post('/dnc/lists', { slug, name, description });
      onSaved();
    } finally { setSubmitting(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h3 className="text-lg font-semibold">Nueva lista DNC</h3>
          <button onClick={onClose}>✕</button>
        </div>
        <form onSubmit={save} className="px-6 py-5 space-y-3">
          <input value={name} onChange={e => { setName(e.target.value); if (!slug) setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-')); }}
            required placeholder="Nombre" className="w-full px-3 py-2 border rounded text-sm" />
          <input value={slug} onChange={e => setSlug(e.target.value)} required placeholder="slug"
            className="w-full px-3 py-2 border rounded text-sm font-mono" />
          <input value={description} onChange={e => setDescription(e.target.value)} placeholder="Descripción"
            className="w-full px-3 py-2 border rounded text-sm" />
        </form>
        <div className="flex justify-end gap-2 px-6 py-4 border-t bg-slate-50">
          <button onClick={onClose} className="px-4 py-2 text-sm">Cancelar</button>
          <button onClick={save as any} disabled={submitting} className="px-4 py-2 rounded bg-brand-600 text-white text-sm disabled:opacity-50">
            {submitting ? 'Guardando…' : 'Crear'}
          </button>
        </div>
      </div>
    </div>
  );
}
