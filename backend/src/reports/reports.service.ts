import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

export interface ReportFilters {
  from?: string;       // ISO date
  to?: string;
  agentId?: number;
  queueId?: number;
  campaignId?: number;
}

@Injectable()
export class ReportsService {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  // ------------------------- helpers
  private dateFilter(table: string, f: ReportFilters): { sql: string; params: unknown[] } {
    const where: string[] = [];
    const params: unknown[] = [];
    if (f.from) { where.push(`${table}.started_at >= ?`); params.push(f.from); }
    if (f.to) { where.push(`${table}.started_at <= ?`); params.push(f.to); }
    return { sql: where.length ? ` AND ${where.join(' AND ')}` : '', params };
  }

  // ------------------------- queries

  async overview(companyId: number, f: ReportFilters): Promise<unknown> {
    const df = this.dateFilter('c', f);
    const r = await this.ds.query(
      `SELECT
         COUNT(*) AS total,
         SUM(CASE WHEN c.direction='inbound' THEN 1 ELSE 0 END) AS inbound,
         SUM(CASE WHEN c.direction='outbound' THEN 1 ELSE 0 END) AS outbound,
         SUM(CASE WHEN c.status='abandoned' THEN 1 ELSE 0 END) AS abandoned,
         SUM(CASE WHEN c.status IN ('no_answer','busy','failed') THEN 1 ELSE 0 END) AS missed,
         AVG(c.duration_seconds) AS avg_duration,
         AVG(c.queue_wait_seconds) AS avg_wait,
         AVG(c.talk_seconds) AS avg_talk
       FROM calls c
       WHERE c.company_id = ?${df.sql}`,
      [companyId, ...df.params],
    );
    return r[0];
  }

  async byAgent(companyId: number, f: ReportFilters): Promise<unknown[]> {
    const df = this.dateFilter('c', f);
    return this.ds.query(
      `SELECT a.id AS agent_id, a.display_name, a.extension,
              COUNT(c.id) AS calls,
              SUM(CASE WHEN c.status='completed' THEN 1 ELSE 0 END) AS completed,
              AVG(c.talk_seconds) AS avg_talk,
              SUM(c.talk_seconds) AS total_talk
         FROM agents a
         LEFT JOIN calls c ON c.agent_id = a.id ${df.sql}
         WHERE a.company_id = ?
         GROUP BY a.id ORDER BY calls DESC`,
      [...df.params, companyId],
    );
  }

  async byQueue(companyId: number, f: ReportFilters): Promise<unknown[]> {
    const df = this.dateFilter('c', f);
    return this.ds.query(
      `SELECT q.id AS queue_id, q.name,
              COUNT(c.id) AS calls,
              SUM(CASE WHEN c.status='abandoned' THEN 1 ELSE 0 END) AS abandoned,
              AVG(c.queue_wait_seconds) AS avg_wait,
              AVG(c.talk_seconds) AS avg_talk
         FROM queues q
         LEFT JOIN calls c ON c.queue_id = q.id ${df.sql}
         WHERE q.company_id = ?
         GROUP BY q.id ORDER BY calls DESC`,
      [...df.params, companyId],
    );
  }

  async hourlyDistribution(companyId: number, f: ReportFilters): Promise<unknown[]> {
    const df = this.dateFilter('c', f);
    return this.ds.query(
      `SELECT HOUR(c.started_at) AS hour, COUNT(*) AS total
         FROM calls c WHERE c.company_id = ?${df.sql}
         GROUP BY HOUR(c.started_at) ORDER BY hour`,
      [companyId, ...df.params],
    );
  }

  async exportCsv(companyId: number, f: ReportFilters): Promise<string> {
    const df = this.dateFilter('c', f);
    const rows = await this.ds.query(
      `SELECT c.id, c.direction, c.from_number, c.to_number, c.status,
              c.started_at, c.answered_at, c.ended_at,
              c.duration_seconds, c.queue_wait_seconds, c.talk_seconds,
              q.name AS queue, ag.display_name AS agent, cu.full_name AS customer
         FROM calls c
         LEFT JOIN queues q ON q.id = c.queue_id
         LEFT JOIN agents ag ON ag.id = c.agent_id
         LEFT JOIN customers cu ON cu.id = c.customer_id
         WHERE c.company_id = ?${df.sql}
         ORDER BY c.started_at DESC LIMIT 50000`,
      [companyId, ...df.params],
    );
    const headers = ['id','direction','from','to','status','started_at','answered_at','ended_at','duration_s','wait_s','talk_s','queue','agent','customer'];
    const csvRows = [headers.join(',')];
    for (const r of rows) {
      csvRows.push([
        r.id,
        r.direction,
        csvCell(r.from_number),
        csvCell(r.to_number),
        r.status,
        csvCell(r.started_at?.toISOString?.() ?? r.started_at),
        csvCell(r.answered_at?.toISOString?.() ?? r.answered_at),
        csvCell(r.ended_at?.toISOString?.() ?? r.ended_at),
        r.duration_seconds ?? '',
        r.queue_wait_seconds ?? '',
        r.talk_seconds ?? '',
        csvCell(r.queue),
        csvCell(r.agent),
        csvCell(r.customer),
      ].join(','));
    }
    return csvRows.join('\n');
  }
}

function csvCell(s: any): string {
  if (s == null) return '';
  const v = String(s);
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}
