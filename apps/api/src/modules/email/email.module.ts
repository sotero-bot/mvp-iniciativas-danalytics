import { Logger, Module } from '@nestjs/common';
import { EmailService } from './email.service';
import { ConsoleTransport } from './transports/console.transport';
import { EMAIL_TRANSPORT, EmailTransport } from './transports/email-transport.interface';
import { GmailApiTransport } from './transports/gmail-api.transport';
import { ResendTransport } from './transports/resend.transport';
import { SmtpTransport } from './transports/smtp.transport';

const logger = new Logger('EmailModule');

export function buildTransport(): EmailTransport {
  const kind = process.env.EMAIL_TRANSPORT || 'resend';
  const from = process.env.EMAIL_FROM || 'Danalytics <no-reply@danalytics.co>';

  if (kind === 'smtp') {
    const user = process.env.GMAIL_SMTP_USER;
    const appPassword = process.env.GMAIL_SMTP_APP_PASSWORD;
    if (user && appPassword) {
      return new SmtpTransport(user, appPassword, from);
    }
    logger.warn(
      'EMAIL_TRANSPORT=smtp pero faltan GMAIL_SMTP_USER/GMAIL_SMTP_APP_PASSWORD. Los envíos se logueárán a consola en vez de enviarse.',
    );
    return new ConsoleTransport();
  }

  if (kind === 'gmail_api') {
    // Opción 2 (futuro): Gmail API + Service Account. Ver transports/gmail-api.transport.ts
    // para la guía de implementación completa. Hoy la clase existe como stub y lanza si se usa.
    return new GmailApiTransport();
  }

  // Default histórico: Resend.
  const apiKey = process.env.RESEND_API_KEY;
  if (apiKey) {
    return new ResendTransport(apiKey, from);
  }
  logger.warn('RESEND_API_KEY no configurado. Los envíos se logueárán a consola en vez de enviarse.');
  return new ConsoleTransport();
}

@Module({
  providers: [
    { provide: EMAIL_TRANSPORT, useFactory: buildTransport },
    EmailService,
  ],
  exports: [EmailService],
})
export class EmailModule {}
