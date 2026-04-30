import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { EncryptionService } from '../../common/encryption/encryption.service';

export interface CreateProviderDto {
  slug: string;
  name: string;
  provider_type: 'openai' | 'anthropic' | 'google' | 'azure_openai' | 'generic_http' | 'deepgram' | 'whisper';
  api_key?: string;
  base_url?: string;
  organization_id?: string;
  default_model?: string;
  capabilities?: string[];
  headers?: Record<string, string>;
  is_default?: boolean;
  is_active?: boolean;
}

@Injectable()
export class ProvidersService {
  constructor(
    @InjectDataSource() private readonly ds: DataSource,
    private readonly encryption: EncryptionService,
  ) {}

  async list(companyId: number): Promise<unknown[]> {
    const rows = await this.ds.query(
      `SELECT id, slug, name, provider_type, base_url, organization_id, default_model,
              capabilities, headers, is_default, is_active, created_at
         FROM ai_providers WHERE company_id = ? ORDER BY name`,
      [companyId],
    );
    // Mascarar api_key (no devolverlo)
    return rows.map((r: any) => ({
      ...r,
      capabilities: typeof r.capabilities === 'string' ? JSON.parse(r.capabilities) : r.capabilities,
      headers: r.headers ? (typeof r.headers === 'string' ? JSON.parse(r.headers) : r.headers) : null,
      has_api_key: true,
    }));
  }

  async findById(id: number, companyId: number): Promise<unknown> {
    const r = await this.ds.query(`SELECT * FROM ai_providers WHERE id = ? AND company_id = ?`, [id, companyId]);
    if (!r[0]) throw new NotFoundException();
    return r[0];
  }

  async create(companyId: number, dto: CreateProviderDto): Promise<{ id: number }> {
    const dup = await this.ds.query(`SELECT id FROM ai_providers WHERE company_id = ? AND slug = ?`, [companyId, dto.slug]);
    if (dup[0]) throw new ConflictException('Ya existe un proveedor con ese slug');

    const apiKeyEnc = dto.api_key ? this.encryption.encrypt(dto.api_key) : null;

    const r: any = await this.ds.query(
      `INSERT INTO ai_providers
        (company_id, slug, name, provider_type, base_url, api_key_encrypted,
         organization_id, default_model, capabilities, headers, is_default, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        companyId, dto.slug, dto.name, dto.provider_type,
        dto.base_url ?? null, apiKeyEnc,
        dto.organization_id ?? null,
        dto.default_model ?? null,
        dto.capabilities ? JSON.stringify(dto.capabilities) : null,
        dto.headers ? JSON.stringify(dto.headers) : null,
        dto.is_default ?? false,
        dto.is_active ?? true,
      ],
    );
    return { id: r?.insertId ?? r?.[0]?.insertId };
  }

  async update(id: number, companyId: number, dto: Partial<CreateProviderDto>): Promise<void> {
    const sets: string[] = [];
    const params: unknown[] = [];
    if (dto.name !== undefined) { sets.push('name = ?'); params.push(dto.name); }
    if (dto.provider_type !== undefined) { sets.push('provider_type = ?'); params.push(dto.provider_type); }
    if (dto.base_url !== undefined) { sets.push('base_url = ?'); params.push(dto.base_url); }
    if (dto.api_key !== undefined) { sets.push('api_key_encrypted = ?'); params.push(this.encryption.encrypt(dto.api_key)); }
    if (dto.organization_id !== undefined) { sets.push('organization_id = ?'); params.push(dto.organization_id); }
    if (dto.default_model !== undefined) { sets.push('default_model = ?'); params.push(dto.default_model); }
    if (dto.capabilities !== undefined) { sets.push('capabilities = ?'); params.push(JSON.stringify(dto.capabilities)); }
    if (dto.headers !== undefined) { sets.push('headers = ?'); params.push(JSON.stringify(dto.headers)); }
    if (dto.is_default !== undefined) { sets.push('is_default = ?'); params.push(dto.is_default); }
    if (dto.is_active !== undefined) { sets.push('is_active = ?'); params.push(dto.is_active); }
    if (!sets.length) return;
    params.push(id, companyId);
    await this.ds.query(`UPDATE ai_providers SET ${sets.join(', ')} WHERE id = ? AND company_id = ?`, params);
  }

  async remove(id: number, companyId: number): Promise<void> {
    await this.ds.query(`DELETE FROM ai_providers WHERE id = ? AND company_id = ?`, [id, companyId]);
  }
}
