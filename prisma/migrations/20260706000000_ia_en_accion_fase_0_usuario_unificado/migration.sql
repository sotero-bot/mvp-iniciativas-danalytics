-- =====================================================================
-- IA en Acción — Fase 0: unificación de Usuario y Admin
-- =====================================================================
-- 1. Crea tabla Role (id UUID, slug único).
-- 2. Añade columnas nuevas a Usuario (username, password, roleId, flags OAuth).
-- 3. Añade dominioGoogleWorkspace a Empresa.
-- 4. Hace nullable Usuario.email y Usuario.empresaId.
-- 5. Copia filas de Admin a Usuario preservando password bcrypt.
-- 6. Añade índice parcial (unicidad de email sin empresa).
-- 7. Elimina la tabla Admin.
--
-- El seed de las 6 filas de Role y el backfill de Usuario.roleId se hacen
-- en scripts/seed-admin.ts (ejecutado tras `prisma db push` en cada deploy).
--
-- IMPORTANTE: los índices parciales (WHERE clause) no son regenerables
-- desde el schema.prisma; si se hace `prisma db pull` habrá que
-- reponerlos manualmente.
-- =====================================================================

-- 1. Tabla Role
CREATE TABLE "Role" (
  "id"          TEXT PRIMARY KEY,
  "slug"        TEXT NOT NULL UNIQUE,
  "nombre"      TEXT NOT NULL,
  "descripcion" TEXT,
  "activo"      BOOLEAN NOT NULL DEFAULT true,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL
);

-- 2. Empresa: dominio de Google Workspace (define OAuth vs magic link)
ALTER TABLE "Empresa" ADD COLUMN "dominioGoogleWorkspace" TEXT;

-- 3. Usuario: nuevas columnas (roleId nullable — se backfillea en seed-admin.ts)
ALTER TABLE "Usuario"
  ADD COLUMN "username" TEXT,
  ADD COLUMN "password" TEXT,
  ADD COLUMN "roleId" TEXT,
  ADD COLUMN "puedeIniciarSesion" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "googleId" TEXT,
  ADD COLUMN "googleEmailVerificado" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Usuario"
  ADD CONSTRAINT "Usuario_roleId_fkey"
    FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Usuario_roleId_idx" ON "Usuario"("roleId");
CREATE UNIQUE INDEX "Usuario_username_key" ON "Usuario"("username");
CREATE UNIQUE INDEX "Usuario_googleId_key" ON "Usuario"("googleId");

-- 4. Usuario: email y empresaId pasan a nullable
ALTER TABLE "Usuario"
  ALTER COLUMN "email" DROP NOT NULL,
  ALTER COLUMN "empresaId" DROP NOT NULL;

-- 5. Migración de Admin a Usuario
--    Preserva id, username, password (hash bcrypt) y nombre.
--    puedeIniciarSesion = true, empresaId = null.
--    roleId queda NULL — seed-admin.ts lo llena tras crear el role
--    'danalytics_admin'.
INSERT INTO "Usuario" (
  "id",
  "nombre",
  "username",
  "password",
  "puedeIniciarSesion",
  "estado",
  "activo",
  "createdAt",
  "updatedAt"
)
SELECT
  "id",
  "nombre",
  "username",
  "password",
  true,
  'activo',
  "activo",
  "createdAt",
  "updatedAt"
FROM "Admin";

-- 6. Índice parcial para unicidad de email en usuarios sin empresa
--    (username y googleId ya son @unique en Prisma; no se declaran aquí).
CREATE UNIQUE INDEX "usuario_email_sin_empresa"
  ON "Usuario"("email")
  WHERE "empresaId" IS NULL AND "email" IS NOT NULL;

-- 7. Eliminar tabla Admin
DROP TABLE "Admin";
