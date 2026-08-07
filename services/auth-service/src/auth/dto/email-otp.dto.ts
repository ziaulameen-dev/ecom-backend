import { IsEmail, IsNotEmpty, IsString, Length } from 'class-validator';

/**
 * Validated body for both email-change verify steps
 * (POST /auth/email/verify-old and /auth/email/verify-new).
 *
 * `newEmail` is resent on every step so the flow stays stateless (no pending
 * row): step 1 emails an OTP to the OLD address, step 2 to the NEW address.
 */
export class EmailOtpDto {
  @IsEmail()
  newEmail!: string;

  @IsString()
  @IsNotEmpty()
  @Length(4, 10)
  otp!: string;
}
