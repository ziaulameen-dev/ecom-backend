# Ecom API — what was built

The ecom-api serves the store's business endpoints. It **trusts, but does not
issue** tokens: it verifies incoming JWTs against the auth-service's JWKS. It
has its own Postgres (`ecom-db`) with the `products` table.

- Base (internal): `http://ecom-api:3008` (not host-published)
- Via gateway: `http://localhost:3008/api/...`
- Tech: NestJS + TypeORM + Postgres, `jsonwebtoken` + `jwks-rsa` for verification.

---

## Endpoints

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/health` | public | Liveness + runtime info |
| GET | `/api/products` | public | List catalog |
| POST | `/api/products` | **admin** | Create a product |
| GET | `/api/profile` | **any logged-in** | Echo verified token claims |

All routes are under the global `/api` prefix (set in `main.ts`).

---

## Internal structure

```
services/ecom-api/src/
├── main.ts                    # bootstrap: /api prefix, ValidationPipe, envelope, filter
├── app.module.ts              # ConfigModule + TypeORM(ecom-db) + feature modules
├── config/configuration.ts    # typed env (port, jwt jwksUri/issuer/audience, db)
│
├── auth/                      # ★ token verification (NO signing secret here)
│   ├── jwks.service.ts        #   jwks-rsa client -> public key by kid (cached)
│   ├── jwt-auth.guard.ts      #   verifies Bearer JWT via JWKS -> req.user
│   ├── roles.guard.ts         #   checks `roles` claim for @Roles routes
│   ├── roles.decorator.ts     #   @Roles('admin')
│   ├── current-user.decorator.ts  # @CurrentUser() -> claims
│   └── auth.module.ts
├── products/                  # products feature (ecom-db)
│   ├── product.entity.ts      #   TypeORM entity: products table
│   ├── products.service.ts    #   findAll / create (+ seed demo data)
│   ├── products.controller.ts #   public GET, admin-only POST
│   ├── dto/create-product.dto.ts
│   └── products.module.ts
├── profile/                   # protected endpoint that echoes claims
├── health/                    # GET /api/health
└── common/                    # response envelope + error filter
```

---

## How authorization works here

Two guards, applied per-route with `@UseGuards(JwtAuthGuard, RolesGuard)`:

1. **`JwtAuthGuard`** — extracts the token from **either** the `Authorization:
   Bearer` header (mobile/services) **or** the `access_token` HttpOnly cookie
   (browser). The `X-Auth-Source` header can force one (`bearer`/`cookie`);
   absent = auto (prefer header, else cookie). It then finds the signing key by
   `kid` via `JwksService` (fetches the auth-service JWKS, cached) and
   `jwt.verify`s the signature plus `iss`/`aud`/`exp`. On success it attaches
   `{ sub, email, roles }` to `req.user`; otherwise **401**. See
   [AUTH_MODES.md](./AUTH_MODES.md).
2. **`RolesGuard`** — reads `@Roles(...)` metadata and checks it against the
   `roles` claim. No `@Roles` → allowed. Missing role → **403**.

`@CurrentUser()` is a param decorator that returns `req.user` for handlers.

Example (`products.controller.ts`):

```ts
@Get()                                   // public
findAll() { … }

@Post()
@UseGuards(JwtAuthGuard, RolesGuard)     // must be a valid token…
@Roles('admin')                          // …with the admin role
create(@Body() dto: CreateProductDto) { … }
```

> The ecom-api holds **no signing secret** — `auth/` only ever handles PUBLIC
> keys fetched from JWKS. See [JWT_JWKS.md](./JWT_JWKS.md).

---

## Data (`ecom-db`)

`Product` (TypeORM entity → `products` table): `id`, `name`, `priceCents`
(integer minor units to avoid float rounding), `stock`, `created_at`.
`ProductsService` seeds a couple of demo products on first boot. This database
is **separate** from the auth-service's — the two never share tables.

---

## Configuration (env)

| Var | Default | Meaning |
|-----|---------|---------|
| `ECOM_PORT` | 3008 | HTTP port (container) |
| `JWKS_URI` | `http://auth-service:3009/.well-known/jwks.json` | where to fetch public keys |
| `JWT_ISSUER` | `ecom-auth` | expected `iss` (must match auth) |
| `JWT_AUDIENCE` | `ecom-api` | expected `aud` (must match auth) |
| `ECOM_DB_HOST/PORT/USER/PASSWORD/NAME` | see `.env.example` | its Postgres |

---

## Try it

```bash
# public
curl http://localhost:3008/api/products

# protected — grab a token first (passwordless: request OTP -> read Mailpit -> verify)
curl -s -X POST http://localhost:3008/auth/otp \
  -H 'Content-Type: application/json' -d '{"email":"admin@example.com"}'
OTP=$(curl -s 'http://localhost:8028/api/v1/messages?limit=1' \
  | python3 -c "import sys,json,re;m=json.load(sys.stdin)['messages'][0];print(re.search(r'(\d{6})', m['Subject']+' '+m.get('Snippet','')).group(1))")
TOKEN=$(curl -s -X POST http://localhost:3008/auth/verify-otp \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"admin@example.com\",\"otp\":\"$OTP\"}" \
  | python3 -c "import sys,json;print(json.load(sys.stdin)['data']['accessToken'])")

curl http://localhost:3008/api/profile -H "Authorization: Bearer $TOKEN"
curl -X POST http://localhost:3008/api/products -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' -d '{"name":"Cap","priceCents":1500,"stock":40}'
```
