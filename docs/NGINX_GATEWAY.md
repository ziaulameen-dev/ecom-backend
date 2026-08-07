# nginx Gateway

nginx is the single public entry point. It makes two separate services look like
one backend on one origin (`http://localhost:3008`). Config lives in
`docker/nginx/nginx.conf`, mounted read-only into the `nginx` container.

## Routing

| Incoming (host `localhost:3008`) | Proxied to (internal) | Service |
|----------------------------------|-----------------------|---------|
| `/auth/*` | `auth-service:3009` | passwordless OTP (signup + login) |
| `/.well-known/*` | `auth-service:3009` | JWKS (public keys) |
| `/api/*` | `ecom-api:3008` | products, profile, health |
| `/gateway/health` | (answered by nginx itself) | gateway liveness |

```nginx
upstream auth_upstream { server auth-service:3009; }
upstream ecom_upstream { server ecom-api:3008; }

server {
  listen 3008;                      # container port; published to host 3008
  location /auth/         { proxy_pass http://auth_upstream; }
  location /.well-known/  { proxy_pass http://auth_upstream; }
  location /api/          { proxy_pass http://ecom_upstream; }
}
```

## How it finds the services

`auth-service` and `ecom-api` are **Docker Compose service names**. Docker's
embedded DNS (`127.0.0.11`) resolves them to the containers on the shared
network. The `resolver 127.0.0.11 valid=30s` line lets nginx re-resolve if a
container restarts with a new IP.

The upstream ports are the **container** ports (3009 / 3008), not host ports —
these services aren't (necessarily) published to the host at all. Only nginx is.

## Why a gateway at all

- **One origin** for clients → no CORS gymnastics, no knowing internal ports.
- **Hides topology** → you can move a service, rename it, or split it further
  without changing clients.
- **A place for cross-cutting concerns** → TLS termination, rate limiting,
  request logging, auth pre-checks can be added here later.

## Notes / gotchas

- `proxy_pass http://auth_upstream;` (no trailing path) forwards the URI
  unchanged, so `/auth/otp` arrives at the auth-service as `/auth/otp` —
  which is exactly the route it defines (no prefix stripping needed).
- The ecom-api uses a global `/api` prefix, so `/api/products` maps directly.
- If you add HTTPS later, terminate TLS here and keep the internal hops plain
  HTTP on the private network.
