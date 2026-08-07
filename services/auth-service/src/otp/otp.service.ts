import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomInt } from 'crypto';
import { LessThan, Repository } from 'typeorm';
import { LoginOtp } from './login-otp.entity';

/** Result of verifying an OTP. */
export type OtpVerifyResult =
  | { ok: true }
  | { ok: false; reason: 'not_found' | 'expired' | 'too_many_attempts' | 'mismatch' };

/**
 * Issues and verifies one-time login codes. Codes are stored HASHED with an
 * expiry and an attempt limit. One active challenge per email.
 */
@Injectable()
export class OtpService {
  constructor(
    @InjectRepository(LoginOtp)
    private readonly otps: Repository<LoginOtp>,
    private readonly config: ConfigService,
  ) {}

  /**
   * Create (or replace) an OTP for an email and return the PLAIN code so the
   * caller can email it. Only the hash is persisted.
   */
  async issue(email: string): Promise<{ code: string; ttlSeconds: number }> {
    const length = this.config.get<number>('otp.length')!;
    const ttlSeconds = this.config.get<number>('otp.ttlSeconds')!;
    const normalized = email.toLowerCase();

    // Per-email resend cooldown: reject if a code was sent too recently.
    const cooldown = this.config.get<number>('otp.resendCooldownSeconds')!;
    const existing = await this.otps.findOne({ where: { email: normalized } });
    if (existing) {
      const elapsedMs = Date.now() - existing.createdAt.getTime();
      const remainingMs = cooldown * 1000 - elapsedMs;
      if (remainingMs > 0) {
        const retryAfterSeconds = Math.ceil(remainingMs / 1000);
        throw new HttpException(
          {
            message: `Please wait ${retryAfterSeconds}s before requesting another code`,
            retryAfterSeconds,
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }

    const code = this.generateNumericCode(length);

    // Replace any existing challenge for this email.
    await this.otps.delete({ email: normalized });
    await this.otps.save(
      this.otps.create({
        email: normalized,
        codeHash: this.hash(code),
        expiresAt: new Date(Date.now() + ttlSeconds * 1000),
        attempts: 0,
      }),
    );

    return { code, ttlSeconds };
  }

  /** Verify a submitted code; consumes the challenge on success. */
  async verify(email: string, code: string): Promise<OtpVerifyResult> {
    const normalized = email.toLowerCase();
    const otp = await this.otps.findOne({ where: { email: normalized } });
    if (!otp) return { ok: false, reason: 'not_found' };

    if (otp.expiresAt.getTime() < Date.now()) {
      await this.otps.delete({ id: otp.id });
      return { ok: false, reason: 'expired' };
    }

    const maxAttempts = this.config.get<number>('otp.maxAttempts')!;
    if (otp.attempts >= maxAttempts) {
      await this.otps.delete({ id: otp.id });
      return { ok: false, reason: 'too_many_attempts' };
    }

    if (this.hash(code) !== otp.codeHash) {
      await this.otps.increment({ id: otp.id }, 'attempts', 1);
      return { ok: false, reason: 'mismatch' };
    }

    // Success — one-time use, so delete it.
    await this.otps.delete({ id: otp.id });
    return { ok: true };
  }

  /** Delete expired challenges (called by the scheduled cleanup). */
  async purgeExpired(now: Date = new Date()): Promise<number> {
    const res = await this.otps.delete({ expiresAt: LessThan(now) });
    return res.affected ?? 0;
  }

  /** Uniformly random numeric string of the given length (may have leading 0s). */
  private generateNumericCode(length: number): string {
    let code = '';
    for (let i = 0; i < length; i++) {
      code += randomInt(0, 10).toString();
    }
    return code;
  }

  private hash(code: string): string {
    return createHash('sha256').update(code).digest('hex');
  }
}
