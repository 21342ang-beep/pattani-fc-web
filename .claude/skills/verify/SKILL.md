---
name: verify
description: Build, run, and drive the Pattani FC ticket app (Next.js 16 + Prisma + Payload) to observe a change working end-to-end.
---

# Verify — ticket-online

Next.js 16.2.9 (Turbopack, App Router) + Prisma/Postgres + Payload CMS.
Env comes from `.env.local` then `.env` (both loaded; local wins). Postgres runs
on `localhost:5435/pattani_ticket`.

## Get a handle

A dev server is often **already running on :3000** from the user's own terminal.
Starting a second one fails with `Another next dev server is already running` —
check first and just reuse :3000, since it serves the same working tree via HMR.

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/   # already up?
npx next dev -p 3100 > dev.log 2>&1 &                             # only if not
```

`npx tsc --noEmit` may report a stale `.next/types/validator.ts` error naming a
route you just moved or deleted. It clears on rebuild — not a real failure.

## Auth: minting a session

Login is a **server action**, so curl can't drive it easily. Mint the session JWT
directly instead — this is setup, then drive real HTTP with the cookie.

Session cookie is `session`, an HS256 JWT signed with `SESSION_SECRET`
(`src/lib/session.ts`), payload `{ userId, role, expiresAt }`. Role must be
`ADMIN` or `SUPER_ADMIN` to pass `verifyAdmin`; per-section access is
`verifyPermission(<PERM>)` reading `user.permissions` **from the DB**, so
permissions can be changed without re-minting.

Scripts using `jose`/`@prisma/client` must live **inside the repo** (a scratchpad
path can't resolve node_modules). Write `./_verify-*.mjs`, run, then delete:

```bash
npx tsx --env-file=.env --env-file=.env.local ./_verify-mint.mjs
curl -s -H "Cookie: session=$TOKEN" http://localhost:3000/admin/bookings
```

Node resolves `/tmp` as `C:\tmp` on Windows even though bash doesn't — pass
absolute Windows paths to `node -e`, or keep temp files in the repo and delete them.

## Calling server actions over HTTP

Needed when the surface is an action, not a page. Get the **real** action id from
the built chunks — the 40-hex id on the page HTML may belong to a different
action entirely (`logout` sits on every admin page and will silently log you out):

```bash
grep -rhoE '__next_internal_action_entry_do_not_use__ \[\{[^]]*"<fnName>"[^]]*\]' \
  .next/dev/server/chunks/ssr/*.js | head -1
```

For an action like `lookupBooking(prevState, formData)`, encode the FormData arg
as `$K1` with fields prefixed **`_1_`** (`<formFieldPrefix>_<key>_<field>`):

```bash
curl -s -X POST http://localhost:3000/admin/bookings/check \
  -H "Cookie: session=$TOKEN" \
  -H "Next-Action: 6060622ed1814246089ef40ce730f9dcbdd1c081a3" \
  -F "_1_bookingCode=$CODE" -F '0=["$undefined","$K1"]'
```

Wrong field prefix → `formData.get()` returns null. Several actions return the
**same generic message for a validation failure and a genuine not-found**
(anti-enumeration), so a bad payload looks exactly like a correct negative
result. Always confirm the happy path returns real data before trusting a
"not found" as evidence.

Read `x-action-redirect` / the `1:{...}` body line for the outcome.

## Test data

The dev DB is usually seeded with matches but **zero bookings**. Create what you
need, tag it, and delete it after:

```js
await prisma.booking.create({ data: { matchId, customerName: "ทดสอบ ระบบ",
  customerPhone: "0812345678", quantity: 2, totalAmount: 30000,
  status: "CONFIRMED", notes: "VERIFY-TEMP — delete after verification" } })
```

Then `deleteMany({ where: { notes: "VERIFY-TEMP — delete after verification" } })`
and re-count to prove you left the DB as you found it.

## Playwright

Not installed. No browser driving available — verify via curl + HTML/RSC
assertions, or install it if you truly need pixels.
