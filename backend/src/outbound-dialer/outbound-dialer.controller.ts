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

  @Post(':id/transfer')
  @ApiOperation({ summary: 'Transferencia ciega de la llamada a otra extensión o número externo' })
  transfer(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { destination: string },
    @Req() req: any,
  ) {
    if (!req.scopedCompanyId) throw new BadRequestException('company_id requerido');
    return this.dialer.transferCall(id, req.scopedCompanyId, body.destination);
  }

  @Get('recent')
  recent(@CurrentUser() user: AuthenticatedUser, @Req() req: any, @Query('limit') limit = '30') {
    if (!req.scopedCompanyId) throw new BadRequestException('company_id requerido');
    return this.dialer.recentForAgent(
      { userId: user.userId, email: user.email, companyId: req.scopedCompanyId },
      parseInt(limit, 10),
    );
  }

  /** Historial paginado para el dialer rediseñado (últimos 2 días, búsqueda, paginación). */
  @Get('history')
  @ApiOperation({ summary: 'Historial paginado del agente (últimos 2 días, con búsqueda)' })
  history(
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: any,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('q') q?: string,
  ) {
    if (!req.scopedCompanyId) throw new BadRequestException('company_id requerido');
    return this.dialer.recentForDialer(
      { userId: user.userId, email: user.email, companyId: req.scopedCompanyId },
      { page: parseInt(page, 10), limit: parseInt(limit, 10), q },
    );
  }

  /** Llamadas entrantes en cola/timbrando ahora mismo (visibles a todos los agentes). */
  @Get('queue')
  @ApiOperation({ summary: 'Últimas llamadas entrantes en cola (esperando ser atendidas)' })
  queue(@Req() req: any, @Query('limit') limit = '5') {
    if (!req.scopedCompanyId) throw new BadRequestException('company_id requerido');
    return this.dialer.queueForCompany(req.scopedCompanyId, parseInt(limit, 10));
  }

  /** Llamada activa del agente actual — para tipificar entrantes recién contestadas. */
  @Get('current')
  @ApiOperation({ summary: 'Devuelve la llamada activa del agente (initiated/ringing/answered) en los últimos 5min' })
  current(@CurrentUser() user: AuthenticatedUser, @Req() req: any) {
    if (!req.scopedCompanyId) throw new BadRequestException('company_id requerido');
    return this.dialer.currentForAgent({
      userId: user.userId,
      email: user.email,
      companyId: req.scopedCompanyId,
    });
  }
}
