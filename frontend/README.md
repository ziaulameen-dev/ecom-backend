# Ecom demo frontend (Next.js + shadcn-styled)

A minimal storefront + admin to exercise the whole backend flow: browse per-country
catalog → guest cart → passwordless OTP login (cart merges) → address → Stripe
checkout → order confirmation, plus an admin panel for prices / delivery charges /
orders.

## Run

The backend stack must be up first (from the repo root): `npm run up` (and
`npm run tunnel` for Stripe webhooks). Then:

```bash
cd frontend
cp .env.local.example .env.local   # NEXT_PUBLIC_API_URL=http://localhost:3008
npm install
npm run dev                        # http://localhost:3000
```

## Notes

- **Auth**: bearer tokens in `localStorage` (access + refresh; auto-refresh on 401),
  so the SPA works cross-origin without cookies/CSRF. The guest cart id is sent via
  the `X-Cart-Id` header and merged into your account on login.
- **OTP code**: read it from Mailpit at <http://localhost:8028> (dev inbox).
- **Payment**: Stripe Elements with the test card `4242 4242 4242 4242` (any future
  date / any CVC). The order flips to `paid` via the Stripe webhook (needs the
  ngrok tunnel running).
- **Admin**: sign in as `admin@example.com` to manage per-country prices, delivery
  charges, and order statuses.
- Country selector (top bar) drives pricing/currency; one currency per cart.
