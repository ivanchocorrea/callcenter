import { Controller, Get, HttpCode, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AsteriskConfigService } from './asterisk-config.service';
import { Roles } from '../common/decorators/roles.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';

@ApiTags('asterisk')
@ApiBearerAuth()
@Controller('asterisk')
export class AsteriskConfigController {
  constructor(private readonly svc: AsteriskConfigService) {}

  @Get('status')
  @Roles('super_admin', 'company_admin')
  @ApiOperation({ summary: 'Estado de Asterisk: conexiones AMI/ARI, endpoints registrados, archivo PJSIP de agentes' })
  status() {
    return this.svc.status();
  }

  @Post('sync-agents')
  @HttpCode(200)
  @Roles('super_admin', 'company_admin')
  @ApiOperation({ summary: 'Regenera el archivo PJSIP de agentes y hace pjsip reload' })
  syncAgents() {
    return this.svc.syncAllAgents();
  }

  @Post('reload')
  @HttpCode(200)
  @Roles('super_admin', 'company_admin')
  @ApiOperation({ summary: 'Solo recarga PJSIP sin regenerar el archivo' })
  async reload() {
    const ok = await this.svc.reloadPjsip();
    return { reloaded: ok };
  }
}
