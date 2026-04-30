import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  // ---------- plans
  async listPlans(): Promise<unknown[]> {
    return this.ds.query(`SELECT * FROM plans WHERE is_public = TRUE AND is_active = TRUE ORDER BY price_monthly ASC`);
  }

  // ---------- subscriptions
  async currentSubscription(companyId: number): Promise<unknown | null> {
    const r = await this.ds.query(
      `SELECT s.*, p.name AS plan_name, p.slug AS plan_slug, p.features, p.max_users, p.max_agents,
              p.included_minutes, p.included_sms, p.storage_gb
         FROM subscriptions s
         INNER JOIN plans p ON p.id = s.plan_id
         WHERE s.company_id = ?
         ORDER BY s.id DESC LIMIT 1`,
      [companyId],
    );
    return r[0] ?? null;
  }

  async startTrial(companyId: number, planSlug: string, days = 14): Promise<{ id: number }> {
    const plan = await this.ds.query(`SELECT id FROM plans WHERE slug = ?`, [planSlug]);
    if (!plan[0]) throw new Error(`Plan ${planSlug} no encontrado`);
    const r: any = await this.ds.query(
      `INSERT INTO subscriptions (company_id, plan_id, status, is_trial, trial_ends_at, started_at, current_period_start, current_period_end)
       VALUES (?, ?, 'trialing', TRUE, DATE_ADD(NOW(), INTERVAL ? DAY), NOW(), NOW(), DATE_ADD(NOW(), INTERVAL 1 MONTH))`,
      [companyId, plan[0].id, days],
    );
    return { id: r?.insertId ?? r?.[0]?.insertId };
  }

  /** Cambiar plan de una empresa (super_admin only). Cancela suscripción anterior y crea nueva. */
  async changePlan(companyId: number, planSlug: string, options?: { isTrial?: boolean; trialDays?: number }): Promise<{ id: number }> {
    const plan = await this.ds.query(`SELECT id FROM plans WHERE slug = ?`, [planSlug]);
    if (!plan[0]) throw new Error(`Plan ${planSlug} no encontrado`);
    await this.ds.query(
      `UPDATE subscriptions SET status = 'canceled', canceled_at = NOW() WHERE company_id = ? AND status IN ('active','trialing')`,
      [companyId],
    );
    const isTrial = options?.isTrial ?? false;
    const days = options?.trialDays ?? 14;
    const trialClause = isTrial ? `DATE_ADD(NOW(), INTERVAL ${days} DAY)` : 'NULL';
    const r: any = await this.ds.query(
      `INSERT INTO subscriptions (company_id, plan_id, status, is_trial, trial_ends_at, started_at, current_period_start, current_period_end)
       VALUES (?, ?, ?, ?, ${trialClause}, NOW(), NOW(), DATE_ADD(NOW(), INTERVAL 1 MONTH))`,
      [companyId, plan[0].id, isTrial ? 'trialing' : 'active', isTrial],
    );
    return { id: r?.insertId ?? r?.[0]?.insertId };
  }

  /** Override de límites por empresa (custom override del plan). */
  async setCustomLimits(companyId: number, limits: { max_users?: number; max_agents?: number; max_concurrent_calls?: number }): Promise<void> {
    await this.ds.query(
      `UPDATE subscriptions SET metadata = JSON_SET(COALESCE(metadata, '{}'), '$.overrides', CAST(? AS JSON))
       WHERE company_id = ? AND status IN ('active','trialing')`,
      [JSON.stringify(limits), companyId],
    );
  }

  /** Obtener límites efectivos de empresa (plan + overrides) + uso actual. */
  async getCompanyLimits(companyId: number): Promise<{ plan_slug: string | null; max_users: number | null; max_agents: number | null; max_concurrent_calls: number | null; current: { users: number; agents: number } }> {
    const sub = await this.ds.query(
      `SELECT s.metadata, p.slug as plan_slug, p.max_users, p.max_agents, p.max_concurrent_calls
         FROM subscriptions s
         INNER JOIN plans p ON p.id = s.plan_id
         WHERE s.company_id = ? AND s.status IN ('active','trialing')
         ORDER BY s.id DESC LIMIT 1`,
      [companyId],
    );
    const meta = sub[0]?.metadata ? (typeof sub[0].metadata === 'string' ? JSON.parse(sub[0].metadata) : sub[0].metadata) : {};
    const overrides = meta.overrides ?? {};
    const usersCount = (await this.ds.query(`SELECT COUNT(*) c FROM users WHERE company_id = ?`, [companyId]))[0]?.c ?? 0;
    const agentsCount = (await this.ds.query(`SELECT COUNT(*) c FROM agents WHERE company_id = ?`, [companyId]))[0]?.c ?? 0;
    return {
      plan_slug: sub[0]?.plan_slug ?? null,
      max_users: overrides.max_users ?? sub[0]?.max_users ?? null,
      max_agents: overrides.max_agents ?? sub[0]?.max_agents ?? null,
      max_concurrent_calls: overrides.max_concurrent_calls ?? sub[0]?.max_concurrent_calls ?? null,
      current: { users: Number(usersCount), agents: Number(agentsCount) },
    };
  }

  // ---------- usage
  async currentUsage(companyId: number): Promise<unknown[]> {
    return this.ds.query(
      `SELECT metric, used_value, quota_value, period_start, period_end, is_overage
         FROM usage_counters WHERE company_id = ? AND CURDATE() BETWEEN period_start AND period_end`,
      [companyId],
    );
  }

  /** Cron diario que actualiza usage_counters de minutos/sms/storage/etc. */
  @Cron(CronExpression.EVERY_HOUR)
  async updateUsage(): Promise<void> {
    // Voice minutes
    await this.ds.query(
      `INSERT INTO usage_counters (company_id, metric, period_start, period_end, used_value, updated_at)
       SELECT c.company_id, 'voice_minutes',
              DATE_FORMAT(CURDATE(), '%Y-%m-01'),
              LAST_DAY(CURDATE()),
              COALESCE(SUM(c.duration_seconds) / 60, 0),
              NOW()
         FROM calls c
         WHERE c.started_at >= DATE_FORMAT(CURDATE(), '%Y-%m-01')
         GROUP BY c.company_id
       ON DUPLICATE KEY UPDATE used_value = VALUES(used_value), updated_at = NOW()`,
    );
    // SMS
    await this.ds.query(
      `INSERT INTO usage_counters (company_id, metric, period_start, period_end, used_value, updated_at)
       SELECT s.company_id, 'sms_count',
              DATE_FORMAT(CURDATE(), '%Y-%m-01'),
              LAST_DAY(CURDATE()),
              COUNT(*),
              NOW()
         FROM sms_logs s
         WHERE s.created_at >= DATE_FORMAT(CURDATE(), '%Y-%m-01') AND s.status IN ('sent','delivered')
         GROUP BY s.company_id
       ON DUPLICATE KEY UPDATE used_value = VALUES(used_value), updated_at = NOW()`,
    );
    // AI tokens
    await this.ds.query(
      `INSERT INTO usage_counters (company_id, metric, period_start, period_end, used_value, updated_at)
       SELECT a.company_id, 'ai_tokens',
              DATE_FORMAT(CURDATE(), '%Y-%m-01'),
              LAST_DAY(CURDATE()),
              COALESCE(SUM(tokens_input + tokens_output), 0),
              NOW()
         FROM ai_usage_logs a
         WHERE a.occurred_at >= DATE_FORMAT(CURDATE(), '%Y-%m-01')
         GROUP BY a.company_id
       ON DUPLICATE KEY UPDATE used_value = VALUES(used_value), updated_at = NOW()`,
    );
    // Sync quotas vs plan
    await this.ds.query(
      `UPDATE usage_counters uc
         INNER JOIN subscriptions s ON s.company_id = uc.company_id AND s.status IN ('active','trialing')
         INNER JOIN plans p ON p.id = s.plan_id
         SET uc.quota_value = CASE
           WHEN uc.metric = 'voice_minutes' THEN p.included_minutes
           WHEN uc.metric = 'sms_count' THEN p.included_sms
           WHEN uc.metric = 'storage_gb' THEN p.storage_gb
           ELSE uc.quota_value
         END,
         uc.is_overage = (uc.quota_value IS NOT NULL AND uc.used_value > uc.quota_value)
       WHERE CURDATE() BETWEEN uc.period_start AND uc.period_end`,
    );
  }

  // ---------- invoices
  /** Genera factura del mes anterior para todas las empresas activas. */
  async generateMonthlyInvoices(): Promise<{ generated: number }> {
    const subs = await this.ds.query(
      `SELECT s.company_id, s.plan_id, p.price_monthly, p.currency, c.legal_name
         FROM subscriptions s
         INNER JOIN plans p ON p.id = s.plan_id
         INNER JOIN companies c ON c.id = s.company_id
         WHERE s.status = 'active'`,
    );
    let generated = 0;
    for (const s of subs) {
      const periodStart = new Date(); periodStart.setDate(1); periodStart.setMonth(periodStart.getMonth() - 1);
      const periodEnd = new Date(periodStart.getFullYear(), periodStart.getMonth() + 1, 0);
      const number = `INV-${periodStart.getFullYear()}${String(periodStart.getMonth() + 1).padStart(2, '0')}-${s.company_id}`;
      const dup = await this.ds.query(`SELECT id FROM invoices WHERE company_id = ? AND invoice_number = ?`, [s.company_id, number]);
      if (dup[0]) continue;
      const subtotal = Number(s.price_monthly);
      const tax = Math.round(subtotal * 0.19 * 100) / 100;
      const total = subtotal + tax;
      await this.ds.query(
        `INSERT INTO invoices (company_id, subscription_id, invoice_number, status, period_start, period_end, subtotal, tax, total, currency, issued_at, due_at, line_items)
         VALUES (?, NULL, ?, 'open', ?, ?, ?, ?, ?, ?, NOW(), DATE_ADD(NOW(), INTERVAL 15 DAY), ?)`,
        [s.company_id, number, periodStart, periodEnd, subtotal, tax, total, s.currency, JSON.stringify([{ desc: 'Suscripción mensual', amount: subtotal }])],
      );
      generated++;
    }
    return { generated };
  }

  async listInvoices(companyId: number): Promise<unknown[]> {
    return this.ds.query(`SELECT * FROM invoices WHERE company_id = ? ORDER BY id DESC LIMIT 50`, [companyId]);
  }
}
