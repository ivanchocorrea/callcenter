import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CallScriptsService } from './call-scripts.service';
import { CreateCallScriptDto, UpdateCallScriptDto } from './dto/call-script.dto';
import { Roles } from '../common/decorators/roles.decorator';

@ApiTags('call-scripts')
@ApiBearerAuth()
@Controller('call-scripts')
export class CallScriptsController {
  constructor(private readonly svc: CallScriptsService) {}

  @Get()
  @ApiOperation({ summary: 'Lista todos los guiones de la empresa (admin/supervisor)' })
  @Roles('super_admin', 'company_admin', 'supervisor')
  list(@Req() req: any) {
    if (!req.scopedCompanyId) throw new BadRequestException('company_id requerido');
    return this.svc.listAll(req.scopedCompanyId);
  }

  @Get('active')
  @ApiOperation({ summary: 'Lista guiones activos (los agentes los ven en el dialer)' })
  active(@Req() req: any) {
    if (!req.scopedCompanyId) throw new BadRequestException('company_id requerido');
    return this.svc.listActive(req.scopedCompanyId);
  }

  @Post()
  @ApiOperation({ summary: 'Crear guion' })
  @Roles('super_admin', 'company_admin')
  create(@Body() dto: CreateCallScriptDto, @Req() req: any) {
    if (!req.scopedCompanyId) throw new BadRequestException('company_id requerido');
    return this.svc.create(req.scopedCompanyId, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Editar guion' })
  @Roles('super_admin', 'company_admin')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateCallScriptDto, @Req() req: any) {
    if (!req.scopedCompanyId) throw new BadRequestException('company_id requerido');
    return this.svc.update(id, req.scopedCompanyId, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Borrar guion' })
  @Roles('super_admin', 'company_admin')
  remove(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    if (!req.scopedCompanyId) throw new BadRequestException('company_id requerido');
    return this.svc.remove(id, req.scopedCompanyId);
  }
}
