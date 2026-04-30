import { BadRequestException, Body, Controller, Get, Param, ParseIntPipe, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PromptsService, CreatePromptDto } from './prompts.service';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';

@ApiTags('ai-prompts')
@ApiBearerAuth()
@Controller('ai/prompts')
export class PromptsController {
  constructor(private readonly prompts: PromptsService) {}

  @Get()
  @RequirePermissions('ai.view')
  list(@Req() req: any) {
    if (!req.scopedCompanyId) throw new BadRequestException();
    return this.prompts.list(req.scopedCompanyId);
  }

  @Get(':id')
  @RequirePermissions('ai.view')
  findOne(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.prompts.findById(id, req.scopedCompanyId);
  }

  @Post()
  @RequirePermissions('ai.manage')
  create(@Body() dto: CreatePromptDto, @Req() req: any, @CurrentUser() user: AuthenticatedUser) {
    return this.prompts.create(req.scopedCompanyId, user.userId, dto);
  }

  @Post(':id/versions')
  @RequirePermissions('ai.manage')
  createVersion(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { content: string; notes?: string; activate?: boolean },
    @Req() req: any,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.prompts.createVersion(id, req.scopedCompanyId, user.userId, body.content, body.notes, body.activate ?? true);
  }

  @Post(':id/versions/:versionId/activate')
  @RequirePermissions('ai.manage')
  activate(
    @Param('id', ParseIntPipe) id: number,
    @Param('versionId', ParseIntPipe) versionId: number,
    @Req() req: any,
  ) {
    return this.prompts.activateVersion(id, versionId, req.scopedCompanyId);
  }
}
