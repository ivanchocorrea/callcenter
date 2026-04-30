import { BadRequestException, Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Patch, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { StorageProvidersService, CreateStorageProviderDto } from './providers.service';
import { RequirePermissions } from '../common/decorators/permissions.decorator';

@ApiTags('storage-providers')
@ApiBearerAuth()
@Controller('storage/providers')
export class StorageProvidersController {
  constructor(private readonly providers: StorageProvidersService) {}

  @Get()
  @RequirePermissions('recordings.view')
  list(@Req() req: any) {
    if (!req.scopedCompanyId) throw new BadRequestException();
    return this.providers.list(req.scopedCompanyId);
  }

  @Post()
  @RequirePermissions('recordings.delete')
  create(@Body() dto: CreateStorageProviderDto, @Req() req: any) {
    if (!req.scopedCompanyId) throw new BadRequestException();
    return this.providers.create(req.scopedCompanyId, dto);
  }

  @Patch(':id')
  @RequirePermissions('recordings.delete')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: Partial<CreateStorageProviderDto>, @Req() req: any) {
    return this.providers.update(id, req.scopedCompanyId, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermissions('recordings.delete')
  async remove(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    await this.providers.remove(id, req.scopedCompanyId);
  }
}
