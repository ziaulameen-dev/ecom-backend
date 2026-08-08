# Postman Collection

A ready-to-run collection lives at
`postman/ecom-platform.postman_collection.json`. It covers **every** endpoint
exposed through the nginx gateway (auth + ecom-api), organised into folders.

## Import

1. Postman → **Import** → select the file above.
2. Key collection variables (pre-filled with sensible defaults):
   - `baseUrl` = `http://localhost:3008` (the nginx gateway)
   - `mailpitUrl` = `http://localhost:8028` (dev inbox)
   - `email` = `admin@example.com`, `country` = `IN`
   - `cashfreeSecretKey` = **(set this yourself)** — your `CASHFREE_SECRET_KEY`,
     only needed to sign the simulated webhook.
   - `accessToken`, `refreshToken`, `csrfToken`, `otp`, `productId`, `cartId`,
     `addressId`, `orderId`, `returnId` — **filled in automatically** by test
     scripts as you go.

No separate environment file is needed.

## Folders

- **Gateway** — gateway/ecom health, JWKS.
- **Auth service** — passwordless OTP login, profile, 3-step email change,
  account deletion, refresh/logout/logout-all, and the one **cookie-mode**
  example (everything else uses Bearer).
- **Ecom API**
  - **Catalog** — public list/detail + admin product & per-country price CRUD.
  - **Shipping rates (admin)** — per-country delivery charges.
  - **Cart (guest + user)** — add/update/remove/clear, set country, and merge.
  - **Addresses** — CRUD.
  - **Profile** — the ecom-api's view of the user.
  - **Checkout & Payment (Cashfree)** — checkout + a signed webhook simulator.
  - **Orders (customer)** — history, detail, cancel, returns.
  - **Admin — orders & returns** — status/tracking/cancel/refund + RMA transitions.

## Happy-path run order

1. **Auth → 1. Request OTP** (`admin@example.com`, no password).
2. **Auth → 2. Read OTP from Mailpit** — saves `{{otp}}`.
3. **Auth → 3. Verify OTP (bearer)** — saves `{{accessToken}}` + `{{refreshToken}}`.
4. **Catalog → List products** — saves `{{productId}}`.
5. **Cart → Add item to cart** — saves `{{cartId}}` (send `X-Cart-Id` as a guest).
6. **Cart → Merge guest cart on login** (optional, after logging in).
7. **Addresses → Create address** — saves `{{addressId}}`.
8. **Checkout & Payment → Checkout** — creates the order + a Cashfree
   `paymentSessionId`; saves `{{orderId}}`.
9. **Checkout & Payment → Cashfree webhook** — simulates the payment callback
   (see below); the order flips to `paid`, stock decrements, cart clears.
10. **Orders (customer) → Get my order** — confirm `status: paid`.
11. **Admin** — fulfil → ship → deliver, or cancel/refund, or handle returns.

## Two auth modes

The collection uses **Bearer** tokens throughout (token in the JSON body, saved
to `{{accessToken}}`; Bearer requests are CSRF-exempt). Cookie delivery is shown
**once** — **Auth → Cookie mode example** — which sets HttpOnly cookies + a
readable `csrf_token` (saved to `{{csrfToken}}`). In cookie mode, state-changing
calls must send `X-CSRF-Token: {{csrfToken}}` or they 403.

## The Cashfree webhook request

In production Cashfree POSTs to `$PUBLIC_BASE_URL/api/payments/webhook` — you
never call it yourself. The **Cashfree webhook** request lets you simulate it
locally: a **pre-request script** builds a `PAYMENT_SUCCESS_WEBHOOK` body for the
current `{{orderId}}`, signs `timestamp + body` with
`base64(HMAC-SHA256(..., {{cashfreeSecretKey}}))`, and sets the
`x-webhook-signature` / `x-webhook-timestamp` headers. Set `cashfreeSecretKey`
first, or the signature check returns 400. Handlers are idempotent, so re-sending
is a no-op (dedup → `duplicate: true`).

## Everything goes through nginx

`baseUrl` is the gateway. `/auth/*` and `/.well-known/*` reach the auth-service;
`/api/*` reaches the ecom-api — you never talk to the services directly.
