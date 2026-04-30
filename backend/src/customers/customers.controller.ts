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
  Query,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CustomersService } from './customers.service';
import { CreateCustomerDto, UpdateCustomerDto, CreateNoteDto } from './dto/customer.dto';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';

@ApiTags('customers')
@ApiBearerAuth()
@Controller('customers')
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}

  @Get()
  @RequirePermissions('customers.view')
  list(
    @Req() req: any,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('vip') vip?: string,
    @Query('limit') limit = '50',
    @Query('offset') offset = '0',
  ) {
    if (!req.scopedCompanyId) throw new BadRequestException('company_id requerido');
    return this.customers.list(req.scopedCompanyId, {
      search,
      status,
      vipOnly: vip === 'true' || vip === '1',
      limit: parseInt(limit, 10),
      offset: parseInt(offset, 10),
    });
  }

  @Get('lookup')
  @RequirePermissions('customers.view')
  lookup(@Req() req: any, @Query('phone') phone: string) {
    if (!phone) throw new BadRequestException('phone requerido');
    return this.customers.findByPhone(req.scopedCompanyId, phone);
  }

  @Get(':id')
  @RequirePermissions('customers.view')
  findOne(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.customers.findById(id, req.scopedCompanyId);
  }

  @Post()
  @RequirePermissions('customers.manage')
  create(@Body() dto: CreateCustomerDto, @Req() req: any, @CurrentUser() user: AuthenticatedUser) {
    if (!req.scopedCompanyId) throw new BadRequestException('company_id requerido');
    return this.customers.create(req.scopedCompanyId, dto, user.userId);
  }

  @Patch(':id')
  @RequirePermissions('customers.manage')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateCustomerDto, @Req() req: any) {
    return this.customers.update(id, req.scopedCompanyId, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermissions('customers.manage')
  async remove(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    await this.customers.remove(id, req.scopedCompanyId);
  }

  // ---------------- notes ----------------
  @Get(':id/notes')
  @RequirePermissions('customers.view')
  listNotes(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.customers.listNotes(id, req.scopedCompanyId);
  }

  @Post(':id/notes')
  @RequirePermissions('customers.manage')
  addNote(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateNoteDto,
    @Req() req: any,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.customers.addNote(id, req.scopedCompanyId, user.userId, dto);
  }

  // ---------------- timeline ----------------
  @Get(':id/timeline')
  @RequirePermissions('customers.view')
  timeline(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.customers.timeline(id, req.scopedCompanyId);
  }
}
