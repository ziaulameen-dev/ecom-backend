# Auth Service — what was built

The auth-service is the platform's identity provider. It **owns users**,
**verifies emailed one-time codes (OTP)**, **mints signed JWTs**, and
**publishes the public keys** other services use to verify those JWTs. Auth is
**passwordless** — there are no passwords. It has its own Postgres (`auth-db`)
and shares nothing with the ecom-api except the public JWKS.

- Base (direct): `http://localhost:3009`
- Via gateway: `http://localhost:3008/auth/...` and `/.well-known/...`
- Tech: NestJS + TypeORM + Postgres, `jsonwebtoken` for signing, Node `crypto`
  for the keypair and OTP hashing, `nodemailer` for delivering the OTP.

---

## Endpoints

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/auth/otp` | public | **Step 1**: email a one-time code (signup or login) |
| POST | `/auth/verify-otp` | public | **Step 2**: validate the OTP, create the account if new, deliver a token |
| POST | `/auth/logout` | public | Clear the auth cookie (cookie mode) |
| GET | `/auth/me` | logged-in | Current user (id, email, name, mobile, roles) |
| PATCH | `/auth/profile` | logged-in | Update optional profile (`name` / `mobile`) |
| POST | `/auth/email/change` | logged-in | **Step 1**: save the target as `pending_email` + email an OTP to the CURRENT address |
| POST | `/auth/email/verify-old` | logged-in | **Step 2**: confirm the old-email OTP `{ otp }`, then email an OTP to the pending address |
| POST | `/auth/email/verify-new` | logged-in | **Step 3**: confirm the new-email OTP `{ otp }`, switch the email; re-issues the token |
| POST | `/auth/account/delete` | logged-in | **Step 1**: email an OTP to the current address to confirm deletion |
| POST | `/auth/account/delete/verify` | logged-in | **Step 2**: confirm the OTP `{ otp }`, soft-delete (deactivate) the account, clear the cookie |
| GET | `/.well-known/jwks.json` | public | Publish the PUBLIC signing key(s) as a JWKS |
| GET | `/health` | public | Liveness probe |

The `logged-in` routes are protected by a local `JwtAuthGuard` that verifies the
token with this service's own key (no JWKS needed) — Bearer or cookie, same as
the ecom-api. **Email change verifies _both_ inboxes**: an OTP to the old email
(step-up re-auth, so a stolen token alone can't take over the account) *and* an
OTP to the new email (so you never set an address the user can't receive at).
The new-email OTP is only sent after the old one is verified, so the steps can't
be skipped. `newEmail` is supplied once (step 1) and held server-side as
`pending_email`; the verify steps take only `{ otp }`.

**Account deletion is a soft-delete (deactivation)**, also OTP-confirmed. The
row is retained (so future order history survives), live PII is cleared, and the
real email is *freed* — moved to `deleted_email` while `email` becomes a unique
tombstone — so the same address can sign up again as a fresh, separate account.
It intentionally **retains PII** (`deleted_email`), so it is deactivation, not
GDPR erasure; add a scrub step after your retention window if you need true
erasure. The guard rejects tokens whose account is deleted, so a still-valid
token can't act on a deactivated account (bearer tokens on the ecom-api still
work until they expire — the usual stateless-JWT trade-off).

**Auth is passwordless and signup == login:** email → emailed code → token; a
brand-new email becomes an account when it verifies. See
[OTP_LOGIN.md](./OTP_LOGIN.md).

**Token delivery is selectable** (on verify-otp) via the `X-Auth-Source` header:
`bearer` (default — token in the JSON body, for mobile/services) or `cookie`
(HttpOnly cookie, token NOT in the body, for browsers). See
[AUTH_MODES.md](./AUTH_MODES.md).

### Example: request a code (step 1)

```bash
curl -X POST http://localhost:3008/auth/otp \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@example.com"}'
```

```json
{
  "success": true,
  "data": {
    "otpRequired": true,
    "email": "admin@example.com",
    "expiresInSeconds": 300,
    "isNewUser": false
  },
  "timestamp": "…"
}
```

Then read the code (dev: Mailpit at <http://localhost:8028>) and exchange it.
For a new email you may also send optional `name` / `mobile`:

```bash
curl -X POST http://localhost:3008/auth/verify-otp \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@example.com","otp":"123456"}'
# -> { "data": { "accessToken": "eyJ…", "tokenType": "Bearer", "user": {…} } }
```

A demo admin is **seeded on first boot**: `admin@example.com` (sign in with an
OTP — no password). Full OTP details: [OTP_LOGIN.md](./OTP_LOGIN.md).

---

## Internal structure

```
services/auth-service/src/
├── main.ts                       # bootstrap: ValidationPipe, envelope, error filter
├── app.module.ts                 # wires ConfigModule + TypeORM(auth-db) + feature modules
├── config/configuration.ts       # typed env (port, jwt issuer/aud/ttl, db)
│
├── keys/                         # ★ signing key material
│   ├── keys.service.ts           #   generates RSA keypair, signs tokens, builds JWKS
│   └── keys.module.ts
├── jwks/                         # ★ public key publication
│   ├── jwks.controller.ts        #   GET /.well-known/jwks.json  (@Raw output)
│   └── jwks.module.ts
├── auth/                         # ★ passwordless OTP + account management
│   ├── auth.controller.ts        #   /auth/otp, /verify-otp, /me, /profile, /email/*, /logout
│   ├── auth.service.ts           #   OTP issue/verify, lazy account create, profile/email updates
│   ├── jwt-auth.guard.ts         #   verifies our own tokens (Bearer/cookie) for protected routes
│   ├── current-user.decorator.ts #   @CurrentUser() -> req.user
│   └── dto/                      #   request bodies (request-otp, verify-otp, update-profile, email change)
├── otp/                          # ★ one-time codes (auth-db)
│   ├── login-otp.entity.ts       #   TypeORM entity: login_otps (hashed code + expiry)
│   ├── otp.service.ts            #   issue / verify (hash, TTL, attempt limit)
│   └── otp.module.ts
├── mail/                         # ★ email sending (SMTP -> Mailpit)
│   ├── mail.service.ts           #   nodemailer transport; sendOtp()
│   └── mail.module.ts
├── users/                        # user store (auth-db)
│   ├── user.entity.ts            #   TypeORM entity: users table (email + optional profile)
│   ├── users.service.ts          #   findByEmail / create (no passwords)
│   └── users.module.ts
├── health/                       # GET /health
└── common/                       # response envelope, error filter, @Raw() decorator
```

---

## How each piece works

### 1. Keys (`keys/keys.service.ts`) — the security core

On startup (`onModuleInit`) it generates a **2048-bit RSA keypair** with Node's
`crypto.generateKeyPairSync('rsa', …)`:

- The **private key** (kept in memory, PEM form) is used to **sign** tokens.
- The **public key** is exported as a **JWK** (`publicKey.export({format:'jwk'})`)
  and given a **`kid`** — a stable RFC 7638 thumbprint (SHA-256 of the canonical
  JWK). Same key → same `kid`, always.

It exposes two operations:

- `signAccessToken({sub,email,roles})` → an RS256 JWT with header
  `{alg:'RS256', kid, typ:'JWT'}` and claims `sub`, `email`, `roles`, plus
  `iss`, `aud`, `iat`, `exp` (TTL from config, default 15m).
- `getJwks()` → `{ keys: [ publicJwk ] }` for the JWKS endpoint.

> **Why generate at startup?** It keeps the demo self-contained (no key files to
> manage). The trade-off: **restarting auth-service rotates the key**, so tokens
> issued before the restart stop verifying. For production you would load a
> **persisted/managed** key (mounted secret, KMS, Vault) so tokens survive
> restarts and rotation is deliberate. See [JWT_JWKS.md](./JWT_JWKS.md).

### 2. JWKS endpoint (`jwks/jwks.controller.ts`)

`GET /.well-known/jwks.json` returns `keys.getJwks()`. It is annotated with a
custom **`@Raw()`** decorator so the global success-envelope interceptor is
skipped — JWKS clients expect the exact standardized `{ "keys": [...] }` body.
It sets `Cache-Control: public, max-age=300` so verifiers can cache the keys.

This endpoint contains **only public keys** — it is meant to be reachable by
verifiers (the ecom-api fetches it over the internal Docker network).

### 3. Users (`users/…`) — backed by `auth-db`

`User` is a TypeORM entity (`users` table) with `id`, `email` (unique), optional
`name` / `mobile`, `roles` (Postgres `text[]`), `created_at` — **no password
column**. `UsersService`:

- `findByEmail` — lookup during OTP verify.
- `create` — inserts a new account (email + optional profile); identity is
  proven by the OTP, so nothing to hash.
- Seeds the demo admin on first boot.

Because this table lives in the auth-service's **own** database, no other
service can read it.

### 4. Auth logic (`auth/auth.service.ts`)

- `requestOtp(email)` → issue + email a code; returns a challenge with
  `isNewUser` (so the UI can show the optional signup fields). Works for new and
  returning emails alike.
- `verifyOtp(email, code, profile?)` → validate the OTP (hash/TTL/attempt
  limit); if the email has no account yet, create one from the optional profile;
  then `KeysService.signAccessToken(...)` and return
  `{ accessToken, tokenType:'Bearer', user }`. Bad/expired codes throw a
  **generic 401**.

### 5. Request validation (`main.ts` + DTOs)

A global `ValidationPipe` (`whitelist`, `forbidNonWhitelisted`, `transform`)
enforces the DTO rules (`@IsEmail`, `@Length` on the OTP, optional profile
fields) before the controller runs, and strips/blocks unknown fields.

---

## What the token looks like

Header:
```json
{ "alg": "RS256", "typ": "JWT", "kid": "DnEb9VaZ6j4tj6U7597sLPRDdijwuZPQmOZq3e23K54" }
```
Payload:
```json
{
  "email": "admin@example.com",
  "roles": ["admin"],
  "sub": "f571632a-…",
  "iss": "ecom-auth",
  "aud": "ecom-api",
  "iat": 1786088816,
  "exp": 1786089716
}
```
`iss`/`aud` are the **trust contract** the ecom-api checks. `kid` tells the
verifier which public key from the JWKS to use.

---

## Configuration (env)

| Var | Default | Meaning |
|-----|---------|---------|
| `AUTH_PORT` | 3009 | HTTP port |
| `JWT_ISSUER` | `ecom-auth` | `iss` claim (must match ecom-api) |
| `JWT_AUDIENCE` | `ecom-api` | `aud` claim (must match ecom-api) |
| `ACCESS_TOKEN_TTL` | `15m` | token lifetime |
| `CORS_ORIGINS` | (empty) | comma-separated browser origin allowlist; empty reflects the request origin (dev) |
| `RATE_LIMIT_ENABLED` | `false` | per-IP rate limiting on the auth endpoints (see [OTP_LOGIN.md](./OTP_LOGIN.md)) |
| `AUTH_DB_HOST/PORT/USER/PASSWORD/NAME` | see `.env.example` | its Postgres |

---

## Things intentionally left for later

- **Refresh tokens / logout** — only short-lived access tokens for now.
- **Persisted/rotating keys** — currently in-memory (see caveat above).
- **Migrations** — dev uses TypeORM `synchronize`; production needs migrations.
- **Per-email rate limiting** — per-IP limits are in place (`RATE_LIMIT_ENABLED`,
  see [OTP_LOGIN.md](./OTP_LOGIN.md)); per-email is a further step.
- **Editable profile** — an endpoint to update `name` / `mobile` after signup.

See [JWT_JWKS.md](./JWT_JWKS.md) for how the ecom-api consumes what this service
produces.
