import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

export interface CreatePromptDto {
  slug: string;
  name: string;
  description?: string;
  scope?: string;
  target_id?: number;
  content: string;
}

@Injectable()
export class PromptsService {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  async list(companyId: number): Promise<unknown[]> {
    return this.ds.query(
      `SELECT p.*, v.version, v.created_at AS version_created_at
         FROM ai_prompts p
         LEFT JOIN ai_prompt_versions v ON v.id = p.active_version_id
         WHERE p.company_id = ? OR p.company_id IS NULL
         ORDER BY p.name`,
      [companyId],
    );
  }

  async findById(id: number, companyId: number): Promise<unknown> {
    const r = await this.ds.query(
      `SELECT p.*, v.content AS active_content, v.version AS active_version
         FROM ai_prompts p
         LEFT JOIN ai_prompt_versions v ON v.id = p.active_version_id
         WHERE p.id = ? AND (p.company_id = ? OR p.company_id IS NULL)`,
      [id, companyId],
    );
    if (!r[0]) throw new NotFoundException();
    const versions = await this.ds.query(
      `SELECT id, version, notes, created_by, created_at FROM ai_prompt_versions WHERE prompt_id = ? ORDER BY version DESC`,
      [id],
    );
    return { ...r[0], versions };
  }

  async create(companyId: number, userId: number, dto: CreatePromptDto): Promise<{ id: number; version_id: number }> {
    const dup = await this.ds.query(`SELECT id FROM ai_prompts WHERE company_id = ? AND slug = ?`, [companyId, dto.slug]);
    if (dup[0]) throw new ConflictException();

    const ins: any = await this.ds.query(
      `INSERT INTO ai_prompts (company_id, slug, name, description, scope, target_id, is_active, created_by)
       VALUES (?, ?, ?, ?, ?, ?, TRUE, ?)`,
      [companyId, dto.slug, dto.name, dto.description ?? null, dto.scope ?? 'company', dto.target_id ?? null, userId],
    );
    const id = ins?.insertId ?? ins?.[0]?.insertId;

    const v: any = await this.ds.query(
      `INSERT INTO ai_prompt_versions (prompt_id, version, content, created_by) VALUES (?, 1, ?, ?)`,
      [id, dto.content, userId],
    );
    const versionId = v?.insertId ?? v?.[0]?.insertId;
    await this.ds.query(`UPDATE ai_prompts SET active_version_id = ? WHERE id = ?`, [versionId, id]);

    return { id, version_id: versionId };
  }

  /** Crea una nueva versión y opcionalmente la activa. */
  async createVersion(promptId: number, companyId: number, userId: number, content: string, notes?: string, activate = true): Promise<{ version_id: number; version: number }> {
    await this.ensureExists(promptId, companyId);
    const last = await this.ds.query(`SELECT MAX(version) AS v FROM ai_prompt_versions WHERE prompt_id = ?`, [promptId]);
    const nextVersion = (Number(last[0]?.v) || 0) + 1;
    const v: any = await this.ds.query(
      `INSERT INTO ai_prompt_versions (prompt_id, version, content, notes, created_by) VALUES (?, ?, ?, ?, ?)`,
      [promptId, nextVersion, content, notes ?? null, userId],
    );
    const versionId = v?.insertId ?? v?.[0]?.insertId;
    if (activate) await this.ds.query(`UPDATE ai_prompts SET active_version_id = ? WHERE id = ?`, [versionId, promptId]);
    return { version_id: versionId, version: nextVersion };
  }

  async activateVersion(promptId: number, versionId: number, companyId: number): Promise<void> {
    await this.ensureExists(promptId, companyId);
    const v = await this.ds.query(`SELECT id FROM ai_prompt_versions WHERE id = ? AND prompt_id = ?`, [versionId, promptId]);
    if (!v[0]) throw new NotFoundException();
    await this.ds.query(`UPDATE ai_prompts SET active_version_id = ? WHERE id = ?`, [versionId, promptId]);
  }

  /** Aplica variables al contenido del prompt activo: `{{customer_name}}` → valor. */
  async render(promptId: number, companyId: number, vars: Record<string, string>): Promise<string> {
    const p = await this.ds.query(
      `SELECT v.content FROM ai_prompts p INNER JOIN ai_prompt_versions v ON v.id = p.active_version_id
         WHERE p.id = ? AND (p.company_id = ? OR p.company_id IS NULL)`,
      [promptId, companyId],
    );
    if (!p[0]) throw new NotFoundException();
    return (p[0].content as string).replace(/{{(\w+)}}/g, (_, k) => vars[k] ?? '');
  }

  private async ensureExists(promptId: number, companyId: number): Promise<void> {
    const r = await this.ds.query(`SELECT id FROM ai_prompts WHERE id = ? AND (company_id = ? OR company_id IS NULL)`, [promptId, companyId]);
    if (!r[0]) throw new NotFoundException();
  }
}
