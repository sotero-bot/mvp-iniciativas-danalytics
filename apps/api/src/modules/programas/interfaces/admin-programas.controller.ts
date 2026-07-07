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
} from '@nestjs/common';
import { EstadoPrograma, EstadoSesion, Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';

import { PrismaService } from '../../../prisma.service';
import { MagicLinkService } from '../../auth/application/magic-link.service';
import { AppError } from '../../../shared/errors/AppError';
import { TranslationService } from '../../translation/translation.service';
import {
  PROGRAMA_TRANS_FIELDS,
  SESION_TRANS_FIELDS,
  TRANSLATABLE_LOCALES,
} from '../../../shared/i18n/translatable-locales';

const FACILITADOR_SLUG = 'facilitador';
const ESTUDIANTE_SLUG = 'estudiante';
const LEGACY_SLUG = 'participante_legacy';

interface CreateProgramaDto {
  nombre: string;
  descripcion?: string | null;
  empresaId: string;
  facilitadorId: string;
  timezone?: string;
  diasGracia?: number;
  fechaInicio?: string | null;
  fechaFin?: string | null;
  estado?: EstadoPrograma;
}

interface UpdateProgramaDto {
  nombre?: string;
  descripcion?: string | null;
  facilitadorId?: string;
  timezone?: string;
  diasGracia?: number;
  fechaInicio?: string | null;
  fechaFin?: string | null;
  estado?: EstadoPrograma;
  activo?: boolean;
}

interface CreateSesionDto {
  numeroSesion: number;
  titulo: string;
  descripcion?: string | null;
  fechaProgramada: string;
  materialArchivoKey?: string | null;
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

const PROGRAMA_SELECT = {
  id: true,
  nombre: true,
  descripcion: true,
  empresaId: true,
  facilitadorId: true,
  estado: true,
  timezone: true,
  diasGracia: true,
  fechaInicio: true,
  fechaFin: true,
  activo: true,
  createdAt: true,
  updatedAt: true,
  empresa: { select: { id: true, nombre: true } },
  facilitador: { select: { id: true, nombre: true, email: true } },
  _count: { select: { sesiones: true, participantes: true } },
} satisfies Prisma.ProgramaSelect;

const SESION_SELECT = {
  id: true,
  programaId: true,
  numeroSesion: true,
  titulo: true,
  descripcion: true,
  fechaProgramada: true,
  materialArchivoKey: true,
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

@Controller('admin')
export class AdminProgramasController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly magicLink: MagicLinkService,
    private readonly translations: TranslationService,
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
    if (facilitadorId) where.facilitadorId = facilitadorId;
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

    if (!locale || locale === 'es' || programas.length === 0) return programas;
    const overlay = await this.translations.applyOverlay(
      'Programa',
      programas.map(p => p.id),
      locale,
      PROGRAMA_TRANS_FIELDS,
    );
    return programas.map(p => this.applyProgramaOverlay(p, overlay));
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

    if (!locale || locale === 'es') return programa;
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

  @Post('programas')
  async createPrograma(@Body() body: CreateProgramaDto) {
    await this.assertFacilitador(body.facilitadorId);
    try {
      return await this.prisma.programa.create({
        data: {
          id: randomUUID(),
          nombre: body.nombre,
          descripcion: body.descripcion ?? null,
          empresaId: body.empresaId,
          facilitadorId: body.facilitadorId,
          timezone: body.timezone ?? 'America/Bogota',
          diasGracia: body.diasGracia ?? 3, // RF-03/RN-03: 3 días hábiles
          fechaInicio: body.fechaInicio ? new Date(body.fechaInicio) : null,
          fechaFin: body.fechaFin ? new Date(body.fechaFin) : null,
          estado: body.estado ?? EstadoPrograma.borrador,
        },
        select: PROGRAMA_SELECT,
      });
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
    if (body.facilitadorId !== undefined) {
      await this.assertFacilitador(body.facilitadorId);
    }
    const data: Prisma.ProgramaUpdateInput = {};
    if (body.nombre !== undefined) data.nombre = body.nombre;
    if (body.descripcion !== undefined) data.descripcion = body.descripcion ?? null;
    if (body.facilitadorId !== undefined) data.facilitador = { connect: { id: body.facilitadorId } };
    if (body.timezone !== undefined) data.timezone = body.timezone;
    if (body.diasGracia !== undefined) data.diasGracia = body.diasGracia;
    if (body.fechaInicio !== undefined) data.fechaInicio = body.fechaInicio ? new Date(body.fechaInicio) : null;
    if (body.fechaFin !== undefined) data.fechaFin = body.fechaFin ? new Date(body.fechaFin) : null;
    if (body.estado !== undefined) data.estado = body.estado;
    if (body.activo !== undefined) data.activo = body.activo;
    return this.prisma.programa.update({ where: { id }, data, select: PROGRAMA_SELECT });
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
    try {
      return await this.prisma.sesion.create({
        data: {
          id: randomUUID(),
          programaId,
          numeroSesion: body.numeroSesion,
          titulo: body.titulo,
          descripcion: body.descripcion ?? null,
          fechaProgramada: new Date(body.fechaProgramada),
          materialArchivoKey: body.materialArchivoKey ?? null,
          urlGrabacion: body.urlGrabacion ?? null,
          materialDesbloqueoEn: body.materialDesbloqueoEn ? new Date(body.materialDesbloqueoEn) : null,
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
    if (body.numeroSesion !== undefined) data.numeroSesion = body.numeroSesion;
    if (body.titulo !== undefined) data.titulo = body.titulo;
    if (body.descripcion !== undefined) data.descripcion = body.descripcion ?? null;
    if (body.fechaProgramada !== undefined) data.fechaProgramada = new Date(body.fechaProgramada);
    if (body.materialArchivoKey !== undefined) data.materialArchivoKey = body.materialArchivoKey ?? null;
    if (body.urlGrabacion !== undefined) data.urlGrabacion = body.urlGrabacion ?? null;
    if (body.materialDesbloqueoEn !== undefined) {
      data.materialDesbloqueoEn = body.materialDesbloqueoEn ? new Date(body.materialDesbloqueoEn) : null;
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

  // --------- Participante ---------

  @Get('programas/:id/participantes')
  async listParticipantes(@Param('id') programaId: string) {
    return this.prisma.participantePrograma.findMany({
      where: { programaId },
      select: PARTICIPANTE_SELECT,
      orderBy: { createdAt: 'asc' },
    });
  }

  @Post('programas/:id/participantes')
  async matricular(@Param('id') programaId: string, @Body() body: MatricularDto) {
    const programa = await this.prisma.programa.findUnique({ where: { id: programaId } });
    if (!programa) throw new AppError('PROGRAMA_NOT_FOUND');

    let usuarioId = body.usuarioId ?? null;

    if (!usuarioId) {
      const email = body.email?.toLowerCase().trim();
      if (!email) {
        throw new AppError('VALIDATION_ERROR', {
          message: 'Debes enviar usuarioId o email',
        });
      }
      const existente = await this.prisma.usuario.findFirst({
        where: { email, empresaId: programa.empresaId },
        include: { role: true },
      });
      if (existente) {
        usuarioId = existente.id;
        await this.promoverAEstudianteSiLegacy(existente.id, existente.role?.slug);
      } else {
        if (!body.nombre) {
          throw new AppError('VALIDATION_ERROR', {
            message: 'Debes enviar nombre para crear un nuevo estudiante',
          });
        }
        const estudianteRole = await this.prisma.role.findUniqueOrThrow({
          where: { slug: ESTUDIANTE_SLUG },
        });
        const nuevo = await this.prisma.usuario.create({
          data: {
            id: randomUUID(),
            nombre: body.nombre,
            email,
            empresaId: programa.empresaId,
            cargo: body.cargo ?? null,
            area: body.area ?? null,
            roleId: estudianteRole.id,
            puedeIniciarSesion: true,
          },
        });
        usuarioId = nuevo.id;
      }
    } else {
      const existente = await this.prisma.usuario.findUnique({
        where: { id: usuarioId },
        include: { role: true },
      });
      if (!existente) throw new AppError('USUARIO_NOT_FOUND');
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

  private async promoverAEstudianteSiLegacy(usuarioId: string, slug: string | undefined) {
    if (slug !== LEGACY_SLUG) return;
    const estudianteRole = await this.prisma.role.findUniqueOrThrow({
      where: { slug: ESTUDIANTE_SLUG },
    });
    await this.prisma.usuario.update({
      where: { id: usuarioId },
      data: { roleId: estudianteRole.id, puedeIniciarSesion: true },
    });
  }
}
