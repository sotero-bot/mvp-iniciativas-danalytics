/**
 * Carga traducciones de contenido del taller desde un JSON estructurado.
 *
 * El JSON sigue la misma forma que data-mapa-oportunidades.json / data-canvas.json,
 * con un campo "locale" y "nombre_original" en la raíz de cada plantilla.
 * La coincidencia con la BD se hace por: plantilla.nombre → paso.orden → pregunta.orden.
 *
 * Uso:
 *   npx tsx scripts/load-translations-from-json.ts <ruta-al-json>
 *
 * Ejemplo:
 *   npx tsx scripts/load-translations-from-json.ts _tareas_realizar/data-mapa-oportunidades-pt.json
 *   npx tsx scripts/load-translations-from-json.ts _tareas_realizar/data-canvas-pt.json
 */
import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface PreguntaInput {
  orden: number;
  enunciado?: string;
  promptIa?: string;
}

interface PasoInput {
  orden: number;
  titulo?: string;
  objetivo?: string;
  instrucciones?: string;
  promptIa?: string;
  preguntas?: PreguntaInput[];
}

interface PlantillaInput {
  locale: string;
  nombre_original: string;
  nombre?: string;
  descripcion?: string;
  pasos?: PasoInput[];
}

async function upsertTranslation(
  entityType: string,
  entityId: string,
  field: string,
  locale: string,
  value: string | undefined,
) {
  if (!value || value.trim() === '') return;
  await prisma.translation.upsert({
    where: { entityType_entityId_field_locale: { entityType, entityId, field, locale } },
    create: { entityType, entityId, field, locale, value: value.trim() },
    update: { value: value.trim() },
  });
}

async function loadTranslations(jsonPath: string) {
  const fullPath = path.resolve(process.cwd(), jsonPath);
  if (!fs.existsSync(fullPath)) {
    console.error(`❌ Archivo no encontrado: ${fullPath}`);
    process.exit(1);
  }

  const data: PlantillaInput[] = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
  let total = 0;

  for (const plantillaInput of data) {
    const locale = plantillaInput.locale;
    if (!locale) { console.warn('⚠️  Falta campo "locale" en plantilla, saltando.'); continue; }

    // Buscar la plantilla por nombre original
    const plantilla = await prisma.plantillaActividad.findFirst({
      where: { nombre: plantillaInput.nombre_original, activo: true },
      include: {
        pasos: {
          where: { activo: true },
          orderBy: { orden: 'asc' },
          include: { preguntas: { where: { activo: true }, orderBy: { orden: 'asc' } } },
        },
      },
    });

    if (!plantilla) {
      console.warn(`⚠️  Plantilla no encontrada: "${plantillaInput.nombre_original}"`);
      continue;
    }

    console.log(`\n📋 Plantilla: "${plantilla.nombre}" (locale: ${locale})`);

    // Traducción del nombre/descripción de la plantilla
    if (plantillaInput.nombre) {
      await upsertTranslation('PlantillaActividad', plantilla.id, 'nombre', locale, plantillaInput.nombre);
      total++;
    }
    if (plantillaInput.descripcion) {
      await upsertTranslation('PlantillaActividad', plantilla.id, 'descripcion', locale, plantillaInput.descripcion);
      total++;
    }

    // Pasos
    const pasoMap = new Map(plantilla.pasos.map(p => [p.orden, p]));

    for (const pasoInput of plantillaInput.pasos ?? []) {
      const paso = pasoMap.get(pasoInput.orden);
      if (!paso) {
        console.warn(`  ⚠️  Paso orden ${pasoInput.orden} no encontrado en BD, saltando.`);
        continue;
      }

      const pasoCampos = [
        ['titulo', pasoInput.titulo],
        ['objetivo', pasoInput.objetivo],
        ['instrucciones', pasoInput.instrucciones],
        ['promptIa', pasoInput.promptIa],
      ] as const;

      let pasoCount = 0;
      for (const [field, value] of pasoCampos) {
        if (value) {
          await upsertTranslation('PasoPlantilla', paso.id, field, locale, value);
          pasoCount++;
          total++;
        }
      }
      console.log(`  ✅ Paso ${pasoInput.orden} "${pasoInput.titulo ?? paso.titulo}" — ${pasoCount} campo(s)`);

      // Preguntas
      const preguntaMap = new Map(paso.preguntas.map(q => [q.orden, q]));

      for (const preguntaInput of pasoInput.preguntas ?? []) {
        const pregunta = preguntaMap.get(preguntaInput.orden);
        if (!pregunta) {
          console.warn(`     ⚠️  Pregunta orden ${preguntaInput.orden} no encontrada, saltando.`);
          continue;
        }

        let pregCount = 0;
        if (preguntaInput.enunciado) {
          await upsertTranslation('PreguntaPlantilla', pregunta.id, 'enunciado', locale, preguntaInput.enunciado);
          pregCount++;
          total++;
        }
        if (preguntaInput.promptIa) {
          await upsertTranslation('PreguntaPlantilla', pregunta.id, 'promptIa', locale, preguntaInput.promptIa);
          pregCount++;
          total++;
        }
        if (pregCount > 0) {
          console.log(`     ✅ Pregunta ${preguntaInput.orden} — ${pregCount} campo(s)`);
        }
      }
    }
  }

  console.log(`\n🎉 Total: ${total} traduccion(es) insertadas/actualizadas.`);
}

const jsonPath = process.argv[2];
if (!jsonPath) {
  console.error('Uso: npx tsx scripts/load-translations-from-json.ts <ruta-al-json>');
  process.exit(1);
}

loadTranslations(jsonPath)
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
