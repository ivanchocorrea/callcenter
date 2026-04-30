import { BadRequestException, Body, Controller, Get, Param, ParseIntPipe, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { QualityService } from './quality.service';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';

@ApiTags('quality')
@ApiBearerAuth()
@Controller('quality')
export class QualityController {
  constructor(private readonly q: QualityService) {}

  @Get('forms')
  @RequirePermissions('supervisor.live')
  listForms(@Req() req: any) {
    if (!req.scopedCompanyId) throw new BadRequestException();
    return this.q.listForms(req.scopedCompanyId);
  }

  @Post('forms')
  @RequirePermissions('supervisor.live')
  createForm(@Body() dto: any, @Req() req: any) {
    return this.q.createForm(req.scopedCompanyId, dto);
  }

  @Get('reviews')
  @RequirePermissions('supervisor.live')
  listReviews(@Req() req: any, @Query('agent_id') agentId?: string, @Query('limit') limit = '100') {
    return this.q.listReviews(req.scopedCompanyId, agentId ? parseInt(agentId, 10) : undefined, parseInt(limit, 10));
  }

  @Post('forms/:id/reviews')
  @RequirePermissions('supervisor.live')
  createReview(@Param('id', ParseIntPipe) id: number, @Body() dto: any, @Req() req: any, @CurrentUser() user: AuthenticatedUser) {
    return this.q.createReview(req.scopedCompanyId, id, user.userId, dto);
  }
}
