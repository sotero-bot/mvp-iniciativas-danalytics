-- CreateTable
CREATE TABLE "InstanciaActividad" (
    "id" TEXT NOT NULL,
    "actividadId" TEXT NOT NULL,
    "usuarioId" TEXT,
    "accessToken" TEXT NOT NULL,
    "estado" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "fechaInicio" TIMESTAMP(3),
    "fechaFin" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "emailReferencia" TEXT,

    CONSTRAINT "InstanciaActividad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Interaccion" (
    "id" TEXT NOT NULL,
    "instanciaId" TEXT NOT NULL,
    "pasoId" TEXT NOT NULL,
    "contenido" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Interaccion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Empresa" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Empresa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Iniciativa" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "empresaId" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Iniciativa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Actividad" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'inactiva',
    "iniciativaId" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Actividad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EnlaceActividad" (
    "id" TEXT NOT NULL,
    "actividadId" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "nombre" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EnlaceActividad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasoActividad" (
    "id" TEXT NOT NULL,
    "actividadId" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "objetivo" TEXT,
    "instrucciones" TEXT,
    "promptIa" TEXT,
    "usarIa" BOOLEAN NOT NULL DEFAULT false,
    "orden" INTEGER NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PasoActividad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Usuario" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "email" TEXT,
    "cargo" TEXT,
    "empresaId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'activo',

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Admin" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Admin_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InstanciaActividad_accessToken_key" ON "InstanciaActividad"("accessToken");

-- CreateIndex
CREATE INDEX "Interaccion_pasoId_idx" ON "Interaccion"("pasoId");

-- CreateIndex
CREATE UNIQUE INDEX "EnlaceActividad_accessToken_key" ON "EnlaceActividad"("accessToken");

-- CreateIndex
CREATE INDEX "PasoActividad_actividadId_idx" ON "PasoActividad"("actividadId");

-- CreateIndex
CREATE UNIQUE INDEX "PasoActividad_actividadId_orden_key" ON "PasoActividad"("actividadId", "orden");

-- CreateIndex
CREATE UNIQUE INDEX "Admin_username_key" ON "Admin"("username");

-- AddForeignKey
ALTER TABLE "InstanciaActividad" ADD CONSTRAINT "InstanciaActividad_actividadId_fkey" FOREIGN KEY ("actividadId") REFERENCES "Actividad"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstanciaActividad" ADD CONSTRAINT "InstanciaActividad_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Interaccion" ADD CONSTRAINT "Interaccion_instanciaId_fkey" FOREIGN KEY ("instanciaId") REFERENCES "InstanciaActividad"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Interaccion" ADD CONSTRAINT "Interaccion_pasoId_fkey" FOREIGN KEY ("pasoId") REFERENCES "PasoActividad"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Iniciativa" ADD CONSTRAINT "Iniciativa_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Actividad" ADD CONSTRAINT "Actividad_iniciativaId_fkey" FOREIGN KEY ("iniciativaId") REFERENCES "Iniciativa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnlaceActividad" ADD CONSTRAINT "EnlaceActividad_actividadId_fkey" FOREIGN KEY ("actividadId") REFERENCES "Actividad"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasoActividad" ADD CONSTRAINT "PasoActividad_actividadId_fkey" FOREIGN KEY ("actividadId") REFERENCES "Actividad"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Usuario" ADD CONSTRAINT "Usuario_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
