# Orders, Shipping, Returns & Cancellations

How an order moves from cart to delivered, and every way money and stock can
flow back (cancel, refund, return). All money is in **minor units** (paise) and
every order is tied to one **currency** and one **destination country** (which
drives price, currency, shipping, and tax). The store is **India-only (INR)**.

Everything below lives in the **ecom-api** (`src/orders/*`, `src/cart/*`,
`src/products/*`). Payment is **Cashfree**; the **webhook is the source of
truth** for payment state.

---

## 1. Order status lifecycle

```
                         ┌──────────── cancel (customer/admin) ───────────┐
                         │                                                 ▼
  cart ──checkout──▶ pending ──pay──▶ paid ──fulfill──▶ fulfilled ──ship──▶ shipped ──deliver──▶ delivered
                         │             │  ▲                                   │                     │
                         │             │  └──────────────── return (RMA) ◀────┴─────────────────────┘
                         ▼             │                        │
                      failed          │                        ▼
                   (payment fails)    │                  (partial refund per item)
                                      │
                                      ├── refund (admin, full) ──▶ refunded
                                      └── oversold at capture ───▶ cancelled (auto-refunded)
```

**Statuses**

| Status | Meaning |
|---|---|
| `pending` | Order created, awaiting payment (a Cashfree order exists). |
| `paid` | Payment captured (set by the webhook). Stock is now decremented. |
| `failed` | Payment failed / user dropped off. |
| `fulfilled` | Admin marked it picked/packed. |
| `shipped` | Admin shipped it (carrier + tracking set). |
| `delivered` | Admin marked delivered. |
| `cancelled` | Cancelled (pending → order expires; paid → auto-refunded). |
| `refunded` | Fully refunded (money returned, stock restored). |

`refundedMinor` on the order tracks how much has been refunded (supports
partial refunds/returns).

---

## 2. Checkout → payment

```
POST /api/checkout { addressId }          (login required)
  1. load the user's cart (must be non-empty)
  2. require cart.country == shipping address.country
  3. cancel any earlier PENDING orders for this user   ← idempotency
  4. snapshot line prices; compute subtotal
  5. shipping = admin per-country rate; tax = flat TAX_PERCENT of subtotal (0 by default)
  6. total = subtotal + shipping + tax   (rejected if below the ₹1 min charge)
  7. save Order(pending) + snapshot the shipping address + customerEmail
  8. create a Cashfree order(total, INR) using OUR order id  → return payment_session_id
  ▼
{ orderId, status, currency, amounts, paymentSessionId, appId, mode }
```

The frontend completes payment with the **Cashfree JS SDK** (`load()` +
`cashfree.checkout({ paymentSessionId, redirectTarget: '_modal' })`), then polls
the order until the webhook flips it to `paid`. Prices and the address are
**snapshotted** on the order, so later product/price changes never alter order
history.

**Stock is NOT held at checkout** — only availability is validated. It's
decremented when payment is confirmed (next step).

---

## 3. Payment confirmation (webhook = source of truth)

Cashfree calls `POST /api/payments/webhook` (signature-verified via
`x-webhook-signature` over `timestamp + rawBody`, de-duplicated by
`type:order_id:payment/refund id`):

| Cashfree event | Effect |
|---|---|
| `PAYMENT_SUCCESS_WEBHOOK` | Mark **paid** → decrement stock (atomic) → clear cart → email. |
| `PAYMENT_FAILED_WEBHOOK` / `PAYMENT_USER_DROPPED_WEBHOOK` | `→ failed`. |
| `REFUND_STATUS_WEBHOOK` (status `SUCCESS`) | Reconcile a settled refund → refunded + restock (idempotent). |

### Oversell protection
On `paid`, stock is decremented **all-or-nothing**. If a line raced to zero
after checkout:

```
roll back any decrements → full auto-refund the Cashfree order → order = cancelled
```

So we never keep money for something we can't ship.

---

## 4. Fulfillment & shipping (admin)

Admin moves the order along the **fulfillment track** only — money-states are
not settable here (see §5).

```
PATCH /api/admin/orders/:id/status { "fulfilled" | "shipped" | "delivered" }
   allowed:  paid → fulfilled | shipped
             fulfilled → shipped
             shipped → delivered
PATCH /api/admin/orders/:id/tracking { carrier, trackingNumber }
```

Setting `shipped` sends the customer a **"shipped"** email (with tracking if
set). Trying to set `refunded`/`cancelled`/`pending` here returns **400** — those
must go through cancel/refund so the payment and stock actually move.

---

## 5. Cancel

```
POST /api/orders/:id/cancel            (customer — own order, or admin variant)
```

| Order state | What happens |
|---|---|
| `pending` | Mark `cancelled`. (No stock was decremented; the unpaid Cashfree order just expires.) |
| `paid` (not shipped) | **Full Cashfree refund** → restore stock → `cancelled` (`refundedMinor = total`) → email. |
| `shipped` / `delivered` | **Blocked** — use a return instead. |
| already cancelled/refunded/failed | 400. |

---

## 6. Refund (admin)

```
POST /api/admin/orders/:id/refund { amountMinor? }   (omit amount = full)
```

- **Full refund** → restore stock → `refunded` → email.
- **Partial refund** → money only; status stays; `refundedMinor` increases.

Cashfree refunds settle **asynchronously**, so we increment `refundedMinor`
optimistically when the refund is accepted (and mark `refunded` once it reaches
the total). The `REFUND_STATUS_WEBHOOK` later reconciles the same order without
double-restocking (handlers are idempotent). Refunds issued from the **Cashfree
Dashboard** are reconciled the same way.

---

## 7. Returns (RMA)

For orders already with the customer (`shipped`/`delivered`/`fulfilled`).
Money and stock move **only after the goods are received**.

```
customer:  POST /api/orders/:id/returns { items:[{productId,quantity}], reason }
           GET  /api/returns
admin:     GET   /api/admin/returns
           PATCH /api/admin/returns/:id { action }

  requested ──approve──▶ approved ──receive──▶ received ──refund──▶ refunded
      │                     │                     │
      └──reject──▶ rejected ┘  (reject allowed at any pre-refund step, e.g. damaged)
```

- **create** — validates the requested quantity against what's left to return
  (ordered − already-claimed across other non-rejected returns), so a unit can't
  be returned twice.
- **approve** — authorize; customer ships it back.
- **receive** — admin confirms the parcel arrived. *No money/stock yet.*
- **refund** — after inspection: **partial Cashfree refund** for the returned
  items' value + **restock those units** + bump the order's `refundedMinor` +
  each line's `returnedQuantity`. Return → `refunded`.
- **reject** — decline (e.g. damaged on arrival); nothing refunded.

---

## 8. Stock flow (summary)

| Event | Stock |
|---|---|
| Add to cart / checkout | unchanged (availability only checked) |
| Payment succeeds | **− quantity** (atomic; oversell → auto-refund) |
| Cancel a paid order | **+ quantity** |
| Full refund (admin or Cashfree Dashboard) | **+ quantity** |
| Return refunded | **+ returned quantity** only |

---

## 9. Emails

Order emails are sent on **paid**, **shipped**, **full refund**, and
**cancelled** (to the order's snapshotted `customerEmail`). Mail is
environment-aware: **dev → Mailpit** (nothing leaves the machine); **prod →
authenticated TLS SMTP**. See [OTP_LOGIN.md](./OTP_LOGIN.md) for the mail setup.

---

## 10. Endpoint reference

| Method | Path | Who | Purpose |
|---|---|---|---|
| POST | `/api/checkout` | customer | Cart → pending order + Cashfree payment session |
| POST | `/api/payments/webhook` | Cashfree | Payment/refund reconciliation |
| GET | `/api/orders` (`?page&limit`) | customer | Order history |
| GET | `/api/orders/:id` | customer | Order detail |
| POST | `/api/orders/:id/cancel` | customer | Cancel (pending/paid) |
| POST | `/api/orders/:id/returns` | customer | Request a return |
| GET | `/api/returns` | customer | My returns |
| GET | `/api/admin/orders` (`?page&limit`) | admin | All orders |
| PATCH | `/api/admin/orders/:id/status` | admin | Fulfillment transitions |
| PATCH | `/api/admin/orders/:id/tracking` | admin | Set carrier + tracking |
| POST | `/api/admin/orders/:id/cancel` | admin | Cancel any order |
| POST | `/api/admin/orders/:id/refund` | admin | Full/partial refund |
| GET | `/api/admin/returns` | admin | All return requests |
| PATCH | `/api/admin/returns/:id` | admin | approve / reject / receive / refund |

---

## 11. Guarantees & known simplifications

**Guaranteed**
- No overselling (atomic decrement + oversell auto-refund).
- No duplicate live orders per cart (checkout idempotency + stale sweeper; unpaid Cashfree orders expire).
- No double refunds on a unit (returnedQuantity tracking).
- No double restock (webhook reconciliation is idempotent vs app-handled refunds).
- Status can't lie: money-states only via cancel/refund, not the status endpoint.

**Simplifications (future work)**
- Return refunds cover item value only (not a proportional share of shipping/tax).
- Partial-refund status stays `paid` (no `partially_refunded` status).
- Return requests are approved as a whole (no per-item partial approval).
