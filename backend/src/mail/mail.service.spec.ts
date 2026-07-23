import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { MailService } from './mail.service';
import { UserRole } from 'src/auth/role/role';

jest.mock('nodemailer');
jest.mock('src/base/logger/logger', () => ({
  logger: { warn: jest.fn(), info: jest.fn() },
}));

describe('MailService', () => {
  const sendMail = jest.fn();
  const createTransportMock = nodemailer.createTransport as jest.Mock;

  const buildConfigService = (values: Record<string, unknown>) =>
    ({
      get: jest.fn((key: string, fallback?: unknown) => {
        if (key in values) return values[key];
        return fallback;
      }),
    }) as unknown as ConfigService;

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('leaves the transporter null when SMTP_HOST/USER/PASS are not fully configured.', () => {
      const configService = buildConfigService({});

      new MailService(configService);

      expect(createTransportMock).not.toHaveBeenCalled();
    });

    it('creates a transporter with secure:false on the default non-465 port.', () => {
      const configService = buildConfigService({
        SMTP_HOST: 'smtp.example.com',
        SMTP_USER: 'user@example.com',
        SMTP_PASS: 'pw',
      });
      createTransportMock.mockReturnValue({ sendMail });

      new MailService(configService);

      expect(createTransportMock).toHaveBeenCalledWith({
        host: 'smtp.example.com',
        port: 587,
        secure: false,
        auth: { user: 'user@example.com', pass: 'pw' },
      });
    });

    it('marks the transporter secure when SMTP_PORT is 465.', () => {
      const configService = buildConfigService({
        SMTP_HOST: 'smtp.example.com',
        SMTP_USER: 'user@example.com',
        SMTP_PASS: 'pw',
        SMTP_PORT: 465,
      });
      createTransportMock.mockReturnValue({ sendMail });

      new MailService(configService);

      expect(createTransportMock).toHaveBeenCalledWith(
        expect.objectContaining({ port: 465, secure: true }),
      );
    });

    it('falls back to SMTP_USER as the from address when MAIL_FROM is unset.', async () => {
      const configService = buildConfigService({
        SMTP_HOST: 'smtp.example.com',
        SMTP_USER: 'user@example.com',
        SMTP_PASS: 'pw',
      });
      createTransportMock.mockReturnValue({ sendMail });
      sendMail.mockResolvedValue(undefined);

      const mailService = new MailService(configService);
      await mailService.sendRoleChangeEmail(
        'to@example.com',
        UserRole.user,
        UserRole.admin,
      );

      expect(sendMail).toHaveBeenCalledWith(
        expect.objectContaining({ from: 'user@example.com' }),
      );
    });
  });

  describe('sendRoleChangeEmail', () => {
    it('does nothing when the transporter was never configured.', async () => {
      const configService = buildConfigService({});
      const mailService = new MailService(configService);

      await mailService.sendRoleChangeEmail(
        'to@example.com',
        UserRole.user,
        UserRole.admin,
      );

      expect(sendMail).not.toHaveBeenCalled();
    });

    it('sends an upgrade-worded email when the new role outranks the previous one.', async () => {
      const configService = buildConfigService({
        SMTP_HOST: 'smtp.example.com',
        SMTP_USER: 'user@example.com',
        SMTP_PASS: 'pw',
        MAIL_FROM: 'no-reply@example.com',
      });
      createTransportMock.mockReturnValue({ sendMail });
      sendMail.mockResolvedValue(undefined);
      const mailService = new MailService(configService);

      await mailService.sendRoleChangeEmail(
        'to@example.com',
        UserRole.user,
        UserRole.admin,
      );

      expect(sendMail).toHaveBeenCalledWith({
        from: 'no-reply@example.com',
        to: 'to@example.com',
        subject: 'Your role has been upgraded',
        text: 'Your account role has changed from user to admin.',
      });
    });

    it('sends a neutral-worded email when the new role is a demotion.', async () => {
      const configService = buildConfigService({
        SMTP_HOST: 'smtp.example.com',
        SMTP_USER: 'user@example.com',
        SMTP_PASS: 'pw',
        MAIL_FROM: 'no-reply@example.com',
      });
      createTransportMock.mockReturnValue({ sendMail });
      sendMail.mockResolvedValue(undefined);
      const mailService = new MailService(configService);

      await mailService.sendRoleChangeEmail(
        'to@example.com',
        UserRole.admin,
        UserRole.user,
      );

      expect(sendMail).toHaveBeenCalledWith({
        from: 'no-reply@example.com',
        to: 'to@example.com',
        subject: 'Your role has changed',
        text: 'Your account role has changed from admin to user.',
      });
    });
  });
});
