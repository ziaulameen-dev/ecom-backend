import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import { Response } from 'express';
import { AuthResult, AuthService } from './auth.service';
import { CurrentUser } from './current-user.decorator';
import { ChangeEmailDto } from './dto/change-email.dto';
import { ConfirmOtpDto } from './dto/confirm-otp.dto';
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
  requestOtp(@Body() dto: RequestOtpDto) {
    return this.auth.requestOtp(dto.email);
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
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.auth.verifyOtp(dto.email, dto.otp, {
      name: dto.name,
      mobile: dto.mobile,
    });
    return this.deliver(result, source, res);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(this.config.get<string>('cookie.name')!, { path: '/' });
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
    });
  }

  @Post('email/change')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  // Step 1: email an OTP to the CURRENT address to authorize the change.
  @Throttle({ default: { limit: 5, ttl: 900_000 } })
  changeEmail(@CurrentUser() user: AuthUser, @Body() dto: ChangeEmailDto) {
    return this.auth.requestEmailChange(user.sub, dto.newEmail);
  }

  @Post('email/verify-old')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  // Step 2: confirm the old-email OTP, then email an OTP to the pending address.
  @Throttle({ default: { limit: 10, ttl: 900_000 } })
  verifyOldEmail(@CurrentUser() user: AuthUser, @Body() dto: ConfirmOtpDto) {
    return this.auth.verifyOldEmailForChange(user.sub, dto.otp);
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
    res.clearCookie(this.config.get<string>('cookie.name')!, { path: '/' });
    return result;
  }

  /**
   * Deliver the token either as a Bearer token in the body (default) or as an
   * HttpOnly cookie, based on the X-Auth-Source header.
   */
  private deliver(result: AuthResult, source: string, res: Response) {
    if ((source ?? '').toLowerCase() === 'cookie') {
      res.cookie(this.config.get<string>('cookie.name')!, result.accessToken, {
        httpOnly: true,
        sameSite: this.config.get('cookie.sameSite'),
        secure: this.config.get<boolean>('cookie.secure'),
        path: '/',
        maxAge: this.config.get<number>('cookie.maxAgeMs'),
      });
      return { user: result.user };
    }
    return {
      accessToken: result.accessToken,
      tokenType: result.tokenType,
      user: result.user,
    };
  }
}
