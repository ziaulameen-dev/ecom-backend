import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createHash,
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  KeyObject,
} from 'crypto';
import * as jwt from 'jsonwebtoken';

/** A public key in JWK form plus the metadata a JWKS entry needs. */
export interface JwkWithMeta {
  kty: string;
  n: string;
  e: string;
  kid: string;
  alg: 'RS256';
  use: 'sig';
}

/** Claims we put into an access token. */
export interface AccessTokenClaims {
  sub: string; // user id
  email: string;
  roles: string[];
  sid: string; // session id (the refresh-token row id) — used for revocation
}

/**
 * Owns the service's signing key material.
 *
 * WHY asymmetric (RS256)? The auth service holds the PRIVATE key and is the
 * only party that can SIGN tokens. Any other service (the ecom-api) only needs
 * the PUBLIC key to VERIFY them — and it fetches that public key from our JWKS
 * endpoint. No shared secret ever leaves this service.
 *
 * The keypair is generated in-memory at startup. That means restarting this
 * service rotates the key (old tokens stop verifying). For production you would
 * instead load a persisted/managed key (mounted secret, KMS, Vault) so tokens
 * survive restarts and you can roll keys deliberately — see docs/JWT_JWKS.md.
 */
@Injectable()
export class KeysService implements OnModuleInit {
  private readonly logger = new Logger(KeysService.name);

  private privateKeyPem!: string;
  private publicKeyPem!: string;
  private jwk!: JwkWithMeta;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const { privateKey, publicKey } = this.loadOrGenerateKeypair();

    this.privateKeyPem = privateKey.export({
      type: 'pkcs8',
      format: 'pem',
    }) as string;

    this.publicKeyPem = publicKey.export({
      type: 'spki',
      format: 'pem',
    }) as string;

    this.jwk = this.buildJwk(publicKey);
    this.logger.log(`Signing key ready (kid=${this.jwk.kid})`);
  }

  /**
   * Use the persistent key from config when provided (so tokens survive
   * restarts), otherwise generate an ephemeral one and warn loudly.
   */
  private loadOrGenerateKeypair(): {
    privateKey: KeyObject;
    publicKey: KeyObject;
  } {
    const b64 = this.config.get<string>('jwt.privateKeyBase64');
    if (b64) {
      const pem = Buffer.from(b64, 'base64').toString('utf8');
      const privateKey = createPrivateKey(pem);
      const publicKey = createPublicKey(privateKey);
      this.logger.log('Loaded persistent RSA signing key from config');
      return { privateKey, publicKey };
    }

    this.logger.warn(
      'No JWT_PRIVATE_KEY_BASE64 set — generating an EPHEMERAL key; ' +
        'all tokens will be invalidated on restart. Set one for production.',
    );
    return generateKeyPairSync('rsa', { modulusLength: 2048 });
  }

  /**
   * Verify a token this service signed and return its claims. The auth-service
   * uses this to protect its own routes — unlike the ecom-api it doesn't need
   * JWKS, it already holds the key. Throws if signature / iss / aud / exp fail.
   */
  verifyAccessToken(token: string): AccessTokenClaims {
    const payload = jwt.verify(token, this.publicKeyPem, {
      algorithms: ['RS256'],
      issuer: this.config.get<string>('jwt.issuer'),
      audience: this.config.get<string>('jwt.audience'),
    }) as jwt.JwtPayload;

    return {
      sub: payload.sub as string,
      email: (payload.email as string) ?? '',
      roles: (payload.roles as string[]) ?? [],
      sid: (payload.sid as string) ?? '',
    };
  }

  /**
   * The JWKS document served at /.well-known/jwks.json. It is an array so we
   * can publish multiple keys during a rotation (old + new) at once.
   */
  getJwks(): { keys: JwkWithMeta[] } {
    return { keys: [this.jwk] };
  }

  /**
   * Sign an access token with RS256. The `kid` header tells verifiers which
   * key in the JWKS to use. `iss`/`aud`/`exp` are the trust contract checked
   * by the ecom-api.
   */
  signAccessToken(claims: AccessTokenClaims): string {
    const options: jwt.SignOptions = {
      algorithm: 'RS256',
      keyid: this.jwk.kid, // -> sets the JWT header `kid`
      subject: claims.sub, // -> `sub`
      issuer: this.config.get<string>('jwt.issuer'),
      audience: this.config.get<string>('jwt.audience'),
      // ttl is a string like "15m"; the @types expect number | ms-StringValue,
      // so cast to the option's own type.
      expiresIn: this.config.get<string>(
        'jwt.accessTokenTtl',
      ) as jwt.SignOptions['expiresIn'],
    };
    return jwt.sign(
      { email: claims.email, roles: claims.roles, sid: claims.sid },
      this.privateKeyPem,
      options,
    );
  }

  /** Convert a public KeyObject to a JWK and attach kid/alg/use metadata. */
  private buildJwk(publicKey: KeyObject): JwkWithMeta {
    const base = publicKey.export({ format: 'jwk' }) as {
      kty: string;
      n: string;
      e: string;
    };

    return {
      kty: base.kty,
      n: base.n,
      e: base.e,
      kid: this.computeKid(base),
      alg: 'RS256',
      use: 'sig',
    };
  }

  /**
   * Deterministic key id = RFC 7638 JWK thumbprint. Because it is derived from
   * the key itself, the same key always yields the same `kid`.
   */
  private computeKid(jwk: { kty: string; n: string; e: string }): string {
    // RFC 7638 requires the members in lexicographic order with no whitespace.
    const canonical = JSON.stringify({ e: jwk.e, kty: jwk.kty, n: jwk.n });
    return createHash('sha256').update(canonical).digest('base64url');
  }
}
