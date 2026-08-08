import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/**
 * Deduplicates Cashfree webhook events by a caller-supplied key (Cashfree may
 * deliver an event more than once and has no stable event id).
 * `firstDelivery(key)` returns true only the first time a key is seen; a Redis
 * blip fails OPEN (returns true) so we never silently drop a legitimate event —
 * the handlers are idempotent anyway.
 */
@Injectable()
export class WebhookEventsService implements OnModuleDestroy {
  private readonly logger = new Logger(WebhookEventsService.name);
  private readonly redis: Redis;

  constructor(config: ConfigService) {
    this.redis = new Redis({
      host: config.get<string>('redis.host'),
      port: config.get<number>('redis.port'),
      maxRetriesPerRequest: 2,
    });
    this.redis.on('error', (e) => this.logger.warn(`Redis: ${e.message}`));
  }

  async firstDelivery(eventKey: string): Promise<boolean> {
    try {
      // SET key NX with a 24h TTL — succeeds only the first time.
      const res = await this.redis.set(
        `cf:evt:${eventKey}`,
        '1',
        'EX',
        86400,
        'NX',
      );
      return res === 'OK';
    } catch {
      return true; // fail open
    }
  }

  onModuleDestroy() {
    this.redis.disconnect();
  }
}
