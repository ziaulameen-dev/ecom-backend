import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Res,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import { Response } from 'express';
import { AuthResult, AuthService } from './auth.service';
import { RequestOtpDto } from './dto/request-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';

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
