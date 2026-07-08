-- IA en Acción — FASE 2: Form builder configurable (Plan 1 §4, requisitos §7.2)
--
-- ⚠ REGISTRO DOCUMENTAL. El deploy usa `prisma db push` (NO `migrate deploy`),
-- por lo que este archivo NO se ejecuta en prod. Las tablas/enums los crea
-- `db push` desde schema.prisma; los índices únicos parciales y el CHECK del
-- XOR (que db push no sabe crear) se aplican de forma idempotente en
-- scripts/seed-admin.ts (ensureIndices) en cada deploy. Ver Plan 1 §12.

-- Enums
CREATE TYPE "TipoFormulario" AS ENUM ('diagnostico_inicial', 'diagnostico_final', 'feedback', 'bitacora', 'plantilla_proyecto');
CREATE TYPE "TipoCampo" AS ENUM ('texto_corto', 'texto_largo', 'numero', 'likert', 'opcion_multiple', 'tabla', 'grupo_repetible');
CREATE TYPE "EstadoRespuesta" AS ENUM ('draft', 'submitted');

-- RF-22/23/27, RF-46..49, RN-10: template global (programaId NULL) o snapshot por programa
CREATE TABLE "PlantillaFormulario" (
    "id" TEXT NOT NULL,
    "programaId" TEXT,
    "tipoFormulario" "TipoFormulario" NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "snapshotDeId" TEXT,
    "creadoPorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlantillaFormulario_pkey" PRIMARY KEY ("id")
);

-- RF-24/25/26. RNF-04/RN-02: configJson contiene scores ocultos — nunca se
-- serializa a roles distintos de danalytics_admin (capa de servicio).
CREATE TABLE "CampoFormulario" (
    "id" TEXT NOT NULL,
    "plantillaId" TEXT NOT NULL,
    "campoPadreId" TEXT,
    "tipoCampo" "TipoCampo" NOT NULL,
    "etiqueta" TEXT NOT NULL,
    "descripcion" TEXT,
    "dimension" TEXT,
    "esObligatorio" BOOLEAN NOT NULL DEFAULT false,
    "orden" INTEGER NOT NULL,
    "configJson" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CampoFormulario_pkey" PRIMARY KEY ("id")
);

-- RF-28/29. Individual (diagnóstico/feedback) → usuarioRespondienteId;
-- grupal (bitácora/plantilla proyecto) → grupoRespondienteId.
CREATE TABLE "RespuestaFormulario" (
    "id" TEXT NOT NULL,
    "plantillaId" TEXT NOT NULL,
    "programaId" TEXT NOT NULL,
    "usuarioRespondienteId" TEXT,
    "grupoRespondienteId" TEXT,
    "datosRespuestaJson" JSONB NOT NULL DEFAULT '{}',
    "scoresPorDimensionJson" JSONB,
    "estado" "EstadoRespuesta" NOT NULL DEFAULT 'draft',
    "ultimoEditorId" TEXT,
    "ultimaEdicionEn" TIMESTAMP(3),
    "enviadoEn" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RespuestaFormulario_pkey" PRIMARY KEY ("id")
);

-- Índices
CREATE INDEX "PlantillaFormulario_programaId_tipoFormulario_idx" ON "PlantillaFormulario"("programaId", "tipoFormulario");
CREATE INDEX "PlantillaFormulario_tipoFormulario_activa_idx" ON "PlantillaFormulario"("tipoFormulario", "activa");
CREATE INDEX "CampoFormulario_plantillaId_orden_idx" ON "CampoFormulario"("plantillaId", "orden");
CREATE INDEX "CampoFormulario_campoPadreId_idx" ON "CampoFormulario"("campoPadreId");
CREATE INDEX "RespuestaFormulario_programaId_estado_idx" ON "RespuestaFormulario"("programaId", "estado");
CREATE INDEX "RespuestaFormulario_plantillaId_idx" ON "RespuestaFormulario"("plantillaId");
CREATE INDEX "RespuestaFormulario_usuarioRespondienteId_idx" ON "RespuestaFormulario"("usuarioRespondienteId");
CREATE INDEX "RespuestaFormulario_grupoRespondienteId_idx" ON "RespuestaFormulario"("grupoRespondienteId");

-- Foreign keys
ALTER TABLE "PlantillaFormulario" ADD CONSTRAINT "PlantillaFormulario_programaId_fkey" FOREIGN KEY ("programaId") REFERENCES "Programa"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlantillaFormulario" ADD CONSTRAINT "PlantillaFormulario_snapshotDeId_fkey" FOREIGN KEY ("snapshotDeId") REFERENCES "PlantillaFormulario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PlantillaFormulario" ADD CONSTRAINT "PlantillaFormulario_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CampoFormulario" ADD CONSTRAINT "CampoFormulario_plantillaId_fkey" FOREIGN KEY ("plantillaId") REFERENCES "PlantillaFormulario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CampoFormulario" ADD CONSTRAINT "CampoFormulario_campoPadreId_fkey" FOREIGN KEY ("campoPadreId") REFERENCES "CampoFormulario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RespuestaFormulario" ADD CONSTRAINT "RespuestaFormulario_plantillaId_fkey" FOREIGN KEY ("plantillaId") REFERENCES "PlantillaFormulario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RespuestaFormulario" ADD CONSTRAINT "RespuestaFormulario_programaId_fkey" FOREIGN KEY ("programaId") REFERENCES "Programa"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RespuestaFormulario" ADD CONSTRAINT "RespuestaFormulario_usuarioRespondienteId_fkey" FOREIGN KEY ("usuarioRespondienteId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RespuestaFormulario" ADD CONSTRAINT "RespuestaFormulario_grupoRespondienteId_fkey" FOREIGN KEY ("grupoRespondienteId") REFERENCES "Grupo"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RespuestaFormulario" ADD CONSTRAINT "RespuestaFormulario_ultimoEditorId_fkey" FOREIGN KEY ("ultimoEditorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================================
-- Lo siguiente lo aplica scripts/seed-admin.ts (ensureIndices) en cada
-- deploy porque `db push` no crea índices parciales ni CHECK constraints.
-- Se replica aquí solo como documentación.
-- ============================================================

-- Unicidad: una respuesta por (plantilla, usuario) y por (plantilla, grupo)
CREATE UNIQUE INDEX IF NOT EXISTS "resp_form_usuario"
  ON "RespuestaFormulario"("plantillaId", "usuarioRespondienteId")
  WHERE "usuarioRespondienteId" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "resp_form_grupo"
  ON "RespuestaFormulario"("plantillaId", "grupoRespondienteId")
  WHERE "grupoRespondienteId" IS NOT NULL;

-- XOR: la respuesta pertenece a un usuario O a un grupo, nunca ambos/ninguno
ALTER TABLE "RespuestaFormulario"
  ADD CONSTRAINT respuesta_formulario_respondiente_xor
  CHECK (
    ("usuarioRespondienteId" IS NOT NULL AND "grupoRespondienteId" IS NULL)
    OR ("usuarioRespondienteId" IS NULL AND "grupoRespondienteId" IS NOT NULL)
  );
