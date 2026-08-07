import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { KeysService } from '../keys/keys.service';
import { resolveLocale } from '../mail/i18n';
import { MailService } from '../mail/mail.service';
import { OtpService } from '../otp/otp.service';
import { RefreshService } from '../refresh/refresh.service';
import { User } from '../users/user.entity';
import { UserProfile, UsersService } from '../users/users.service';

/** The user shape returned to clients (never includes anything secret). */
export interface UserView {
  id: string;
  email: string;
  name: string | null;
  mobile: string | null;
  locale: string | null;
  roles: string[];
}

/** What the token-issuing path returns. */
export interface AuthResult {
  accessToken: string;
  tokenType: 'Bearer';
  refreshToken: string;
  refreshExpiresAt: Date;
  user: UserView;
}

/** What requesting an OTP returns — no token yet, just a challenge. */
export interface OtpChallenge {
  otpRequired: true;
  email: string;
  expiresInSeconds: number;
  // Lets the frontend show the (optional) profile form for first-time signups.
  isNewUser: boolean;
}

/** What each email-change step returns — tells the client which step is next. */
export interface EmailChangeChallenge {
  otpRequired: true;
  step: 'verify-old' | 'verify-new';
  sentTo: string; // where this OTP was emailed (old email, then new email)
  expiresInSeconds: number;
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
    private readonly refresh: RefreshService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Step 1: email a one-time code. Works for both new and returning users —
   * a new email simply becomes a new account when it verifies (step 2).
   */
  async requestOtp(
    email: string,
    acceptLanguage?: string,
  ): Promise<OtpChallenge> {
    const normalized = email.toLowerCase();
    const existing = await this.users.findByEmail(normalized);
    const locale = resolveLocale(acceptLanguage, existing?.locale);

    const { code, ttlSeconds } = await this.otp.issue(normalized);
    await this.mail.sendOtp(normalized, code, ttlSeconds, 'login', locale);

    return {
      otpRequired: true,
      email: normalized,
      expiresInSeconds: ttlSeconds,
      isNewUser: !existing,
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
    acceptLanguage?: string,
  ): Promise<AuthResult> {
    const result = await this.otp.verify(email, code);
    if (!result.ok) {
      // Generic message — don't leak whether the code was wrong/expired/absent.
      throw new UnauthorizedException('Invalid or expired code');
    }

    const existing = await this.users.findByEmail(email);
    const user =
      existing ??
      (await this.users.create(email, ['customer'], {
        ...profile,
        locale: resolveLocale(acceptLanguage, profile.locale),
      }));

    await this.audit.record(user.id, 'login', { isNewUser: !existing });
    return this.issue(user);
  }

  /** Fetch the current user (for GET /auth/profile). */
  async getProfile(userId: string): Promise<UserView> {
    const user = await this.users.findById(userId);
    if (!user) throw new UnauthorizedException('User not found');
    return this.toUserView(user);
  }

  /** Update the optional profile fields (name / mobile). */
  async updateProfile(
    userId: string,
    profile: UserProfile,
  ): Promise<UserView> {
    const user = await this.users.updateProfile(userId, profile);
    return this.toUserView(user);
  }

  /**
   * Step 1 of an email change: email an OTP to the user's CURRENT address, so
   * they must prove control of the existing inbox. Fails fast if the new
   * address is already taken.
   */
  async requestEmailChange(userId: string): Promise<EmailChangeChallenge> {
    const user = await this.users.findById(userId);
    if (!user) throw new UnauthorizedException('User not found');

    // The new address isn't asked for yet — the user just confirms it's them by
    // receiving a code at their CURRENT inbox. They'll supply newEmail next.
    const { code, ttlSeconds } = await this.otp.issue(user.email);
    await this.mail.sendOtp(
      user.email,
      code,
      ttlSeconds,
      'email-change-old',
      resolveLocale(null, user.locale),
    );

    return {
      otpRequired: true,
      step: 'verify-old',
      sentTo: user.email,
      expiresInSeconds: ttlSeconds,
    };
  }

  /**
   * Step 2: the user supplies the NEW address and the OTP sent to the OLD one.
   * On success we store the target as `pending_email` and email a SECOND OTP to
   * the new address to prove they own it too. The email is not switched yet.
   * Because the new-email OTP is only sent here, step 3 cannot run first.
   */
  async verifyOldEmailForChange(
    userId: string,
    newEmail: string,
    code: string,
  ): Promise<EmailChangeChallenge> {
    const user = await this.users.findById(userId);
    if (!user) throw new UnauthorizedException('User not found');
    await this.assertEmailFree(newEmail, userId);

    const result = await this.otp.verify(user.email, code);
    if (!result.ok) {
      // Generic message — don't leak whether the code was wrong/expired/absent.
      throw new UnauthorizedException('Invalid or expired code');
    }

    await this.users.setPendingEmail(userId, newEmail);

    const normalizedNew = newEmail.toLowerCase();
    const { code: newCode, ttlSeconds } = await this.otp.issue(normalizedNew);
    await this.mail.sendOtp(
      normalizedNew,
      newCode,
      ttlSeconds,
      'email-change-new',
      resolveLocale(null, user.locale),
    );

    return {
      otpRequired: true,
      step: 'verify-new',
      sentTo: normalizedNew, // this OTP goes to the NEW email
      expiresInSeconds: ttlSeconds,
    };
  }

  /**
   * Step 3: validate the OTP sent to the pending NEW email and finally switch
   * the address. A fresh token is issued so its `email` claim matches.
   */
  async verifyNewEmailAndSwitch(
    userId: string,
    code: string,
  ): Promise<AuthResult> {
    const user = await this.users.findById(userId);
    if (!user) throw new UnauthorizedException('User not found');
    const pending = this.requirePendingEmail(user.pendingEmail);

    const result = await this.otp.verify(pending, code);
    if (!result.ok) {
      // Generic message — don't leak whether the code was wrong/expired/absent.
      throw new UnauthorizedException('Invalid or expired code');
    }

    const previousEmail = user.email;
    const updated = await this.users.updateEmail(userId, pending);
    await this.audit.record(userId, 'email_changed', {
      from: previousEmail,
      to: updated.email,
    });
    return this.issue(updated);
  }

  /**
   * Step 1 of account deletion: email an OTP to the current address. Deletion
   * is destructive and irreversible, so we require this step-up confirmation.
   */
  async requestAccountDeletion(
    userId: string,
  ): Promise<{ otpRequired: true; sentTo: string; expiresInSeconds: number }> {
    const user = await this.users.findById(userId);
    if (!user) throw new UnauthorizedException('User not found');

    const { code, ttlSeconds } = await this.otp.issue(user.email);
    await this.mail.sendOtp(
      user.email,
      code,
      ttlSeconds,
      'account-deletion',
      resolveLocale(null, user.locale),
    );

    return { otpRequired: true, sentTo: user.email, expiresInSeconds: ttlSeconds };
  }

  /** Step 2: validate the OTP and soft-delete (deactivate) the account. */
  async verifyAccountDeletion(
    userId: string,
    code: string,
  ): Promise<{ deleted: true }> {
    const user = await this.users.findById(userId);
    if (!user) throw new UnauthorizedException('User not found');

    const result = await this.otp.verify(user.email, code);
    if (!result.ok) {
      // Generic message — don't leak whether the code was wrong/expired/absent.
      throw new UnauthorizedException('Invalid or expired code');
    }

    await this.users.softDelete(userId);
    await this.refresh.revokeAllForUser(userId);
    await this.audit.record(userId, 'account_deleted');
    return { deleted: true };
  }

  /** Guard: the target email must not belong to a different account. */
  private async assertEmailFree(email: string, userId: string): Promise<void> {
    const taken = await this.users.findByEmail(email);
    if (taken && taken.id !== userId) {
      throw new ConflictException('Email already in use');
    }
  }

  /** Guard: there must be an email change in progress. */
  private requirePendingEmail(pendingEmail: string | null): string {
    if (!pendingEmail) {
      throw new BadRequestException('No email change in progress');
    }
    return pendingEmail;
  }

  /**
   * Refresh: rotate the presented refresh token and mint a new access token.
   * Rejects if the session is invalid or the account is gone/deleted.
   */
  async refreshSession(refreshToken: string): Promise<AuthResult> {
    const { userId, issued } = await this.refresh.rotate(refreshToken);
    const user = await this.users.findById(userId);
    if (!user || user.deletedAt) {
      throw new UnauthorizedException('Account no longer active');
    }
    const accessToken = this.keys.signAccessToken({
      sub: user.id,
      email: user.email,
      roles: user.roles,
    });
    return {
      accessToken,
      tokenType: 'Bearer',
      refreshToken: issued.token,
      refreshExpiresAt: issued.expiresAt,
      user: this.toUserView(user),
    };
  }

  /** Revoke a single session (logout). */
  logout(refreshToken: string | null): Promise<void> {
    return refreshToken ? this.refresh.revoke(refreshToken) : Promise.resolve();
  }

  /** Revoke every session for a user (logout everywhere). */
  async logoutAll(userId: string): Promise<void> {
    await this.refresh.revokeAllForUser(userId);
    await this.audit.record(userId, 'logout_all');
  }

  /** Mint an access + refresh token pair and shape the response. */
  private async issue(user: User): Promise<AuthResult> {
    const accessToken = this.keys.signAccessToken({
      sub: user.id,
      email: user.email,
      roles: user.roles,
    });
    const issued = await this.refresh.issue(user.id);
    return {
      accessToken,
      tokenType: 'Bearer',
      refreshToken: issued.token,
      refreshExpiresAt: issued.expiresAt,
      user: this.toUserView(user),
    };
  }

  private toUserView(user: User): UserView {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      mobile: user.mobile,
      locale: user.locale,
      roles: user.roles,
    };
  }
}
