'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/shared/AppShell';
import { api, unwrap } from '@/lib/api/client';
import { Upload, CheckCircle2, AlertCircle, Database } from 'lucide-react';

interface DetectResult {
  headers: string[];
  sample: Record<string, string>[];
  total: number;
}

interface RunResult {
  jobId: number;
  success: number;
  errors: number;
  skipped: number;
  total: number;
}

const TARGETS = [
  { key: 'full_name', label: 'Nombre *', required: true },
  { key: 'primary_phone', label: 'Teléfono principal' },
  { key: 'email', label: 'Email' },
  { key: 'document_number', label: 'Documento' },
  { key: 'company_name', label: 'Empresa' },
  { key: 'city', label: 'Ciudad' },
];

export default function ImportsPage() {
  const [csv, setCsv] = useState<string>('');
  const [detect, setDetect] = useState<DetectResult | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [dedupeBy, setDedupeBy] = useState<'phone' | 'document' | 'none'>('phone');
  const [skipDnc, setSkipDnc] = useState(true);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<RunResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [jobs, setJobs] = useState<any[]>([]);

  useEffect(() => {
    api.get('/imports').then(r => setJobs(unwrap<any[]>(r))).catch(() => undefined);
  }, [result]);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setCsv(text);
    setError(null);
    setResult(null);
    try {
      const r = await api.post('/imports/detect-columns', { csv: text });
      setDetect(unwrap<DetectResult>(r));
      setMapping({});
    } catch (err: any) {
      setError(err?.response?.data?.error?.message ?? 'Error al detectar columnas');
    }
  }

  function autoMap() {
    if (!detect) return;
    const guess: Record<string, string> = {};
    for (const t of TARGETS) {
      const found = detect.headers.find(h => normalize(h).includes(normalize(t.key.replace('_', ' '))));
      if (found) guess[t.key] = found;
    }
    setMapping(guess);
  }

  async function run() {
    if (!csv || !mapping.full_name) {
      setError('Mapea al menos la columna de nombre.');
      return;
    }
    setRunning(true);
    setError(null);
    try {
      const r = await api.post('/imports/run', {
        csv,
        column_mapping: mapping,
        options: { dedupeBy, skipDnc },
      });
      setResult(unwrap<RunResult>(r));
    } catch (err: any) {
      setError(err?.response?.data?.error?.message ?? 'Error al importar');
    } finally {
      setRunning(false);
    }
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Importar clientes</h2>
          <p className="text-slate-500 mt-1">Sube un CSV. Próximamente: Excel y Google Sheets.</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
          <div className="flex items-center gap-3">
            <Upload className="w-5 h-5 text-slate-400" />
            <input type="file" accept=".csv,text/csv" onChange={onFile} className="text-sm" />
          </div>

          {error && (
            <div className="rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-sm p-3">{error}</div>
          )}

          {detect && (
            <div className="space-y-4">
              <div className="text-sm text-slate-700">
                Archivo con <strong>{detect.total}</strong> filas y {detect.headers.length} columnas detectadas.
              </div>

              <div className="grid grid-cols-2 gap-3">
                {TARGETS.map(t => (
                  <label key={t.key} className="block">
                    <span className="text-xs font-medium text-slate-700">{t.label}</span>
                    <select
                      value={mapping[t.key] ?? ''}
                      onChange={e => setMapping(m => ({ ...m, [t.key]: e.target.value }))}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    >
                      <option value="">— ignorar —</option>
                      {detect.headers.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </label>
                ))}
              </div>

              <button onClick={autoMap} className="text-xs px-2 py-1 rounded bg-slate-100 hover:bg-slate-200">
                Auto-detectar mapping
              </button>

              <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-100">
                <label className="block">
                  <span className="text-xs font-medium text-slate-700">Detección de duplicados</span>
                  <select value={dedupeBy} onChange={e => setDedupeBy(e.target.value as any)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
                    <option value="phone">Por teléfono</option>
                    <option value="document">Por documento</option>
                    <option value="none">Sin deduplicar</option>
                  </select>
                </label>
                <label className="flex items-end gap-2 text-sm">
                  <input type="checkbox" checked={skipDnc} onChange={e => setSkipDnc(e.target.checked)} />
                  Omitir números en lista DNC
                </label>
              </div>

              <button
                onClick={run}
                disabled={running || !mapping.full_name}
                className="w-full rounded-lg bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white py-2.5 text-sm font-medium"
              >
                {running ? 'Importando…' : 'Importar'}
              </button>
            </div>
          )}

          {result && (
            <div className="rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 p-4">
              <div className="flex items-center gap-2 font-medium"><CheckCircle2 className="w-5 h-5" /> Importación finalizada</div>
              <div className="mt-2 grid grid-cols-4 text-sm">
                <Stat label="Total" value={result.total} />
                <Stat label="Importados" value={result.success} success />
                <Stat label="Saltados" value={result.skipped} />
                <Stat label="Errores" value={result.errors} error />
              </div>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
            <Database className="w-4 h-4 text-slate-400" />
            <h3 className="text-base font-semibold text-slate-900">Importaciones recientes</h3>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
              <tr>
                <th className="text-left px-4 py-2">ID</th>
                <th className="text-left px-4 py-2">Origen</th>
                <th className="text-left px-4 py-2">Estado</th>
                <th className="text-left px-4 py-2">Total</th>
                <th className="text-left px-4 py-2">OK</th>
                <th className="text-left px-4 py-2">Errores</th>
                <th className="text-left px-4 py-2">Saltados</th>
                <th className="text-left px-4 py-2">Inicio</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {jobs.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-6 text-center text-slate-500">Sin importaciones.</td></tr>
              )}
              {jobs.map(j => (
                <tr key={j.id}>
                  <td className="px-4 py-2 font-mono text-xs">#{j.id}</td>
                  <td className="px-4 py-2">{j.source}</td>
                  <td className="px-4 py-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs ${
                      j.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                      j.status === 'failed' ? 'bg-rose-100 text-rose-700' :
                      j.status === 'partially_completed' ? 'bg-amber-100 text-amber-700' :
                      'bg-slate-100 text-slate-700'
                    }`}>{j.status}</span>
                  </td>
                  <td className="px-4 py-2">{j.total_rows ?? '—'}</td>
                  <td className="px-4 py-2 text-emerald-700">{j.success_rows ?? 0}</td>
                  <td className="px-4 py-2 text-rose-700">{j.error_rows ?? 0}</td>
                  <td className="px-4 py-2 text-slate-500">{j.skipped_rows ?? 0}</td>
                  <td className="px-4 py-2 text-xs text-slate-500">{j.started_at ? new Date(j.started_at).toLocaleString() : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}

function Stat({ label, value, success, error }: { label: string; value: number; success?: boolean; error?: boolean }) {
  return (
    <div>
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`text-2xl font-bold ${success ? 'text-emerald-700' : error ? 'text-rose-700' : 'text-slate-900'}`}>{value}</div>
    </div>
  );
}

function normalize(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}
