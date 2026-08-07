-- =============================================================================
-- ecom-db — schema for the ECOM API's Postgres database.
--
-- Generated automatically by TypeORM (`synchronize` in development) from
-- services/ecom-api/src/products/product.entity.ts. Documented here for
-- reference; you do NOT run it by hand while `synchronize` is on.
-- For production, generate migrations and turn `synchronize` off.
--
-- Owned exclusively by the ecom-api. This is a SEPARATE database from auth-db;
-- the two services never share tables (database-per-service).
-- =============================================================================

-- UUID primary keys use uuid_generate_v4().
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ---------------------------------------------------------------------------
-- products — the store catalog
-- ---------------------------------------------------------------------------
CREATE TABLE public.products (
    id          uuid       NOT NULL DEFAULT uuid_generate_v4(),
    name        varchar    NOT NULL,
    "priceCents" integer   NOT NULL,                 -- price in minor units (cents) to avoid float rounding
    stock       integer    NOT NULL DEFAULT 0,
    created_at  timestamp  NOT NULL DEFAULT now(),

    CONSTRAINT products_pkey PRIMARY KEY (id)
);

-- Seeded on first boot: "T-Shirt" (1999, 100) and "Sneakers" (8999, 25)
