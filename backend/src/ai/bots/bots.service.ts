import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

export interface CreateBotDto {
  slug: string;
  name: string;
  bot_type?: string;
  provider_id: number;
  model: string;
  voice?: string;
  locale?: string;
  prompt_id?: number;
  welcome_message?: string;
  fallback_message?: string;
  transfer_keywords?: string[];
  transfer_destination_type?: string;
  transfer_destination_id?: number;
  business_hours_id?: number;
  max_turns?: number;
  max_duration_seconds?: number;
  monthly_token_limit?: number;
  is_active?: boolean;
}

@Injectable()
export class BotsService {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  async list(companyId: number): Promise<unknown[]> {
    return this.ds.query(
      `SELECT b.*, p.name AS provider_name FROM ai_bots b
         LEFT JOIN ai_providers p ON p.id = b.provider_id
         WHERE b.company_id = ? ORDER BY b.name`,
      [companyId],
    );
  }

  async findById(id: number, companyId: number): Promise<unknown> {
    const r = await this.ds.query(`SELECT * FROM ai_bots WHERE id = ? AND company_id = ?`, [id, companyId]);
    if (!r[0]) throw new NotFoundException();
    return r[0];
  }

  async create(companyId: number, dto: CreateBotDto): Promise<{ id: number }> {
    const dup = await this.ds.query(`SELECT id FROM ai_bots WHERE company_id = ? AND slug = ?`, [companyId, dto.slug]);
    if (dup[0]) throw new ConflictException();
    const r: any = await this.ds.query(
      `INSERT INTO ai_bots
        (company_id, slug, name, bot_type, provider_id, model, voice, locale, prompt_id,
         welcome_message, fallback_message, transfer_to_human_keywords, transfer_destination_type, transfer_destination_id,
         business_hours_id, max_turns, max_duration_seconds, monthly_token_limit, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        companyId, dto.slug, dto.name, dto.bot_type ?? 'custom', dto.provider_id, dto.model,
        dto.voice ?? null, dto.locale ?? 'es-CO', dto.prompt_id ?? null,
        dto.welcome_message ?? null, dto.fallback_message ?? null,
        dto.transfer_keywords ? JSON.stringify(dto.transfer_keywords) : null,
        dto.transfer_destination_type ?? null, dto.transfer_destination_id ?? null,
        dto.business_hours_id ?? null, dto.max_turns ?? null, dto.max_duration_seconds ?? null,
        dto.monthly_token_limit ?? null, dto.is_active ?? true,
      ],
    );
    return { id: r?.insertId ?? r?.[0]?.insertId };
  }

  async update(id: number, companyId: number, dto: Partial<CreateBotDto>): Promise<void> {
    const sets: string[] = [];
    const params: unknown[] = [];
    const m: Record<string, string> = {
      name: 'name', bot_type: 'bot_type', provider_id: 'provider_id', model: 'model',
      voice: 'voice', locale: 'locale', prompt_id: 'prompt_id',
      welcome_message: 'welcome_message', fallback_message: 'fallback_message',
      transfer_destination_type: 'transfer_destination_type', transfer_destination_id: 'transfer_destination_id',
      business_hours_id: 'business_hours_id', max_turns: 'max_turns',
      max_duration_seconds: 'max_duration_seconds', monthly_token_limit: 'monthly_token_limit',
      is_active: 'is_active',
    };
    for (const [k, col] of Object.entries(m)) {
      if ((dto as any)[k] !== undefined) { sets.push(`${col} = ?`); params.push((dto as any)[k]); }
    }
    if (dto.transfer_keywords !== undefined) {
      sets.push('transfer_to_human_keywords = ?');
      params.push(JSON.stringify(dto.transfer_keywords));
    }
    if (!sets.length) return;
    params.push(id, companyId);
    await this.ds.query(`UPDATE ai_bots SET ${sets.join(', ')} WHERE id = ? AND company_id = ?`, params);
  }

  async remove(id: number, companyId: number): Promise<void> {
    await this.ds.query(`DELETE FROM ai_bots WHERE id = ? AND company_id = ?`, [id, companyId]);
  }
}
