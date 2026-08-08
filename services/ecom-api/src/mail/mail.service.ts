import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

export type OrderMailKind = 'paid' | 'shipped' | 'refunded' | 'cancelled';

interface OrderMailData {
  orderId: string;
  kind: OrderMailKind;
  totalMinor: number;
  currency: string;
  carrier?: string | null;
  trackingNumber?: string | null;
}

const COPY: Record<OrderMailKind, { subject: string; line: string }> = {
  paid: { subject: 'Order confirmed', line: 'Thanks! Your payment was received and your order is confirmed.' },
  shipped: { subject: 'Your order has shipped', line: 'Good news — your order is on its way.' },
  refunded: { subject: 'Your refund was processed', line: 'Your refund has been issued to your original payment method.' },
  cancelled: { subject: 'Your order was cancelled', line: 'Your order was cancelled and any payment refunded.' },
};

/** Order notification emails (SMTP -> Mailpit in dev). */
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

  async sendOrderUpdate(to: string, data: OrderMailData): Promise<void> {
    const app = this.config.get<string>('appName');
    const { subject, line } = COPY[data.kind];
    const total = (data.totalMinor / 100).toFixed(2) + ' ' + data.currency.toUpperCase();
    const tracking =
      data.kind === 'shipped' && data.trackingNumber
        ? `\nTracking: ${data.carrier ?? ''} ${data.trackingNumber}`.trimEnd()
        : '';
    try {
      await this.transporter.sendMail({
        from: `"${app}" <${this.config.get<string>('mail.from')}>`,
        to,
        subject: `${app}: ${subject} (#${data.orderId.slice(0, 8)})`,
        text: `${line}\n\nOrder #${data.orderId.slice(0, 8)}\nTotal: ${total}${tracking}\n\n— ${app}`,
      });
      this.logger.log(`Order email '${data.kind}' -> ${to}`);
    } catch (err) {
      this.logger.warn(`Order email failed: ${(err as Error).message}`);
    }
  }
}
