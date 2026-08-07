import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

/** Why an OTP is being sent — drives the subject and body copy. */
export type OtpPurpose =
  | 'login'
  | 'email-change-old'
  | 'email-change-new'
  | 'account-deletion';

/** Per-purpose email copy: a subject and a one-line reason. */
const OTP_COPY: Record<OtpPurpose, { subject: string; reason: string }> = {
  login: {
    subject: 'Your sign-in code',
    reason: 'Use this code to sign in to your account.',
  },
  'email-change-old': {
    subject: 'Confirm your email change',
    reason:
      'We received a request to change the email address on your account. ' +
      'Enter this code to confirm it’s really you.',
  },
  'email-change-new': {
    subject: 'Verify your new email',
    reason:
      'Confirm this address to finish changing the email on your account.',
  },
  'account-deletion': {
    subject: 'Confirm account deletion',
    reason:
      'Enter this code to permanently deactivate your account. ' +
      'This cannot be undone.',
  },
};

/**
 * Sends transactional email via SMTP. In development the SMTP target is
 * Mailpit, which captures messages and shows them in its web UI instead of
 * delivering to real inboxes — perfect for testing the OTP flow.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: nodemailer.Transporter;

  constructor(private readonly config: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: this.config.get<string>('mail.host'),
      port: this.config.get<number>('mail.port'),
      secure: false, // Mailpit speaks plain SMTP on 1025
    });
  }

  /**
   * Email a one-time code. The `purpose` tailors the subject and explains WHY
   * the message was sent and WHO it is for, so the recipient has context.
   */
  async sendOtp(
    to: string,
    code: string,
    ttlSeconds: number,
    purpose: OtpPurpose,
  ) {
    const app = this.config.get<string>('appName');
    const minutes = Math.round(ttlSeconds / 60);
    const { subject, reason } = OTP_COPY[purpose];

    await this.transporter.sendMail({
      from: `"${app}" <${this.config.get<string>('mail.from')}>`,
      to,
      subject: `${app}: ${subject} (${code})`,
      text: this.textBody(app!, to, reason, code, minutes),
      html: this.htmlBody(app!, to, reason, code, minutes),
    });

    this.logger.log(`Sent '${purpose}' OTP to ${to}`);
  }

  private textBody(
    app: string,
    to: string,
    reason: string,
    code: string,
    minutes: number,
  ): string {
    return [
      `${reason}`,
      ``,
      `Code: ${code}`,
      `This code expires in ${minutes} minutes.`,
      ``,
      `This message was sent to ${to}.`,
      `If you didn’t request it, you can safely ignore this email — no changes will be made.`,
      ``,
      `— ${app}`,
    ].join('\n');
  }

  private htmlBody(
    app: string,
    to: string,
    reason: string,
    code: string,
    minutes: number,
  ): string {
    return `
      <div style="font-family:system-ui,Arial,sans-serif;max-width:480px;margin:0 auto;color:#111">
        <h2 style="margin:0 0 12px">${app}</h2>
        <p style="margin:0 0 16px">${reason}</p>
        <p style="font-size:28px;font-weight:700;letter-spacing:4px;margin:0 0 8px">${code}</p>
        <p style="color:#555;margin:0 0 20px">This code expires in ${minutes} minutes.</p>
        <hr style="border:none;border-top:1px solid #eee;margin:20px 0" />
        <p style="color:#777;font-size:13px;margin:0 0 4px">This message was sent to <strong>${to}</strong>.</p>
        <p style="color:#777;font-size:13px;margin:0">If you didn’t request it, you can safely ignore this email — no changes will be made.</p>
      </div>`;
  }
}
