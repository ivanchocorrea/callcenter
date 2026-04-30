import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { EncryptionService } from '../common/encryption/encryption.service';
import { TwilioSmsProvider } from './providers/twilio.provider';
import { GenericHttpSmsProvider } from './providers/generic-http.provider';
import { SmsProvider } from './providers/sms-provider.interface';
import { WebhookDispatcherService } from '../webhooks/webhook-dispatcher.service';

interface SendOptions {
  templateSlug?: string;
  variables?: Record<string, string>;
  customerId?: number;
  callId?: number;
}

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);

  constructor(
    @InjectDataSource() private readonly ds: DataSource,
    private readonly encryption: EncryptionService,
    private readonly webhooks: WebhookDispatcherService,
  ) {}

  async send(companyId: number, to: string, body?: string, opts: SendOptions = {}): Promise<{ id: number; status: string; externalId?: string }> {
    let finalBody = body;
    let templateId: number | null = null;

    if (opts.templateSlug) {
      const t = await this.ds.query(
        `SELECT id, content FROM sms_templates WHERE company_id = ? AND slug = ? AND is_active = TRUE LIMIT 1`,
        [companyId, opts.templateSlug],
      );
      if (!t[0]) throw new NotFoundException(`Plantilla ${opts.templateSlug} no encontrada`);
      templateId = Number(t[0].id);
      finalBody = this.applyVariables(t[0].content, opts.variables ?? {});
    }
    if (!finalBody) throw new BadRequestException('body o templateSlug requeridos');

    const provider = await this.getProvider(companyId);

    const ins: any = await this.ds.query(
      `INSERT INTO sms_logs (company_id, provider_id, template_id, customer_id, call_id, direction, to_number, body, status, created_at)
       VALUES (?, NULL, ?, ?, ?, 'outbound', ?, ?, 'queued', NOW())`,
      [companyId, templateId, opts.customerId ?? null, opts.callId ?? null, to.replace(/\s+/g, ''), finalBody],
    );
    const smsId = ins?.insertId ?? ins?.[0]?.insertId;

    try {
      const r = await provider.send({ to: to.replace(/\s+/g, ''), body: finalBody });
      await this.ds.query(
        `UPDATE sms_logs SET status='sent', external_id=?, sent_at=NOW(), cost=? WHERE id = ?`,
        [r.externalId ?? null, r.cost ?? null, smsId],
      );
      await this.webhooks.publish(companyId, 'sms.sent', { sms_id: smsId, to, body: finalBody, external_id: r.externalId });
      return { id: smsId, status: 'sent', externalId: r.externalId };
    } catch (err: any) {
      await this.ds.query(
        `UPDATE sms_logs SET status='failed', error_message=? WHERE id = ?`,
        [err?.message ?? String(err), smsId],
      );
      await this.webhooks.publish(companyId, 'sms.failed', { sms_id: smsId, to, error: err?.message });
      throw err;
    }
  }

  /** Construye el provider activo para esta empresa. */
  private async getProvider(companyId: number): Promise<SmsProvider> {
    const rows = await this.ds.query(
      `SELECT * FROM sms_providers WHERE company_id = ? AND is_active = TRUE AND is_default = TRUE LIMIT 1`,
      [companyId],
    );
    const r = rows[0];
    if (!r) throw new NotFoundException('Sin proveedor SMS configurado');

    if (r.provider_type === 'twilio') {
      return new TwilioSmsProvider(
        this.encryption.decrypt(r.api_key_encrypted),
        this.encryption.decrypt(r.api_secret_encrypted),
        r.sender_id ?? undefined,
      );
    }
    if (r.provider_type === 'generic_http') {
      const cfg = typeof r.config === 'string' ? JSON.parse(r.config) : r.config;
      return new GenericHttpSmsProvider(cfg, r.sender_id ?? undefined);
    }
    throw new BadRequestException(`Provider ${r.provider_type} no soportado`);
  }

  private applyVariables(template: string, vars: Record<string, string>): string {
    return template.replace(/{{(\w+)}}/g, (_, k) => vars[k] ?? '');
  }

  async listLogs(companyId: number, limit = 100): Promise<unknown[]> {
    return this.ds.query(
      `SELECT id, direction, to_number, from_number, body, status, external_id, error_message, sent_at, created_at
         FROM sms_logs WHERE company_id = ? ORDER BY id DESC LIMIT ?`,
      [companyId, limit],
    );
  }
}
