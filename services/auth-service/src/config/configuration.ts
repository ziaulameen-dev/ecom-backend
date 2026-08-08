/**
 * Typed configuration for the auth service, read once at startup.
 *
 * The issuer/audience values MUST match what the ecom-api expects when it
 * verifies tokens — they are part of the trust contract between the services.
 */
/** Parse a zeit/ms-style duration ("15m", "900s", "1h", "30") into seconds. */
function durationSeconds(v: string): number {
  const m = /^(\d+)\s*([smh])?$/.exec(v.trim());
  if (!m) return 900;
  const n = parseInt(m[1], 10);
  return n * { s: 1, m: 60, h: 3600 }[(m[2] as 's' | 'm' | 'h') ?? 's'];
}

export default () => ({
  port: parseInt(process.env.AUTH_PORT ?? '3009', 10),
  nodeEnv: process.env.NODE_ENV ?? 'development',

  // Brand name shown in transactional emails (subject + signature).
  appName: process.env.APP_NAME ?? 'Ecom',

  jwt: {
    // `iss` claim put into every token and checked by the ecom-api.
    issuer: process.env.JWT_ISSUER ?? 'ecom-auth',
    // `aud` claim — who the token is meant for (the ecom-api).
    audience: process.env.JWT_AUDIENCE ?? 'ecom-api',
    // How long an access token is valid (zeit/ms format, e.g. "15m", "900s").
    accessTokenTtl: process.env.ACCESS_TOKEN_TTL ?? '15m',
    // Same value in seconds — how long a denied session id must stay on the
    // denylist (i.e. until the access token would have expired anyway).
    accessTokenTtlSeconds: durationSeconds(process.env.ACCESS_TOKEN_TTL ?? '15m'),
    // Base64-encoded PKCS8 PEM of the RSA private key. When set, the signing
    // key SURVIVES restarts (tokens stay valid, `kid` is stable). When absent
    // an ephemeral key is generated on boot — fine for dev, but every restart
    // invalidates all tokens. Generate one with:
    //   openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 | base64
    privateKeyBase64: process.env.JWT_PRIVATE_KEY_BASE64 ?? '',
  },

  // Long-lived refresh tokens. The short access token is refreshed via
  // POST /auth/refresh without re-doing the OTP flow. Refresh tokens are
  // opaque, stored HASHED, single-use (rotated on every refresh), and
  // revocable (logout / logout-all).
  refresh: {
    ttlDays: parseInt(process.env.REFRESH_TOKEN_TTL_DAYS ?? '30', 10),
    cookieName: process.env.AUTH_REFRESH_COOKIE_NAME ?? 'refresh_token',
  },

  // The token is delivered to browsers as an HttpOnly cookie so frontend JS
  // can never read it. Because the whole platform is one origin (nginx), this
  // cookie is auto-sent to the ecom-api on /api/* too.
  cookie: {
    name: process.env.AUTH_COOKIE_NAME ?? 'access_token',
    // Lax: sent on same-site requests and top-level navigations, but not on
    // cross-site POSTs — a reasonable CSRF baseline. Use a CSRF token in prod.
    sameSite: (process.env.AUTH_COOKIE_SAMESITE ?? 'lax') as
      | 'lax'
      | 'strict'
      | 'none',
    // `Secure` cookies are only sent over HTTPS; browsers DROP them on http://,
    // so we only enable it in production (where you terminate TLS at nginx).
    secure: (process.env.NODE_ENV ?? 'development') === 'production',
    // Cookie lifetime in ms; keep aligned with the token TTL.
    maxAgeMs: parseInt(process.env.AUTH_COOKIE_MAX_AGE_MS ?? '900000', 10),
  },

  // This service owns its OWN Postgres database (database-per-service). The
  // ecom-api has a separate one and the two never share tables.
  db: {
    host: process.env.AUTH_DB_HOST ?? 'localhost',
    port: parseInt(process.env.AUTH_DB_PORT ?? '5432', 10),
    username: process.env.AUTH_DB_USER ?? 'auth',
    password: process.env.AUTH_DB_PASSWORD ?? 'auth',
    database: process.env.AUTH_DB_NAME ?? 'authdb',
  },

  // SMTP target for outgoing mail. In dev this is Mailpit, which captures
  // every message and shows it in its web UI (no real email is sent).
  mail: {
    host: process.env.SMTP_HOST ?? 'localhost',
    port: parseInt(process.env.SMTP_PORT ?? '1025', 10),
    from: process.env.MAIL_FROM ?? 'no-reply@ecom.local',
    // Auth/TLS are used ONLY in production (real SMTP). In dev the transport
    // targets Mailpit (no auth, no TLS) so nothing leaves the machine.
    secure: (process.env.SMTP_SECURE ?? 'false').toLowerCase() === 'true',
    user: process.env.SMTP_USER ?? '',
    pass: process.env.SMTP_PASS ?? '',
  },

  // One-time login codes (2-step login).
  otp: {
    length: parseInt(process.env.OTP_LENGTH ?? '6', 10),
    ttlSeconds: parseInt(process.env.OTP_TTL_SECONDS ?? '300', 10), // 5 min
    maxAttempts: parseInt(process.env.OTP_MAX_ATTEMPTS ?? '5', 10),
    // Minimum gap between OTP emails to the SAME address — stops resend spam
    // (per-email, complements the per-IP rate limit).
    resendCooldownSeconds: parseInt(
      process.env.OTP_RESEND_COOLDOWN_SECONDS ?? '60',
      10,
    ),
  },

  // CORS allowlist for browser frontends on other origins. Comma-separated,
  // e.g. "https://shop.example.com,https://admin.example.com". Empty -> reflect
  // the request origin (dev-friendly). Credentials are always allowed so the
  // HttpOnly auth cookie can be sent cross-origin.
  cors: {
    origins: (process.env.CORS_ORIGINS ?? '')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean),
  },

  // CSRF (double-submit cookie) for COOKIE-mode clients. On login we set a
  // readable csrf cookie; state-changing requests must echo it in a header.
  // Bearer clients have no ambient cookie, so they're exempt.
  csrf: {
    cookieName: process.env.CSRF_COOKIE_NAME ?? 'csrf_token',
    headerName: (process.env.CSRF_HEADER_NAME ?? 'x-csrf-token').toLowerCase(),
  },

  // Redis — shared session denylist so logout/-all/delete instantly invalidate
  // access tokens across BOTH services (they check it per request).
  redis: {
    host: process.env.REDIS_HOST ?? 'localhost',
    port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
  },

  // Per-IP rate limiting (nestjs/throttler). A single switch turns it on/off;
  // when off there is zero overhead (the guard isn't even registered). Enable
  // it in production — leave it off in dev so repeated Postman/curl runs don't
  // get 429'd. Limits are per client IP (see `trust proxy` in main.ts so the
  // real IP is read from X-Forwarded-For behind nginx).
  rateLimit: {
    enabled: (process.env.RATE_LIMIT_ENABLED ?? 'false').toLowerCase() === 'true',
  },
});
