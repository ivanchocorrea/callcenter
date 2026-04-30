'use client';

import { api, unwrap } from './client';

export type ComponentStatus = {
  key: string;
  label: string;
  status: 'ok' | 'degraded' | 'down' | 'unknown';
  message: string;
  friendly: string;
  detail?: Record<string, unknown>;
};

export type SystemStatus = {
  generatedAt: string;
  overall: 'ok' | 'degraded' | 'down';
  version: string;
  lastUpdateAt: string | null;
  uptimeSeconds: number;
  components: ComponentStatus[];
  resources: {
    cpuLoadPercent: number;
    memoryUsedPercent: number;
    memoryUsedMb: number;
    memoryTotalMb: number;
    diskUsedPercent: number | null;
    diskUsedGb: number | null;
    diskTotalGb: number | null;
  };
};

export type SystemError = {
  id: number;
  occurred_at: string;
  source: string;
  module: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  error_code: string | null;
  friendly_message: string;
  recommendation: string | null;
  status: 'open' | 'acknowledged' | 'resolved' | 'ignored';
  technical_message: string;
};

export type OutdatedItem = {
  package: string;
  current: string;
  wanted: string;
  latest: string;
  type: 'patch' | 'minor' | 'major' | 'none';
  isSafe: boolean;
  project: 'backend' | 'frontend';
};

export type OutdatedReport = {
  checkedAt: string;
  backend: OutdatedItem[];
  frontend: OutdatedItem[];
  summary: { patches: number; minor: number; major: number; total: number };
};

export type BackupRow = {
  id: number; started_at: string; finished_at: string | null;
  trigger_type: 'manual' | 'scheduled' | 'pre_update';
  status: 'running' | 'success' | 'failed';
  file_path: string | null; file_size_bytes: number | null;
  sha256: string | null; notes: string | null;
  includes_db: number; includes_uploads: number; includes_config: number;
};

export type RestartRow = {
  id: number; requested_at: string; completed_at: string | null;
  target: 'backend' | 'frontend' | 'asterisk' | 'redis' | 'all';
  reason: string | null;
  status: 'pending' | 'running' | 'success' | 'failed';
  error_message: string | null;
};

export type AuditRow = {
  id: number; occurred_at: string; user_id: number | null;
  actor_email: string | null; action: string; target: string | null;
  success: number; duration_ms: number | null; notes: string | null;
  ip_address: string | null;
};

export const maintenanceApi = {
  // estado
  status:    () => api.get('/maintenance/status').then(unwrap<SystemStatus>),
  summary:   () => api.get('/maintenance/summary').then(unwrap<{ status: SystemStatus; errors: any }>),

  // errores
  listErrors: (params: Record<string, unknown> = {}) =>
    api.get('/maintenance/errors', { params }).then(unwrap<SystemError[]>),
  updateErrorStatus: (errorId: number, newStatus: SystemError['status'], note?: string) =>
    api.post('/maintenance/errors/update', { errorId, newStatus, note }).then(unwrap),
  downloadLogsUrl: (format: 'txt' | 'json') =>
    `${api.defaults.baseURL}/maintenance/logs/download?format=${format}`,

  // dependencias
  checkUpdates: () => api.get('/maintenance/updates/check').then(unwrap<OutdatedReport>),
  applySafeUpdates: (project: 'backend' | 'frontend' | 'all') =>
    api.post('/maintenance/updates/apply-safe', { project, onlySafe: true, confirm: true })
       .then(unwrap<{ success: boolean; result: any[]; message: string }>),

  // respaldos
  listBackups:  () => api.get('/maintenance/backups').then(unwrap<BackupRow[]>),
  createBackup: (notes?: string) =>
    api.post('/maintenance/backups/create', { notes }).then(unwrap<any>),
  restoreBackup: (backupId: number, phrase: string) =>
    api.post('/maintenance/backups/restore', {
      backupId, confirm1: true, confirm2: true, confirmationPhrase: phrase,
    }).then(unwrap<any>),

  // reinicio
  restart: (target: 'backend' | 'frontend' | 'asterisk' | 'redis' | 'all', reason?: string) =>
    api.post('/maintenance/restart', { target, reason, confirm: true }).then(unwrap<any>),
  restartHistory: () => api.get('/maintenance/restart/history').then(unwrap<RestartRow[]>),
  lastRestart:    () => api.get('/maintenance/restart/last').then(unwrap<RestartRow | null>),

  // auditoría
  audit: (limit = 50, offset = 0) =>
    api.get('/maintenance/audit', { params: { limit, offset } }).then(unwrap<AuditRow[]>),
};
