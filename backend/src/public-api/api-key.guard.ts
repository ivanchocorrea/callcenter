import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PublicApiService } from './public-api.service';

export const REQUIRE_SCOPE_KEY = 'publicApiScope';
export const RequireScope = (scope: string) => (target: any, key?: any, descriptor?: any) => {
  Reflect.defineMetadata(REQUIRE_SCOPE_KEY, scope, descriptor?.value ?? target);
};

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly api: PublicApiService, private readonly reflector: Reflector) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const auth = (req.headers['authorization'] as string) ?? '';
    if (!auth.toLowerCase().startsWith('bearer ')) throw new UnauthorizedException('Bearer requerido');
    const key = auth.substring(7).trim();
    const apiCtx = await this.api.authenticate(key);
    req.apiKey = apiCtx;
    req.scopedCompanyId = apiCtx.companyId;

    const scope = this.reflector.get<string>(REQUIRE_SCOPE_KEY, ctx.getHandler());
    if (scope && !this.api.hasScope(apiCtx, scope)) {
      throw new ForbiddenException(`API key sin scope ${scope}`);
    }
    return true;
  }
}
