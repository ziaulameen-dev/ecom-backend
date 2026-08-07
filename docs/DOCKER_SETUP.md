# Docker Setup

The whole platform runs with Docker Compose: **nginx + auth-service + ecom-api
+ two Postgres databases**. Only nginx is published to your machine.

## Files

| File | Purpose |
|------|---------|
| `docker/docker-compose.yml` | Defines all 5 containers, networks, volumes |
| `docker/nginx/nginx.conf` | Gateway routing (mounted into nginx) |
| `services/auth-service/Dockerfile` | Builds the auth image (context = that folder) |
| `services/ecom-api/Dockerfile` | Builds the ecom image (context = that folder) |
| `.env` / `.env.example` | Platform config; compose reads it via `--env-file` |

### Why a Dockerfile per service?

Each service builds from its **own folder as the build context**, so its
`COPY package.json` / `COPY . .` copy only that service. This keeps images
small, avoids leaking the other service into the context, and means either
service could move to its own repo unchanged. Cross-cutting infra (nginx,
compose) stays under `docker/`.

## The containers

| Service | Image / build | Host port | Depends on |
|---------|---------------|-----------|------------|
| `nginx` | nginx:1.27-alpine | **3008** | auth-service, ecom-api |
| `auth-service` | `services/auth-service/Dockerfile` | 3009 | auth-db (healthy), mailpit |
| `ecom-api` | `services/ecom-api/Dockerfile` | — (internal) | ecom-db (healthy), auth-service |
| `auth-db` | postgres:16-alpine | — (internal) | — |
| `ecom-db` | postgres:16-alpine | — (internal) | — |
| `mailpit` | axllent/mailpit | **8028** (UI), 1025 (SMTP) | — |

**Mailpit** catches all outgoing email (the OTP login codes). Web UI:
<http://localhost:8028> (8028 because 8025 was taken locally). The auth-service
sends to `mailpit:1025` over the Docker network. See
[OTP_LOGIN.md](./OTP_LOGIN.md).

`depends_on … condition: service_healthy` makes the apps wait until their
Postgres passes `pg_isready`. The apps also retry the DB connection (TypeORM
`retryAttempts`) as a second safety net.

## Two databases (database-per-service)

`auth-db` and `ecom-db` are **separate Postgres containers**, each with its own
volume (`auth-db-data`, `ecom-db-data`). The auth-service can only reach
`auth-db`; the ecom-api can only reach `ecom-db`. They never share tables — a
core microservices principle.

Tables are created automatically from the TypeORM entities because
`synchronize` is on in **development**. In production you would turn that off and
run **migrations** instead (see note in `.env.example`).

## Environment

Compose reads the **project-root `.env`** (the npm scripts pass
`--env-file .env`) for `${VAR}` substitution. Copy the template first:

```bash
cp .env.example .env
```

Key variables (see `.env.example` for all): `NODE_ENV`, `JWT_ISSUER`,
`JWT_AUDIENCE`, `ACCESS_TOKEN_TTL`, the ports, and the two DBs' credentials.

> `NODE_ENV=development` is the default **on purpose** — it enables TypeORM
> `synchronize` so the tables exist without migrations. Setting it to
> `production` without adding migrations will make the apps crash-loop with
> "relation … does not exist".

## Running it

From the project root:

```bash
npm run up          # build images + start everything (detached)
npm run ps          # container status (watch health)
npm run logs        # follow all logs  (npm run logs -- auth-service for one)
npm run down        # stop + remove containers (keeps DB volumes)
npm run down:volumes  # also delete the Postgres data
```

These wrap `docker compose --env-file .env -f docker/docker-compose.yml …`.

First boot pulls Postgres/nginx images and installs deps inside the builds, so
it takes a minute. Watch `npm run ps` until auth-service and ecom-api show
`healthy`.

## Verifying

```bash
curl http://localhost:3008/api/health         # public, via gateway
curl http://localhost:3008/.well-known/jwks.json
```

Full request walkthrough: [POSTMAN.md](./POSTMAN.md) or the "try it" sections in
[AUTH_SERVICE.md](./AUTH_SERVICE.md) / [ECOM_API.md](./ECOM_API.md).

## Troubleshooting

| Symptom | Cause / Fix |
|---------|-------------|
| `502 Bad Gateway` from nginx | An app isn't up yet (still connecting to Postgres). Wait for `healthy` in `npm run ps`. |
| App restart-loops, logs show `relation "users"/"products" does not exist` | `NODE_ENV=production` disabled `synchronize` and there are no migrations. Set `NODE_ENV=development`. |
| Container restart-loop `Cannot find module '/app/dist/main.js'` | A stale `*.tsbuildinfo` got into the image so `tsc` skipped emitting JS. It's excluded in each service's `.dockerignore`; rebuild `npm run up`. |
| `port is already allocated` on 3008 | Another process holds the host port. Change `GATEWAY_PORT` in `.env`. |
| Want a clean DB | `npm run down:volumes` then `npm run up`. |
