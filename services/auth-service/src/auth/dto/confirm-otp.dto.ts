import { IsNotEmpty, IsString, Length } from 'class-validator';

/**
 * Validated body for the email-change verify steps
 * (POST /auth/email/verify-old and /auth/email/verify-new).
 *
 * Only the OTP is needed — the target address was captured at step 1 and is
 * stored server-side as the user's pending_email.
 */
export class ConfirmOtpDto {
  @IsString()
  @IsNotEmpty()
  @Length(4, 10)
  otp!: string;
}
