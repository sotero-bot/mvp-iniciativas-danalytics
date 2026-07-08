import { Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { AppError } from '../../../shared/errors/AppError';
import { EmailMessage, EmailTransport } from './email-transport.interface';

/** Opción 1 (MVP): Gmail SMTP + App Password. */
export class SmtpTransport implements EmailTransport {
  private readonly logger = new Logger(SmtpTransport.name);
  private readonly transporter: nodemailer.Transporter;

  constructor(user: string, appPassword: string, private readonly from: string) {
    this.transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: { user, pass: appPassword },
    });
  }

  async send(msg: EmailMessage): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: this.from,
        to: msg.to,
        subject: msg.subject,
        html: msg.html,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Error enviando email a ${msg.to}: ${message}`);
      throw new AppError('EMAIL_SEND_FAILED', { message });
    }
  }
}
