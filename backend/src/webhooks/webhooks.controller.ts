import { BadRequestException, Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Patch, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { WebhooksService, CreateWebhookDto } from './webhooks.service';
import { WebhookDispatcherService } from './webhook-dispatcher.service';
import { RequirePermissions } from '../common/decorators/permissions.decorator';

@ApiTags('webhooks')
@ApiBearerAuth()
@Controller('webhooks')
export class WebhooksController {
  constructor(
    private readonly webhooks: WebhooksService,
    private readonly dispatcher: WebhookDispatcherService,
  ) {}

  @Get()
  @RequirePermissions('webhooks.view')
  list(@Req() req: any) {
    if (!req.scopedCompanyId) throw new BadRequestException();
    return this.webhooks.list(req.scopedCompanyId);
  }

  @Post()
  @RequirePermissions('webhooks.manage')
  create(@Body() dto: CreateWebhookDto, @Req() req: any) {
    return this.webhooks.create(req.scopedCompanyId, dto);
  }

  @Patch(':id')
  @RequirePermissions('webhooks.manage')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: Partial<CreateWebhookDto>, @Req() req: any) {
    return this.webhooks.update(id, req.scopedCompanyId, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermissions('webhooks.manage')
  async remove(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    await this.webhooks.remove(id, req.scopedCompanyId);
  }

  @Get('logs/recent')
  @RequirePermissions('webhooks.view')
  logs(@Req() req: any, @Query('endpoint_id') endpointId?: string, @Query('limit') limit = '100') {
    return this.webhooks.listLogs(
      req.scopedCompanyId,
      endpointId ? parseInt(endpointId, 10) : undefined,
      parseInt(limit, 10),
    );
  }

  @Post(':id/test')
  @RequirePermissions('webhooks.manage')
  async test(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    await this.dispatcher.publish(req.scopedCompanyId, 'webhook.test', {
      message: 'Test event from CallCenter NODOE',
      sent_at: new Date().toISOString(),
    });
    return { ok: true, queued: true };
  }
}
