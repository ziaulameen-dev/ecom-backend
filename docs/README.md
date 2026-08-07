# Documentation

Start here, then dive into whichever area you need.

| Doc | What it covers |
|-----|----------------|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Big picture: services, request flows, why it's built this way. **Read first.** |
| [JWT_JWKS.md](./JWT_JWKS.md) | How tokens are signed (RS256) and verified via JWKS, key rotation. |
| [AUTH_MODES.md](./AUTH_MODES.md) | Bearer vs HttpOnly-cookie delivery, the `X-Auth-Source` header. |
| [OTP_LOGIN.md](./OTP_LOGIN.md) | Passwordless auth: email → OTP (via Mailpit) → token; signup == login. |
| [AUTH_SERVICE.md](./AUTH_SERVICE.md) | Auth service internals (passwordless OTP, keys, users DB). |
| [ECOM_API.md](./ECOM_API.md) | Ecom API internals (guards, products, profile, DB). |
| [NGINX_GATEWAY.md](./NGINX_GATEWAY.md) | How nginx routes the two services under one origin. |
| [DOCKER_SETUP.md](./DOCKER_SETUP.md) | Containers, the two Postgres DBs, env, ports, run commands. |
| [schema/](./schema/README.md) | Database schemas for both services (`auth-db`, `ecom-db`). |
| [POSTMAN.md](./POSTMAN.md) | Import & use the Postman collection. |

## TL;DR — run it

```bash
cp .env.example .env
npm run up        # build + start everything
```

Then hit the gateway at <http://localhost:3008> (see POSTMAN.md or ARCHITECTURE.md
for the request list). Demo admin: `admin@example.com` (passwordless — sign in
with an OTP).
