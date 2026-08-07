# Architecture

## The big picture

The platform is **two independent NestJS services**, each with its **own
Postgres database**, sitting behind a single **nginx** gateway so clients see
one backend on one origin.

```
                              http://localhost:3008
                                      │
                          ┌───────────▼───────────┐
                          │          nginx          │  gateway (single origin)
                          │  /auth/*        ──────► auth-service:3009
                          │  /.well-known/* ──────► auth-service:3009
                          │  /api/*         ──────► ecom-api:3008
                          └───────────┬───────────┘
                       ┌──────────────┴───────────────┐
                       ▼                               ▼
             ┌───────────────────┐          ┌────────────────────┐
             │   auth-service    │          │      ecom-api      │
             │   (NestJS :3009)  │          │   (NestJS :3008)   │
             │                   │          │                    │
             │ • POST /auth/otp  │          │ • GET /api/products │
             │ • POST /auth/verify-otp      │   (public)          │
             │ • signs RS256 JWT │          │ • GET /api/profile  │
             │ • GET /.well-known/          │   (protected)       │
             │     jwks.json     │◄─────────│ • POST /api/products│
             │   (public keys)   │  fetch   │   (admin only)      │
             └─────────┬─────────┘  JWKS    └──────────┬──────────┘
                       ▼                                ▼
              ┌─────────────────┐            ┌───────────────────┐
              │     auth-db     │            │      ecom-db      │
              │  (Postgres)     │            │   (Postgres)      │
              │  users table    │            │  products table   │
              └─────────────────┘            └───────────────────┘
```

## The two token flows (the core idea)

**1. Getting a token (auth-service signs it):**

```
client ──POST /auth/verify-otp {email,otp}──► nginx ──► auth-service
                                                              │ verify OTP (hash/TTL) against auth-db; create account if new
                                                              │ sign JWT with PRIVATE key (RS256), kid in header
                                                              ▼
client ◄──────────── { accessToken, user } ─────────────────┘
```

**2. Using a token (ecom-api verifies it — WITHOUT any shared secret):**

```
client ──GET /api/profile  Authorization: Bearer <jwt>──► nginx ──► ecom-api
                                                                        │ read `kid` from JWT header
                                                                        │ fetch matching PUBLIC key from
                                                                        │   auth-service /.well-known/jwks.json  (cached)
                                                                        │ verify signature + iss/aud/exp
                                                                        ▼
client ◄──────────────── { user: {sub,email,roles} } ──────────────────┘
```

The auth-service is the **only** party with the private key. The ecom-api only
ever handles **public** keys, fetched from JWKS. See
[JWT_JWKS.md](./JWT_JWKS.md) for the full mechanism.

## Repository layout

```
ecom-backend/
├── services/
│   ├── auth-service/         # NestJS — issues tokens, publishes JWKS, owns auth-db
│   │   ├── src/…
│   │   ├── Dockerfile        # built with context = this folder
│   │   └── package.json
│   └── ecom-api/             # NestJS — verifies tokens via JWKS, owns ecom-db
│       ├── src/…
│       ├── Dockerfile
│       └── package.json
├── docker/
│   ├── docker-compose.yml    # nginx + 2 services + 2 postgres
│   └── nginx/nginx.conf      # gateway routing
├── postman/
│   └── ecom-platform.postman_collection.json
├── docs/                     # you are here
├── .env / .env.example       # platform config (compose reads this)
└── package.json              # root: docker orchestration scripts only
```

## Key design decisions

| Decision | Why |
|----------|-----|
| **Two services, not one** | Auth is a separate security concern with its own release cadence. Compromising the ecom-api never exposes signing keys. |
| **Database per service** | Services never share tables. Each owns its schema and can evolve/scale independently. The ecom-api physically *cannot* read the users table. |
| **Asymmetric RS256 + JWKS** | The verifier needs only the public key. No shared secret to distribute or leak. Keys can rotate without redeploying the ecom-api. |
| **nginx gateway** | One origin for clients; internal topology (ports, service names) stays hidden and swappable. |
| **Per-service Dockerfile** | Each service builds from its own context; either could move to its own repo unchanged. |
| **In-app config via `@nestjs/config`** | One typed source of truth per service; all env access centralized. |
| **TypeORM `synchronize` in dev** | Auto-creates tables from entities so there are no migrations to run yet. Turn off + use migrations for production. |

## Ports (recap)

| Thing | Container port | Host port | Notes |
|-------|----------------|-----------|-------|
| nginx gateway | 3008 | **3008** | the only public entry point |
| auth-service | 3009 | 3009 | published for direct debugging |
| ecom-api | 3008 | — | internal only; reached via nginx |
| auth-db / ecom-db | 5432 | — | internal only |
| mailpit (email UI) | 8025 | **8028** | dev mail catcher; SMTP on 1025 |

nginx (3008) and ecom-api (3008) share the *number* but live in different
containers, so they never collide — only host-published ports can conflict.

## Where to go next

- Auth internals → [AUTH_SERVICE.md](./AUTH_SERVICE.md)
- Token mechanics → [JWT_JWKS.md](./JWT_JWKS.md)
- Ecom internals → [ECOM_API.md](./ECOM_API.md)
- Gateway → [NGINX_GATEWAY.md](./NGINX_GATEWAY.md)
- Running it → [DOCKER_SETUP.md](./DOCKER_SETUP.md)
