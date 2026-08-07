import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomBytes } from 'crypto';
import { IsNull, LessThan, Repository } from 'typeorm';
import { RefreshToken } from './refresh-token.entity';

/** A freshly issued refresh token — the RAW value is returned only once. */
export interface IssuedRefreshToken {
  token: string;
  expiresAt: Date;
}

/**
 * Issues, rotates, and revokes refresh tokens. Tokens are opaque random
 * strings; only their hash is stored. Rotation (single-use) means every
 * successful refresh revokes the presented token and mints a new one, so a
 * stolen-and-replayed token is detectable and the window is small.
 */
@Injectable()
export class RefreshService {
  constructor(
    @InjectRepository(RefreshToken)
    private readonly tokens: Repository<RefreshToken>,
    private readonly config: ConfigService,
  ) {}

  /** Mint a new refresh token for a user and persist its hash. */
  async issue(userId: string): Promise<IssuedRefreshToken> {
    const token = randomBytes(32).toString('hex');
    const ttlDays = this.config.get<number>('refresh.ttlDays')!;
    const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);

    await this.tokens.save(
      this.tokens.create({ userId, tokenHash: this.hash(token), expiresAt }),
    );
    return { token, expiresAt };
  }

  /**
   * Validate a presented token and ROTATE it: revoke the old row, issue a new
   * token for the same user. Throws if it's unknown, expired, or revoked.
   */
  async rotate(
    token: string,
  ): Promise<{ userId: string; issued: IssuedRefreshToken }> {
    const row = await this.tokens.findOne({
      where: { tokenHash: this.hash(token) },
    });
    if (!row || row.revokedAt || row.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException('Invalid or expired session');
    }

    row.revokedAt = new Date();
    await this.tokens.save(row);

    const issued = await this.issue(row.userId);
    return { userId: row.userId, issued };
  }

  /** Revoke a single token (logout). No-op if it's unknown. */
  async revoke(token: string): Promise<void> {
    await this.tokens.update(
      { tokenHash: this.hash(token), revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
  }

  /** Revoke every active token for a user (logout-all / account deletion). */
  async revokeAllForUser(userId: string): Promise<void> {
    await this.tokens.update(
      { userId, revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
  }

  /** Delete expired/revoked rows (called by the scheduled cleanup). */
  async purgeExpired(now: Date = new Date()): Promise<number> {
    const res = await this.tokens.delete({ expiresAt: LessThan(now) });
    return res.affected ?? 0;
  }

  private hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
