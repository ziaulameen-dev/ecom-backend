import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/**
 * Read side of the shared session denylist. The auth-service writes revoked
 * session ids (the access token's `sid`) here on logout / logout-all / delete;
 * this guard checks them so a revoked token is rejected immediately even though
 * its signature is still valid.
 *
 * Fail-open: if Redis is unreachable we log and allow the request (tokens still
 * expire on their own), so a Redis blip can't take the whole API down.
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

  async isDenied(sid: string): Promise<boolean> {
    if (!sid) return false;
    try {
      return (await this.redis.exists(`denylist:sid:${sid}`)) === 1;
    } catch (e) {
      this.logger.warn(`Denylist check failed, allowing: ${String(e)}`);
      return false;
    }
  }

  onModuleDestroy() {
    this.redis.disconnect();
  }
}
