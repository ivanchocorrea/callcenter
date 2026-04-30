import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

export type MaintenanceAction =
  | 'view_status' | 'check_errors' | 'download_logs'
  | 'check_updates' | 'apply_safe_updates' | 'apply_single_update'
  | 'create_backup' | 'restore_backup'
  | 'restart_service' | 'run_tests' | 'toggle_maintenance_mode';

export interface MaintenanceAuditEntry {
  userId?: number | null;
  actorEmail?: string | null;
  action: MaintenanceAction;
  target?: string | null;
  success: boolean;
  durationMs?: number | null;
  notes?: string | null;
  metadata?: Record<string, unknown> | null;
  ipAddress?: string | null;
}

/**
 * Registra cada acción del Panel de Mantenimiento.
 * NUNCA persiste secretos: filtra claves obvias antes de guardar.
 */
@Injectable()
export class MaintenanceAuditService {
  private static SECRET_KEYS = [
    'password', 'pass', 'pwd', 'token', 'secret', 'api_key', 'apikey',
    'authorization', 'auth', 'jwt', 'cookie', 'private_key', 'client_secret',
  ];

  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  async log(entry: MaintenanceAuditEntry): Promise<void> {
    const metadata = entry.metadata ? this.scrubSecrets(entry.metadata) : null;
    await this.ds.query(
      `INSERT INTO maintenance_actions
       (user_id, actor_email, action, target, success, duration_ms, notes, metadata, ip_address)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        entry.userId ?? null,
        entry.actorEmail ?? null,
        entry.action,
        entry.target ?? null,
        entry.success ? 1 : 0,
        entry.durationMs ?? null,
        entry.notes ?? null,
        metadata ? JSON.stringify(metadata) : null,
        entry.ipAddress ?? null,
      ],
    );
  }

  /** Lista paginada para mostrar el historial al admin. */
  async list(limit = 50, offset = 0): Promise<any[]> {
    return this.ds.query(
      `SELECT id, occurred_at, user_id, actor_email, action, target, success,
              duration_ms, notes, ip_address
       FROM maintenance_actions
       ORDER BY occurred_at DESC
       LIMIT ? OFFSET ?`,
      [limit, offset],
    );
  }

  private scrubSecrets(obj: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (MaintenanceAuditService.SECRET_KEYS.some(s => k.toLowerCase().includes(s))) {
        out[k] = '***';
      } else if (v && typeof v === 'object' && !Array.isArray(v)) {
        out[k] = this.scrubSecrets(v as Record<string, unknown>);
      } else {
        out[k] = v;
      }
    }
    return out;
  }
}
