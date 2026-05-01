'use client';

import { FormEvent, useEffect, useState } from 'react';
import { AppShell } from '@/components/shared/AppShell';
import { api, unwrap } from '@/lib/api/client';
import { Plus, Clock, Calendar, Trash2 } from 'lucide-react';

const DAYS = [
  { v: 'mon', l: 'Lunes' },
  { v: 'tue', l: 'Martes' },
  { v: 'wed', l: 'Miércoles' },
  { v: 'thu', l: 'Jueves' },
  { v: 'fri', l: 'Viernes' },
  { v: 'sat', l: 'Sábado' },
  { v: 'sun', l: 'Domingo' },
];

interface Hours {
  id: number;
  name: string;
  timezone: string;
  schedule: Record<string, Array<{ from: string; to: string }>>;
  is_default: boolean;
}

interface Holiday {
  id: number;
  name: string;
  holiday_date: string;
  is_recurring: boolean;
  country: string | null;
}

export default function SchedulesPage() {
  const [hours, setHours] = useState<Hours[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);
  const [openHours, setOpenHours] = useState(false);
  const [openHoliday, setOpenHoliday] = useState(false);

  function reload() {
    setLoading(true);
    Promise.all([
      api.get('/schedules/business-hours').then(r => unwrap<Hours[]>(r)),
      api.get('/schedules/holidays').then(r => unwrap<Holiday[]>(r)),
    ]).then(([h, hd]) => { setHours(h); setHolidays(hd); }).finally(() => setLoading(false));
  }
  useEffect(() => { reload(); }, []);

  async function deleteHours(id: number, name: string) {
    if (!confirm(`¿Eliminar horario "${name}"?`)) return;
    await api.delete(`/schedules/business-hours/${id}`);
    reload();
  }

  async function deleteHoliday(id: number, name: string) {
    if (!confirm(`¿Eliminar feriado "${name}"?`)) return;
    await api.delete(`/schedules/holidays/${id}`);
    reload();
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Horarios y Feriados</h2>
          <p className="text-slate-500 mt-1">Define cuándo está abierto tu Call Center y los días especiales.</p>
        </div>

        {/* Horarios de atención */}
        <div className="rounded-xl border border-slate-200 bg-white">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-brand-600" />
              <h3 className="font-semibold text-slate-900">Horarios de atención</h3>
            </div>
            <button onClick={() => setOpenHours(true)} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium">
              <Plus className="w-3 h-3" /> Nuevo horario
            </button>
          </div>
          <div className="divide-y divide-slate-100">
            {loading && <div className="p-6 text-center text-slate-500">Cargando…</div>}
            {!loading && hours.length === 0 && <div className="p-8 text-center text-slate-500">Sin horarios. Crea uno para enrutar fuera de horario.</div>}
            {hours.map(h => (
              <div key={h.id} className="p-5">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <div className="font-medium text-slate-900 flex items-center gap-2">
                      {h.name}
                      {h.is_default && <span className="inline-flex px-1.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">★ Default</span>}
                    </div>
                    <div className="text-xs text-slate-500">{h.timezone}</div>
                  </div>
                  <button onClick={() => deleteHours(h.id, h.name)} className="text-slate-400 hover:text-rose-600">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <div className="grid grid-cols-7 gap-2 text-xs">
                  {DAYS.map(d => {
                    const ranges = h.schedule[d.v] ?? [];
                    return (
                      <div key={d.v} className="border border-slate-200 rounded p-2">
                        <div className="font-medium text-slate-700 text-center">{d.l.slice(0, 3)}</div>
                        {ranges.length === 0 ? (
                          <div className="text-slate-400 text-center mt-1">cerrado</div>
                        ) : ranges.map((r, i) => (
                          <div key={i} className="text-slate-600 text-center mt-1 font-mono">{r.from}–{r.to}</div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Feriados */}
        <div className="rounded-xl border border-slate-200 bg-white">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-brand-600" />
              <h3 className="font-semibold text-slate-900">Feriados</h3>
            </div>
            <button onClick={() => setOpenHoliday(true)} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium">
              <Plus className="w-3 h-3" /> Nuevo feriado
            </button>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
              <tr>
                <th className="text-left px-4 py-2 font-medium">Nombre</th>
                <th className="text-left px-4 py-2 font-medium">Fecha</th>
                <th className="text-left px-4 py-2 font-medium">Recurrente</th>
                <th className="text-left px-4 py-2 font-medium">País</th>
                <th></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {!loading && holidays.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">Sin feriados.</td></tr>
              )}
              {holidays.map(h => (
                <tr key={h.id}>
                  <td className="px-4 py-2 text-slate-900">{h.name}</td>
                  <td className="px-4 py-2 text-slate-700 font-mono text-xs">{h.holiday_date}</td>
                  <td className="px-4 py-2">{h.is_recurring ? '🔄 sí' : '—'}</td>
                  <td className="px-4 py-2 font-mono text-xs">{h.country ?? '—'}</td>
                  <td className="px-4 py-2 text-right">
                    <button onClick={() => deleteHoliday(h.id, h.name)} className="text-slate-400 hover:text-rose-600">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {openHours && <HoursModal onClose={() => setOpenHours(false)} onSaved={reload} />}
      {openHoliday && <HolidayModal onClose={() => setOpenHoliday(false)} onSaved={reload} />}
    </AppShell>
  );
}

function HoursModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState('');
  const [timezone, setTimezone] = useState('America/Bogota');
  const [isDefault, setIsDefault] = useState(false);
  const [schedule, setSchedule] = useState<Record<string, { from: string; to: string }[]>>({
    mon: [{ from: '08:00', to: '18:00' }],
    tue: [{ from: '08:00', to: '18:00' }],
    wed: [{ from: '08:00', to: '18:00' }],
    thu: [{ from: '08:00', to: '18:00' }],
    fri: [{ from: '08:00', to: '18:00' }],
    sat: [],
    sun: [],
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setRange(day: string, idx: number, key: 'from' | 'to', val: string) {
    setSchedule(s => ({ ...s, [day]: s[day].map((r, i) => i === idx ? { ...r, [key]: val } : r) }));
  }
  function toggleDay(day: string) {
    setSchedule(s => ({ ...s, [day]: s[day].length > 0 ? [] : [{ from: '08:00', to: '18:00' }] }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name) return setError('Nombre requerido');
    setSubmitting(true);
    try {
      await api.post('/schedules/business-hours', { name, timezone, schedule, is_default: isDefault });
      onSaved(); onClose();
    } catch (e: any) {
      setError(e?.response?.data?.error?.message ?? 'Error al guardar');
    } finally { setSubmitting(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h3 className="text-lg font-semibold">Nuevo horario de atención</h3>
          <button onClick={onClose} className="text-slate-400">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {error && <div className="rounded-lg bg-rose-50 border border-rose-200 px-4 py-2 text-sm text-rose-700">{error}</div>}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Nombre</label>
              <input value={name} onChange={e => setName(e.target.value)} required className="w-full px-3 py-2 border rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Zona horaria</label>
              <input value={timezone} onChange={e => setTimezone(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm font-mono" />
            </div>
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-medium">Horario semanal</label>
            {DAYS.map(d => (
              <div key={d.v} className="flex items-center gap-3">
                <label className="flex items-center gap-2 w-32">
                  <input type="checkbox" checked={schedule[d.v].length > 0} onChange={() => toggleDay(d.v)} />
                  <span className="text-sm">{d.l}</span>
                </label>
                {schedule[d.v].length > 0 && (
                  <>
                    <input type="time" value={schedule[d.v][0]?.from ?? '08:00'} onChange={e => setRange(d.v, 0, 'from', e.target.value)} className="px-2 py-1 border rounded text-sm" />
                    <span className="text-slate-400">a</span>
                    <input type="time" value={schedule[d.v][0]?.to ?? '18:00'} onChange={e => setRange(d.v, 0, 'to', e.target.value)} className="px-2 py-1 border rounded text-sm" />
                  </>
                )}
              </div>
            ))}
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={isDefault} onChange={e => setIsDefault(e.target.checked)} />
            Usar como horario por defecto
          </label>
        </form>
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t bg-slate-50">
          <button onClick={onClose} className="px-4 py-2 text-sm">Cancelar</button>
          <button onClick={handleSubmit as any} disabled={submitting} className="px-4 py-2 rounded-lg bg-brand-600 text-white text-sm disabled:opacity-50">
            {submitting ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}

function HolidayModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState('');
  const [date, setDate] = useState('');
  const [recurring, setRecurring] = useState(false);
  const [country, setCountry] = useState('CO');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name || !date) return setError('Nombre y fecha requeridos');
    setSubmitting(true);
    try {
      await api.post('/schedules/holidays', { name, holiday_date: date, is_recurring: recurring, country: country || undefined });
      onSaved(); onClose();
    } catch (e: any) { setError(e?.response?.data?.error?.message ?? 'Error'); } finally { setSubmitting(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h3 className="text-lg font-semibold">Nuevo feriado</h3>
          <button onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-3">
          {error && <div className="rounded-lg bg-rose-50 border border-rose-200 px-3 py-2 text-sm text-rose-700">{error}</div>}
          <div>
            <label className="block text-sm font-medium mb-1">Nombre</label>
            <input value={name} onChange={e => setName(e.target.value)} required placeholder="Ej. Año Nuevo" className="w-full px-3 py-2 border rounded text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Fecha</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} required className="w-full px-3 py-2 border rounded text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">País (ISO 2)</label>
            <input value={country} onChange={e => setCountry(e.target.value.toUpperCase())} maxLength={2} className="w-full px-3 py-2 border rounded text-sm font-mono" />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={recurring} onChange={e => setRecurring(e.target.checked)} />
            Recurrente todos los años
          </label>
        </form>
        <div className="flex justify-end gap-2 px-6 py-4 border-t bg-slate-50">
          <button onClick={onClose} className="px-4 py-2 text-sm">Cancelar</button>
          <button onClick={handleSubmit as any} disabled={submitting} className="px-4 py-2 rounded bg-brand-600 text-white text-sm disabled:opacity-50">
            {submitting ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}
