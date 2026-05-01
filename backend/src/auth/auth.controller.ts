import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Ip,
  Param,
  ParseIntPipe,
  Post,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto, RefreshDto } from './dto/login.dto';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Login con email + password (+ TOTP si aplica)' })
  login(@Body() dto: LoginDto, @Ip() ip: string, @Headers('user-agent') ua: string) {
    return this.auth.login(dto, { ip, userAgent: ua });
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  @ApiOperation({ summary: 'Renovar access_token con refresh_token (rotación)' })
  refresh(@Body() dto: RefreshDto, @Ip() ip: string, @Headers('user-agent') ua: string) {
    return this.auth.refresh(dto.refresh_token, { ip, userAgent: ua });
  }

  @Public()
  @Post('logout')
  @HttpCode(204)
  @ApiOperation({ summary: 'Revocar refresh_token (logout)' })
  async logout(@Body() dto: RefreshDto): Promise<void> {
    await this.auth.logout(dto.refresh_token);
  }

  @ApiBearerAuth()
  @Get('me')
  @ApiOperation({ summary: 'Información del usuario autenticado' })
  me(@CurrentUser() user: AuthenticatedUser) {
    return user;
  }

  @ApiBearerAuth()
  @Post('impersonate/:userId')
  @HttpCode(200)
  @ApiOperation({ summary: 'Super admin obtiene tokens de otro usuario para verlo como él' })
  impersonate(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('userId', ParseIntPipe) targetId: number,
    @Ip() ip: string,
    @Headers('user-agent') ua: string,
  ) {
    const actorId = (actor as any).userId ?? (actor as any).id ?? (actor as any).sub;
    const roles = (actor as any).roles ?? [];
    return this.auth.impersonate(actorId, roles, targetId, { ip, userAgent: ua });
  }
}
