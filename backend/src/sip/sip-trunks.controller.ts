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
import { SipTrunksService } from './sip-trunks.service';
import { CreateSipTrunkDto, UpdateSipTrunkDto } from './dto/sip-trunk.dto';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';

@ApiTags('sip-trunks')
@ApiBearerAuth()
@Controller('sip-trunks')
export class SipTrunksController {
  constructor(private readonly trunks: SipTrunksService) {}

  @Get()
  @RequirePermissions('sip.view')
  list(@Req() req: any) {
    if (!req.scopedCompanyId) throw new BadRequestException('company_id requerido');
    return this.trunks.list(req.scopedCompanyId);
  }

  @Get(':id')
  @RequirePermissions('sip.view')
  findOne(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.trunks.findById(id, req.scopedCompanyId);
  }

  @Post()
  @RequirePermissions('sip.manage')
  @ApiOperation({ summary: 'Crear troncal SIP' })
  create(@Body() dto: CreateSipTrunkDto, @Req() req: any, @CurrentUser() user: AuthenticatedUser) {
    if (!req.scopedCompanyId) throw new BadRequestException('company_id requerido');
    return this.trunks.create(req.scopedCompanyId, dto, { userId: user.userId, email: user.email });
  }

  @Patch(':id')
  @RequirePermissions('sip.manage')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateSipTrunkDto,
    @Req() req: any,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.trunks.update(id, req.scopedCompanyId, dto, { userId: user.userId, email: user.email });
  }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermissions('sip.manage')
  async remove(@Param('id', ParseIntPipe) id: number, @Req() req: any, @CurrentUser() user: AuthenticatedUser) {
    await this.trunks.remove(id, req.scopedCompanyId, { userId: user.userId, email: user.email });
  }

  @Post(':id/test')
  @RequirePermissions('sip.manage')
  @ApiOperation({ summary: 'Probar conexión SIP (envía OPTIONS)' })
  test(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.trunks.testConnection(id, req.scopedCompanyId);
  }
}
