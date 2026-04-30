'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/shared/AppShell';
import { maintenanceApi, type SystemStatus, type SystemError, type OutdatedReport, type BackupRow, type RestartRow, type AuditRow } from '@/lib/api/maintenance';
import {
  Activity, AlertCircle, AlertTriangle, CheckCircle2, Database,
  HardDrive, Loader2, Phone, Power, RefreshCw, Server, ShieldAlert, Wrench,
  XCircle, History,
} from 'lucide-react';
import { StatusCard } from './_components/StatusCard';
import { ErrorsTable } from './_components/ErrorsTable';
import { UpdatesPanel } from './_components/UpdatesPanel';
import { BackupsPanel } from './_components/BackupsPanel';
import { RestartPanel } from './_components/RestartPanel';
import { AuditTable } from './_components/AuditTable';
import { ConfirmDialog } from './_components/ConfirmDialog';
import { Toast } from './_components/Toast';

type TabKey = 'status' | 'errors' | 'updates' | 'backups' | 'restart' | 'audit';

export default function MaintenancePage() {
  const [tab, setTab] = useState<TabKey>('status');
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [errors, setErrors] = useState<SystemError[]>([]);
  const [updates, setUpdates] = useState<OutdatedReport | null>(null);
  const [backups, setBackups] = useState<BackupRow[]>([]);
  const [restarts, setRestarts] = useState<RestartRow[]>([]);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ msg: string; tone: 'ok' | 'warn' | 'err' } | null>(null);

  // Carga inicial
  useEffect(() => { void refreshStatus(); }, []);

  // Auto-refresh estado cada 30s
  useEffect(() => {
    const t = setInterval(() => { void refreshStatus(); }, 30_000);
    return () => clearInterval(t);
  }, []);

  async function refreshStatus() {
    try { setStatus(await maintenanceApi.status()); }
    catch (e: any) { /* silent */ }
  }

  async function refreshTab(t: TabKey) {
    setLoading(true);
    try {
      if (t === 'status')   setStatus(await maintenanceApi.status());
      if (t === 'errors')   setErrors(await maintenanceApi.listErrors({ limit: 100 }));
      if (t === 'backups')  setBackups(await maintenanceApi.listBackups());
      if (t === 'restart')  setRestarts(await maintenanceApi.restartHistory());
      if (t === 'audit')    setAudit(await maintenanceApi.audit(100));
    } catch (e: any) {
      showToast(`Error al cargar: ${e?.response?.data?.message ?? e.message}`, 'err');
    } finally { setLoading(false); }
  }

  function showToast(msg: string, tone: 'ok' | 'warn' | 'err' = 'ok') {
    setToast({ msg, tone });
    setTimeout(() => setToast(null), 4500);
  }

  useEffect(() => { void refreshTab(tab); }, [tab]);

  const overall = status?.overall ?? 'unknown';
  const overallText = overall === 'ok'
    ? 'Todo funciona correctamente'
    : overall === 'degraded'
    ? 'Hay avisos que conviene revisar'
    : overall === 'down'
    ? 'Hay un componente caído'
    : 'Sin información';

  return (
    <AppShell>
      <div className="space-y-6 pb-12">
        {/* Encabezado */}
        <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold text-slate-900 flex items-center gap-2">
              <Wrench className="w-6 h-6 text-brand-600" />
              Panel de mantenimiento
            </h2>
            <p className="text-slate-500 mt-1">
              Revise el estado del sistema, busque errores, actualice librerías seguras,
              cree respaldos y reinicie servicios sin tocar código.
            </p>
          </div>
          <BannerOverall overall={overall} text={overallText} version={status?.version} />
        </header>

        {/* Tabs */}
        <nav className="flex flex-wrap gap-2 border-b border-slate-200">
          {[
            { k: 'status',   label: 'Estado',          Icon: Activity },
            { k: 'errors',   label: 'Errores',         Icon: AlertCircle },
            { k: 'updates',  label: 'Actualizaciones', Icon: RefreshCw },
            { k: 'backups',  label: 'Respaldos',       Icon: HardDrive },
            { k: 'restart',  label: 'Reiniciar',       Icon: Power },
            { k: 'audit',    label: 'Auditoría',       Icon: History },
          ].map(({ k, label, Icon }) => (
            <button
              key={k}
              onClick={() => setTab(k as TabKey)}
              className={`px-4 py-2 -mb-px text-sm font-medium border-b-2 flex items-center gap-2 ${
                tab === k
                  ? 'border-brand-600 text-brand-700'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <Icon className="w-4 h-4" /> {label}
            </button>
          ))}
        </nav>

        {/* Contenido */}
        {tab === 'status'   && <StatusTab status={status} onRefresh={() => refreshTab('status')} loading={loading} />}
        {tab === 'errors'   && <ErrorsTable errors={errors} onUpdate={() => refreshTab('errors')} onToast={showToast} />}
        {tab === 'updates'  && <UpdatesPanel updates={updates} setUpdates={setUpdates} onToast={showToast} />}
        {tab === 'backups'  && <BackupsPanel backups={backups} onRefresh={() => refreshTab('backups')} onToast={showToast} />}
        {tab === 'restart'  && <RestartPanel restarts={restarts} onRefresh={() => refreshTab('restart')} onToast={showToast} />}
        {tab === 'audit'    && <AuditTable rows={audit} />}

        {toast && <Toast {...toast} />}
      </div>
    </AppShell>
  );
}

// ---------- Banner del estado general ----------
function BannerOverall({ overall, text, version }: { overall: string; text: string; version?: string }) {
  const cls =
    overall === 'ok'       ? 'bg-emerald-50 border-emerald-200 text-emerald-800' :
    overall === 'degraded' ? 'bg-amber-50 border-amber-200 text-amber-800' :
    overall === 'down'     ? 'bg-rose-50 border-rose-200 text-rose-800' :
                             'bg-slate-50 border-slate-200 text-slate-700';
  const Icon =
    overall === 'ok'       ? CheckCircle2 :
    overall === 'degraded' ? AlertTriangle :
    overall === 'down'     ? XCircle : AlertCircle;
  return (
    <div className={`rounded-xl border px-4 py-3 ${cls} min-w-[260px]`}>
      <div className="flex items-center gap-2">
        <Icon className="w-5 h-5" />
        <div className="font-semibold">{text}</div>
      </div>
      {version && <div className="text-xs opacity-80 mt-1">Versión {version}</div>}
    </div>
  );
}

// ---------- Pestaña Estado ----------
function StatusTab({ status, onRefresh, loading }: {
  status: SystemStatus | null; onRefresh: () => void; loading: boolean;
}) {
  if (!status) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500">
        <Loader2 className="w-6 h-6 animate-spin mx-auto" />
        <p className="mt-2">Cargando estado del sistema…</p>
      </div>
    );
  }
  const r = status.resources;
  const iconFor = (k: string) =>
    k === 'backend'    ? Server :
    k === 'database'   ? Database :
    k === 'telephony'  ? Phone : ShieldAlert;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="text-sm text-slate-500">
          Última verificación: {new Date(status.generatedAt).toLocaleString()} ·
          Activo desde hace {Math.round(status.uptimeSeconds / 60)} min
        </div>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-white border border-slate-300 text-sm hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Actualizar
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {status.components.map(c => (
          <StatusCard key={c.key} component={c} Icon={iconFor(c.key)} />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <ResourceCard label="CPU"           pct={r.cpuLoadPercent}       />
        <ResourceCard label="Memoria"       pct={r.memoryUsedPercent}    detail={`${r.memoryUsedMb} / ${r.memoryTotalMb} MB`} />
        <ResourceCard label="Almacenamiento" pct={r.diskUsedPercent}      detail={r.diskTotalGb ? `${r.diskUsedGb} / ${r.diskTotalGb} GB` : 'No disponible'} />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <Info label="Versión actual"            value={status.version} />
          <Info label="Última actualización"     value={status.lastUpdateAt ?? 'Sin registro'} />
          <Info label="Estado general"           value={status.overall.toUpperCase()} />
        </div>
      </div>
    </div>
  );
}

function ResourceCard({ label, pct, detail }: { label: string; pct: number | null; detail?: string }) {
  const v = pct ?? 0;
  const tone = v >= 90 ? 'bg-rose-500' : v >= 70 ? 'bg-amber-500' : 'bg-emerald-500';
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="text-sm text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-slate-900">
        {pct == null ? '—' : `${pct}%`}
      </div>
      <div className="mt-3 h-2 rounded-full bg-slate-100 overflow-hidden">
        <div className={`h-full ${tone}`} style={{ width: `${pct == null ? 0 : pct}%` }} />
      </div>
      {detail && <div className="text-xs text-slate-500 mt-2">{detail}</div>}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className="text-base font-medium text-slate-900 break-all">{value}</div>
    </div>
  );
}
