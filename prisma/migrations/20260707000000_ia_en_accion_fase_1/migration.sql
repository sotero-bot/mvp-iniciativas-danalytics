-- =====================================================================
-- IA en Acción — Fase 1: programas, sesiones, participantes, auth base
-- =====================================================================
-- Añade el núcleo del módulo IA en Acción:
--   - Programa, Sesion, ParticipantePrograma, Grupo, MiembroGrupo
--   - Asistencia, ObservacionFacilitador
--   - MagicLink (auth sin password)
--
-- 4 enums nuevos: EstadoPrograma, EstadoSesion, TipoObservacion, NivelUrgencia.
--
-- La regla RN-04 (un usuario en un solo grupo por programa) se valida
-- en la capa de servicio, no en la BD, porque Prisma no soporta constraints
-- únicas que atraviesen tablas.
-- =====================================================================

-- Enums
CREATE TYPE "EstadoPrograma"  AS ENUM ('borrador', 'activo', 'finalizado', 'cancelado');
CREATE TYPE "EstadoSesion"    AS ENUM ('pendiente', 'completada');
CREATE TYPE "TipoObservacion" AS ENUM ('baja_participacion', 'falta_atencion', 'problema_tecnico', 'dificultades_estudiante', 'otro');
CREATE TYPE "NivelUrgencia"   AS ENUM ('normal', 'urgente');

-- Programa
CREATE TABLE "Programa" (
  "id"            TEXT PRIMARY KEY,
  "nombre"        TEXT NOT NULL,
  "descripcion"   TEXT,
  "empresaId"     TEXT NOT NULL,
  "facilitadorId" TEXT NOT NULL,
  "estado"        "EstadoPrograma" NOT NULL DEFAULT 'borrador',
  "timezone"      TEXT NOT NULL DEFAULT 'America/Bogota',
  "diasGracia"    INTEGER NOT NULL DEFAULT 3, -- RF-03/RN-03: 3 días hábiles (solo sáb/dom)
  "totalSesionesEsperadas"  INTEGER,                       -- RF-01/RF-04
  "marcarSesionAutomatica"  BOOLEAN NOT NULL DEFAULT false, -- RF-10
  "presentacionDesdeSesion" INTEGER,                       -- RF-32
  "fechaInicio"   TIMESTAMP(3),
  "fechaFin"      TIMESTAMP(3),
  "activo"        BOOLEAN NOT NULL DEFAULT true,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Programa_empresaId_fkey"     FOREIGN KEY ("empresaId")     REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Programa_facilitadorId_fkey" FOREIGN KEY ("facilitadorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "Programa_empresaId_estado_idx" ON "Programa"("empresaId", "estado");
CREATE INDEX "Programa_facilitadorId_idx"    ON "Programa"("facilitadorId");

-- Sesion
CREATE TABLE "Sesion" (
  "id"                   TEXT PRIMARY KEY,
  "programaId"           TEXT NOT NULL,
  "numeroSesion"         INTEGER NOT NULL,
  "titulo"               TEXT NOT NULL,
  "descripcion"          TEXT,
  "fechaProgramada"      TIMESTAMP(3) NOT NULL,
  "materialArchivoKey"   TEXT,
  "urlGrabacion"         TEXT,
  "materialDesbloqueoEn" TIMESTAMP(3),
  "estado"               "EstadoSesion" NOT NULL DEFAULT 'pendiente',
  "createdAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"            TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Sesion_programaId_fkey" FOREIGN KEY ("programaId") REFERENCES "Programa"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "Sesion_programaId_numeroSesion_key" ON "Sesion"("programaId", "numeroSesion");
CREATE INDEX        "Sesion_programaId_idx"              ON "Sesion"("programaId");

-- ParticipantePrograma
CREATE TABLE "ParticipantePrograma" (
  "id"         TEXT PRIMARY KEY,
  "programaId" TEXT NOT NULL,
  "usuarioId"  TEXT NOT NULL,
  "activo"     BOOLEAN NOT NULL DEFAULT true,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ParticipantePrograma_programaId_fkey" FOREIGN KEY ("programaId") REFERENCES "Programa"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ParticipantePrograma_usuarioId_fkey"  FOREIGN KEY ("usuarioId")  REFERENCES "Usuario"("id")  ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ParticipantePrograma_programaId_usuarioId_key" ON "ParticipantePrograma"("programaId", "usuarioId");
CREATE INDEX        "ParticipantePrograma_usuarioId_idx"            ON "ParticipantePrograma"("usuarioId");

-- Grupo
CREATE TABLE "Grupo" (
  "id"         TEXT PRIMARY KEY,
  "programaId" TEXT NOT NULL,
  "nombre"     TEXT NOT NULL,
  "orden"      INTEGER NOT NULL,
  "creadoPorId" TEXT,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Grupo_programaId_fkey"  FOREIGN KEY ("programaId")  REFERENCES "Programa"("id") ON DELETE CASCADE  ON UPDATE CASCADE,
  CONSTRAINT "Grupo_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "Usuario"("id")  ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "Grupo_programaId_orden_key" ON "Grupo"("programaId", "orden");
CREATE INDEX        "Grupo_programaId_idx"       ON "Grupo"("programaId");

-- MiembroGrupo
-- "programaId" está denormalizado desde Grupo.programaId para poder imponer RN-04
-- (un estudiante en un solo grupo por programa) con un índice único de una sola tabla.
CREATE TABLE "MiembroGrupo" (
  "id"         TEXT PRIMARY KEY,
  "grupoId"    TEXT NOT NULL,
  "programaId" TEXT NOT NULL,
  "usuarioId"  TEXT NOT NULL,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MiembroGrupo_grupoId_fkey"    FOREIGN KEY ("grupoId")    REFERENCES "Grupo"("id")    ON DELETE CASCADE  ON UPDATE CASCADE,
  CONSTRAINT "MiembroGrupo_programaId_fkey" FOREIGN KEY ("programaId") REFERENCES "Programa"("id") ON DELETE CASCADE  ON UPDATE CASCADE,
  CONSTRAINT "MiembroGrupo_usuarioId_fkey"  FOREIGN KEY ("usuarioId")  REFERENCES "Usuario"("id")  ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "MiembroGrupo_programaId_usuarioId_key" ON "MiembroGrupo"("programaId", "usuarioId");
CREATE INDEX        "MiembroGrupo_grupoId_idx"              ON "MiembroGrupo"("grupoId");
CREATE INDEX        "MiembroGrupo_usuarioId_idx"            ON "MiembroGrupo"("usuarioId");

-- Asistencia
CREATE TABLE "Asistencia" (
  "id"        TEXT PRIMARY KEY,
  "sesionId"  TEXT NOT NULL,
  "usuarioId" TEXT NOT NULL,
  "presente"  BOOLEAN NOT NULL DEFAULT false,
  "nota"      TEXT,
  "registradoPorId" TEXT, -- §7 attendance.recorded_by (RF-19)
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Asistencia_sesionId_fkey"       FOREIGN KEY ("sesionId")       REFERENCES "Sesion"("id")  ON DELETE CASCADE  ON UPDATE CASCADE,
  CONSTRAINT "Asistencia_usuarioId_fkey"      FOREIGN KEY ("usuarioId")      REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Asistencia_registradoPorId_fkey" FOREIGN KEY ("registradoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "Asistencia_sesionId_usuarioId_key" ON "Asistencia"("sesionId", "usuarioId");
CREATE INDEX        "Asistencia_usuarioId_idx"          ON "Asistencia"("usuarioId");

-- ObservacionFacilitador
CREATE TABLE "ObservacionFacilitador" (
  "id"           TEXT PRIMARY KEY,
  "programaId"   TEXT NOT NULL,
  "sesionId"     TEXT,
  "usuarioId"    TEXT,
  "grupoId"      TEXT,
  "autorId"      TEXT NOT NULL,
  "tipo"         "TipoObservacion" NOT NULL,
  "urgencia"     "NivelUrgencia"   NOT NULL DEFAULT 'normal',
  "texto"        TEXT NOT NULL,
  "notificadoEn" TIMESTAMP(3),
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ObservacionFacilitador_programaId_fkey" FOREIGN KEY ("programaId") REFERENCES "Programa"("id") ON DELETE CASCADE  ON UPDATE CASCADE,
  CONSTRAINT "ObservacionFacilitador_sesionId_fkey"   FOREIGN KEY ("sesionId")   REFERENCES "Sesion"("id")   ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "ObservacionFacilitador_usuarioId_fkey"  FOREIGN KEY ("usuarioId")  REFERENCES "Usuario"("id")  ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "ObservacionFacilitador_grupoId_fkey"    FOREIGN KEY ("grupoId")    REFERENCES "Grupo"("id")    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "ObservacionFacilitador_autorId_fkey"    FOREIGN KEY ("autorId")    REFERENCES "Usuario"("id")  ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "ObservacionFacilitador_programaId_urgencia_idx" ON "ObservacionFacilitador"("programaId", "urgencia");
CREATE INDEX "ObservacionFacilitador_usuarioId_idx"           ON "ObservacionFacilitador"("usuarioId");
CREATE INDEX "ObservacionFacilitador_autorId_idx"             ON "ObservacionFacilitador"("autorId"); -- RF-41

-- MagicLink
CREATE TABLE "MagicLink" (
  "id"                TEXT PRIMARY KEY,
  "tokenHash"         TEXT NOT NULL,
  "usuarioId"         TEXT NOT NULL,
  "email"             TEXT NOT NULL,
  "propositoRedirect" TEXT,
  "expiraEn"          TIMESTAMP(3) NOT NULL,
  "usadoEn"           TIMESTAMP(3),
  "ipCreacion"        TEXT,
  "ipUso"             TEXT,
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MagicLink_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "MagicLink_tokenHash_key"       ON "MagicLink"("tokenHash");
CREATE INDEX        "MagicLink_usuarioId_usadoEn_idx" ON "MagicLink"("usuarioId", "usadoEn");
CREATE INDEX        "MagicLink_expiraEn_idx"        ON "MagicLink"("expiraEn");

-- Notificaciones (RNF-12 tracking + RF-40 destinatarios configurables)
CREATE TYPE "TipoNotificacion" AS ENUM ('invitacion_participante', 'material_disponible', 'diagnostico_habilitado', 'feedback_habilitado', 'observacion_normal', 'observacion_urgente', 'invitacion_usuario_cliente', 'magic_link');
CREATE TYPE "EstadoEnvio"      AS ENUM ('pendiente', 'enviada', 'fallida');

CREATE TABLE "NotificacionEmail" (
  "id"                 TEXT PRIMARY KEY,
  "tipo"               "TipoNotificacion" NOT NULL,
  "destinatario"       TEXT NOT NULL,
  "asunto"             TEXT NOT NULL,
  "estado"             "EstadoEnvio" NOT NULL DEFAULT 'pendiente',
  "proveedorMessageId" TEXT,
  "error"              TEXT,
  "intentos"           INTEGER NOT NULL DEFAULT 0,
  "programaId"         TEXT,      -- soft ref (sin FK: tabla de log)
  "usuarioId"          TEXT,      -- soft ref
  "observacionId"      TEXT,      -- soft ref
  "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "enviadoEn"          TIMESTAMP(3),
  "updatedAt"          TIMESTAMP(3) NOT NULL
);
CREATE INDEX "NotificacionEmail_estado_idx"          ON "NotificacionEmail"("estado");
CREATE INDEX "NotificacionEmail_tipo_createdAt_idx"  ON "NotificacionEmail"("tipo", "createdAt");
CREATE INDEX "NotificacionEmail_programaId_idx"      ON "NotificacionEmail"("programaId");

CREATE TABLE "ConfiguracionNotificacion" (
  "id"          TEXT PRIMARY KEY,
  "clave"       TEXT NOT NULL,
  "emails"      TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "descripcion" TEXT,
  "updatedAt"   TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "ConfiguracionNotificacion_clave_key" ON "ConfiguracionNotificacion"("clave");
