import { Module } from '@nestjs/common';
import { KeysModule } from '../keys/keys.module';
import { MailModule } from '../mail/mail.module';
import { OtpModule } from '../otp/otp.module';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

/**
 * Wires authentication: users (credentials), keys (signing), otp (login codes),
 * and mail (delivering the OTP).
 */
@Module({
  imports: [UsersModule, KeysModule, OtpModule, MailModule],
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}
