import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';

const execP = promisify(exec);

export type RestartTarget = 'backend' | 'frontend' | 'asterisk' | 'redis' | 'all';

@Injectable()
export class RestartService {
  private readonly log = new Logger(RestartService.name);

  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  /**
   * Programa un reinicio. El proceso se reinicia mediante el orquestador
   * (docker-compose / systemd). El controlador devolverá la respuesta antes
   * de que el reinicio se ejecute para no perder la conexión HTTP.
   */
  async schedule(
    target: RestartTarget,
    requestedBy?: number | null,
    reason?: string,
  ): Promise<{ id: number }> {
    const ins: any = await this.ds.query(
      `INSERT INTO restart_history (requested_by, target, reason, status)
       VALUES (?, ?, ?, 'pending')`,
      [requestedBy ?? null, target, reason ?? null],
    );
    const id = ins.insertId;

    // Disparamos el script en segundo plano (no await)
    setTimeout(() => void this.run(id, target), 1500);
    return { id };
  }

  async list(limit = 30) {
    return this.ds.query(
      `SELECT id, requested_at, completed_at, target, reason, status, error_message,
              requested_by
       FROM restart_history
       ORDER BY requested_at DESC
       LIMIT ?`, [limit],
    );
  }

  async lastStatus() {
    const r = await this.ds.query(
      `SELECT id, status, target, requested_at, completed_at, error_message
       FROM restart_history
       ORDER BY requested_at DESC LIMIT 1`,
    );
    return r[0] ?? null;
  }

  // ------------------------------------------------------ internal
  private async run(id: number, target: RestartTarget) {
    await this.ds.query(`UPDATE restart_history SET status='running' WHERE id=?`, [id]);
    try {
      const script = path.join(this.repoRoot(), 'scripts', 'maintenance', 'restart.sh');
      await execP(`bash "${script}" --target="${target}"`, {
        cwd: this.repoRoot(),
        timeout: 5 * 60_000,
        maxBuffer: 5 * 1024 * 1024,
      });
      await this.ds.query(
        `UPDATE restart_history SET status='success', completed_at=NOW() WHERE id=?`, [id],
      );
    } catch (e: any) {
      this.log.error(`Restart ${target} falló: ${e?.message ?? e}`);
      await this.ds.query(
        `UPDATE restart_history SET status='failed', completed_at=NOW(), error_message=? WHERE id=?`,
        [String(e?.message ?? e).slice(0, 1000), id],
      );
    }
  }

  private repoRoot(): string {
    const cwd = process.cwd();
    return path.basename(cwd) === 'backend' ? path.resolve(cwd, '..') : cwd;
  }
}
