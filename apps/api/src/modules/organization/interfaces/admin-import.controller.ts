import { Controller, Post, Body, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../prisma.service';
import { randomUUID } from 'crypto';

interface PreguntaInput {
  orden?: number;
  enunciado: string;
  permitirArchivo?: boolean;
  soloArchivo?: boolean;
  usarIa?: boolean;
  iaAutomatica?: boolean;
  promptIa?: string;
  urlPlantilla?: string;
  urlPromptTemplate?: string;
}

interface PasoInput {
  titulo: string;
  objetivo?: string;
  instrucciones?: string;
  preguntas?: PreguntaInput[];
  // legacy fields (ignored — now live on Pregunta)
  usarIa?: boolean;
  promptIa?: string;
  permitirArchivo?: boolean;
  soloArchivo?: boolean;
  urlPlantilla?: string;
}

interface ActividadInput {
  nombre: string;
  descripcion?: string;
  plantilla?: string;
  pasos?: PasoInput[];
}

interface IniciativaInput {
  nombre: string;
  descripcion?: string;
  actividades?: ActividadInput[];
}

interface ImportBody {
  empresaId: string;
  iniciativas: IniciativaInput[];
}

@Controller('admin/import')
export class AdminImportController {
  constructor(private readonly prisma: PrismaService) {}

  @Post()
  async importData(@Body() body: ImportBody) {
    console.log('[import] body recibido:', JSON.stringify(body?.iniciativas?.[0]?.actividades?.[0], null, 2));
    if (!body.empresaId) {
      throw new BadRequestException('Falta el campo "empresaId"');
    }
    if (!Array.isArray(body.iniciativas) || body.iniciativas.length === 0) {
      throw new BadRequestException('El JSON debe contener al menos una iniciativa');
    }

    const empresa = await this.prisma.empresa.findUnique({
      where: { id: body.empresaId, activo: true },
    });
    if (!empresa) {
      throw new BadRequestException('Empresa no encontrada');
    }

    const result = {
      empresa: empresa.nombre,
      iniciativasCreadas: 0,
      actividadesCreadas: 0,
      details: [] as any[],
    };

    await this.prisma.$transaction(async (tx) => {
      for (const iniInput of body.iniciativas) {
        if (!iniInput.nombre?.trim()) continue;

        const iniciativa = await tx.iniciativa.create({
          data: {
            id: randomUUID(),
            nombre: iniInput.nombre.trim(),
            descripcion: iniInput.descripcion?.trim() ?? null,
            empresaId: empresa.id,
          },
        });
        result.iniciativasCreadas++;

        const iniDetail: any = { nombre: iniciativa.nombre, actividades: [] };

        for (const actInput of iniInput.actividades ?? []) {
          if (!actInput.nombre?.trim()) continue;

          let plantilla: any = null;
          if (actInput.plantilla?.trim()) {
            plantilla = await tx.plantillaActividad.findFirst({
              where: { nombre: actInput.plantilla.trim(), activo: true },
              include: { pasos: { where: { activo: true }, orderBy: { orden: 'asc' } } },
            });
          }

          const actividad = await tx.actividad.create({
            data: {
              id: randomUUID(),
              nombre: actInput.nombre.trim(),
              descripcion: actInput.descripcion?.trim() ?? null,
              iniciativaId: iniciativa.id,
              plantillaOrigenId: plantilla?.id ?? null,
            },
          });

          let pasosCreados = 0;

          if (actInput.pasos && actInput.pasos.length > 0) {
            console.log(`[import] Creando ${actInput.pasos.length} pasos para actividad "${actividad.nombre}"`);
            try {
              const pasosData = actInput.pasos.map((p, idx) => ({
                id: randomUUID(),
                actividadId: actividad.id,
                titulo: p.titulo.trim(),
                objetivo: p.objetivo?.trim() ?? null,
                instrucciones: p.instrucciones?.trim() ?? null,
                orden: idx + 1,
              }));
              await tx.pasoActividad.createMany({ data: pasosData });

              const preguntasData: any[] = [];
              for (let i = 0; i < actInput.pasos.length; i++) {
                const p = actInput.pasos[i];
                const pasoId = pasosData[i].id;
                const preguntas = p.preguntas ?? [];
                preguntas.forEach((q, qIdx) => {
                  preguntasData.push({
                    id: randomUUID(),
                    pasoId,
                    orden: q.orden ?? qIdx + 1,
                    enunciado: q.enunciado.trim(),
                    permitirArchivo: q.permitirArchivo ?? false,
                    soloArchivo: q.soloArchivo ?? false,
                    usarIa: q.usarIa ?? false,
                    iaAutomatica: q.iaAutomatica ?? false,
                    promptIa: q.promptIa?.trim() ?? null,
                    urlPlantilla: q.urlPlantilla?.trim() ?? null,
                    urlPromptTemplate: q.urlPromptTemplate?.trim() ?? null,
                  });
                });
              }
              if (preguntasData.length > 0) {
                await tx.preguntaActividad.createMany({ data: preguntasData });
              }

              pasosCreados = actInput.pasos.length;
              console.log(`[import] ✓ ${pasosCreados} pasos, ${preguntasData.length} preguntas creadas`);
            } catch (e) {
              console.error(`[import] ERROR al crear pasos:`, e);
              throw e;
            }
          } else if (plantilla?.pasos?.length > 0) {
            await tx.pasoActividad.createMany({
              data: plantilla.pasos.map((p: any) => ({
                id: randomUUID(),
                actividadId: actividad.id,
                titulo: p.titulo,
                objetivo: p.objetivo,
                instrucciones: p.instrucciones,
                usarIa: p.usarIa,
                promptIa: p.promptIa,
                permitirArchivo: p.permitirArchivo ?? false,
                soloArchivo: p.soloArchivo ?? false,
                urlPlantilla: p.urlPlantilla ?? null,
                orden: p.orden,
              })),
            });
            pasosCreados = plantilla.pasos.length;
          }

          result.actividadesCreadas++;
          iniDetail.actividades.push({
            nombre: actividad.nombre,
            pasosCopados: pasosCreados,
            plantilla: plantilla?.nombre ?? null,
          });
        }

        result.details.push(iniDetail);
      }
    });

    return result;
  }
}
