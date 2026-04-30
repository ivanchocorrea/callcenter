import { BadRequestException, Body, Controller, Get, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { OmnichannelService } from './omnichannel.service';
import { Public } from '../common/decorators/public.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';

@ApiTags('omnichannel')
@ApiBearerAuth()
@Controller('omnichannel')
export class OmnichannelController {
  constructor(private readonly om: OmnichannelService) {}

  @Get('conversations')
  @RequirePermissions('ai.view')
  list(@Req() req: any, @Query('channel') channel?: string) {
    if (!req.scopedCompanyId) throw new BadRequestException();
    return this.om.listConversations(req.scopedCompanyId, channel);
  }

  /**
   * Webhook entrante genérico. Recibe { company_id, channel, from, body }.
   * En producción se autentica con HMAC del proveedor (Twilio WhatsApp, Meta, etc.).
   */
  @Public()
  @Post('inbound')
  @ApiOperation({ summary: 'Webhook entrante para todos los canales no-voz' })
  inbound(@Body() body: { company_id: number; channel: any; from: string; message: string; metadata?: Record<string, unknown> }) {
    return this.om.receiveInboundMessage(body.company_id, body.channel, body.from, body.message, body.metadata);
  }
}
