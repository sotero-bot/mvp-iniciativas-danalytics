/**
 * Migración one-off: recalcula `scoresPorDimensionJson` de las respuestas ya
 * enviadas con el nuevo esquema separado por categoría.
 *
 * Antes, todas las dimensiones vivían en un único objeto plano
 * (`{ [dimension]: ScoreDimension }`), mezclando preguntas likert/número con
 * preguntas de opción múltiple bajo el mismo promedio. Ahora
 * `calcularScoresPorDimension` devuelve `{ escala, seleccion }` — dos objetos
 * separados que nunca se combinan (decisión de producto: escala y selección
 * no son comparables en un mismo número).
 *
 * Sin esta migración, las respuestas enviadas ANTES del cambio quedarían con
 * el esquema viejo y desaparecerían de los agregados (que ahora leen
 * `scores.escala`/`scores.seleccion`, no las claves de dimensión directas).
 *
 * Idempotente: recalcula siempre desde `datosRespuestaJson` + la config actual
 * de campos, así que correrlo dos veces no duplica ni corrompe nada.
 *
 * Manual, una sola vez tras el deploy: npx tsx scripts/migrate-scores-por-categoria.ts
 */
import { PrismaClient, Prisma } from '@prisma/client';
import {
  calcularScoresPorDimension,
  CampoParaScoring,
} from '../apps/api/src/modules/formularios/application/scoring';

const prisma = new PrismaClient();

async function main() {
  const respuestas = await prisma.respuestaFormulario.findMany({
    where: { estado: 'submitted' },
    select: { id: true, plantillaId: true, datosRespuestaJson: true },
  });
  console.log(`Respuestas enviadas encontradas: ${respuestas.length}`);

  const plantillaIds = [...new Set(respuestas.map(r => r.plantillaId))];
  const campos = await prisma.campoFormulario.findMany({
    where: { plantillaId: { in: plantillaIds } },
    select: { id: true, plantillaId: true, tipoCampo: true, dimension: true, configJson: true },
  });
  const camposPorPlantilla = new Map<string, CampoParaScoring[]>();
  for (const c of campos) {
    const arr = camposPorPlantilla.get(c.plantillaId) ?? [];
    arr.push({ id: c.id, tipoCampo: c.tipoCampo, dimension: c.dimension, configJson: c.configJson });
    camposPorPlantilla.set(c.plantillaId, arr);
  }

  let actualizadas = 0;
  for (const r of respuestas) {
    const camposDePlantilla = camposPorPlantilla.get(r.plantillaId) ?? [];
    const datos = (r.datosRespuestaJson ?? {}) as Record<string, unknown>;
    const scores = calcularScoresPorDimension(camposDePlantilla, datos);
    await prisma.respuestaFormulario.update({
      where: { id: r.id },
      data: { scoresPorDimensionJson: scores as unknown as Prisma.InputJsonValue },
    });
    actualizadas++;
  }

  console.log(`Listo: ${actualizadas} respuesta(s) recalculada(s).`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
