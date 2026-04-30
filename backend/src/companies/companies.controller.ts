import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CompaniesService } from './companies.service';
import { CreateCompanyDto, UpdateCompanyDto } from './dto/create-company.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';

@ApiTags('companies')
@ApiBearerAuth()
@Controller('companies')
export class CompaniesController {
  constructor(private readonly companies: CompaniesService) {}

  @Get()
  @RequirePermissions('companies.view')
  @ApiOperation({ summary: 'Listar empresas (super_admin)' })
  list() {
    return this.companies.list();
  }

  @Get(':id')
  @RequirePermissions('companies.view')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.companies.findById(id);
  }

  @Post()
  @Roles('super_admin')
  @RequirePermissions('companies.create')
  @ApiOperation({ summary: 'Crear empresa (solo super_admin)' })
  create(@Body() dto: CreateCompanyDto) {
    return this.companies.create(dto);
  }

  @Patch(':id')
  @RequirePermissions('companies.update')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateCompanyDto) {
    return this.companies.update(id, dto);
  }

  @Patch(':id/suspend')
  @Roles('super_admin')
  suspend(@Param('id', ParseIntPipe) id: number, @Body('reason') reason: string) {
    return this.companies.suspend(id, reason);
  }

  @Patch(':id/activate')
  @Roles('super_admin')
  activate(@Param('id', ParseIntPipe) id: number) {
    return this.companies.activate(id);
  }
}
