
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

import { AppError } from '../../../shared/errors/AppError';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService
  ) { }

  /** Datos del actor autenticado para mostrar en la UI (barra lateral). */
  async getProfile(usuarioId: string) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: {
        id: true,
        nombre: true,
        email: true,
        username: true,
        empresaId: true,
        empresa: { select: { id: true, nombre: true } },
        role: { select: { slug: true, nombre: true } },
      },
    });
    if (!usuario) throw new AppError('USUARIO_NOT_FOUND');
    return usuario;
  }

  async validateAdmin(username: string, pass: string): Promise<any> {
    console.log(`[AuthService] Intentando validar usuario: ${username}`);
    const admin = await this.prisma.usuario.findFirst({
      where: { username, role: { slug: 'danalytics_admin' } },
      include: { role: true },
    });
    if (admin) {
      if (!admin.activo || !admin.puedeIniciarSesion) {
        console.log(`[AuthService] Usuario INACTIVO o sin login habilitado: ${username}`);
        return null;
      }
      if (!admin.password) {
        console.log(`[AuthService] Usuario sin password configurado: ${username}`);
        return null;
      }
      console.log(`[AuthService] Usuario encontrado en BD, verificando password...`);
      const isMatch = await bcrypt.compare(pass, admin.password);
      if (isMatch) {
        console.log(`[AuthService] Password Correcto`);
        const { password, ...result } = admin;
        return result;
      } else {
        console.log(`[AuthService] Password INCORRECTO`);
      }
    } else {
      console.log(`[AuthService] Usuario NO encontrado: ${username}`);
    }
    return null;
  }

  async login(user: any) {
    // Plan 2 §0.1: el payload del JWT es `{ sub, role, empresaId }`
    // (mismo shape que emite el magic link). `username` solo para admin.
    const payload = {
      sub: user.id,
      role: user.role?.slug ?? null,
      empresaId: user.empresaId ?? null,
      username: user.username ?? null,
    };
    return {
      access_token: this.jwtService.sign(payload),
    };
  }

  /**
   * Firma el JWT a partir de un `AuthUser` ya normalizado (flujo OAuth Google, §1.1).
   * Mismo contrato `{ sub, role, empresaId }` que `login()` y el magic link.
   */
  loginFromAuthUser(actor: {
    sub: string;
    role: string | null;
    empresaId: string | null;
    username?: string | null;
  }) {
    const payload = {
      sub: actor.sub,
      role: actor.role ?? null,
      empresaId: actor.empresaId ?? null,
      username: actor.username ?? null,
    };
    return {
      access_token: this.jwtService.sign(payload),
    };
  }
}
