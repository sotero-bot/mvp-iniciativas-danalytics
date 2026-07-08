/**
 * Actor autenticado, tal y como viaja en el JWT y se expone en `req.user`.
 *
 * Plan 2 §0.1 — el payload emitido (login y magic link) es
 * `{ sub: usuarioId, role: slug, empresaId }`. `JwtStrategy.validate` lo
 * normaliza a este shape y lo deja en `req.user`; los guards y `@CurrentUser()`
 * lo leen desde ahí. La autorización nunca depende del frontend (RNF-01).
 */
export interface AuthUser {
  /** `Usuario.id` del actor (claim `sub`). */
  sub: string;
  /** Alias de `sub` para compatibilidad con código previo que leía `req.user.userId`. */
  userId: string;
  /** Slug del rol (`Role.slug`), o `null` si el usuario no tiene rol asignado. */
  role: RoleSlug | null;
  /** Empresa del actor (`Usuario.empresaId`); `null` para `danalytics_admin`. */
  empresaId: string | null;
  /** Solo presente en `danalytics_admin` (login por username/password). */
  username?: string | null;
}

/** Slugs de rol canónicos del sistema (ver `scripts/seed-admin.ts`). */
export const ROLE_SLUGS = [
  'danalytics_admin',
  'facilitador',
  'estudiante',
  'cliente_admin',
  'usuario_cliente',
] as const;

export type RoleSlug = (typeof ROLE_SLUGS)[number];

/** Roles pertenecientes a una empresa cliente (scoping por `empresaId`, RN-09). */
export const CLIENTE_ROLE_SLUGS: readonly RoleSlug[] = ['cliente_admin', 'usuario_cliente'];
