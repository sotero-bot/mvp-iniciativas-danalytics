export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
}

export interface EmailTransport {
  send(msg: EmailMessage): Promise<void>;
}

export const EMAIL_TRANSPORT = 'EMAIL_TRANSPORT';
