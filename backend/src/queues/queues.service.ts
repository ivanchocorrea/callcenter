import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Queue } from './entities/queue.entity';
import { RedisService } from '../common/redis/redis.service';
import { EventBusService } from '../events/event-bus.service';
import { CallsService } from '../calls/calls.service';

export interface QueueEntry {
  callId: number;
  queueId: number;
  position: number;
  estimatedWaitSeconds?: number;
  enteredAt: Date;
}

export interface SupervisorSnapshot {
  queues: Array<{ id: number; name: string; slug: string; waiting: number; etaSec: number; sla: number }>;
  agents: Array<{ id: number; name: string; status: string; extension: string; queue?: string; sinceSec: number }>;
  liveCalls: Array<{ id: number; from: string | null; to: string | null; agent: string | null; queue: string | null; durationSec: number; direction: string }>;
  abandonedToday: number;
  answeredToday: number;
  avgWaitSec: number;
}

@Injectable()
export class QueuesService {
  private readonly logger = new Logger(QueuesService.name);

  constructor(
    @InjectRepository(Queue) private readonly repo: Repository<Queue>,
    @InjectDataSource() private readonly ds: DataSource,
    private readonly redis: RedisService,
    private readonly bus: EventBusService,
    private readonly calls: CallsService,
  ) {}

  // ------------------------ CRUD básico

  list(companyId: number): Promise<Queue[]> {
    return this.repo.find({ where: { companyId }, order: { priority: 'ASC' } });
  }

  async findById(id: number, companyId: number): Promise<Queue & { agents: any[] }> {
    const q = await this.repo.findOne({ where: { id, companyId } });
    if (!q) throw new NotFoundException();
    const agents = await this.ds.query(
      `SELECT qa.agent_id, qa.penalty, qa.is_paused, a.extension, a.display_name
         FROM queue_agents qa INNER JOIN agents a ON a.id = qa.agent_id
         WHERE qa.queue_id = ?`,
      [id],
    );
    return Object.assign(q, { agents });
  }

  async create(companyId: number, dto: Partial<Queue> & { slug: string; name: string }): Promise<Queue> {
    const exists = await this.repo.findOne({ where: { companyId, slug: dto.slug } });
    if (exists) throw new ConflictException();
    return this.repo.save(this.repo.create({ ...dto, companyId, isActive: true } as Queue));
  }

  async update(id: number, companyId: number, dto: Partial<Queue>): Promise<Queue> {
    const q = await this.repo.findOne({ where: { id, companyId } });
    if (!q) throw new NotFoundException();
    Object.assign(q, dto);
    return this.repo.save(q);
  }

  async addAgent(queueId: number, agentId: number, penalty = 0): Promise<void> {
    await this.ds.query(
      `INSERT IGNORE INTO queue_agents (queue_id, agent_id, penalty, is_paused) VALUES (?, ?, ?, FALSE)`,
      [queueId, agentId, penalty],
    );
  }

  async removeAgent(queueId: number, agentId: number): Promise<void> {
    await this.ds.query(`DELETE FROM queue_agents WHERE queue_id = ? AND agent_id = ?`, [queueId, agentId]);
  }

  // ------------------------ engine

  /** Encola una llamada en una cola. Crea queue_calls + Redis ZSET + posiciones. */
  async enqueueCall(companyId: number, queueId: number, callId: number, priority = 0): Promise<QueueEntry> {
    const queue = await this.repo.findOne({ where: { id: queueId, companyId } });
    if (!queue) throw new NotFoundException();

    // siguiente posición (count + 1)
    const cur = await this.ds.query(
      `SELECT COUNT(*) AS n FROM queue_calls WHERE queue_id = ? AND status = 'waiting'`,
      [queueId],
    );
    const position = (Number(cur[0].n) || 0) + 1;

    await this.ds.query(
      `INSERT INTO queue_calls (company_id, queue_id, call_id, position, priority, status, entered_at)
       VALUES (?, ?, ?, ?, ?, 'waiting', NOW())`,
      [companyId, queueId, callId, position, priority],
    );

    // Redis ZSET: score = priority*1e10 - timestamp (mayor prioridad primero)
    const score = -priority * 1e12 + Date.now();
    await this.redis.raw.zadd(`q:${companyId}:${queueId}:waiting`, score, String(callId));

    const eta = await this.estimateWaitSeconds(queueId);
    await this.calls.patch(callId, { queueId, status: 'in_queue' });
    await this.calls.addEvent(callId, 'queue.entered', 'system', null, { queueId, position });

    await this.bus.publish(`co:${companyId}:queue`, {
      type: 'queue.entered',
      queue_id: queueId,
      call_id: callId,
      position,
      eta_seconds: eta,
    });

    return { callId, queueId, position, estimatedWaitSeconds: eta, enteredAt: new Date() };
  }

  async recalculatePositions(queueId: number): Promise<void> {
    const ids: string[] = await this.redis.raw.zrange(`q:*:${queueId}:waiting`, 0, -1) as any;
    let pos = 1;
    for (const id of ids) {
      await this.ds.query(`UPDATE queue_calls SET position = ? WHERE call_id = ? AND status = 'waiting'`, [pos, id]);
      pos++;
    }
  }

  async estimateWaitSeconds(queueId: number): Promise<number> {
    const rows = await this.ds.query(
      `SELECT AVG(talk_seconds + COALESCE(wrap_up_seconds, 0)) AS avg_handling
         FROM calls
         WHERE queue_id = ? AND ended_at > (NOW() - INTERVAL 1 HOUR) AND talk_seconds IS NOT NULL`,
      [queueId],
    );
    const avg = Math.max(60, Math.round(Number(rows[0]?.avg_handling) || 120));
    const waiting = await this.ds.query(`SELECT COUNT(*) AS n FROM queue_calls WHERE queue_id=? AND status='waiting'`, [queueId]);
    const free = await this.ds.query(
      `SELECT COUNT(DISTINCT a.id) AS n
         FROM agents a INNER JOIN queue_agents qa ON qa.agent_id = a.id
         LEFT JOIN agent_status_logs asl ON asl.agent_id = a.id AND asl.ended_at IS NULL
         WHERE qa.queue_id = ? AND a.is_active = TRUE
           AND (asl.status IS NULL OR asl.status IN ('available','wrap_up'))`,
      [queueId],
    );
    const n = Math.max(1, Number(free[0]?.n) || 1);
    return Math.round((Number(waiting[0]?.n) || 0) * avg / n);
  }

  async abandon(callId: number, companyId: number, reason?: string): Promise<void> {
    const row = await this.ds.query(
      `SELECT queue_id, position FROM queue_calls WHERE call_id = ? AND status = 'waiting' LIMIT 1`,
      [callId],
    );
    if (!row[0]) return;
    const queueId = Number(row[0].queue_id);
    const position = Number(row[0].position);
    await this.ds.query(
      `UPDATE queue_calls SET status='abandoned', abandoned_at = NOW(), abandon_position = ? WHERE call_id = ?`,
      [position, callId],
    );
    await this.redis.raw.zrem(`q:${companyId}:${queueId}:waiting`, String(callId));
    await this.calls.setStatus(callId, 'abandoned');
    await this.bus.publish(`co:${companyId}:queue`, {
      type: 'queue.abandoned',
      queue_id: queueId,
      call_id: callId,
      position,
      reason: reason ?? null,
    });
    await this.bus.publish(`co:${companyId}:call`, { type: 'call.abandoned', call_id: callId });
    await this.recalculatePositions(queueId);
  }

  async answered(callId: number, companyId: number, agentId: number): Promise<void> {
    const row = await this.ds.query(`SELECT queue_id FROM queue_calls WHERE call_id = ? LIMIT 1`, [callId]);
    if (!row[0]) return;
    const queueId = Number(row[0].queue_id);
    await this.ds.query(
      `UPDATE queue_calls SET status='answered', answered_at = NOW() WHERE call_id = ?`,
      [callId],
    );
    await this.redis.raw.zrem(`q:${companyId}:${queueId}:waiting`, String(callId));
    await this.calls.patch(callId, { agentId, status: 'answered' });
    await this.bus.publish(`co:${companyId}:queue`, { type: 'queue.answered', queue_id: queueId, call_id: callId, agent_id: agentId });
    await this.recalculatePositions(queueId);
  }

  // ------------------------ supervisor live

  async snapshot(companyId: number): Promise<SupervisorSnapshot> {
    const queues = await this.ds.query(
      `SELECT q.id, q.name, q.slug,
              (SELECT COUNT(*) FROM queue_calls qc WHERE qc.queue_id = q.id AND qc.status='waiting') AS waiting
         FROM queues q WHERE q.company_id = ? AND q.is_active = TRUE`,
      [companyId],
    );
    const queuesWithEta: SupervisorSnapshot['queues'] = [];
    for (const q of queues) {
      const eta = await this.estimateWaitSeconds(Number(q.id));
      const sla = await this.computeServiceLevel(Number(q.id));
      queuesWithEta.push({ id: Number(q.id), name: q.name, slug: q.slug, waiting: Number(q.waiting) || 0, etaSec: eta, sla });
    }

    const agents = await this.ds.query(
      `SELECT a.id, a.display_name AS name, a.extension,
              (SELECT status FROM agent_status_logs asl WHERE asl.agent_id=a.id ORDER BY started_at DESC LIMIT 1) AS status,
              (SELECT TIMESTAMPDIFF(SECOND, started_at, NOW()) FROM agent_status_logs asl WHERE asl.agent_id=a.id ORDER BY started_at DESC LIMIT 1) AS since
         FROM agents a WHERE a.company_id = ? AND a.is_active = TRUE`,
      [companyId],
    );
    const live = await this.ds.query(
      `SELECT c.id, c.from_number AS \`from\`, c.to_number AS \`to\`,
              c.direction, TIMESTAMPDIFF(SECOND, c.started_at, NOW()) AS dur,
              ag.display_name AS agent, q.name AS queue
         FROM calls c
         LEFT JOIN agents ag ON ag.id = c.agent_id
         LEFT JOIN queues q ON q.id = c.queue_id
         WHERE c.company_id = ? AND c.ended_at IS NULL
         ORDER BY c.started_at DESC LIMIT 100`,
      [companyId],
    );
    const stats = await this.ds.query(
      `SELECT
          SUM(CASE WHEN status='abandoned' THEN 1 ELSE 0 END) AS aban,
          SUM(CASE WHEN status='completed' AND answered_at IS NOT NULL THEN 1 ELSE 0 END) AS ans,
          AVG(queue_wait_seconds) AS avg_wait
         FROM calls WHERE company_id = ? AND DATE(started_at) = CURDATE()`,
      [companyId],
    );

    return {
      queues: queuesWithEta,
      agents: agents.map((a: any) => ({
        id: Number(a.id),
        name: a.name,
        extension: a.extension,
        status: a.status ?? 'offline',
        sinceSec: Number(a.since) || 0,
      })),
      liveCalls: live.map((c: any) => ({
        id: Number(c.id),
        from: c.from,
        to: c.to,
        direction: c.direction,
        durationSec: Number(c.dur) || 0,
        agent: c.agent,
        queue: c.queue,
      })),
      abandonedToday: Number(stats[0]?.aban) || 0,
      answeredToday: Number(stats[0]?.ans) || 0,
      avgWaitSec: Math.round(Number(stats[0]?.avg_wait) || 0),
    };
  }

  private async computeServiceLevel(queueId: number, slaSeconds = 20): Promise<number> {
    const r = await this.ds.query(
      `SELECT
         SUM(CASE WHEN queue_wait_seconds <= ? THEN 1 ELSE 0 END) AS within,
         COUNT(*) AS total
         FROM calls
         WHERE queue_id = ? AND DATE(started_at) = CURDATE() AND queue_wait_seconds IS NOT NULL`,
      [slaSeconds, queueId],
    );
    const total = Number(r[0]?.total) || 0;
    if (total === 0) return 100;
    return Math.round((Number(r[0]?.within) || 0) / total * 100);
  }
}
