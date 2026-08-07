# Passwordless OTP auth (signup + login) + Mailpit

Auth is **passwordless** and there is **no separate register vs login** — one
flow does both. The user enters an email, we email a one-time code (OTP), they
verify it, and they're in. If the email has no account yet, it's created on the
spot. In development the email is captured by **Mailpit** (no real mail is sent).

## The flow

```
1. POST /auth/otp {email}
        │  auth-service: is this email new? (for the frontend's benefit)
        │               generate 6-digit OTP, store its HASH (+ expiry) in auth-db
        │               email the plain code via SMTP -> Mailpit
        ▼
   { otpRequired: true, email, expiresInSeconds, isNewUser }   (NO token yet)

2. user reads the code from their email  (dev: Mailpit UI http://localhost:8028)

3. POST /auth/verify-otp {email, otp, name?, mobile?}  [+ optional X-Auth-Source]
        │  auth-service: check hash, expiry, attempt-limit; consume the OTP
        │               if the email is new -> create the account (name/mobile
        │                 are optional; ignored for an existing user)
        │               mint the RS256 JWT
        ▼
   bearer:  { accessToken, tokenType, user }
   cookie:  Set-Cookie: access_token=…; HttpOnly    (token not in body)
```

`isNewUser` lets the frontend show an optional "your name / mobile" form on the
OTP screen for first-time signups. Both fields are optional — an account can be
created with just an email. **Country is not collected here** — it belongs to
the shipping address captured later at checkout.

## Why hash the OTP + limits

- **Hashed at rest** (SHA-256): a leak of `auth-db` doesn't expose live codes.
- **Expiry** (`OTP_TTL_SECONDS`, default 300s): codes are short-lived.
- **Attempt limit** (`OTP_MAX_ATTEMPTS`, default 5): blocks brute force; the
  challenge is deleted after too many wrong tries.
- **Single active code per email**: requesting a new one replaces the old.
- **Single use**: the row is deleted on success.

> **Note on enumeration:** `/auth/otp` returns `isNewUser`, which reveals
> whether an email already has an account. This is an intentional UX trade-off
> (so the frontend can pre-show the signup fields). If you'd rather not leak
> account existence, stop returning `isNewUser` and branch new-vs-existing only
> in the `/auth/verify-otp` response.

## Mailpit

Mailpit is a local SMTP server + web UI that captures all outgoing mail.

- Web UI: <http://localhost:8028>  (host 8028 → container 8025; 8025 was taken)
- SMTP: `mailpit:1025` on the Docker network (services send here)
- It's a container in `docker-compose.yml`; `npm run up` starts it.

The auth-service sends via nodemailer using `SMTP_HOST` / `SMTP_PORT`
(`mailpit` / `1025`). No auth/TLS — Mailpit accepts plain SMTP in dev.

### Reading the OTP programmatically (used by Postman)

Mailpit has an HTTP API:

```bash
# latest message summary (includes Subject "Your verification code: 123456")
curl -s 'http://localhost:8028/api/v1/messages?limit=1'
```

The Postman collection's **"Read OTP from Mailpit"** request regexes the
6-digit code out of this and stores it in `{{otp}}` for the verify step.

## Try it with curl

```bash
G=http://localhost:3008
# 1. request an OTP (works for a brand-new email too)
curl -s -X POST $G/auth/otp -H 'Content-Type: application/json' \
  -d '{"email":"newuser@example.com"}'
# => { "data": { "otpRequired": true, "email": "...", "expiresInSeconds": 300, "isNewUser": true } }

# 2. grab the code from Mailpit
OTP=$(curl -s 'http://localhost:8028/api/v1/messages?limit=1' \
  | python3 -c "import sys,json,re;m=json.load(sys.stdin)['messages'][0];print(re.search(r'(\d{6})', m['Subject']+' '+m.get('Snippet','')).group(1))")

# 3. verify -> creates the account (optional name) and returns a token
curl -s -X POST $G/auth/verify-otp -H 'Content-Type: application/json' \
  -d "{\"email\":\"newuser@example.com\",\"otp\":\"$OTP\",\"name\":\"New User\"}"
```

## Configuration

| Var | Default | Meaning |
|-----|---------|---------|
| `SMTP_HOST` | `mailpit` | SMTP server host |
| `SMTP_PORT` | `1025` | SMTP server port |
| `MAIL_FROM` | `no-reply@ecom.local` | From address |
| `OTP_LENGTH` | `6` | number of digits |
| `OTP_TTL_SECONDS` | `300` | code lifetime |
| `OTP_MAX_ATTEMPTS` | `5` | wrong tries before the code is invalidated |
| `MAILPIT_UI_PORT` | `8028` | Mailpit web UI host port |
| `MAILPIT_SMTP_PORT` | `1025` | Mailpit SMTP host port |
| `RATE_LIMIT_ENABLED` | `false` | master switch for per-IP rate limiting (see below) |

## Rate limiting

Per-IP rate limiting (via `@nestjs/throttler`) guards the auth endpoints. It's
behind a **single switch**, `RATE_LIMIT_ENABLED` — off in dev (so repeated
Postman/curl runs don't get `429`d), flip to `true` in production. When off, the
guard isn't enforced at all (zero overhead).

| Endpoint | Limit (per client IP) | Why |
|----------|-----------------------|-----|
| `POST /auth/otp` | 5 / 15 min | each call sends a real email — the abuse-sensitive one |
| `POST /auth/verify-otp` | 10 / 15 min | limits code-guessing across emails (the per-code `OTP_MAX_ATTEMPTS` cap is the other half) |
| everything else | 100 / 60s | generous default |

Limits key on the **real client IP**: the service sets Express `trust proxy` so
`req.ip` comes from `X-Forwarded-For` behind nginx, not nginx's own IP.

> Per-**email** limits (independent of IP) are a further hardening step — they
> need a custom throttler tracker and aren't wired up yet.

## Not included (future)

- Resend endpoint + resend cooldown.
- Per-email rate limiting (in addition to the per-IP limits above).
- Editable profile endpoint (update name/mobile after signup).
- Real email provider in production (swap the SMTP host).
