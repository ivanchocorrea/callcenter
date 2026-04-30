import { BadRequestException, Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Patch, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { BotsService, CreateBotDto } from './bots.service';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';

@ApiTags('ai-bots')
@ApiBearerAuth()
@Controller('ai/bots')
export class BotsController {
  constructor(private readonly bots: BotsService) {}

  @Get()
  @RequirePermissions('ai.view')
  list(@Req() req: any) {
    if (!req.scopedCompanyId) throw new BadRequestException();
    return this.bots.list(req.scopedCompanyId);
  }

  @Get(':id')
  @RequirePermissions('ai.view')
  findOne(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.bots.findById(id, req.scopedCompanyId);
  }

  @Post()
  @RequirePermissions('ai.manage')
  create(@Body() dto: CreateBotDto, @Req() req: any) {
    return this.bots.create(req.scopedCompanyId, dto);
  }

  @Patch(':id')
  @RequirePermissions('ai.manage')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: Partial<CreateBotDto>, @Req() req: any) {
    return this.bots.update(id, req.scopedCompanyId, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermissions('ai.manage')
  async remove(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    await this.bots.remove(id, req.scopedCompanyId);
  }
}
