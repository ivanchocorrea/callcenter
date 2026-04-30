import { BadRequestException, Body, Controller, Get, Param, ParseIntPipe, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ConnectorsService } from './connectors.service';
import { RequirePermissions } from '../common/decorators/permissions.decorator';

@ApiTags('connectors')
@ApiBearerAuth()
@Controller('connectors')
export class ConnectorsController {
  constructor(private readonly connectors: ConnectorsService) {}

  @Get()
  @RequirePermissions('ai.view')
  list(@Req() req: any) {
    if (!req.scopedCompanyId) throw new BadRequestException();
    return this.connectors.list(req.scopedCompanyId);
  }

  @Post()
  @RequirePermissions('ai.manage')
  create(@Body() dto: any, @Req() req: any) {
    return this.connectors.create(req.scopedCompanyId, dto);
  }

  @Post(':id/credentials')
  @RequirePermissions('ai.manage')
  setCredential(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { type: 'api_key' | 'oauth2' | 'basic' | 'bearer' | 'custom'; value: string; refresh_token?: string },
    @Req() req: any,
  ) {
    return this.connectors.setCredential(id, req.scopedCompanyId, body.type, body.value, body.refresh_token);
  }

  @Post(':id/execute')
  @RequirePermissions('ai.view')
  execute(@Param('id', ParseIntPipe) id: number, @Body() input: Record<string, unknown>, @Req() req: any) {
    return this.connectors.execute(req.scopedCompanyId, id, input);
  }
}
