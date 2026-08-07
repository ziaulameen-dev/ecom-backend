import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { OtpService } from '../otp/otp.service';
import { RefreshService } from '../refresh/refresh.service';

/**
 * Periodic housekeeping: purge expired OTP challenges and expired refresh
 * tokens so those tables don't grow unbounded with dead rows.
 */
@Injectable()
export class CleanupService {
  private readonly logger = new Logger(CleanupService.name);

  constructor(
    private readonly otp: OtpService,
    private readonly refresh: RefreshService,
  ) {}

  @Cron(CronExpression.EVERY_30_MINUTES)
  async purge() {
    const otps = await this.otp.purgeExpired();
    const tokens = await this.refresh.purgeExpired();
    if (otps || tokens) {
      this.logger.log(`Purged ${otps} expired OTPs, ${tokens} expired tokens`);
    }
  }
}
