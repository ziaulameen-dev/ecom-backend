# Database Schemas

Each service owns its **own** Postgres database — they never share tables
(database-per-service). The schemas are created automatically by TypeORM
(`synchronize` in development) from each service's entities; the `.sql` files
here document the resulting shape.

| Database | Owner service | Tables | DDL |
|----------|---------------|--------|-----|
| `auth-db` | auth-service | `users`, `login_otps` | [auth-db.sql](./auth-db.sql) |
| `ecom-db` | ecom-api | `products` | [ecom-db.sql](./ecom-db.sql) |

```
┌─────────────── auth-db ───────────────┐   ┌────────────── ecom-db ───────────────┐
│ users                                 │   │ products                              │
│ ─────────────────────────────────────│   │ ──────────────────────────────────────│
│ id         uuid  PK                    │   │ id          uuid   PK                 │
│ email      varchar  UNIQUE             │   │ name        varchar                   │
│ name       varchar  NULL               │   │ priceCents  integer   (minor units)   │
│ mobile     varchar  NULL               │   │ stock       integer   default 0       │
│ roles      text[]  default {customer}  │   │ created_at  timestamp default now()   │
│ created_at timestamp default now()     │   │                                       │
└───────────────────────────────────────┘   └───────────────────────────────────────┘
        owned by auth-service                       owned by ecom-api
     (ecom-api has NO access)                    (auth-service has NO access)
```

There are **no foreign keys between the two databases** — that's intentional.
A user in `auth-db` is linked to data in `ecom-db` only by the `sub` (user id)
claim carried in the JWT, resolved at the application layer, never by a SQL join
across services.

## Regenerating these files

The DDL above was dumped from the live databases:

```bash
# auth-db
docker compose --env-file .env -f docker/docker-compose.yml \
  exec -T auth-db pg_dump -U auth -d authdb --schema-only --no-owner

# ecom-db
docker compose --env-file .env -f docker/docker-compose.yml \
  exec -T ecom-db pg_dump -U ecom -d ecomdb --schema-only --no-owner
```

## Source of truth

The entities are the real source of truth; the SQL is derived:

- `services/auth-service/src/users/user.entity.ts` → `users`
- `services/auth-service/src/otp/login-otp.entity.ts` → `login_otps`
- `services/ecom-api/src/products/product.entity.ts` → `products`

When you change an entity, in development TypeORM `synchronize` updates the table
on the next boot. For production, replace `synchronize` with migrations and keep
these files in sync.
