import { ForbiddenException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { EncryptionService } from '../common/encryption/encryption.service';

export interface ApiKeyContext {
  apiKeyId: number;
  companyId: number;
  scopes: string[];
}

@Injectable()
export class PublicApiService {
  private readonly logger = new Logger(PublicApiService.name);

  constructor(
    @InjectDataSource() private readonly ds: DataSource,
    private readonly encryption: EncryptionService,
  ) {}

  /** Genera nueva API key. Devuelve el secret SOLO una vez. */
  async createKey(companyId: number, name: string, scopes: string[], rateLimit?: number, expiresAt?: Date, userId?: number): Promise<{ id: number; key: string }> {
    const prefix = `cck_live_${this.encryption.generateRandomToken(6).slice(0, 8)}`;
    const secret = this.encryption.generateRandomToken(32);
    const fullKey = `${prefix}_${secret}`;
    const hash = await bcrypt.hash(secret, 10);
    const r: any = await this.ds.query(
      `INSERT INTO api_keys (company_id, name, key_prefix, key_hash, scopes, rate_limit_per_minute, expires_at, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [companyId, name, prefix, hash, JSON.stringify(scopes), rateLimit ?? 120, expiresAt ?? null, userId ?? null],
    );
    return { id: r?.insertId ?? r?.[0]?.insertId, key: fullKey };
  }

  async listKeys(companyId: number): Promise<unknown[]> {
    return this.ds.query(
      `SELECT id, name, key_prefix, scopes, rate_limit_per_minute, expires_at, last_used_at, revoked_at, created_at
         FROM api_keys WHERE company_id = ? ORDER BY id DESC`,
      [companyId],
    );
  }

  async revoke(id: number, companyId: number): Promise<void> {
    await this.ds.query(`UPDATE api_keys SET revoked_at = NOW() WHERE id = ? AND company_id = ?`, [id, companyId]);
  }

  /** Resuelve la API key del header Authorization → contexto. */
  async authenticate(rawKey: string): Promise<ApiKeyContext> {
    if (!rawKey?.startsWith('cck_live_')) throw new UnauthorizedException('API key inválida');
    const lastUnderscore = rawKey.lastIndexOf('_');
    if (lastUnderscore < 9) throw new UnauthorizedException('API key inválida');
    const prefix = rawKey.substring(0, lastUnderscore);
    const secret = rawKey.substring(lastUnderscore + 1);

    const rows = await this.ds.query(
      `SELECT id, company_id, key_hash, scopes, expires_at, revoked_at FROM api_keys WHERE key_prefix = ? LIMIT 1`,
      [prefix],
    );
    const k = rows[0];
    if (!k) throw new UnauthorizedException('API key no encontrada');
    if (k.revoked_at) throw new UnauthorizedException('API key revocada');
    if (k.expires_at && new Date(k.expires_at) < new Date()) throw new UnauthorizedException('API key expirada');

    const ok = await bcrypt.compare(secret, k.key_hash);
    if (!ok) throw new UnauthorizedException('API key inválida');

    await this.ds.query(`UPDATE api_keys SET last_used_at = NOW() WHERE id = ?`, [k.id]);

    return {
      apiKeyId: Number(k.id),
      companyId: Number(k.company_id),
      scopes: typeof k.scopes === 'string' ? JSON.parse(k.scopes) : k.scopes,
    };
  }

  hasScope(ctx: ApiKeyContext, scope: string): boolean {
    return ctx.scopes.includes('*') || ctx.scopes.includes(scope);
  }
}
