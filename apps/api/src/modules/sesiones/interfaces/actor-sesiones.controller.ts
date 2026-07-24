import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';

import { PrismaService } from '../../../prisma.service';
import { S3Service } from '../../storage/S3Service';
import { ActorScopeService } from '../../auth/scoping/actor-scope.service';
import { JwtAuthGuard, RolesGuard, Roles, CurrentUser } from '../../auth/guards';
import type { AuthUser } from '../../auth/guards';
import { AppError } from '../../../shared/errors/AppError';

// C-03: el facilitador ve la presentación desde 7 días calendario antes de la sesión.
const FACILITADOR_ANTELACION_MS = 7 * 24 * 60 * 60 * 1000;
// RF-09 (aclaración 2026-07-17): el estudiante ve los recursos 24 h DESPUÉS de la sesión.
const ESTUDIANTE_ESPERA_MS = 24 * 60 * 60 * 1000;

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
};

// RF-06/RF-08/RF-09/RNF-03/RNF-08: gating de sesiones para facilitador/estudiante
// y URL firmada de corta duración para el material.
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('facilitador', 'estudiante')
@Controller()
export class ActorSesionesController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: ActorScopeService,
    private readonly s3: S3Service,
  ) {}

  // Glue mínimo para que la UI pueda listar "mis programas" antes de poder pedir
  // sesiones/material de uno concreto (los endpoints de Fase 1 asumen programaId
  // conocido). Reutiliza el mismo fragmento WHERE que assertProgramaAccessible.
  @Get('programas')
  async listMisProgramas(@CurrentUser() actor: AuthUser) {
    return this.prisma.programa.findMany({
      where: this.scope.programaScope(actor),
      select: {
        id: true,
        nombre: true,
        estado: true,
        fechaInicio: true,
        fechaFin: true,
        empresa: { select: { id: true, nombre: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Confirmación de matrícula (RN nueva): el estudiante debe aceptar en la plataforma su
  // registro al programa. Mientras no confirme, el programa no aparece en `programaScope`
  // (ver actor-scope.service), así que este endpoint consulta la matrícula directamente
  // para que la UI pueda mostrarle los programas pendientes de confirmar.
  @Get('programas/pendientes')
  @Roles('estudiante')
  async listProgramasPendientes(@CurrentUser() actor: AuthUser) {
    const pendientes = await this.prisma.participantePrograma.findMany({
      where: { usuarioId: actor.sub, activo: true, confirmadoEn: null },
      select: {
        programa: {
          select: {
            id: true,
            nombre: true,
            empresa: { select: { id: true, nombre: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    return pendientes.map((p) => p.programa);
  }

  // El estudiante confirma su registro al programa. Idempotente: si ya estaba confirmado
  // no cambia la fecha original (solo marca las que aún no tienen confirmadoEn).
  @Post('programas/:id/confirmar')
  @Roles('estudiante')
  async confirmarPrograma(@Param('id') programaId: string, @CurrentUser() actor: AuthUser) {
    const existe = await this.prisma.participantePrograma.findFirst({
      where: { programaId, usuarioId: actor.sub, activo: true },
      select: { id: true, confirmadoEn: true },
    });
    if (!existe) throw new AppError('PARTICIPANTE_NOT_FOUND');
    if (!existe.confirmadoEn) {
      await this.prisma.participantePrograma.update({
        where: { id: existe.id },
        data: { confirmadoEn: new Date() },
      });
    }
    return { programaId, confirmado: true };
  }

  @Get('programas/:id/sesiones')
  async listSesiones(@Param('id') programaId: string, @CurrentUser() actor: AuthUser) {
    await this.scope.assertProgramaAccessible(this.prisma, actor, programaId);
    const [sesiones, programa] = await Promise.all([
      this.prisma.sesion.findMany({
        where: { programaId },
        select: SESION_SELECT,
        orderBy: { numeroSesion: 'asc' },
      }),
      // C-01: los facilitadores son del programa (N:M), no de la sesión; se
      // adjuntan a cada sesión para que el estudiante vea de quién es. Siempre
      // visibles (el nombre no es material, no se gatea).
      this.prisma.programa.findUnique({
        where: { id: programaId },
        select: {
          timezone: true,
          facilitadores: { select: { usuario: { select: { id: true, nombre: true } } } },
        },
      }),
    ]);
    const facilitadores = (programa?.facilitadores ?? []).map((f) => f.usuario);
    const timezone = programa?.timezone ?? 'UTC';
    const now = Date.now();
    return Promise.all(
      sesiones.map(async (s) => {
        const bloqueada = this.estaBloqueada(s, actor.role, now);
        // No filtrar los recursos (presentación/grabación) mientras la sesión siga
        // bloqueada para el rol: el gating es servidor, no solo cosmético en la UI.
        // La presentación puede ser un enlace (urlPresentacion) o un archivo subido a
        // S3 (presentacionArchivoKey), servido con una URL firmada de corta duración.
        const presentacionArchivoUrl =
          bloqueada || !s.presentacionArchivoKey
            ? null
            : await this.s3.getPresignedGetUrl(s.presentacionArchivoKey, 3600);
        return {
          ...s,
          facilitadores,
          timezone,
          urlPresentacion: bloqueada ? null : s.urlPresentacion,
          presentacionArchivoUrl,
          urlGrabacion: bloqueada ? null : s.urlGrabacion,
          bloqueada,
          desbloqueaEn: this.desbloqueoEn(s, actor.role).toISOString(),
        };
      }),
    );
  }

  // Dashboard de inicio del estudiante: agrega en una sola llamada la próxima
  // sesión, los pendientes de acción y un resumen por programa. Evita que el home
  // haga N peticiones (una de sesiones por programa) y centraliza el gating de
  // sesiones (mismos helpers que listSesiones) en el servidor.
  @Get('estudiante/resumen')
  @Roles('estudiante')
  async resumenEstudiante(@CurrentUser() actor: AuthUser) {
    const now = Date.now();

    const [programas, plantillas, matriculasPendientes] = await Promise.all([
      this.prisma.programa.findMany({
        where: this.scope.programaScope(actor),
        select: {
          id: true,
          nombre: true,
          timezone: true,
          totalSesionesEsperadas: true,
          bitacoraHabilitadaEn: true,
          empresa: { select: { id: true, nombre: true } },
          sesiones: {
            select: {
              numeroSesion: true,
              titulo: true,
              fechaProgramada: true,
              urlPresentacion: true,
              presentacionArchivoKey: true,
              urlGrabacion: true,
            },
            orderBy: { numeroSesion: 'asc' },
          },
          grupos: {
            where: { miembros: { some: { usuarioId: actor.sub } } },
            select: {
              nombre: true,
              _count: { select: { miembros: true } },
              respuestasFormulario: {
                where: { plantilla: { is: { tipoFormulario: { in: ['bitacora', 'plantilla_proyecto'] }, activa: true } } },
                select: { id: true },
              },
              presentacionFinal: { select: { entregadoEn: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      // Formularios individuales del estudiante (misma lógica que /formularios/disponibles):
      // la encuesta de inicio es la plantilla GLOBAL (programaId=null); el resto son de programa.
      this.prisma.plantillaFormulario.findMany({
        where: {
          activa: true,
          tipoFormulario: { in: ['diagnostico_inicial', 'diagnostico_final', 'feedback'] },
          OR: [
            { programaId: null, tipoFormulario: 'diagnostico_inicial' },
            { programa: { is: { AND: [{ estado: 'activo' }, this.scope.programaScope(actor)] } } },
          ],
        },
        select: {
          id: true,
          nombre: true,
          programaId: true,
          tipoFormulario: true,
          programa: { select: { id: true, nombre: true } },
          respuestas: { where: { usuarioRespondienteId: actor.sub }, select: { estado: true } },
        },
      }),
      this.prisma.participantePrograma.findMany({
        where: { usuarioId: actor.sub, activo: true, confirmadoEn: null },
        select: { programa: { select: { id: true, nombre: true } } },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const enviado = (rs: { estado: string }[]) => rs.some((r) => r.estado === 'submitted');

    // Pendientes ITEMIZADOS y atribuidos a su programa (o global, para la encuesta de
    // inicio) para que el frontend enlace a la acción real de cada uno, no a un listado
    // genérico. `tipo` gobierna el destino; `plantillaId`/`programaId` lo parametrizan.
    type Pendiente = {
      tipo: 'encuesta_inicio' | 'matricula' | 'entregable' | 'formulario';
      plantillaId: string | null;
      programaId: string | null;
      programaNombre: string | null;
      nombre: string | null;
    };
    const pendientes: Pendiente[] = [];

    // 1) Encuesta de inicio (gate global, sin programa). Deep-link al formulario.
    const encuesta = plantillas.find(
      (p) => p.programaId === null && p.tipoFormulario === 'diagnostico_inicial',
    );
    if (encuesta && !enviado(encuesta.respuestas)) {
      pendientes.push({
        tipo: 'encuesta_inicio',
        plantillaId: encuesta.id,
        programaId: null,
        programaNombre: null,
        nombre: encuesta.nombre,
      });
    }

    // 2) Matrículas por confirmar (programas fuera de scope hasta confirmar).
    for (const m of matriculasPendientes) {
      pendientes.push({
        tipo: 'matricula',
        plantillaId: null,
        programaId: m.programa.id,
        programaNombre: m.programa.nombre,
        nombre: null,
      });
    }

    // 3) Entregables del reto pendientes: se recolectan en el loop de programas.
    const entregableItems: Pendiente[] = [];

    // Resumen por programa. Un grupo con el reto habilitado (bitácora habilitada) y sin
    // presentación final entregada aporta un entregable pendiente atribuido al programa.
    const resumenProgramas = programas.map((p) => {
      const sesionesRealizadas = p.sesiones.filter((s) => s.fechaProgramada.getTime() < now).length;
      const sesionesTotal = p.totalSesionesEsperadas ?? p.sesiones.length;
      const grupo = p.grupos[0] ?? null;

      let reto: 'sin_grupo' | 'bloqueado' | 'entregado' | 'en_progreso' | 'sin_iniciar';
      if (!grupo) reto = 'sin_grupo';
      else if (grupo.presentacionFinal) reto = 'entregado';
      else if (!p.bitacoraHabilitadaEn) reto = 'bloqueado';
      else if (grupo.respuestasFormulario.length > 0) reto = 'en_progreso';
      else reto = 'sin_iniciar';

      if (grupo && p.bitacoraHabilitadaEn && !grupo.presentacionFinal) {
        entregableItems.push({
          tipo: 'entregable',
          plantillaId: null,
          programaId: p.id,
          programaNombre: p.nombre,
          nombre: null,
        });
      }

      return {
        id: p.id,
        nombre: p.nombre,
        empresa: p.empresa,
        sesionesTotal,
        sesionesRealizadas,
        grupo: grupo ? { nombre: grupo.nombre, miembros: grupo._count.miembros } : null,
        reto,
      };
    });

    pendientes.push(...entregableItems);

    // 4) Formularios del programa pendientes (feedback / diagnóstico final). Deep-link
    // al formulario, con `?from` a la vista del programa correspondiente. Se excluye
    // el diagnóstico inicial por-programa: es un snapshot que NO se responde directo —
    // el estudiante contesta la encuesta de inicio GLOBAL (gate), así que el snapshot
    // nunca tendría respuesta y aparecería como pendiente para siempre (mismo criterio
    // que la vista del programa en SesionesPage).
    for (const pl of plantillas) {
      if (pl.programaId !== null && pl.tipoFormulario !== 'diagnostico_inicial' && !enviado(pl.respuestas)) {
        pendientes.push({
          tipo: 'formulario',
          plantillaId: pl.id,
          programaId: pl.programaId,
          programaNombre: pl.programa?.nombre ?? null,
          nombre: pl.nombre,
        });
      }
    }

    // Próxima sesión: la más cercana en el futuro entre TODOS los programas.
    let proxima: {
      programaId: string;
      programaNombre: string;
      timezone: string;
      numeroSesion: number;
      titulo: string;
      fechaProgramada: Date;
      tieneRecursos: boolean;
    } | null = null;
    for (const p of programas) {
      for (const s of p.sesiones) {
        if (s.fechaProgramada.getTime() < now) continue;
        if (!proxima || s.fechaProgramada.getTime() < proxima.fechaProgramada.getTime()) {
          proxima = {
            programaId: p.id,
            programaNombre: p.nombre,
            timezone: p.timezone,
            numeroSesion: s.numeroSesion,
            titulo: s.titulo,
            fechaProgramada: s.fechaProgramada,
            tieneRecursos: !!(s.urlPresentacion || s.presentacionArchivoKey || s.urlGrabacion),
          };
        }
      }
    }

    const proximaSesion = proxima
      ? {
          programaId: proxima.programaId,
          programaNombre: proxima.programaNombre,
          numeroSesion: proxima.numeroSesion,
          titulo: proxima.titulo,
          fechaProgramada: proxima.fechaProgramada.toISOString(),
          timezone: proxima.timezone,
          bloqueada: this.estaBloqueada(
            { fechaProgramada: proxima.fechaProgramada, materialDesbloqueoEn: null },
            actor.role,
            now,
          ),
          desbloqueaEn: this.desbloqueoEn({ fechaProgramada: proxima.fechaProgramada }, actor.role).toISOString(),
          tieneRecursos: proxima.tieneRecursos,
        }
      : null;

    return {
      proximaSesion,
      pendientes,
      programas: resumenProgramas,
    };
  }

  @Get('sesiones/:id/material')
  async getMaterial(@Param('id') sesionId: string, @CurrentUser() actor: AuthUser) {
    const sesion = await this.prisma.sesion.findUnique({ where: { id: sesionId }, select: SESION_SELECT });
    if (!sesion) throw new AppError('SESION_NOT_FOUND');
    await this.scope.assertProgramaAccessible(this.prisma, actor, sesion.programaId);

    if (this.estaBloqueada(sesion, actor.role, Date.now())) {
      throw new AppError('SESION_BLOQUEADA');
    }

    // RNF-03: URL firmada de expiración corta (≤ 1 h), generada on-demand; sin
    // downloadFilename para que quede "inline" y el visor de PDF.js pueda
    // renderizarla en <canvas> en vez de forzar descarga.
    const url = sesion.materialArchivoKey ? await this.s3.getPresignedGetUrl(sesion.materialArchivoKey, 3600) : null;
    // La presentación se entrega junto al material (mismo gating de arriba): puede ser un
    // enlace (urlPresentacion) o un archivo subido a S3, servido con URL firmada.
    const presentacionArchivoUrl = sesion.presentacionArchivoKey
      ? await this.s3.getPresignedGetUrl(sesion.presentacionArchivoKey, 3600)
      : null;
    return {
      url,
      urlPresentacion: sesion.urlPresentacion,
      presentacionArchivoUrl,
      urlGrabacion: sesion.urlGrabacion,
    };
  }

  // C-04 (aclaración 2026-07-14): el facilitador sube el enlace de grabación de una
  // sesión suya. El admin sube la presentación/material; la grabación la pone el
  // facilitador tras dar la sesión. Solo sesión actual o pasada (SESION_FUTURA si no).
  @Patch('facilitador/sesiones/:id/grabacion')
  @Roles('facilitador')
  async subirGrabacion(
    @Param('id') sesionId: string,
    @Body() body: { urlGrabacion: string | null },
    @CurrentUser() actor: AuthUser,
  ) {
    const sesion = await this.prisma.sesion.findUnique({
      where: { id: sesionId },
      select: { id: true, programaId: true, fechaProgramada: true },
    });
    if (!sesion) throw new AppError('SESION_NOT_FOUND');
    await this.scope.assertProgramaAccessible(this.prisma, actor, sesion.programaId);
    if (sesion.fechaProgramada.getTime() > Date.now()) throw new AppError('SESION_FUTURA');
    const url = body?.urlGrabacion?.trim() || null;
    await this.prisma.sesion.update({ where: { id: sesionId }, data: { urlGrabacion: url } });
    return { id: sesionId, urlGrabacion: url };
  }

  private estaBloqueada(
    sesion: { fechaProgramada: Date; materialDesbloqueoEn: Date | null },
    role: AuthUser['role'],
    now: number,
  ): boolean {
    return this.desbloqueoEn(sesion, role).getTime() > now;
  }

  // Momento en que los recursos de la sesión quedan disponibles para el rol.
  private desbloqueoEn(
    sesion: { fechaProgramada: Date },
    role: AuthUser['role'],
  ): Date {
    if (role === 'facilitador') {
      // C-03 (aclaración 2026-07-14): el facilitador ve la presentación desde 7 días
      // calendario antes de la fecha de la sesión.
      return new Date(sesion.fechaProgramada.getTime() - FACILITADOR_ANTELACION_MS);
    }
    // RF-09 (aclaración 2026-07-17): el estudiante ve los recursos (presentación /
    // grabación) 24 h DESPUÉS de que la sesión ocurrió; antes, bloqueada.
    return new Date(sesion.fechaProgramada.getTime() + ESTUDIANTE_ESPERA_MS);
  }
}
