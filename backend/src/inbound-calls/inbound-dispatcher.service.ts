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
    if (!event) return;
    const { name, payload, source } = event;

    // ----- AMI: eventos del dialplan + bridge para tracking en vivo -----
    // Sirve para que /admin/live muestre datos REALES en tiempo real:
    // - UserEvent CallcenterInbound: crea fila calls
    // - UserEvent CallcenterInboundEnd: actualiza status final + duration
    // - BridgeEnter: cuando un endpoint de agente entra al bridge → asociar
    //   agent_id a la call + marcar agente como 'busy' (talking)
    // - Hangup del canal del agente: marcar agente de vuelta como 'available'
    if (source === 'ami') {
      const evtName = (payload?.userevent ?? payload?.UserEvent ?? '').toLowerCase();
      if (name === 'UserEvent' && evtName === 'callcenterinbound') {
        await this.onAmiInbound(payload);
        return;
      }
      if (name === 'UserEvent' && evtName === 'callcenterinboundend') {
        await this.onAmiInboundEnd(payload);
        return;
      }
      if (name === 'BridgeEnter') {
        await this.onAmiBridgeEnter(payload);
        return;
      }
      if (name === 'Hangup' || name === 'SoftHangupRequest') {
        await this.onAmiHangup(payload);
        return;
      }
      return;
    }

    // ----- ARI events (flow Stasis, no usado actualmente) -----
    if (source !== 'ari') return;

    if (name === 'StasisStart') {
      await this.onStasisStart(payload);
    } else if (name === 'ChannelStateChange') {
      await this.onChannelStateChange(payload);
    } else if (name === 'StasisEnd' || name === 'ChannelHangupRequest' || name === 'ChannelDestroyed') {
      await this.onChannelEnd(payload);
    }
  }

  /**
   * Handler de UserEvent CallcenterInbound (AMI). Crea la fila en `calls`
   * con direction=inbound apenas el dialplan recibe la llamada (antes del
   * Dial al agente). Idempotente por asterisk_uniqueid.
   */
  private async onAmiInbound(payload: any): Promise<void> {
    const channelId: string = payload?.channel ?? payload?.Channel ?? '';
    const did: string = payload?.did ?? payload?.DID ?? '';
    const fromNumber: string = payload?.from ?? payload?.From ?? '';
    const companyIdRaw = payload?.company ?? payload?.Company ?? '1';
    const companyId = parseInt(String(companyIdRaw), 10) || 1;
    if (!channelId) return;

    // Idempotente: si ya existe (por uniqueid), no duplicar
    const existing = await this.calls.findByUniqueid(channelId);
    if (existing) return;

    try {
      const call = await this.calls.create({
        companyId,
        asteriskUniqueid: channelId,
        asteriskLinkedid: channelId,
        direction: 'inbound',
        fromNumber: fromNumber || null as any,
        toNumber: did,
        didNumber: did,
      });

      // Lookup customer por telefono
      const phone = (fromNumber ?? '').replace(/\s+/g, '');
      if (phone) {
        const customers = await this.ds.query(
          `SELECT id FROM customers WHERE company_id = ? AND primary_phone = ? LIMIT 1`,
          [companyId, phone],
        );
        if (customers[0]) {
          await this.calls.patch(Number(call.id), { customerId: Number(customers[0].id) });
        }
      }

      this.logger.log(`Inbound registrada en BD: call_id=${call.id} from=${fromNumber} did=${did}`);

      await this.bus.publish(`co:${companyId}:call`, {
        type: 'call.incoming',
        call_id: Number(call.id),
        from_number: fromNumber,
        to_number: did,
        did_number: did,
        occurred_at: new Date().toISOString(),
      });
    } catch (e: any) {
      this.logger.warn(`No se pudo registrar inbound channel=${channelId}: ${e?.message}`);
    }
  }

  /**
   * Handler de UserEvent CallcenterInboundEnd (AMI). Actualiza status y
   * duration de la entrante segun el DIALSTATUS de Asterisk:
   * - ANSWER → completed (con duration)
   * - NOANSWER, BUSY, CANCEL → missed
   * - CONGESTION, CHANUNAVAIL → failed
   */
  private async onAmiInboundEnd(payload: any): Promise<void> {
    const channelId: string = payload?.channel ?? payload?.Channel ?? '';
    const dialStatus: string = (payload?.dialstatus ?? payload?.DialStatus ?? '').toUpperCase();
    const durationRaw = payload?.duration ?? payload?.Duration ?? '0';
    const duration = parseInt(String(durationRaw), 10) || 0;
    if (!channelId) return;

    const call = await this.calls.findByUniqueid(channelId);
    if (!call) return;

    let status: any = 'completed';
    if (dialStatus === 'ANSWER') status = 'completed';
    else if (['NOANSWER', 'CANCEL', 'BUSY'].includes(dialStatus)) status = 'no_answer';
    else if (['CONGESTION', 'CHANUNAVAIL'].includes(dialStatus)) status = 'failed';

    try {
      await this.calls.setStatus(Number(call.id), status);
      // Actualizar talk_seconds y duration_seconds
      if (duration > 0) {
        await this.calls.patch(Number(call.id), {
          talkSeconds: duration,
          durationSeconds: duration,
        });
      }
      this.logger.log(`Inbound finalizada: call_id=${call.id} status=${status} dur=${duration}s (DIALSTATUS=${dialStatus})`);
    } catch (e: any) {
      this.logger.warn(`Error actualizando inbound end channel=${channelId}: ${e?.message}`);
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

  // ----- AMI: tracking en vivo de llamadas activas + estado de agentes -----

  /**
   * BridgeEnter — un canal entró al bridge de la llamada. Si el canal es
   * de un agente (formato Channel: PJSIP/<ext>-<id>), asocia agent_id a
   * la call y marca al agente como 'busy' (en llamada).
   *
   * Esto da datos REALES en /admin/live para "quien está hablando con quien".
   */
  private async onAmiBridgeEnter(payload: any): Promise<void> {
    const channelName: string = payload?.channel ?? payload?.Channel ?? '';
    const linkedid: string = payload?.linkedid ?? payload?.Linkedid ?? '';
    if (!channelName || !linkedid) return;

    // Match PJSIP/<ext>-<chan_id> donde <ext> es la extension del agente
    const match = /^PJSIP\/(\d+)-/.exec(channelName);
    if (!match) return;
    const ext = match[1];

    try {
      const agentRow = await this.ds.query(
        `SELECT id, company_id, current_status FROM agents WHERE extension = ? LIMIT 1`,
        [ext],
      );
      if (!agentRow.length) return;
      const agentId = Number(agentRow[0].id);
      const companyId = Number(agentRow[0].company_id);

      // Buscar la call por linkedid (es el uniqueid del canal entrante)
      const call = await this.calls.findByUniqueid(linkedid);
      if (call && !call.agentId) {
        await this.calls.patch(Number(call.id), { agentId });
        // Marcar la call como 'answered' (ahora sí esta sonando o conectada)
        await this.calls.setStatus(Number(call.id), 'answered');
        this.logger.log(`Bridge: call_id=${call.id} asociado a agent_id=${agentId} (ext ${ext})`);
        await this.bus.publish(`co:${companyId}:call`, { type: 'call.answered', call_id: Number(call.id), agent_id: agentId });
      }

      // Marcar al agente como 'busy' (talking) si no estaba
      if (agentRow[0].current_status !== 'busy') {
        await this.ds.query(
          `UPDATE agents SET current_status = 'busy', current_status_changed_at = NOW() WHERE id = ?`,
          [agentId],
        );
        await this.bus.publish(`co:${companyId}:agent`, { type: 'agent.status_changed', agent_id: agentId, status: 'busy' });
      }
    } catch (e: any) {
      this.logger.warn(`BridgeEnter fallo (channel=${channelName}): ${e?.message}`);
    }
  }

  /**
   * Hangup — cualquier canal terminó. Si es de un agente y este no tiene
   * más llamadas activas, marcarlo de vuelta como 'available'.
   */
  private async onAmiHangup(payload: any): Promise<void> {
    const channelName: string = payload?.channel ?? payload?.Channel ?? '';
    if (!channelName) return;

    const match = /^PJSIP\/(\d+)-/.exec(channelName);
    if (!match) return;
    const ext = match[1];

    try {
      const agentRow = await this.ds.query(
        `SELECT id, company_id, current_status FROM agents WHERE extension = ? LIMIT 1`,
        [ext],
      );
      if (!agentRow.length) return;
      const agentId = Number(agentRow[0].id);
      const companyId = Number(agentRow[0].company_id);

      // Solo cambiar a available si estaba busy (no tocar paused/lunch/etc)
      if (agentRow[0].current_status === 'busy') {
        // Verificar que no tiene otra call activa
        const activeCount = await this.ds.query(
          `SELECT COUNT(*) AS n FROM calls WHERE agent_id = ? AND status IN ('ringing','answered','initiated') AND ended_at IS NULL`,
          [agentId],
        );
        const hasOther = Number(activeCount[0]?.n ?? 0) > 0;
        if (!hasOther) {
          await this.ds.query(
            `UPDATE agents SET current_status = 'available', current_status_changed_at = NOW() WHERE id = ?`,
            [agentId],
          );
          await this.bus.publish(`co:${companyId}:agent`, { type: 'agent.status_changed', agent_id: agentId, status: 'available' });
        }
      }
    } catch (e: any) {
      this.logger.warn(`Hangup fallo (channel=${channelName}): ${e?.message}`);
    }
  }
}
