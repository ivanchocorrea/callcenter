import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AgentsService } from './agents.service';
import { CreateAgentDto, UpdateAgentDto } from './dto/create-agent.dto';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';

@ApiTags('agents')
@ApiBearerAuth()
@Controller('agents')
export class AgentsController {
  constructor(private readonly agents: AgentsService) {}

  @Get()
  @RequirePermissions('agents.view')
  list(@Req() req: any) {
    if (!req.scopedCompanyId) throw new BadRequestException('company_id requerido');
    return this.agents.list(req.scopedCompanyId);
  }

  @Get(':id')
  @RequirePermissions('agents.view')
  findOne(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.agents.findById(id, req.scopedCompanyId);
  }

  @Post()
  @RequirePermissions('agents.manage')
  create(@Body() dto: CreateAgentDto, @Req() req: any) {
    if (!req.scopedCompanyId) throw new BadRequestException('company_id requerido');
    return this.agents.create(req.scopedCompanyId, dto);
  }

  @Patch(':id')
  @RequirePermissions('agents.manage')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateAgentDto, @Req() req: any) {
    if (!req.scopedCompanyId) throw new BadRequestException('company_id requerido');
    return this.agents.update(id, req.scopedCompanyId, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermissions('agents.manage')
  async remove(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    if (!req.scopedCompanyId) throw new BadRequestException('company_id requerido');
    await this.agents.remove(id, req.scopedCompanyId);
  }

  @Post(':id/regenerate-secret')
  @RequirePermissions('agents.manage')
  regenerateSecret(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    if (!req.scopedCompanyId) throw new BadRequestException('company_id requerido');
    return this.agents.regenerateSecret(id, req.scopedCompanyId);
  }

  // ============= STATUS DEL AGENTE (dropdown) =============

  @Get('me/status')
  @ApiOperation({ summary: 'Estado actual del agente logueado' })
  getMyStatus(@CurrentUser() user: AuthenticatedUser, @Req() req: any) {
    if (!req.scopedCompanyId) throw new BadRequestException('company_id requerido');
    return this.agents.getMyStatus(user.userId, req.scopedCompanyId);
  }

  @Put('me/status')
  @ApiOperation({ summary: 'Cambiar estado del agente (Disponible / Ocupado / Pausa / Almuerzo / Capacitación / Offline)' })
  setMyStatus(
    @Body('status') status: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: any,
  ) {
    if (!req.scopedCompanyId) throw new BadRequestException('company_id requerido');
    return this.agents.setMyStatus(user.userId, req.scopedCompanyId, status);
  }

  // ============= REPORTES DEL AGENTE =============

  @Get('me/report')
  @ApiOperation({ summary: 'Reportes del agente: totales y series por hora/día' })
  myReport(
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: any,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    if (!req.scopedCompanyId) throw new BadRequestException('company_id requerido');
    // Default: últimas 24 horas
    const now = new Date();
    const fromIso = from ?? new Date(now.getTime() - 24 * 3600 * 1000).toISOString().slice(0, 19).replace('T', ' ');
    const toIso = to ?? now.toISOString().slice(0, 19).replace('T', ' ');
    return this.agents.myReport(user.userId, req.scopedCompanyId, fromIso, toIso);
  }
}
