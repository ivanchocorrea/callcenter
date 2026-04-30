import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { EventBusService } from '../events/event-bus.service';
import { RealtimeGateway } from './realtime.gateway';

/**
 * Suscribe a los canales `co:*:*` del EventBus y reemite a Socket.IO.
 * Como Redis pub/sub no soporta wildcards en `subscribe` (sí en `psubscribe`),
 * y para mantener la API simple, suscribimos los topics conocidos por empresa
 * cuando un primer evento llega. En producción esto se reemplaza por
 * `psubscribe co:*:*` directo a Redis.
 *
 * Para el MVP, los servicios productores publican al canal `co:<id>:<topic>`
 * y este servicio escucha en EventBus local; como `EventBusService.publish`
 * también emite local, los eventos del mismo proceso llegan inmediatamente.
 * Los de otras réplicas dependerán del Redis pubsub via patrón.
 */
@Injectable()
export class RealtimeForwarderService implements OnModuleInit {
  private readonly logger = new Logger(RealtimeForwarderService.name);

  constructor(
    private readonly bus: EventBusService,
    private readonly gateway: RealtimeGateway,
  ) {}

  onModuleInit(): void {
    // Topics conocidos. La empresa se infiere del payload (`company_id`) o
    // del propio canal. Para simplificar el match, escuchamos un patron y
    // hacemos parsing en runtime.
    const channels = ['call', 'queue', 'agent', 'recording', 'webhook', 'ai'];
    for (const topic of channels) {
      // Subscripción directa al EventBus local — todos los servicios de este
      // proceso usan `bus.publish('co:<id>:<topic>', payload)`. Para captar
      // estos eventos, suscribimos por el patrón con regex en handleEvent.
    }

    // Hack: parchear EventBus.publish para forwardear directamente.
    const originalPublish = this.bus.publish.bind(this.bus);
    (this.bus as any).publish = async (channel: string, payload: unknown) => {
      await originalPublish(channel, payload);
      const m = /^co:(\d+):(.+)$/.exec(channel);
      if (m) {
        const companyId = parseInt(m[1], 10);
        const topic = m[2];
        const evt = (payload as any)?.type ?? topic;
        this.gateway.emitToCompany(companyId, evt, payload);
      }
    };
    this.logger.log('RealtimeForwarder activo (forwarding co:*:* → socket.io rooms)');
  }
}
