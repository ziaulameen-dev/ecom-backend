# ecom-backend — microservices platform

Two independent **NestJS** services behind an **nginx** gateway, each with its
**own PostgreSQL** database. The **auth-service** issues **RS256 JWTs** and
publishes a **JWKS** endpoint; the **ecom-api** verifies those tokens using the
JWKS — no shared secret between them.

```
client → nginx (:3008) ─┬─ /auth/*, /.well-known/*  → auth-service → auth-db
                        └─ /api/*                   → ecom-api     → ecom-db
```

## Quick start

```bash
cp .env.example .env
npm run up            # build + start nginx, both services, both Postgres
npm run ps            # wait until auth-service & ecom-api are "healthy"
```

Everything is reachable through the gateway at `http://localhost:3008`.
Demo admin (seeded): `admin@example.com` (passwordless — sign in with an OTP).

```bash
# public
curl http://localhost:3008/api/products

# passwordless login: request a code -> read it from Mailpit -> verify -> token
curl -s -X POST http://localhost:3008/auth/otp \
  -H 'Content-Type: application/json' -d '{"email":"admin@example.com"}'
OTP=$(curl -s 'http://localhost:8028/api/v1/messages?limit=1' \
  | python3 -c "import sys,json,re;m=json.load(sys.stdin)['messages'][0];print(re.search(r'(\d{6})', m['Subject']+' '+m.get('Snippet','')).group(1))")
TOKEN=$(curl -s -X POST http://localhost:3008/auth/verify-otp \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"admin@example.com\",\"otp\":\"$OTP\"}" \
  | python3 -c "import sys,json;print(json.load(sys.stdin)['data']['accessToken'])")
curl http://localhost:3008/api/profile -H "Authorization: Bearer $TOKEN"
```

Auth is **passwordless** — the same `email → OTP → verify` flow both signs up new
emails and logs in existing ones. See [docs/OTP_LOGIN.md](./docs/OTP_LOGIN.md).

**Two token-delivery modes** (pick via the `X-Auth-Source` header on verify-otp):
**bearer** (default — token in the body, for mobile/services) or **cookie**
(HttpOnly cookie, token never exposed to JS, for browsers). See
[docs/AUTH_MODES.md](./docs/AUTH_MODES.md).

Or import the Postman collection: `postman/ecom-platform.postman_collection.json`.

## Endpoints (via the gateway)

| Method | Path | Auth | Service |
|--------|------|------|---------|
| POST | `/auth/otp` | public | auth-service |
| POST | `/auth/verify-otp` | public | auth-service |
| POST | `/auth/logout` | public | auth-service |
| GET | `/.well-known/jwks.json` | public | auth-service |
| GET | `/api/health` | public | ecom-api |
| GET | `/api/products` | public | ecom-api |
| POST | `/api/products` | admin | ecom-api |
| GET | `/api/profile` | logged-in | ecom-api |

## Commands

| Command | Purpose |
|---------|---------|
| `npm run up` | Build images + start the whole stack |
| `npm run down` | Stop + remove containers (keep DB data) |
| `npm run down:volumes` | Also delete the Postgres volumes |
| `npm run logs` | Follow logs (`npm run logs -- ecom-api` for one) |
| `npm run ps` | Container status + health |

## Documentation

Full docs in [`docs/`](./docs/README.md):

- [ARCHITECTURE.md](./docs/ARCHITECTURE.md) — big picture & decisions (start here)
- [AUTH_SERVICE.md](./docs/AUTH_SERVICE.md) — auth internals
- [JWT_JWKS.md](./docs/JWT_JWKS.md) — token signing & verification
- [ECOM_API.md](./docs/ECOM_API.md) — ecom internals
- [NGINX_GATEWAY.md](./docs/NGINX_GATEWAY.md) — gateway routing
- [DOCKER_SETUP.md](./docs/DOCKER_SETUP.md) — containers, DBs, env, ports
- [POSTMAN.md](./docs/POSTMAN.md) — using the collection

## Local development (a single service, without Docker)

Each service is a normal NestJS app:

```bash
cd services/auth-service   # or services/ecom-api
yarn install
yarn start:dev
```

You'll need a reachable Postgres and the right env vars (see the service's
`src/config/configuration.ts` defaults). Docker is the easy path.
