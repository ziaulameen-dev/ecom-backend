import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/**
 * Deduplicates Stripe webhook events by id (Stripe may deliver an event more
 * than once). `firstDelivery(id)` returns true only the first time an id is
 * seen; a Redis blip fails OPEN (returns true) so we never silently drop a
 * legitimate event — the handlers are idempotent anyway.
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

  async firstDelivery(eventId: string): Promise<boolean> {
    try {
      // SET key NX with a 24h TTL — succeeds only the first time.
      const res = await this.redis.set(
        `stripe:evt:${eventId}`,
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
