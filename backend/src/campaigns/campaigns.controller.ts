import { BadRequestException, Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CampaignsService } from './campaigns.service';
import { RequirePermissions } from '../common/decorators/permissions.decorator';

@ApiTags('campaigns')
@ApiBearerAuth()
@Controller('campaigns')
export class CampaignsController {
  constructor(private readonly campaigns: CampaignsService) {}

  @Get()
  @RequirePermissions('queues.view')
  list(@Req() req: any) {
    if (!req.scopedCompanyId) throw new BadRequestException();
    return this.campaigns.list(req.scopedCompanyId);
  }

  @Get(':id')
  @RequirePermissions('queues.view')
  findOne(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.campaigns.findById(id, req.scopedCompanyId);
  }

  @Post()
  @RequirePermissions('queues.manage')
  create(@Body() dto: any, @Req() req: any) {
    return this.campaigns.create(req.scopedCompanyId, dto);
  }

  @Patch(':id/status')
  @RequirePermissions('queues.manage')
  setStatus(@Param('id', ParseIntPipe) id: number, @Body('status') status: any, @Req() req: any) {
    return this.campaigns.setStatus(id, req.scopedCompanyId, status);
  }

  @Post(':id/contacts')
  @RequirePermissions('queues.manage')
  addContacts(@Param('id', ParseIntPipe) id: number, @Body() body: any, @Req() req: any) {
    if (!Array.isArray(body?.contacts)) throw new BadRequestException('contacts requerido');
    return this.campaigns.addContacts(id, req.scopedCompanyId, body.contacts);
  }
}
