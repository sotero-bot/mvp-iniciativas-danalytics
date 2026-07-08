/**
 * Tests de EmailService + abstracción de transporte (Resend / Gmail SMTP / Gmail API).
 *
 * Cubre:
 * - EmailService.sendMagicLink arma to/subject/html desde las plantillas es/pt y delega en transport.send.
 * - Selección de transporte por EMAIL_TRANSPORT (factory devuelve la clase correcta).
 * - Falla del transporte → AppError('EMAIL_SEND_FAILED').
 * - Sin credenciales → modo "log a consola", sin lanzar.
 * - No se hacen envíos reales (nodemailer y resend mockeados).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const sendMailMock = vi.fn();
const resendSendMock = vi.fn();

vi.mock('nodemailer', () => ({
  createTransport: vi.fn(() => ({ sendMail: sendMailMock })),
}));

vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(function (this: { emails: unknown }) {
    this.emails = { send: resendSendMock };
  }),
}));

const ENV_KEYS = [
  'EMAIL_TRANSPORT',
  'EMAIL_FROM',
  'GMAIL_SMTP_USER',
  'GMAIL_SMTP_APP_PASSWORD',
  'RESEND_API_KEY',
];
const originalEnv: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const key of ENV_KEYS) originalEnv[key] = process.env[key];
  sendMailMock.mockReset();
  resendSendMock.mockReset();
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (originalEnv[key] === undefined) delete process.env[key];
    else process.env[key] = originalEnv[key];
  }
});

describe('EmailService.sendMagicLink', () => {
  it('delega en transport.send con to/subject/html de la plantilla es', async () => {
    const { EmailService } = await import('../../apps/api/src/modules/email/email.service');
    const transport = { send: vi.fn().mockResolvedValue(undefined) };
    const service = new EmailService(transport as never);

    await service.sendMagicLink({
      to: 'user@acme.com',
      url: 'https://app.test/auth/link/abc',
      nombreUsuario: 'Ana',
      locale: 'es',
      expiraMinutos: 60,
    });

    expect(transport.send).toHaveBeenCalledTimes(1);
    const msg = transport.send.mock.calls[0][0];
    expect(msg.to).toBe('user@acme.com');
    expect(msg.subject).toBe('Tu enlace de acceso a Danalytics');
    expect(msg.html).toContain('Ana');
    expect(msg.html).toContain('https://app.test/auth/link/abc');
    expect(msg.html).toContain('Iniciar sesión');
  });

  it('usa la plantilla pt cuando locale=pt', async () => {
    const { EmailService } = await import('../../apps/api/src/modules/email/email.service');
    const transport = { send: vi.fn().mockResolvedValue(undefined) };
    const service = new EmailService(transport as never);

    await service.sendMagicLink({
      to: 'user@acme.com',
      url: 'https://app.test/auth/link/xyz',
      nombreUsuario: 'João',
      locale: 'pt',
      expiraMinutos: 30,
    });

    const msg = transport.send.mock.calls[0][0];
    expect(msg.subject).toBe('Seu link de acesso ao Danalytics');
    expect(msg.html).toContain('Entrar');
  });

  it('propaga el error del transporte tal cual (ej. AppError EMAIL_SEND_FAILED)', async () => {
    const { EmailService } = await import('../../apps/api/src/modules/email/email.service');
    const { AppError } = await import('../../apps/api/src/shared/errors/AppError');
    const transport = {
      send: vi.fn().mockRejectedValue(new AppError('EMAIL_SEND_FAILED', { message: 'boom' })),
    };
    const service = new EmailService(transport as never);

    await expect(
      service.sendMagicLink({
        to: 'user@acme.com',
        url: 'https://app.test/auth/link/abc',
        nombreUsuario: 'Ana',
        locale: 'es',
        expiraMinutos: 60,
      }),
    ).rejects.toMatchObject({ code: 'EMAIL_SEND_FAILED' });
  });
});

describe('buildTransport (selección por EMAIL_TRANSPORT)', () => {
  it('EMAIL_TRANSPORT=smtp con credenciales → SmtpTransport', async () => {
    process.env.EMAIL_TRANSPORT = 'smtp';
    process.env.GMAIL_SMTP_USER = 'bot@gmail.com';
    process.env.GMAIL_SMTP_APP_PASSWORD = 'app-pass';

    const { buildTransport } = await import('../../apps/api/src/modules/email/email.module');
    const { SmtpTransport } = await import('../../apps/api/src/modules/email/transports/smtp.transport');

    expect(buildTransport()).toBeInstanceOf(SmtpTransport);
  });

  it('EMAIL_TRANSPORT=smtp sin credenciales → ConsoleTransport, no lanza', async () => {
    process.env.EMAIL_TRANSPORT = 'smtp';
    delete process.env.GMAIL_SMTP_USER;
    delete process.env.GMAIL_SMTP_APP_PASSWORD;

    const { buildTransport } = await import('../../apps/api/src/modules/email/email.module');
    const { ConsoleTransport } = await import('../../apps/api/src/modules/email/transports/console.transport');

    const transport = buildTransport();
    expect(transport).toBeInstanceOf(ConsoleTransport);
    await expect(transport.send({ to: 'a@b.com', subject: 's', html: '<p>h</p>' })).resolves.toBeUndefined();
  });

  it('EMAIL_TRANSPORT=resend con RESEND_API_KEY → ResendTransport', async () => {
    process.env.EMAIL_TRANSPORT = 'resend';
    process.env.RESEND_API_KEY = 're_test';

    const { buildTransport } = await import('../../apps/api/src/modules/email/email.module');
    const { ResendTransport } = await import('../../apps/api/src/modules/email/transports/resend.transport');

    expect(buildTransport()).toBeInstanceOf(ResendTransport);
  });

  it('EMAIL_TRANSPORT=resend sin RESEND_API_KEY → ConsoleTransport, no lanza', async () => {
    process.env.EMAIL_TRANSPORT = 'resend';
    delete process.env.RESEND_API_KEY;

    const { buildTransport } = await import('../../apps/api/src/modules/email/email.module');
    const { ConsoleTransport } = await import('../../apps/api/src/modules/email/transports/console.transport');

    expect(buildTransport()).toBeInstanceOf(ConsoleTransport);
  });

  it('sin EMAIL_TRANSPORT definido, cae al default histórico (resend)', async () => {
    delete process.env.EMAIL_TRANSPORT;
    delete process.env.RESEND_API_KEY;

    const { buildTransport } = await import('../../apps/api/src/modules/email/email.module');
    const { ConsoleTransport } = await import('../../apps/api/src/modules/email/transports/console.transport');

    expect(buildTransport()).toBeInstanceOf(ConsoleTransport);
  });

  it('EMAIL_TRANSPORT=gmail_api → GmailApiTransport (stub, Opción 2 futura)', async () => {
    process.env.EMAIL_TRANSPORT = 'gmail_api';

    const { buildTransport } = await import('../../apps/api/src/modules/email/email.module');
    const { GmailApiTransport } = await import('../../apps/api/src/modules/email/transports/gmail-api.transport');

    expect(buildTransport()).toBeInstanceOf(GmailApiTransport);
  });
});

describe('SmtpTransport.send', () => {
  it('en éxito llama a nodemailer sendMail con to/subject/html', async () => {
    sendMailMock.mockResolvedValue({ messageId: '1' });
    const { SmtpTransport } = await import('../../apps/api/src/modules/email/transports/smtp.transport');
    const transport = new SmtpTransport('bot@gmail.com', 'app-pass', 'Danalytics <no-reply@danalytics.co>');

    await transport.send({ to: 'user@acme.com', subject: 'Asunto', html: '<p>hola</p>' });

    expect(sendMailMock).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'user@acme.com', subject: 'Asunto', html: '<p>hola</p>' }),
    );
  });

  it('si nodemailer falla, mapea a AppError EMAIL_SEND_FAILED', async () => {
    sendMailMock.mockRejectedValue(new Error('SMTP down'));
    const { SmtpTransport } = await import('../../apps/api/src/modules/email/transports/smtp.transport');
    const { AppError } = await import('../../apps/api/src/shared/errors/AppError');
    const transport = new SmtpTransport('bot@gmail.com', 'app-pass', 'Danalytics <no-reply@danalytics.co>');

    await expect(
      transport.send({ to: 'user@acme.com', subject: 'Asunto', html: '<p>hola</p>' }),
    ).rejects.toBeInstanceOf(AppError);
  });
});

describe('ResendTransport.send', () => {
  it('si Resend devuelve error, mapea a AppError EMAIL_SEND_FAILED', async () => {
    resendSendMock.mockResolvedValue({ error: { message: 'invalid domain' } });
    const { ResendTransport } = await import('../../apps/api/src/modules/email/transports/resend.transport');
    const { AppError } = await import('../../apps/api/src/shared/errors/AppError');
    const transport = new ResendTransport('re_test', 'Danalytics <no-reply@danalytics.co>');

    await expect(
      transport.send({ to: 'user@acme.com', subject: 'Asunto', html: '<p>hola</p>' }),
    ).rejects.toBeInstanceOf(AppError);
  });
});
