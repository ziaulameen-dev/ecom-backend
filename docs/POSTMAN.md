# Postman Collection

A ready-to-run collection lives at
`postman/ecom-platform.postman_collection.json`.

## Import

1. Postman → **Import** → select the file above.
2. Collection variables:
   - `baseUrl` = `http://localhost:3008` (the nginx gateway)
   - `accessToken` = filled in automatically by the bearer Login request.

No separate environment file is needed.

## Two auth modes

The collection demonstrates both delivery modes (see
[AUTH_MODES.md](./AUTH_MODES.md)):

### Bearer (default) — run order

| # | Request | Notes |
|---|---------|-------|
| 1 | Auth service → **1. Request OTP (signup or login)** | `admin@example.com` (no password). Emails a code via Mailpit; no token yet. |
| 2 | Auth service → **2. Read OTP from Mailpit** | Pulls the latest email and stores the 6-digit code in `{{otp}}`. |
| 3 | Auth service → **3. Verify OTP (bearer) — saves token** | Exchanges the OTP for a token; a test script stores it in `{{accessToken}}`. |
| 4 | Ecom API → **Profile (Bearer)** | Sends `Authorization: Bearer {{accessToken}}`. |
| 5 | Ecom API → **Create product (admin, Bearer)** | Needs the admin token from step 3. |

### Cookie — run order

| # | Request | Notes |
|---|---------|-------|
| 1 | Auth service → **Login (cookie mode)** | Sends `X-Auth-Source: cookie`. Sets an HttpOnly cookie; token is NOT in the body. Postman stores the cookie. |
| 2 | Ecom API → **Profile (cookie)** | No Authorization header — Postman sends the cookie automatically. |
| — | Auth service → **Logout** | Clears the cookie; protected cookie requests then 401. |

Other requests: **JWKS**, **Health**, **List products** (public), and
**Create product WITHOUT auth** (negative test → 401).

## How the bearer token is wired

The **Login (bearer)** request has a test script:

```js
pm.collectionVariables.set('accessToken', pm.response.json().data.accessToken);
```

The Bearer requests send `Authorization: Bearer {{accessToken}}`. Log in again
to refresh once the token expires (default TTL 15m). The cookie requests don't
need this — Postman's cookie jar handles it.

## Everything goes through nginx

`baseUrl` is the gateway. `/auth/*` and `/.well-known/*` reach the auth-service;
`/api/*` reaches the ecom-api — you never talk to the services directly.
