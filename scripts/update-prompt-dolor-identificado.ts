/**
 * Actualiza el promptIa del paso IA automático del taller "Mapa de Oportunidades"
 * para todos los pasoActividad existentes en la DB.
 *
 * Uso:
 *   npx tsx scripts/update-prompt-dolor-identificado.ts
 */

import { PrismaClient } from '@prisma/client';
import data from '../_tareas_realizar/data-mapa-oportunidades.json';

const prisma = new PrismaClient();

async function main() {
  const pasoIa = data[0].pasos.find((p: any) => p.usarIa && p.iaAutomatica);
  if (!pasoIa?.promptIa) {
    console.error('No se encontró el paso IA automático en el JSON');
    process.exit(1);
  }

  const nuevoPrompt = pasoIa.promptIa;

  // Actualiza todos los pasoActividad que sean iaAutomatica y tengan el prompt viejo
  // (identifica por la presencia de "Dolor identificado" sin la instrucción nueva)
  const result = await prisma.pasoActividad.updateMany({
    where: {
      iaAutomatica: true,
      promptIa: { contains: 'Dolor identificado' },
      NOT: { promptIa: { contains: 'copia textualmente' } },
    },
    data: { promptIa: nuevoPrompt },
  });

  console.log(`✓ ${result.count} pasoActividad actualizado(s) con el nuevo promptIa`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
