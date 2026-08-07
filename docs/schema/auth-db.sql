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
    email         varchar     NOT NULL,                       -- login identifier (unique); a tombstone after soft-delete
    name          varchar         NULL,                       -- optional display name
    mobile        varchar         NULL,                       -- optional phone number
    locale        varchar         NULL,                       -- preferred email language (ISO 639-1, e.g. en/es/fr/ar)
    pending_email varchar         NULL,                       -- target address during an email change; cleared when it completes
    roles         text[]      NOT NULL DEFAULT '{customer}',  -- e.g. {admin} or {customer}
    deleted_at    timestamp       NULL,                       -- soft-delete (deactivation) timestamp; NULL = active
    deleted_email varchar         NULL,                       -- original email retained for records after soft-delete
    created_at    timestamp   NOT NULL DEFAULT now(),

    CONSTRAINT users_pkey        PRIMARY KEY (id),
    CONSTRAINT users_email_unique UNIQUE (email)
);

-- Soft-delete frees the real address for re-signup: `email` is set to a unique
-- tombstone (deleted+<id>@account.invalid) and the original is moved to
-- `deleted_email`. The row (and any future orders) is retained.

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

-- ---------------------------------------------------------------------------
-- refresh_tokens — long-lived, rotating, revocable sessions
-- Only the HASH of the opaque token is stored. Rotated (revoked + reissued) on
-- every /auth/refresh; revoked on logout / logout-all / account deletion.
-- ---------------------------------------------------------------------------
CREATE TABLE public.refresh_tokens (
    id         uuid        NOT NULL DEFAULT uuid_generate_v4(),
    user_id    uuid        NOT NULL,                    -- owning account (indexed)
    token_hash varchar     NOT NULL,                    -- sha256(token), unique
    expires_at timestamptz NOT NULL,                    -- session lifetime (default 30 days)
    revoked_at timestamp       NULL,                    -- set on rotate/logout; NULL = active
    created_at timestamp   NOT NULL DEFAULT now(),

    CONSTRAINT refresh_tokens_pkey            PRIMARY KEY (id),
    CONSTRAINT refresh_tokens_hash_unique     UNIQUE (token_hash)
);
CREATE INDEX refresh_tokens_user_id_idx ON public.refresh_tokens (user_id);

-- ---------------------------------------------------------------------------
-- audit_logs — append-only trail of security-sensitive actions
-- (login, email_changed, account_deleted, logout_all). Never mutated.
-- ---------------------------------------------------------------------------
CREATE TABLE public.audit_logs (
    id         uuid        NOT NULL DEFAULT uuid_generate_v4(),
    user_id    uuid            NULL,                    -- actor (indexed); NULL if unknown
    action     varchar     NOT NULL,                    -- e.g. 'login', 'email_changed'
    metadata   jsonb           NULL,                    -- free-form context, no secrets
    created_at timestamp   NOT NULL DEFAULT now(),

    CONSTRAINT audit_logs_pkey PRIMARY KEY (id)
);
CREATE INDEX audit_logs_user_id_idx ON public.audit_logs (user_id);
