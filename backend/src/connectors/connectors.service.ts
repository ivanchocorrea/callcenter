import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { EncryptionService } from '../common/encryption/encryption.service';

@Injectable()
export class ConnectorsService {
  private readonly logger = new Logger(ConnectorsService.name);

  constructor(
    @InjectDataSource() private readonly ds: DataSource,
    private readonly encryption: EncryptionService,
  ) {}

  async list(companyId: number): Promise<unknown[]> {
    return this.ds.query(`SELECT id, slug, connector_type, name, is_read_only, last_sync_at, last_sync_status, is_active FROM data_connectors WHERE company_id = ?`, [companyId]);
  }

  async create(companyId: number, dto: { slug: string; connector_type: string; name: string; description?: string; config: Record<string, unknown>; is_read_only?: boolean }): Promise<{ id: number }> {
    const r: any = await this.ds.query(
      `INSERT INTO data_connectors (company_id, slug, connector_type, name, description, config, is_read_only, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, TRUE)`,
      [companyId, dto.slug, dto.connector_type, dto.name, dto.description ?? null, JSON.stringify(dto.config), dto.is_read_only ?? true],
    );
    return { id: r?.insertId ?? r?.[0]?.insertId };
  }

  async setCredential(connectorId: number, companyId: number, type: 'api_key' | 'oauth2' | 'basic' | 'bearer' | 'custom', value: string, refreshToken?: string): Promise<void> {
    const c = await this.ds.query(`SELECT id FROM data_connectors WHERE id = ? AND company_id = ?`, [connectorId, companyId]);
    if (!c[0]) throw new NotFoundException();
    await this.ds.query(`DELETE FROM connector_credentials WHERE connector_id = ?`, [connectorId]);
    await this.ds.query(
      `INSERT INTO connector_credentials (company_id, connector_id, credential_type, value_encrypted, refresh_token_encrypted)
       VALUES (?, ?, ?, ?, ?)`,
      [companyId, connectorId, type, this.encryption.encrypt(value), refreshToken ? this.encryption.encrypt(refreshToken) : null],
    );
  }

  /** Ejecuta una consulta sobre un connector (lo usan las AI tools). */
  async execute(companyId: number, connectorId: number, input: Record<string, unknown>): Promise<unknown> {
    const c = await this.ds.query(`SELECT * FROM data_connectors WHERE id = ? AND company_id = ?`, [connectorId, companyId]);
    const con = c[0];
    if (!con) throw new NotFoundException();
    const cfg = typeof con.config === 'string' ? JSON.parse(con.config) : con.config;
    const credRows = await this.ds.query(`SELECT credential_type, value_encrypted FROM connector_credentials WHERE connector_id = ?`, [connectorId]);
    const cred = credRows[0];

    switch (con.connector_type) {
      case 'google_sheets':
        return this.executeGoogleSheets(cfg, cred ? this.encryption.decrypt(cred.value_encrypted) : null, input);
      case 'external_api':
        return this.executeExternalApi(cfg, cred ? this.encryption.decrypt(cred.value_encrypted) : null, input);
      case 'mysql_external':
      case 'postgres_external':
        throw new Error('Conector SQL externo: requiere driver dedicado (Fase 18+)');
      case 'webhook':
        return this.executeExternalApi(cfg, cred ? this.encryption.decrypt(cred.value_encrypted) : null, input);
      default:
        throw new Error(`Tipo ${con.connector_type} no soportado`);
    }
  }

  /**
   * Lookup en Google Sheets. cfg = { spreadsheet_id, sheet_name, range_a1, column_mapping }
   * Auth con API key o service account JWT (la api key es más simple para sheets públicos).
   * En producción real usa OAuth2 + refresh token.
   */
  private async executeGoogleSheets(cfg: any, apiKey: string | null, input: Record<string, unknown>): Promise<unknown> {
    if (!apiKey) throw new Error('API key requerido para Google Sheets');
    const range = cfg.range_a1 ?? `${cfg.sheet_name}!A1:Z1000`;
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${cfg.spreadsheet_id}/values/${encodeURIComponent(range)}?key=${apiKey}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Sheets ${res.status}: ${await res.text()}`);
    const data = await res.json() as any;
    const rows: string[][] = data.values ?? [];
    if (!rows.length) return [];

    const headers = rows[0];
    const mapping: Record<string, string> = cfg.column_mapping ?? {};
    const target = String(input.phone ?? input.value ?? '').replace(/\s+/g, '');
    const phoneCol = mapping.phone ?? mapping.primary_phone;
    const idx = phoneCol ? headers.indexOf(phoneCol) : -1;

    const matches: any[] = [];
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (idx >= 0 && row[idx]?.replace(/\s+/g, '') === target) {
        const obj: Record<string, string> = {};
        headers.forEach((h, j) => { obj[h] = row[j] ?? ''; });
        matches.push(obj);
      }
    }
    return matches;
  }

  /**
   * Llama un endpoint REST configurado.
   * cfg = { url, method, headers, body_template, response_path }
   */
  private async executeExternalApi(cfg: any, token: string | null, input: Record<string, unknown>): Promise<unknown> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(cfg.headers ?? {}) };
    if (token) headers['Authorization'] = headers['Authorization'] ?? `Bearer ${token}`;
    const url = cfg.url.replace(/{{(\w+)}}/g, (_: string, k: string) => String(input[k] ?? ''));
    const method = (cfg.method ?? 'GET').toUpperCase();
    const body = cfg.body_template
      ? JSON.stringify(JSON.parse(JSON.stringify(cfg.body_template).replace(/"{{(\w+)}}"/g, (_: string, k: string) => JSON.stringify(input[k] ?? null))))
      : (method !== 'GET' ? JSON.stringify(input) : undefined);
    const res = await fetch(url, { method, headers, body });
    if (!res.ok) throw new Error(`Connector ${res.status}: ${await res.text()}`);
    const data = await res.json();
    if (cfg.response_path) {
      return cfg.response_path.split('.').reduce((o: any, k: string) => (o ? o[k] : undefined), data);
    }
    return data;
  }
}
