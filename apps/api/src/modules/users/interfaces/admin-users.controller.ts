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
import { JwtAuthGuard, RolesGuard, Roles } from '../../auth/guards';

const ADMIN_SLUG = 'danalytics_admin';
const EMPRESA_SLUGS = new Set(['estudiante', 'cliente_admin', 'usuario_cliente']);

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
// TODO(fase-4): al crear/editar cliente_admin o usuario_cliente, mantener sincronizada
//   la tabla puente `UsuarioCliente(empresaId, usuarioId, invitadoPorId, activo)`.
//   Hoy la relación se infiere solo por `Usuario.empresaId` + role.
//
// TODO(fase-2): scoping por rol distinto de danalytics_admin.
//   - facilitador → solo estudiantes de sus programas (JOIN via ParticipantePrograma).
//   - cliente_admin → usuarios de su empresa (lectura + invitar/revocar usuario_cliente).
//   - usuario_cliente → misma vista de cliente_admin en lectura.
//   Requiere: middleware que extraiga el actor del JWT y aplique WHERE por scope.
//   Actualmente todos los endpoints asumen actor = danalytics_admin (frontend controla el gating).
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('danalytics_admin')
@Controller('admin')
export class AdminUsersController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly magicLink: MagicLinkService,
  ) {}

  @Get('roles')
  async listRoles() {
    return this.prisma.role.findMany({
      where: { activo: true },
      orderBy: { nombre: 'asc' },
      select: { id: true, slug: true, nombre: true, descripcion: true },
    });
  }

  @Get('usuarios')
  async findAll(
    @Query('role') role?: string,
    @Query('empresaId') empresaId?: string,
    @Query('estado') estado?: 'activo' | 'inactivo' | 'todos',
    @Query('search') search?: string,
    @Query('programaId') programaId?: string,
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

    return this.prisma.usuario.findMany({
      where,
      select: SELECT_PUBLIC,
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
  async create(@Body() body: CreateUsuarioDto) {
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
      return await this.prisma.usuario.create({
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
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new AppError('USUARIO_DUPLICATE');
      }
      throw e;
    }
  }

  @Patch('usuarios/:id')
  async update(@Param('id') id: string, @Body() body: UpdateUsuarioDto) {
    const existing = await this.prisma.usuario.findUnique({ where: { id } });
    if (!existing) throw new AppError('USUARIO_NOT_FOUND');

    const data: Prisma.UsuarioUpdateInput = {};
    if (body.nombre !== undefined) data.nombre = body.nombre;
    if (body.role !== undefined) {
      const newRoleId = await this.resolveRoleId(body.role);
      data.role = { connect: { id: newRoleId } };
    }
    if (body.email !== undefined) data.email = body.email?.toLowerCase().trim() || null;
    if (body.username !== undefined) data.username = body.username?.trim() || null;
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
      return await this.prisma.usuario.update({
        where: { id },
        data,
        select: SELECT_PUBLIC,
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
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
    const existing = await this.prisma.usuario.findUnique({
      where: { id },
      include: { role: true },
    });
    if (!existing) throw new AppError('USUARIO_NOT_FOUND');
    if (existing.role?.slug !== ADMIN_SLUG) {
      throw new AppError('VALIDATION_ERROR', { message: 'Solo danalytics_admin usa password' });
    }
    const passwordHash = await bcrypt.hash(body.password, 10);
    await this.prisma.usuario.update({ where: { id }, data: { password: passwordHash } });
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
