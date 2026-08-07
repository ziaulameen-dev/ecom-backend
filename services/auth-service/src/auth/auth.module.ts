import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { DenylistModule } from '../denylist/denylist.module';
import { KeysModule } from '../keys/keys.module';
import { MailModule } from '../mail/mail.module';
import { OtpModule } from '../otp/otp.module';
import { RefreshModule } from '../refresh/refresh.module';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';

/**
 * Wires authentication: users (accounts), keys (sign + verify), otp (codes),
 * and mail (delivering the OTP). JwtAuthGuard protects the account-management
 * routes (it verifies tokens locally via KeysService).
 */
@Module({
  imports: [
    UsersModule,
    KeysModule,
    OtpModule,
    MailModule,
    RefreshModule,
    AuditModule,
    DenylistModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard],
})
export class AuthModule {}
