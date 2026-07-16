import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Ip,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';

import { PrismaService } from '../../../prisma.service';
import { AppError } from '../../../shared/errors/AppError';
import { MagicLinkService } from '../../auth/application/magic-link.service';
import { JwtAuthGuard, RolesGuard, Roles, CurrentUser } from '../../auth/guards';
import type { AuthUser } from '../../auth/guards';
import { UsuarioClienteService } from '../../portal/application/usuario-cliente.service';

const ADMIN_SLUG = 'danalytics_admin';
const EMPRESA_SLUGS = new Set(['estudiante', 'cliente_admin', 'usuario_cliente']);
const CLIENTE_SLUGS = new Set(['cliente_admin', 'usuario_cliente']);

interface CreateUsuarioDto {
  nombre: string;
  role: string;
  email?: string | null;
  username?: string | null;
  password?: string | null;
  empresaId?: string | null;
  cargo?: string | null;
  area?: string | null;
  puedeIniciarSesion?: boolean;
}

interface UpdateUsuarioDto {
  nombre?: string;
  role?: string;
  email?: string | null;
  username?: string | null;
  password?: string | null;
  empresaId?: string | null;
  cargo?: string | null;
  area?: string | null;
  puedeIniciarSesion?: boolean;
  activo?: boolean;
}

interface ResetPasswordDto {
  password: string;
}

const SELECT_PUBLIC = {
  id: true,
  nombre: true,
  email: true,
  username: true,
  puedeIniciarSesion: true,
  googleId: true,
  googleEmailVerificado: true,
  cargo: true,
  area: true,
  estado: true,
  activo: true,
  empresaId: true,
  empresa: { select: { id: true, nombre: true } },
  roleId: true,
  role: { select: { id: true, slug: true, nombre: true } },
  createdAt: true,
  updatedAt: true,
} as const;

// Asignación facilitador ↔ programa: se resuelve desde el módulo de programas
// (admin-programas.controller). Este controller solo expone el listado filtrado.
//
// Cierre Fase 4 (Plan 2 §4.2 / Plan 1 §9):
// - La tabla puente `UsuarioCliente` se sincroniza en create/update/delete vía
//   `UsuarioClienteService.sincronizarDesdeAdmin`.
// - `CLIENTE_ADMIN_UNICO` (RN-04/RF-44): lo garantiza el índice parcial
//   `usuario_cliente_admin_unico_por_empresa` (seed-admin.ts); aquí se captura
//   la violación P2002 y se mapea al código semántico.
// - El "scoping por rol" del antiguo TODO(fase-2) quedó resuelto por diseño:
//   los roles cliente usan sus propios endpoints escopeados
//   (`/portal/usuarios-cliente`) y el facilitador ve a sus estudiantes vía
//   grupos/asistencia — este controller permanece EXCLUSIVO de danalytics_admin
//   (regla dura §0.1: registro/matrícula solo admin).
// - El log de auditoría (RNF-13) lo escribe el RegistroAccesoInterceptor global
//   (registra las mutaciones del admin, incluidas las de este controller).
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('danalytics_admin')
@Controller('admin')
export class AdminUsersController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly magicLink: MagicLinkService,
    private readonly usuariosCliente?: UsuarioClienteService,
  ) {}

  @Get('roles')
  async listRoles() {
    return this.prisma.role.findMany({
      where: { activo: true },
      orderBy: { nombre: 'asc' },
      select: { id: true, slug: true, nombre: true, descripcion: true },
    });
  }

  // C-07: danalytics_admin también puede asignar programas de IA en Acción a un
  // usuario_cliente (además del cliente_admin, que lo hace desde el portal).
  @Get('usuarios/:id/programas-cliente')
  async listProgramasCliente(@Param('id') id: string) {
    return this.requireUsuariosCliente().programasAsignables(id);
  }

  @Post('usuarios/:id/programas-cliente')
  async asignarProgramaCliente(
    @Param('id') id: string,
    @Body() body: { programaId: string },
    @CurrentUser() actor: AuthUser,
  ) {
    return this.requireUsuariosCliente().asignarPrograma({
      usuarioId: id,
      programaId: body?.programaId,
      asignadoPorId: actor.sub,
    });
  }

  @Delete('usuarios/:id/programas-cliente/:programaId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async desasignarProgramaCliente(@Param('id') id: string, @Param('programaId') programaId: string) {
    await this.requireUsuariosCliente().desasignarPrograma({ usuarioId: id, programaId });
  }

  private requireUsuariosCliente(): UsuarioClienteService {
    if (!this.usuariosCliente) {
      throw new AppError('VALIDATION_ERROR', { message: 'UsuarioClienteService no disponible' });
    }
    return this.usuariosCliente;
  }

  @Get('usuarios')
  async findAll(
    @Query('role') role?: string,
    @Query('empresaId') empresaId?: string,
    @Query('estado') estado?: 'activo' | 'inactivo' | 'todos',
    @Query('search') search?: string,
    @Query('programaId') programaId?: string,
    // Si viene, incluye las participaciones (programas) de cada usuario — usado por
    // la matrícula para mostrar en qué otros programas de la empresa ya está.
    @Query('conProgramas') conProgramas?: string,
  ) {
    const where: Prisma.UsuarioWhereInput = {};

    if (role) {
      where.role = { slug: role };
    }

    if (empresaId) {
      where.empresaId = empresaId;
    }

    if (programaId) {
      where.participaciones = { some: { programaId } };
    }

    if (estado === 'activo') where.activo = true;
    else if (estado === 'inactivo') where.activo = false;

    const term = search?.trim();
    if (term) {
      where.OR = [
        { nombre: { contains: term, mode: 'insensitive' } },
        { email: { contains: term, mode: 'insensitive' } },
        { username: { contains: term, mode: 'insensitive' } },
      ];
    }

    const select = conProgramas
      ? {
          ...SELECT_PUBLIC,
          participaciones: {
            select: {
              activo: true,
              programa: { select: { id: true, nombre: true, estado: true, empresaId: true } },
            },
          },
        }
      : SELECT_PUBLIC;

    return this.prisma.usuario.findMany({
      where,
      select,
      orderBy: [{ activo: 'desc' }, { nombre: 'asc' }],
    });
  }

  @Post('usuarios/:id/enviar-invitacion')
  async enviarInvitacion(
    @Param('id') id: string,
    @Body() body: { locale?: 'es' | 'pt'; propositoRedirect?: string | null },
    @Ip() ip: string,
  ) {
    const { expiraEn } = await this.magicLink.createAndSend({
      usuarioId: id,
      locale: body?.locale ?? 'es',
      ipCreacion: ip,
      propositoRedirect: body?.propositoRedirect ?? null,
    });
    return { ok: true, expiraEn };
  }

  @Get('usuarios/:id')
  async findOne(@Param('id') id: string) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id },
      select: SELECT_PUBLIC,
    });
    if (!usuario) throw new AppError('USUARIO_NOT_FOUND');
    return usuario;
  }

  @Post('usuarios')
  async create(@Body() body: CreateUsuarioDto, @CurrentUser() actor?: AuthUser) {
    const roleId = await this.resolveRoleId(body.role);
    const roleSlug = body.role;

    const email = body.email?.toLowerCase().trim() || null;
    // Regla: TODO usuario con email tiene `username = email` (admins incluidos). `username` es
    // @unique global (`email` solo es único por empresa), así se evita duplicar cuentas con el
    // mismo correo y el login por email (Google/magic link) es determinista (busca por username).
    // ÚNICA excepción: el admin raíz SIN correo (p. ej. `admin` del seed), que conserva su
    // username propio y entra solo por usuario+contraseña.
    const username = email ?? (body.username?.trim() || null);
    const empresaId = body.empresaId || null;

    if (roleSlug === ADMIN_SLUG) {
      if (!username) {
        throw new AppError('VALIDATION_ERROR', { message: 'username requerido para danalytics_admin' });
      }
      // La contraseña NO es obligatoria: un admin cuyo username es su correo entra por Google.
      // Solo el admin raíz sin correo depende de la contraseña (se define en el seed).
    } else {
      if (!email) {
        throw new AppError('VALIDATION_ERROR', { message: 'email requerido para este rol' });
      }
    }

    if (EMPRESA_SLUGS.has(roleSlug) && !empresaId) {
      throw new AppError('VALIDATION_ERROR', { message: 'empresaId requerido para este rol' });
    }

    const passwordHash = body.password ? await bcrypt.hash(body.password, 10) : null;

    try {
      const created = await this.prisma.usuario.create({
        data: {
          id: randomUUID(),
          nombre: body.nombre,
          email,
          username,
          password: passwordHash,
          roleId,
          puedeIniciarSesion: body.puedeIniciarSesion ?? (roleSlug !== 'participante_legacy'),
          cargo: body.cargo ?? null,
          area: body.area ?? null,
          empresaId,
        },
        select: SELECT_PUBLIC,
      });
      // Fase 4 (§4.2): tabla puente UsuarioCliente sincronizada al crear roles cliente.
      if (CLIENTE_SLUGS.has(roleSlug)) {
        await this.usuariosCliente?.sincronizarDesdeAdmin(created, actor?.sub ?? null);
      }
      return created;
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        // RF-44/Plan 2 §4.4: el índice parcial de la BD garantiza un solo
        // cliente_admin ACTIVO por empresa; su violación se distingue de un
        // email/username duplicado para dar un mensaje accionable.
        if (UsuarioClienteService.esViolacionClienteAdminUnico(e)) {
          throw new AppError('CLIENTE_ADMIN_UNICO');
        }
        throw new AppError('USUARIO_DUPLICATE');
      }
      throw e;
    }
  }

  @Patch('usuarios/:id')
  async update(@Param('id') id: string, @Body() body: UpdateUsuarioDto, @CurrentUser() actor?: AuthUser) {
    const existing = await this.prisma.usuario.findUnique({ where: { id }, include: { role: true } });
    if (!existing) throw new AppError('USUARIO_NOT_FOUND');

    const data: Prisma.UsuarioUpdateInput = {};
    if (body.nombre !== undefined) data.nombre = body.nombre;
    if (body.role !== undefined) {
      const newRoleId = await this.resolveRoleId(body.role);
      data.role = { connect: { id: newRoleId } };
    }
    if (body.email !== undefined) data.email = body.email?.toLowerCase().trim() || null;
    if (body.username !== undefined) data.username = body.username?.trim() || null;
    if (body.password) {
      // password es un método de login alternativo a magic link/OAuth, disponible
      // para cualquier rol (no exclusivo de danalytics_admin) — el danalytics_admin
      // que administra usuarios puede poner/cambiar la contraseña de cualquiera.
      data.password = await bcrypt.hash(body.password, 10);
      // El login por contraseña busca por `username` (no por email, ver
      // AuthService.validateUser). Usuarios matriculados como estudiante/facilitador
      // (ej. desde `matricular` en admin-programas) nunca tienen `username` seteado
      // porque su canal normal es magic link/OAuth — sin este backfill quedarían con
      // password válido pero sin username contra el cual hacer match, y el login
      // fallaría con AUTH_INVALID_CREDENTIALS pese a la contraseña correcta.
      if (body.username === undefined && !existing.username) {
        const emailParaUsername = (body.email !== undefined ? body.email : existing.email)
          ?.toLowerCase()
          .trim();
        if (emailParaUsername) {
          data.username = emailParaUsername;
        } else {
          throw new AppError('VALIDATION_ERROR', {
            message: 'Este usuario no tiene username ni email: asígnale uno antes de ponerle contraseña, o no podrá iniciar sesión.',
          });
        }
      }
    }
    if (body.cargo !== undefined) data.cargo = body.cargo ?? null;
    if (body.area !== undefined) data.area = body.area ?? null;
    if (body.puedeIniciarSesion !== undefined) data.puedeIniciarSesion = body.puedeIniciarSesion;
    if (body.activo !== undefined) data.activo = body.activo;
    if (body.empresaId !== undefined) {
      data.empresa = body.empresaId
        ? { connect: { id: body.empresaId } }
        : { disconnect: true };
    }

    try {
      const updated = await this.prisma.usuario.update({
        where: { id },
        data,
        select: SELECT_PUBLIC,
      });
      // Fase 4 (§4.2): re-sincroniza la tabla puente si el usuario es (o dejaba
      // de ser) un rol cliente — cubre cambios de rol, empresa y activo.
      const eraCliente = !!existing.role && CLIENTE_SLUGS.has(existing.role.slug);
      const esCliente = !!updated?.role && CLIENTE_SLUGS.has(updated.role.slug);
      if (updated && (eraCliente || esCliente)) {
        await this.usuariosCliente?.sincronizarDesdeAdmin(updated, actor?.sub ?? null);
      }
      return updated;
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        // Ver create(): reactivar/reasignar un cliente_admin con otro ya activo
        // en la empresa dispara el índice parcial (Plan 2 §4.4).
        if (UsuarioClienteService.esViolacionClienteAdminUnico(e)) {
          throw new AppError('CLIENTE_ADMIN_UNICO');
        }
        throw new AppError('USUARIO_DUPLICATE');
      }
      throw e;
    }
  }

  @Post('usuarios/:id/reset-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  async resetPassword(@Param('id') id: string, @Body() body: ResetPasswordDto) {
    if (!body?.password) {
      throw new AppError('VALIDATION_ERROR', { message: 'password requerido' });
    }
    const existing = await this.prisma.usuario.findUnique({ where: { id } });
    if (!existing) throw new AppError('USUARIO_NOT_FOUND');
    const passwordHash = await bcrypt.hash(body.password, 10);
    const data: Prisma.UsuarioUpdateInput = { password: passwordHash };
    // Mismo backfill que en update(): sin username, la contraseña nueva no sirve
    // para loguearse (el login busca por username, no por email).
    if (!existing.username) {
      if (!existing.email) {
        throw new AppError('VALIDATION_ERROR', {
          message: 'Este usuario no tiene username ni email: asígnale uno antes de resetear la contraseña, o no podrá iniciar sesión.',
        });
      }
      data.username = existing.email.toLowerCase().trim();
    }
    await this.prisma.usuario.update({ where: { id }, data });
  }

  @Delete('usuarios/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async softDelete(@Param('id') id: string) {
    const existing = await this.prisma.usuario.findUnique({ where: { id } });
    if (!existing) throw new AppError('USUARIO_NOT_FOUND');
    await this.prisma.usuario.update({
      where: { id },
      data: { activo: false, puedeIniciarSesion: false },
    });
    // Fase 4 (§4.2): desactivado el usuario, sus membresías de portal caen también.
    await this.usuariosCliente?.sincronizarDesdeAdmin(
      { id, empresaId: existing.empresaId, activo: false, role: null },
      null,
    );
  }

  private async resolveRoleId(slug: string): Promise<string> {
    if (!slug) {
      throw new AppError('VALIDATION_ERROR', { message: 'role requerido' });
    }
    const role = await this.prisma.role.findUnique({ where: { slug } });
    if (!role) {
      throw new AppError('VALIDATION_ERROR', { message: `Role inválido: ${slug}` });
    }
    return role.id;
  }
}
