import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { EncryptionService } from '../common/encryption/encryption.service';

export interface CreateWebhookDto {
  name: string;
  url: string;
  secret: string;
  events: string[];
  headers?: Record<string, string>;
  is_active?: boolean;
  max_retries?: number;
  timeout_ms?: number;
}

@Injectable()
export class WebhooksService {
  constructor(
    @InjectDataSource() private readonly ds: DataSource,
    private readonly encryption: EncryptionService,
  ) {}

  async list(companyId: number): Promise<unknown[]> {
    const rows = await this.ds.query(
      `SELECT id, name, url, events, headers, is_active, max_retries, timeout_ms,
              last_success_at, last_failure_at, consecutive_failures, created_at, updated_at
         FROM webhook_endpoints WHERE company_id = ? ORDER BY id DESC`,
      [companyId],
    );
    return rows.map((r: any) => ({
      ...r,
      events: typeof r.events === 'string' ? JSON.parse(r.events) : r.events,
      headers: r.headers ? (typeof r.headers === 'string' ? JSON.parse(r.headers) : r.headers) : null,
    }));
  }

  async create(companyId: number, dto: CreateWebhookDto): Promise<{ id: number }> {
    const r: any = await this.ds.query(
      `INSERT INTO webhook_endpoints (company_id, name, url, secret_encrypted, events, headers, is_active, max_retries, timeout_ms)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        companyId, dto.name, dto.url,
        this.encryption.encrypt(dto.secret),
        JSON.stringify(dto.events),
        dto.headers ? JSON.stringify(dto.headers) : null,
        dto.is_active ?? true,
        dto.max_retries ?? 6,
        dto.timeout_ms ?? 10000,
      ],
    );
    return { id: r?.insertId ?? r?.[0]?.insertId };
  }

  async update(id: number, companyId: number, dto: Partial<CreateWebhookDto>): Promise<void> {
    const sets: string[] = [];
    const params: unknown[] = [];
    if (dto.name !== undefined) { sets.push('name = ?'); params.push(dto.name); }
    if (dto.url !== undefined) { sets.push('url = ?'); params.push(dto.url); }
    if (dto.secret !== undefined) { sets.push('secret_encrypted = ?'); params.push(this.encryption.encrypt(dto.secret)); }
    if (dto.events !== undefined) { sets.push('events = ?'); params.push(JSON.stringify(dto.events)); }
    if (dto.headers !== undefined) { sets.push('headers = ?'); params.push(dto.headers ? JSON.stringify(dto.headers) : null); }
    if (dto.is_active !== undefined) { sets.push('is_active = ?'); params.push(dto.is_active); }
    if (dto.max_retries !== undefined) { sets.push('max_retries = ?'); params.push(dto.max_retries); }
    if (dto.timeout_ms !== undefined) { sets.push('timeout_ms = ?'); params.push(dto.timeout_ms); }
    if (!sets.length) return;
    params.push(id, companyId);
    await this.ds.query(`UPDATE webhook_endpoints SET ${sets.join(', ')} WHERE id = ? AND company_id = ?`, params);
  }

  async remove(id: number, companyId: number): Promise<void> {
    await this.ds.query(`DELETE FROM webhook_endpoints WHERE id = ? AND company_id = ?`, [id, companyId]);
  }

  async listLogs(companyId: number, endpointId?: number, limit = 100): Promise<unknown[]> {
    if (endpointId) {
      return this.ds.query(
        `SELECT * FROM webhook_delivery_logs WHERE company_id = ? AND endpoint_id = ?
           ORDER BY id DESC LIMIT ?`,
        [companyId, endpointId, limit],
      );
    }
    return this.ds.query(
      `SELECT * FROM webhook_delivery_logs WHERE company_id = ? ORDER BY id DESC LIMIT ?`,
      [companyId, limit],
    );
  }
}
