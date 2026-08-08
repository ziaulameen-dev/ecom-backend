import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import {
  Locale,
  OtpPurpose,
  RTL_LOCALES,
  TRANSLATIONS,
} from './i18n';

export { OtpPurpose } from './i18n';

/**
 * Sends transactional email via SMTP. In development the SMTP target is
 * Mailpit, which captures messages and shows them in its web UI instead of
 * delivering to real inboxes — perfect for testing the OTP flow.
 *
 * Copy is localized (see i18n.ts); the caller passes the recipient's locale.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: nodemailer.Transporter;

  constructor(private readonly config: ConfigService) {
    // Dev -> Mailpit (no auth/TLS). Prod -> real SMTP with auth/TLS.
    const isProd = this.config.get<string>('nodeEnv') === 'production';
    const user = this.config.get<string>('mail.user');
    this.transporter = nodemailer.createTransport({
      host: this.config.get<string>('mail.host'),
      port: this.config.get<number>('mail.port'),
      secure: isProd && this.config.get<boolean>('mail.secure'),
      ...(isProd && user
        ? { auth: { user, pass: this.config.get<string>('mail.pass') } }
        : {}),
    });
  }

  /**
   * Email a one-time code. `purpose` tailors the subject/body (what it's for,
   * who it's for, what to do if it wasn't them); `locale` picks the language.
   */
  async sendOtp(
    to: string,
    code: string,
    ttlSeconds: number,
    purpose: OtpPurpose,
    locale: Locale = 'en',
  ) {
    const app = this.config.get<string>('appName')!;
    const minutes = Math.round(ttlSeconds / 60);
    const t = TRANSLATIONS[locale] ?? TRANSLATIONS.en;
    const { subject, reason } = t.purposes[purpose];

    await this.transporter.sendMail({
      from: `"${app}" <${this.config.get<string>('mail.from')}>`,
      to,
      subject: `${app}: ${subject} (${code})`,
      text: this.textBody(app, to, reason, code, minutes, t.labels),
      html: this.htmlBody(app, to, reason, code, minutes, t.labels, locale),
    });

    this.logger.log(`Sent '${purpose}' OTP to ${to} [${locale}]`);
  }

  private textBody(
    app: string,
    to: string,
    reason: string,
    code: string,
    minutes: number,
    labels: (typeof TRANSLATIONS)['en']['labels'],
  ): string {
    return [
      reason,
      ``,
      `${labels.codeLabel}: ${code}`,
      labels.expires(minutes),
      ``,
      labels.sentTo(to),
      labels.ignore,
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
    labels: (typeof TRANSLATIONS)['en']['labels'],
    locale: Locale,
  ): string {
    const dir = RTL_LOCALES.includes(locale) ? 'rtl' : 'ltr';
    return `
      <div dir="${dir}" style="font-family:system-ui,Arial,sans-serif;max-width:480px;margin:0 auto;color:#111">
        <h2 style="margin:0 0 12px">${app}</h2>
        <p style="margin:0 0 16px">${reason}</p>
        <p style="font-size:28px;font-weight:700;letter-spacing:4px;margin:0 0 8px">${code}</p>
        <p style="color:#555;margin:0 0 20px">${labels.expires(minutes)}</p>
        <hr style="border:none;border-top:1px solid #eee;margin:20px 0" />
        <p style="color:#777;font-size:13px;margin:0 0 4px">${labels.sentTo(to)}</p>
        <p style="color:#777;font-size:13px;margin:0">${labels.ignore}</p>
      </div>`;
  }
}
