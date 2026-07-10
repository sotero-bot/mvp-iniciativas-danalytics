/**
 * Seed del template GLOBAL "Diagnóstico inicial" (Fase 2, RF-22/24/25/26).
 *
 * Réplica del Google Form real "Encuesta de inicio sobre el Uso de IA Generativa"
 * (https://docs.google.com/forms/d/e/1FAIpQLSc3Ec5-D-rop_iwyyTsKDMoLO7PuhwiabtPKM3mg0t-cOyeMQ/viewform),
 * adaptada al modelo de datos del form builder:
 *
 *   - Crea UNA PlantillaFormulario global (programaId=null, tipo=diagnostico_inicial).
 *     Al activar un programa, el snapshot RF-46 la copia automáticamente.
 *   - Las secciones del Google Form viajan como `configJson.seccion` en el PRIMER
 *     campo de cada bloque (§2.0 #3: agrupador visual, no tabla nueva).
 *   - Checkboxes = `opcion_multiple` + `{"multiple": true}` (§2.0 #2).
 *   - Los `score` de las preguntas ordinales viven en `configJson` (solo admin,
 *     RNF-04/RN-02) y alimentan `scoresPorDimensionJson` al enviar (RF-29).
 *   - El Google Form tiene ramas condicionales (p. ej. "si no has usado Gemini");
 *     el builder no tiene branching, así que esas preguntas quedan como opcionales
 *     con la aclaración "si aplica" en la descripción.
 *   - Identidad (correo/nombre/cargo): OMITIDA por defecto — la respuesta ya queda
 *     ligada al usuario autenticado (usuarioRespondienteId) que tiene nombre/cargo
 *     en su perfil. Usa `--con-datos-personales` para replicarlas literalmente.
 *
 * Idempotente: si ya existe un template global ACTIVO de tipo diagnostico_inicial,
 * aborta sin tocar nada (edítalo o duplícalo desde /admin/formularios).
 *
 * Manual: npm run seed:diagnostico-inicial [-- --con-datos-personales]
 */

import { PrismaClient, Prisma, TipoCampo } from '@prisma/client';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

const CON_DATOS_PERSONALES = process.argv.includes('--con-datos-personales');

const NOMBRE_PLANTILLA = 'Encuesta de inicio sobre el Uso de IA Generativa';
const DESCRIPCION_PLANTILLA =
  '¡Hola! La inteligencia artificial está revolucionando la forma en que trabajamos y queremos que ' +
  'aproveches al máximo este programa. Antes de comenzar, nos gustaría conocer un poco más sobre tu ' +
  'experiencia con herramientas de IA generativa. Te tomará alrededor de 7 minutos.';

export interface CampoSeed {
  tipoCampo: TipoCampo;
  etiqueta: string;
  descripcion?: string;
  dimension?: string;
  esObligatorio?: boolean;
  configJson?: Record<string, unknown>;
}

// Escala 1–5 del formulario original ("Nada en absoluto" → "Totalmente").
const LIKERT_1_5 = { min: 1, max: 5, etiquetaMin: 'Nada en absoluto', etiquetaMax: 'Totalmente' };

export const CAMPOS_IDENTIDAD: CampoSeed[] = [
  {
    tipoCampo: 'texto_corto',
    etiqueta: 'Ingresa tu correo electrónico',
    esObligatorio: true,
    configJson: { seccion: 'Datos iniciales' },
  },
  { tipoCampo: 'texto_corto', etiqueta: 'Nombre', esObligatorio: true },
  { tipoCampo: 'texto_corto', etiqueta: 'Cargo', esObligatorio: true },
];

export const CAMPOS: CampoSeed[] = [
  // ── Conociendo a los participantes ─────────────────────────────────────────
  {
    tipoCampo: 'opcion_multiple',
    etiqueta: 'Género',
    esObligatorio: true,
    configJson: {
      seccion: 'Conociendo a los participantes',
      opciones: [
        { valor: 'mujer', etiqueta: 'Mujer' },
        { valor: 'hombre', etiqueta: 'Hombre' },
        { valor: 'prefiero_no_responder', etiqueta: 'Prefiero no responder' },
      ],
    },
  },
  {
    tipoCampo: 'opcion_multiple',
    etiqueta: 'Rango de edad',
    esObligatorio: true,
    configJson: {
      opciones: [
        { valor: '21_30', etiqueta: '21 – 30 años' },
        { valor: '31_40', etiqueta: '31 – 40 años' },
        { valor: '41_50', etiqueta: '41 – 50 años' },
        { valor: '51_60', etiqueta: '51 – 60 años' },
        { valor: 'mas_60', etiqueta: 'Más de 60 años' },
      ],
    },
  },
  {
    tipoCampo: 'opcion_multiple',
    etiqueta: 'Nivel educativo alcanzado',
    esObligatorio: true,
    configJson: {
      opciones: [
        { valor: 'bachillerato', etiqueta: 'Bachillerato' },
        { valor: 'tecnico', etiqueta: 'Técnico/Tecnólogo' },
        { valor: 'pregrado', etiqueta: 'Pregrado (en curso o finalizado)' },
        { valor: 'posgrado', etiqueta: 'Posgrado (Especialización, Maestría, Doctorado)' },
      ],
    },
  },

  // ── Tu punto de partida con la IA generativa (núcleo del scoring) ─────────
  {
    tipoCampo: 'likert',
    etiqueta: '¿Qué tan claro tienes qué es la inteligencia artificial generativa y cómo funciona a nivel general?',
    dimension: 'comprension',
    esObligatorio: true,
    configJson: {
      seccion: 'Tu punto de partida con la IA generativa',
      ...LIKERT_1_5,
    },
  },
  {
    tipoCampo: 'likert',
    etiqueta: '¿Qué tan seguro(a) te sientes al dar instrucciones (prompts) para obtener resultados útiles en herramientas de IA como Gemini?',
    dimension: 'prompting',
    esObligatorio: true,
    configJson: { ...LIKERT_1_5 },
  },
  {
    tipoCampo: 'likert',
    etiqueta: '¿Qué tanto sabes cómo aplicar la IA generativa en tus tareas o responsabilidades actuales?',
    dimension: 'aplicacion',
    esObligatorio: true,
    configJson: { ...LIKERT_1_5 },
  },
  {
    tipoCampo: 'likert',
    etiqueta: '¿Qué tanto consideras que la IA generativa puede ayudarte a ahorrar tiempo y trabajar con más eficiencia?',
    dimension: 'valor_percibido',
    esObligatorio: true,
    configJson: { ...LIKERT_1_5 },
  },
  {
    tipoCampo: 'opcion_multiple',
    etiqueta: '¿Cuál de estas frases describe mejor tu nivel actual?',
    dimension: 'nivel_uso',
    esObligatorio: true,
    configJson: {
      opciones: [
        { valor: 'escuchado', etiqueta: 'He escuchado del tema, pero casi no la uso', score: 1 },
        { valor: 'probado', etiqueta: 'La he probado algunas veces', score: 2 },
        { valor: 'ocasional', etiqueta: 'La uso ocasionalmente para tareas simples (como consulta o mejorar redacción)', score: 3 },
        { valor: 'frecuente', etiqueta: 'La uso con frecuencia en tareas de trabajo', score: 4 },
        { valor: 'avanzado', etiqueta: 'La uso con frecuencia y sé ajustar mis instrucciones para obtener mejores resultados', score: 5 },
      ],
    },
  },

  // ── Conocimientos y uso actual de Gemini ───────────────────────────────────
  {
    tipoCampo: 'opcion_multiple',
    etiqueta: '¿Tienes una cuenta en Gemini empresarial?',
    esObligatorio: true,
    configJson: {
      seccion: 'Conocimientos y uso actual de Gemini',
      opciones: [
        { valor: 'si', etiqueta: 'Sí' },
        { valor: 'no', etiqueta: 'No' },
      ],
    },
  },
  {
    // Rama "sí usa Gemini" del Google Form → opcional sin branching.
    tipoCampo: 'opcion_multiple',
    etiqueta: '¿Con qué frecuencia utilizas Gemini?',
    descripcion: 'Responde solo si usas Gemini.',
    dimension: 'uso_gemini',
    configJson: {
      opciones: [
        { valor: 'copiloto', etiqueta: 'Es mi copiloto (varias veces al día)', score: 4 },
        { valor: 'frecuente', etiqueta: 'De forma frecuente (casi diaria)', score: 3 },
        { valor: 'ocasional', etiqueta: 'Ocasionalmente (1-2 veces por semana)', score: 2 },
        { valor: 'explorado', etiqueta: 'Solo he explorado alguna vez', score: 1 },
      ],
    },
  },
  {
    tipoCampo: 'opcion_multiple',
    etiqueta: '¿Para qué tipo de tareas has usado Gemini?',
    descripcion: 'Puedes marcar varias opciones.',
    configJson: {
      multiple: true,
      opciones: [
        { valor: 'redaccion', etiqueta: 'Redacción de correos o documentos' },
        { valor: 'ideas', etiqueta: 'Generación de ideas o lluvia de ideas' },
        { valor: 'analisis', etiqueta: 'Análisis de datos o reportes' },
        { valor: 'consultas', etiqueta: 'Resolución de dudas o búsqueda de información' },
        { valor: 'automatizacion', etiqueta: 'Automatización de tareas administrativas' },
        { valor: 'no_usado', etiqueta: 'No lo he usado aún' },
        { valor: 'otro', etiqueta: 'Otro' },
      ],
    },
  },
  {
    // Rama "no usa Gemini" del Google Form (ya era opcional en el original).
    tipoCampo: 'opcion_multiple',
    etiqueta: 'Si no has usado Gemini, ¿cuál es la razón principal?',
    configJson: {
      opciones: [
        { valor: 'no_conozco', etiqueta: 'No lo conozco bien' },
        { valor: 'no_se_aplicar', etiqueta: 'No sé cómo aplicarlo a mi trabajo' },
        { valor: 'seguridad', etiqueta: 'Tengo preocupaciones sobre seguridad o privacidad' },
        { valor: 'sin_tiempo', etiqueta: 'No he tenido tiempo para explorarlo' },
        { valor: 'otra_ia', etiqueta: 'Utilizo otra IA' },
        { valor: 'otro', etiqueta: 'Otro' },
      ],
    },
  },

  // ── Uso de otras IA generativas ────────────────────────────────────────────
  {
    tipoCampo: 'opcion_multiple',
    etiqueta: '¿Has usado otras herramientas de IA generativa?',
    esObligatorio: true,
    configJson: {
      seccion: 'Uso de otras IA generativas',
      opciones: [
        { valor: 'si', etiqueta: 'Sí (ChatGPT, Copilot, Grok, Midjourney, Gemini u otra)' },
        { valor: 'no', etiqueta: 'No' },
      ],
    },
  },
  {
    tipoCampo: 'opcion_multiple',
    etiqueta: '¿Cuáles herramientas de IA generativa has usado?',
    descripcion: 'Responde solo si aplica. Puedes marcar varias opciones.',
    configJson: {
      multiple: true,
      opciones: [
        { valor: 'notebooklm', etiqueta: 'NotebookLM' },
        { valor: 'chatgpt', etiqueta: 'ChatGPT' },
        { valor: 'gamma', etiqueta: 'Gamma' },
        { valor: 'grok', etiqueta: 'Grok' },
        { valor: 'gemini', etiqueta: 'Gemini' },
        { valor: 'perplexity', etiqueta: 'Perplexity' },
        { valor: 'nano_banana', etiqueta: 'Nano Banana' },
        { valor: 'veo3', etiqueta: 'Veo3' },
        { valor: 'otro', etiqueta: 'Otro' },
      ],
    },
  },
  {
    // En el Google Form era checkbox, pero las opciones son excluyentes → selección única.
    tipoCampo: 'opcion_multiple',
    etiqueta: '¿Con qué frecuencia usas herramientas de IA en tu trabajo (diferentes a Gemini)?',
    descripcion: 'Responde solo si aplica.',
    dimension: 'uso_otras_ia',
    configJson: {
      opciones: [
        { valor: 'nunca', etiqueta: 'Nunca', score: 0 },
        { valor: 'semanal', etiqueta: 'Una vez a la semana', score: 1 },
        { valor: 'ocasional', etiqueta: 'Sí, ocasionalmente (3-4 veces por semana)', score: 2 },
        { valor: 'frecuente', etiqueta: 'Sí, de forma frecuente (casi diaria)', score: 3 },
        { valor: 'copiloto', etiqueta: 'Es mi copiloto (varias veces al día)', score: 4 },
      ],
    },
  },
  {
    tipoCampo: 'opcion_multiple',
    etiqueta: '¿Para qué tipo de tareas la has usado hasta ahora?',
    descripcion: 'Responde solo si aplica. Puedes marcar varias opciones.',
    configJson: {
      multiple: true,
      opciones: [
        { valor: 'redactar', etiqueta: 'Redactar textos' },
        { valor: 'resumir', etiqueta: 'Resumir documentos' },
        { valor: 'organizar', etiqueta: 'Organizar ideas' },
        { valor: 'buscar', etiqueta: 'Buscar información' },
        { valor: 'analizar', etiqueta: 'Analizar información' },
        { valor: 'excel', etiqueta: 'Generar tablas o apoyar trabajo en Excel' },
        { valor: 'revisar', etiqueta: 'Revisar o mejorar correos / informes' },
        { valor: 'imagenes', etiqueta: 'Generar imágenes o referencias visuales' },
        { valor: 'otro', etiqueta: 'Otro' },
      ],
    },
  },

  // ── Conocimiento general IA ────────────────────────────────────────────────
  {
    tipoCampo: 'opcion_multiple',
    etiqueta: '¿Has tomado antes alguna capacitación en Inteligencia Artificial generativa?',
    esObligatorio: true,
    configJson: {
      seccion: 'Conocimiento general IA',
      opciones: [
        { valor: 'si', etiqueta: 'Sí' },
        { valor: 'no', etiqueta: 'No' },
      ],
    },
  },
  {
    tipoCampo: 'texto_largo',
    etiqueta: '¿Cuál capacitación has tomado y en qué IA generativa profundizaste?',
    descripcion: 'Responde solo si aplica.',
  },
  {
    tipoCampo: 'opcion_multiple',
    etiqueta: '¿Conoces qué es ingeniería de prompts?',
    esObligatorio: true,
    configJson: {
      opciones: [
        { valor: 'si', etiqueta: 'Sí' },
        { valor: 'no', etiqueta: 'No' },
      ],
    },
  },
  {
    tipoCampo: 'opcion_multiple',
    etiqueta: '¿Has intentado mejorar la calidad de las respuestas de la IA generativa probando diferentes formas de escribir tus preguntas?',
    dimension: 'prompting',
    esObligatorio: true,
    configJson: {
      opciones: [
        { valor: 'si_itero', etiqueta: 'Sí, pruebo distintas formas hasta obtener la mejor respuesta', score: 2 },
        { valor: 'si_a_veces', etiqueta: 'Sí, pero no siempre obtengo lo que necesito', score: 1 },
        { valor: 'no', etiqueta: 'No', score: 0 },
      ],
    },
  },
  {
    tipoCampo: 'texto_largo',
    etiqueta: 'Copia un ejemplo de un mensaje o solicitud que le hayas pedido a la IA.',
    descripcion:
      'Puede ser el que sientas que te ha sido más útil o el último que hayas utilizado. No hay correcto o ' +
      'incorrecto: solo queremos conocer cómo estás redactando los mensajes que le envías a la IA generativa ' +
      'que uses. Si aún no la usas, escribe "No aplica".',
    esObligatorio: true,
  },

  // ── Barreras o preocupaciones ──────────────────────────────────────────────
  {
    tipoCampo: 'texto_largo',
    etiqueta: '¿Tienes alguna preocupación sobre el uso de IA en tu trabajo?',
    descripcion: 'Pregunta abierta. Ejemplos: pérdida de control, calidad de resultados, ética, reemplazo laboral, etc.',
    esObligatorio: true,
    configJson: { seccion: 'Barreras o preocupaciones' },
  },
  {
    tipoCampo: 'opcion_multiple',
    etiqueta: '¿Tienes alguna prevención o duda sobre el uso de IA generativa en tu trabajo?',
    esObligatorio: true,
    configJson: {
      opciones: [
        { valor: 'seguridad', etiqueta: 'Sí, quiero entender mejor cómo afecta la seguridad y privacidad' },
        { valor: 'confiabilidad', etiqueta: 'Sí, no tengo claro qué tan confiable es la información que genera' },
        { valor: 'ajuste', etiqueta: 'Sí, me preocupa que no se ajuste a mis necesidades laborales' },
        { valor: 'ninguna', etiqueta: 'No tengo preocupaciones' },
        { valor: 'otro', etiqueta: 'Otro' },
      ],
    },
  },
  {
    tipoCampo: 'texto_largo',
    etiqueta: 'Si tuvieras que señalar un obstáculo para implementar IA generativa en tus procesos actuales, ¿cuál sería el principal?',
    esObligatorio: true,
  },
  {
    tipoCampo: 'opcion_multiple',
    etiqueta: '¿Qué tan abierta/o estás a incorporar herramientas de IA generativa en tus tareas diarias?',
    dimension: 'apertura',
    esObligatorio: true,
    configJson: {
      opciones: [
        { valor: 'muy_abierto', etiqueta: 'Muy abierta/o, me interesa aprender cómo aplicarlas', score: 4 },
        { valor: 'abierto', etiqueta: 'Abierta/o, pero necesito entender mejor sus beneficios', score: 3 },
        { valor: 'indeciso', etiqueta: 'Indecisa/o, tengo dudas sobre su utilidad en mi trabajo', score: 2 },
        { valor: 'no_interesado', etiqueta: 'No estoy interesada/o en usarlas', score: 1 },
      ],
    },
  },

  // ── Expectativas del programa ──────────────────────────────────────────────
  {
    tipoCampo: 'texto_largo',
    etiqueta: '¿Qué tipo de tareas o procesos esperas mejorar con IA en tu rol actual?',
    esObligatorio: true,
    configJson: { seccion: 'Expectativas del programa' },
  },
  {
    tipoCampo: 'opcion_multiple',
    etiqueta: '¿Con qué frecuencia te enfrentas a tareas repetitivas o de alto consumo de tiempo que podrían optimizarse con IA generativa?',
    esObligatorio: true,
    configJson: {
      opciones: [
        { valor: 'diario', etiqueta: 'A diario' },
        { valor: 'semanal', etiqueta: 'Varias veces a la semana' },
        { valor: 'ocasional', etiqueta: 'Ocasionalmente' },
        { valor: 'nunca', etiqueta: 'Nunca' },
      ],
    },
  },
  {
    tipoCampo: 'opcion_multiple',
    etiqueta: '¿Qué esperas lograr con este programa?',
    descripcion: 'Puedes marcar varias opciones.',
    esObligatorio: true,
    configJson: {
      multiple: true,
      opciones: [
        { valor: 'usar_eficiente', etiqueta: 'Aprender a usar la IA generativa de manera más eficiente' },
        { valor: 'reducir_tiempo', etiqueta: 'Reducir el tiempo que invierto en tareas repetitivas' },
        { valor: 'aplicar_trabajo', etiqueta: 'Entender cómo aplicar la IA en mi trabajo específico' },
        { valor: 'explorar', etiqueta: 'Explorar nuevas formas de trabajar con IA' },
        { valor: 'otro', etiqueta: 'Otro' },
      ],
    },
  },
];

async function main() {
  console.log('🌱  Seed: template global "Diagnóstico inicial"');

  const existente = await prisma.plantillaFormulario.findFirst({
    where: { programaId: null, tipoFormulario: 'diagnostico_inicial', activa: true },
    include: { _count: { select: { campos: true } } },
  });
  if (existente) {
    console.log(
      `⚠️  Ya existe un template global activo de diagnóstico inicial:\n` +
        `    "${existente.nombre}" (v${existente.version}, ${existente._count.campos} campos, id=${existente.id}).\n` +
        `    No se creó nada. Edítalo o duplícalo desde /admin/formularios.`,
    );
    return;
  }

  const campos = CON_DATOS_PERSONALES ? [...CAMPOS_IDENTIDAD, ...CAMPOS] : CAMPOS;

  const plantilla = await prisma.$transaction(async (tx) => {
    const creada = await tx.plantillaFormulario.create({
      data: {
        id: randomUUID(),
        programaId: null,
        tipoFormulario: 'diagnostico_inicial',
        nombre: NOMBRE_PLANTILLA,
        descripcion: DESCRIPCION_PLANTILLA,
        activa: true,
      },
    });
    let orden = 1;
    for (const campo of campos) {
      await tx.campoFormulario.create({
        data: {
          id: randomUUID(),
          plantillaId: creada.id,
          tipoCampo: campo.tipoCampo,
          etiqueta: campo.etiqueta,
          descripcion: campo.descripcion ?? null,
          dimension: campo.dimension ?? null,
          esObligatorio: campo.esObligatorio ?? false,
          orden: orden++,
          configJson: (campo.configJson ?? {}) as Prisma.InputJsonValue,
        },
      });
    }
    return creada;
  });

  const dimensiones = [...new Set(campos.map(c => c.dimension).filter(Boolean))];
  console.log('✅  Template creado');
  console.log(`    id:          ${plantilla.id}`);
  console.log(`    campos:      ${campos.length}${CON_DATOS_PERSONALES ? ' (incluye correo/nombre/cargo)' : ' (sin correo/nombre/cargo: la respuesta ya queda ligada al usuario autenticado)'}`);
  console.log(`    dimensiones: ${dimensiones.join(', ')}`);
  console.log('    Revísalo en /admin/formularios. Se snapshotea al activar cada programa (RF-46).');
}

// Bajo vitest solo se importan CAMPOS/CAMPOS_IDENTIDAD (validación de configs);
// el seed real corre únicamente vía `npm run seed:diagnostico-inicial`.
if (!process.env.VITEST) {
  main()
    .catch(err => {
      console.error('❌  Seed diagnóstico inicial falló:', err);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
