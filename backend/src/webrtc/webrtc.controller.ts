import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { WebRtcService } from './webrtc.service';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';

@ApiTags('webrtc')
@ApiBearerAuth()
@Controller('webrtc')
export class WebRtcController {
  constructor(private readonly svc: WebRtcService) {}

  @Get('credentials')
  @ApiOperation({ summary: 'Credenciales SIP/ICE para que el agente registre su softphone web' })
  credentials(@CurrentUser() user: AuthenticatedUser) {
    return this.svc.credentialsForUser(user.userId, user.companyId);
  }
}
