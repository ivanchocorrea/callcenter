import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AsteriskBridgeService } from '../asterisk/asterisk-bridge.service';
import { WebhookDispatcherService } from '../webhooks/webhook-dispatcher.service';

@Injectable()
export class CallbacksService {
  private readonly logger = new Logger(CallbacksService.name);

  constructor(
    @InjectDataSource() private readonly ds: DataSource,
    private readonly asterisk: AsteriskBridgeService,
    private readonly webhooks: WebhookDispatcherService,
  ) {}

  async create(
    companyId: number,
    phone: string,
    customerId?: number,
    queueId?: number,
    originalCallId?: number,
    customerName?: string,
    preferredAt?: Date,
    priority = 0,
  ): Promise<{ id: number }> {
    const r: any = await this.ds.query(
      `INSERT INTO callback_requests (company_id, customer_id, queue_id, original_call_id, phone, customer_name, requested_at, preferred_at, priority, status, attempts, max_attempts)
       VALUES (?, ?, ?, ?, ?, ?, NOW(), ?, ?, 'pending', 0, 3)`,
      [companyId, customerId ?? null, queueId ?? null, originalCallId ?? null, phone.replace(/\s+/g, ''), customerName ?? null, preferredAt ?? null, priority],
    );
    const id = r?.insertId ?? r?.[0]?.insertId;
    await this.webhooks.publish(companyId, 'callback.created', { callback_id: id, phone, customer_id: customerId });
    return { id };
  }

  async list(companyId: number, status?: string): Promise<unknown[]> {
    if (status) {
      return this.ds.query(
        `SELECT id, customer_id, customer_name, queue_id, phone, status, attempts, max_attempts, requested_at, preferred_at, last_attempt_at, completed_at
           FROM callback_requests WHERE company_id = ? AND status = ?
           ORDER BY priority DESC, requested_at ASC LIMIT 200`,
        [companyId, status],
      );
    }
    return this.ds.query(
      `SELECT id, customer_id, customer_name, queue_id, phone, status, attempts, max_attempts, requested_at, preferred_at, last_attempt_at, completed_at
         FROM callback_requests WHERE company_id = ?
         ORDER BY id DESC LIMIT 200`,
      [companyId],
    );
  }

  async cancel(id: number, companyId: number): Promise<void> {
    await this.ds.query(
      `UPDATE callback_requests SET status='cancelled', completed_at = NOW() WHERE id = ? AND company_id = ? AND status='pending'`,
      [id, companyId],
    );
  }

  /** Worker que procesa callbacks pendientes cada 30s. */
  @Cron(CronExpression.EVERY_30_SECONDS)
  async processPending(): Promise<void> {
    const pending = await this.ds.query(
      `SELECT cb.*, q.slug AS queue_slug
         FROM callback_requests cb
         LEFT JOIN queues q ON q.id = cb.queue_id
         WHERE cb.status = 'pending'
           AND (cb.preferred_at IS NULL OR cb.preferred_at <= NOW())
         ORDER BY cb.priority DESC, cb.requested_at ASC LIMIT 50`,
    );

    for (const cb of pending) {
      try {
        // Buscar agente disponible en la cola del callback
        const agentRows = cb.queue_id
          ? await this.ds.query(
              `SELECT a.id, a.extension FROM agents a
                 INNER JOIN queue_agents qa ON qa.agent_id = a.id
                 LEFT JOIN agent_status_logs asl ON asl.agent_id = a.id AND asl.ended_at IS NULL
                 WHERE qa.queue_id = ? AND a.is_active = TRUE
                   AND (asl.status = 'available' OR asl.status IS NULL)
                 LIMIT 1`,
              [cb.queue_id],
            )
          : [];
        const agent = agentRows[0];
        if (!agent) continue;

        // Buscar troncal outbound (incluye prefijos del proveedor)
        const trunkRows = await this.ds.query(
          `SELECT id, dial_prefix_mobile, dial_prefix_landline, dial_prefix_intl
           FROM sip_trunks WHERE company_id = ? AND status != 'error' AND direction IN ('outbound','both') ORDER BY priority ASC LIMIT 1`,
          [cb.company_id],
        );
        if (!trunkRows[0]) continue;
        const trunkRow = trunkRows[0];
        const trunkName = `trunk_${cb.company_id}_${trunkRow.id}`;

        await this.ds.query(
          `UPDATE callback_requests SET status='in_progress', attempts = attempts + 1, last_attempt_at = NOW() WHERE id = ?`,
          [cb.id],
        );

        await this.asterisk.originate({
          endpoint: `PJSIP/${agent.extension}`,
          context: 'outbound-bridge',
          extension: cb.phone,
          callerId: '',
          timeout: 45,
          variables: {
            TRUNK_NAME: trunkName,
            TRUNK_PREFIX_MOBILE: trunkRow.dial_prefix_mobile ?? '',
            TRUNK_PREFIX_LANDLINE: trunkRow.dial_prefix_landline ?? '',
            TRUNK_PREFIX_INTL: trunkRow.dial_prefix_intl ?? '',
            'X-Callback-Id': String(cb.id),
          },
        });
      } catch (err: any) {
        this.logger.error(`Callback ${cb.id} failed: ${err?.message ?? err}`);
        const newAttempts = (cb.attempts ?? 0) + 1;
        const nextStatus = newAttempts >= (cb.max_attempts ?? 3) ? 'failed' : 'pending';
        await this.ds.query(
          `UPDATE callback_requests SET status=?, attempts=?, last_attempt_at=NOW(), failure_reason=? WHERE id = ?`,
          [nextStatus, newAttempts, err?.message ?? String(err), cb.id],
        );
      }
    }
  }
}
