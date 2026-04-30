import { Controller, Get, Param, ParseIntPipe, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CallsService } from './calls.service';
import { RequirePermissions } from '../common/decorators/permissions.decorator';

@ApiTags('calls')
@ApiBearerAuth()
@Controller('calls')
export class CallsController {
  constructor(private readonly calls: CallsService) {}

  @Get()
  @RequirePermissions('calls.view')
  list(@Req() req: any, @Query('limit') limit = '100', @Query('offset') offset = '0') {
    return this.calls.listByCompany(req.scopedCompanyId, parseInt(limit, 10), parseInt(offset, 10));
  }

  @Get(':id')
  @RequirePermissions('calls.view')
  findOne(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.calls.findById(id, req.scopedCompanyId);
  }
}
