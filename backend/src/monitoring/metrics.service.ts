import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AsteriskBridgeService } from '../asterisk/asterisk-bridge.service';

/**
 * MetricsService — produce métricas en formato Prometheus exposition.
 * Sin dependencia externa (prom-client) para mantener simple. Si quieres
 * histogramas y labels más ricos, instala `prom-client` y reemplaza.
 */
@Injectable()
export class MetricsService {
  constructor(
    @InjectDataSource() private readonly ds: DataSource,
    private readonly asterisk: AsteriskBridgeService,
  ) {}

  async snapshot(): Promise<string> {
    const lines: string[] = [];

    // Llamadas activas globales
    const active: any = await this.ds.query(`SELECT COUNT(*) AS n FROM calls WHERE ended_at IS NULL`);
    lines.push(`# HELP callcenter_active_calls Number of in-progress calls`);
    lines.push(`# TYPE callcenter_active_calls gauge`);
    lines.push(`callcenter_active_calls ${Number(active[0]?.n) || 0}`);

    // Por dirección (gauge labelled)
    const byDir: any[] = await this.ds.query(`SELECT direction, COUNT(*) AS n FROM calls WHERE ended_at IS NULL GROUP BY direction`);
    lines.push(`# HELP callcenter_active_calls_direction Active calls by direction`);
    lines.push(`# TYPE callcenter_active_calls_direction gauge`);
    for (const d of byDir) lines.push(`callcenter_active_calls_direction{direction="${d.direction}"} ${Number(d.n)}`);

    // Llamadas hoy
    const today = await this.ds.query(`SELECT COUNT(*) AS n FROM calls WHERE DATE(started_at) = CURDATE()`);
    lines.push(`# HELP callcenter_calls_today Calls started today`);
    lines.push(`# TYPE callcenter_calls_today counter`);
    lines.push(`callcenter_calls_today ${Number(today[0]?.n) || 0}`);

    // Cola
    const queues: any[] = await this.ds.query(
      `SELECT q.id, q.slug, COUNT(qc.id) AS waiting
         FROM queues q LEFT JOIN queue_calls qc ON qc.queue_id = q.id AND qc.status='waiting'
         GROUP BY q.id, q.slug`,
    );
    lines.push(`# HELP callcenter_queue_waiting Calls waiting in each queue`);
    lines.push(`# TYPE callcenter_queue_waiting gauge`);
    for (const q of queues) lines.push(`callcenter_queue_waiting{queue="${q.slug}"} ${Number(q.waiting)}`);

    // Agentes online
    const agents = await this.ds.query(
      `SELECT COUNT(DISTINCT a.id) AS n FROM agents a
         LEFT JOIN agent_status_logs asl ON asl.agent_id = a.id AND asl.ended_at IS NULL
         WHERE a.is_active = TRUE AND (asl.status IS NULL OR asl.status NOT IN ('offline','logout'))`,
    );
    lines.push(`# HELP callcenter_agents_online Active agents`);
    lines.push(`# TYPE callcenter_agents_online gauge`);
    lines.push(`callcenter_agents_online ${Number(agents[0]?.n) || 0}`);

    // Asterisk
    const ast = this.asterisk.isConnected();
    lines.push(`# HELP callcenter_asterisk_connected 1 if connected, 0 otherwise`);
    lines.push(`# TYPE callcenter_asterisk_connected gauge`);
    lines.push(`callcenter_asterisk_connected{interface="ari"} ${ast.ari ? 1 : 0}`);
    lines.push(`callcenter_asterisk_connected{interface="ami"} ${ast.ami ? 1 : 0}`);

    // Webhook outbox
    const wh: any = await this.ds.query(`SELECT status, COUNT(*) AS n FROM event_outbox GROUP BY status`);
    lines.push(`# HELP callcenter_webhook_outbox Outbox events by status`);
    lines.push(`# TYPE callcenter_webhook_outbox gauge`);
    for (const r of wh) lines.push(`callcenter_webhook_outbox{status="${r.status}"} ${Number(r.n)}`);

    // Memory
    const mem = process.memoryUsage();
    lines.push(`# HELP nodejs_memory_bytes Process memory`);
    lines.push(`# TYPE nodejs_memory_bytes gauge`);
    lines.push(`nodejs_memory_bytes{type="rss"} ${mem.rss}`);
    lines.push(`nodejs_memory_bytes{type="heap_used"} ${mem.heapUsed}`);
    lines.push(`nodejs_memory_bytes{type="heap_total"} ${mem.heapTotal}`);

    // Uptime
    lines.push(`# HELP nodejs_process_uptime_seconds Process uptime`);
    lines.push(`# TYPE nodejs_process_uptime_seconds counter`);
    lines.push(`nodejs_process_uptime_seconds ${Math.round(process.uptime())}`);

    return lines.join('\n') + '\n';
  }
}
