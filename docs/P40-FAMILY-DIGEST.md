# P40 — Family Digest (C6)

**Step ID:** `P40-FAMILY-DIGEST`
**Flag:** `enable_family_digest` (default **off**)
**District plan:** C6

Weekly guardian email — wins first, then the upcoming week — in the
guardian's language, riding the existing family-sharing relationship.

## Consent model

- Rides `flux_parent_links` (P7-PARENT). The **student owns the link rows**,
  so opting in, language (en/es/fr), channel, and categories are entirely
  student-controlled from Settings → Family sharing.
- Defaults are conservative: opt-in **off**; categories `wins` + `upcoming`
  only. **Grades are never included at any setting.**
- Every generated digest is recorded in `flux_family_digests` — the student
  can read exactly what was shared about them, week by week.

## Architecture

- **Columns:** `flux_parent_links.digest_opt_in / digest_language /
  digest_channel / digest_categories` (migration
  `20260711100000_family_digest.sql`, reversible).
- **Cron:** `supabase/functions/family-digest` (daily-briefing pattern:
  CRON_SECRET/service-role gate, `user_data` blob math, paged batch,
  idempotent upsert per link+week). Flag registry acts as the server-side
  kill switch. Email via Resend when `RESEND_API_KEY` is set; otherwise
  digests are rendered + recorded (`status='rendered'`).
- **Digest math:** wins = completed tasks last 7d + focus sessions;
  upcoming = open tasks next 7d, est hours, assessment count. Calm copy
  ("a lighter week"), i18n dict en/es/fr (extensible).
- **Client:** `flux-parent-portal.js` (canonical family-sharing owner)
  gains a flag-gated digest block per ACTIVE link; saves on change;
  `family_digest_prefs_changed` telemetry (payload-free).

## QA

`docs/QA_MATRIX.md` §0aq. E2E: `e2e/family-digest.spec.ts` 3/3
(conservative defaults + honest copy, flag-off empty, pending links
excluded). RLS: `docs/RLS_AUDIT.md` §15.

## Dev enable

```javascript
window.FLUX_EXPERIMENTS = { enable_parent_portal: true, enable_family_digest: true };
await FluxFeatureFlags.load({ force: true });
FluxParentPortal.renderStudentSettings();
```

Cron (one-time, after deploy): schedule a weekly pg_cron → pg_net POST to
`/functions/v1/family-digest` with the `x-cron-secret` header, mirroring
the daily-briefing schedule.

## Rollback

Disable the flag: the settings block disappears AND the cron self-skips
(`skipped: flag_off`) even if still scheduled — no sends. Columns/rows drop
via the migration rollback. Existing opt-ins are inert while the flag is
off and honored again if re-enabled.
