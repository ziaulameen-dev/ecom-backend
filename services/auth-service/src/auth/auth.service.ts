import { Injectable, UnauthorizedException } from '@nestjs/common';
import { KeysService } from '../keys/keys.service';
import { MailService } from '../mail/mail.service';
import { OtpService } from '../otp/otp.service';
import { User } from '../users/user.entity';
import { UserProfile, UsersService } from '../users/users.service';

/** What the token-issuing path returns. */
export interface AuthResult {
  accessToken: string;
  tokenType: 'Bearer';
  user: {
    id: string;
    email: string;
    name: string | null;
    roles: string[];
  };
}

/** What requesting an OTP returns — no token yet, just a challenge. */
export interface OtpChallenge {
  otpRequired: true;
  email: string;
  expiresInSeconds: number;
  // Lets the frontend show the (optional) profile form for first-time signups.
  isNewUser: boolean;
}

/**
 * Passwordless authentication. There is no register vs login — one flow:
 *
 *   1. requestOtp() — email a one-time code (whether or not the user exists)
 *   2. verifyOtp()  — validate the code; create the account if it's new; issue
 *                     the access token
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly keys: KeysService,
    private readonly otp: OtpService,
    private readonly mail: MailService,
  ) {}

  /**
   * Step 1: email a one-time code. Works for both new and returning users —
   * a new email simply becomes a new account when it verifies (step 2).
   */
  async requestOtp(email: string): Promise<OtpChallenge> {
    const normalized = email.toLowerCase();
    const isNewUser = !(await this.users.findByEmail(normalized));

    const { code, ttlSeconds } = await this.otp.issue(normalized);
    await this.mail.sendOtp(normalized, code, ttlSeconds);

    return {
      otpRequired: true,
      email: normalized,
      expiresInSeconds: ttlSeconds,
      isNewUser,
    };
  }

  /**
   * Step 2: validate the OTP and issue the token. If the email has no account
   * yet, create one on the spot using the (optional) profile fields.
   */
  async verifyOtp(
    email: string,
    code: string,
    profile: UserProfile = {},
  ): Promise<AuthResult> {
    const result = await this.otp.verify(email, code);
    if (!result.ok) {
      throw new UnauthorizedException(`Invalid code (${result.reason})`);
    }

    const user =
      (await this.users.findByEmail(email)) ??
      (await this.users.create(email, ['customer'], profile));

    return this.issue(user);
  }

  /** Mint a token for an authenticated user and shape the response. */
  private issue(user: User): AuthResult {
    const accessToken = this.keys.signAccessToken({
      sub: user.id,
      email: user.email,
      roles: user.roles,
    });
    return {
      accessToken,
      tokenType: 'Bearer',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        roles: user.roles,
      },
    };
  }
}
