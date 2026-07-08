import { Logger } from '@nestjs/common';
import { EmailMessage, EmailTransport } from './email-transport.interface';

/** Transporte de respaldo: loguea el correo en vez de enviarlo (dev / credenciales faltantes). */
export class ConsoleTransport implements EmailTransport {
  private readonly logger = new Logger(ConsoleTransport.name);

  async send(msg: EmailMessage): Promise<void> {
    this.logger.log(`[DEV] Email a ${msg.to} — "${msg.subject}"\n${msg.html}`);
  }
}
