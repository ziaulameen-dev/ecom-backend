/**
 * Central place to read environment variables and expose them as a typed
 * config object. `@nestjs/config` calls this factory once at startup and makes
 * the result injectable via `ConfigService`.
 */
export default () => ({
  port: parseInt(process.env.ECOM_PORT ?? '3008', 10),
  nodeEnv: process.env.NODE_ENV ?? 'development',

  // How this API VERIFIES tokens minted by the auth service.
  jwt: {
    // Where to fetch the auth service's PUBLIC keys (JWKS). Inside Docker this
    // is the internal service DNS name, e.g. http://auth-service:3009/...
    jwksUri:
      process.env.JWKS_URI ?? 'http://localhost:3009/.well-known/jwks.json',
    // Must match what the auth service stamps into tokens.
    issuer: process.env.JWT_ISSUER ?? 'ecom-auth',
    audience: process.env.JWT_AUDIENCE ?? 'ecom-api',
    // Name of the HttpOnly cookie the auth service sets the token in. The guard
    // reads the token from here (falling back to the Authorization header).
    cookieName: process.env.AUTH_COOKIE_NAME ?? 'access_token',
  },

  // Brand + SMTP for order emails (dev: Mailpit).
  appName: process.env.APP_NAME ?? 'Ecom',
  mail: {
    host: process.env.SMTP_HOST ?? 'localhost',
    port: parseInt(process.env.SMTP_PORT ?? '1025', 10),
    from: process.env.MAIL_FROM ?? 'no-reply@ecom.local',
    // Auth/TLS only in production; dev targets Mailpit.
    secure: (process.env.SMTP_SECURE ?? 'false').toLowerCase() === 'true',
    user: process.env.SMTP_USER ?? '',
    pass: process.env.SMTP_PASS ?? '',
  },

  // Cashfree (India, INR) payment gateway. Server-side only; the secret key
  // also verifies webhook signatures. The public base URL (ngrok in dev) is used
  // for Cashfree return/notify URLs.
  cashfree: {
    env: process.env.CASHFREE_ENV ?? 'sandbox',
    appId: process.env.CASHFREE_APP_ID ?? '',
    secretKey: process.env.CASHFREE_SECRET_KEY ?? '',
    apiVersion: '2023-08-01',
    baseUrl:
      (process.env.CASHFREE_ENV ?? 'sandbox') === 'production'
        ? 'https://api.cashfree.com/pg'
        : 'https://sandbox.cashfree.com/pg',
    publicBaseUrl: process.env.PUBLIC_BASE_URL ?? 'http://localhost:3008',
  },

  // Flat GST applied to the subtotal (percent). India-only for now.
  taxPercent: parseInt(process.env.TAX_PERCENT ?? '0', 10),

  // Guest cart cookie — identifies an anonymous cart until the user logs in.
  cart: {
    cookieName: process.env.CART_COOKIE_NAME ?? 'cart_id',
    sameSite: (process.env.AUTH_COOKIE_SAMESITE ?? 'lax') as
      | 'lax'
      | 'strict'
      | 'none',
    secure: (process.env.NODE_ENV ?? 'development') === 'production',
    // Guests keep a cart for a while (ms). 30 days.
    maxAgeMs: parseInt(process.env.CART_COOKIE_MAX_AGE_MS ?? '2592000000', 10),
  },

  // CSRF (double-submit cookie). The auth-service sets the csrf cookie on
  // login; this API just enforces it on state-changing cookie requests. Names
  // must match the auth-service.
  csrf: {
    cookieName: process.env.CSRF_COOKIE_NAME ?? 'csrf_token',
    headerName: (process.env.CSRF_HEADER_NAME ?? 'x-csrf-token').toLowerCase(),
  },

  // Redis — shared session denylist written by the auth-service. This API
  // checks it per request so revoked (logged-out) tokens are rejected at once.
  redis: {
    host: process.env.REDIS_HOST ?? 'localhost',
    port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
  },

  // CORS allowlist for browser frontends on other origins. Comma-separated;
  // empty -> reflect the request origin (dev). Shared with the auth-service via
  // the same CORS_ORIGINS env so both services agree.
  cors: {
    origins: (process.env.CORS_ORIGINS ?? '')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean),
  },

  // This service owns its OWN Postgres database (separate from auth's).
  db: {
    host: process.env.ECOM_DB_HOST ?? 'localhost',
    port: parseInt(process.env.ECOM_DB_PORT ?? '5432', 10),
    username: process.env.ECOM_DB_USER ?? 'ecom',
    password: process.env.ECOM_DB_PASSWORD ?? 'ecom',
    database: process.env.ECOM_DB_NAME ?? 'ecomdb',
  },
});
