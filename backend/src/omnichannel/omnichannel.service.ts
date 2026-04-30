import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

/**
 * Omnichannel base — Fase 25.
 *
 * Diseño: cada canal (whatsapp, telegram, web_chat, email, instagram, etc.)
 * implementa una `OmnichannelChannel` con send/receive. La conversación
 * se modela como una `ai_conversation` con `channel != 'voice'`, lo que reusa
 * todo el motor IA + tools + handoff a humano que ya existe.
 *
 * Esta versión solo expone CRUD de canales y un endpoint de webhook entrante
 * genérico. Las integraciones reales (WhatsApp Cloud API, Telegram Bot, etc.)
 * se conectan vía data_connectors o webhooks en fases futuras.
 */
@Injectable()
export class OmnichannelService {
  private readonly logger = new Logger(OmnichannelService.name);

  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  async listConversations(companyId: number, channel?: string): Promise<unknown[]> {
    if (channel) {
      return this.ds.query(
        `SELECT * FROM ai_conversations WHERE company_id = ? AND channel = ? ORDER BY started_at DESC LIMIT 200`,
        [companyId, channel],
      );
    }
    return this.ds.query(
      `SELECT * FROM ai_conversations WHERE company_id = ? AND channel != 'voice' ORDER BY started_at DESC LIMIT 200`,
      [companyId],
    );
  }

  async receiveInboundMessage(
    companyId: number,
    channel: 'web_chat' | 'whatsapp' | 'telegram' | 'email' | 'sms' | 'instagram',
    fromIdentifier: string,
    body: string,
    metadata?: Record<string, unknown>,
  ): Promise<{ conversation_id: number; message_id: number }> {
    // Buscar customer por identificador (teléfono/email) si aplica
    let customerId: number | null = null;
    if (channel === 'whatsapp' || channel === 'sms') {
      const r = await this.ds.query(
        `SELECT id FROM customers WHERE company_id = ? AND primary_phone = ? LIMIT 1`,
        [companyId, fromIdentifier.replace(/\s+/g, '')],
      );
      customerId = r[0]?.id ?? null;
    } else if (channel === 'email') {
      const r = await this.ds.query(`SELECT id FROM customers WHERE company_id = ? AND email = ? LIMIT 1`, [companyId, fromIdentifier]);
      customerId = r[0]?.id ?? null;
    }

    // Buscar conversación abierta del último día
    const ongoing = await this.ds.query(
      `SELECT id FROM ai_conversations
         WHERE company_id = ? AND channel = ?
           AND status = 'active'
           AND started_at > (NOW() - INTERVAL 24 HOUR)
           AND (customer_id <=> ?)
         ORDER BY id DESC LIMIT 1`,
      [companyId, channel, customerId],
    );
    let conversationId = ongoing[0]?.id;
    if (!conversationId) {
      const r: any = await this.ds.query(
        `INSERT INTO ai_conversations (company_id, bot_id, customer_id, channel, status)
           VALUES (?, NULL, ?, ?, 'active')`,
        [companyId, customerId, channel],
      );
      conversationId = r?.insertId ?? r?.[0]?.insertId;
    }

    const msg: any = await this.ds.query(
      `INSERT INTO ai_messages (company_id, conversation_id, role, content)
         VALUES (?, ?, 'user', ?)`,
      [companyId, conversationId, body],
    );
    const messageId = msg?.insertId ?? msg?.[0]?.insertId;

    return { conversation_id: Number(conversationId), message_id: Number(messageId) };
  }
}
