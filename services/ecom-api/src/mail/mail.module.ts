import { Module } from '@nestjs/common';
import { MailService } from './mail.service';

/** Order notification emails. */
@Module({
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
