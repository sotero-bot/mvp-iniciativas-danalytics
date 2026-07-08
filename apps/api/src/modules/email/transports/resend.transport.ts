import { Logger } from '@nestjs/common';
import { Resend } from 'resend';
import { AppError } from '../../../shared/errors/AppError';
import { EmailMessage, EmailTransport } from './email-transport.interface';

export class ResendTransport implements EmailTransport {
  private readonly logger = new Logger(ResendTransport.name);
  private readonly resend: Resend;

  constructor(apiKey: string, private readonly from: string) {
    this.resend = new Resend(apiKey);
  }

  async send(msg: EmailMessage): Promise<void> {
    const { error } = await this.resend.emails.send({
      from: this.from,
      to: msg.to,
      subject: msg.subject,
      html: msg.html,
    });

    if (error) {
      this.logger.error(`Error enviando email a ${msg.to}: ${error.message}`);
      throw new AppError('EMAIL_SEND_FAILED', { message: error.message });
    }
  }
}
