import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { EstadoPrograma, EstadoSesion, Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { diskStorage } from 'multer';
import type { Response } from 'express';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';

import { PrismaService } from '../../../prisma.service';
import { S3Service } from '../../storage/S3Service';
import { MagicLinkService } from '../../auth/application/magic-link.service';
import { JwtAuthGuard, RolesGuard, Roles } from '../../auth/guards';
import { AppError } from '../../../shared/errors/AppError';
import { TranslationService } from '../../translation/translation.service';
import {
  PROGRAMA_TRANS_FIELDS,
  SESION_TRANS_FIELDS,
  TRANSLATABLE_LOCALES,
} from '../../../shared/i18n/translatable-locales';
import { startOfNextDayInTimeZone, dayNumberInTimeZone } from '../../../shared/utils/timezone';
import { SnapshotFormulariosService } from '../../formularios/application/snapshot-formularios.service';

const FACILITADOR_SLUG = 'facilitador';
const ESTUDIANTE_SLUG = 'estudiante';
const LEGACY_SLUG = 'participante_legacy';

// La presentación de una sesión puede ser un enlace o un archivo (PDF/PPT/PPTX).
const PRESENTACION_EXT_RE = /\.(pdf|ppt|pptx)$/i;

interface CreateProgramaDto {
  nombre: string;
  descripcion?: string | null;
  empresaId: string;
  facilitadorIds?: string[]; // C-01: N:M — uno o varios facilitadores (opcional en creación)
  timezone?: string;
  diasGracia?: number;
  fechaInicio?: string | null;
  fechaFin?: string | null;
  estado?: EstadoPrograma;
  // RF-01: nº de sesiones que tendrá el programa (dashboard completadas/totales).
  totalSesionesEsperadas?: number | null;
  // RF-32: la presentación final se habilita a partir de esta sesión.
  presentacionDesdeSesion?: number | null;
  // RF-46: selección explícita de qué plantillas globales congela el snapshot del
  // programa (una por tipo, opcional). Si se omite, el snapshot copia todas las
  // globales activas (comportamiento por defecto).
  plantillaGlobalIds?: string[];
}

interface UpdateProgramaDto {
  nombre?: string;
  descripcion?: string | null;
  facilitadorIds?: string[]; // C-01: si viene, reemplaza el conjunto de facilitadores
  timezone?: string;
  diasGracia?: number;
  fechaInicio?: string | null;
  fechaFin?: string | null;
  estado?: EstadoPrograma;
  totalSesionesEsperadas?: number | null; // RF-01
  presentacionDesdeSesion?: number | null; // RF-32
  activo?: boolean;
}

interface CreateSesionDto {
  numeroSesion: number;
  titulo: string;
  descripcion?: string | null;
  fechaProgramada: string;
  materialArchivoKey?: string | null;
  urlPresentacion?: string | null;
  presentacionArchivoKey?: string | null;
  urlGrabacion?: string | null;
  materialDesbloqueoEn?: string | null;
}

interface UpdateSesionDto extends Partial<CreateSesionDto> {
  estado?: EstadoSesion;
}

interface MatricularDto {
  usuarioId?: string;
  email?: string;
  nombre?: string;
  cargo?: string | null;
  area?: string | null;
  enviarInvitacion?: boolean;
  locale?: 'es' | 'pt';
}

// --------- Carga masiva de participantes (Excel) ---------

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Alias aceptados por columna en la plantilla (match case-insensitive + trim, es/pt).
const COLUMNAS_IMPORT = {
  email: ['email', 'correo', 'e-mail', 'e mail', 'correo electronico', 'correo electrónico'],
  nombre: ['nombre', 'nome', 'nombre completo', 'nome completo'],
  cargo: ['cargo', 'puesto', 'funcao', 'função'],
  area: ['area', 'área', 'departamento', 'area/departamento', 'área/departamento'],
} as const;

type EstadoFila = 'ok' | 'error' | 'aviso';

interface FilaImport {
  fila: number; // número de fila real en el Excel (1 = encabezado)
  email: string;
  nombre: string;
  cargo: string | null;
  area: string | null;
}

interface FilaReporte extends FilaImport {
  estado: EstadoFila;
  errores: string[]; // códigos FILA_* traducidos en el frontend
}

const PROGRAMA_SELECT = {
  id: true,
  nombre: true,
  descripcion: true,
  empresaId: true,
  estado: true,
  timezone: true,
  diasGracia: true,
  totalSesionesEsperadas: true, // RF-01
  presentacionDesdeSesion: true, // RF-32
  fechaInicio: true,
  fechaFin: true,
  activo: true,
  bitacoraHabilitadaEn: true, // O-01
  createdAt: true,
  updatedAt: true,
  empresa: { select: { id: true, nombre: true } },
  // C-01: N:M — lista de facilitadores asignados.
  facilitadores: {
    select: { usuario: { select: { id: true, nombre: true, email: true } } },
  },
  _count: { select: { sesiones: true, participantes: true } },
} satisfies Prisma.ProgramaSelect;

// Aplana `facilitadores: [{ usuario }]` a `facilitadores: [{ id, nombre, email }]` para el cliente.
function shapePrograma<T extends { facilitadores?: { usuario: unknown }[] }>(programa: T) {
  if (!programa?.facilitadores) return programa;
  return {
    ...programa,
    facilitadores: programa.facilitadores.map((f) => f.usuario),
  };
}

const SESION_SELECT = {
  id: true,
  programaId: true,
  numeroSesion: true,
  titulo: true,
  descripcion: true,
  fechaProgramada: true,
  materialArchivoKey: true,
  urlPresentacion: true,
  presentacionArchivoKey: true,
  urlGrabacion: true,
  materialDesbloqueoEn: true,
  estado: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.SesionSelect;

const PARTICIPANTE_SELECT = {
  id: true,
  programaId: true,
  usuarioId: true,
  activo: true,
  confirmadoEn: true,
  createdAt: true,
  usuario: {
    select: {
      id: true,
      nombre: true,
      email: true,
      cargo: true,
      area: true,
      puedeIniciarSesion: true,
      role: { select: { id: true, slug: true, nombre: true } },
    },
  },
} satisfies Prisma.ParticipanteProgramaSelect;

interface TraduccionProgramaDto {
  locale: string;
  nombre?: string;
  descripcion?: string;
  sesiones?: {
    numeroSesion: number;
    titulo?: string;
    descripcion?: string;
  }[];
}

// Autorización (Plan 2 §0.1, RNF-01/02): todos los endpoints de este controller
// requieren un JWT válido y rol `danalytics_admin`. Un rol distinto → 403 (FORBIDDEN).
// La regla se aplica a nivel de clase; endpoints con otros roles la sobreescriben con
// su propio @Roles(...) a nivel de método.
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('danalytics_admin')
@Controller('admin')
export class AdminProgramasController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly magicLink: MagicLinkService,
    private readonly translations: TranslationService,
    private readonly snapshots: SnapshotFormulariosService,
    private readonly s3: S3Service,
  ) {}

  private applyProgramaOverlay<T extends { id: string; nombre: string; descripcion: string | null }>(
    programa: T,
    overlay: Record<string, Record<string, string>>,
  ): T {
    const t = overlay[programa.id];
    if (!t) return programa;
    return {
      ...programa,
      nombre: t.nombre ?? programa.nombre,
      descripcion: t.descripcion ?? programa.descripcion,
    };
  }

  private applySesionOverlay<T extends { id: string; titulo: string; descripcion: string | null }>(
    sesion: T,
    overlay: Record<string, Record<string, string>>,
  ): T {
    const t = overlay[sesion.id];
    if (!t) return sesion;
    return {
      ...sesion,
      titulo: t.titulo ?? sesion.titulo,
      descripcion: t.descripcion ?? sesion.descripcion,
    };
  }

  // --------- Programa CRUD ---------

  @Get('programas')
  async listProgramas(
    @Query('empresaId') empresaId?: string,
    @Query('facilitadorId') facilitadorId?: string,
    @Query('estado') estado?: EstadoPrograma,
    @Query('activo') activo?: string,
    @Query('search') search?: string,
    @Query('locale') locale?: string,
  ) {
    const where: Prisma.ProgramaWhereInput = {};
    if (empresaId) where.empresaId = empresaId;
    if (facilitadorId) where.facilitadores = { some: { usuarioId: facilitadorId } };
    if (estado) where.estado = estado;
    if (activo === 'true') where.activo = true;
    else if (activo === 'false') where.activo = false;
    const term = search?.trim();
    if (term) {
      where.OR = [
        { nombre: { contains: term, mode: 'insensitive' } },
        { descripcion: { contains: term, mode: 'insensitive' } },
      ];
    }
    const programas = await this.prisma.programa.findMany({
      where,
      select: PROGRAMA_SELECT,
      orderBy: [{ activo: 'desc' }, { createdAt: 'desc' }],
    });

    if (!locale || locale === 'es' || programas.length === 0) return programas.map(shapePrograma);
    const overlay = await this.translations.applyOverlay(
      'Programa',
      programas.map(p => p.id),
      locale,
      PROGRAMA_TRANS_FIELDS,
    );
    return programas.map(p => shapePrograma(this.applyProgramaOverlay(p, overlay)));
  }

  // RF-04: dashboard de programas activos. Debe declararse ANTES de 'programas/:id'
  // para que Nest no intente resolver "dashboard" como un :id.
  @Get('programas/dashboard')
  async dashboard() {
    const programas = await this.prisma.programa.findMany({
      where: { estado: EstadoPrograma.activo },
      select: {
        id: true,
        nombre: true,
        totalSesionesEsperadas: true,
        sesiones: { select: { id: true, estado: true } },
      },
    });

    return Promise.all(
      programas.map(async (programa) => {
        const totalSesiones = programa.totalSesionesEsperadas ?? programa.sesiones.length;
        const sesionesCompletadas = programa.sesiones.filter(
          (s) => s.estado === EstadoSesion.completada,
        ).length;

        const [participantesActivos, asistencias] = await Promise.all([
          this.prisma.participantePrograma.count({ where: { programaId: programa.id, activo: true } }),
          this.prisma.asistencia.findMany({ where: { sesion: { programaId: programa.id } } }),
        ]);
        const asistenciaPromedio =
          asistencias.length > 0
            ? asistencias.filter((a) => a.presente).length / asistencias.length
            : null;

        return {
          id: programa.id,
          nombre: programa.nombre,
          sesionesCompletadas,
          totalSesiones,
          participantesActivos,
          asistenciaPromedio,
        };
      }),
    );
  }

  @Get('programas/:id')
  async getPrograma(@Param('id') id: string, @Query('locale') locale?: string) {
    const programa = await this.prisma.programa.findUnique({
      where: { id },
      select: {
        ...PROGRAMA_SELECT,
        sesiones: {
          select: SESION_SELECT,
          orderBy: { numeroSesion: 'asc' },
        },
        participantes: {
          select: PARTICIPANTE_SELECT,
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!programa) throw new AppError('PROGRAMA_NOT_FOUND');

    if (!locale || locale === 'es') return shapePrograma(programa);
    const [progOverlay, sesionOverlay] = await Promise.all([
      this.translations.applyOverlay('Programa', [programa.id], locale, PROGRAMA_TRANS_FIELDS),
      this.translations.applyOverlay(
        'Sesion',
        programa.sesiones.map(s => s.id),
        locale,
        SESION_TRANS_FIELDS,
      ),
    ]);
    return {
      ...this.applyProgramaOverlay(programa, progOverlay),
      sesiones: programa.sesiones.map(s => this.applySesionOverlay(s, sesionOverlay)),
    };
  }

  // RF-01/RF-32: valida la configuración de sesiones del programa.
  //  - total: nº de sesiones esperadas (null = sin definir). Debe ser entero ≥ 1 y
  //    nunca menor que las sesiones ya registradas.
  //  - desde: sesión a partir de la cual se habilita la presentación (null = sin
  //    gate de sesión). Debe ser entero ≥ 1 y, si hay total, no excederlo.
  private assertSesionesConfig(
    total: number | null | undefined,
    desde: number | null | undefined,
    registradas: number,
  ): void {
    if (total !== null && total !== undefined) {
      if (!Number.isInteger(total) || total < 1) throw new AppError('TOTAL_SESIONES_INVALIDO');
      if (total < registradas) {
        throw new AppError('TOTAL_SESIONES_INVALIDO', {
          message: `El total de sesiones (${total}) no puede ser menor que las ${registradas} ya registradas.`,
        });
      }
    }
    if (desde !== null && desde !== undefined) {
      if (!Number.isInteger(desde) || desde < 1) throw new AppError('PRESENTACION_DESDE_SESION_INVALIDA');
      if (total !== null && total !== undefined && desde > total) {
        throw new AppError('PRESENTACION_DESDE_SESION_INVALIDA', {
          message: `La presentación no puede habilitarse desde la sesión ${desde}: el programa tiene ${total} sesiones.`,
        });
      }
    }
  }

  @Post('programas')
  async createPrograma(@Body() body: CreateProgramaDto) {
    // C-01: N:M — valida cada facilitador (puede venir vacío; se asignan luego).
    const facilitadorIds = [...new Set(body.facilitadorIds ?? [])];
    for (const fid of facilitadorIds) await this.assertFacilitador(fid);
    // Aún no hay sesiones registradas al crear.
    this.assertSesionesConfig(body.totalSesionesEsperadas, body.presentacionDesdeSesion, 0);
    try {
      const programa = await this.prisma.programa.create({
        data: {
          id: randomUUID(),
          nombre: body.nombre,
          descripcion: body.descripcion ?? null,
          empresaId: body.empresaId,
          timezone: body.timezone ?? 'America/Bogota',
          diasGracia: body.diasGracia ?? 3, // RF-03/RN-03: 3 días hábiles
          totalSesionesEsperadas: body.totalSesionesEsperadas ?? null,
          presentacionDesdeSesion: body.presentacionDesdeSesion ?? null,
          fechaInicio: body.fechaInicio ? new Date(body.fechaInicio) : null,
          fechaFin: body.fechaFin ? new Date(body.fechaFin) : null,
          estado: body.estado ?? EstadoPrograma.borrador,
          facilitadores: facilitadorIds.length
            ? { create: facilitadorIds.map((usuarioId) => ({ usuarioId })) }
            : undefined,
        },
        select: PROGRAMA_SELECT,
      });

      // RF-46/RN-10: snapshot de formularios del programa.
      const seleccion = [...new Set(body.plantillaGlobalIds ?? [])].filter(Boolean);
      if (seleccion.length > 0) {
        // Selección explícita: congela SOLO las plantillas elegidas (una por tipo).
        // Se toma ya (aunque sea borrador) para fijar la versión elegida; la
        // activación posterior no la sobrescribe (ver updatePrograma).
        await this.snapshots.snapshotDesdeSeleccion(programa.id, seleccion);
      } else if (programa.estado === EstadoPrograma.activo) {
        // Sin selección: un programa creado DIRECTAMENTE en "activo" (seeds/alta
        // rápida) copia todas las globales activas.
        await this.snapshots.snapshotPrograma(programa.id);
      }
      return shapePrograma(programa);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2003') {
        throw new AppError('VALIDATION_ERROR', {
          message: 'empresaId o facilitadorId inválido',
        });
      }
      throw e;
    }
  }

  @Patch('programas/:id')
  async updatePrograma(@Param('id') id: string, @Body() body: UpdateProgramaDto) {
    const existing = await this.prisma.programa.findUnique({ where: { id } });
    if (!existing) throw new AppError('PROGRAMA_NOT_FOUND');
    let facilitadorIds: string[] | undefined;
    if (body.facilitadorIds !== undefined) {
      facilitadorIds = [...new Set(body.facilitadorIds)];
      for (const fid of facilitadorIds) await this.assertFacilitador(fid);
    }
    if (body.estado !== undefined && body.estado !== existing.estado) {
      this.assertTransicionValida(existing.estado, body.estado);
      // Al activar: todo grupo existente debe tener ≥2 integrantes (regla min-2).
      if (body.estado === EstadoPrograma.activo) {
        await this.assertGruposCompletos(id);
      }
    }
    // RF-01/RF-32: valida config de sesiones con los valores EFECTIVOS (lo que
    // venga en el body, o lo ya guardado) contra las sesiones ya registradas.
    if (body.totalSesionesEsperadas !== undefined || body.presentacionDesdeSesion !== undefined) {
      const total =
        body.totalSesionesEsperadas !== undefined ? body.totalSesionesEsperadas : existing.totalSesionesEsperadas;
      const desde =
        body.presentacionDesdeSesion !== undefined ? body.presentacionDesdeSesion : existing.presentacionDesdeSesion;
      const registradas = await this.prisma.sesion.count({ where: { programaId: id } });
      this.assertSesionesConfig(total, desde, registradas);
    }

    const data: Prisma.ProgramaUpdateInput = {};
    if (body.nombre !== undefined) data.nombre = body.nombre;
    if (body.descripcion !== undefined) data.descripcion = body.descripcion ?? null;
    // C-01: reemplaza el conjunto completo de facilitadores.
    if (facilitadorIds !== undefined) {
      data.facilitadores = {
        deleteMany: {},
        create: facilitadorIds.map((usuarioId) => ({ usuarioId })),
      };
    }
    if (body.timezone !== undefined) data.timezone = body.timezone;
    if (body.diasGracia !== undefined) data.diasGracia = body.diasGracia;
    if (body.totalSesionesEsperadas !== undefined) data.totalSesionesEsperadas = body.totalSesionesEsperadas;
    if (body.presentacionDesdeSesion !== undefined) data.presentacionDesdeSesion = body.presentacionDesdeSesion;
    if (body.fechaInicio !== undefined) data.fechaInicio = body.fechaInicio ? new Date(body.fechaInicio) : null;
    if (body.fechaFin !== undefined) data.fechaFin = body.fechaFin ? new Date(body.fechaFin) : null;
    if (body.estado !== undefined) data.estado = body.estado;
    if (body.activo !== undefined) data.activo = body.activo;
    const actualizado = await this.prisma.programa.update({ where: { id }, data, select: PROGRAMA_SELECT });

    // RF-46/RN-10 (Fase 2): al pasar borrador→activo se toma el snapshot de los
    // templates globales activos — PERO solo si el programa aún no tiene snapshot.
    // Si ya lo tiene (porque se eligieron plantillas al crearlo), se respeta esa
    // selección y no se agregan tipos excluidos.
    if (existing.estado === EstadoPrograma.borrador && body.estado === EstadoPrograma.activo) {
      const yaTieneSnapshot = await this.prisma.plantillaFormulario.count({ where: { programaId: id } });
      if (yaTieneSnapshot === 0) await this.snapshots.snapshotPrograma(id);
    }
    return shapePrograma(actualizado);
  }

  // --------- Facilitadores del programa (C-01, N:M) ---------

  @Post('programas/:id/facilitadores')
  async asignarFacilitador(@Param('id') programaId: string, @Body() body: { usuarioId: string }) {
    const programa = await this.prisma.programa.findUnique({ where: { id: programaId } });
    if (!programa) throw new AppError('PROGRAMA_NOT_FOUND');
    await this.assertFacilitador(body.usuarioId);
    try {
      await this.prisma.programaFacilitador.create({
        data: { programaId, usuarioId: body.usuarioId },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new AppError('FACILITADOR_YA_ASIGNADO');
      }
      throw e;
    }
    return shapePrograma(
      await this.prisma.programa.findUniqueOrThrow({ where: { id: programaId }, select: PROGRAMA_SELECT }),
    );
  }

  @Delete('programas/:id/facilitadores/:usuarioId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async quitarFacilitador(@Param('id') programaId: string, @Param('usuarioId') usuarioId: string) {
    await this.prisma.programaFacilitador.deleteMany({ where: { programaId, usuarioId } });
  }

  // O-01 (aclaración 2026-07-14): habilitar/deshabilitar la bitácora del programa.
  // Mientras `bitacoraHabilitadaEn` sea null, los grupos ven la bitácora bloqueada.
  // Lo pueden accionar admin (aquí) o facilitador (FacilitadorRetoController).
  @Post('programas/:id/bitacora/habilitar')
  async habilitarBitacora(@Param('id') programaId: string, @Body() body: { habilitar?: boolean }) {
    const programa = await this.prisma.programa.findUnique({ where: { id: programaId } });
    if (!programa) throw new AppError('PROGRAMA_NOT_FOUND');
    const habilitar = body?.habilitar !== false; // default true
    const actualizado = await this.prisma.programa.update({
      where: { id: programaId },
      data: { bitacoraHabilitadaEn: habilitar ? new Date() : null },
      select: { id: true, bitacoraHabilitadaEn: true },
    });
    return actualizado;
  }

  @Delete('programas/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async softDeletePrograma(@Param('id') id: string) {
    const existing = await this.prisma.programa.findUnique({ where: { id } });
    if (!existing) throw new AppError('PROGRAMA_NOT_FOUND');
    await this.prisma.programa.update({
      where: { id },
      data: { activo: false, estado: EstadoPrograma.cancelado },
    });
  }

  // --------- Sesion ---------

  @Get('programas/:id/sesiones')
  async listSesiones(@Param('id') programaId: string) {
    return this.prisma.sesion.findMany({
      where: { programaId },
      select: SESION_SELECT,
      orderBy: { numeroSesion: 'asc' },
    });
  }

  @Post('programas/:id/sesiones')
  async createSesion(@Param('id') programaId: string, @Body() body: CreateSesionDto) {
    const programa = await this.prisma.programa.findUnique({ where: { id: programaId } });
    if (!programa) throw new AppError('PROGRAMA_NOT_FOUND');
    // RF-01: no exceder el nº de sesiones esperadas configurado en el programa.
    if (programa.totalSesionesEsperadas != null && body.numeroSesion > programa.totalSesionesEsperadas) {
      throw new AppError('SESION_EXCEDE_TOTAL', {
        message: `El programa está configurado para ${programa.totalSesionesEsperadas} sesiones.`,
      });
    }
    const fechaProgramada = new Date(body.fechaProgramada);
    await this.assertSesionSchedule(programa, fechaProgramada);
    try {
      return await this.prisma.sesion.create({
        data: {
          id: randomUUID(),
          programaId,
          numeroSesion: body.numeroSesion,
          titulo: body.titulo,
          descripcion: body.descripcion ?? null,
          fechaProgramada,
          materialArchivoKey: body.materialArchivoKey ?? null,
          urlPresentacion: body.urlPresentacion ?? null,
          presentacionArchivoKey: body.presentacionArchivoKey ?? null,
          urlGrabacion: body.urlGrabacion ?? null,
          // RF-09/RN-05: si no se envía explícito, se calcula automáticamente
          // (00:01 del día siguiente a fechaProgramada, en la timezone del programa).
          materialDesbloqueoEn: body.materialDesbloqueoEn
            ? new Date(body.materialDesbloqueoEn)
            : startOfNextDayInTimeZone(fechaProgramada, programa.timezone),
        },
        select: SESION_SELECT,
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new AppError('SESION_DUPLICATE', {
          message: 'Ya existe una sesión con ese numeroSesion en el programa',
        });
      }
      throw e;
    }
  }

  @Patch('sesiones/:id')
  async updateSesion(@Param('id') id: string, @Body() body: UpdateSesionDto) {
    const existing = await this.prisma.sesion.findUnique({ where: { id } });
    if (!existing) throw new AppError('SESION_NOT_FOUND');
    const data: Prisma.SesionUpdateInput = {};
    if (body.numeroSesion !== undefined) {
      // RF-01: no exceder el nº de sesiones esperadas del programa.
      const prog = await this.prisma.programa.findUnique({
        where: { id: existing.programaId },
        select: { totalSesionesEsperadas: true },
      });
      if (prog?.totalSesionesEsperadas != null && body.numeroSesion > prog.totalSesionesEsperadas) {
        throw new AppError('SESION_EXCEDE_TOTAL', {
          message: `El programa está configurado para ${prog.totalSesionesEsperadas} sesiones.`,
        });
      }
      data.numeroSesion = body.numeroSesion;
    }
    if (body.titulo !== undefined) data.titulo = body.titulo;
    if (body.descripcion !== undefined) data.descripcion = body.descripcion ?? null;
    // Si cambia la fecha, valida rango del programa e intervalo mínimo (excluyéndose
    // a sí misma) antes de tocar nada. Se reutiliza `programa` para materialDesbloqueoEn.
    const programa =
      body.fechaProgramada !== undefined
        ? await this.prisma.programa.findUnique({ where: { id: existing.programaId } })
        : null;
    if (body.fechaProgramada !== undefined) {
      const fechaProgramada = new Date(body.fechaProgramada);
      await this.assertSesionSchedule(programa!, fechaProgramada, id);
      data.fechaProgramada = fechaProgramada;
    }
    if (body.materialArchivoKey !== undefined) data.materialArchivoKey = body.materialArchivoKey ?? null;
    if (body.urlPresentacion !== undefined) data.urlPresentacion = body.urlPresentacion ?? null;
    if (body.presentacionArchivoKey !== undefined) data.presentacionArchivoKey = body.presentacionArchivoKey ?? null;
    if (body.urlGrabacion !== undefined) data.urlGrabacion = body.urlGrabacion ?? null;
    if (body.materialDesbloqueoEn !== undefined) {
      data.materialDesbloqueoEn = body.materialDesbloqueoEn ? new Date(body.materialDesbloqueoEn) : null;
    } else if (body.fechaProgramada !== undefined) {
      // RF-09/RN-05: si cambia fechaProgramada y no se envía materialDesbloqueoEn
      // explícito, se recalcula automáticamente en la timezone del programa.
      data.materialDesbloqueoEn = startOfNextDayInTimeZone(new Date(body.fechaProgramada), programa!.timezone);
    }
    if (body.estado !== undefined) data.estado = body.estado;
    try {
      return await this.prisma.sesion.update({ where: { id }, data, select: SESION_SELECT });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new AppError('SESION_DUPLICATE');
      }
      throw e;
    }
  }

  @Delete('sesiones/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteSesion(@Param('id') id: string) {
    const existing = await this.prisma.sesion.findUnique({ where: { id } });
    if (!existing) throw new AppError('SESION_NOT_FOUND');
    await this.prisma.sesion.delete({ where: { id } });
  }

  /**
   * Presigned PUT URL para subir el archivo de presentación de la sesión (PDF/PPT/PPTX).
   * Key (skill s3-key-naming): <empresa>/<programa_slug>_<programaId>/sesion_<numeroSesion>/presentacion/<archivo>.
   * El id del programa en el segmento desambigua programas homónimos de una misma empresa
   * y mantiene la ruta estable; el slug del nombre la conserva legible en la consola de S3.
   */
  @Post('sesiones/:id/presign-presentacion')
  @HttpCode(HttpStatus.OK)
  async presignPresentacion(
    @Param('id') sesionId: string,
    @Body() body: { filename: string; contentType: string },
  ): Promise<{ uploadUrl: string; key: string }> {
    if (!this.s3.isConfigured) throw new AppError('S3_NOT_CONFIGURED');
    if (!body?.filename || !PRESENTACION_EXT_RE.test(body.filename)) {
      throw new AppError('PRESENTACION_FORMATO_INVALIDO');
    }
    const sesion = await this.prisma.sesion.findUnique({
      where: { id: sesionId },
      select: { numeroSesion: true, programa: { select: { id: true, nombre: true, empresa: { select: { nombre: true } } } } },
    });
    if (!sesion) throw new AppError('SESION_NOT_FOUND');

    const empresa = S3Service.slugifyPathSegment(sesion.programa.empresa.nombre) || 'empresa';
    const programaSlug = S3Service.slugifyPathSegment(sesion.programa.nombre) || 'programa';
    const prefix = `${empresa}/${programaSlug}_${sesion.programa.id}/sesion_${sesion.numeroSesion}/presentacion`;

    const key = this.s3.generateKey(prefix, body.filename);
    const uploadUrl = await this.s3.getPresignedPutUrl(key, body.contentType);
    return { uploadUrl, key };
  }

  /** Elimina el archivo de presentación de la sesión (S3 + BD). */
  @Delete('sesiones/:id/presentacion-archivo')
  @HttpCode(HttpStatus.NO_CONTENT)
  async eliminarPresentacionArchivo(@Param('id') sesionId: string) {
    const sesion = await this.prisma.sesion.findUnique({
      where: { id: sesionId },
      select: { presentacionArchivoKey: true },
    });
    if (!sesion) throw new AppError('SESION_NOT_FOUND');
    if (!sesion.presentacionArchivoKey) return;
    const key = sesion.presentacionArchivoKey;
    await this.prisma.sesion.update({ where: { id: sesionId }, data: { presentacionArchivoKey: null } });
    try {
      await this.s3.deleteObject(key);
    } catch (err) {
      console.error(`[AdminProgramasController] Error eliminando objeto S3 ${key}:`, err);
    }
  }

  // --------- Participante ---------

  @Get('programas/:id/participantes')
  async listParticipantes(@Param('id') programaId: string) {
    return this.prisma.participantePrograma.findMany({
      where: { programaId },
      select: PARTICIPANTE_SELECT,
      orderBy: { createdAt: 'asc' },
    });
  }

  // Plantilla Excel para la carga masiva. Ruta sin `:id` (es genérica); se declara
  // antes de las rutas con `:id` por claridad, aunque no colisiona (3 segmentos distintos).
  @Get('programas/participantes/plantilla')
  async descargarPlantillaParticipantes(@Res() res: Response) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const ExcelJS = require('exceljs');
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('Participantes');
      ws.columns = [
        { header: 'email', key: 'email', width: 34 },
        { header: 'nombre', key: 'nombre', width: 28 },
        { header: 'cargo', key: 'cargo', width: 22 },
        { header: 'area', key: 'area', width: 22 },
      ];
      ws.getRow(1).font = { bold: true };
      ws.addRow({
        email: 'juan.perez@empresa.com',
        nombre: 'Juan Pérez',
        cargo: 'Analista',
        area: 'Operaciones',
      });
      const buffer = await wb.xlsx.writeBuffer();
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      res.setHeader('Content-Disposition', 'attachment; filename="plantilla_matricula.xlsx"');
      res.end(Buffer.from(buffer));
    } catch (e) {
      throw new AppError('EXCEL_GENERATION_FAILED', { cause: e });
    }
  }

  // Carga masiva: `validarSolo=1` hace un dry-run (devuelve el reporte sin escribir);
  // sin ese flag registra en modo "todo o nada" dentro de una transacción.
  @Post('programas/:id/participantes/importar')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    FileInterceptor('archivo', {
      storage: diskStorage({
        destination: os.tmpdir(),
        filename: (_req, file, cb) => cb(null, randomUUID() + path.extname(file.originalname)),
      }),
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  async importarParticipantes(
    @Param('id') programaId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { validarSolo?: string; enviarInvitacion?: string; locale?: 'es' | 'pt' },
  ) {
    const programa = await this.prisma.programa.findUnique({ where: { id: programaId } });
    if (!programa) {
      if (file) {
        try {
          fs.unlinkSync(file.path);
        } catch {
          /* ignore */
        }
      }
      throw new AppError('PROGRAMA_NOT_FOUND');
    }
    if (!file) throw new AppError('ARCHIVO_REQUIRED');

    try {
      const ext = path.extname(file.originalname).toLowerCase();
      if (ext !== '.xlsx' && ext !== '.xls') {
        throw new AppError('ARCHIVO_INVALID', {
          message: 'Solo se admiten archivos Excel (.xlsx, .xls)',
        });
      }

      const { filas, columnasFaltantes } = this.parsearArchivoParticipantes(file.path);
      if (columnasFaltantes.length > 0) {
        throw new AppError('IMPORT_COLUMNAS_FALTANTES', {
          message: `Faltan columnas obligatorias: ${columnasFaltantes.join(', ')}`,
          details: { columnasFaltantes },
        });
      }

      const reporte = await this.validarFilasMatricula(programa, filas);
      const resumen = {
        total: reporte.length,
        ok: reporte.filter((f) => f.estado === 'ok').length,
        error: reporte.filter((f) => f.estado !== 'ok').length,
      };

      const validarSolo = body.validarSolo === '1' || body.validarSolo === 'true';
      // No registrar si es dry-run, si hay filas problemáticas, o si no hay nada válido.
      if (validarSolo || resumen.error > 0 || resumen.ok === 0) {
        return { registrado: false, resumen, filas: reporte };
      }

      // Todo-o-nada: crea usuarios faltantes + participaciones en una sola transacción.
      const usuarioIds = await this.prisma.$transaction(async (tx) => {
        const ids: string[] = [];
        for (const f of reporte) {
          const usuarioId = await this.resolverUsuarioPorEmail(tx, programa, {
            email: f.email,
            nombre: f.nombre,
            cargo: f.cargo,
            area: f.area,
          });
          await tx.participantePrograma.create({
            data: { id: randomUUID(), programaId, usuarioId },
          });
          ids.push(usuarioId);
        }
        return ids;
      });

      // Invitaciones fuera de la transacción: un fallo de email no revierte la matrícula.
      const enviarInvitacion =
        body.enviarInvitacion !== '0' && body.enviarInvitacion !== 'false';
      if (enviarInvitacion) {
        for (const usuarioId of usuarioIds) {
          try {
            await this.magicLink.createAndSend({
              usuarioId,
              locale: body.locale ?? 'es',
              propositoRedirect: `/programa/${programaId}`,
            });
          } catch (mailErr) {
            console.error('[importarParticipantes] fallo al enviar invitación:', mailErr);
          }
        }
      }

      return { registrado: true, resumen, filas: reporte, matriculados: usuarioIds.length };
    } finally {
      try {
        fs.unlinkSync(file.path);
      } catch {
        /* ignore */
      }
    }
  }

  @Post('programas/:id/participantes')
  async matricular(@Param('id') programaId: string, @Body() body: MatricularDto) {
    const programa = await this.prisma.programa.findUnique({ where: { id: programaId } });
    if (!programa) throw new AppError('PROGRAMA_NOT_FOUND');

    let usuarioId = body.usuarioId ?? null;

    if (!usuarioId) {
      usuarioId = await this.resolverUsuarioPorEmail(this.prisma, programa, {
        email: body.email,
        nombre: body.nombre,
        cargo: body.cargo,
        area: body.area,
      });
    } else {
      const existente = await this.prisma.usuario.findUnique({
        where: { id: usuarioId },
        include: { role: true },
      });
      if (!existente) throw new AppError('USUARIO_NOT_FOUND');
      // Un estudiante de otra empresa no puede matricularse en este programa.
      if (existente.empresaId && existente.empresaId !== programa.empresaId) {
        throw new AppError('USUARIO_OTRA_EMPRESA', {
          message: 'El usuario pertenece a otra empresa',
        });
      }
      await this.promoverAEstudianteSiLegacy(existente.id, existente.role?.slug);
    }

    try {
      const participante = await this.prisma.participantePrograma.create({
        data: {
          id: randomUUID(),
          programaId,
          usuarioId,
        },
        select: PARTICIPANTE_SELECT,
      });

      if (body.enviarInvitacion !== false) {
        try {
          await this.magicLink.createAndSend({
            usuarioId,
            locale: body.locale ?? 'es',
            propositoRedirect: `/programa/${programaId}`,
          });
        } catch (mailErr) {
          // La matrícula ya se guardó; el fallo de email no rompe la operación.
          console.error('[matricular] fallo al enviar invitación:', mailErr);
        }
      }

      return participante;
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new AppError('PARTICIPANTE_DUPLICATE');
      }
      throw e;
    }
  }

  @Delete('programas/:programaId/participantes/:participanteId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async desmatricular(
    @Param('programaId') programaId: string,
    @Param('participanteId') participanteId: string,
  ) {
    const p = await this.prisma.participantePrograma.findUnique({
      where: { id: participanteId },
    });
    if (!p || p.programaId !== programaId) throw new AppError('PARTICIPANTE_NOT_FOUND');
    await this.prisma.participantePrograma.delete({ where: { id: participanteId } });
  }

  // --------- Traducciones ---------

  @Get('programas/:id/traducciones/:locale')
  async getProgramaTraducciones(@Param('id') id: string, @Param('locale') locale: string) {
    const programa = await this.prisma.programa.findUnique({
      where: { id },
      include: {
        sesiones: {
          select: { id: true, numeroSesion: true },
          orderBy: { numeroSesion: 'asc' },
        },
      },
    });
    if (!programa) throw new AppError('PROGRAMA_NOT_FOUND');

    const [progFields, sesionOverlay] = await Promise.all([
      this.translations.getForEntity('Programa', id, locale),
      this.translations.applyOverlay(
        'Sesion',
        programa.sesiones.map(s => s.id),
        locale,
        SESION_TRANS_FIELDS,
      ),
    ]);

    return {
      locale,
      programa: progFields,
      sesiones: programa.sesiones.map(s => ({
        id: s.id,
        numeroSesion: s.numeroSesion,
        campos: sesionOverlay[s.id] ?? {},
      })),
    };
  }

  @Post('programas/:id/traducciones')
  async upsertProgramaTraducciones(
    @Param('id') id: string,
    @Body() body: TraduccionProgramaDto,
  ): Promise<{ total: number; sesiones: number }> {
    if (!body?.locale) {
      throw new AppError('VALIDATION_ERROR', { message: 'Falta campo "locale".' });
    }
    if (!TRANSLATABLE_LOCALES.includes(body.locale)) {
      throw new AppError('VALIDATION_ERROR', { message: `Locale no soportado: ${body.locale}` });
    }

    const programa = await this.prisma.programa.findUnique({
      where: { id },
      include: {
        sesiones: { select: { id: true, numeroSesion: true } },
      },
    });
    if (!programa) throw new AppError('PROGRAMA_NOT_FOUND');

    let total = 0;
    let sesionesCount = 0;

    const programaFields: Record<string, string | undefined> = {
      nombre: body.nombre,
      descripcion: body.descripcion,
    };
    const progEntries = Object.entries(programaFields).filter(([, v]) => v !== undefined);
    if (progEntries.length > 0) {
      await this.translations.upsertForEntity(
        'Programa',
        id,
        body.locale,
        Object.fromEntries(progEntries),
      );
      total += progEntries.filter(([, v]) => v?.trim()).length;
    }

    const sesionMap = new Map(programa.sesiones.map(s => [s.numeroSesion, s]));
    for (const sesionInput of body.sesiones ?? []) {
      const sesion = sesionMap.get(sesionInput.numeroSesion);
      if (!sesion) continue;
      const sesionFields: Record<string, string | undefined> = {
        titulo: sesionInput.titulo,
        descripcion: sesionInput.descripcion,
      };
      const sesionEntries = Object.entries(sesionFields).filter(([, v]) => v !== undefined);
      if (sesionEntries.length > 0) {
        await this.translations.upsertForEntity(
          'Sesion',
          sesion.id,
          body.locale,
          Object.fromEntries(sesionEntries),
        );
        total += sesionEntries.filter(([, v]) => v?.trim()).length;
        sesionesCount++;
      }
    }

    return { total, sesiones: sesionesCount };
  }

  // --------- Helpers ---------

  // RF-02: máquina de estados de Programa. "cancelado" es alcanzable desde
  // cualquier estado (mismo criterio que el soft-delete de más arriba);
  // el resto de transiciones sigue el flujo lineal borrador→activo→finalizado.
  private static readonly TRANSICIONES_VALIDAS: Record<EstadoPrograma, EstadoPrograma[]> = {
    [EstadoPrograma.borrador]: [EstadoPrograma.activo],
    [EstadoPrograma.activo]: [EstadoPrograma.finalizado],
    [EstadoPrograma.finalizado]: [],
    [EstadoPrograma.cancelado]: [],
  };

  private assertTransicionValida(desde: EstadoPrograma, hacia: EstadoPrograma) {
    const permitido =
      hacia === EstadoPrograma.cancelado ||
      AdminProgramasController.TRANSICIONES_VALIDAS[desde].includes(hacia);
    if (!permitido) {
      throw new AppError('PROGRAMA_TRANSICION_INVALIDA', {
        message: `No se puede pasar de "${desde}" a "${hacia}"`,
      });
    }
  }

  // Regla min-2: al activar el programa, ningún grupo existente puede tener
  // menos de 2 integrantes (los grupos vacíos/incompletos deben completarse o
  // eliminarse antes de activar).
  private async assertGruposCompletos(programaId: string) {
    const grupos = await this.prisma.grupo.findMany({
      where: { programaId },
      select: { _count: { select: { miembros: true } } },
    });
    if (grupos.some((g) => g._count.miembros < 2)) {
      throw new AppError('GRUPO_MIN_INTEGRANTES');
    }
  }

  // Separación mínima entre sesiones del mismo programa (aclaración 2026-07-15):
  // no se pueden agendar dos sesiones a menos de 4 horas de distancia.
  private static readonly SESION_INTERVALO_MIN_MS = 4 * 60 * 60 * 1000;

  // Valida que la fecha de una sesión (1) caiga dentro del rango de fechas del
  // programa y (2) mantenga ≥4 h de separación con cualquier otra sesión del
  // mismo programa. `excludeSesionId` evita que una sesión choque consigo misma
  // al editarla.
  private async assertSesionSchedule(
    programa: { id: string; timezone: string; fechaInicio: Date | null; fechaFin: Date | null },
    fechaProgramada: Date,
    excludeSesionId?: string,
  ) {
    if (Number.isNaN(fechaProgramada.getTime())) {
      throw new AppError('VALIDATION_ERROR', { message: 'fechaProgramada inválida' });
    }

    // (1) Dentro del rango del programa. Los límites se guardan como medianoche
    // UTC (fechas sin hora), así que se comparan como día calendario: el de la
    // sesión en la timezone del programa vs. el del límite en UTC.
    const diaSesion = dayNumberInTimeZone(fechaProgramada, programa.timezone);
    if (programa.fechaInicio && diaSesion < dayNumberInTimeZone(programa.fechaInicio, 'UTC')) {
      throw new AppError('SESION_FUERA_DE_RANGO', {
        message: 'La fecha de la sesión es anterior al inicio del programa',
      });
    }
    if (programa.fechaFin && diaSesion > dayNumberInTimeZone(programa.fechaFin, 'UTC')) {
      throw new AppError('SESION_FUERA_DE_RANGO', {
        message: 'La fecha de la sesión es posterior al fin del programa',
      });
    }

    // (2) Separación mínima con las demás sesiones del programa.
    const hermanas = await this.prisma.sesion.findMany({
      where: {
        programaId: programa.id,
        ...(excludeSesionId ? { id: { not: excludeSesionId } } : {}),
      },
      select: { fechaProgramada: true },
    });
    const t = fechaProgramada.getTime();
    const choca = hermanas.some(
      (s) => Math.abs(s.fechaProgramada.getTime() - t) < AdminProgramasController.SESION_INTERVALO_MIN_MS,
    );
    if (choca) {
      throw new AppError('SESION_INTERVALO_MINIMO', {
        message: 'Debe haber al menos 4 horas entre sesiones del mismo programa',
      });
    }
  }

  private async assertFacilitador(usuarioId: string) {
    const u = await this.prisma.usuario.findUnique({
      where: { id: usuarioId },
      include: { role: true },
    });
    if (!u) throw new AppError('FACILITADOR_INVALID', { message: 'Usuario no existe' });
    if (u.role?.slug !== FACILITADOR_SLUG) {
      throw new AppError('FACILITADOR_INVALID', {
        message: `El usuario ${usuarioId} no tiene role=facilitador`,
      });
    }
  }

  private async promoverAEstudianteSiLegacy(
    usuarioId: string,
    slug: string | undefined,
    db?: Prisma.TransactionClient,
  ) {
    if (slug !== LEGACY_SLUG) return;
    const client = db ?? this.prisma;
    const estudianteRole = await client.role.findUniqueOrThrow({
      where: { slug: ESTUDIANTE_SLUG },
    });
    await client.usuario.update({
      where: { id: usuarioId },
      data: { roleId: estudianteRole.id, puedeIniciarSesion: true },
    });
  }

  /**
   * Resuelve el `usuarioId` para matricular por email dentro de la empresa del programa:
   * reutiliza el estudiante existente (promoviéndolo si es `participante_legacy`) o crea uno
   * nuevo. Lanza `AppError` en conflictos (email/nombre faltante, email en otra empresa).
   * Acepta un cliente Prisma (base o de transacción) para reusarse en la carga masiva.
   */
  private async resolverUsuarioPorEmail(
    db: Prisma.TransactionClient,
    programa: { empresaId: string | null },
    datos: { email?: string; nombre?: string; cargo?: string | null; area?: string | null },
  ): Promise<string> {
    const email = datos.email?.toLowerCase().trim();
    if (!email) {
      throw new AppError('VALIDATION_ERROR', { message: 'Debes enviar usuarioId o email' });
    }
    // Unicidad del estudiante por email: el email es único por empresa
    // (@@unique([empresaId, email])), así que se busca en TODAS las empresas.
    // Si ya existe en la MISMA empresa se reutiliza; si existe en OTRA empresa se bloquea.
    const conMismoEmail = await db.usuario.findMany({
      where: { email },
      include: { role: true },
    });
    const existente = conMismoEmail.find((u) => u.empresaId === programa.empresaId);
    const enOtraEmpresa = conMismoEmail.find(
      (u) => u.empresaId && u.empresaId !== programa.empresaId,
    );
    if (existente) {
      await this.promoverAEstudianteSiLegacy(existente.id, existente.role?.slug, db);
      return existente.id;
    }
    if (enOtraEmpresa) {
      throw new AppError('USUARIO_OTRA_EMPRESA', {
        message: 'Ya existe un usuario con ese email en otra empresa',
      });
    }
    if (!datos.nombre) {
      throw new AppError('VALIDATION_ERROR', {
        message: 'Debes enviar nombre para crear un nuevo estudiante',
      });
    }
    const estudianteRole = await db.role.findUniqueOrThrow({ where: { slug: ESTUDIANTE_SLUG } });
    const nuevo = await db.usuario.create({
      data: {
        id: randomUUID(),
        nombre: datos.nombre,
        email,
        empresaId: programa.empresaId,
        cargo: datos.cargo ?? null,
        area: datos.area ?? null,
        roleId: estudianteRole.id,
        puedeIniciarSesion: true,
      },
    });
    return nuevo.id;
  }

  // --------- Carga masiva de participantes (Excel) ---------

  /** Lee la primera hoja del Excel y mapea columnas (case-insensitive, con alias es/pt). */
  private parsearArchivoParticipantes(filePath: string): {
    filas: FilaImport[];
    columnasFaltantes: string[];
  } {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const XLSX = require('xlsx');
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) return { filas: [], columnasFaltantes: ['email', 'nombre'] };

    const rows: unknown[][] = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
      header: 1,
      defval: '',
    });
    const nonEmpty = rows.filter((r) => r.some((c) => String(c ?? '').trim() !== ''));
    if (nonEmpty.length === 0) return { filas: [], columnasFaltantes: ['email', 'nombre'] };

    const header = nonEmpty[0].map((c) => String(c ?? '').trim().toLowerCase());
    const idx: Record<keyof typeof COLUMNAS_IMPORT, number> = {
      email: header.findIndex((h) => (COLUMNAS_IMPORT.email as readonly string[]).includes(h)),
      nombre: header.findIndex((h) => (COLUMNAS_IMPORT.nombre as readonly string[]).includes(h)),
      cargo: header.findIndex((h) => (COLUMNAS_IMPORT.cargo as readonly string[]).includes(h)),
      area: header.findIndex((h) => (COLUMNAS_IMPORT.area as readonly string[]).includes(h)),
    };

    const columnasFaltantes: string[] = [];
    if (idx.email < 0) columnasFaltantes.push('email');
    if (idx.nombre < 0) columnasFaltantes.push('nombre');
    if (columnasFaltantes.length > 0) return { filas: [], columnasFaltantes };

    const cell = (row: unknown[], c: number) => (c >= 0 ? String(row[c] ?? '').trim() : '');
    const filas = nonEmpty.slice(1).map((row, i) => ({
      fila: i + 2, // +1 por índice base-0, +1 por el encabezado
      email: cell(row, idx.email),
      nombre: cell(row, idx.nombre),
      cargo: cell(row, idx.cargo) || null,
      area: cell(row, idx.area) || null,
    }));
    return { filas, columnasFaltantes: [] };
  }

  /**
   * Valida las filas contra la BD sin escribir nada. Clasifica cada fila en:
   * `error` (bloquea el registro), `aviso` (ya matriculado, también bloquea el "todo o nada")
   * u `ok`. Prefetch en 2 queries para evitar N+1.
   */
  private async validarFilasMatricula(
    programa: { id: string; empresaId: string | null },
    filas: FilaImport[],
  ): Promise<FilaReporte[]> {
    const normalizados = filas.map((f) => f.email.toLowerCase().trim());
    const conteo = new Map<string, number>();
    for (const e of normalizados) if (e) conteo.set(e, (conteo.get(e) ?? 0) + 1);

    const emailsUnicos = [...conteo.keys()];
    const usuarios = emailsUnicos.length
      ? await this.prisma.usuario.findMany({
          where: { email: { in: emailsUnicos } },
          select: { id: true, email: true, empresaId: true },
        })
      : [];
    const porEmail = new Map<string, { id: string; empresaId: string | null }[]>();
    for (const u of usuarios) {
      const key = (u.email ?? '').toLowerCase().trim();
      if (!porEmail.has(key)) porEmail.set(key, []);
      porEmail.get(key)!.push({ id: u.id, empresaId: u.empresaId });
    }

    const idsEnEmpresa = usuarios.filter((u) => u.empresaId === programa.empresaId).map((u) => u.id);
    const yaMatriculados = idsEnEmpresa.length
      ? await this.prisma.participantePrograma.findMany({
          where: { programaId: programa.id, usuarioId: { in: idsEnEmpresa } },
          select: { usuarioId: true },
        })
      : [];
    const setMatriculados = new Set(yaMatriculados.map((p) => p.usuarioId));

    return filas.map((f, i) => {
      const errores: string[] = [];
      const email = normalizados[i];
      const emailValido = !!email && EMAIL_REGEX.test(email);

      if (!email) errores.push('FILA_EMAIL_REQUERIDO');
      else if (!emailValido) errores.push('FILA_EMAIL_INVALIDO');
      if (!f.nombre) errores.push('FILA_NOMBRE_REQUERIDO');
      if (email && (conteo.get(email) ?? 0) > 1) errores.push('FILA_EMAIL_DUPLICADO_ARCHIVO');

      if (emailValido) {
        const matches = porEmail.get(email) ?? [];
        const enEmpresa = matches.find((u) => u.empresaId === programa.empresaId);
        const otraEmpresa = matches.find((u) => u.empresaId && u.empresaId !== programa.empresaId);
        if (enEmpresa && setMatriculados.has(enEmpresa.id)) errores.push('FILA_YA_MATRICULADO');
        else if (!enEmpresa && otraEmpresa) errores.push('FILA_OTRA_EMPRESA');
      }

      const soloAviso = errores.length > 0 && errores.every((e) => e === 'FILA_YA_MATRICULADO');
      const estado: EstadoFila = errores.length === 0 ? 'ok' : soloAviso ? 'aviso' : 'error';
      return {
        fila: f.fila,
        email: f.email.trim(),
        nombre: f.nombre,
        cargo: f.cargo,
        area: f.area,
        estado,
        errores,
      };
    });
  }
}
