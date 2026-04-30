import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { EncryptionService } from '../common/encryption/encryption.service';

export interface CreateSmsProviderDto {
  slug: string;
  name: string;
  provider_type: 'twilio' | 'generic_http' | 'vonage' | 'plivo' | 'aws_sns';
  api_key?: string;
  api_secret?: string;
  sender_id?: string;
  config?: Record<string, unknown>;
  is_default?: boolean;
  is_active?: boolean;
}

@Injectable()
export class SmsProvidersService {
  constructor(
    @InjectDataSource() private readonly ds: DataSource,
    private readonly encryption: EncryptionService,
  ) {}

  async list(companyId: number): Promise<unknown[]> {
    const rows = await this.ds.query(
      `SELECT id, slug, name, provider_type, sender_id, config, is_default, is_active
         FROM sms_providers WHERE company_id = ? ORDER BY name`,
      [companyId],
    );
    return rows.map((r: any) => ({
      ...r,
      config: r.config ? (typeof r.config === 'string' ? JSON.parse(r.config) : r.config) : null,
      has_api_key: true,
    }));
  }

  async findById(id: number, companyId: number): Promise<unknown> {
    const r = await this.ds.query(`SELECT * FROM sms_providers WHERE id = ? AND company_id = ?`, [id, companyId]);
    if (!r[0]) throw new NotFoundException();
    return r[0];
  }

  async create(companyId: number, dto: CreateSmsProviderDto): Promise<{ id: number }> {
    const dup = await this.ds.query(`SELECT id FROM sms_providers WHERE company_id = ? AND slug = ?`, [companyId, dto.slug]);
    if (dup[0]) throw new ConflictException('Ya existe un proveedor con ese slug');

    const apiKeyEnc = dto.api_key ? this.encryption.encrypt(dto.api_key) : null;
    const apiSecretEnc = dto.api_secret ? this.encryption.encrypt(dto.api_secret) : null;

    const r: any = await this.ds.query(
      `INSERT INTO sms_providers
        (company_id, slug, name, provider_type, config, api_key_encrypted, api_secret_encrypted,
         sender_id, is_default, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        companyId, dto.slug, dto.name, dto.provider_type,
        dto.config ? JSON.stringify(dto.config) : null,
        apiKeyEnc, apiSecretEnc,
        dto.sender_id ?? null,
        dto.is_default ?? false,
        dto.is_active ?? true,
      ],
    );
    return { id: r?.insertId ?? r?.[0]?.insertId };
  }

  async update(id: number, companyId: number, dto: Partial<CreateSmsProviderDto>): Promise<void> {
    const sets: string[] = [];
    const params: unknown[] = [];
    if (dto.name !== undefined) { sets.push('name = ?'); params.push(dto.name); }
    if (dto.provider_type !== undefined) { sets.push('provider_type = ?'); params.push(dto.provider_type); }
    if (dto.api_key !== undefined) { sets.push('api_key_encrypted = ?'); params.push(this.encryption.encrypt(dto.api_key)); }
    if (dto.api_secret !== undefined) { sets.push('api_secret_encrypted = ?'); params.push(this.encryption.encrypt(dto.api_secret)); }
    if (dto.sender_id !== undefined) { sets.push('sender_id = ?'); params.push(dto.sender_id); }
    if (dto.config !== undefined) { sets.push('config = ?'); params.push(JSON.stringify(dto.config)); }
    if (dto.is_default !== undefined) { sets.push('is_default = ?'); params.push(dto.is_default); }
    if (dto.is_active !== undefined) { sets.push('is_active = ?'); params.push(dto.is_active); }
    if (!sets.length) return;
    params.push(id, companyId);
    await this.ds.query(`UPDATE sms_providers SET ${sets.join(', ')} WHERE id = ? AND company_id = ?`, params);
  }

  async remove(id: number, companyId: number): Promise<void> {
    await this.ds.query(`DELETE FROM sms_providers WHERE id = ? AND company_id = ?`, [id, companyId]);
  }
}
