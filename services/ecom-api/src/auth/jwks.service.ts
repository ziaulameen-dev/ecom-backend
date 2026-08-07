import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwksClient, SigningKey } from 'jwks-rsa';

/**
 * Thin wrapper around a `jwks-rsa` client that fetches the auth service's
 * PUBLIC keys from its JWKS endpoint.
 *
 * The client caches keys by `kid` and rate-limits network calls, so verifying
 * a token normally does NOT hit the network — only the first time a new `kid`
 * is seen (e.g. after the auth service rotates its key).
 */
@Injectable()
export class JwksService {
  private readonly client: JwksClient;

  constructor(config: ConfigService) {
    this.client = new JwksClient({
      jwksUri: config.get<string>('jwt.jwksUri')!,
      cache: true, // cache keys in memory...
      cacheMaxEntries: 5,
      cacheMaxAge: 10 * 60 * 1000, // ...for 10 minutes
      rateLimit: true, // guard the JWKS endpoint from bursts
      jwksRequestsPerMinute: 10,
    });
  }

  /** Resolve the PEM public key for a given token `kid`. */
  async getPublicKey(kid: string): Promise<string> {
    const key: SigningKey = await this.client.getSigningKey(kid);
    return key.getPublicKey();
  }
}
