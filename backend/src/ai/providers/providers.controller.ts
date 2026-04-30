import { BadRequestException, Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Patch, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ProvidersService, CreateProviderDto } from './providers.service';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';

@ApiTags('ai-providers')
@ApiBearerAuth()
@Controller('ai/providers')
export class ProvidersController {
  constructor(private readonly providers: ProvidersService) {}

  @Get()
  @RequirePermissions('ai.view')
  list(@Req() req: any) {
    if (!req.scopedCompanyId) throw new BadRequestException();
    return this.providers.list(req.scopedCompanyId);
  }

  @Post()
  @RequirePermissions('ai.manage')
  create(@Body() dto: CreateProviderDto, @Req() req: any) {
    if (!req.scopedCompanyId) throw new BadRequestException();
    return this.providers.create(req.scopedCompanyId, dto);
  }

  @Patch(':id')
  @RequirePermissions('ai.manage')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: Partial<CreateProviderDto>, @Req() req: any) {
    return this.providers.update(id, req.scopedCompanyId, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermissions('ai.manage')
  async remove(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    await this.providers.remove(id, req.scopedCompanyId);
  }
}
