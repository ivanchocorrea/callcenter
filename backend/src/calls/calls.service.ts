import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Call, CallStatus } from './entities/call.entity';

export interface CreateCallInput {
  companyId: number;
  asteriskUniqueid?: string;
  asteriskLinkedid?: string;
  direction: 'inbound' | 'outbound' | 'internal';
  fromNumber?: string;
  toNumber?: string;
  didNumber?: string;
  trunkId?: number;
  customerId?: number;
  queueId?: number;
  ivrMenuId?: number;
  botId?: number;
  campaignId?: number;
  agentId?: number;
  startedAt?: Date;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class CallsService {
  constructor(
    @InjectRepository(Call) private readonly repo: Repository<Call>,
    @InjectDataSource() private readonly ds: DataSource,
  ) {}

  async create(input: CreateCallInput): Promise<Call> {
    const c = this.repo.create({
      companyId: input.companyId,
      asteriskUniqueid: input.asteriskUniqueid ?? null,
      asteriskLinkedid: input.asteriskLinkedid ?? null,
      direction: input.direction,
      fromNumber: input.fromNumber ?? null,
      toNumber: input.toNumber ?? null,
      didNumber: input.didNumber ?? null,
      trunkId: input.trunkId ?? null,
      customerId: input.customerId ?? null,
      queueId: input.queueId ?? null,
      ivrMenuId: input.ivrMenuId ?? null,
      botId: input.botId ?? null,
      campaignId: input.campaignId ?? null,
      agentId: input.agentId ?? null,
      status: 'initiated',
      startedAt: input.startedAt ?? new Date(),
      metadata: input.metadata ?? null,
    });
    return this.repo.save(c);
  }

  async setStatus(callId: number, status: CallStatus, ts: Date = new Date()): Promise<void> {
    await this.repo.update({ id: callId }, { status });
    if (status === 'ringing') await this.repo.update({ id: callId }, { ringingAt: ts });
    if (status === 'answered') await this.repo.update({ id: callId }, { answeredAt: ts });
    if (status === 'completed' || status === 'abandoned' || status === 'failed' || status === 'no_answer' || status === 'busy') {
      await this.finalize(callId, ts);
    }
  }

  async finalize(callId: number, endedAt: Date = new Date()): Promise<void> {
    const c = await this.repo.findOne({ where: { id: callId } });
    if (!c) return;
    c.endedAt = endedAt;
    if (c.startedAt) c.durationSeconds = Math.round((endedAt.getTime() - c.startedAt.getTime()) / 1000);
    if (c.answeredAt) c.talkSeconds = Math.round((endedAt.getTime() - c.answeredAt.getTime()) / 1000);
    if (c.ringingAt && c.answeredAt) c.queueWaitSeconds = Math.round((c.answeredAt.getTime() - c.ringingAt.getTime()) / 1000);
    await this.repo.save(c);
  }

  async findById(id: number, companyId: number): Promise<Call> {
    const c = await this.repo.findOne({ where: { id, companyId } });
    if (!c) throw new NotFoundException('Llamada no encontrada');
    return c;
  }

  async findByUniqueid(uniqueid: string): Promise<Call | null> {
    return this.repo.findOne({ where: { asteriskUniqueid: uniqueid } });
  }

  async addEvent(callId: number, eventType: string, actorType?: string, actorId?: number | null, payload?: unknown): Promise<void> {
    const call = await this.repo.findOne({ where: { id: callId } });
    if (!call) return;
    await this.ds.query(
      `INSERT INTO call_events (company_id, call_id, event_type, actor_type, actor_id, payload, occurred_at)
       VALUES (?, ?, ?, ?, ?, ?, NOW())`,
      [call.companyId, callId, eventType, actorType ?? null, actorId ?? null, payload ? JSON.stringify(payload) : null],
    );
  }

  async listByCompany(companyId: number, limit = 100, offset = 0): Promise<Call[]> {
    return this.repo.find({
      where: { companyId },
      order: { startedAt: 'DESC' },
      take: limit,
      skip: offset,
    });
  }

  /** Asigna agente, customer, queue u otro campo a una llamada. */
  async patch(callId: number, partial: Partial<Call>): Promise<void> {
    await this.repo.update({ id: callId }, partial as any);
  }

  async listByAgent(agentId: number, companyId: number, limit = 50): Promise<Call[]> {
    return this.repo.find({
      where: { agentId, companyId },
      order: { startedAt: 'DESC' },
      take: limit,
    });
  }
}
