# Flux Planner — Gemini / agent handoff (IAE stabilization)

**Date:** 2026-05-21  
**Repo:** Flux Planner (`main`)  
**School:** International Academy East (Bloomfield) — `scripts/staff-import-ia-east.jsonl`

This document captures root causes, fixes shipped or in-flight, and what ops still run on production.

---

## Priority summary

| Task | Status | Notes |
|------|--------|-------|
| **A — Principals** | Ops only | Patrick Griffin `pgriffin@bloomfield.org`, Gabrielle Naus `gnaus@bloomfield.org` (Gaby) already in JSONL as `admin`. Run `seed-staff-directory.mjs` + `create-staff-accounts.mjs` on prod. |
| **B — Dashboard routing** | Code done | `fluxRouteAfterAuth`, `fluxNeedsRolePicker` trusts `user_roles` / `FluxRole.profile`, duplicate sign-in nav removed. |
| **C — Counselor availability** | Code + migration | `20260533700000_counselor_availability_student_read.sql`, slot sync + local-date booking in JS. |
| **D — Email dedupe** | Code done | Fuzzy `ilike` last-name claim removed; strict email via `ensureCounselorRecord()`. |
| **Liquid glass** | Removed | `109803a` — do not reintroduce. |

---

## Task A — Principals (no code change)

1. `node scripts/seed-staff-directory.mjs scripts/staff-import-ia-east.jsonl` (service role env).
2. `node scripts/create-staff-accounts.mjs` (or your prod auth invite flow).
3. Confirm `user_roles.role = 'admin'` for Griffin + Naus after first sign-in.

---

## Task B — Post-login routing (returning staff / blank UI)

### Symptom

Returning accounts and users **just approved as staff** sometimes stay on the student shell or see a blank main area. Duplicate `nav()` blocks in sign-in vs `detectUserRoleAndRoute` fought each other; local `flux_role_setup_v1_*` cache could override a real `user_roles` row.

### Fix (in `public/js/app.js`)

1. **`fluxNeedsRolePicker(userId)`** — Returns `false` when `FluxRole.profile` matches `user_id`, when `user_roles` is loaded (not `_fromLocalSetup`), or when `FluxRole.current` is already an educator role.

2. **`fluxRouteAfterAuth(reason)`** — Single post-auth path:
   - `FluxRole.load()`
   - Force **work** mode on `sign-in`, `verification`, `detectUserRoleAndRoute`
   - `applyRoleUI()` + mode switch + impersonation chrome
   - Educators → `fluxRouteEducatorHome()`
   - Pending staff meta → staff personal dashboard
   - Students → dashboard + assignments + `renderMyCounselorSection()`
   - Counselors in work mode → `ensureCounselorRecord()`

3. **Sign-in** (~10971) — Only `await fluxRouteAfterAuth('sign-in')` (duplicate nav removed).

4. **`detectUserRoleAndRoute`** — Ends with `await fluxRouteAfterAuth('detectUserRoleAndRoute')` (no trailing nav block).

5. **`FluxStaffPlatform.maybeApplyApprovedStaffVerification`** — On upgrade, `await fluxRouteAfterAuth('verification')` (also in `flux-staff-platform.js` `listenForApproval`).

### Verify

- Approve a pending staff user while they are logged in → workboard / role dashboard without hard refresh.
- Returning counselor/teacher → correct work nav, not student tabs.
- Ctrl/Cmd+K work/personal still works after routing.

See also `docs/P1-ROLE-ROUTING.md`.

---

## Task C — “No open slots” for students

### Root causes

1. **JSON-only saves** — Counselor onboarding (`saveCounselorAvailability_andNext`) updated `counselors.availability` but not `counselor_availability_slots`. Student booking reads the slots table first.

2. **Day key mismatch** — JSON keys like `Monday` vs table `monday` → filter returned zero rows; JSON fallback also failed.

3. **UTC date strings** — `toISOString().slice(0,10)` shifted calendar day near timezone boundaries → wrong weekday → no slots.

4. **RLS** — Policy was already `authenticated` + `is_available = true`; migration scopes reads to **active** counselors and backfills slots from JSON.

### Fix

**Migration:** `supabase/migrations/20260533700000_counselor_availability_student_read.sql`

- Normalize `day_of_week` and `counselors.availability` keys to lowercase.
- Backfill `counselor_availability_slots` from JSON.
- Refresh `cas_public_read` (active counselor + `is_available`).

**JS:**

- `fluxUpsertCounselorAvailabilitySlots()` in `app.js` — shared upsert from availability map.
- Onboarding save calls upsert after JSON update.
- `flux-educator-platform-extras.js` — `fluxNormDayKey`, `fluxLocalDateStr`, `fluxAvailTimesForDay`; booking modal uses local dates; workboard save syncs slots.

### Apply on prod

```bash
supabase db push
```

Or paste the migration file into Supabase SQL Editor (full file, not the CLI command).

### Verify

1. Counselor: Workboard → Edit availability → Save.
2. Student: Profile → My counselor → Book → dates with slot counts (not “No open slots”).
3. SQL: `select day_of_week, count(*) from counselor_availability_slots where counselor_id = '<id>' group by 1;` — all lowercase weekdays.

---

## Task D — Duplicate counselor accounts (email only)

### Removed

- Fuzzy `counselors` update `.ilike('name','%lastName%')` in `detectUserRoleAndRoute` (already gone) and **`commitEducatorRoleFromUpgrade`** (student → school workspace upgrade).

### Canonical path

**`ensureCounselorRecord(sb, roleHint)`**

1. Active row by `user_id`
2. Claim orphan row by **exact email** (`counselors_claim_email` policy)
3. Insert new row if needed
4. `deactivateExtraCounselorRows` keeps one active row per auth user

**`fluxIsBookableCounselorEmail`** — Skips platform owner email for counselor picker/booking.

### DB already applied (reference)

- `20260533500000_dedupe_counselor_accounts.sql` — merge demo placeholders → Bloomfield emails.
- `20260533600000_remove_platform_owner_counselor.sql` — deactivate owner counselor row.

Demo seed emails in migrations now use real IAE addresses (`wbernstein@`, `aphelps@`, etc.).

---

## Key files

| Area | Path |
|------|------|
| Role routing | `public/js/app.js` — `FluxRole`, `fluxRouteAfterAuth`, `detectUserRoleAndRoute`, sign-in block ~10735+ |
| Staff approval | `public/js/flux-staff-platform.js` |
| Staff directory | `public/js/flux-staff-directory.js`, `scripts/staff-import-ia-east.jsonl` |
| Booking UI | `public/js/flux-educator-platform-extras.js` (`openBookAppointmentModal`) |
| Counselor record | `public/js/app.js` — `ensureCounselorRecord`, `fluxUpsertCounselorAvailabilitySlots` |
| RLS / QA | `docs/RLS_AUDIT.md`, `docs/QA_MATRIX.md` §0e |
| Roadmap | `docs/ROADMAP.md`, `docs/PHASE_7_CLOSEOUT.md` |

**Owner email (not a counselor):** `OWNER_EMAIL = 'azfermohammed21@gmail.com'` in `app.js`.

---

## Git / deploy notes

- Recent pushes: counselor dedupe (`e0a9b11`), liquid glass removal (`109803a`).
- Stabilization B/C/D changes may be **uncommitted** until you ask for commit/push.
- Do not commit `.env` or service-role keys.

---

## Suggested QA pass (5 min)

1. Staff approved realtime → counselor or teacher work dashboard.
2. Student books counselor slot after counselor saves availability.
3. Counselor picker shows one row per Bloomfield counselor (no demo duplicates).
4. Owner account does not appear as bookable counselor.

---

## If something still breaks

- **Routing:** Console `[Flux] fluxRouteAfterAuth`; check `user_roles` row and `FluxRole.profile.user_id`.
- **Slots empty:** Inspect `counselor_availability_slots` + `counselors.availability` for same `counselor_id`; confirm migration applied.
- **RLS errors:** Run `docs/P1-RLS-VERIFICATION.md` / `supabase/scripts/verify_rls_policies.sql`.
