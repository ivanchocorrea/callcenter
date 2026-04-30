import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';

const execP = promisify(exec);

export interface CreateBackupInput {
  triggeredBy?: number | null;
  triggerType?: 'manual' | 'scheduled' | 'pre_update';
  includeDb?: boolean;
  includeUploads?: boolean;
  includeConfig?: boolean;
  notes?: string;
}

/**
 * BackupService — Crea, lista y restaura respaldos.
 * Restaurar requiere doble confirmación + frase exacta y solo lo invoca el controlador.
 */
@Injectable()
export class BackupService {
  private readonly log = new Logger(BackupService.name);

  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  // ---------------------------------------------------------------- create
  async create(input: CreateBackupInput) {
    const includesDb = input.includeDb ?? true;
    const includesUploads = input.includeUploads ?? true;
    const includesConfig = input.includeConfig ?? true;

    const dir = await this.ensureBackupDir();
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filePath = path.join(dir, `backup-${stamp}.tar.gz`);

    const ins: any = await this.ds.query(
      `INSERT INTO backup_history
       (triggered_by, trigger_type, includes_db, includes_uploads, includes_config, status, file_path, notes)
       VALUES (?, ?, ?, ?, ?, 'running', ?, ?)`,
      [
        input.triggeredBy ?? null,
        input.triggerType ?? 'manual',
        includesDb ? 1 : 0,
        includesUploads ? 1 : 0,
        includesConfig ? 1 : 0,
        filePath,
        input.notes ?? null,
      ],
    );
    const id = ins.insertId;

    try {
      // Ejecuta el script externo bash que arma el .tar.gz
      const script = path.join(this.repoRoot(), 'scripts', 'maintenance', 'backup.sh');
      const args = [
        `--out="${filePath}"`,
        includesDb ? '--db' : '--no-db',
        includesUploads ? '--uploads' : '--no-uploads',
        includesConfig ? '--config' : '--no-config',
      ].join(' ');
      await execP(`bash "${script}" ${args}`, {
        cwd: this.repoRoot(),
        timeout: 30 * 60_000,
        maxBuffer: 10 * 1024 * 1024,
        env: { ...process.env },
      });

      const stat = await fs.stat(filePath);
      const sha = await this.sha256(filePath);
      await this.ds.query(
        `UPDATE backup_history
         SET status='success', finished_at=NOW(), file_size_bytes=?, sha256=?
         WHERE id=?`,
        [stat.size, sha, id],
      );
      return { id, filePath, sizeBytes: stat.size, sha256: sha };
    } catch (e: any) {
      await this.ds.query(
        `UPDATE backup_history SET status='failed', finished_at=NOW(), error_message=? WHERE id=?`,
        [String(e?.message ?? e).slice(0, 1000), id],
      );
      throw e;
    }
  }

  async list(limit = 30) {
    return this.ds.query(
      `SELECT id, started_at, finished_at, trigger_type, includes_db, includes_uploads,
              includes_config, status, file_path, file_size_bytes, sha256, notes
       FROM backup_history
       ORDER BY started_at DESC
       LIMIT ?`, [limit],
    );
  }

  async getById(id: number) {
    const r = await this.ds.query(`SELECT * FROM backup_history WHERE id=?`, [id]);
    return r[0] ?? null;
  }

  // ---------------------------------------------------------------- restore
  /**
   * Restaura un respaldo. SOLO debe llegar aquí si pasaste todas las validaciones.
   * Antes de restaurar crea respaldo de seguridad (pre_update).
   */
  async restore(id: number, triggeredBy?: number | null) {
    const b = await this.getById(id);
    if (!b) throw new Error('Respaldo no encontrado');
    if (b.status !== 'success') throw new Error('Solo se pueden restaurar respaldos exitosos');

    // Respaldo de seguridad antes de tocar nada
    await this.create({
      triggeredBy,
      triggerType: 'pre_update',
      notes: `Respaldo automático previo a restauración de #${id}`,
    });

    const script = path.join(this.repoRoot(), 'scripts', 'maintenance', 'restore.sh');
    await execP(`bash "${script}" --file="${b.file_path}"`, {
      cwd: this.repoRoot(),
      timeout: 30 * 60_000,
      maxBuffer: 10 * 1024 * 1024,
      env: { ...process.env },
    });
    return { restored: true, fromId: id };
  }

  // ---------------------------------------------------------------- helpers
  private async ensureBackupDir(): Promise<string> {
    const base = process.env.BACKUP_DIR || path.join(this.repoRoot(), 'backups');
    await fs.mkdir(base, { recursive: true });
    return base;
  }

  private async sha256(file: string): Promise<string> {
    const buf = await fs.readFile(file);
    return crypto.createHash('sha256').update(buf).digest('hex');
  }

  private repoRoot(): string {
    const cwd = process.cwd();
    return path.basename(cwd) === 'backend' ? path.resolve(cwd, '..') : cwd;
  }
}
