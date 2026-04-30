import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

export interface AuditEntry {
  companyId?: number | null;
  userId?: number | null;
  actorEmail?: string | null;
  action: string;
  resourceType?: string | null;
  resourceId?: string | number | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
  metadata?: Record<string, unknown> | null;
}

@Injectable()
export class AuditService {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  async log(entry: AuditEntry): Promise<void> {
    await this.ds.query(
      `INSERT INTO audit_logs
       (company_id, user_id, actor_email, action, resource_type, resource_id, ip_address, user_agent, request_id, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        entry.companyId ?? null,
        entry.userId ?? null,
        entry.actorEmail ?? null,
        entry.action,
        entry.resourceType ?? null,
        entry.resourceId != null ? String(entry.resourceId) : null,
        entry.ipAddress ?? null,
        entry.userAgent ?? null,
        entry.requestId ?? null,
        entry.metadata ? JSON.stringify(entry.metadata) : null,
      ],
    );
  }
}
