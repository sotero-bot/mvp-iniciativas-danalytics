import { EmailMessage, EmailTransport } from './email-transport.interface';

/**
 * Opción 2 (futuro): Gmail API + Service Account con domain-wide delegation.
 *
 * Migración cuando se implemente:
 * - Variables: GMAIL_API_SERVICE_ACCOUNT_JSON (credenciales de la service account,
 *   JSON serializado) y GMAIL_API_IMPERSONATE_USER (cuenta de Workspace a impersonar).
 * - Usar googleapis (JWT auth con el JSON de la service account, scope
 *   'https://www.googleapis.com/auth/gmail.send') para armar y enviar el mensaje RFC 2822
 *   codificado en base64url vía users.messages.send.
 * - Activar seteando EMAIL_TRANSPORT=gmail_api en env; email.module.ts ya resuelve esa rama.
 * - No requiere tocar EmailService, MagicLinkService, plantillas ni endpoints: solo esta clase.
 */
export class GmailApiTransport implements EmailTransport {
  async send(_msg: EmailMessage): Promise<void> {
    throw new Error(
      'GmailApiTransport no está implementado todavía (Opción 2, futuro). ' +
        'Usa EMAIL_TRANSPORT=smtp o EMAIL_TRANSPORT=resend por ahora.',
    );
  }
}
