import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { EventBusService } from '../events/event-bus.service';

export interface BusinessHoursDto {
  name: string;
  timezone?: string;
  schedule: Record<string, Array<{ from: string; to: string }>>;
  is_default?: boolean;
}

export interface HolidayDto {
  name: string;
  holiday_date: string;
  is_recurring?: boolean;
  country?: string;
}

@Injectable()
export class SchedulesService {
  constructor(
    @InjectDataSource() private readonly ds: DataSource,
    private readonly bus: EventBusService,
  ) {}

  /** Notifica al DialplanGenerator que algo cambio y debe regenerar. */
  private invalidateDialplan(): void {
    this.bus.publish('dialplan.invalidated', { source: 'schedules' }).catch(() => undefined);
  }

  // ---------- business_hours
  async listHours(companyId: number): Promise<unknown[]> {
    const rows = await this.ds.query(`SELECT * FROM business_hours WHERE company_id = ? ORDER BY name`, [companyId]);
    return rows.map((r: any) => ({
      ...r,
      schedule: typeof r.schedule === 'string' ? JSON.parse(r.schedule) : r.schedule,
    }));
  }

  async createHours(companyId: number, dto: BusinessHoursDto): Promise<{ id: number }> {
    if (dto.is_default) {
      await this.ds.query(`UPDATE business_hours SET is_default = FALSE WHERE company_id = ?`, [companyId]);
    }
    const r: any = await this.ds.query(
      `INSERT INTO business_hours (company_id, name, timezone, schedule, is_default)
       VALUES (?, ?, ?, ?, ?)`,
      [companyId, dto.name, dto.timezone ?? 'America/Bogota', JSON.stringify(dto.schedule), dto.is_default ?? false],
    );
    this.invalidateDialplan();
    return { id: r?.insertId ?? r?.[0]?.insertId };
  }

  async updateHours(id: number, companyId: number, dto: Partial<BusinessHoursDto>): Promise<void> {
    const sets: string[] = [];
    const params: unknown[] = [];
    if (dto.name !== undefined) { sets.push('name = ?'); params.push(dto.name); }
    if (dto.timezone !== undefined) { sets.push('timezone = ?'); params.push(dto.timezone); }
    if (dto.schedule !== undefined) { sets.push('schedule = ?'); params.push(JSON.stringify(dto.schedule)); }
    if (dto.is_default !== undefined) {
      if (dto.is_default) await this.ds.query(`UPDATE business_hours SET is_default = FALSE WHERE company_id = ?`, [companyId]);
      sets.push('is_default = ?'); params.push(dto.is_default);
    }
    if (!sets.length) return;
    params.push(id, companyId);
    await this.ds.query(`UPDATE business_hours SET ${sets.join(', ')} WHERE id = ? AND company_id = ?`, params);
    this.invalidateDialplan();
  }

  async removeHours(id: number, companyId: number): Promise<void> {
    await this.ds.query(`DELETE FROM business_hours WHERE id = ? AND company_id = ?`, [id, companyId]);
    this.invalidateDialplan();
  }

  // ---------- holidays
  async listHolidays(companyId: number): Promise<unknown[]> {
    return this.ds.query(`SELECT * FROM holidays WHERE company_id = ? ORDER BY holiday_date`, [companyId]);
  }

  async createHoliday(companyId: number, dto: HolidayDto): Promise<{ id: number }> {
    const r: any = await this.ds.query(
      `INSERT INTO holidays (company_id, name, holiday_date, is_recurring, country) VALUES (?, ?, ?, ?, ?)`,
      [companyId, dto.name, dto.holiday_date, dto.is_recurring ?? false, dto.country ?? null],
    );
    this.invalidateDialplan();
    return { id: r?.insertId ?? r?.[0]?.insertId };
  }

  async removeHoliday(id: number, companyId: number): Promise<void> {
    await this.ds.query(`DELETE FROM holidays WHERE id = ? AND company_id = ?`, [id, companyId]);
    this.invalidateDialplan();
  }
}
