import { BadRequestException, Body, Controller, Get, Param, ParseIntPipe, Patch, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
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

  @Patch(':id/notes')
  @ApiOperation({ summary: 'Guardar notas y tipificación de una llamada (durante o después)' })
  saveNotes(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { notes?: string; disposition_id?: number | null },
    @Req() req: any,
  ) {
    if (!req.scopedCompanyId) throw new BadRequestException('company_id requerido');
    return this.calls.updateNotesAndDisposition(id, req.scopedCompanyId, body);
  }
}
