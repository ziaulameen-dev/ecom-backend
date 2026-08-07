# JWT + JWKS — how tokens are signed and verified

This is the trust mechanism between the two services. The auth-service **signs**
tokens; the ecom-api **verifies** them — without ever sharing a secret.

## Why asymmetric (RS256), not a shared secret (HS256)?

| | HS256 (shared secret) | **RS256 (this project)** |
|---|---|---|
| Key to verify | the SAME secret used to sign | only the PUBLIC key |
| If the verifier leaks its key | attacker can **forge** tokens | attacker can only **verify** (public anyway) |
| Distributing keys | secret must be copied to every verifier | verifiers fetch public keys from JWKS |
| Rotating keys | redeploy everyone with the new secret | publish new public key in JWKS; verifiers pick it up |

With RS256 the **private key never leaves the auth-service**. That is the whole
reason to split auth into its own service.

## The keypair

On boot, `KeysService` (auth-service) generates a 2048-bit RSA keypair:

- **Private key** → signs tokens. Stays in memory in the auth-service only.
- **Public key** → exported as a **JWK** and published at
  `/.well-known/jwks.json`.

Each key has a **`kid`** (key id) = its RFC 7638 **JWK thumbprint**
(SHA-256 over the canonical `{e,kty,n}`). Deterministic: the same key always
yields the same `kid`.

## Signing (auth-service)

```
jwt.sign({ email, roles }, privateKeyPem, {
  algorithm: 'RS256',
  keyid:     kid,             // -> JWT header `kid`
  subject:   userId,          // -> `sub`
  issuer:    'ecom-auth',     // -> `iss`
  audience:  'ecom-api',      // -> `aud`
  expiresIn: '15m',           // -> `exp`
})
```

The resulting JWT header carries `kid`, so any verifier knows *which* public key
to use.

## JWKS document

`GET /.well-known/jwks.json`:

```json
{
  "keys": [
    {
      "kty": "RSA",
      "n": "va0cO2A0brLXv…",   // public modulus (base64url)
      "e": "AQAB",              // public exponent
      "kid": "DnEb9VaZ6j4…",    // matches the JWT header `kid`
      "alg": "RS256",
      "use": "sig"
    }
  ]
}
```

It is an **array** so during a rotation you can publish the old and new keys at
once (verifiers select by `kid`).

## Verifying (ecom-api)

`JwtAuthGuard` runs on protected routes:

```
1. Read the token from the `Authorization: Bearer` header OR the HttpOnly
   `access_token` cookie (selectable via X-Auth-Source; see AUTH_MODES.md).
2. jwt.decode(token) -> read header.kid   (no verification yet)
3. JwksService.getPublicKey(kid):
      - jwks-rsa client fetches /.well-known/jwks.json  (CACHED by kid)
      - returns the PEM public key for that kid
4. jwt.verify(token, publicKey, {
        algorithms: ['RS256'],
        issuer:   'ecom-auth',
        audience: 'ecom-api',
   })  -> checks signature + iss + aud + exp
5. Attach { sub, email, roles } to req.user
```

If the signature is wrong, the token is expired, or `iss`/`aud` don't match →
**401**. `RolesGuard` then optionally checks the `roles` claim for
`@Roles('admin')` routes → **403** if insufficient.

### Caching & performance

The `jwks-rsa` client caches keys **by `kid`** (10 min here) and rate-limits
requests, so verifying a token normally does **no** network call. The JWKS
endpoint is only hit the first time a new `kid` appears (e.g. after a rotation).

### Where the ecom-api finds the JWKS

Over the internal Docker network, not through nginx:

```
JWKS_URI = http://auth-service:3009/.well-known/jwks.json
```

(`auth-service` is the compose service name; Docker DNS resolves it.)

## Key rotation (how it would work)

1. auth-service starts using a **new** keypair (new `kid`), and publishes
   **both** old + new public keys in the JWKS for an overlap window.
2. New tokens are signed with the new key. Old tokens still verify against the
   old key (still in the JWKS).
3. ecom-api sees an unknown `kid`, refetches the JWKS, caches the new key.
4. After all old tokens expire, drop the old key from the JWKS.

> In THIS project keys are generated in memory at startup, so a restart is an
> (abrupt) rotation with no overlap — old tokens simply stop verifying. Fine for
> local dev; production should persist keys and rotate deliberately as above.

## The trust contract (must match on both sides)

| Claim | auth sets | ecom checks | Env var |
|-------|-----------|-------------|---------|
| `iss` | `ecom-auth` | `ecom-auth` | `JWT_ISSUER` |
| `aud` | `ecom-api` | `ecom-api` | `JWT_AUDIENCE` |
| `alg` | RS256 | RS256 only | — |
| `exp` | now + TTL | must be future | `ACCESS_TOKEN_TTL` |

If these drift between services, verification fails — by design.
