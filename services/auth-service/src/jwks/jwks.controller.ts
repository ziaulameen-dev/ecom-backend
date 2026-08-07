import { Controller, Get, Header } from '@nestjs/common';
import { Raw } from '../common/decorators/raw-response.decorator';
import { KeysService } from '../keys/keys.service';

/**
 * Publishes this service's PUBLIC signing keys in JWKS (JSON Web Key Set)
 * format at the well-known path:
 *
 *   GET /.well-known/jwks.json
 *
 * The ecom-api fetches this to verify tokens. It contains only PUBLIC keys —
 * it is safe (and intended) to be reachable by verifiers. The `@Raw()`
 * decorator skips the global success-envelope so the body is the exact
 * standardized `{ keys: [...] }` shape that JWKS clients expect.
 */
@Controller('.well-known')
export class JwksController {
  constructor(private readonly keys: KeysService) {}

  @Get('jwks.json')
  @Raw()
  // Public keys rarely change; allow verifiers to cache for 5 minutes.
  @Header('Cache-Control', 'public, max-age=300')
  getJwks() {
    return this.keys.getJwks();
  }
}
