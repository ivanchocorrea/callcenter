import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import * as crypto from 'crypto';
import { EncryptionService } from '../common/encryption/encryption.service';
import { EventBusService } from '../events/event-bus.service';

export interface CreateWhatsappAccountDto {
  slug: string;
  display_name: string;
  phone_number: string;
  phone_number_id: string;
  business_account_id?: string;
  access_token: string;
  verify_token: string;
  webhook_secret?: string;
}

@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);

  constructor(
    @InjectDataSource() private readonly ds: DataSource,
    private readonly encryption: EncryptionService,
    private readonly bus: EventBusService,
  ) {}

  async listAccounts(companyId: number): Promise<unknown[]> {
    const rows = await this.ds.query(
      `SELECT id, slug, display_name, phone_number, phone_number_id, business_account_id, is_active, created_at
         FROM whatsapp_accounts WHERE company_id = ? ORDER BY display_name`,
      [companyId],
    );
    return rows.map((r: any) => ({ ...r, has_token: true }));
  }

  async findByPhoneId(phoneNumberId: string): Promise<{ id: number; company_id: number; verify_token: string; webhook_secret: string | null; access_token: string } | null> {
    const r = await this.ds.query(
      `SELECT id, company_id, access_token_encrypted, verify_token, webhook_secret
         FROM whatsapp_accounts WHERE phone_number_id = ? AND is_active = TRUE LIMIT 1`,
      [phoneNumberId],
    );
    if (!r[0]) return null;
    return {
      id: r[0].id,
      company_id: r[0].company_id,
      verify_token: r[0].verify_token,
      webhook_secret: r[0].webhook_secret,
      access_token: this.encryption.decrypt(r[0].access_token_encrypted),
    };
  }

  async createAccount(companyId: number, dto: CreateWhatsappAccountDto): Promise<{ id: number; webhook_url: string }> {
    const dup = await this.ds.query(
      `SELECT id FROM whatsapp_accounts WHERE phone_number_id = ?`,
      [dto.phone_number_id],
    );
    if (dup[0]) throw new ConflictException('Ya existe una cuenta con ese phone_number_id');

    const r: any = await this.ds.query(
      `INSERT INTO whatsapp_accounts
         (company_id, slug, display_name, phone_number, phone_number_id, business_account_id,
          access_token_encrypted, verify_token, webhook_secret, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, TRUE)`,
      [
        companyId, dto.slug, dto.display_name, dto.phone_number, dto.phone_number_id,
        dto.business_account_id ?? null,
        this.encryption.encrypt(dto.access_token),
        dto.verify_token,
        dto.webhook_secret ?? null,
      ],
    );
    const id = r?.insertId ?? r?.[0]?.insertId;
    return {
      id,
      webhook_url: `/api/webhooks/whatsapp/${dto.phone_number_id}`,
    };
  }

  async removeAccount(id: number, companyId: number): Promise<void> {
    await this.ds.query(`DELETE FROM whatsapp_accounts WHERE id = ? AND company_id = ?`, [id, companyId]);
  }

  /** Verificar firma HMAC SHA256 del header X-Hub-Signature-256 */
  verifySignature(body: string, signatureHeader: string | undefined, secret: string): boolean {
    if (!signatureHeader || !secret) return true; // si no hay secret configurado, no validar
    const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(body).digest('hex');
    try {
      return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signatureHeader));
    } catch {
      return false;
    }
  }

  /** Procesar payload entrante de Meta WhatsApp Cloud API */
  async processIncoming(accountId: number, companyId: number, payload: any): Promise<void> {
    try {
      const entries = payload.entry ?? [];
      for (const entry of entries) {
        const changes = entry.changes ?? [];
        for (const change of changes) {
          const value = change.value ?? {};
          const messages = value.messages ?? [];
          const metadata = value.metadata ?? {};
          for (const msg of messages) {
            const messageType = msg.type ?? 'unknown';
            const body = msg.text?.body ?? msg.button?.text ?? msg.interactive?.button_reply?.title ?? null;
            try {
              await this.ds.query(
                `INSERT IGNORE INTO whatsapp_messages
                   (company_id, account_id, direction, message_id, from_number, to_number,
                    message_type, body, raw_payload, received_at)
                 VALUES (?, ?, 'inbound', ?, ?, ?, ?, ?, ?, FROM_UNIXTIME(?))`,
                [
                  companyId, accountId, msg.id,
                  msg.from, metadata.display_phone_number ?? '',
                  messageType, body,
                  JSON.stringify(msg),
                  msg.timestamp ?? Math.floor(Date.now() / 1000),
                ],
              );
              // Emitir evento al bus
              await this.bus.publish(`co:${companyId}:whatsapp.received`, {
                companyId,
                accountId,
                from: msg.from,
                type: messageType,
                body,
                messageId: msg.id,
              });
            } catch (e) {
              this.logger.error(`Error guardando mensaje ${msg.id}`, e);
            }
          }
        }
      }
    } catch (e) {
      this.logger.error('Error procesando webhook WhatsApp', e);
    }
  }

  async listMessages(companyId: number, limit = 100): Promise<unknown[]> {
    return this.ds.query(
      `SELECT id, account_id, direction, message_id, from_number, to_number, message_type, body, received_at, created_at
         FROM whatsapp_messages
         WHERE company_id = ?
         ORDER BY created_at DESC
         LIMIT ?`,
      [companyId, limit],
    );
  }

  /** Enviar mensaje saliente vía Meta Cloud API */
  async sendMessage(companyId: number, accountId: number, to: string, text: string): Promise<{ messageId: string }> {
    const acc = await this.ds.query(
      `SELECT id, access_token_encrypted, phone_number_id FROM whatsapp_accounts WHERE id = ? AND company_id = ?`,
      [accountId, companyId],
    );
    if (!acc[0]) throw new NotFoundException('Cuenta WhatsApp no encontrada');
    const token = this.encryption.decrypt(acc[0].access_token_encrypted);

    const url = `https://graph.facebook.com/v18.0/${acc[0].phone_number_id}/messages`;
    const body = {
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body: text, preview_url: false },
    };
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const errorBody = await res.text();
      throw new Error(`Meta API error ${res.status}: ${errorBody}`);
    }
    const data: any = await res.json();
    const messageId = data.messages?.[0]?.id ?? '';
    // Guardar el mensaje saliente
    await this.ds.query(
      `INSERT INTO whatsapp_messages
         (company_id, account_id, direction, message_id, from_number, to_number, message_type, body)
       VALUES (?, ?, 'outbound', ?, '', ?, 'text', ?)`,
      [companyId, accountId, messageId, to, text],
    );
    return { messageId };
  }
}
