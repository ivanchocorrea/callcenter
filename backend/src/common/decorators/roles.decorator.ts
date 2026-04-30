import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'requiredRoles';

/** Restringe el endpoint a uno o más roles. */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
