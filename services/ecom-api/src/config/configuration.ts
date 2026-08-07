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
