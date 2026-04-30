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
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IvrService } from './ivr.service';
import { CreateIvrMenuDto, UpdateIvrMenuDto, CreateIvrAudioDto } from './dto/ivr.dto';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';

@ApiTags('ivr')
@ApiBearerAuth()
@Controller('ivr')
export class IvrController {
  constructor(private readonly ivr: IvrService) {}

  @Get()
  @RequirePermissions('ivr.view')
  list(@Req() req: any) {
    if (!req.scopedCompanyId) throw new BadRequestException('company_id requerido');
    return this.ivr.listMenus(req.scopedCompanyId);
  }

  @Get(':id')
  @RequirePermissions('ivr.view')
  findOne(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.ivr.findMenu(id, req.scopedCompanyId);
  }

  @Post()
  @RequirePermissions('ivr.manage')
  create(@Body() dto: CreateIvrMenuDto, @Req() req: any) {
    if (!req.scopedCompanyId) throw new BadRequestException('company_id requerido');
    return this.ivr.createMenu(req.scopedCompanyId, dto);
  }

  @Patch(':id')
  @RequirePermissions('ivr.manage')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateIvrMenuDto, @Req() req: any) {
    return this.ivr.updateMenu(id, req.scopedCompanyId, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermissions('ivr.manage')
  async remove(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    await this.ivr.deleteMenu(id, req.scopedCompanyId);
  }

  // ---------- audios ----------
  @Get('audios/list')
  @RequirePermissions('ivr.view')
  listAudios(@Req() req: any) {
    return this.ivr.listAudios(req.scopedCompanyId);
  }

  @Post('audios')
  @RequirePermissions('ivr.manage')
  uploadAudio(@Body() dto: CreateIvrAudioDto, @Req() req: any, @CurrentUser() user: AuthenticatedUser) {
    if (!req.scopedCompanyId) throw new BadRequestException('company_id requerido');
    return this.ivr.uploadAudio(req.scopedCompanyId, user.userId, dto);
  }

  @Delete('audios/:id')
  @HttpCode(204)
  @RequirePermissions('ivr.manage')
  async removeAudio(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    await this.ivr.deleteAudio(id, req.scopedCompanyId);
  }
}
