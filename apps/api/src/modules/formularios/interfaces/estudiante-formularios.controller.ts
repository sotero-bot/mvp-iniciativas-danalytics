import { Body, Controller, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { Prisma, TipoFormulario } from '@prisma/client';
import { randomUUID } from 'crypto';

import { PrismaService } from '../../../prisma.service';
import { ActorScopeService } from '../../auth/scoping/actor-scope.service';
import { JwtAuthGuard, RolesGuard, Roles, CurrentUser } from '../../auth/guards';
import type { AuthUser } from '../../auth/guards';
import { AppError } from '../../../shared/errors/AppError';
import { TranslationService } from '../../translation/translation.service';
import {
  CAMPO_FORM_TRANS_FIELDS,
  PLANTILLA_FORM_TRANS_FIELDS,
} from '../../../shared/i18n/translatable-locales';
import { derivarConfigPublica } from '../application/form-config';
import { calcularScoresPorDimension, CampoParaScoring } from '../application/scoring';

// Fase 2: formularios individuales (usuarioRespondienteId). Los grupales
// (bitacora / plantilla_proyecto) llegan con la Fase 3 vía recursos de grupo.
const TIPOS_INDIVIDUALES: TipoFormulario[] = [
  'diagnostico_inicial',
  'diagnostico_final',
  'feedback',
];

interface DraftDto {
  datos: Record<string, unknown>;
}

// RNF-04/RN-02: select SIN configJson — lo público viaja en configPublica derivada.
const CAMPO_PUBLICO_SELECT = {
  id: true,
  campoPadreId: true,
  tipoCampo: true,
  etiqueta: true,
  descripcion: true,
  esObligatorio: true,
  orden: true,
} satisfies Prisma.CampoFormularioSelect;

// Autorización (Plan 2 §0.1, RF-28/RF-29/RNF-09): respondiente estudiante.
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('estudiante')
@Controller('formularios')
export class EstudianteFormulariosController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: ActorScopeService,
    private readonly translations: TranslationService,
  ) {}

  // RF-28: dashboard de formularios del estudiante con su estado
  // (pendiente / en_progreso / enviado).
  @Get('disponibles')
  async disponibles(@CurrentUser() actor: AuthUser) {
    const plantillas = await this.prisma.plantillaFormulario.findMany({
      where: {
        activa: true,
        tipoFormulario: { in: TIPOS_INDIVIDUALES },
        programa: {
          is: {
            AND: [{ estado: 'activo' }, this.scope.programaScope(actor)],
          },
        },
      },
      select: {
        id: true,
        programaId: true,
        tipoFormulario: true,
        nombre: true,
        descripcion: true,
        programa: { select: { id: true, nombre: true } },
        respuestas: {
          where: { usuarioRespondienteId: actor.sub },
          select: { estado: true, enviadoEn: true, updatedAt: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return plantillas.map(p => {
      const respuesta = p.respuestas[0] ?? null;
      return {
        id: p.id,
        programaId: p.programaId,
        programa: p.programa,
        tipoFormulario: p.tipoFormulario,
        nombre: p.nombre,
        descripcion: p.descripcion,
        estado: !respuesta ? 'pendiente' : respuesta.estado === 'submitted' ? 'enviado' : 'en_progreso',
        enviadoEn: respuesta?.enviadoEn ?? null,
      };
    });
  }

  // RF-28/RNF-04: formulario para responder — campos SIN configJson, con
  // configPublica sanitizada + el draft propio para retomar (RNF-09).
  @Get(':plantillaId')
  async getFormulario(
    @Param('plantillaId') plantillaId: string,
    @CurrentUser() actor: AuthUser,
    @Query('locale') locale?: string,
  ) {
    const plantilla = await this.assertRespondible(plantillaId, actor);

    const campos = await this.prisma.campoFormulario.findMany({
      where: { plantillaId },
      select: { ...CAMPO_PUBLICO_SELECT, configJson: true },
      orderBy: { orden: 'asc' },
    });

    const respuesta = await this.prisma.respuestaFormulario.findFirst({
      where: { plantillaId, usuarioRespondienteId: actor.sub },
      select: { estado: true, datosRespuestaJson: true, enviadoEn: true },
    });

    // Contenido dinámico: overlay vía TranslationService (Plan 2 §0.4), no t().
    const [plantillaOverlay, campoOverlay] =
      locale && locale !== 'es'
        ? await Promise.all([
            this.translations.applyOverlay('PlantillaFormulario', [plantilla.id], locale, PLANTILLA_FORM_TRANS_FIELDS),
            this.translations.applyOverlay('CampoFormulario', campos.map(c => c.id), locale, CAMPO_FORM_TRANS_FIELDS),
          ])
        : [{}, {}];

    const pt = plantillaOverlay[plantilla.id] ?? {};
    return {
      id: plantilla.id,
      programaId: plantilla.programaId,
      tipoFormulario: plantilla.tipoFormulario,
      nombre: pt.nombre ?? plantilla.nombre,
      descripcion: pt.descripcion ?? plantilla.descripcion,
      campos: campos.map(({ configJson, ...campo }) => {
        const ct = campoOverlay[campo.id] ?? {};
        return {
          ...campo,
          etiqueta: ct.etiqueta ?? campo.etiqueta,
          descripcion: ct.descripcion ?? campo.descripcion,
          // RNF-04/RN-02: nunca configJson (contiene score); solo la config pública.
          configPublica: derivarConfigPublica(campo.tipoCampo, configJson),
        };
      }),
      respuesta: respuesta
        ? { estado: respuesta.estado, datos: respuesta.datosRespuestaJson, enviadoEn: respuesta.enviadoEn }
        : null,
    };
  }

  // RNF-09: autosave del draft (el front lo llama cada 30 s).
  @Put(':plantillaId/draft')
  async saveDraft(
    @Param('plantillaId') plantillaId: string,
    @Body() body: DraftDto,
    @CurrentUser() actor: AuthUser,
  ) {
    const plantilla = await this.assertRespondible(plantillaId, actor);
    const datos = (body?.datos ?? {}) as Prisma.InputJsonValue;

    const existente = await this.prisma.respuestaFormulario.findFirst({
      where: { plantillaId, usuarioRespondienteId: actor.sub },
    });
    if (existente?.estado === 'submitted') throw new AppError('RESPUESTA_YA_ENVIADA');

    if (existente) {
      const actualizada = await this.prisma.respuestaFormulario.update({
        where: { id: existente.id },
        data: {
          datosRespuestaJson: datos,
          ultimoEditorId: actor.sub,
          ultimaEdicionEn: new Date(),
        },
        select: { id: true, estado: true, updatedAt: true },
      });
      return actualizada;
    }

    try {
      return await this.prisma.respuestaFormulario.create({
        data: {
          id: randomUUID(),
          plantillaId,
          programaId: plantilla.programaId!,
          usuarioRespondienteId: actor.sub,
          datosRespuestaJson: datos,
          estado: 'draft',
          ultimoEditorId: actor.sub,
          ultimaEdicionEn: new Date(),
        },
        select: { id: true, estado: true, updatedAt: true },
      });
    } catch (e) {
      // Índice único parcial resp_form_usuario: carrera concurrente (StrictMode/reintentos).
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new AppError('RESPUESTA_DUPLICADA');
      }
      throw e;
    }
  }

  // RF-29: submit. El SERVIDOR calcula scoresPorDimensionJson; el estudiante
  // solo recibe confirmación — nunca desglose ni puntaje (RNF-04/RN-02).
  @Post(':plantillaId/submit')
  async submit(
    @Param('plantillaId') plantillaId: string,
    @Body() body: Partial<DraftDto>,
    @CurrentUser() actor: AuthUser,
  ) {
    const plantilla = await this.assertRespondible(plantillaId, actor);

    const existente = await this.prisma.respuestaFormulario.findFirst({
      where: { plantillaId, usuarioRespondienteId: actor.sub },
    });
    if (existente?.estado === 'submitted') throw new AppError('RESPUESTA_YA_ENVIADA');

    const datos = (body?.datos ?? existente?.datosRespuestaJson ?? {}) as Record<string, unknown>;

    const campos = await this.prisma.campoFormulario.findMany({
      where: { plantillaId },
      select: { id: true, tipoCampo: true, dimension: true, esObligatorio: true, campoPadreId: true, configJson: true },
    });

    // RF-25: obligatorios de primer nivel deben venir respondidos.
    const faltantes = campos.filter(
      c =>
        c.esObligatorio &&
        !c.campoPadreId &&
        c.tipoCampo !== 'grupo_repetible' &&
        (datos[c.id] === undefined || datos[c.id] === null || datos[c.id] === ''),
    );
    if (faltantes.length > 0) {
      throw new AppError('VALIDATION_ERROR', {
        message: 'Faltan campos obligatorios',
        details: { camposFaltantes: faltantes.map(c => c.id) },
      });
    }

    const scores = calcularScoresPorDimension(campos as CampoParaScoring[], datos);
    const ahora = new Date();
    const data = {
      datosRespuestaJson: datos as Prisma.InputJsonValue,
      scoresPorDimensionJson: scores as unknown as Prisma.InputJsonValue,
      estado: 'submitted' as const,
      enviadoEn: ahora,
      ultimoEditorId: actor.sub,
      ultimaEdicionEn: ahora,
    };

    try {
      if (existente) {
        await this.prisma.respuestaFormulario.update({ where: { id: existente.id }, data });
      } else {
        await this.prisma.respuestaFormulario.create({
          data: {
            id: randomUUID(),
            plantillaId,
            programaId: plantilla.programaId!,
            usuarioRespondienteId: actor.sub,
            ...data,
          },
        });
      }
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new AppError('RESPUESTA_DUPLICADA');
      }
      throw e;
    }

    // Solo confirmación: sin scores, sin desglose (RF-29).
    return { ok: true, estado: 'submitted', enviadoEn: ahora };
  }

  // El formulario debe ser un snapshot activo de tipo individual, de un programa
  // accesible para el actor (scoping §0.1 vía ActorScopeService).
  private async assertRespondible(plantillaId: string, actor: AuthUser) {
    const plantilla = await this.prisma.plantillaFormulario.findUnique({
      where: { id: plantillaId },
      select: { id: true, programaId: true, tipoFormulario: true, nombre: true, descripcion: true, activa: true },
    });
    if (!plantilla || !plantilla.activa || !plantilla.programaId) {
      throw new AppError('PLANTILLA_NOT_FOUND');
    }
    if (!TIPOS_INDIVIDUALES.includes(plantilla.tipoFormulario)) {
      throw new AppError('FORBIDDEN');
    }
    await this.scope.assertProgramaAccessible(this.prisma, actor, plantilla.programaId);
    return plantilla;
  }
}
