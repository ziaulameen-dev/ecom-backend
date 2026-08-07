import { IsEmail, IsNotEmpty, IsString, Length } from 'class-validator';

/**
 * Validated body for POST /auth/email/verify-old. The user supplies the NEW
 * address here (step 1 only sent a code to the old one) together with that
 * old-email OTP. On success a second OTP is emailed to `newEmail`.
 */
export class ChangeEmailVerifyDto {
  @IsEmail()
  newEmail!: string;

  @IsString()
  @IsNotEmpty()
  @Length(4, 10)
  otp!: string;
}
