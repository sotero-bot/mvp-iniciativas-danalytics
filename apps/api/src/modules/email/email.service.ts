import { Inject, Injectable } from '@nestjs/common';
import { TipoNotificacion } from '@prisma/client';
import { randomUUID } from 'crypto';

import { PrismaService } from '../../prisma.service';
import { AppError } from '../../shared/errors/AppError';
import { EMAIL_TRANSPORT, EmailTransport } from './transports/email-transport.interface';

type Locale = 'es' | 'pt';

interface MagicLinkPayload {
  to: string;
  url: string;
  nombreUsuario: string;
  locale: Locale;
  expiraMinutos: number;
}

const SUBJECT: Record<Locale, string> = {
  es: 'Tu enlace de acceso a Danalytics',
  pt: 'Seu link de acesso ao Danalytics',
};

const BODY_HTML: Record<Locale, (p: MagicLinkPayload) => string> = {
  es: (p) => `
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#111">
      <h2 style="margin:0 0 16px">Hola, ${escapeHtml(p.nombreUsuario)}</h2>
      <p>Recibiste este correo porque alguien solicitó acceso a Danalytics para <strong>${escapeHtml(p.to)}</strong>.</p>
      <p style="margin:24px 0">
        <a href="${p.url}" style="display:inline-block;padding:12px 24px;background:#2563eb;color:#fff;border-radius:6px;text-decoration:none;font-weight:600">
          Iniciar sesión
        </a>
      </p>
      <p style="color:#6b7280;font-size:14px">
        El enlace expira en ${p.expiraMinutos} minutos y solo puede usarse una vez.
        Si no fuiste tú, puedes ignorar este correo.
      </p>
    </div>
  `,
  pt: (p) => `
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#111">
      <h2 style="margin:0 0 16px">Olá, ${escapeHtml(p.nombreUsuario)}</h2>
      <p>Você recebeu este e-mail porque alguém solicitou acesso ao Danalytics para <strong>${escapeHtml(p.to)}</strong>.</p>
      <p style="margin:24px 0">
        <a href="${p.url}" style="display:inline-block;padding:12px 24px;background:#2563eb;color:#fff;border-radius:6px;text-decoration:none;font-weight:600">
          Entrar
        </a>
      </p>
      <p style="color:#6b7280;font-size:14px">
        O link expira em ${p.expiraMinutos} minutos e só pode ser usado uma vez.
        Se não foi você, pode ignorar este e-mail.
      </p>
    </div>
  `,
};

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

interface ObservacionEmailVars {
  programa: string;
  tipo: string;
  urgencia: string;
  texto: string;
}

interface MaterialDisponibleVars {
  nombreUsuario: string;
  programa: string;
  numeroSesion: number;
}

/** Templates internos de operación (RF-40) — solo español: destinatarios son el equipo Danalytics. */
function renderObservacionEmail(urgente: boolean, v: ObservacionEmailVars): { subject: string; html: string } {
  const prefix = urgente ? '⚠ URGENTE ' : '';
  return {
    subject: `${prefix}[IA en Acción] Observación — ${v.programa}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#111">
        <h2 style="margin:0 0 16px">${prefix}Nueva observación en ${escapeHtml(v.programa)}</h2>
        <p><strong>Tipo:</strong> ${escapeHtml(v.tipo)} · <strong>Urgencia:</strong> ${escapeHtml(v.urgencia)}</p>
        <p style="white-space:pre-wrap">${escapeHtml(v.texto)}</p>
      </div>
    `,
  };
}

/** RF-09/RNF-10 — sí requiere locale: el destinatario es el estudiante. */
const MATERIAL_DISPONIBLE_SUBJECT: Record<Locale, (v: MaterialDisponibleVars) => string> = {
  es: (v) => `Material de la sesión ${v.numeroSesion} disponible — ${v.programa}`,
  pt: (v) => `Material da sessão ${v.numeroSesion} disponível — ${v.programa}`,
};
const MATERIAL_DISPONIBLE_HTML: Record<Locale, (v: MaterialDisponibleVars) => string> = {
  es: (v) => `
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#111">
      <h2 style="margin:0 0 16px">Hola, ${escapeHtml(v.nombreUsuario)}</h2>
      <p>El material de la sesión ${v.numeroSesion} de <strong>${escapeHtml(v.programa)}</strong> ya está disponible.</p>
    </div>
  `,
  pt: (v) => `
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#111">
      <h2 style="margin:0 0 16px">Olá, ${escapeHtml(v.nombreUsuario)}</h2>
      <p>O material da sessão ${v.numeroSesion} de <strong>${escapeHtml(v.programa)}</strong> já está disponível.</p>
    </div>
  `,
};

interface SendParams {
  tipo: TipoNotificacion;
  to: string;
  subject: string;
  html: string;
  programaId?: string;
  usuarioId?: string;
  observacionId?: string;
}

@Injectable()
export class EmailService {
  constructor(
    @Inject(EMAIL_TRANSPORT) private readonly transport: EmailTransport,
    private readonly prisma: PrismaService,
  ) {}

  async sendMagicLink(payload: MagicLinkPayload): Promise<void> {
    const subject = SUBJECT[payload.locale] ?? SUBJECT.es;
    const html = (BODY_HTML[payload.locale] ?? BODY_HTML.es)(payload);
    await this.send({ tipo: TipoNotificacion.magic_link, to: payload.to, subject, html });
  }

  async sendObservacion(
    urgente: boolean,
    destinatarios: string[],
    vars: ObservacionEmailVars,
    refs: { programaId: string; observacionId: string },
  ): Promise<void> {
    const { subject, html } = renderObservacionEmail(urgente, vars);
    const tipo = urgente ? TipoNotificacion.observacion_urgente : TipoNotificacion.observacion_normal;
    await Promise.all(
      destinatarios.map((to) => this.send({ tipo, to, subject, html, ...refs })),
    );
  }

  async sendMaterialDisponible(
    to: string,
    locale: Locale,
    vars: MaterialDisponibleVars,
    refs: { programaId: string; usuarioId: string },
  ): Promise<void> {
    const subject = (MATERIAL_DISPONIBLE_SUBJECT[locale] ?? MATERIAL_DISPONIBLE_SUBJECT.es)(vars);
    const html = (MATERIAL_DISPONIBLE_HTML[locale] ?? MATERIAL_DISPONIBLE_HTML.es)(vars);
    await this.send({ tipo: TipoNotificacion.material_disponible, to, subject, html, ...refs });
  }

  /**
   * RNF-12 "reenvío manual": reconstruye el email desde los soft-refs de
   * `NotificacionEmail` (sin columnas nuevas) y reintenta sobre la MISMA fila
   * (incrementa `intentos`, no crea una fila nueva).
   */
  async resend(notificacionId: string): Promise<void> {
    const row = await this.prisma.notificacionEmail.findUnique({ where: { id: notificacionId } });
    if (!row) throw new AppError('NOTIFICACION_NOT_FOUND');

    if (row.tipo === TipoNotificacion.observacion_normal || row.tipo === TipoNotificacion.observacion_urgente) {
      if (!row.observacionId) {
        throw new AppError('VALIDATION_ERROR', { message: 'La notificación no tiene observacionId asociado' });
      }
      const observacion = await this.prisma.observacionFacilitador.findUnique({
        where: { id: row.observacionId },
      });
      if (!observacion) throw new AppError('OBSERVACION_NOT_FOUND');
      const programa = await this.prisma.programa.findUnique({ where: { id: observacion.programaId } });
      const { subject, html } = renderObservacionEmail(row.tipo === TipoNotificacion.observacion_urgente, {
        programa: programa?.nombre ?? '',
        tipo: observacion.tipo,
        urgencia: observacion.urgencia,
        texto: observacion.texto,
      });
      await this.resendRaw(row.id, row.destinatario, subject, html);
      return;
    }

    throw new AppError('VALIDATION_ERROR', {
      message: `Reenvío no soportado todavía para tipo=${row.tipo}`,
    });
  }

  private async resendRaw(notificacionId: string, to: string, subject: string, html: string): Promise<void> {
    try {
      await this.transport.send({ to, subject, html });
      await this.prisma.notificacionEmail.update({
        where: { id: notificacionId },
        data: { estado: 'enviada', enviadoEn: new Date(), intentos: { increment: 1 }, error: null },
      });
    } catch (err) {
      await this.prisma.notificacionEmail.update({
        where: { id: notificacionId },
        data: {
          estado: 'fallida',
          error: err instanceof Error ? err.message : String(err),
          intentos: { increment: 1 },
        },
      });
      throw err;
    }
  }

  /**
   * RNF-12: envío genérico que SIEMPRE registra una fila `NotificacionEmail`
   * (enviada/fallida) — permite bitácora + reenvío manual desde el panel admin.
   */
  async send(params: SendParams): Promise<void> {
    const notificacion = await this.prisma.notificacionEmail.create({
      data: {
        id: randomUUID(),
        tipo: params.tipo,
        destinatario: params.to,
        asunto: params.subject,
        programaId: params.programaId ?? null,
        usuarioId: params.usuarioId ?? null,
        observacionId: params.observacionId ?? null,
      },
    });
    try {
      await this.transport.send({ to: params.to, subject: params.subject, html: params.html });
      await this.prisma.notificacionEmail.update({
        where: { id: notificacion.id },
        data: { estado: 'enviada', enviadoEn: new Date(), intentos: { increment: 1 } },
      });
    } catch (err) {
      await this.prisma.notificacionEmail.update({
        where: { id: notificacion.id },
        data: {
          estado: 'fallida',
          error: err instanceof Error ? err.message : String(err),
          intentos: { increment: 1 },
        },
      });
      throw err;
    }
  }
}
