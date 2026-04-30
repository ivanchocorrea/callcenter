import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { EncryptionService } from '../common/encryption/encryption.service';
import { StorageService } from './storage.service';

export interface CreateStorageProviderDto {
  slug: string;
  name: string;
  driver: 'local' | 's3' | 'minio' | 'wasabi' | 'backblaze';
  region?: string;
  bucket?: string;
  endpoint?: string;
  access_key?: string;
  secret_key?: string;
  use_path_style?: boolean;
  base_path?: string;
  is_default?: boolean;
  is_active?: boolean;
}

@Injectable()
export class StorageProvidersService {
  constructor(
    @InjectDataSource() private readonly ds: DataSource,
    private readonly encryption: EncryptionService,
    private readonly storage: StorageService,
  ) {}

  async list(companyId: number): Promise<unknown[]> {
    const rows = await this.ds.query(
      `SELECT id, slug, name, driver, region, bucket, endpoint, use_path_style, base_path,
              is_default, is_active, created_at
         FROM storage_providers WHERE company_id = ? ORDER BY name`,
      [companyId],
    );
    return rows.map((r: any) => ({ ...r, has_credentials: true }));
  }

  async findById(id: number, companyId: number): Promise<unknown> {
    const r = await this.ds.query(`SELECT * FROM storage_providers WHERE id = ? AND company_id = ?`, [id, companyId]);
    if (!r[0]) throw new NotFoundException();
    return r[0];
  }

  async create(companyId: number, dto: CreateStorageProviderDto): Promise<{ id: number }> {
    const dup = await this.ds.query(`SELECT id FROM storage_providers WHERE company_id = ? AND slug = ?`, [companyId, dto.slug]);
    if (dup[0]) throw new ConflictException('Ya existe un proveedor con ese slug');

    const accessKeyEnc = dto.access_key ? this.encryption.encrypt(dto.access_key) : null;
    const secretKeyEnc = dto.secret_key ? this.encryption.encrypt(dto.secret_key) : null;

    const r: any = await this.ds.query(
      `INSERT INTO storage_providers
        (company_id, slug, name, driver, region, bucket, endpoint,
         access_key_encrypted, secret_key_encrypted, use_path_style, base_path,
         is_default, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        companyId, dto.slug, dto.name, dto.driver,
        dto.region ?? null, dto.bucket ?? null, dto.endpoint ?? null,
        accessKeyEnc, secretKeyEnc,
        dto.use_path_style ?? true,
        dto.base_path ?? null,
        dto.is_default ?? false,
        dto.is_active ?? true,
      ],
    );
    if (dto.is_default) this.storage.invalidateCompany(companyId);
    return { id: r?.insertId ?? r?.[0]?.insertId };
  }

  async update(id: number, companyId: number, dto: Partial<CreateStorageProviderDto>): Promise<void> {
    const sets: string[] = [];
    const params: unknown[] = [];
    if (dto.name !== undefined) { sets.push('name = ?'); params.push(dto.name); }
    if (dto.region !== undefined) { sets.push('region = ?'); params.push(dto.region); }
    if (dto.bucket !== undefined) { sets.push('bucket = ?'); params.push(dto.bucket); }
    if (dto.endpoint !== undefined) { sets.push('endpoint = ?'); params.push(dto.endpoint); }
    if (dto.access_key !== undefined) { sets.push('access_key_encrypted = ?'); params.push(this.encryption.encrypt(dto.access_key)); }
    if (dto.secret_key !== undefined) { sets.push('secret_key_encrypted = ?'); params.push(this.encryption.encrypt(dto.secret_key)); }
    if (dto.use_path_style !== undefined) { sets.push('use_path_style = ?'); params.push(dto.use_path_style); }
    if (dto.base_path !== undefined) { sets.push('base_path = ?'); params.push(dto.base_path); }
    if (dto.is_default !== undefined) { sets.push('is_default = ?'); params.push(dto.is_default); }
    if (dto.is_active !== undefined) { sets.push('is_active = ?'); params.push(dto.is_active); }
    if (!sets.length) return;
    params.push(id, companyId);
    await this.ds.query(`UPDATE storage_providers SET ${sets.join(', ')} WHERE id = ? AND company_id = ?`, params);
    this.storage.invalidateCompany(companyId);
  }

  async remove(id: number, companyId: number): Promise<void> {
    await this.ds.query(`DELETE FROM storage_providers WHERE id = ? AND company_id = ?`, [id, companyId]);
    this.storage.invalidateCompany(companyId);
  }
}
