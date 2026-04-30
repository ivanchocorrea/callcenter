import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

/**
 * Guard global que asegura que el usuario tiene un companyId asociado para
 * acceder a recursos de empresa. El super_admin puede saltar esta restricción
 * siempre que envíe el header `X-Company-Id` para indicar contexto.
 */
@Injectable()
export class CompanyScopeGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest();
    const user = req.user;
    if (!user) return true; // que JwtAuthGuard lo gestione

    // super_admin puede operar sobre cualquier empresa, leemos el header opcional
    if (user.roles?.includes('super_admin')) {
      const headerCompanyId = req.headers['x-company-id'];
      if (headerCompanyId) {
        const cid = parseInt(String(headerCompanyId), 10);
        if (Number.isFinite(cid)) req.scopedCompanyId = cid;
      }
      return true;
    }

    if (!user.companyId) {
      throw new ForbiddenException('Usuario sin empresa asociada');
    }
    req.scopedCompanyId = user.companyId;
    return true;
  }
}
