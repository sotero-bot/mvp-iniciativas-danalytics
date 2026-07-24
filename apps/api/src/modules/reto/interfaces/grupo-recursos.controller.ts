import { Body, Controller, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { Prisma, TipoFormulario } from '@prisma/client';
import { randomUUID } from 'crypto';

import { PrismaService } from '../../../prisma.service';
import { S3Service } from '../../storage/S3Service';
import { ActorScopeService } from '../../auth/scoping/actor-scope.service';
import { JwtAuthGuard, RolesGuard, Roles, CurrentUser } from '../../auth/guards';
import type { AuthUser } from '../../auth/guards';
import { AppError } from '../../../shared/errors/AppError';
import { TranslationService } from '../../translation/translation.service';
import {
  CAMPO_FORM_TRANS_FIELDS,
  PLANTILLA_FORM_TRANS_FIELDS,
} from '../../../shared/i18n/translatable-locales';
import { derivarConfigPublica } from '../../formularios/application/form-config';

// Fase 3 (Plan 2 §3.1 — RF-16/RF-30/RF-31/RF-32): recursos de GRUPO. Bitácora y
// plantilla del proyecto reutilizan el form builder de Fase 2 con
// grupoRespondienteId; la presentación final es la tabla PresentacionFinal.
// Cualquier miembro del grupo edita (RF-16); no-miembros → GRUPO_RECURSO_NO_MIEMBRO.

interface DraftDto {
  datos: Record<string, unknown>;
}

interface PresentacionDto {
  archivoKey?: string;
}

// RF-32: formatos de archivo aceptados para la presentación (PDF/PPT).
const PRESENTACION_EXT_RE = /\.(pdf|ppt|pptx)$/i;

// La key de S3 es `<slug>-<uuid><ext>` (S3Service.generateKey): el UUID solo
// garantiza unicidad. Para mostrarlo al usuario le quitamos ese sufijo y dejamos
// un nombre legible (ej. `prueba-<uuid>.pdf` → `prueba.pdf`).
const UUID_SUFFIX_RE = /-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(\.[^.]+)?$/i;
function nombreArchivoLegible(archivoKey: string): string {
  const base = archivoKey.split('/').pop() ?? archivoKey;
  return base.replace(UUID_SUFFIX_RE, '$1');
}

const GRUPO_SELECT = {
  id: true,
  programaId: true,
  nombre: true,
  orden: true,
  programa: {
    select: {
      id: true,
      nombre: true,
      estado: true,
      presentacionDesdeSesion: true,
      bitacoraHabilitadaEn: true, // O-01: gate de visibilidad de la bitácora
      empresa: { select: { nombre: true } },
    },
  },
} satisfies Prisma.GrupoSelect;

// Autorización (Plan 2 §0.1): estudiante miembro del grupo. El scoping por
// programa lo aplica assertProgramaAccessible; la membresía, assertMiembro.
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('estudiante')
@Controller('grupos')
export class GrupoRecursosController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: ActorScopeService,
    private readonly translations: TranslationService,
    private readonly s3: S3Service,
  ) {}

  // Glue mínimo para el portal: "mis grupos" con el estado de cada recurso del
  // reto, sin que la UI tenga que conocer el grupoId de antemano.
  @Get('mios')
  async misGrupos(@CurrentUser() actor: AuthUser) {
    const grupos = await this.prisma.grupo.findMany({
      where: {
        miembros: { some: { usuarioId: actor.sub } },
        programa: { is: this.scope.programaScope(actor) },
      },
      select: {
        ...GRUPO_SELECT,
        miembros: { select: { usuario: { select: { id: true, nombre: true } } } },
        respuestasFormulario: {
          where: { plantilla: { is: { tipoFormulario: { in: ['bitacora', 'plantilla_proyecto'] }, activa: true } } },
          select: {
            ultimaEdicionEn: true,
            plantilla: { select: { tipoFormulario: true } },
          },
        },
        presentacionFinal: { select: { entregadoEn: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    return grupos.map(g => {
      const porTipo = (tipo: TipoFormulario) =>
        g.respuestasFormulario.find(r => r.plantilla.tipoFormulario === tipo) ?? null;
      const bitacora = porTipo('bitacora');
      const plantilla = porTipo('plantilla_proyecto');
      // La entrega de la presentación final "entrega" y cierra bitácora + plantilla.
      const entregada = !!g.presentacionFinal;
      return {
        id: g.id,
        nombre: g.nombre,
        orden: g.orden,
        programa: { id: g.programa.id, nombre: g.programa.nombre, estado: g.programa.estado },
        miembros: g.miembros.map(m => m.usuario),
        recursos: {
          // O-01: la bitácora solo es visible/editable si el programa la habilitó.
          bitacora: {
            habilitada: !!g.programa.bitacoraHabilitadaEn,
            iniciada: !!bitacora,
            entregada,
            ultimaEdicionEn: bitacora?.ultimaEdicionEn ?? null,
          },
          plantillaProyecto: {
            iniciada: !!plantilla,
            entregada,
            ultimaEdicionEn: plantilla?.ultimaEdicionEn ?? null,
          },
          presentacionFinal: { entregada: !!g.presentacionFinal, entregadoEn: g.presentacionFinal?.entregadoEn ?? null },
        },
      };
    });
  }

  // ── Bitácora (RF-30) ──────────────────────────────────────────────────────

  @Get(':id/bitacora')
  async getBitacora(
    @Param('id') grupoId: string,
    @CurrentUser() actor: AuthUser,
    @Query('locale') locale?: string,
  ) {
    return this.getRecurso(grupoId, 'bitacora', actor, locale);
  }

  @Put(':id/bitacora/draft')
  async saveBitacoraDraft(
    @Param('id') grupoId: string,
    @Body() body: DraftDto,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.saveDraft(grupoId, 'bitacora', body, actor);
  }

  // ── Plantilla del proyecto (RF-31) ────────────────────────────────────────

  @Get(':id/plantilla-proyecto')
  async getPlantillaProyecto(
    @Param('id') grupoId: string,
    @CurrentUser() actor: AuthUser,
    @Query('locale') locale?: string,
  ) {
    return this.getRecurso(grupoId, 'plantilla_proyecto', actor, locale);
  }

  @Put(':id/plantilla-proyecto/draft')
  async savePlantillaProyectoDraft(
    @Param('id') grupoId: string,
    @Body() body: DraftDto,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.saveDraft(grupoId, 'plantilla_proyecto', body, actor);
  }

  // ── Presentación final (RF-32) ────────────────────────────────────────────

  @Get(':id/presentacion-final')
  async getPresentacion(@Param('id') grupoId: string, @CurrentUser() actor: AuthUser) {
    const grupo = await this.assertMiembro(grupoId, actor);
    const habilitada = await this.presentacionHabilitada(grupo.programa);
    const entrega = await this.prisma.presentacionFinal.findUnique({
      where: { grupoId },
      select: {
        archivoKey: true,
        entregadoEn: true,
        entregadoPor: { select: { id: true, nombre: true } },
      },
    });
    return {
      habilitada,
      desdeSesion: grupo.programa.presentacionDesdeSesion,
      entrega: entrega
        ? { ...entrega, archivoNombre: entrega.archivoKey ? nombreArchivoLegible(entrega.archivoKey) : null }
        : null,
    };
  }

  // Presigned PUT para subir el archivo (PDF/PPT) directo a S3. Valida
  // membresía, gating (RF-32) y formato ANTES de firmar.
  @Post(':id/presentacion-final/presign')
  async presignPresentacion(
    @Param('id') grupoId: string,
    @Body() body: { filename: string; contentType: string },
    @CurrentUser() actor: AuthUser,
  ): Promise<{ uploadUrl: string; key: string }> {
    if (!this.s3.isConfigured) throw new AppError('S3_NOT_CONFIGURED');
    const grupo = await this.assertMiembro(grupoId, actor);
    await this.assertPresentacionHabilitada(grupo.programa);
    if (!body?.filename || !PRESENTACION_EXT_RE.test(body.filename)) {
      throw new AppError('PRESENTACION_FORMATO_INVALIDO');
    }

    // Convención de keys del proyecto (skill s3-key-naming): segmentos slugificados.
    const empresa = S3Service.slugifyPathSegment(grupo.programa.empresa.nombre) || 'empresa';
    const programa = S3Service.slugifyPathSegment(grupo.programa.nombre) || 'programa';
    const prefix = `${empresa}/${programa}/grupo_${grupo.orden}/presentacion_final`;

    const key = this.s3.generateKey(prefix, body.filename);
    const uploadUrl = await this.s3.getPresignedPutUrl(key, body.contentType);
    return { uploadUrl, key };
  }

  // RF-32: registra la entrega — archivo (PDF/PPT) obligatorio. El CHECK
  // presentacion_final_url_o_archivo (url OR archivo) sigue siendo la red de
  // seguridad en BD y se satisface con el archivo. Una sola entrega por grupo
  // (@@unique([grupoId])): reentrega = reemplazo.
  @Post(':id/presentacion-final')
  async entregarPresentacion(
    @Param('id') grupoId: string,
    @Body() body: PresentacionDto,
    @CurrentUser() actor: AuthUser,
  ) {
    const grupo = await this.assertMiembro(grupoId, actor);
    await this.assertPresentacionHabilitada(grupo.programa);

    const archivoKey = body?.archivoKey?.trim() || null;
    if (!archivoKey) {
      throw new AppError('VALIDATION_ERROR', { message: 'Sube un archivo (PDF/PPT).' });
    }
    if (!PRESENTACION_EXT_RE.test(archivoKey)) {
      throw new AppError('PRESENTACION_FORMATO_INVALIDO');
    }

    const ahora = new Date();
    const entrega = await this.prisma.presentacionFinal.upsert({
      where: { grupoId },
      create: {
        id: randomUUID(),
        grupoId,
        programaId: grupo.programaId,
        urlPresentacion: null,
        archivoKey,
        entregadoPorId: actor.sub,
        entregadoEn: ahora,
      },
      update: {
        urlPresentacion: null,
        archivoKey,
        entregadoPorId: actor.sub,
        entregadoEn: ahora,
      },
      select: { id: true, archivoKey: true, entregadoEn: true },
    });
    return entrega;
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  // Miembro del grupo (RF-16): scoping §0.1 por programa + membresía explícita.
  private async assertMiembro(grupoId: string, actor: AuthUser) {
    const grupo = await this.prisma.grupo.findUnique({ where: { id: grupoId }, select: GRUPO_SELECT });
    if (!grupo) throw new AppError('GRUPO_NOT_FOUND');
    await this.scope.assertProgramaAccessible(this.prisma, actor, grupo.programaId);
    const miembro = await this.prisma.miembroGrupo.findFirst({
      where: { grupoId, usuarioId: actor.sub },
      select: { id: true },
    });
    if (!miembro) throw new AppError('GRUPO_RECURSO_NO_MIEMBRO');
    return grupo;
  }

  // O-01 (aclaración 2026-07-23): la habilitación de la bitácora
  // (Programa.bitacoraHabilitadaEn, que activa admin/facilitador) es el gate de
  // TODA la sección del reto: bitácora, plantilla del proyecto y —combinado con el
  // gate de sesión— presentación final. Sin habilitar, ningún recurso del grupo se
  // puede ver ni editar. (Reemplaza la aclaración previa 2026-07-14 en la que la
  // plantilla no tenía gate.)
  private assertBitacoraHabilitada(programa: { bitacoraHabilitadaEn: Date | null }): void {
    if (!programa.bitacoraHabilitadaEn) throw new AppError('BITACORA_NO_HABILITADA');
  }

  // Snapshot grupal del programa (bitacora | plantilla_proyecto) — Fase 2 §2.2.
  private async getPlantillaGrupal(programaId: string, tipo: TipoFormulario) {
    const plantilla = await this.prisma.plantillaFormulario.findFirst({
      where: { programaId, tipoFormulario: tipo, activa: true },
      select: { id: true, programaId: true, tipoFormulario: true, nombre: true, descripcion: true },
      orderBy: { createdAt: 'desc' },
    });
    if (!plantilla) throw new AppError('PLANTILLA_NOT_FOUND');
    return plantilla;
  }

  // RF-30/RF-31: formulario del grupo con campos sanitizados (RNF-04: nunca
  // configJson) + la respuesta grupal para retomar, con último editor (RF-16).
  private async getRecurso(grupoId: string, tipo: TipoFormulario, actor: AuthUser, locale?: string) {
    const grupo = await this.assertMiembro(grupoId, actor);
    // O-01: la habilitación de la bitácora gatea toda la sección (bitácora Y
    // plantilla del proyecto).
    this.assertBitacoraHabilitada(grupo.programa);
    const plantilla = await this.getPlantillaGrupal(grupo.programaId, tipo);

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

    const respuesta = await this.prisma.respuestaFormulario.findFirst({
      where: { plantillaId: plantilla.id, grupoRespondienteId: grupoId },
      select: {
        estado: true,
        datosRespuestaJson: true,
        ultimaEdicionEn: true,
        ultimoEditor: { select: { id: true, nombre: true } },
      },
    });

    // Bloqueado si el grupo ya entregó la presentación final (cierre del trabajo).
    const presentacion = await this.prisma.presentacionFinal.findUnique({
      where: { grupoId },
      select: { entregadoEn: true },
    });
    const bloqueada = !!presentacion?.entregadoEn;

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
      grupo: { id: grupo.id, nombre: grupo.nombre, programaId: grupo.programaId },
      bloqueada,
      plantillaId: plantilla.id,
      tipoFormulario: plantilla.tipoFormulario,
      nombre: pt.nombre ?? plantilla.nombre,
      descripcion: pt.descripcion ?? plantilla.descripcion,
      campos: campos.map(({ configJson, ...campo }) => {
        const ct = campoOverlay[campo.id] ?? {};
        return {
          ...campo,
          etiqueta: ct.etiqueta ?? campo.etiqueta,
          descripcion: ct.descripcion ?? campo.descripcion,
          // RNF-04/RN-02: nunca configJson; solo la config pública derivada.
          configPublica: derivarConfigPublica(campo.tipoCampo, configJson),
        };
      }),
      respuesta: respuesta
        ? {
            estado: respuesta.estado,
            datos: respuesta.datosRespuestaJson,
            ultimaEdicionEn: respuesta.ultimaEdicionEn,
            ultimoEditor: respuesta.ultimoEditor,
          }
        : null,
    };
  }

  // La entrega de la presentación final CIERRA el trabajo del grupo: a partir de
  // ahí, bitácora y plantilla del proyecto quedan inmodificables (RF-30/RF-31).
  private async assertGrupoAbierto(grupoId: string): Promise<void> {
    const cerrado = await this.prisma.presentacionFinal.findUnique({
      where: { grupoId },
      select: { entregadoEn: true },
    });
    if (cerrado?.entregadoEn) throw new AppError('RECURSO_CERRADO');
  }

  // RF-16/RF-30/RF-31/RNF-09: draft grupal editable hasta que se entrega la
  // presentación final. Registra ultimoEditorId/ultimaEdicionEn en cada guardado.
  private async saveDraft(grupoId: string, tipo: TipoFormulario, body: DraftDto, actor: AuthUser) {
    const grupo = await this.assertMiembro(grupoId, actor);
    // O-01: la habilitación de la bitácora gatea toda la sección (bitácora Y
    // plantilla del proyecto).
    this.assertBitacoraHabilitada(grupo.programa);
    await this.assertGrupoAbierto(grupoId);
    const plantilla = await this.getPlantillaGrupal(grupo.programaId, tipo);
    const datos = (body?.datos ?? {}) as Prisma.InputJsonValue;

    const existente = await this.prisma.respuestaFormulario.findFirst({
      where: { plantillaId: plantilla.id, grupoRespondienteId: grupoId },
      select: { id: true },
    });

    if (existente) {
      return this.prisma.respuestaFormulario.update({
        where: { id: existente.id },
        data: {
          datosRespuestaJson: datos,
          ultimoEditorId: actor.sub,
          ultimaEdicionEn: new Date(),
        },
        select: { id: true, estado: true, ultimaEdicionEn: true },
      });
    }

    try {
      return await this.prisma.respuestaFormulario.create({
        data: {
          id: randomUUID(),
          plantillaId: plantilla.id,
          programaId: grupo.programaId,
          grupoRespondienteId: grupoId,
          datosRespuestaJson: datos,
          estado: 'draft',
          ultimoEditorId: actor.sub,
          ultimaEdicionEn: new Date(),
        },
        select: { id: true, estado: true, ultimaEdicionEn: true },
      });
    } catch (e) {
      // Índice único parcial resp_form_grupo: dos miembros guardando a la vez.
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new AppError('RESPUESTA_DUPLICADA');
      }
      throw e;
    }
  }

  // RF-32 + O-01: la entrega se habilita con DOS gates combinados (AND):
  //   1) la bitácora del programa debe estar habilitada (gate de sección), y
  //   2) "a partir de la sesión N" (presentacionDesdeSesion, configurable). Sin N
  //      → basta con el gate de bitácora; con N → debe existir una sesión
  //      numeroSesion ≥ N ya ocurrida (fechaProgramada <= ahora).
  private async presentacionHabilitada(programa: {
    id: string;
    presentacionDesdeSesion: number | null;
    bitacoraHabilitadaEn: Date | null;
  }): Promise<boolean> {
    if (!programa.bitacoraHabilitadaEn) return false;
    const desde = programa.presentacionDesdeSesion;
    if (desde === null || desde === undefined) return true;
    const sesion = await this.prisma.sesion.findFirst({
      where: { programaId: programa.id, numeroSesion: { gte: desde }, fechaProgramada: { lte: new Date() } },
      select: { id: true },
    });
    return !!sesion;
  }

  private async assertPresentacionHabilitada(programa: {
    id: string;
    presentacionDesdeSesion: number | null;
    bitacoraHabilitadaEn: Date | null;
  }): Promise<void> {
    if (!(await this.presentacionHabilitada(programa))) {
      throw new AppError('PRESENTACION_NO_HABILITADA');
    }
  }
}
