import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';

import { PrismaService } from '../../../prisma.service';
import { AppError } from '../../../shared/errors/AppError';
import { JwtAuthGuard, RolesGuard, Roles, CurrentUser } from '../../auth/guards';
import { CLIENTE_ROLE_SLUGS } from '../../auth/guards/auth-user';
import type { AuthUser } from '../../auth/guards';
import { ResultadosService } from '../../formularios/application/resultados.service';
import { programasClienteScope } from '../application/cliente-scope';
import { contarParticipantesPorArea } from '../application/participantes-por-area';
import { filtroUsuarioPorArea, protegerAnonimato, MIN_RESPUESTAS_ANONIMAS } from '../application/filtro-area';

// Fase 4 (Plan 2 §4.1 — RF-42/RF-43/RN-09): portal del cliente, SOLO LECTURA.
// Todo endpoint acota por `empresaId = jwt.empresaId`; forjar el id de un
// programa de otra empresa devuelve 403 (PORTAL_ACCESO_DENEGADO). Este
// controller no expone ninguna escritura.
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...CLIENTE_ROLE_SLUGS)
@Controller('portal')
export class PortalProgramasController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly resultados: ResultadosService,
  ) {}

  // RF-42: vista unificada de TODOS los programas de la empresa del actor —
  // IA en Acción (`Programa`) + Decisión IA (`Iniciativa` con sus actividades).
  @Get('programas')
  async listPrograms(@CurrentUser() actor: AuthUser) {
    const empresaId = this.requireEmpresa(actor);

    const [programas, iniciativas] = await Promise.all([
      this.prisma.programa.findMany({
        // C-07: usuario_cliente ve solo asignados; cliente_admin, todos los de su empresa.
        where: programasClienteScope(actor),
        select: {
          id: true,
          nombre: true,
          descripcion: true,
          estado: true,
          fechaInicio: true,
          fechaFin: true,
          facilitadores: { select: { usuario: { select: { nombre: true } } } },
          _count: { select: { participantes: { where: { activo: true } }, sesiones: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.iniciativa.findMany({
        where: { empresaId, activo: true },
        select: {
          id: true,
          nombre: true,
          descripcion: true,
          createdAt: true,
          actividades: {
            where: { activo: true },
            select: { id: true, instancias: { select: { estado: true } } },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return {
      iaEnAccion: programas.map(p => ({
        modulo: 'ia_en_accion' as const,
        id: p.id,
        nombre: p.nombre,
        descripcion: p.descripcion,
        estado: p.estado,
        fechaInicio: p.fechaInicio,
        fechaFin: p.fechaFin,
        facilitadores: p.facilitadores.map(f => f.usuario.nombre),
        participantes: p._count.participantes,
        sesiones: p._count.sesiones,
      })),
      decisionIa: iniciativas.map(i => {
        const instancias = i.actividades.flatMap(a => a.instancias);
        return {
          modulo: 'decision_ia' as const,
          id: i.id,
          nombre: i.nombre,
          descripcion: i.descripcion,
          actividades: i.actividades.length,
          instanciasTotal: instancias.length,
          instanciasFinalizadas: instancias.filter(x => x.estado === 'finalizada').length,
        };
      }),
    };
  }

  // RF-43: detalle de un programa IA en Acción — avance, asistencia promedio,
  // diagnóstico agregado, feedback anónimo y estado del proyecto por grupo.
  // (La matriz de asistencia detallada la sirve GET /admin/programas/:id/
  // asistencia/resumen, que ya admite roles cliente — RF-20.)
  @Get('programas/:id')
  // `areaId` (HU-14): filtra participantes, asistencia, grupos, diagnóstico y feedback por área
  // (`sin_area` = sin área). Los agregados anónimos con pocas respuestas se ocultan.
  async detalle(
    @Param('id') programaId: string,
    @CurrentUser() actor: AuthUser,
    @Query('areaId') areaId?: string,
  ) {
    const empresaId = this.requireEmpresa(actor);

    const programa = await this.prisma.programa.findFirst({
      // C-07: usuario_cliente solo abre programas asignados; el resto → 403 (igual que otra empresa).
      where: { AND: [{ id: programaId }, programasClienteScope(actor)] },
      select: {
        id: true,
        nombre: true,
        descripcion: true,
        estado: true,
        fechaInicio: true,
        fechaFin: true,
        totalSesionesEsperadas: true,
        facilitadores: { select: { usuario: { select: { nombre: true } } } },
      },
    });
    // RN-09: programa inexistente / de otra empresa / no asignado → mismo 403 (no filtra existencia).
    if (!programa) throw new AppError('PORTAL_ACCESO_DENEGADO');
    const programaOut = {
      ...programa,
      facilitadores: programa.facilitadores.map(f => f.usuario.nombre),
    };

    const filtro = filtroUsuarioPorArea(areaId);
    const usuarioWhere = filtro ? { usuario: filtro } : {};

    const [sesiones, participantesActivos, participantes, asistencias, grupos, diagnostico, feedback] =
      await Promise.all([
        this.prisma.sesion.findMany({
          where: { programaId },
          select: { id: true, numeroSesion: true, titulo: true, fechaProgramada: true, estado: true },
          orderBy: { numeroSesion: 'asc' },
        }),
        this.prisma.participantePrograma.count({ where: { programaId, activo: true, ...usuarioWhere } }),
        // HU-14: solo el área de cada participante activo; sin datos personales.
        this.prisma.participantePrograma.findMany({
          where: { programaId, activo: true },
          select: { usuario: { select: { areaCatalogo: { select: { id: true, nombre: true } } } } },
        }),
        this.prisma.asistencia.findMany({
          where: { sesion: { programaId }, ...usuarioWhere },
          select: { presente: true },
        }),
        this.prisma.grupo.findMany({
          where: { programaId, ...(filtro ? { miembros: { some: { usuario: filtro } } } : {}) },
          select: {
            id: true,
            nombre: true,
            orden: true,
            _count: { select: { miembros: filtro ? { where: { usuario: filtro } } : true } },
            presentacionFinal: {
              select: { urlPresentacion: true, archivoKey: true, entregadoEn: true },
            },
          },
          orderBy: { orden: 'asc' },
        }),
        filtro ? this.resultados.diagnosticoAgregado(programaId, filtro) : this.resultados.diagnosticoAgregado(programaId),
        filtro ? this.resultados.feedbackAgregado(programaId, filtro) : this.resultados.feedbackAgregado(programaId),
      ]);

    const totalRegistros = asistencias.length;
    return {
      programa: programaOut,
      avance: {
        sesionesCompletadas: sesiones.filter(s => s.estado === 'completada').length,
        sesionesTotales: programa.totalSesionesEsperadas ?? sesiones.length,
        participantesActivos,
      },
      participantesPorArea: contarParticipantesPorArea(participantes),
      sesiones,
      asistencia: {
        registros: totalRegistros,
        porcentajePromedio: totalRegistros
          ? asistencias.filter(a => a.presente).length / totalRegistros
          : null,
      },
      // RN-07: el cliente ve el ESTADO de la entrega, nunca descarga el archivo.
      proyecto: grupos.map(g => ({
        id: g.id,
        nombre: g.nombre,
        orden: g.orden,
        miembros: g._count.miembros,
        presentacion: g.presentacionFinal
          ? {
              entregada: true,
              entregadoEn: g.presentacionFinal.entregadoEn,
              urlPresentacion: g.presentacionFinal.urlPresentacion,
              conArchivo: !!g.presentacionFinal.archivoKey,
            }
          : { entregada: false },
      })),
      // RF-33/RN-06: con filtro, los agregados con pocas respuestas se ocultan.
      diagnostico: {
        inicial: protegerAnonimato(diagnostico.inicial, !!filtro, { dimensiones: { escala: [], seleccion: [] } }),
        final: protegerAnonimato(diagnostico.final, !!filtro, { dimensiones: { escala: [], seleccion: [] } }),
      },
      feedback: protegerAnonimato(feedback, !!filtro, { campos: [] }),
      minimoAnonimato: MIN_RESPUESTAS_ANONIMAS,
    };
  }

  private requireEmpresa(actor: AuthUser): string {
    if (!actor.empresaId) throw new AppError('PORTAL_ACCESO_DENEGADO');
    return actor.empresaId;
  }
}
