import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import { randomBytes } from 'crypto';
import { Request, Response } from 'express';
import { AuthResult, AuthService } from './auth.service';
import { CurrentUser } from './current-user.decorator';
import { ChangeEmailVerifyDto } from './dto/change-email-verify.dto';
import { ConfirmOtpDto } from './dto/confirm-otp.dto';
import { RefreshDto } from './dto/refresh.dto';
import { RequestOtpDto } from './dto/request-otp.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { AuthUser, JwtAuthGuard } from './jwt-auth.guard';

/**
 * Passwordless authentication. One flow for both signup and login:
 *
 *   POST /auth/otp         {email}                 -> emails a one-time code
 *   POST /auth/verify-otp  {email,otp,...profile?} -> returns the token
 *                                                     (creates the account if new)
 *
 * Token DELIVERY (on verify-otp) is chosen with the `X-Auth-Source` header:
 *   - `bearer` (DEFAULT/auto) -> token in the JSON body (mobile / services)
 *   - `cookie`                -> HttpOnly cookie, token NOT in the body (browser)
 */
const AUTH_SOURCE_HEADER = 'x-auth-source';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Post('otp')
  @HttpCode(HttpStatus.OK)
  // Each request sends a real email, so it's the abuse-sensitive one: cap it
  // hard (5 per 15 min per IP). Only enforced when RATE_LIMIT_ENABLED=true.
  @Throttle({ default: { limit: 5, ttl: 900_000 } })
  // Step 1: email a one-time code. Returns a challenge, not a token.
  requestOtp(
    @Body() dto: RequestOtpDto,
    @Headers('accept-language') acceptLanguage: string,
  ) {
    return this.auth.requestOtp(dto.email, acceptLanguage);
  }

  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  // Limit code-guessing across emails (10 per 15 min per IP); the per-code
  // attempt cap (OTP_MAX_ATTEMPTS) is the other half of the defense.
  @Throttle({ default: { limit: 10, ttl: 900_000 } })
  // Step 2: validate the OTP, create the account if new, deliver the token.
  async verifyOtp(
    @Body() dto: VerifyOtpDto,
    @Headers(AUTH_SOURCE_HEADER) source: string,
    @Headers('accept-language') acceptLanguage: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.auth.verifyOtp(
      dto.email,
      dto.otp,
      { name: dto.name, mobile: dto.mobile, locale: dto.locale },
      acceptLanguage,
    );
    return this.deliver(result, source, res);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  // Exchange a valid refresh token for a new access token (rotates the refresh
  // token too). NOT guarded — the refresh token itself is the credential.
  @Throttle({ default: { limit: 30, ttl: 900_000 } })
  async refresh(
    @Body() dto: RefreshDto,
    @Headers(AUTH_SOURCE_HEADER) source: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const token = this.extractRefreshToken(req, dto.refreshToken);
    const result = await this.auth.refreshSession(token ?? '');
    return this.deliver(result, source, res);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  // Revoke the presented refresh token and clear both auth cookies.
  async logout(
    @Body() dto: RefreshDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.auth.logout(this.extractRefreshToken(req, dto.refreshToken));
    this.clearAuthCookies(res);
    return { loggedOut: true };
  }

  @Post('logout-all')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  // Revoke every session for the current user (log out on all devices).
  async logoutAll(
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.auth.logoutAll(user.sub);
    this.clearAuthCookies(res);
    return { loggedOut: true };
  }

  // ---- Authenticated account management -------------------------------------

  @Get('me')
  @UseGuards(JwtAuthGuard)
  // Return the current user (handy for a profile screen after login).
  me(@CurrentUser() user: AuthUser) {
    return this.auth.getProfile(user.sub);
  }

  @Patch('profile')
  @UseGuards(JwtAuthGuard)
  // Update the optional profile fields (name / mobile).
  updateProfile(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.auth.updateProfile(user.sub, {
      name: dto.name,
      mobile: dto.mobile,
      locale: dto.locale,
    });
  }

  @Post('email/change')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  // Step 1: email an OTP to the CURRENT address (no new email asked for yet).
  @Throttle({ default: { limit: 5, ttl: 900_000 } })
  changeEmail(@CurrentUser() user: AuthUser) {
    return this.auth.requestEmailChange(user.sub);
  }

  @Post('email/verify-old')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  // Step 2: supply the new email + old-email OTP; on success email an OTP to it.
  @Throttle({ default: { limit: 10, ttl: 900_000 } })
  verifyOldEmail(
    @CurrentUser() user: AuthUser,
    @Body() dto: ChangeEmailVerifyDto,
  ) {
    return this.auth.verifyOldEmailForChange(user.sub, dto.newEmail, dto.otp);
  }

  @Post('email/verify-new')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  // Step 3: confirm the new-email OTP, switch the email, re-issue the token.
  @Throttle({ default: { limit: 10, ttl: 900_000 } })
  async verifyNewEmail(
    @CurrentUser() user: AuthUser,
    @Body() dto: ConfirmOtpDto,
    @Headers(AUTH_SOURCE_HEADER) source: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.auth.verifyNewEmailAndSwitch(user.sub, dto.otp);
    return this.deliver(result, source, res);
  }

  @Post('account/delete')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  // Step 1: email an OTP to the current address to confirm this destructive act.
  @Throttle({ default: { limit: 5, ttl: 900_000 } })
  requestAccountDeletion(@CurrentUser() user: AuthUser) {
    return this.auth.requestAccountDeletion(user.sub);
  }

  @Post('account/delete/verify')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  // Step 2: confirm the OTP, soft-delete (deactivate) the account, end the session.
  @Throttle({ default: { limit: 10, ttl: 900_000 } })
  async verifyAccountDeletion(
    @CurrentUser() user: AuthUser,
    @Body() dto: ConfirmOtpDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.auth.verifyAccountDeletion(user.sub, dto.otp);
    this.clearAuthCookies(res);
    return result;
  }

  /**
   * Deliver the token pair either in the body (Bearer — mobile/services) or as
   * HttpOnly cookies (browser), based on the X-Auth-Source header. The refresh
   * token is always issued; only its transport differs.
   */
  private deliver(result: AuthResult, source: string, res: Response) {
    if ((source ?? '').toLowerCase() === 'cookie') {
      const secure = this.config.get<boolean>('cookie.secure');
      const sameSite = this.config.get('cookie.sameSite');
      res.cookie(this.config.get<string>('cookie.name')!, result.accessToken, {
        httpOnly: true,
        sameSite,
        secure,
        path: '/',
        maxAge: this.config.get<number>('cookie.maxAgeMs'),
      });
      res.cookie(
        this.config.get<string>('refresh.cookieName')!,
        result.refreshToken,
        {
          httpOnly: true,
          sameSite,
          secure,
          path: '/',
          expires: result.refreshExpiresAt,
        },
      );
      // CSRF double-submit token: readable by JS (NOT httpOnly) so the client
      // can echo it in the X-CSRF-Token header on state-changing requests.
      const csrfToken = randomBytes(32).toString('hex');
      res.cookie(this.config.get<string>('csrf.cookieName')!, csrfToken, {
        httpOnly: false,
        sameSite,
        secure,
        path: '/',
        expires: result.refreshExpiresAt,
      });
      return { user: result.user, csrfToken };
    }
    return {
      accessToken: result.accessToken,
      tokenType: result.tokenType,
      refreshToken: result.refreshToken,
      user: result.user,
    };
  }

  /** Read the refresh token from the request body or the HttpOnly cookie. */
  private extractRefreshToken(req: Request, bodyToken?: string): string | null {
    if (bodyToken) return bodyToken;
    const name = this.config.get<string>('refresh.cookieName')!;
    const cookies = (req as Request & { cookies?: Record<string, string> })
      .cookies;
    return cookies?.[name] ?? null;
  }

  private clearAuthCookies(res: Response) {
    res.clearCookie(this.config.get<string>('cookie.name')!, { path: '/' });
    res.clearCookie(this.config.get<string>('refresh.cookieName')!, {
      path: '/',
    });
    res.clearCookie(this.config.get<string>('csrf.cookieName')!, { path: '/' });
  }
}
