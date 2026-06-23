import OpenAI from 'openai';
import { PrismaService } from '../../../prisma.service';
import { AppError } from '../../../shared/errors/AppError';

export class SintetizarCanvasPorTokenUseCase {
    private openai: OpenAI;

    constructor(private readonly prisma: PrismaService) {
        this.openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY || 'dummy_key',
        });
    }

    async execute(token: string, locale: string = 'es', force: boolean = false): Promise<Record<string, string>> {
        // Resolver instancia por token
        const instancia = await this.prisma.instanciaActividad.findUnique({
            where: { accessToken: token },
            include: {
                actividad: {
                    include: {
                        plantillaOrigen: true,
                        pasos: {
                            orderBy: { orden: 'asc' },
                        },
                    },
                },
            },
        });

        if (!instancia) {
            throw new AppError('INSTANCIA_NOT_FOUND', { message: 'Instancia no encontrada para este token' });
        }

        // Verificar que sea Analytics Canvas
        const nombrePlantilla = instancia.actividad.plantillaOrigen?.nombre ?? '';
        if (!nombrePlantilla.includes('Analytics Canvas')) {
            throw new AppError('ACTIVIDAD_INVALID_TYPE', {
                message: `Esta actividad no es un Analytics Canvas (plantilla: "${nombrePlantilla}")`,
            });
        }

        const pasos = instancia.actividad.pasos;

        // Caché lazy: si todos los bloques ya existen, devolverlos sin llamar a OpenAI
        const bloquesExistentes = await this.prisma.canvasBloque.findMany({
            where: { instanciaId: instancia.id },
        });

        if (
            !force &&
            bloquesExistentes.length === pasos.length &&
            pasos.length > 0 &&
            bloquesExistentes.every(b => b.locale === locale)
        ) {
            const resultado: Record<string, string> = {};
            for (const b of bloquesExistentes) {
                resultado[b.pasoId] = b.resumen;
            }
            return resultado;
        }

        // Cargar respuestas existentes de los pasos (tabla Interaccion, modelo legado)
        const interacciones = await this.prisma.interaccion.findMany({
            where: { instanciaId: instancia.id },
        });
        const respuestasPorPasoId: Record<string, string> = {};
        for (const i of interacciones) {
            respuestasPorPasoId[i.pasoId] =
                i.respuestaIa || i.respuestaUsuario || i.contenido || '';
        }

        // También revisar tabla Respuesta (modelo nuevo por preguntas)
        const respuestas = await this.prisma.respuesta.findMany({
            where: { instanciaId: instancia.id },
            include: { pregunta: { select: { pasoId: true } } },
        });
        // Agrupar respuestas por pasoId (concatenar si hay múltiples preguntas)
        for (const r of respuestas) {
            const pasoId = r.pregunta.pasoId;
            const texto = r.respuestaIa || r.respuestaUsuario || r.contenido || '';
            if (texto) {
                respuestasPorPasoId[pasoId] = respuestasPorPasoId[pasoId]
                    ? `${respuestasPorPasoId[pasoId]}\n\n${texto}`
                    : texto;
            }
        }

        const model = process.env.OPENAI_MODEL || 'gpt-4o';

        const LANG_NAMES: Record<string, string> = { es: 'español', pt: 'portugués (Brasil)' };
        const langName = LANG_NAMES[locale] ?? 'español';
        const langDirective = `IDIOMA DE RESPUESTA: Responde ÚNICAMENTE en ${langName}. No uses ningún otro idioma bajo ninguna circunstancia, independientemente del idioma de las instrucciones o del contenido que recibas.`;

        // Generar síntesis en paralelo — una llamada por bloque
        const tareas = pasos.map(async (paso) => {
            const respuesta = respuestasPorPasoId[paso.id] || '';
            if (!respuesta.trim() || respuesta === '(Sin respuesta registrada)') {
                return { pasoId: paso.id, resumen: '' };
            }

            const userPrompt = `Para el bloque "${paso.titulo}" de un Analytics Canvas empresarial, extrae 2 a 4 ideas clave de la siguiente respuesta. Escribe cada idea en una línea separada, sin viñetas ni numeración, máximo 15 palabras por idea.\n\nRespuesta:\n${respuesta}\n\n---\n\n${langDirective}`;

            try {
                const response = await this.openai.chat.completions.create({
                    model,
                    messages: [
                        { role: 'system', content: `Eres un asistente de análisis estratégico. ${langDirective}` },
                        { role: 'user', content: userPrompt },
                    ],
                    max_completion_tokens: 300,
                });
                const resumen = response.choices[0].message?.content?.trim() || '';
                return { pasoId: paso.id, resumen };
            } catch (err) {
                console.error(`[SintetizarCanvas] Error en bloque "${paso.titulo}":`, err);
                return { pasoId: paso.id, resumen: '' };
            }
        });

        const resultados = await Promise.all(tareas);

        // Upsert en CanvasBloque
        const ahora = new Date();
        await Promise.all(
            resultados.map((r) =>
                this.prisma.canvasBloque.upsert({
                    where: {
                        instanciaId_pasoId: {
                            instanciaId: instancia.id,
                            pasoId: r.pasoId,
                        },
                    },
                    update: {
                        resumen: r.resumen,
                        locale,
                        generadoEn: ahora,
                    },
                    create: {
                        instanciaId: instancia.id,
                        pasoId: r.pasoId,
                        resumen: r.resumen,
                        locale,
                        generadoEn: ahora,
                    },
                })
            )
        );

        const resultado: Record<string, string> = {};
        for (const r of resultados) {
            resultado[r.pasoId] = r.resumen;
        }
        return resultado;
    }
}
