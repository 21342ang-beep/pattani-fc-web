This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Beam PromptPay

Match-ticket and season-pass checkout create QR PromptPay charges through Beam's
server-side Charge API. Configure all three server-only values:

```dotenv
BEAM_MERCHANT_ID="..."
BEAM_API_KEY="..."
BEAM_WEBHOOK_HMAC_KEY="..."
```

The QR creation endpoint is `POST /api/payments/beam/create`; it uses a unique
Beam idempotency key and stores the pending charge so refreshing the checkout
does not create another QR. The checkout polls `/api/payments/beam/status`, while
the signed webhook remains the authority that confirms an order.

### Webhook

The Beam callback endpoint is `POST /api/payments/beam/webhook`. In Beam
Lighthouse, configure the production URL as:

```text
https://pattanifc.co/api/payments/beam/webhook
```

Subscribe to `payment_link.paid` and `charge.succeeded`, then copy the generated
base64 HMAC key into the server-only environment variable below. Never expose it
through a `NEXT_PUBLIC_` variable.

Payment links/charges must use one of these `referenceId` formats, and the Beam
amount (the currency's smallest unit) must equal the pending order total:

```text
booking_<bookingCode>[_<uniqueSuffix>]
season_<passCode>[_<uniqueSuffix>]
```

The handler verifies `X-Beam-Signature` against the exact raw request body before
processing either event. Repeated events are safe: only a matching `PENDING`
record can transition to `CONFIRMED`.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
