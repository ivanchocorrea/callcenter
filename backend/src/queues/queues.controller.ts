import { BadRequestException, Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Patch, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { QueuesService } from './queues.service';
import { RequirePermissions } from '../common/decorators/permissions.decorator';

@ApiTags('queues')
@ApiBearerAuth()
@Controller('queues')
export class QueuesController {
  constructor(private readonly queues: QueuesService) {}

  @Get()
  @RequirePermissions('queues.view')
  list(@Req() req: any) {
    if (!req.scopedCompanyId) throw new BadRequestException();
    return this.queues.list(req.scopedCompanyId);
  }

  @Get('snapshot')
  @RequirePermissions('supervisor.live')
  snapshot(@Req() req: any) {
    return this.queues.snapshot(req.scopedCompanyId);
  }

  @Get(':id')
  @RequirePermissions('queues.view')
  findOne(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.queues.findById(id, req.scopedCompanyId);
  }

  @Post()
  @RequirePermissions('queues.manage')
  create(@Body() dto: any, @Req() req: any) {
    return this.queues.create(req.scopedCompanyId, dto);
  }

  @Patch(':id')
  @RequirePermissions('queues.manage')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: any, @Req() req: any) {
    return this.queues.update(id, req.scopedCompanyId, dto);
  }

  @Post(':id/agents/:agentId')
  @RequirePermissions('queues.manage')
  addAgent(
    @Param('id', ParseIntPipe) id: number,
    @Param('agentId', ParseIntPipe) agentId: number,
    @Body('penalty') penalty?: number,
  ) {
    return this.queues.addAgent(id, agentId, penalty ?? 0);
  }

  @Delete(':id/agents/:agentId')
  @HttpCode(204)
  @RequirePermissions('queues.manage')
  async removeAgent(@Param('id', ParseIntPipe) id: number, @Param('agentId', ParseIntPipe) agentId: number) {
    await this.queues.removeAgent(id, agentId);
  }
}
