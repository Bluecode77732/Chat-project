import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { UserRole } from 'src/auth/role/role';
import { logger } from 'src/base/logger/logger';

@Injectable()
export class MailService {
  private readonly transporter: nodemailer.Transporter | null;
  private readonly from: string;

  constructor(private readonly configService: ConfigService) {
    const host = this.configService.get<string>('SMTP_HOST');
    const user = this.configService.get<string>('SMTP_USER');
    const pass = this.configService.get<string>('SMTP_PASS');
    this.from = this.configService.get<string>('MAIL_FROM') ?? user ?? '';

    if (!host || !user || !pass) {
      logger.warn(
        'SMTP_HOST/SMTP_USER/SMTP_PASS is not configured. Role promotion emails will be skipped.',
      );
      this.transporter = null;
      return;
    }

    this.transporter = nodemailer.createTransport({
      host,
      port: this.configService.get<number>('SMTP_PORT', 587),
      secure: this.configService.get<number>('SMTP_PORT', 587) === 465,
      auth: { user, pass },
    });
  }

  async sendRoleChangeEmail(
    to: string,
    previousRole: UserRole,
    newRole: UserRole,
  ): Promise<void> {
    if (!this.transporter) return;

    const roleLabel = (role: UserRole) => UserRole[role] ?? String(role);
    const promoted = newRole > previousRole;

    await this.transporter.sendMail({
      from: this.from,
      to,
      subject: promoted
        ? 'Your role has been upgraded'
        : 'Your role has changed',
      text: `Your account role has changed from ${roleLabel(previousRole)} to ${roleLabel(newRole)}.`,
    });
  }
}
