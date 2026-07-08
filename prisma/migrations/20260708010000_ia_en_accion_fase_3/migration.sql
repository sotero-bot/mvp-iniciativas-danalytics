-- IA en Acción — FASE 3: Reto con IA / presentación final (Plan 1 §5, requisitos §7.3)
--
-- ⚠ REGISTRO DOCUMENTAL. El deploy usa `prisma db push` (NO `migrate deploy`),
-- por lo que este archivo NO se ejecuta en prod. La tabla la crea `db push`
-- desde schema.prisma; el CHECK "al menos url o archivo" (que db push no sabe
-- crear) se aplica de forma idempotente en scripts/seed-admin.ts
-- (ensureIndices) en cada deploy. Ver Plan 1 §12.

-- RF-32 (§7.3 final_presentations): una presentación por grupo; el grupo entrega
-- link (urlPresentacion) O archivo PDF/PPT en S3 (archivoKey).
CREATE TABLE "PresentacionFinal" (
    "id" TEXT NOT NULL,
    "grupoId" TEXT NOT NULL,
    "programaId" TEXT NOT NULL,
    "urlPresentacion" TEXT,
    "archivoKey" TEXT,
    "entregadoPorId" TEXT,
    "entregadoEn" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PresentacionFinal_pkey" PRIMARY KEY ("id")
);

-- Índices
CREATE UNIQUE INDEX "PresentacionFinal_grupoId_key" ON "PresentacionFinal"("grupoId");
CREATE INDEX "PresentacionFinal_programaId_idx" ON "PresentacionFinal"("programaId");

-- Foreign keys
ALTER TABLE "PresentacionFinal" ADD CONSTRAINT "PresentacionFinal_grupoId_fkey" FOREIGN KEY ("grupoId") REFERENCES "Grupo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PresentacionFinal" ADD CONSTRAINT "PresentacionFinal_programaId_fkey" FOREIGN KEY ("programaId") REFERENCES "Programa"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PresentacionFinal" ADD CONSTRAINT "PresentacionFinal_entregadoPorId_fkey" FOREIGN KEY ("entregadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================================
-- Lo siguiente lo aplica scripts/seed-admin.ts (ensureIndices) en cada
-- deploy porque `db push` no crea CHECK constraints.
-- Se replica aquí solo como documentación.
-- ============================================================

-- RF-32: la presentación final debe traer al menos un link o un archivo.
ALTER TABLE "PresentacionFinal"
  ADD CONSTRAINT presentacion_final_url_o_archivo
  CHECK (
    "urlPresentacion" IS NOT NULL OR "archivoKey" IS NOT NULL
  );
