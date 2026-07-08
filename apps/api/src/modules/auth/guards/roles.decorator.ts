import { SetMetadata } from '@nestjs/common';

import { RoleSlug } from './auth-user';

export const ROLES_KEY = 'roles';

/**
 * Declara los roles autorizados para un endpoint (Plan 2 §0.1, RNF-01).
 *
 * Se usa junto a `@UseGuards(JwtAuthGuard, RolesGuard)`. Sin `@Roles(...)`,
 * `RolesGuard` deja pasar a cualquier usuario autenticado (la autenticación
 * la garantiza `JwtAuthGuard`).
 *
 * @example
 * ```ts
 * @UseGuards(JwtAuthGuard, RolesGuard)
 * @Roles('danalytics_admin')
 * @Get('programas')
 * findAll() { ... }
 * ```
 */
export const Roles = (...roles: RoleSlug[]) => SetMetadata(ROLES_KEY, roles);
