import { BadRequestException, Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Patch, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { SmsProvidersService, CreateSmsProviderDto } from './providers.service';
import { RequirePermissions } from '../common/decorators/permissions.decorator';

@ApiTags('sms-providers')
@ApiBearerAuth()
@Controller('sms/providers')
export class SmsProvidersController {
  constructor(private readonly providers: SmsProvidersService) {}

  @Get()
  @RequirePermissions('sms.send')
  list(@Req() req: any) {
    if (!req.scopedCompanyId) throw new BadRequestException();
    return this.providers.list(req.scopedCompanyId);
  }

  @Post()
  @RequirePermissions('sms.manage')
  create(@Body() dto: CreateSmsProviderDto, @Req() req: any) {
    if (!req.scopedCompanyId) throw new BadRequestException();
    return this.providers.create(req.scopedCompanyId, dto);
  }

  @Patch(':id')
  @RequirePermissions('sms.manage')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: Partial<CreateSmsProviderDto>, @Req() req: any) {
    return this.providers.update(id, req.scopedCompanyId, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermissions('sms.manage')
  async remove(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    await this.providers.remove(id, req.scopedCompanyId);
  }
}
