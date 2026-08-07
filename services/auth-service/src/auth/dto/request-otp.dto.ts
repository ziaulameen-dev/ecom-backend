import { IsEmail } from 'class-validator';

/**
 * Validated body for POST /auth/otp — step 1 of the passwordless flow.
 * The user only supplies an email; we email them a one-time code.
 */
export class RequestOtpDto {
  @IsEmail()
  email!: string;
}
