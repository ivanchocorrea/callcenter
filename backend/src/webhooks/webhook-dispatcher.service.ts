import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EncryptionService } from '../common/encryption/encryption.service';
import { EventBusService } from '../events/event-bus.service';

const RETRY_BACKOFF = [0, 30, 300, 1800, 7200, 43200]; // segundos

@Injectable()
export class WebhookDispatcherService implements OnModuleInit {
  private readonly logger = new Logger(WebhookDispatcherService.name);

  constructor(
    @InjectDataSource() private readonly ds: DataSource,
    private readonly encryption: EncryptionService,
    private readonly bus: EventBusService,
  ) {}

  onModuleInit(): void {
    // Suscribe a TODOS los eventos `co:*` y los publica al outbox automáticamente.
    // Mejor: cada productor llama explícitamente a `publish()` para tener control.
  }

  /**
   * Publica un evento de negocio: lo escribe en `event_outbox` para que el
   * worker (cron) lo entregue a los endpoints suscritos.
   */
  async publish(companyId: number, eventType: string, payload: Record<string, unknown>, aggregate?: { type: string; id: string | number }): Promise<void> {
    await this.ds.query(
      `INSERT INTO event_outbox (company_id, event_type, aggregate_type, aggregate_id, payload, status, created_at, next_attempt_at)
       VALUES (?, ?, ?, ?, ?, 'pending', NOW(), NOW())`,
      [
        companyId,
        eventType,
        aggregate?.type ?? null,
        aggregate?.id != null ? String(aggregate.id) : null,
        JSON.stringify(payload),
      ],
    );
  }

  /** Worker cron que despacha los eventos pendientes a los endpoints suscritos. */
  @Cron(CronExpression.EVERY_10_SECONDS)
  async tick(): Promise<void> {
    const events = await this.ds.query(
      `SELECT id, company_id, event_type, payload, attempts
         FROM event_outbox
         WHERE status = 'pending' AND (next_attempt_at IS NULL OR next_attempt_at <= NOW())
         ORDER BY id ASC LIMIT 100`,
    );
    if (!events.length) return;

    for (const ev of events) {
      try {
        await this.processEvent(ev);
      } catch (err: any) {
        this.logger.error(`Outbox event ${ev.id} processing error: ${err?.message ?? err}`);
      }
    }
  }

  private async processEvent(ev: any): Promise<void> {
    // Marca processing
    await this.ds.query(`UPDATE event_outbox SET status='processing' WHERE id = ?`, [ev.id]);

    const payload: Record<string, unknown> = typeof ev.payload === 'string' ? JSON.parse(ev.payload) : ev.payload;

    // Buscar endpoints suscritos
    const endpoints = await this.ds.query(
      `SELECT id, url, secret_encrypted, events, headers, max_retries, timeout_ms
         FROM webhook_endpoints
         WHERE company_id = ? AND is_active = TRUE`,
      [ev.company_id],
    );
    const subscribers = endpoints.filter((e: any) => {
      const evs: string[] = typeof e.events === 'string' ? JSON.parse(e.events) : e.events;
      return evs.includes(ev.event_type) || evs.includes('*');
    });

    if (subscribers.length === 0) {
      await this.ds.query(`UPDATE event_outbox SET status='sent', processed_at=NOW() WHERE id=?`, [ev.id]);
      return;
    }

    let allOk = true;
    for (const ep of subscribers) {
      const result = await this.deliver(ev, ep, payload);
      if (!result) allOk = false;
    }

    if (allOk) {
      await this.ds.query(`UPDATE event_outbox SET status='sent', processed_at=NOW() WHERE id=?`, [ev.id]);
    } else {
      // Reintento con backoff
      const attempts = (ev.attempts ?? 0) + 1;
      const delay = RETRY_BACKOFF[Math.min(attempts, RETRY_BACKOFF.length - 1)];
      const status = attempts >= RETRY_BACKOFF.length ? 'failed' : 'pending';
      await this.ds.query(
        `UPDATE event_outbox SET status=?, attempts=?, next_attempt_at = DATE_ADD(NOW(), INTERVAL ? SECOND) WHERE id=?`,
        [status, attempts, delay, ev.id],
      );
    }
  }

  private async deliver(ev: any, ep: any, payload: Record<string, unknown>): Promise<boolean> {
    const secret = this.encryption.decrypt(ep.secret_encrypted);
    const ts = Math.floor(Date.now() / 1000);
    const body = JSON.stringify(payload);
    const sig = this.encryption.hmacSha256(`${ts}.${body}`, secret);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'CallCenter-NODOE/0.1',
      'X-Event': ev.event_type,
      'X-Event-Id': String(ev.id),
      'X-Company-Id': String(ev.company_id),
      'X-Timestamp': String(ts),
      'X-Signature': `hmac-sha256=${sig}`,
    };
    if (ep.headers) {
      const extra = typeof ep.headers === 'string' ? JSON.parse(ep.headers) : ep.headers;
      Object.assign(headers, extra);
    }

    let attempt = 0;
    const start = Date.now();
    let httpStatus: number | null = null;
    let responseBody = '';
    let errorMessage: string | null = null;

    try {
      const ctrl = new AbortController();
      const timeout = setTimeout(() => ctrl.abort(), ep.timeout_ms ?? 10000);
      const res = await fetch(ep.url, { method: 'POST', headers, body, signal: ctrl.signal });
      clearTimeout(timeout);
      httpStatus = res.status;
      responseBody = (await res.text()).slice(0, 65_536);
    } catch (err: any) {
      errorMessage = err?.message ?? String(err);
    }

    const ok = httpStatus != null && httpStatus >= 200 && httpStatus < 300;
    const duration = Date.now() - start;

    await this.ds.query(
      `INSERT INTO webhook_delivery_logs
        (company_id, endpoint_id, event_id, attempt, status, http_status, request_payload, response_body, error_message, sent_at, duration_ms)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?)`,
      [
        ev.company_id, ep.id, ev.id, attempt + 1,
        ok ? 'sent' : 'failed', httpStatus,
        body, responseBody, errorMessage,
        duration,
      ],
    );

    if (ok) {
      await this.ds.query(`UPDATE webhook_endpoints SET last_success_at = NOW(), consecutive_failures = 0 WHERE id = ?`, [ep.id]);
    } else {
      await this.ds.query(`UPDATE webhook_endpoints SET last_failure_at = NOW(), consecutive_failures = consecutive_failures + 1 WHERE id = ?`, [ep.id]);
    }
    return ok;
  }
}
