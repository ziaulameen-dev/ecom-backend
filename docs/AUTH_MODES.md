# Auth delivery modes — Bearer vs Cookie

The same RS256 JWT (signed by auth, verified by ecom via JWKS — see
[JWT_JWKS.md](./JWT_JWKS.md)) can be delivered in **two ways**. Clients choose
with the **`X-Auth-Source`** header.

| Mode | How the token travels | Best for | `X-Auth-Source` |
|------|-----------------------|----------|-----------------|
| **Bearer** (default) | In the login response body; client sends `Authorization: Bearer <token>` | Mobile apps, other backend services, curl/Postman | absent (auto) or `bearer` |
| **Cookie** | `Set-Cookie: access_token=…; HttpOnly` — browser stores & auto-sends it | Browser frontends (JS never sees the token → XSS-safe) | `cookie` |

**Default is Bearer** ("auto = bearer"). Cookie mode is opt-in per request.

## Issuing a token (auth-service)

Auth is passwordless: `POST /auth/otp` emails a code, then `POST /auth/verify-otp`
issues the token (see [OTP_LOGIN.md](./OTP_LOGIN.md) for the full flow). Only the
**verify-otp** step issues a token, so that's where `X-Auth-Source` matters:

```bash
# Step 1 — request the code (no token, no X-Auth-Source needed here)
curl -X POST http://localhost:3008/auth/otp \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@example.com"}'

# Step 2a — Bearer (default): token in the body
curl -X POST http://localhost:3008/auth/verify-otp \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@example.com","otp":"123456"}'
# => { "data": { "accessToken": "eyJ…", "tokenType": "Bearer", "user": {…} } }

# Step 2b — Cookie mode: HttpOnly cookie, NO token in the body
curl -i -X POST http://localhost:3008/auth/verify-otp \
  -H 'Content-Type: application/json' \
  -H 'X-Auth-Source: cookie' \
  -d '{"email":"admin@example.com","otp":"123456"}'
# => Set-Cookie: access_token=eyJ…; HttpOnly; SameSite=Lax; Path=/
#    { "data": { "user": {…} } }        # token NOT in body
```

`POST /auth/logout` clears the cookie (a no-op for bearer clients).

## Verifying a token (ecom-api guard)

`JwtAuthGuard` resolves the token from **either** source, and `X-Auth-Source`
can force one:

```
X-Auth-Source: bearer  -> only the Authorization header
X-Auth-Source: cookie  -> only the access_token cookie
(absent, "auto")       -> prefer Authorization header, else the cookie
```

```bash
# Bearer
curl http://localhost:3008/api/profile -H "Authorization: Bearer $TOKEN"

# Cookie (browser / Postman send it automatically; here with a curl jar)
curl -b cookies.txt http://localhost:3008/api/profile
```

Whichever source is used, verification is identical: signature (RS256 via
JWKS) + `iss` + `aud` + `exp`.

## Security trade-offs

| | Bearer (localStorage/mobile) | Cookie (HttpOnly) |
|---|---|---|
| **XSS** (malicious JS reads token) | ⚠️ exposed if stored in JS-reachable storage | ✅ JS cannot read an HttpOnly cookie |
| **CSRF** (auto-sent on requests) | ✅ not auto-sent; nothing to forge | ⚠️ auto-sent → needs `SameSite` and/or CSRF tokens |
| **Cross-origin / mobile** | ✅ trivial (just a header) | ⚠️ needs `credentials`, `SameSite=None; Secure` cross-site |

Rules of thumb:
- **Browser SPA on the same origin** → cookie mode (this platform is one origin
  via nginx, and uses `SameSite=Lax` as a CSRF baseline; add CSRF tokens for
  state-changing routes in production).
- **Mobile app / service-to-service** → bearer mode.

## Configuration

Cookie attributes come from env (see `.env.example`):

| Var | Default | Meaning |
|-----|---------|---------|
| `AUTH_COOKIE_NAME` | `access_token` | cookie name (must match on both services) |
| `AUTH_COOKIE_SAMESITE` | `lax` | `lax` \| `strict` \| `none` |
| `AUTH_COOKIE_MAX_AGE_MS` | `900000` | cookie lifetime (keep ≈ `ACCESS_TOKEN_TTL`) |

`Secure` is enabled automatically when `NODE_ENV=production` (HTTPS). On local
`http://` it stays off, because browsers drop `Secure` cookies over http.

## Why this design

One token, one verification path — only the **transport** differs. That means:

- Add a mobile client tomorrow: it uses bearer, no server change.
- Keep the web frontend XSS-safe: it uses cookie mode, token never touches JS.
- The ecom-api doesn't care which the client used; it verifies the same JWT.
