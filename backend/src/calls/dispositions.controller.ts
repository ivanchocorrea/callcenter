import { BadRequestException, Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { RequirePermissions } from '../common/decorators/permissions.decorator';

interface DispositionDto {
  slug: string;
  label: string;
  parent_id?: number | null;
  is_positive?: boolean;
  is_callback?: boolean;
  is_terminal?: boolean;
  color?: string;
}

@ApiTags('dispositions')
@ApiBearerAuth()
@Controller('dispositions')
export class DispositionsController {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  @Get()
  @RequirePermissions('calls.view')
  async list(@Req() req: any) {
    if (!req.scopedCompanyId) throw new BadRequestException();
    return this.ds.query(
      `SELECT * FROM call_dispositions WHERE company_id = ? ORDER BY parent_id IS NULL DESC, parent_id, label`,
      [req.scopedCompanyId],
    );
  }

  @Post()
  @RequirePermissions('calls.delete')
  async create(@Body() dto: DispositionDto, @Req() req: any) {
    if (!req.scopedCompanyId) throw new BadRequestException();
    const r: any = await this.ds.query(
      `INSERT INTO call_dispositions (company_id, slug, label, parent_id, is_positive, is_callback, is_terminal, color, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, TRUE)`,
      [
        req.scopedCompanyId, dto.slug, dto.label, dto.parent_id ?? null,
        dto.is_positive ?? false, dto.is_callback ?? false, dto.is_terminal ?? true,
        dto.color ?? null,
      ],
    );
    return { id: r?.insertId ?? r?.[0]?.insertId };
  }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermissions('calls.delete')
  async remove(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    await this.ds.query(`DELETE FROM call_dispositions WHERE id = ? AND company_id = ?`, [id, req.scopedCompanyId]);
  }
}
