# P41 — Chromebook-grade PWA push (C7)

**Step ID:** `P41-WEB-PUSH`
**Flag:** `enable_web_push` (default **off**)
**District plan:** C7

Due-soon Web Push reminders for the installed PWA, riding B5.4's hashed-
bundle precache work (offline-first shell, navigation preload).

## Architecture

- **Table:** `push_subscriptions` (owner-only RLS) — standard VAPID
  subscription fields, one row per device; dead endpoints pruned by the
  sender. Migration `20260711110000_web_push.sql`, reversible.
- **Service worker:** `push` + `notificationclick` handlers appended to the
  B5.4 worker (calm default copy, tag-coalesced, focuses an existing app
  window before opening a new one). Caching strategies untouched.
- **Sender:** `supabase/functions/notify-push` on an hourly scheduler —
  CRON_SECRET/service-role gate, flag-registry kill switch, at most ONE
  reminder per user per run (tasks due today/tomorrow). Server-enforced
  policy: `settings.notifyDueSoon`, quiet hours (`settings.quiet` +
  dndStart/dndEnd in `PUSH_TZ`, default America/Detroit), hard 21:00–07:00
  overnight suppression. Uses `npm:web-push` with VAPID env keys.
- **Client:** `flux-web-push.js` — Settings card with one switch;
  subscribe = permission → PushManager → owner-only upsert; opt-out
  unsubscribes AND deletes the row. VAPID public key from
  `window.FLUX_VAPID_PUBLIC_KEY` (set at deploy). Graceful paths for
  unsupported browsers / missing keys / denied permission.

## Deploy notes

1. `npx web-push generate-vapid-keys`; set `VAPID_PUBLIC_KEY`,
   `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` as function secrets; embed the
   public key as `window.FLUX_VAPID_PUBLIC_KEY` in `index.html`.
2. Schedule hourly pg_cron → pg_net POST to `/functions/v1/notify-push`
   with the `x-cron-secret` header.
3. Cold-start measurement for the district PR: installed-PWA trace on a
   4GB Chromebook (target < 2s) — record in `docs-internal/CHANGELOG.md`
   alongside the B5 Lighthouse numbers.

## Telemetry

`web_push_opt_in` (student, persist, no payload).

## QA

`docs/QA_MATRIX.md` §0ar. E2E: `e2e/web-push.spec.ts` 4/4 (card + honest
copy, unsupported path, keyless failure, flag-off residue). RLS §16.

## Dev enable

```javascript
window.FLUX_EXPERIMENTS = { enable_web_push: true };
await FluxFeatureFlags.load({ force: true });
FluxWebPush.injectCard();
```

## Rollback

Disable the flag: the card disappears and notify-push self-skips
(`flag_off`) even if still scheduled — no sends. Existing subscriptions
stay in the table but are never used; drop via migration rollback to purge.
