import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

/**
 * ImportService — Fase 8
 * --------------------------------------------------------------
 * Maneja la importación masiva de clientes desde CSV o Excel.
 * El parsing real (xlsx/csv) se delega a paquetes externos cuando
 * estén instalados (`xlsx`, `papaparse`). Si no están, lee solo CSV plano.
 *
 * Flujo:
 *   1. Cliente sube archivo → POST /api/imports (multipart) → guardado en disco temporal.
 *   2. Backend detecta columnas y devuelve sample.
 *   3. Cliente confirma mapping → POST /api/imports/:id/start
 *   4. Worker procesa en background, escribe en `import_jobs` y `import_job_rows`.
 *
 * En este módulo, por simplicidad y para no traer dependencias pesadas, parseamos
 * únicamente CSV (separator detection). El XLSX se documenta como mejora.
 */
@Injectable()
export class ImportService {
  private readonly logger = new Logger(ImportService.name);

  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  // ----------------------------------------------------------------
  // Detección rápida de columnas a partir de un CSV crudo.
  // ----------------------------------------------------------------
  detectColumns(csv: string): { headers: string[]; sample: Record<string, string>[]; total: number } {
    const lines = csv.split(/\r?\n/).filter(l => l.trim().length > 0);
    if (lines.length === 0) throw new BadRequestException('Archivo vacío');
    const sep = this.detectSeparator(lines[0]);
    const headers = this.splitRow(lines[0], sep).map(h => h.trim().replace(/^"|"$/g, ''));
    const sample = lines.slice(1, Math.min(11, lines.length)).map(line => {
      const values = this.splitRow(line, sep);
      const row: Record<string, string> = {};
      headers.forEach((h, i) => { row[h] = (values[i] ?? '').trim().replace(/^"|"$/g, ''); });
      return row;
    });
    return { headers, sample, total: lines.length - 1 };
  }

  // ----------------------------------------------------------------
  // Crea un import_job en estado 'pending' con el mapping confirmado.
  // En producción, un worker (cron / queue) lo procesa; aquí lo procesamos
  // inline para simplificar. Ideal: BullMQ + Redis.
  // ----------------------------------------------------------------
  async runImport(
    companyId: number,
    userId: number,
    csv: string,
    columnMapping: Record<string, string>,
    options: { dedupeBy?: 'phone' | 'document' | 'none'; skipDnc?: boolean } = {},
  ): Promise<{ jobId: number; success: number; errors: number; skipped: number; total: number }> {
    const { headers, total } = this.detectColumns(csv);
    const sep = this.detectSeparator(csv.split(/\r?\n/, 1)[0]);
    const lines = csv.split(/\r?\n/).filter(l => l.trim().length > 0).slice(1);

    const insertJob: any = await this.ds.query(
      `INSERT INTO import_jobs (company_id, user_id, target_entity, source, column_mapping, options, status, total_rows, started_at)
       VALUES (?, ?, 'customers', 'csv', ?, ?, 'running', ?, NOW())`,
      [companyId, userId, JSON.stringify(columnMapping), JSON.stringify(options), total],
    );
    const jobId = insertJob?.insertId ?? insertJob?.[0]?.insertId;

    const dedupeBy = options.dedupeBy ?? 'phone';
    let success = 0, errors = 0, skipped = 0;

    for (let i = 0; i < lines.length; i++) {
      try {
        const values = this.splitRow(lines[i], sep);
        const row: Record<string, string> = {};
        headers.forEach((h, idx) => { row[h] = (values[idx] ?? '').trim().replace(/^"|"$/g, ''); });

        const data = {
          full_name: row[columnMapping.full_name] ?? '',
          primary_phone: this.normalizePhone(row[columnMapping.primary_phone] ?? ''),
          email: row[columnMapping.email] ?? null,
          document_number: row[columnMapping.document_number] ?? null,
          company_name: row[columnMapping.company_name] ?? null,
          city: row[columnMapping.city] ?? null,
        };

        if (!data.full_name) {
          await this.recordRowError(jobId, companyId, i, row, 'full_name vacío');
          errors++;
          continue;
        }

        // Dedupe
        if (dedupeBy === 'phone' && data.primary_phone) {
          const dup = await this.ds.query(
            `SELECT id FROM customers WHERE company_id = ? AND primary_phone = ? LIMIT 1`,
            [companyId, data.primary_phone],
          );
          if (dup[0]) {
            await this.recordRowSkip(jobId, companyId, i, row, dup[0].id);
            skipped++;
            continue;
          }
        }
        if (dedupeBy === 'document' && data.document_number) {
          const dup = await this.ds.query(
            `SELECT id FROM customers WHERE company_id = ? AND document_number = ? LIMIT 1`,
            [companyId, data.document_number],
          );
          if (dup[0]) {
            await this.recordRowSkip(jobId, companyId, i, row, dup[0].id);
            skipped++;
            continue;
          }
        }

        // DNC
        if (options.skipDnc && data.primary_phone) {
          const dnc = await this.ds.query(
            `SELECT 1 FROM dnc_entries WHERE company_id = ? AND phone = ? LIMIT 1`,
            [companyId, data.primary_phone],
          );
          if (dnc.length > 0) {
            await this.recordRowSkip(jobId, companyId, i, row, null, 'DNC');
            skipped++;
            continue;
          }
        }

        const ins: any = await this.ds.query(
          `INSERT INTO customers (company_id, full_name, primary_phone, email, document_number, company_name, city, source, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'import', 'active')`,
          [companyId, data.full_name, data.primary_phone || null, data.email || null, data.document_number || null, data.company_name || null, data.city || null],
        );
        const customerId = ins?.insertId ?? ins?.[0]?.insertId;
        if (data.primary_phone) {
          await this.ds.query(
            `INSERT IGNORE INTO customer_phones (company_id, customer_id, phone, label, is_primary)
             VALUES (?, ?, ?, 'mobile', TRUE)`,
            [companyId, customerId, data.primary_phone],
          );
        }
        await this.ds.query(
          `INSERT INTO import_job_rows (company_id, import_job_id, row_index, raw_data, status, target_id)
           VALUES (?, ?, ?, ?, 'ok', ?)`,
          [companyId, jobId, i, JSON.stringify(row), customerId],
        );
        success++;
      } catch (err: any) {
        errors++;
        this.logger.error(`Import row ${i} falló: ${err?.message ?? err}`);
        await this.recordRowError(jobId, companyId, i, {}, err?.message ?? String(err));
      }
    }

    await this.ds.query(
      `UPDATE import_jobs
         SET processed_rows = ?, success_rows = ?, error_rows = ?, skipped_rows = ?,
             status = ?, finished_at = NOW()
         WHERE id = ?`,
      [
        success + errors + skipped,
        success,
        errors,
        skipped,
        errors > 0 && success > 0 ? 'partially_completed' : (errors > 0 ? 'failed' : 'completed'),
        jobId,
      ],
    );

    return { jobId, success, errors, skipped, total };
  }

  async listJobs(companyId: number): Promise<unknown[]> {
    return this.ds.query(
      `SELECT id, target_entity, source, status, total_rows, processed_rows, success_rows, error_rows, skipped_rows, started_at, finished_at
         FROM import_jobs WHERE company_id = ?
         ORDER BY created_at DESC LIMIT 50`,
      [companyId],
    );
  }

  // -------------------- helpers
  private detectSeparator(line: string): string {
    const candidates = [',', ';', '\t', '|'];
    let best = ',', bestCount = 0;
    for (const c of candidates) {
      const count = line.split(c).length;
      if (count > bestCount) { best = c; bestCount = count; }
    }
    return best;
  }

  private splitRow(line: string, sep: string): string[] {
    // Parser simple con manejo de comillas dobles
    const out: string[] = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { inQuotes = !inQuotes; continue; }
      if (ch === sep && !inQuotes) { out.push(cur); cur = ''; continue; }
      cur += ch;
    }
    out.push(cur);
    return out;
  }

  private normalizePhone(s: string): string {
    return s.replace(/[^\d+]/g, '');
  }

  private async recordRowError(jobId: number, companyId: number, i: number, raw: unknown, err: string) {
    await this.ds.query(
      `INSERT INTO import_job_rows (company_id, import_job_id, row_index, raw_data, status, error_message)
       VALUES (?, ?, ?, ?, 'error', ?)`,
      [companyId, jobId, i, JSON.stringify(raw), err],
    );
  }
  private async recordRowSkip(jobId: number, companyId: number, i: number, raw: unknown, targetId?: number | null, reason?: string) {
    await this.ds.query(
      `INSERT INTO import_job_rows (company_id, import_job_id, row_index, raw_data, status, target_id, error_message)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [companyId, jobId, i, JSON.stringify(raw), reason === 'DNC' ? 'skipped' : 'duplicate', targetId ?? null, reason ?? null],
    );
  }
}
