import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LoginOtp } from './login-otp.entity';
import { OtpService } from './otp.service';

/** Owns the login OTP store; exported for the AuthModule. */
@Module({
  imports: [TypeOrmModule.forFeature([LoginOtp])],
  providers: [OtpService],
  exports: [OtpService],
})
export class OtpModule {}
