import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter } from 'events';
import { RedisService } from '../common/redis/redis.service';

/**
 * EventBus interno. Combina EventEmitter local (mismo proceso) con Redis
 * pub/sub (distribuido entre réplicas del backend) para que cualquier
 * suscriptor reciba un evento sin importar dónde se publicó.
 *
 * Convención de canales:
 *   - co:{company_id}:call:incoming
 *   - co:{company_id}:call:ended
 *   - co:{company_id}:agent:status
 *   - co:{company_id}:queue:position
 *   - asterisk:event   (eventos crudos del bridge)
 */
@Injectable()
export class EventBusService {
  private readonly logger = new Logger(EventBusService.name);
  private readonly local = new EventEmitter();
  private readonly subscribed = new Set<string>();

  constructor(private readonly redis: RedisService) {
    this.local.setMaxListeners(0);
  }

  async publish(channel: string, payload: unknown): Promise<void> {
    // Local
    this.local.emit(channel, payload);
    // Distribuido
    try {
      await this.redis.publish(channel, payload);
    } catch (e: any) {
      this.logger.warn(`Redis publish falló (${channel}): ${e?.message}`);
    }
  }

  on(channel: string, handler: (payload: any) => void): () => void {
    this.local.on(channel, handler);
    if (!this.subscribed.has(channel)) {
      this.subscribed.add(channel);
      this.redis.subscribe(channel, payload => this.local.emit(channel, payload)).catch(e => {
        this.logger.warn(`Redis subscribe falló (${channel}): ${e?.message}`);
      });
    }
    return () => this.local.off(channel, handler);
  }
}
