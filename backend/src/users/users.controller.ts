import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateUserDto, UpdateUserDto } from './dto/create-user.dto';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @RequirePermissions('users.view')
  list(@Req() req: any) {
    // Si super_admin sin empresa asignada en JWT → null = ver TODOS
    // Si tiene company_id → filtrar SOLO por esa empresa
    return this.users.list(req.scopedCompanyId ?? null);
  }

  @Get('all')
  @RequirePermissions('companies.view')
  listAll() {
    // Super admin: lista TODOS los usuarios de TODAS las empresas con info de empresa
    return this.users.listAll();
  }

  @Get(':id')
  @RequirePermissions('users.view')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.users.findById(id);
  }

  @Post()
  @RequirePermissions('users.create')
  @ApiOperation({ summary: 'Crear usuario en la empresa actual (o la especificada para super_admin)' })
  create(@Body() dto: CreateUserDto, @CurrentUser() user: AuthenticatedUser) {
    return this.users.create(dto, user.companyId);
  }

  @Patch(':id')
  @RequirePermissions('users.update')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateUserDto) {
    return this.users.update(id, dto);
  }

  @Patch(':id/password')
  @RequirePermissions('users.update')
  async setPassword(@Param('id', ParseIntPipe) id: number, @Body('password') password: string) {
    await this.users.setPassword(id, password);
    return { ok: true };
  }
}
