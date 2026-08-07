import { Module } from '@nestjs/common';
import { OtpModule } from '../otp/otp.module';
import { RefreshModule } from '../refresh/refresh.module';
import { CleanupService } from './cleanup.service';

/** Scheduled background jobs (expired OTP + refresh-token purging). */
@Module({
  imports: [OtpModule, RefreshModule],
  providers: [CleanupService],
})
export class JobsModule {}
