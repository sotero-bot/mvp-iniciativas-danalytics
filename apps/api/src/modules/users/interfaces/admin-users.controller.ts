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
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';

import { PrismaService } from '../../../prisma.service';
import { AppError } from '../../../shared/errors/AppError';

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

// TODO(fase-1): filtro por programa. Requiere tabla `Programa` + `ParticipanteProgama`.
//   Añadir query param `programaId` que haga JOIN a ParticipanteProgama para listar
//   estudiantes de un programa concreto. Usado por la vista del facilitador.
//
// TODO(fase-1): al crear un facilitador, opcionalmente asignarlo a uno o varios
//   `Programa`. Requiere tabla `Programa`. Puede resolverse desde el módulo de
//   programas en lugar de aquí — decidir en Fase 1.
//
// TODO(fase-1): al crear un estudiante, cliente_admin o usuario_cliente con
//   `puedeIniciarSesion=true`, disparar envío de `MagicLink` (o iniciar flujo OAuth
//   si `Empresa.dominioGoogleWorkspace` está configurado). Requiere tabla `MagicLink`
//   y servicio de email transaccional.
//
// TODO(fase-4): al crear/editar cliente_admin o usuario_cliente, mantener sincronizada
//   la tabla puente `UsuarioCliente(empresaId, usuarioId, invitadoPorId, activo)`.
//   Hoy la relación se infiere solo por `Usuario.empresaId` + role.
//
// TODO(fase-2): scoping por rol distinto de danalytics_admin.
//   - facilitador → solo estudiantes de sus programas (JOIN via ParticipanteProgama).
//   - cliente_admin → usuarios de su empresa (lectura + invitar/revocar usuario_cliente).
//   - usuario_cliente → misma vista de cliente_admin en lectura.
//   Requiere: middleware que extraiga el actor del JWT y aplique WHERE por scope.
//   Actualmente todos los endpoints asumen actor = danalytics_admin (frontend controla el gating).
//
// TODO(fase-4): endpoint `POST /admin/usuarios/:id/enviar-invitacion` para reenviar
//   MagicLink a estudiantes/cliente_admin/usuario_cliente que no completaron el primer
//   acceso. Requiere `MagicLink` + servicio de email.
@Controller('admin')
export class AdminUsersController {
  constructor(private readonly prisma: PrismaService) {}

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
  ) {
    const where: Prisma.UsuarioWhereInput = {};

    if (role) {
      where.role = { slug: role };
    }

    if (empresaId) {
      where.empresaId = empresaId;
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
    const username = body.username?.trim() || null;
    const empresaId = body.empresaId || null;

    if (roleSlug === ADMIN_SLUG) {
      if (!username) {
        throw new AppError('VALIDATION_ERROR', { message: 'username requerido para danalytics_admin' });
      }
      if (!body.password) {
        throw new AppError('VALIDATION_ERROR', { message: 'password requerido para danalytics_admin' });
      }
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
