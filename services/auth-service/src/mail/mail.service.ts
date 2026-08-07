import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

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

  /** Email a one-time code to the user (used for both signup and login). */
  async sendOtp(to: string, code: string, ttlSeconds: number) {
    const minutes = Math.round(ttlSeconds / 60);
    await this.transporter.sendMail({
      from: this.config.get<string>('mail.from'),
      to,
      subject: `Your verification code: ${code}`,
      text: `Your verification code is ${code}. It expires in ${minutes} minutes.`,
      html: `<p>Your verification code is:</p>
             <p style="font-size:24px;font-weight:bold;letter-spacing:3px">${code}</p>
             <p>It expires in ${minutes} minutes. If you didn't request this, ignore this email.</p>`,
    });
    this.logger.log(`Sent OTP to ${to}`);
  }
}
