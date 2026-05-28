-- Cleanup: si existían columnas de la iteración previa (a nivel paso), las quitamos.
ALTER TABLE "PasoPlantilla" DROP COLUMN IF EXISTS "subirArchivoS3";
ALTER TABLE "PasoActividad" DROP COLUMN IF EXISTS "subirArchivoS3";

-- AlterTable: el flag vive a nivel pregunta (junto a soloArchivo / permitirArchivo).
ALTER TABLE "PreguntaPlantilla" ADD COLUMN "subirArchivoS3" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "PreguntaActividad" ADD COLUMN "subirArchivoS3" BOOLEAN NOT NULL DEFAULT false;
