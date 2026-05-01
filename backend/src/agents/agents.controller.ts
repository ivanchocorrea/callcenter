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
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AgentsService } from './agents.service';
import { CreateAgentDto, UpdateAgentDto } from './dto/create-agent.dto';
import { RequirePermissions } from '../common/decorators/permissions.decorator';

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
}
