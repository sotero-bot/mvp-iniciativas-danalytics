import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Ip,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';

import { AppError } from '../../../shared/errors/AppError';
import { JwtAuthGuard, RolesGuard, Roles, CurrentUser } from '../../auth/guards';
import type { AuthUser } from '../../auth/guards';
import { UsuarioClienteService } from '../application/usuario-cliente.service';

interface InvitarDto {
  nombre: string;
  email: string;
  locale?: 'es' | 'pt';
}

// Fase 4 (Plan 2 §4.1 — RF-44/RF-45): SOLO el `cliente_admin` gestiona los
// `usuario_cliente` de SU empresa (el `usuario_cliente` es solo lectura y no
// puede dar acceso a otros — matriz de roles §0.1). El scoping por empresa es
// estructural: todas las operaciones usan `actor.empresaId` del JWT (RN-09).
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('cliente_admin')
@Controller('portal')
export class PortalUsuariosClienteController {
  constructor(private readonly usuariosCliente: UsuarioClienteService) {}

  @Get('usuarios-cliente')
  async list(@CurrentUser() actor: AuthUser) {
    return this.usuariosCliente.listar(this.requireEmpresa(actor));
  }

  // RF-44/RF-45: invitar (crea/reactiva el usuario_cliente y envía la invitación).
  @Post('usuarios-cliente')
  async invitar(@Body() body: InvitarDto, @CurrentUser() actor: AuthUser, @Ip() ip: string) {
    return this.usuariosCliente.invitar({
      empresaId: this.requireEmpresa(actor),
      invitadoPorId: actor.sub,
      nombre: body?.nombre,
      email: body?.email,
      locale: body?.locale,
      ip,
    });
  }

  // RF-44: revocar acceso (soft — conserva la historia de la invitación).
  @Delete('usuarios-cliente/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async revocar(@Param('id') id: string, @CurrentUser() actor: AuthUser) {
    await this.usuariosCliente.revocar(id, this.requireEmpresa(actor));
  }

  // C-07: programas IA en Acción de la empresa + los asignados a este usuario_cliente.
  @Get('usuarios-cliente/:usuarioId/programas')
  async programas(@Param('usuarioId') usuarioId: string, @CurrentUser() actor: AuthUser) {
    return this.usuariosCliente.programasAsignables(usuarioId, this.requireEmpresa(actor));
  }

  // C-07: asignar un programa al usuario_cliente (acotado a la empresa del actor).
  @Post('usuarios-cliente/:usuarioId/programas')
  async asignarPrograma(
    @Param('usuarioId') usuarioId: string,
    @Body() body: { programaId: string },
    @CurrentUser() actor: AuthUser,
  ) {
    return this.usuariosCliente.asignarPrograma({
      usuarioId,
      programaId: body?.programaId,
      asignadoPorId: actor.sub,
      empresaGuard: this.requireEmpresa(actor),
    });
  }

  @Delete('usuarios-cliente/:usuarioId/programas/:programaId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async desasignarPrograma(
    @Param('usuarioId') usuarioId: string,
    @Param('programaId') programaId: string,
    @CurrentUser() actor: AuthUser,
  ) {
    await this.usuariosCliente.desasignarPrograma({
      usuarioId,
      programaId,
      empresaGuard: this.requireEmpresa(actor),
    });
  }

  private requireEmpresa(actor: AuthUser): string {
    if (!actor.empresaId) throw new AppError('PORTAL_ACCESO_DENEGADO');
    return actor.empresaId;
  }
}
