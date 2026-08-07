import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  MaxLength,
} from 'class-validator';

/**
 * Validated body for POST /auth/verify-otp — step 2 of the passwordless flow.
 *
 * The profile fields are only used when this email is signing up for the first
 * time (all optional). For an existing user they are ignored — they just log in.
 * Country is intentionally NOT collected here; it belongs to the shipping
 * address captured later at checkout.
 */
export class VerifyOtpDto {
  @IsEmail()
  email!: string;

  @IsString()
  @IsNotEmpty()
  // 6-digit code by default; keep a small range in case OTP_LENGTH changes.
  @Length(4, 10)
  otp!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  mobile?: string;
}
