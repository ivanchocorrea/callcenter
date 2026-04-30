import { BadRequestException, Body, Controller, Get, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SmsService } from './sms.service';
import { RequirePermissions } from '../common/decorators/permissions.decorator';

interface SendDto {
  to: string;
  body?: string;
  template_slug?: string;
  variables?: Record<string, string>;
  customer_id?: number;
  call_id?: number;
}

@ApiTags('sms')
@ApiBearerAuth()
@Controller('sms')
export class SmsController {
  constructor(private readonly sms: SmsService) {}

  @Post('send')
  @RequirePermissions('sms.send')
  @ApiOperation({ summary: 'Enviar SMS' })
  send(@Body() dto: SendDto, @Req() req: any) {
    if (!req.scopedCompanyId) throw new BadRequestException();
    if (!dto.to) throw new BadRequestException('to requerido');
    return this.sms.send(req.scopedCompanyId, dto.to, dto.body, {
      templateSlug: dto.template_slug,
      variables: dto.variables,
      customerId: dto.customer_id,
      callId: dto.call_id,
    });
  }

  @Get('logs')
  @RequirePermissions('sms.send')
  logs(@Req() req: any, @Query('limit') limit = '100') {
    return this.sms.listLogs(req.scopedCompanyId, parseInt(limit, 10));
  }
}
