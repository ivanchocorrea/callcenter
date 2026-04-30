import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { EventBusService } from '../events/event-bus.service';
import { CallsService } from '../calls/calls.service';
import { AsteriskBridgeService } from '../asterisk/asterisk-bridge.service';

/**
 * InboundDispatcherService
 * ------------------------------------------------------------------
 * Suscriptor del canal `asterisk:event` que:
 *  1. Detecta `StasisStart` con args[0]='inbound'.
 *  2. Identifica la empresa por la troncal (variable __COMPANY_ID que pone el dialplan).
 *  3. Crea el registro `calls`.
 *  4. Lookup de cliente por número entrante.
 *  5. Decide destino: por ahora deriva a "agente más antiguo disponible"
 *     (placeholder) o emite evento `call.incoming` para que el frontend
 *     muestre el popup. El enrutamiento completo (queues/IVR/bots) llega
 *     en sus fases respectivas.
 *  6. Emite eventos a clientes vía EventBus (que el RealtimeGateway forwardea).
 */
@Injectable()
export class InboundDispatcherService implements OnModuleInit {
  private readonly logger = new Logger(InboundDispatcherService.name);

  constructor(
    private readonly bus: EventBusService,
    private readonly calls: CallsService,
    private readonly asterisk: AsteriskBridgeService,
    @InjectDataSource() private readonly ds: DataSource,
  ) {}

  onModuleInit(): void {
    this.bus.on('asterisk:event', (e: any) => this.handle(e));
  }

  private async handle(event: any): Promise<void> {
    if (!event || event.source !== 'ari') return;
    const { name, payload } = event;

    if (name === 'StasisStart') {
      await this.onStasisStart(payload);
    } else if (name === 'ChannelStateChange') {
      await this.onChannelStateChange(payload);
    } else if (name === 'StasisEnd' || name === 'ChannelHangupRequest' || name === 'ChannelDestroyed') {
      await this.onChannelEnd(payload);
    }
  }

  private async onStasisStart(payload: any): Promise<void> {
    const channel = payload?.channel;
    if (!channel) return;
    const args: string[] = payload?.event?.args ?? [];
    if (args[0] !== 'inbound') return;

    const exten = args[1] ?? channel.dialplan?.exten ?? null;
    const callerNum = channel.caller?.number ?? null;
    const callerName = channel.caller?.name ?? null;
    const channelVars = payload?.event?.channelvars ?? {};
    const companyId = parseInt(channelVars['X-Company-Id'] ?? channelVars['COMPANY_ID'] ?? '0', 10);
    const trunkId = parseInt(channelVars['X-Trunk-Id'] ?? '0', 10) || null;

    if (!companyId) {
      this.logger.warn(`Inbound sin company_id (channel ${channel.id}); colgando`);
      await this.asterisk.hangup(channel.id, 'normal').catch(() => undefined);
      return;
    }

    // Crear call
    const call = await this.calls.create({
      companyId,
      asteriskUniqueid: channel.id,
      asteriskLinkedid: channel.linkedid ?? channel.id,
      direction: 'inbound',
      fromNumber: callerNum,
      toNumber: exten,
      didNumber: exten,
      trunkId: trunkId ?? undefined,
    });

    // Lookup cliente por teléfono (E.164 normalization simplificada)
    const phone = (callerNum ?? '').replace(/\s+/g, '');
    const customers = phone
      ? await this.ds.query(
          `SELECT id, full_name, is_vip, important_notes
             FROM customers
             WHERE company_id = ? AND (primary_phone = ? OR id IN
               (SELECT customer_id FROM customer_phones WHERE company_id = ? AND phone = ?))
             LIMIT 1`,
          [companyId, phone, companyId, phone],
        )
      : [];
    const customer = customers[0];
    if (customer) {
      await this.calls.patch(Number(call.id), { customerId: Number(customer.id) });
    }

    await this.calls.addEvent(Number(call.id), 'incoming', 'system', null, { from: callerNum, to: exten });

    // Emitir evento popup
    await this.bus.publish(`co:${companyId}:call`, {
      type: 'call.incoming',
      call_id: Number(call.id),
      asterisk_uniqueid: channel.id,
      from_number: callerNum,
      from_name: callerName,
      to_number: exten,
      did_number: exten,
      trunk_id: trunkId,
      customer: customer ? {
        id: Number(customer.id),
        name: customer.full_name,
        is_vip: !!customer.is_vip,
        important_notes: customer.important_notes,
      } : null,
      occurred_at: new Date().toISOString(),
    });

    // Por ahora dejamos que la llamada espere en la app Stasis hasta que
    // un agente conteste vía SIP.js (Fase 6). En Fase 9/10 esto se enruta a
    // IVR/cola/bot según `did_numbers.inbound_destination_*`.
  }

  private async onChannelStateChange(payload: any): Promise<void> {
    const channel = payload?.channel;
    if (!channel) return;
    const call = await this.calls.findByUniqueid(channel.id);
    if (!call) return;
    if (channel.state === 'Ringing') {
      await this.calls.setStatus(Number(call.id), 'ringing');
      await this.bus.publish(`co:${call.companyId}:call`, { type: 'call.ringing', call_id: Number(call.id) });
    } else if (channel.state === 'Up') {
      await this.calls.setStatus(Number(call.id), 'answered');
      await this.bus.publish(`co:${call.companyId}:call`, { type: 'call.answered', call_id: Number(call.id) });
    }
  }

  private async onChannelEnd(payload: any): Promise<void> {
    const channel = payload?.channel;
    if (!channel) return;
    const call = await this.calls.findByUniqueid(channel.id);
    if (!call) return;
    if (call.endedAt) return;
    await this.calls.setStatus(Number(call.id), 'completed');
    await this.bus.publish(`co:${call.companyId}:call`, { type: 'call.ended', call_id: Number(call.id) });
  }
}
