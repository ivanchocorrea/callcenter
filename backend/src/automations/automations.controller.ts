import { BadRequestException, Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Patch, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { RequirePermissions } from '../common/decorators/permissions.decorator';

interface AutomationDto {
  slug: string;
  name: string;
  description?: string;
  trigger_event: string;
  is_active?: boolean;
  priority?: number;
  conditions: Array<{ field_path: string; operator: string; value: unknown }>;
  actions: Array<{ action_type: string; config: Record<string, unknown> }>;
}

@ApiTags('automations')
@ApiBearerAuth()
@Controller('automations')
export class AutomationsController {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  @Get()
  @RequirePermissions('ai.view')
  async list(@Req() req: any) {
    if (!req.scopedCompanyId) throw new BadRequestException();
    return this.ds.query(`SELECT * FROM automation_rules WHERE company_id = ? ORDER BY priority`, [req.scopedCompanyId]);
  }

  @Get(':id')
  @RequirePermissions('ai.view')
  async findOne(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    const r = await this.ds.query(`SELECT * FROM automation_rules WHERE id = ? AND company_id = ?`, [id, req.scopedCompanyId]);
    if (!r[0]) throw new BadRequestException();
    const conditions = await this.ds.query(`SELECT * FROM automation_conditions WHERE rule_id = ? ORDER BY sort_order`, [id]);
    const actions = await this.ds.query(`SELECT * FROM automation_actions WHERE rule_id = ? ORDER BY sort_order`, [id]);
    return { ...r[0], conditions, actions };
  }

  @Post()
  @RequirePermissions('ai.manage')
  async create(@Body() dto: AutomationDto, @Req() req: any) {
    const ins: any = await this.ds.query(
      `INSERT INTO automation_rules (company_id, slug, name, description, trigger_event, is_active, priority)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [req.scopedCompanyId, dto.slug, dto.name, dto.description ?? null, dto.trigger_event, dto.is_active ?? true, dto.priority ?? 100],
    );
    const id = ins?.insertId ?? ins?.[0]?.insertId;
    let i = 0;
    for (const c of dto.conditions ?? []) {
      await this.ds.query(`INSERT INTO automation_conditions (rule_id, field_path, operator, value, sort_order) VALUES (?, ?, ?, ?, ?)`,
        [id, c.field_path, c.operator, JSON.stringify(c.value), i++]);
    }
    i = 0;
    for (const a of dto.actions ?? []) {
      await this.ds.query(`INSERT INTO automation_actions (rule_id, action_type, config, sort_order) VALUES (?, ?, ?, ?)`,
        [id, a.action_type, JSON.stringify(a.config), i++]);
    }
    return { id };
  }

  @Patch(':id')
  @RequirePermissions('ai.manage')
  async update(@Param('id', ParseIntPipe) id: number, @Body() dto: Partial<AutomationDto>, @Req() req: any) {
    const sets: string[] = [];
    const params: any[] = [];
    if (dto.name !== undefined) { sets.push('name = ?'); params.push(dto.name); }
    if (dto.description !== undefined) { sets.push('description = ?'); params.push(dto.description); }
    if (dto.trigger_event !== undefined) { sets.push('trigger_event = ?'); params.push(dto.trigger_event); }
    if (dto.is_active !== undefined) { sets.push('is_active = ?'); params.push(dto.is_active); }
    if (dto.priority !== undefined) { sets.push('priority = ?'); params.push(dto.priority); }
    if (sets.length) {
      params.push(id, req.scopedCompanyId);
      await this.ds.query(`UPDATE automation_rules SET ${sets.join(', ')} WHERE id = ? AND company_id = ?`, params);
    }
    if (dto.conditions) {
      await this.ds.query(`DELETE FROM automation_conditions WHERE rule_id = ?`, [id]);
      let i = 0;
      for (const c of dto.conditions) {
        await this.ds.query(`INSERT INTO automation_conditions (rule_id, field_path, operator, value, sort_order) VALUES (?, ?, ?, ?, ?)`,
          [id, c.field_path, c.operator, JSON.stringify(c.value), i++]);
      }
    }
    if (dto.actions) {
      await this.ds.query(`DELETE FROM automation_actions WHERE rule_id = ?`, [id]);
      let i = 0;
      for (const a of dto.actions) {
        await this.ds.query(`INSERT INTO automation_actions (rule_id, action_type, config, sort_order) VALUES (?, ?, ?, ?)`,
          [id, a.action_type, JSON.stringify(a.config), i++]);
      }
    }
    return { ok: true };
  }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermissions('ai.manage')
  async remove(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    await this.ds.query(`DELETE FROM automation_rules WHERE id = ? AND company_id = ?`, [id, req.scopedCompanyId]);
  }
}
