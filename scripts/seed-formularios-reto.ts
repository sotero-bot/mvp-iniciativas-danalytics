/**
 * Seed de los templates GLOBALES de la Fase 3 "Reto con IA" (RF-30/RF-31):
 *
 *   - "Bitácora del proyecto con IA"  → tipoFormulario=bitacora
 *   - "Plantilla del proyecto con IA" → tipoFormulario=plantilla_proyecto
 *
 * Réplica de los documentos reales de `_tareas_realizar/formularios/`
 * (`Plantilla_Bitácora del proyecto.docx` y `Plantilla Proyecto AI.docx`),
 * adaptada al modelo de datos del form builder:
 *
 *   - Crea PlantillaFormulario globales (programaId=null). Al activar un
 *     programa, el snapshot RF-46 las copia automáticamente y el grupo las
 *     responde vía /grupos/:id/bitacora y /grupos/:id/plantilla-proyecto.
 *   - El registro de iteraciones de la bitácora es UN `grupo_repetible` cuyos
 *     hijos (campoPadreId) son los campos de cada iteración (§2.0, RF-30).
 *   - Las tablas del documento (insumos, plan de próximos pasos, integrantes)
 *     son campos `tipo=tabla` con `configJson.columnas` (filas dinámicas, RF-31).
 *   - Los encabezados del documento viajan como `configJson.seccion` en el
 *     PRIMER campo de cada bloque (§2.0 #3: agrupador visual, no tabla nueva).
 *   - Los valores calculados del documento (diferencia por ejecución, ahorro
 *     anual = c×d) no existen en el builder: quedan como `numero` opcionales
 *     con la fórmula en la descripción (mismo criterio que las ramas
 *     condicionales del seed del diagnóstico).
 *   - Sin `dimension` ni `score`: son formularios grupales, no puntúan (RF-29
 *     aplica solo a diagnóstico/feedback).
 *
 * Idempotente POR TIPO: si ya existe un template global ACTIVO de un tipo,
 * ese tipo se salta sin tocar nada (edítalo o duplícalo desde /admin/formularios).
 *
 * Manual: npm run seed:formularios-reto
 */

import { PrismaClient, Prisma, TipoCampo, TipoFormulario } from '@prisma/client';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

export interface CampoSeed {
  tipoCampo: TipoCampo;
  etiqueta: string;
  descripcion?: string;
  esObligatorio?: boolean;
  configJson?: Record<string, unknown>;
  /** Solo para grupo_repetible: campos de cada iteración (campoPadreId). */
  hijos?: CampoSeed[];
}

export interface PlantillaSeed {
  tipoFormulario: TipoFormulario;
  nombre: string;
  descripcion: string;
  campos: CampoSeed[];
}

// ── Bitácora del proyecto (RF-30) ──────────────────────────────────────────

export const BITACORA: PlantillaSeed = {
  tipoFormulario: 'bitacora',
  nombre: 'Bitácora del proyecto con IA',
  descripcion:
    'Este documento es la bitácora de trabajo del equipo: aquí se registran las iteraciones que ' +
    'se realizan alrededor del proyecto. Se recomienda hacer al menos tres intentos diferentes ' +
    'antes de la segunda sesión, pero pueden ser más. Muy importante: este es un proceso ' +
    'iterativo, no se espera perfección en el primer intento. Al contrario: se espera que prueben ' +
    'varias veces, que documenten los errores y que lleguen a la segunda sesión con diferentes ' +
    'intentos. De esta manera podrán recibir una retroalimentación mucho más útil y aprovechar al ' +
    'máximo los 30 minutos de mentoría que tendrá cada equipo.',
  campos: [
    {
      tipoCampo: 'grupo_repetible',
      etiqueta: 'Registro de iteraciones',
      descripcion: 'Cada vez que prueben un prompt, deben registrarlo aquí.',
      esObligatorio: true,
      configJson: { seccion: 'Registro de iteraciones' },
      hijos: [
        {
          tipoCampo: 'texto_largo',
          etiqueta: 'Prompt',
          descripcion: 'Escribe aquí el prompt completo que usaste en este intento.',
          esObligatorio: true,
        },
        {
          tipoCampo: 'texto_largo',
          etiqueta: 'Evaluación del resultado',
          descripcion: '¿Se aproximó al objetivo o estuvo lejos? Describe brevemente.',
        },
        {
          tipoCampo: 'texto_largo',
          etiqueta: 'Problemas detectados',
          descripcion: '¿Qué falló o qué no cumplió con lo esperado? Sé lo más detallado posible.',
        },
        {
          tipoCampo: 'texto_largo',
          etiqueta: 'Ajustes para la siguiente iteración',
          descripcion: '¿Qué vas a cambiar en el próximo intento y por qué?',
        },
        { tipoCampo: 'texto_corto', etiqueta: 'IA generativa utilizada' },
      ],
    },
    {
      tipoCampo: 'numero',
      etiqueta: 'Esta es la iteración #',
      descripcion:
        'Número de iteración a la que corresponden los insumos y salidas de esta sección.',
      configJson: { seccion: 'Última iteración', min: 1 },
    },
    {
      tipoCampo: 'tabla',
      etiqueta: 'Insumos (archivos cargados al prompt)',
      descripcion:
        'Agrega filas si tienes más insumos. Si no cambiaron, escribe «Mismos insumos que ' +
        'iteración anterior».',
      configJson: {
        columnas: [
          'Archivo',
          'Hipervínculo',
          '¿Has realizado cambios a los insumos respecto a la primera iteración?',
          '¿Cuáles cambios?',
        ],
      },
    },
    {
      tipoCampo: 'texto_corto',
      etiqueta: 'Hipervínculo a la salida obtenida',
      descripcion: 'Pega aquí el enlace al archivo tal como lo devolvió la IA.',
      configJson: { seccion: 'Salida obtenida' },
    },
    { tipoCampo: 'texto_corto', etiqueta: 'Nombre del archivo de salida' },
    {
      tipoCampo: 'texto_corto',
      etiqueta: 'Hipervínculo a la salida real',
      descripcion: 'Si aplica: pega aquí el enlace al archivo real esperado.',
      configJson: { seccion: 'Salida real (si aplica)' },
    },
    { tipoCampo: 'texto_corto', etiqueta: 'Nombre del archivo de salida real' },
  ],
};

// ── Plantilla del proyecto (RF-31) ─────────────────────────────────────────

export const PLANTILLA_PROYECTO: PlantillaSeed = {
  tipoFormulario: 'plantilla_proyecto',
  nombre: 'Plantilla del proyecto con IA',
  descripcion:
    'Documento donde el equipo consolida su proyecto con IA: qué problema resuelve, cómo usó la ' +
    'IA generativa, el impacto obtenido y los próximos pasos.',
  campos: [
    {
      tipoCampo: 'texto_corto',
      etiqueta: 'Nombre del proyecto',
      esObligatorio: true,
      configJson: { seccion: 'Datos del proyecto' },
    },
    {
      tipoCampo: 'texto_largo',
      etiqueta: 'Importancia del proyecto',
      descripcion: 'Dos o tres párrafos que describan la importancia del proyecto.',
      esObligatorio: true,
      configJson: { seccion: 'Importancia del proyecto' },
    },
    {
      tipoCampo: 'texto_largo',
      etiqueta: 'Situación actual',
      descripcion: 'Dos o tres párrafos que describan la situación actual.',
      esObligatorio: true,
      configJson: { seccion: 'Situación actual' },
    },
    {
      tipoCampo: 'texto_corto',
      etiqueta: 'Link con el prompt',
      esObligatorio: true,
      configJson: { seccion: 'Uso de la IA' },
    },
    { tipoCampo: 'texto_largo', etiqueta: 'Ejemplo de entrada' },
    { tipoCampo: 'texto_largo', etiqueta: 'Ejemplo de salida' },
    { tipoCampo: 'texto_corto', etiqueta: 'Herramientas de IA utilizadas' },
    {
      tipoCampo: 'numero',
      etiqueta: 'Tiempo promedio que tomaba antes (horas por ejecución)',
      descripcion:
        'Compara el escenario sin uso de IA generativa contra el escenario con ella.',
      esObligatorio: true,
      configJson: { seccion: 'Impacto y resultados obtenidos', min: 0 },
    },
    {
      tipoCampo: 'numero',
      etiqueta: 'Tiempo actual con IA (horas por ejecución, incluyendo validaciones)',
      esObligatorio: true,
      configJson: { min: 0 },
    },
    {
      tipoCampo: 'numero',
      etiqueta: 'Número de veces que se realiza este proceso al año',
      esObligatorio: true,
      configJson: { min: 0 },
    },
    {
      tipoCampo: 'numero',
      etiqueta: 'Ahorro anual estimado (horas)',
      descripcion:
        'Diferencia por ejecución (tiempo antes − tiempo con IA) × número de veces al año.',
      configJson: { min: 0 },
    },
    {
      tipoCampo: 'numero',
      etiqueta: 'Reducción de errores / reprocesos (%)',
      descripcion: 'Impacto cualitativo adicional (opcional).',
      configJson: { min: 0, max: 100 },
    },
    {
      tipoCampo: 'numero',
      etiqueta: 'Mejora en velocidad de respuesta o entrega (%)',
      descripcion: 'Impacto cualitativo adicional (opcional).',
      configJson: { min: 0, max: 100 },
    },
    {
      tipoCampo: 'texto_largo',
      etiqueta: 'Comentario libre sobre el cambio observado',
      descripcion:
        'Por ejemplo: mayor satisfacción del cliente interno o externo.',
    },
    {
      tipoCampo: 'texto_largo',
      etiqueta: 'Aprendizajes del proyecto',
      descripcion:
        'Guía de inspiración (no es necesario cubrir todos los aspectos): principales ' +
        'descubrimientos sobre el uso de IA (qué tareas se automatizan mejor, cómo formular el ' +
        'prompt, qué errores evitar); nuevas habilidades adquiridas (estructurar prompts, validar ' +
        'información, integrar IA en flujos de trabajo); impacto en la mentalidad del equipo ' +
        '(superación del miedo a la IA, curiosidad, confianza para experimentar).',
      esObligatorio: true,
      configJson: { seccion: 'Aprendizajes del proyecto' },
    },
    {
      tipoCampo: 'texto_largo',
      etiqueta: 'Próximos pasos',
      descripcion:
        'Cuáles van a ser los próximos pasos del equipo para mantener el impacto y seguir ' +
        'escalando la IA en su área. Preguntas guía (no es necesario responderlas todas): qué ' +
        'acciones van a mantener o replicar; qué nuevas oportunidades identifican para aplicar ' +
        'IA; qué apoyo o entrenamiento adicional sería útil.',
      esObligatorio: true,
      configJson: { seccion: 'Próximos pasos' },
    },
    {
      tipoCampo: 'tabla',
      etiqueta: 'Plan de próximos pasos',
      descripcion:
        'Ejemplo: 1 · Documentar el prompt final y compartirlo en repositorio interno · Semana 1 ' +
        '· Prompt disponible y validado por el área.',
      configJson: {
        columnas: ['Paso', 'Responsable', 'Actividad', 'Tiempo estimado', 'Indicador de éxito'],
      },
    },
  ],
};

export const PLANTILLAS: PlantillaSeed[] = [BITACORA, PLANTILLA_PROYECTO];

async function seedPlantilla(seed: PlantillaSeed): Promise<void> {
  const existente = await prisma.plantillaFormulario.findFirst({
    where: { programaId: null, tipoFormulario: seed.tipoFormulario, activa: true },
    include: { _count: { select: { campos: true } } },
  });
  if (existente) {
    console.log(
      `⚠️  Ya existe un template global activo de tipo ${seed.tipoFormulario}:\n` +
        `    "${existente.nombre}" (v${existente.version}, ${existente._count.campos} campos, id=${existente.id}).\n` +
        `    No se creó nada. Edítalo o duplícalo desde /admin/formularios.`,
    );
    return;
  }

  const plantilla = await prisma.$transaction(async (tx) => {
    const creada = await tx.plantillaFormulario.create({
      data: {
        id: randomUUID(),
        programaId: null,
        tipoFormulario: seed.tipoFormulario,
        nombre: seed.nombre,
        descripcion: seed.descripcion,
        activa: true,
      },
    });
    let orden = 1;
    const crearCampo = async (campo: CampoSeed, campoPadreId: string | null) => {
      const fila = await tx.campoFormulario.create({
        data: {
          id: randomUUID(),
          plantillaId: creada.id,
          campoPadreId,
          tipoCampo: campo.tipoCampo,
          etiqueta: campo.etiqueta,
          descripcion: campo.descripcion ?? null,
          esObligatorio: campo.esObligatorio ?? false,
          orden: orden++,
          configJson: (campo.configJson ?? {}) as Prisma.InputJsonValue,
        },
      });
      for (const hijo of campo.hijos ?? []) await crearCampo(hijo, fila.id);
    };
    for (const campo of seed.campos) await crearCampo(campo, null);
    return creada;
  });

  const total = seed.campos.reduce((n, c) => n + 1 + (c.hijos?.length ?? 0), 0);
  console.log(`✅  Template "${seed.nombre}" creado (tipo ${seed.tipoFormulario})`);
  console.log(`    id:     ${plantilla.id}`);
  console.log(`    campos: ${total}`);
}

async function main() {
  console.log('🌱  Seed: templates globales del Reto con IA (bitácora + plantilla del proyecto)');
  for (const seed of PLANTILLAS) await seedPlantilla(seed);
  console.log('    Revísalos en /admin/formularios. Se snapshotean al activar cada programa (RF-46).');
}

// Bajo vitest solo se importan las definiciones (validación de configs);
// el seed real corre únicamente vía `npm run seed:formularios-reto`.
if (!process.env.VITEST) {
  main()
    .catch(err => {
      console.error('❌  Seed formularios del reto falló:', err);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
