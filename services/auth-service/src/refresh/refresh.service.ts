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
  sid: string; // the row id — also the access token's session id (sid)
}

/**
 * Thrown when an ALREADY-ROTATED (revoked) refresh token is presented again.
 * With single-use rotation this means the token leaked and is being replayed —
 * a theft signal. The caller reacts by revoking the user's whole session family.
 */
export class RefreshReuseError extends Error {
  constructor(readonly userId: string) {
    super('Refresh token reuse detected');
  }
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

    const row = await this.tokens.save(
      this.tokens.create({ userId, tokenHash: this.hash(token), expiresAt }),
    );
    return { token, expiresAt, sid: row.id };
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
    if (!row || row.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException('Invalid or expired session');
    }

    // Already rotated once -> this is a replay of a used token = theft signal.
    if (row.revokedAt) {
      throw new RefreshReuseError(row.userId);
    }

    row.revokedAt = new Date();
    await this.tokens.save(row);

    const issued = await this.issue(row.userId);
    return { userId: row.userId, issued };
  }

  /**
   * Revoke a single token (logout). Returns the revoked session id (row id) so
   * the caller can denylist it, or null if the token was unknown/already gone.
   */
  async revoke(token: string): Promise<string | null> {
    const row = await this.tokens.findOne({
      where: { tokenHash: this.hash(token), revokedAt: IsNull() },
    });
    if (!row) return null;
    row.revokedAt = new Date();
    await this.tokens.save(row);
    return row.id;
  }

  /**
   * Revoke every active token for a user (logout-all / account deletion).
   * Returns the revoked session ids so the caller can denylist them all.
   */
  async revokeAllForUser(userId: string): Promise<string[]> {
    const rows = await this.tokens.find({
      where: { userId, revokedAt: IsNull() },
    });
    const now = new Date();
    for (const row of rows) row.revokedAt = now;
    if (rows.length) await this.tokens.save(rows);
    return rows.map((r) => r.id);
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
