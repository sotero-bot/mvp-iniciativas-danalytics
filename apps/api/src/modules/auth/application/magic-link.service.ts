import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes } from 'crypto';

import { PrismaService } from '../../../prisma.service';
import { AppError } from '../../../shared/errors/AppError';
import { EmailService } from '../../email/email.service';

const TOKEN_TTL_MINUTES = 60 * 24;
const TOKEN_BYTES = 32;
const REQUEST_LIMIT_PER_EMAIL = 3;
const REQUEST_WINDOW_MS = 60 * 60 * 1000;

type Locale = 'es' | 'pt';

interface CreateAndSendOptions {
  usuarioId: string;
  ipCreacion?: string;
  locale?: Locale;
  propositoRedirect?: string | null;
}

export interface MagicLinkConsumeResult {
  accessToken: string;
  usuario: {
    id: string;
    nombre: string;
    email: string | null;
    role: { slug: string; nombre: string } | null;
    empresaId: string | null;
  };
  propositoRedirect: string | null;
}

@Injectable()
export class MagicLinkService {
  private readonly requestHistory = new Map<string, number[]>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly email: EmailService,
  ) {}

  private allowRequest(email: string): boolean {
    const now = Date.now();
    const history = (this.requestHistory.get(email) ?? []).filter(t => now - t < REQUEST_WINDOW_MS);
    if (history.length >= REQUEST_LIMIT_PER_EMAIL) {
      this.requestHistory.set(email, history);
      return false;
    }
    history.push(now);
    this.requestHistory.set(email, history);
    return true;
  }

  async createAndSend(opts: CreateAndSendOptions): Promise<{ id: string; expiraEn: Date }> {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: opts.usuarioId },
      include: { role: true },
    });
    if (!usuario) throw new AppError('USUARIO_NOT_FOUND');
    if (!usuario.email) {
      throw new AppError('VALIDATION_ERROR', {
        message: 'El usuario no tiene email, no se puede enviar MagicLink',
      });
    }
    if (!usuario.puedeIniciarSesion || !usuario.activo) {
      throw new AppError('VALIDATION_ERROR', {
        message: 'El usuario no tiene habilitado el inicio de sesión',
      });
    }

    const rawToken = randomBytes(TOKEN_BYTES).toString('base64url');
    const tokenHash = hashToken(rawToken);
    const expiraEn = new Date(Date.now() + TOKEN_TTL_MINUTES * 60 * 1000);

    const record = await this.prisma.magicLink.create({
      data: {
        tokenHash,
        usuarioId: usuario.id,
        email: usuario.email,
        propositoRedirect: opts.propositoRedirect ?? null,
        expiraEn,
        ipCreacion: opts.ipCreacion ?? null,
      },
    });

    const baseUrl = process.env.APP_BASE_URL || 'http://localhost:5173';
    const url = `${baseUrl.replace(/\/$/, '')}/auth/link/${rawToken}`;

    await this.email.sendMagicLink({
      to: usuario.email,
      url,
      nombreUsuario: usuario.nombre,
      locale: opts.locale ?? 'es',
      expiraMinutos: TOKEN_TTL_MINUTES,
    });

    return { id: record.id, expiraEn };
  }

  async consume(rawToken: string, ip?: string): Promise<MagicLinkConsumeResult> {
    if (!rawToken || rawToken.length < 20) {
      throw new AppError('MAGIC_LINK_INVALID');
    }
    const tokenHash = hashToken(rawToken);
    const link = await this.prisma.magicLink.findUnique({
      where: { tokenHash },
      include: {
        usuario: {
          include: { role: true },
        },
      },
    });
    if (!link) throw new AppError('MAGIC_LINK_INVALID');
    if (link.usadoEn) throw new AppError('MAGIC_LINK_USADO');
    if (link.expiraEn.getTime() < Date.now()) throw new AppError('MAGIC_LINK_EXPIRADO');

    const usuario = link.usuario;
    if (!usuario.activo || !usuario.puedeIniciarSesion) {
      throw new AppError('AUTH_INVALID_CREDENTIALS');
    }

    await this.prisma.magicLink.update({
      where: { id: link.id },
      data: { usadoEn: new Date(), ipUso: ip ?? null },
    });

    const payload = {
      sub: usuario.id,
      role: usuario.role?.slug ?? null,
      empresaId: usuario.empresaId ?? null,
    };
    const accessToken = this.jwt.sign(payload);

    return {
      accessToken,
      usuario: {
        id: usuario.id,
        nombre: usuario.nombre,
        email: usuario.email,
        role: usuario.role ? { slug: usuario.role.slug, nombre: usuario.role.nombre } : null,
        empresaId: usuario.empresaId,
      },
      propositoRedirect: link.propositoRedirect,
    };
  }

  async requestByEmail(email: string, ip?: string, locale?: Locale): Promise<void> {
    const normalized = email.toLowerCase().trim();
    if (!normalized) throw new AppError('VALIDATION_ERROR', { message: 'email requerido' });

    if (!this.allowRequest(normalized)) return;

    const usuario = await this.prisma.usuario.findFirst({
      where: {
        email: normalized,
        activo: true,
        puedeIniciarSesion: true,
      },
    });
    // No filtramos por si existe: mismo comportamiento OK/silencioso para evitar user enumeration.
    if (!usuario) return;

    await this.createAndSend({
      usuarioId: usuario.id,
      ipCreacion: ip,
      locale,
    });
  }
}

function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}
