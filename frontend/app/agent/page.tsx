'use client';

import { useEffect, useMemo, useState } from 'react';
import { AppShell } from '@/components/shared/AppShell';
import {
  PhoneOutgoing, PhoneIncoming, PhoneMissed, BarChart3, Clock, Calendar,
} from 'lucide-react';
import { api, unwrap } from '@/lib/api/client';

interface ReportData {
  from: string;
  to: string;
  bucket: 'hour' | 'day';
  totals: {
    outbound: number;
    inbound: number;
    missed: number;
    total: number;
    avg_inbound_duration_seconds: number;
    avg_outbound_duration_seconds: number;
  };
  series: Array<{ bucket: string; outbound: number; inbound: number; missed: number }>;
}

type RangePreset = 'today' | 'yesterday' | 'last7' | 'last30' | 'thismonth';

const PRESETS: { key: RangePreset; label: string }[] = [
  { key: 'today',     label: 'Hoy' },
  { key: 'yesterday', label: 'Ayer' },
  { key: 'last7',     label: 'Últimos 7 días' },
  { key: 'last30',    label: 'Últimos 30 días' },
  { key: 'thismonth', label: 'Este mes' },
];

function rangeFor(preset: RangePreset): { from: string; to: string } {
  const now = new Date();
  const today0 = new Date(now); today0.setHours(0, 0, 0, 0);
  const formatLocal = (d: Date) => {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  };
  switch (preset) {
    case 'today':     return { from: formatLocal(today0), to: formatLocal(now) };
    case 'yesterday': {
      const y = new Date(today0); y.setDate(y.getDate() - 1);
      const yEnd = new Date(today0); yEnd.setSeconds(yEnd.getSeconds() - 1);
      return { from: formatLocal(y), to: formatLocal(yEnd) };
    }
    case 'last7':     {
      const f = new Date(today0); f.setDate(f.getDate() - 6);
      return { from: formatLocal(f), to: formatLocal(now) };
    }
    case 'last30':    {
      const f = new Date(today0); f.setDate(f.getDate() - 29);
      return { from: formatLocal(f), to: formatLocal(now) };
    }
    case 'thismonth': {
      const f = new Date(today0.getFullYear(), today0.getMonth(), 1);
      return { from: formatLocal(f), to: formatLocal(now) };
    }
  }
}

export default function AgentReportsPage() {
  const [preset, setPreset] = useState<RangePreset>('today');
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const { from, to } = rangeFor(preset);
      const res = await api.get('/agents/me/report', { params: { from, to } });
      setData(unwrap<ReportData>(res));
    } catch { /* ignore */ } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [preset]);

  const maxBar = useMemo(() => {
    if (!data) return 1;
    return Math.max(1, ...data.series.flatMap(s => [s.outbound, s.inbound, s.missed]));
  }, [data]);

  return (
    <AppShell>
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-brand-600" /> Reportes
            </h1>
            <p className="text-sm text-slate-500">Estadísticas de tus llamadas en el rango seleccionado.</p>
          </div>
          {/* Filtro de rango */}
          <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 text-sm overflow-x-auto">
            {PRESETS.map(p => (
              <button
                key={p.key}
                onClick={() => setPreset(p.key)}
                className={`px-3 py-1.5 rounded-md font-medium transition whitespace-nowrap ${
                  preset === p.key ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <KpiCard
            icon={PhoneOutgoing}
            label="Salientes"
            value={data?.totals.outbound ?? 0}
            color="blue"
          />
          <KpiCard
            icon={PhoneIncoming}
            label="Entrantes contestadas"
            value={data?.totals.inbound ?? 0}
            color="emerald"
          />
          <KpiCard
            icon={PhoneMissed}
            label="Perdidas"
            value={data?.totals.missed ?? 0}
            color="rose"
          />
          <KpiCard
            icon={Clock}
            label="Duración prom. saliente"
            value={formatDuration(data?.totals.avg_outbound_duration_seconds ?? 0)}
            color="indigo"
            isText
          />
          <KpiCard
            icon={Clock}
            label="Duración prom. entrante"
            value={formatDuration(data?.totals.avg_inbound_duration_seconds ?? 0)}
            color="teal"
            isText
          />
        </div>

        {/* Gráfica de barras */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 text-slate-700">
              <Calendar className="w-4 h-4 text-brand-600" />
              <span className="text-sm font-semibold">
                Llamadas por {data?.bucket === 'hour' ? 'hora' : 'día'}
              </span>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <Legend color="bg-blue-500" label="Salientes" />
              <Legend color="bg-emerald-500" label="Entrantes" />
              <Legend color="bg-rose-500" label="Perdidas" />
            </div>
          </div>

          {loading ? (
            <div className="h-64 flex items-center justify-center text-slate-400 text-sm">Cargando…</div>
          ) : !data || data.series.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-slate-400 text-sm">
              No hay llamadas en este rango.
            </div>
          ) : (
            <div className="h-64 flex items-end gap-1 overflow-x-auto pb-6 relative">
              {data.series.map((s, i) => {
                const totalH = (s.outbound + s.inbound + s.missed);
                const heightPct = (totalH / maxBar) * 100;
                return (
                  <div key={i} className="flex flex-col items-center gap-1 min-w-[28px] flex-1 group relative">
                    <div className="flex-1 w-full flex flex-col-reverse" style={{ height: '90%' }}>
                      <div className="w-full flex flex-col-reverse" style={{ height: `${heightPct}%` }}>
                        {s.missed > 0 && <div className="bg-rose-500 rounded-t" style={{ flex: s.missed }} />}
                        {s.inbound > 0 && <div className="bg-emerald-500" style={{ flex: s.inbound }} />}
                        {s.outbound > 0 && <div className="bg-blue-500 rounded-t" style={{ flex: s.outbound }} />}
                      </div>
                    </div>
                    <span className="text-[9px] text-slate-500 truncate w-full text-center">
                      {formatBucket(s.bucket, data.bucket)}
                    </span>
                    {totalH > 0 && (
                      <div className="absolute bottom-full mb-1 hidden group-hover:flex flex-col items-center bg-slate-800 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-10">
                        <span>Salientes: {s.outbound}</span>
                        <span>Entrantes: {s.inbound}</span>
                        <span>Perdidas: {s.missed}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Notas explicativas */}
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600">
          <p>
            Este reporte muestra <strong>solo las llamadas que tú atendiste</strong> como agente.
            Para ir al marcador y hacer/recibir llamadas, usa el menú lateral → <strong>Marcador</strong>.
          </p>
        </div>
      </div>
    </AppShell>
  );
}

// ===================================================================
// Sub-componentes
// ===================================================================

function KpiCard({ icon: Icon, label, value, color, isText }: {
  icon: any; label: string; value: number | string; color: string; isText?: boolean;
}) {
  const colorMap: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-700',
    emerald: 'bg-emerald-50 text-emerald-700',
    rose: 'bg-rose-50 text-rose-700',
    indigo: 'bg-indigo-50 text-indigo-700',
    teal: 'bg-teal-50 text-teal-700',
  };
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4">
      <div className={`inline-flex items-center justify-center w-9 h-9 rounded-xl ${colorMap[color]}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="mt-3 text-2xl font-bold text-slate-900">{isText ? value : Number(value).toLocaleString()}</div>
      <div className="text-xs text-slate-500 mt-0.5">{label}</div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-slate-600">
      <span className={`w-2.5 h-2.5 rounded ${color}`} /> {label}
    </span>
  );
}

function formatDuration(seconds: number): string {
  if (!seconds) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatBucket(bucket: string, type: 'hour' | 'day'): string {
  try {
    const d = new Date(bucket.replace(' ', 'T'));
    if (type === 'hour') {
      return d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' });
  } catch { return bucket; }
}
