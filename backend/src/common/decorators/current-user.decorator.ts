import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface AuthenticatedUser {
  userId: number;
  email: string;
  companyId: number | null;
  roles: string[];
  permissions: string[];
}

/** Devuelve el usuario autenticado desde el JWT (lo inyecta JwtStrategy). */
export const CurrentUser = createParamDecorator(
  (data: keyof AuthenticatedUser | undefined, ctx: ExecutionContext): AuthenticatedUser | unknown => {
    const req = ctx.switchToHttp().getRequest();
    const user = req.user as AuthenticatedUser;
    return data ? user?.[data] : user;
  },
);
