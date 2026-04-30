import { BadRequestException, Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { RequirePermissions } from '../common/decorators/permissions.decorator';

@ApiTags('dnc')
@ApiBearerAuth()
@Controller('dnc')
export class DncController {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  @Get('lists')
  @RequirePermissions('customers.view')
  async listLists(@Req() req: any) {
    if (!req.scopedCompanyId) throw new BadRequestException();
    return this.ds.query(`SELECT * FROM dnc_lists WHERE company_id = ? ORDER BY name`, [req.scopedCompanyId]);
  }

  @Post('lists')
  @RequirePermissions('customers.manage')
  async createList(@Body() body: { slug: string; name: string; description?: string }, @Req() req: any) {
    if (!req.scopedCompanyId) throw new BadRequestException();
    const r: any = await this.ds.query(
      `INSERT INTO dnc_lists (company_id, slug, name, description) VALUES (?, ?, ?, ?)`,
      [req.scopedCompanyId, body.slug, body.name, body.description ?? null],
    );
    return { id: r?.insertId ?? r?.[0]?.insertId };
  }

  @Delete('lists/:id')
  @HttpCode(204)
  @RequirePermissions('customers.manage')
  async removeList(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    await this.ds.query(`DELETE FROM dnc_lists WHERE id = ? AND company_id = ?`, [id, req.scopedCompanyId]);
  }

  @Get('lists/:id/entries')
  @RequirePermissions('customers.view')
  async listEntries(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.ds.query(
      `SELECT * FROM dnc_entries WHERE dnc_list_id = ? AND company_id = ? ORDER BY created_at DESC LIMIT 500`,
      [id, req.scopedCompanyId],
    );
  }

  @Post('lists/:id/entries')
  @RequirePermissions('customers.manage')
  async addEntry(@Param('id', ParseIntPipe) id: number, @Body() body: { phone: string; reason?: string }, @Req() req: any) {
    if (!req.scopedCompanyId) throw new BadRequestException();
    const r: any = await this.ds.query(
      `INSERT IGNORE INTO dnc_entries (company_id, dnc_list_id, phone, reason) VALUES (?, ?, ?, ?)`,
      [req.scopedCompanyId, id, body.phone, body.reason ?? null],
    );
    return { id: r?.insertId ?? r?.[0]?.insertId };
  }

  @Delete('lists/:listId/entries/:entryId')
  @HttpCode(204)
  @RequirePermissions('customers.manage')
  async removeEntry(@Param('listId', ParseIntPipe) listId: number, @Param('entryId', ParseIntPipe) entryId: number, @Req() req: any) {
    await this.ds.query(
      `DELETE FROM dnc_entries WHERE id = ? AND dnc_list_id = ? AND company_id = ?`,
      [entryId, listId, req.scopedCompanyId],
    );
  }

  @Post('check')
  @RequirePermissions('customers.view')
  async checkPhone(@Body() body: { phone: string }, @Req() req: any) {
    const r = await this.ds.query(
      `SELECT e.id, l.name as list_name, e.reason FROM dnc_entries e
        INNER JOIN dnc_lists l ON l.id = e.dnc_list_id
        WHERE e.company_id = ? AND e.phone = ? LIMIT 1`,
      [req.scopedCompanyId, body.phone],
    );
    return { blocked: r.length > 0, ...r[0] };
  }
}
