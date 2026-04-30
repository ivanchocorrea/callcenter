import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

export type ErrorSource =
  | 'backend' | 'frontend' | 'database' | 'telephony'
  | 'external_api' | 'scheduled_task' | 'other';
export type ErrorSeverity = 'info' | 'warning' | 'error' | 'critical';
export type ErrorStatus = 'open' | 'acknowledged' | 'resolved' | 'ignored';

export interface RecordErrorInput {
  companyId?: number | null;
  source: ErrorSource;
  module: string;
  severity?: ErrorSeverity;
  errorCode?: string | null;
  technicalMessage: string;
  /** Si no llega, se traduce automáticamente. */
  friendlyMessage?: string;
  /** Si no llega, se sugiere automáticamente según severidad/origen. */
  recommendation?: string;
  stackTrace?: string | null;
  metadata?: Record<string, unknown> | null;
}

/**
 * ErrorsService — Captura errores y los traduce a lenguaje claro.
 * Los demás módulos pueden inyectarlo para reportar incidencias importantes.
 */
@Injectable()
export class ErrorsService {
  private static SECRET_KEYS = [
    'password', 'pwd', 'token', 'secret', 'authorization', 'cookie',
    'api_key', 'apikey', 'jwt', 'private_key', 'client_secret',
  ];

  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  // ----------------------------------------------------------- record
  async record(input: RecordErrorInput): Promise<number> {
    const severity = input.severity ?? 'error';
    const friendly = input.friendlyMessage ?? this.translate(input);
    const recommendation = input.recommendation ?? this.suggest(input);
    const metadata = input.metadata ? this.scrub(input.metadata) : null;
    const stack = input.stackTrace ? this.scrubText(input.stackTrace).slice(0, 16_000) : null;

    const result: any = await this.ds.query(
      `INSERT INTO system_errors
        (company_id, source, module, severity, error_code,
         technical_message, friendly_message, recommendation,
         stack_trace, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.companyId ?? null,
        input.source,
        input.module.slice(0, 120),
        severity,
        input.errorCode ?? null,
        this.scrubText(input.technicalMessage).slice(0, 4000),
        friendly.slice(0, 1000),
        recommendation?.slice(0, 1000) ?? null,
        stack,
        metadata ? JSON.stringify(metadata) : null,
      ],
    );
    return result?.insertId ?? 0;
  }

  // ----------------------------------------------------------- list
  async list(opts: {
    severity?: string; status?: string; source?: string;
    limit?: number; offset?: number;
  } = {}) {
    const where: string[] = [];
    const params: unknown[] = [];
    if (opts.severity) { where.push('severity = ?'); params.push(opts.severity); }
    if (opts.status)   { where.push('status = ?');   params.push(opts.status); }
    if (opts.source)   { where.push('source = ?');   params.push(opts.source); }
    const sql = `
      SELECT id, occurred_at, source, module, severity, error_code,
             friendly_message, recommendation, status, technical_message
      FROM system_errors
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY occurred_at DESC
      LIMIT ? OFFSET ?`;
    params.push(opts.limit ?? 50, opts.offset ?? 0);
    return this.ds.query(sql, params);
  }

  async summary() {
    const rows = await this.ds.query(
      `SELECT severity, status, COUNT(*) AS n
       FROM system_errors
       WHERE occurred_at > NOW() - INTERVAL 7 DAY
       GROUP BY severity, status`,
    );
    const out = { critical_open: 0, errors_open: 0, warnings_open: 0, total_7d: 0 };
    for (const r of rows) {
      out.total_7d += Number(r.n);
      if (r.status === 'open') {
        if (r.severity === 'critical') out.critical_open += Number(r.n);
        else if (r.severity === 'error') out.errors_open += Number(r.n);
        else if (r.severity === 'warning') out.warnings_open += Number(r.n);
      }
    }
    return out;
  }

  async updateStatus(id: number, status: ErrorStatus, userId?: number | null) {
    const fields: string[] = ['status = ?'];
    const params: unknown[] = [status];
    if (status === 'acknowledged') {
      fields.push('acknowledged_by = ?', 'acknowledged_at = NOW()');
      params.push(userId ?? null);
    }
    if (status === 'resolved') {
      fields.push('resolved_at = NOW()');
    }
    params.push(id);
    await this.ds.query(`UPDATE system_errors SET ${fields.join(', ')} WHERE id = ?`, params);
  }

  /** Exporta logs para descargar. format = txt | json. */
  async exportLogs(format: 'txt' | 'json', limit = 1000): Promise<string> {
    const rows = await this.ds.query(
      `SELECT id, occurred_at, source, module, severity, error_code,
              friendly_message, recommendation, status, technical_message
       FROM system_errors
       ORDER BY occurred_at DESC
       LIMIT ?`, [limit]);
    if (format === 'json') return JSON.stringify(rows, null, 2);
    return rows.map((r: any) =>
      `[${r.occurred_at}] [${r.severity.toUpperCase()}] (${r.source}/${r.module}) ` +
      `${r.friendly_message}` +
      (r.recommendation ? ` -> ${r.recommendation}` : '')
    ).join('\n');
  }

  // ----------------------------------------------------------- traducción
  private translate(input: RecordErrorInput): string {
    const m = input.technicalMessage.toLowerCase();
    if (input.source === 'database' || /econn|timeout|deadlock|connection/i.test(m)) {
      return 'Hay un problema de conexión con la base de datos. Algunas operaciones pueden fallar.';
    }
    if (input.source === 'telephony' || /asterisk|sip|pjsip|ari|ami/i.test(m)) {
      return 'El sistema de llamadas tiene un problema. Las llamadas pueden no entrar o salir correctamente.';
    }
    if (input.source === 'external_api' || /fetch|axios|enotfound|getaddrinfo|status\s*5/i.test(m)) {
      return 'Un servicio externo no está respondiendo. Funciones que dependen de él pueden fallar temporalmente.';
    }
    if (input.source === 'scheduled_task' || /cron|schedule/i.test(m)) {
      return 'Una tarea automática programada falló al ejecutarse.';
    }
    if (input.source === 'frontend') {
      return 'La pantalla del usuario tuvo un error al cargar o procesar información.';
    }
    return 'El sistema encontró un error inesperado. Revise el detalle técnico para más información.';
  }

  private suggest(input: RecordErrorInput): string {
    const sev = input.severity ?? 'error';
    if (sev === 'critical') {
      return 'Crítico: revise inmediatamente este error y considere reiniciar el servicio afectado.';
    }
    if (input.source === 'database') {
      return 'Verifique la conexión a la base de datos y los recursos del servidor.';
    }
    if (input.source === 'telephony') {
      return 'Revise el estado del servidor Asterisk y las troncales SIP.';
    }
    if (input.source === 'external_api') {
      return 'Reintente la operación. Si persiste, contacte al proveedor del servicio externo.';
    }
    return 'Revise los logs y consulte al equipo técnico si el problema continúa.';
  }

  private scrub(obj: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (ErrorsService.SECRET_KEYS.some(s => k.toLowerCase().includes(s))) {
        out[k] = '***';
      } else if (v && typeof v === 'object' && !Array.isArray(v)) {
        out[k] = this.scrub(v as Record<string, unknown>);
      } else {
        out[k] = v;
      }
    }
    return out;
  }

  private scrubText(s: string): string {
    return s
      .replace(/(authorization|bearer|api[-_ ]?key|token|password|secret)[^\s,;]*[\s:=]+[^\s,;]+/gi, '$1=***')
      .replace(/eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g, 'eyJ***.***.***');
  }
}
