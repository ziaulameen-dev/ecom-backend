-- =============================================================================
-- auth-db — schema for the AUTH SERVICE's Postgres database.
--
-- This is generated automatically by TypeORM (`synchronize` in development)
-- from services/auth-service/src/users/user.entity.ts. It is documented here
-- for reference; you do NOT run it by hand while `synchronize` is on.
-- For production, generate migrations and turn `synchronize` off.
--
-- Owned exclusively by the auth-service. The ecom-api has NO access to this DB.
-- =============================================================================

-- UUID primary keys use uuid_generate_v4().
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ---------------------------------------------------------------------------
-- users — registered accounts and their roles
-- Auth is PASSWORDLESS: there is no password column. Identity is proven by
-- verifying an emailed one-time code (see login_otps below). Accounts are
-- created lazily the first time an email verifies an OTP; name/mobile are the
-- optional profile captured then (country lives on the shipping address).
-- ---------------------------------------------------------------------------
CREATE TABLE public.users (
    id            uuid        NOT NULL DEFAULT uuid_generate_v4(),
    email         varchar     NOT NULL,                       -- login identifier (unique)
    name          varchar         NULL,                       -- optional display name
    mobile        varchar         NULL,                       -- optional phone number
    pending_email varchar         NULL,                       -- target address during an email change; cleared when it completes
    roles         text[]      NOT NULL DEFAULT '{customer}',  -- e.g. {admin} or {customer}
    created_at    timestamp   NOT NULL DEFAULT now(),

    CONSTRAINT users_pkey        PRIMARY KEY (id),
    CONSTRAINT users_email_unique UNIQUE (email)
);

-- Seeded on first boot: admin@example.com  (roles = {admin}; sign in with an OTP)

-- ---------------------------------------------------------------------------
-- login_otps — pending 2-step-login OTP challenges
-- One active row per email; only the HASH of the code is stored.
-- ---------------------------------------------------------------------------
CREATE TABLE public.login_otps (
    id         uuid        NOT NULL DEFAULT uuid_generate_v4(),
    email      varchar     NOT NULL,                    -- who the code is for (unique)
    code_hash  varchar     NOT NULL,                    -- sha256(code), never the plain code
    expires_at timestamptz NOT NULL,                    -- code lifetime (default 5 min)
    attempts   integer     NOT NULL DEFAULT 0,          -- wrong tries; capped, then invalidated
    created_at timestamp   NOT NULL DEFAULT now(),

    CONSTRAINT login_otps_pkey         PRIMARY KEY (id),
    CONSTRAINT login_otps_email_unique UNIQUE (email)
);
