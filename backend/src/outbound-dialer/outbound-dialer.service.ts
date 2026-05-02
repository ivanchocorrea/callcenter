import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Agent } from '../agents/entities/agent.entity';
import { CallsService } from '../calls/calls.service';
import { AsteriskBridgeService } from '../asterisk/asterisk-bridge.service';
import { EventBusService } from '../events/event-bus.service';
import { DialDto } from './dto/dial.dto';

interface DialActor {
  userId: number;
  email: string;
  companyId: number;
}

interface DialResult {
  call_id: number;
  channel_id: string;
  trunk_id: number;
  to: string;
}

@Injectable()
export class OutboundDialerService {
  private readonly logger = new Logger(OutboundDialerService.name);

  constructor(
    @InjectRepository(Agent) private readonly agents: Repository<Agent>,
    @InjectDataSource() private readonly ds: DataSource,
    private readonly calls: CallsService,
    private readonly asterisk: AsteriskBridgeService,
    private readonly bus: EventBusService,
  ) {}

  /**
   * Originar una llamada saliente desde el agente (extension SIP) hacia un número.
   * Comportamiento estándar:
   *   1. Validar que el agente exista y esté activo.
   *   2. Validar DNC.
   *   3. Seleccionar trunk (preferido el dado, sino el de mayor prioridad activo).
   *   4. Crear `calls` row.
   *   5. ARI originate: marca al endpoint del agente; cuando contesta, lo
   *      conecta vía dialplan `outbound` con el trunk al destino.
   */
  async dial(actor: DialActor, dto: DialDto): Promise<DialResult> {
    const agent = await this.agents.findOne({ where: { userId: actor.userId, companyId: actor.companyId } });
    if (!agent) throw new NotFoundException('No tienes un agente asociado');
    if (!agent.isActive) throw new ForbiddenException('Agente desactivado');

    const phoneNorm = dto.number.replace(/\s+/g, '');

    // DNC
    const dncRows = await this.ds.query(
      `SELECT 1 FROM dnc_entries WHERE company_id = ? AND phone = ? AND (expires_at IS NULL OR expires_at > NOW()) LIMIT 1`,
      [actor.companyId, phoneNorm],
    );
    if (dncRows.length > 0) {
      throw new ForbiddenException('Este número está en lista DNC');
    }

    // Trunk (incluye prefijos de marcación específicos del proveedor)
    const trunkRows: any[] = dto.trunk_id
      ? await this.ds.query(
          `SELECT id, name, dial_prefix_mobile, dial_prefix_landline, dial_prefix_intl
           FROM sip_trunks WHERE id = ? AND company_id = ? AND status != 'error' AND direction IN ('outbound','both') LIMIT 1`,
          [dto.trunk_id, actor.companyId],
        )
      : await this.ds.query(
          `SELECT id, name, dial_prefix_mobile, dial_prefix_landline, dial_prefix_intl
           FROM sip_trunks WHERE company_id = ? AND status != 'error' AND direction IN ('outbound','both') ORDER BY priority ASC LIMIT 1`,
          [actor.companyId],
        );
    if (trunkRows.length === 0) throw new BadRequestException('Sin troncal disponible para outbound');
    const trunk = trunkRows[0];
    const trunkName = `trunk_${actor.companyId}_${trunk.id}`;

    // Customer (lookup opcional si vino customer_id, sino por número)
    let customerId = dto.customer_id ?? null;
    if (!customerId) {
      const c = await this.ds.query(
        `SELECT id FROM customers WHERE company_id = ? AND primary_phone = ? LIMIT 1`,
        [actor.companyId, phoneNorm],
      );
      if (c[0]) customerId = c[0].id;
    }

    // Crear call
    const call = await this.calls.create({
      companyId: actor.companyId,
      direction: 'outbound',
      fromNumber: dto.caller_id ?? undefined,
      toNumber: phoneNorm,
      trunkId: Number(trunk.id),
      customerId: customerId ?? undefined,
      campaignId: dto.campaign_id ?? undefined,
      agentId: Number(agent.id),
    });

    // Originate
    let channelId = '';
    try {
      const result = await this.asterisk.originate({
        endpoint: `PJSIP/${agent.extension}`,
        context: 'outbound-bridge',
        extension: phoneNorm,
        priority: 1,
        callerId: dto.caller_id ?? trunk.name,
        timeout: 45,
        variables: {
          TRUNK_NAME: trunkName,
          CALLER_ID_NUM: dto.caller_id ?? '',
          // Prefijos por troncal (el dialplan los usa si no son vacíos,
          // si son vacíos cae a los OUTBOUND_PREFIX_* globales).
          TRUNK_PREFIX_MOBILE: trunk.dial_prefix_mobile ?? '',
          TRUNK_PREFIX_LANDLINE: trunk.dial_prefix_landline ?? '',
          TRUNK_PREFIX_INTL: trunk.dial_prefix_intl ?? '',
          'X-Call-Id': String(call.id),
          'X-Company-Id': String(actor.companyId),
        },
      });
      channelId = result.channelId;
      await this.calls.patch(Number(call.id), { asteriskUniqueid: channelId });
    } catch (err: any) {
      this.logger.error(`Originate falló: ${err?.message ?? err}`);
      await this.calls.setStatus(Number(call.id), 'failed');
      throw new BadRequestException(`No se pudo iniciar la llamada: ${err?.message ?? err}`);
    }

    await this.bus.publish(`co:${actor.companyId}:call`, {
      type: 'call.outbound.initiated',
      call_id: Number(call.id),
      to: phoneNorm,
      agent_id: Number(agent.id),
      channel_id: channelId,
    });
    await this.calls.addEvent(Number(call.id), 'outbound.initiated', 'agent', actor.userId, { to: phoneNorm });

    return {
      call_id: Number(call.id),
      channel_id: channelId,
      trunk_id: Number(trunk.id),
      to: phoneNorm,
    };
  }

  async hangupByCall(callId: number, companyId: number): Promise<void> {
    const call = await this.calls.findById(callId, companyId);
    if (!call.asteriskUniqueid) throw new BadRequestException('Llamada sin canal Asterisk');
    await this.asterisk.hangup(call.asteriskUniqueid).catch(() => undefined);
    await this.calls.setStatus(callId, 'completed');
  }

  async recentForAgent(actor: DialActor, limit = 30): Promise<unknown[]> {
    const agent = await this.agents.findOne({ where: { userId: actor.userId, companyId: actor.companyId } });
    if (!agent) return [];
    return this.calls.listByAgent(Number(agent.id), actor.companyId, limit);
  }
}
