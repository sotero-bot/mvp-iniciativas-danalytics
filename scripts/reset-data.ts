/**
 * Borra todos los datos excepto los registros de Admin.
 * Orden de borrado respeta las FK del schema.
 *
 * Uso:
 *   npx ts-node -e "require('./scripts/reset-data.ts')"
 *   — o —
 *   npx tsx scripts/reset-data.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🗑  Iniciando limpieza de datos (Admin conservado)...\n');

  const respuestas       = await prisma.respuesta.deleteMany();
  console.log(`  Respuestas eliminadas      : ${respuestas.count}`);

  const interacciones    = await prisma.interaccion.deleteMany();
  console.log(`  Interacciones eliminadas   : ${interacciones.count}`);

  const instancias       = await prisma.instanciaActividad.deleteMany();
  console.log(`  Instancias eliminadas      : ${instancias.count}`);

  const enlaces          = await prisma.enlaceActividad.deleteMany();
  console.log(`  EnlaceActividad eliminados : ${enlaces.count}`);

  const preguntaActividad = await prisma.preguntaActividad.deleteMany();
  console.log(`  PreguntaActividad eliminadas: ${preguntaActividad.count}`);

  const pasoActividad    = await prisma.pasoActividad.deleteMany();
  console.log(`  PasoActividad eliminados   : ${pasoActividad.count}`);

  const actividades      = await prisma.actividad.deleteMany();
  console.log(`  Actividades eliminadas     : ${actividades.count}`);

  const preguntaPlantilla = await prisma.preguntaPlantilla.deleteMany();
  console.log(`  PreguntaPlantilla eliminadas: ${preguntaPlantilla.count}`);

  const pasoPlantilla    = await prisma.pasoPlantilla.deleteMany();
  console.log(`  PasoPlantilla eliminados   : ${pasoPlantilla.count}`);

  const plantillas       = await prisma.plantillaActividad.deleteMany();
  console.log(`  PlantillaActividad elim.   : ${plantillas.count}`);

  const iniciativas      = await prisma.iniciativa.deleteMany();
  console.log(`  Iniciativas eliminadas     : ${iniciativas.count}`);

  const usuarios         = await prisma.usuario.deleteMany({
    where: { role: { slug: { not: 'danalytics_admin' } } },
  });
  console.log(`  Usuarios eliminados        : ${usuarios.count}`);

  const empresas         = await prisma.empresa.deleteMany();
  console.log(`  Empresas eliminadas        : ${empresas.count}`);

  const admins = await prisma.usuario.findMany({
    where: { role: { slug: 'danalytics_admin' } },
    select: { username: true },
  });
  console.log(`\n✅ Listo. Admins conservados: ${admins.map(a => a.username).join(', ')}`);
}

main()
  .catch(e => { console.error('❌ Error:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
