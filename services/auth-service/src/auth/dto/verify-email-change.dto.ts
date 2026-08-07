import { IsEmail, IsNotEmpty, IsString, Length } from 'class-validator';

/**
 * Validated body for POST /auth/email/verify. The OTP was sent to the CURRENT
 * email; `newEmail` is resent here (the change is stateless — no pending row).
 */
export class VerifyEmailChangeDto {
  @IsEmail()
  newEmail!: string;

  @IsString()
  @IsNotEmpty()
  @Length(4, 10)
  otp!: string;
}
