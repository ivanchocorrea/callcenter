import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

interface QualityFormDto {
  slug: string;
  name: string;
  description?: string;
  schema: { criteria: Array<{ key: string; label: string; weight: number; max_score: number }> };
  max_score?: number;
}

interface QualityReviewDto {
  call_id: number;
  agent_id: number;
  scores: Record<string, number>;     // key → score
  feedback?: string;
  pass?: boolean;
}

@Injectable()
export class QualityService {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  // ---------- forms
  async listForms(companyId: number): Promise<unknown[]> {
    return this.ds.query(`SELECT * FROM quality_forms WHERE company_id = ? ORDER BY name`, [companyId]);
  }

  async createForm(companyId: number, dto: QualityFormDto): Promise<{ id: number }> {
    const r: any = await this.ds.query(
      `INSERT INTO quality_forms (company_id, slug, name, description, schema, max_score, is_active)
       VALUES (?, ?, ?, ?, ?, ?, TRUE)`,
      [companyId, dto.slug, dto.name, dto.description ?? null, JSON.stringify(dto.schema), dto.max_score ?? 100],
    );
    return { id: r?.insertId ?? r?.[0]?.insertId };
  }

  // ---------- reviews
  async createReview(companyId: number, formId: number, reviewerUserId: number, dto: QualityReviewDto): Promise<{ id: number; score: number; pass: boolean }> {
    const f = await this.ds.query(`SELECT schema, max_score FROM quality_forms WHERE id = ? AND company_id = ?`, [formId, companyId]);
    if (!f[0]) throw new NotFoundException();
    const schema = typeof f[0].schema === 'string' ? JSON.parse(f[0].schema) : f[0].schema;
    const max = Number(f[0].max_score) || 100;

    let total = 0;
    let weightSum = 0;
    for (const c of schema.criteria ?? []) {
      const score = Number(dto.scores[c.key] ?? 0);
      total += score * (c.weight ?? 1);
      weightSum += (c.weight ?? 1) * (c.max_score ?? max);
    }
    const finalScore = weightSum ? Math.round((total / weightSum) * max) : 0;
    const pass = dto.pass ?? finalScore >= max * 0.7;

    const r: any = await this.ds.query(
      `INSERT INTO quality_reviews (company_id, form_id, call_id, agent_id, reviewer_user_id, score, pass, feedback, answers)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [companyId, formId, dto.call_id, dto.agent_id, reviewerUserId, finalScore, pass, dto.feedback ?? null, JSON.stringify(dto.scores)],
    );
    const id = r?.insertId ?? r?.[0]?.insertId;
    for (const c of schema.criteria ?? []) {
      await this.ds.query(
        `INSERT INTO quality_scores (company_id, review_id, criterion_key, score, weight, comment)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [companyId, id, c.key, Number(dto.scores[c.key] ?? 0), c.weight ?? 1, null],
      );
    }
    return { id, score: finalScore, pass };
  }

  async listReviews(companyId: number, agentId?: number, limit = 100): Promise<unknown[]> {
    if (agentId) {
      return this.ds.query(
        `SELECT r.*, f.name AS form_name, u.full_name AS reviewer FROM quality_reviews r
           INNER JOIN quality_forms f ON f.id = r.form_id
           INNER JOIN users u ON u.id = r.reviewer_user_id
           WHERE r.company_id = ? AND r.agent_id = ? ORDER BY r.id DESC LIMIT ?`,
        [companyId, agentId, limit],
      );
    }
    return this.ds.query(
      `SELECT r.*, f.name AS form_name, u.full_name AS reviewer, ag.display_name AS agent_name
         FROM quality_reviews r
         INNER JOIN quality_forms f ON f.id = r.form_id
         INNER JOIN users u ON u.id = r.reviewer_user_id
         INNER JOIN agents ag ON ag.id = r.agent_id
         WHERE r.company_id = ? ORDER BY r.id DESC LIMIT ?`,
      [companyId, limit],
    );
  }
}
