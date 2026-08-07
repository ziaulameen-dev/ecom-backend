import { IsEmail } from 'class-validator';

/** Validated body for POST /auth/email/change — starts an email change. */
export class ChangeEmailDto {
  @IsEmail()
  newEmail!: string;
}
