import { BadRequestException, Body, Controller, Get, Param, ParseIntPipe, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AIToolsService } from './tools.service';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';

@ApiTags('ai-tools')
@ApiBearerAuth()
@Controller('ai/tools')
export class AIToolsController {
  constructor(private readonly tools: AIToolsService) {}

  @Get()
  @RequirePermissions('ai.view')
  list(@Req() req: any) {
    if (!req.scopedCompanyId) throw new BadRequestException();
    return this.tools.list(req.scopedCompanyId);
  }

  @Post(':id/execute')
  @RequirePermissions('ai.view')
  execute(@Param('id', ParseIntPipe) id: number, @Body() input: Record<string, unknown>, @Req() req: any) {
    return this.tools.execute(id, req.scopedCompanyId, input, {});
  }
}
