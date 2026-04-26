# Flux Planner — Billing Setup

## Architecture

- Stripe for payments (Checkout + Billing Portal + Webhooks)
- Supabase `subscriptions` table as server-side source of truth
- Edge Functions handle all Stripe communication
- Client never handles payment data directly

## Environment Variables (set in Supabase Edge Functions → Manage Secrets)

| Variable | Description | Where to get it |
|----------|---------------|-----------------|
| STRIPE_SECRET_KEY | Stripe API secret key | Stripe Dashboard → Developers → API Keys |
| STRIPE_WEBHOOK_SECRET | Webhook signing secret | Stripe Dashboard → Webhooks → endpoint → signing secret |
| STRIPE_PRICE_ID | Price ID for $2.99/month | Stripe Dashboard → Products |
| PAYMENTS_ENABLED | Set to `true` to activate billing | Manual — you control this |
| SUPABASE_SERVICE_ROLE_KEY | Service role key for admin DB operations | Supabase → Settings → API |
| SUPABASE_URL | Project URL | Supabase → Settings → API |
| SUPABASE_ANON_KEY | Anon key (JWT verification in Edge Functions) | Supabase → Settings → API |
| GROQ_API_KEY | Groq API key | Groq Cloud console |
| GEMINI_API_KEY | Gemini API key (vision in `ai-proxy`) | Google AI Studio |

## Activating Payments

When ready to go live:

1. Set `PAYMENTS_ENABLED = 'true'` in Supabase Edge Function secrets
2. In `public/js/app.js`, set `FLUX_FLAGS.PAYMENTS_ENABLED = true`
3. Gradually enable individual flags:
   - `SHOW_PRO_BADGE = true` — shows upgrade CTA
   - `SHOW_PRICING_PAGE = true` — shows pricing page
   - `SHOW_UPGRADE_PROMPTS = true` — shows feature prompts
   - `ENFORCE_AI_LIMITS = true` — starts enforcing AI limits
   - `ENFORCE_CANVAS_GATE = true` — gates Canvas sync
   - `ENFORCE_SCHEDULE_IMPORT_GATE = true` — gates schedule import
   - `ENFORCE_EXPORT_GATE = true` — gates CSV / iCal export
   - `ENFORCE_GCAL_PUSH_GATE = true` — gates Google Calendar push
   - `ENFORCE_TASK_LIMITS = true` — gates task count (most aggressive, enable last)

## Database

Apply the SQL in `supabase/migrations/20260425120000_billing_entitlements.sql` via Supabase SQL Editor (or `supabase db push` if linked).

## Testing with Stripe CLI

```bash
brew install stripe/stripe-cli/stripe
stripe login
stripe listen --forward-to https://lfigdijuqmbensebnevo.supabase.co/functions/v1/stripe-webhook
stripe trigger checkout.session.completed
stripe trigger customer.subscription.updated
stripe trigger invoice.payment_failed
```

## Test Cards (Stripe test mode)

- Success: 4242 4242 4242 4242
- Decline: 4000 0000 0000 0002
- Requires auth: 4000 0025 0000 3155
- Past due: 4000 0000 0000 9995

## Price

$2.99/month — configurable via `STRIPE_PRICE_ID` env var. Client copy references the same amount; change Stripe price + env when you change pricing.

## Trial

30 days free, no credit card. Implemented via database trigger that creates a `subscriptions` row with `status = 'trialing'` and `trial_ends_at = NOW() + 30 days` for every new `auth.users` row. Edge `getEntitlement` / `_shared/plan.ts` treat active trialing window as Pro limits. After trial expires, entitlement resolves to Free limits.

## Tester Accounts

Add email addresses to `flux_tester_emails` in localStorage (owner tooling). Those users get `TESTER_MODE` and client-side Pro bypass when payments are enabled.
