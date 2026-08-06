import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { TipoFormulario } from '@prisma/client';

import { PrismaService } from '../../../prisma.service';
import { ActorScopeService } from '../../auth/scoping/actor-scope.service';
import { JwtAuthGuard, RolesGuard, Roles, CurrentUser } from '../../auth/guards';
import type { AuthUser } from '../../auth/guards';
import { TranslationService } from '../../translation/translation.service';
import {
  CAMPO_FORM_TRANS_FIELDS,
  PLANTILLA_FORM_TRANS_FIELDS,
} from '../../../shared/i18n/translatable-locales';
import { derivarConfigPublica } from '../../formularios/application/form-config';

// Fase 3 (Plan 2 §3.1 — RF-37/RF-38): el facilitador ve las bitácoras y
// plantillas de proyecto de TODOS los grupos de su programa, en SOLO LECTURA
// (no edita el contenido; la única escritura es habilitar/deshabilitar la
// bitácora, O-01). Scoping §0.1: lectura vía assertProgramaAccessible (sin
// bloqueo de gracia), escritura vía assertProgramaEditable (RF-03/RN-03).
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('facilitador')
@Controller('facilitador')
export class FacilitadorRetoController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: ActorScopeService,
    private readonly translations: TranslationService,
  ) {}

  // RF-37: bitácoras de todos los grupos del programa (lectura).
  @Get('programas/:id/bitacoras')
  async listBitacoras(
    @Param('id') programaId: string,
    @CurrentUser() actor: AuthUser,
    @Query('locale') locale?: string,
  ) {
    return this.listRecurso(programaId, 'bitacora', actor, locale);
  }

  // RF-38: plantillas de proyecto de todos los grupos del programa (lectura).
  @Get('programas/:id/plantillas')
  async listPlantillas(
    @Param('id') programaId: string,
    @CurrentUser() actor: AuthUser,
    @Query('locale') locale?: string,
  ) {
    return this.listRecurso(programaId, 'plantilla_proyecto', actor, locale);
  }

  // O-01: estado de habilitación de la bitácora del programa.
  @Get('programas/:id/bitacora/estado')
  async estadoBitacora(@Param('id') programaId: string, @CurrentUser() actor: AuthUser) {
    await this.scope.assertProgramaAccessible(this.prisma, actor, programaId);
    const p = await this.prisma.programa.findUnique({
      where: { id: programaId },
      select: { bitacoraHabilitadaEn: true },
    });
    return { habilitada: !!p?.bitacoraHabilitadaEn, bitacoraHabilitadaEn: p?.bitacoraHabilitadaEn ?? null };
  }

  // O-01: el facilitador (además del admin) puede habilitar/deshabilitar la bitácora.
  @Post('programas/:id/bitacora/habilitar')
  async habilitarBitacora(
    @Param('id') programaId: string,
    @Body() body: { habilitar?: boolean },
    @CurrentUser() actor: AuthUser,
  ) {
    await this.scope.assertProgramaEditable(this.prisma, actor, programaId);
    const habilitar = body?.habilitar !== false;
    return this.prisma.programa.update({
      where: { id: programaId },
      data: { bitacoraHabilitadaEn: habilitar ? new Date() : null },
      select: { id: true, bitacoraHabilitadaEn: true },
    });
  }

  private async listRecurso(programaId: string, tipo: TipoFormulario, actor: AuthUser, locale?: string) {
    await this.scope.assertProgramaAccessible(this.prisma, actor, programaId);

    const plantilla = await this.prisma.plantillaFormulario.findFirst({
      where: { programaId, tipoFormulario: tipo, activa: true },
      select: { id: true, tipoFormulario: true, nombre: true, descripcion: true },
      orderBy: { createdAt: 'desc' },
    });
    // Programa sin snapshot de este tipo: respuesta vacía, no error (el
    // snapshot es opcional por tipo).
    if (!plantilla) return { plantilla: null, grupos: [] };

    const campos = await this.prisma.campoFormulario.findMany({
      where: { plantillaId: plantilla.id },
      select: {
        id: true,
        campoPadreId: true,
        tipoCampo: true,
        etiqueta: true,
        descripcion: true,
        esObligatorio: true,
        orden: true,
        configJson: true,
      },
      orderBy: { orden: 'asc' },
    });

    const grupos = await this.prisma.grupo.findMany({
      where: { programaId },
      select: {
        id: true,
        nombre: true,
        orden: true,
        miembros: { select: { usuario: { select: { id: true, nombre: true } } } },
        respuestasFormulario: {
          where: { plantillaId: plantilla.id },
          select: {
            datosRespuestaJson: true,
            ultimaEdicionEn: true,
            ultimoEditor: { select: { id: true, nombre: true } },
          },
        },
      },
      orderBy: { orden: 'asc' },
    });

    const [plantillaOverlay, campoOverlay] =
      locale && locale !== 'es'
        ? await Promise.all([
            this.translations.applyOverlay('PlantillaFormulario', [plantilla.id], locale, PLANTILLA_FORM_TRANS_FIELDS),
            this.translations.applyOverlay('CampoFormulario', campos.map(c => c.id), locale, CAMPO_FORM_TRANS_FIELDS),
          ])
        : [{}, {}];

    const pt = plantillaOverlay[plantilla.id] ?? {};
    return {
      plantilla: {
        id: plantilla.id,
        tipoFormulario: plantilla.tipoFormulario,
        nombre: pt.nombre ?? plantilla.nombre,
        descripcion: pt.descripcion ?? plantilla.descripcion,
        // RNF-04/RN-02: el facilitador tampoco recibe configJson — solo la
        // config pública necesaria para renderizar las respuestas.
        campos: campos.map(({ configJson, ...campo }) => {
          const ct = campoOverlay[campo.id] ?? {};
          return {
            ...campo,
            etiqueta: ct.etiqueta ?? campo.etiqueta,
            descripcion: ct.descripcion ?? campo.descripcion,
            configPublica: derivarConfigPublica(campo.tipoCampo, configJson),
          };
        }),
      },
      grupos: grupos.map(g => {
        const r = g.respuestasFormulario[0] ?? null;
        return {
          id: g.id,
          nombre: g.nombre,
          orden: g.orden,
          miembros: g.miembros.map(m => m.usuario),
          respuesta: r
            ? { datos: r.datosRespuestaJson, ultimaEdicionEn: r.ultimaEdicionEn, ultimoEditor: r.ultimoEditor }
            : null,
        };
      }),
    };
  }
}
