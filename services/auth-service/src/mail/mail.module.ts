import { Module } from '@nestjs/common';
import { MailService } from './mail.service';

/** Provides email sending (via SMTP/Mailpit). Exported for the AuthModule. */
@Module({
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
