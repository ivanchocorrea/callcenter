import { BadRequestException, Controller, Get, Header, Query, Req, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { ReportsService } from './reports.service';
import { RequirePermissions } from '../common/decorators/permissions.decorator';

@ApiTags('reports')
@ApiBearerAuth()
@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  private filters(q: any) {
    return {
      from: q.from,
      to: q.to,
      agentId: q.agent_id ? parseInt(q.agent_id, 10) : undefined,
      queueId: q.queue_id ? parseInt(q.queue_id, 10) : undefined,
      campaignId: q.campaign_id ? parseInt(q.campaign_id, 10) : undefined,
    };
  }

  @Get('overview')
  @RequirePermissions('calls.view')
  overview(@Req() req: any, @Query() q: any) {
    if (!req.scopedCompanyId) throw new BadRequestException();
    return this.reports.overview(req.scopedCompanyId, this.filters(q));
  }

  @Get('by-agent')
  @RequirePermissions('calls.view')
  byAgent(@Req() req: any, @Query() q: any) {
    return this.reports.byAgent(req.scopedCompanyId, this.filters(q));
  }

  @Get('by-queue')
  @RequirePermissions('calls.view')
  byQueue(@Req() req: any, @Query() q: any) {
    return this.reports.byQueue(req.scopedCompanyId, this.filters(q));
  }

  @Get('hourly')
  @RequirePermissions('calls.view')
  hourly(@Req() req: any, @Query() q: any) {
    return this.reports.hourlyDistribution(req.scopedCompanyId, this.filters(q));
  }

  @Get('export.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @RequirePermissions('calls.export')
  async exportCsv(@Req() req: any, @Query() q: any, @Res() res: Response) {
    const csv = await this.reports.exportCsv(req.scopedCompanyId, this.filters(q));
    res.setHeader('Content-Disposition', `attachment; filename="calls-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(csv);
  }
}
