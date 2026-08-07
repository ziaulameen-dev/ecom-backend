import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/**
 * A Redis-backed denylist of revoked session ids (the `sid` claim carried in
 * every access token). On logout / logout-all / account deletion the sid is
 * added here with a TTL equal to the access token's remaining lifetime; both
 * services check it on every request, so a revoked token stops working
 * immediately even though the JWT itself is still cryptographically valid.
 */
@Injectable()
export class DenylistService implements OnModuleDestroy {
  private readonly logger = new Logger(DenylistService.name);
  private readonly redis: Redis;

  constructor(config: ConfigService) {
    this.redis = new Redis({
      host: config.get<string>('redis.host'),
      port: config.get<number>('redis.port'),
      maxRetriesPerRequest: 2,
      lazyConnect: false,
    });
    this.redis.on('error', (e) =>
      this.logger.warn(`Redis error: ${e.message}`),
    );
  }

  /** Revoke a session id until its access token would have expired. */
  async deny(sid: string, ttlSeconds: number): Promise<void> {
    if (!sid) return;
    await this.redis.set(this.key(sid), '1', 'EX', Math.max(1, ttlSeconds));
  }

  /** True if this session id has been revoked. */
  async isDenied(sid: string): Promise<boolean> {
    if (!sid) return false;
    return (await this.redis.exists(this.key(sid))) === 1;
  }

  onModuleDestroy() {
    this.redis.disconnect();
  }

  private key(sid: string): string {
    return `denylist:sid:${sid}`;
  }
}
