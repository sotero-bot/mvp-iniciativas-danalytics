-- IA en Acción — FASE 4: Portal del cliente y auditoría (Plan 1 §6, requisitos RF-42..RF-45, RNF-13)
--
-- ⚠ REGISTRO DOCUMENTAL. El deploy usa `prisma db push` (NO `migrate deploy`),
-- por lo que este archivo NO se ejecuta en prod. Las tablas las crea `db push`
-- desde schema.prisma; el índice único PARCIAL de cliente_admin (que db push no
-- sabe crear) se aplica de forma idempotente en scripts/seed-admin.ts
-- (ensureIndiceClienteAdminUnico) en cada deploy. Ver Plan 1 §12.

-- RF-44/45: tabla puente Usuario (role=cliente_admin/usuario_cliente) ↔ Empresa.
-- Revocación = activo=false (no borrado), para conservar la historia de invitación.
CREATE TABLE "UsuarioCliente" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "invitadoPorId" TEXT,
    "invitadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UsuarioCliente_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UsuarioCliente_empresaId_usuarioId_key" ON "UsuarioCliente"("empresaId", "usuarioId");
CREATE INDEX "UsuarioCliente_usuarioId_idx" ON "UsuarioCliente"("usuarioId");
CREATE INDEX "UsuarioCliente_empresaId_activo_idx" ON "UsuarioCliente"("empresaId", "activo");

ALTER TABLE "UsuarioCliente" ADD CONSTRAINT "UsuarioCliente_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UsuarioCliente" ADD CONSTRAINT "UsuarioCliente_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "UsuarioCliente" ADD CONSTRAINT "UsuarioCliente_invitadoPorId_fkey" FOREIGN KEY ("invitadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RNF-13: bitácora de auditoría append-only. Refs "soft" (SIN foreign key) a
-- usuarioId/recursoId, para que la baja de un usuario nunca borre ni bloquee el log.
-- accion y tipoRecurso son String (NO enum): la lista crece con el tiempo.
CREATE TABLE "RegistroAcceso" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "accion" TEXT NOT NULL,
    "tipoRecurso" TEXT NOT NULL,
    "recursoId" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RegistroAcceso_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RegistroAcceso_usuarioId_creadoEn_idx" ON "RegistroAcceso"("usuarioId", "creadoEn");

-- ============================================================
-- Lo siguiente lo aplica scripts/seed-admin.ts (ensureIndiceClienteAdminUnico)
-- en cada deploy porque `db push` no crea índices parciales (WHERE).
-- Se replica aquí solo como documentación. El literal '<cliente_admin roleId>'
-- se resuelve en runtime desde la tabla Role (lookup por slug).
-- ============================================================

-- CLIENTE_ADMIN_UNICO (Plan 2 §4.4): a lo sumo un Usuario ACTIVO con rol
-- cliente_admin por empresa.
CREATE UNIQUE INDEX "usuario_cliente_admin_unico_por_empresa"
  ON "Usuario"("empresaId")
  WHERE "roleId" = '<cliente_admin roleId>' AND "activo" = true AND "empresaId" IS NOT NULL;
