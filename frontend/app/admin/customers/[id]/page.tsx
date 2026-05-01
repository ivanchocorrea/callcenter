'use client';

import { FormEvent, use, useEffect, useState } from 'react';
import { AppShell } from '@/components/shared/AppShell';
import { api, unwrap } from '@/lib/api/client';
import { ArrowLeft, Phone, Mail, MapPin, Building2, Star, Plus, Calendar, MessageSquare, FileText, Pin } from 'lucide-react';
import Link from 'next/link';
import { toastShow } from '@/lib/ui/dialog-helper';

interface Customer {
  id: number;
  full_name: string;
  primary_phone: string | null;
  email: string | null;
  document_type: string | null;
  document_number: string | null;
  company_name: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  status: string;
  is_vip: boolean;
  important_notes: string | null;
  created_at: string;
}

interface Note {
  id: number;
  content: string;
  note_type: string;
  is_pinned: boolean;
  created_at: string;
  author_name: string | null;
}

interface TimelineEvent {
  type: string;
  ts: string;
  title: string;
  detail?: string;
}

export default function CustomerDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = use(props.params);
  const id = parseInt(params.id, 10);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newNote, setNewNote] = useState('');
  const [noteType, setNoteType] = useState<'general'|'important'|'followup'|'internal'|'warning'>('general');
  const [savingNote, setSavingNote] = useState(false);

  function loadAll() {
    setLoading(true);
    Promise.all([
      api.get(`/customers/${id}`).then(r => unwrap<any>(r)),
      api.get(`/customers/${id}/notes`).then(r => unwrap<Note[]>(r)).catch(() => []),
      api.get(`/customers/${id}/timeline`).then(r => unwrap<TimelineEvent[]>(r)).catch(() => []),
    ]).then(([c, n, t]) => {
      setCustomer({
        ...c,
        full_name: c.fullName ?? c.full_name,
        primary_phone: c.primaryPhone ?? c.primary_phone,
        document_type: c.documentType ?? c.document_type,
        document_number: c.documentNumber ?? c.document_number,
        company_name: c.companyName ?? c.company_name,
        important_notes: c.importantNotes ?? c.important_notes,
        is_vip: c.isVip ?? c.is_vip,
        created_at: c.createdAt ?? c.created_at,
      });
      setNotes(n);
      setTimeline(t);
      setError(null);
    }).catch(e => setError(e?.response?.data?.error?.message ?? 'Error al cargar'))
    .finally(() => setLoading(false));
  }
  useEffect(() => { loadAll(); }, [id]);

  async function handleAddNote(e: FormEvent) {
    e.preventDefault();
    if (!newNote.trim()) return;
    setSavingNote(true);
    try {
      await api.post(`/customers/${id}/notes`, { content: newNote, note_type: noteType });
      setNewNote('');
      loadAll();
    } catch (e: any) {
      toastShow(e?.response?.data?.error?.message ?? 'Error al guardar nota', 'danger');
    } finally {
      setSavingNote(false);
    }
  }

  if (loading) return <AppShell><div className="text-slate-500">Cargando…</div></AppShell>;
  if (error || !customer) return <AppShell><div className="text-rose-600">{error ?? 'Cliente no encontrado'}</div></AppShell>;

  return (
    <AppShell>
      <div className="space-y-6 max-w-5xl">
        <Link href="/admin/customers" className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900">
          <ArrowLeft className="w-4 h-4" /> Volver a clientes
        </Link>

        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-semibold text-slate-900">{customer.full_name}</h2>
              {customer.is_vip && <Star className="w-5 h-5 text-amber-400 fill-amber-400" />}
              <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                customer.status === 'active' ? 'bg-emerald-100 text-emerald-700' :
                customer.status === 'prospect' ? 'bg-amber-100 text-amber-700' :
                customer.status === 'blocked' ? 'bg-rose-100 text-rose-700' :
                'bg-slate-100 text-slate-700'
              }`}>{customer.status}</span>
            </div>
            <p className="text-sm text-slate-500 mt-1">Cliente #{customer.id} · creado {new Date(customer.created_at).toLocaleDateString()}</p>
          </div>
        </div>

        {customer.important_notes && (
          <div className="rounded-xl border-l-4 border-amber-400 bg-amber-50 p-4">
            <p className="text-sm font-medium text-amber-900">⚠️ Notas importantes</p>
            <p className="text-sm text-amber-800 mt-1 whitespace-pre-line">{customer.important_notes}</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">

            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <h3 className="font-semibold text-slate-900 mb-3">Información de contacto</h3>
              <dl className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-slate-400" />
                  <span className="text-slate-700">{customer.primary_phone ?? '—'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-slate-400" />
                  <span className="text-slate-700">{customer.email ?? '—'}</span>
                </div>
                {customer.document_number && (
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-slate-400" />
                    <span className="text-slate-700">{customer.document_type} {customer.document_number}</span>
                  </div>
                )}
                {customer.company_name && (
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-slate-400" />
                    <span className="text-slate-700">{customer.company_name}</span>
                  </div>
                )}
                {(customer.address || customer.city || customer.country) && (
                  <div className="flex items-start gap-2">
                    <MapPin className="w-4 h-4 text-slate-400 mt-0.5" />
                    <span className="text-slate-700">
                      {[customer.address, customer.city, customer.state, customer.country].filter(Boolean).join(', ')}
                    </span>
                  </div>
                )}
              </dl>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-brand-600" /> Línea de tiempo
              </h3>
              {timeline.length === 0 ? (
                <p className="text-sm text-slate-500 py-6 text-center">Sin actividad registrada todavía.</p>
              ) : (
                <ul className="space-y-3">
                  {timeline.map((ev, i) => (
                    <li key={i} className="flex gap-3 text-sm">
                      <div className="w-2 h-2 rounded-full bg-brand-500 mt-1.5 shrink-0" />
                      <div className="flex-1">
                        <div className="font-medium text-slate-900">{ev.title}</div>
                        {ev.detail && <p className="text-slate-600 text-xs">{ev.detail}</p>}
                        <p className="text-xs text-slate-400 mt-0.5">{new Date(ev.ts).toLocaleString()}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div>
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-brand-600" /> Notas
              </h3>
              <form onSubmit={handleAddNote} className="space-y-2 mb-4">
                <textarea value={newNote} onChange={e => setNewNote(e.target.value)} rows={3}
                  placeholder="Agregar nota..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                <div className="flex gap-2">
                  <select value={noteType} onChange={e => setNoteType(e.target.value as any)}
                    className="flex-1 px-2 py-1.5 border border-slate-300 rounded text-xs">
                    <option value="general">General</option>
                    <option value="important">⭐ Importante</option>
                    <option value="followup">📌 Seguimiento</option>
                    <option value="internal">🔒 Interno</option>
                    <option value="warning">⚠️ Advertencia</option>
                  </select>
                  <button type="submit" disabled={savingNote || !newNote.trim()}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-xs font-medium">
                    <Plus className="w-3 h-3" /> {savingNote ? '…' : 'Guardar'}
                  </button>
                </div>
              </form>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {notes.length === 0 ? (
                  <p className="text-sm text-slate-500 text-center py-4">Sin notas todavía.</p>
                ) : (
                  notes.map(n => (
                    <div key={n.id} className="border border-slate-100 rounded-lg p-3 text-sm">
                      <div className="flex items-start justify-between">
                        <p className="text-slate-700 whitespace-pre-line flex-1">{n.content}</p>
                        {n.is_pinned && <Pin className="w-3 h-3 text-amber-500" />}
                      </div>
                      <div className="text-xs text-slate-400 mt-1.5 flex items-center gap-2">
                        <span>{n.author_name ?? 'Sistema'}</span>
                        <span>·</span>
                        <span>{new Date(n.created_at).toLocaleString()}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
