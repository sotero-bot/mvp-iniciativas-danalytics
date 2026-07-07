import { Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';
import { AppError } from '../../shared/errors/AppError';

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

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly resend: Resend | null;
  private readonly from: string;

  constructor() {
    const apiKey = process.env.RESEND_API_KEY;
    this.from = process.env.EMAIL_FROM || 'Danalytics <no-reply@danalytics.co>';
    this.resend = apiKey ? new Resend(apiKey) : null;
    if (!this.resend) {
      this.logger.warn(
        'RESEND_API_KEY no configurado. Los envíos se logueárán a consola en vez de enviarse.',
      );
    }
  }

  async sendMagicLink(payload: MagicLinkPayload): Promise<void> {
    const subject = SUBJECT[payload.locale] ?? SUBJECT.es;
    const html = (BODY_HTML[payload.locale] ?? BODY_HTML.es)(payload);

    if (!this.resend) {
      this.logger.log(
        `[DEV] MagicLink para ${payload.to}: ${payload.url}`,
      );
      return;
    }

    const { error } = await this.resend.emails.send({
      from: this.from,
      to: payload.to,
      subject,
      html,
    });

    if (error) {
      this.logger.error(`Error enviando MagicLink a ${payload.to}: ${error.message}`);
      throw new AppError('EMAIL_SEND_FAILED', { message: error.message });
    }
  }
}
