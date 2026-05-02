import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AsteriskBridgeService } from '../asterisk/asterisk-bridge.service';
import { EventBusService } from '../events/event-bus.service';

interface CreateCampaignDto {
  slug: string;
  name: string;
  description?: string;
  campaign_type: 'outbound' | 'survey' | 'reminder' | 'collection';
  dialer_mode?: 'manual' | 'preview' | 'progressive' | 'predictive';
  queue_id?: number;
  bot_id?: number;
  trunk_id?: number;
  caller_id?: string;
  max_concurrent_calls?: number;
  pacing_ratio?: number;
  max_attempts_per_contact?: number;
  retry_interval_minutes?: number;
  amd_enabled?: boolean;
  amd_action?: 'hangup' | 'leave_message' | 'transfer_to_ivr' | 'to_agent';
  amd_message_audio_id?: number;
  business_hours_id?: number;
  starts_at?: string;
  ends_at?: string;
  respect_dnc?: boolean;
  record_calls?: boolean;
}

@Injectable()
export class CampaignsService {
  private readonly logger = new Logger(CampaignsService.name);

  constructor(
    @InjectDataSource() private readonly ds: DataSource,
    private readonly asterisk: AsteriskBridgeService,
    private readonly bus: EventBusService,
  ) {}

  // -------------------- CRUD --------------------

  async list(companyId: number): Promise<unknown[]> {
    return this.ds.query(
      `SELECT c.*,
              (SELECT COUNT(*) FROM campaign_contacts cc WHERE cc.campaign_id = c.id) AS contacts,
              (SELECT COUNT(*) FROM campaign_contacts cc WHERE cc.campaign_id = c.id AND cc.status = 'done') AS done
         FROM campaigns c WHERE c.company_id = ? ORDER BY c.id DESC`,
      [companyId],
    );
  }

  async findById(id: number, companyId: number): Promise<unknown> {
    const r = await this.ds.query(`SELECT * FROM campaigns WHERE id = ? AND company_id = ?`, [id, companyId]);
    if (!r[0]) throw new NotFoundException();
    return r[0];
  }

  async create(companyId: number, dto: CreateCampaignDto): Promise<{ id: number }> {
    const dup = await this.ds.query(`SELECT id FROM campaigns WHERE company_id = ? AND slug = ?`, [companyId, dto.slug]);
    if (dup[0]) throw new ConflictException();
    const r: any = await this.ds.query(
      `INSERT INTO campaigns (company_id, slug, name, description, campaign_type, dialer_mode,
        queue_id, bot_id, trunk_id, caller_id, max_concurrent_calls, pacing_ratio, max_attempts_per_contact,
        retry_interval_minutes, amd_enabled, amd_action, amd_message_audio_id,
        business_hours_id, starts_at, ends_at, respect_dnc, record_calls, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft')`,
      [
        companyId, dto.slug, dto.name, dto.description ?? null, dto.campaign_type, dto.dialer_mode ?? 'preview',
        dto.queue_id ?? null, dto.bot_id ?? null, dto.trunk_id ?? null, dto.caller_id ?? null,
        dto.max_concurrent_calls ?? 1, dto.pacing_ratio ?? 1.0, dto.max_attempts_per_contact ?? 3,
        dto.retry_interval_minutes ?? 60, dto.amd_enabled ?? false, dto.amd_action ?? null, dto.amd_message_audio_id ?? null,
        dto.business_hours_id ?? null, dto.starts_at ?? null, dto.ends_at ?? null,
        dto.respect_dnc ?? true, dto.record_calls ?? true,
      ],
    );
    return { id: r?.insertId ?? r?.[0]?.insertId };
  }

  async setStatus(id: number, companyId: number, status: 'draft' | 'scheduled' | 'running' | 'paused' | 'completed' | 'cancelled'): Promise<void> {
    await this.ds.query(`UPDATE campaigns SET status = ? WHERE id = ? AND company_id = ?`, [status, id, companyId]);
  }

  async addContacts(campaignId: number, companyId: number, contacts: Array<{ phone: string; name?: string; customer_id?: number; custom_data?: Record<string, unknown> }>): Promise<{ added: number; skipped: number }> {
    let added = 0;
    let skipped = 0;
    for (const c of contacts) {
      const phone = c.phone.replace(/\s+/g, '');
      try {
        await this.ds.query(
          `INSERT INTO campaign_contacts (company_id, campaign_id, customer_id, phone, name, custom_data, status)
           VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
          [companyId, campaignId, c.customer_id ?? null, phone, c.name ?? null, c.custom_data ? JSON.stringify(c.custom_data) : null],
        );
        added++;
      } catch {
        skipped++;
      }
    }
    return { added, skipped };
  }

  // -------------------- engine (cron) --------------------

  /** Worker que avanza campañas en estado running (cada 10s). */
  @Cron(CronExpression.EVERY_10_SECONDS)
  async tick(): Promise<void> {
    const running = await this.ds.query(`SELECT * FROM campaigns WHERE status = 'running'`);
    for (const c of running) {
      try {
        await this.processCampaign(c);
      } catch (err: any) {
        this.logger.error(`Campaign ${c.id} tick error: ${err?.message}`);
      }
    }
  }

  private async processCampaign(camp: any): Promise<void> {
    // Cuántas llamadas activas tiene la campaña
    const active: any = await this.ds.query(
      `SELECT COUNT(*) AS n FROM calls WHERE campaign_id = ? AND ended_at IS NULL`,
      [camp.id],
    );
    const inFlight = Number(active[0].n) || 0;

    let agentsAvailable = 1;
    if (camp.dialer_mode === 'progressive' || camp.dialer_mode === 'predictive') {
      const a = await this.ds.query(
        `SELECT COUNT(DISTINCT a.id) AS n FROM agents a
           INNER JOIN queue_agents qa ON qa.agent_id = a.id
           LEFT JOIN agent_status_logs asl ON asl.agent_id = a.id AND asl.ended_at IS NULL
           WHERE qa.queue_id = ? AND a.is_active = TRUE AND (asl.status = 'available' OR asl.status IS NULL)`,
        [camp.queue_id],
      );
      agentsAvailable = Number(a[0].n) || 0;
    }

    const targetActive = camp.dialer_mode === 'predictive'
      ? Math.floor((agentsAvailable + 0.5) * Number(camp.pacing_ratio))
      : agentsAvailable;
    const slots = Math.max(0, Math.min(camp.max_concurrent_calls, targetActive) - inFlight);
    if (slots <= 0) return;

    const contacts = await this.ds.query(
      `SELECT id, phone, name, customer_id FROM campaign_contacts
         WHERE campaign_id = ?
           AND status IN ('pending')
           AND (next_retry_at IS NULL OR next_retry_at <= NOW())
         ORDER BY id ASC LIMIT ?`,
      [camp.id, slots],
    );
    if (!contacts.length) {
      // Si no quedan pendientes y no hay nada en vuelo, completar
      const remaining = await this.ds.query(`SELECT COUNT(*) AS n FROM campaign_contacts WHERE campaign_id = ? AND status IN ('pending','queued','dialing','answered')`, [camp.id]);
      if (Number(remaining[0].n) === 0) await this.setStatus(camp.id, camp.company_id, 'completed');
      return;
    }

    for (const c of contacts) {
      // DNC
      if (camp.respect_dnc) {
        const dnc = await this.ds.query(
          `SELECT 1 FROM dnc_entries WHERE company_id = ? AND phone = ? LIMIT 1`,
          [camp.company_id, c.phone],
        );
        if (dnc.length) {
          await this.ds.query(`UPDATE campaign_contacts SET status='dnc' WHERE id = ?`, [c.id]);
          continue;
        }
      }

      await this.ds.query(`UPDATE campaign_contacts SET status='queued', attempts = attempts + 1, last_attempt_at = NOW() WHERE id = ?`, [c.id]);

      const trunkRows = await this.ds.query(
        `SELECT id, dial_prefix_mobile, dial_prefix_landline, dial_prefix_intl
         FROM sip_trunks WHERE id = ? AND company_id = ? LIMIT 1`,
        [camp.trunk_id, camp.company_id],
      );
      const trunkRow = trunkRows[0];
      const trunkId = trunkRow?.id ?? camp.trunk_id;
      if (!trunkId) {
        await this.ds.query(`UPDATE campaign_contacts SET status='failed' WHERE id = ?`, [c.id]);
        continue;
      }
      const trunkName = `trunk_${camp.company_id}_${trunkId}`;

      // Originate (en modo predictive llama el bot/agente cuando contesta)
      try {
        const endpoint = camp.bot_id
          ? `Local/${c.phone}@outbound-bridge`
          : `Local/${c.phone}@outbound-bridge`;
        await this.asterisk.originate({
          endpoint,
          context: 'outbound-bridge',
          extension: c.phone,
          callerId: camp.caller_id ?? undefined,
          variables: {
            TRUNK_NAME: trunkName,
            'X-Campaign-Id': String(camp.id),
            'X-Contact-Id': String(c.id),
            CALLER_ID_NUM: camp.caller_id ?? '',
            TRUNK_PREFIX_MOBILE: trunkRow?.dial_prefix_mobile ?? '',
            TRUNK_PREFIX_LANDLINE: trunkRow?.dial_prefix_landline ?? '',
            TRUNK_PREFIX_INTL: trunkRow?.dial_prefix_intl ?? '',
            ...(camp.amd_enabled ? { 'X-AMD': '1' } : {}),
          },
          timeout: 45,
        });
      } catch (err: any) {
        this.logger.error(`Campaign originate failed: ${err?.message}`);
        const newStatus = await this.shouldRetry(c.id, camp.max_attempts_per_contact, camp.retry_interval_minutes);
        await this.ds.query(`UPDATE campaign_contacts SET status = ? WHERE id = ?`, [newStatus, c.id]);
      }
    }
  }

  private async shouldRetry(contactId: number, maxAttempts: number, retryMinutes: number): Promise<'pending' | 'failed'> {
    const r = await this.ds.query(`SELECT attempts FROM campaign_contacts WHERE id = ?`, [contactId]);
    if (!r[0]) return 'failed';
    if (Number(r[0].attempts) >= maxAttempts) return 'failed';
    await this.ds.query(`UPDATE campaign_contacts SET next_retry_at = DATE_ADD(NOW(), INTERVAL ? MINUTE) WHERE id = ?`, [retryMinutes, contactId]);
    return 'pending';
  }
}
