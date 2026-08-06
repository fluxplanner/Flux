# Phase C — Go-live runbook (prod-specific)

**Project:** FluxPlanner · ref `lfigdijuqmbensebnevo` · org `rcksxgqpdqmphcsfcvtt`
**Pilot school_key:** `International Academy East` (matches `user_roles.school`)
**Applied:** 2026-07-23 — 15 migrations (14 feature + 1 anon-grant hardening), 2 edge functions.

## Already live
- **DB:** all Phase-C tables/RPCs/flags applied to prod; security advisor 0 errors; teacher RPCs revoked from `anon` (hardening migration `20260711160000`). `enable_originkit_motion` is global default `true` (motion is on for everyone, with reduced-motion/perf/lowend kill switches).
- **Edge functions:** `family-digest` + `notify-push` deployed, ACTIVE, `verify_jwt:false`, both return **401** unauthenticated (locked). Dormant until their flags + secrets exist.
- **IAE pilot (8 flags, need no secrets — enabled 2026-07-23):**
  `enable_now_engine`, `enable_seasons`, `enable_grade_gps`, `enable_ai_action_confirm`,
  `enable_study_rooms_v2`, `enable_sub_plans`, `enable_ask_teacher`, `enable_school_schedules`.

## Still gated (need your input) — 3 features

### 1. Web Push (`enable_web_push`) — needs VAPID
```bash
npx web-push generate-vapid-keys            # prints Public + Private key
```
- Supabase -> Edge Functions -> **Secrets**: set
  `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT=mailto:you@domain`, optional `PUSH_TZ` (default `America/Detroit`).
- Embed the **public** key for the client: in `index.html`, before the bundle `<script>` tags, add
  `<script>window.FLUX_VAPID_PUBLIC_KEY='<PUBLIC_KEY>';</script>` -> `npm run build:web` -> commit -> push.
- Then enable for IAE (SQL below).

### 2. Cron infra (both functions) — needs pg_cron + a shared secret
```sql
-- one-time, run in the Supabase SQL editor:
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
-- store the shared secret in Vault (must equal the CRON_SECRET function secret you set):
SELECT vault.create_secret('<RANDOM_CRON_SECRET>', 'flux_cron_secret');
```
Set the **same** value as a function secret `CRON_SECRET` (Edge Functions -> Secrets).
```sql
-- weekly family digest (Mon 07:00 UTC) and hourly push:
SELECT cron.schedule('flux-family-digest','0 7 * * 1', $$
  SELECT net.http_post(
    url:='https://lfigdijuqmbensebnevo.supabase.co/functions/v1/family-digest',
    headers:=jsonb_build_object('Content-Type','application/json',
      'x-cron-secret',(SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='flux_cron_secret')),
    body:='{}'::jsonb) $$);
SELECT cron.schedule('flux-notify-push','0 * * * *', $$
  SELECT net.http_post(
    url:='https://lfigdijuqmbensebnevo.supabase.co/functions/v1/notify-push',
    headers:=jsonb_build_object('Content-Type','application/json',
      'x-cron-secret',(SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='flux_cron_secret')),
    body:='{}'::jsonb) $$);
```
- `family-digest` emails only when `RESEND_API_KEY` (+ `DIGEST_FROM_EMAIL`) secrets are set; otherwise it renders + records (status `rendered`) and the in-app guardian surface still works.
- Both self-skip (`flag_off`) until their flag is enabled, so scheduling early is harmless.

### 3. Accommodation cards (`enable_accommodation_cards`) — coordinate first
Privacy feature; **supersedes** the P8.2 classroom cheat-sheet. IAE has `enable_classroom_tools` on — do a deliberate counselor onboarding and confirm the old cheat-sheet is retired before enabling (the client logs a warning if both run). Optional one-time data map in `docs/P39-ACCOMMODATION-CARDS.md`.

## Enable the remaining flags for IAE (after their prereqs)
```sql
INSERT INTO public.flux_school_feature_flags (school_key, flag_key, enabled, updated_at) VALUES
  ('International Academy East','enable_web_push',            true, now()),  -- after VAPID
  ('International Academy East','enable_family_digest',       true, now()),  -- after cron (+RESEND to email)
  ('International Academy East','enable_accommodation_cards', true, now())   -- after counselor onboarding
ON CONFLICT (flag_key, school_key) DO UPDATE SET enabled=EXCLUDED.enabled, updated_at=now();
```

## Rollback (any flag, instant, no residue)
```sql
UPDATE public.flux_school_feature_flags SET enabled=false, updated_at=now()
WHERE school_key='International Academy East' AND flag_key='<enable_...>';
```
Tables/functions can be dropped via the rollback statements in each migration header; localStorage stores go unconsulted when a flag is off.
