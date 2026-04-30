import { BadRequestException, Body, Controller, Get, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ImportService } from './import.service';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';

interface DetectColumnsBody { csv: string; }

interface RunImportBody {
  csv: string;
  column_mapping: Record<string, string>;
  options?: {
    dedupeBy?: 'phone' | 'document' | 'none';
    skipDnc?: boolean;
  };
}

@ApiTags('imports')
@ApiBearerAuth()
@Controller('imports')
export class ImportController {
  constructor(private readonly imports: ImportService) {}

  @Get()
  @RequirePermissions('customers.import')
  list(@Req() req: any) {
    if (!req.scopedCompanyId) throw new BadRequestException('company_id requerido');
    return this.imports.listJobs(req.scopedCompanyId);
  }

  @Post('detect-columns')
  @RequirePermissions('customers.import')
  @ApiOperation({ summary: 'Detecta columnas y devuelve sample de filas' })
  detect(@Body() body: DetectColumnsBody) {
    if (!body?.csv) throw new BadRequestException('csv requerido');
    return this.imports.detectColumns(body.csv);
  }

  @Post('run')
  @RequirePermissions('customers.import')
  @ApiOperation({ summary: 'Ejecuta importación con el mapping confirmado' })
  run(@Body() body: RunImportBody, @Req() req: any, @CurrentUser() user: AuthenticatedUser) {
    if (!req.scopedCompanyId) throw new BadRequestException('company_id requerido');
    if (!body?.csv) throw new BadRequestException('csv requerido');
    if (!body?.column_mapping?.full_name) throw new BadRequestException('column_mapping.full_name es obligatorio');
    return this.imports.runImport(req.scopedCompanyId, user.userId, body.csv, body.column_mapping, body.options ?? {});
  }
}
