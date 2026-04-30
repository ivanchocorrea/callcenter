import { BadRequestException, Body, Controller, Get, Param, ParseIntPipe, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { OutboundDialerService } from './outbound-dialer.service';
import { DialDto } from './dto/dial.dto';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';

@ApiTags('outbound-dialer')
@ApiBearerAuth()
@Controller('dial')
export class OutboundDialerController {
  constructor(private readonly dialer: OutboundDialerService) {}

  @Post()
  @ApiOperation({ summary: 'Originar llamada saliente desde el agente actual' })
  dial(@Body() dto: DialDto, @CurrentUser() user: AuthenticatedUser, @Req() req: any) {
    if (!req.scopedCompanyId) throw new BadRequestException('company_id requerido');
    return this.dialer.dial(
      { userId: user.userId, email: user.email, companyId: req.scopedCompanyId },
      dto,
    );
  }

  @Post(':id/hangup')
  hangup(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.dialer.hangupByCall(id, req.scopedCompanyId);
  }

  @Get('recent')
  recent(@CurrentUser() user: AuthenticatedUser, @Req() req: any, @Query('limit') limit = '30') {
    if (!req.scopedCompanyId) throw new BadRequestException('company_id requerido');
    return this.dialer.recentForAgent(
      { userId: user.userId, email: user.email, companyId: req.scopedCompanyId },
      parseInt(limit, 10),
    );
  }
}
