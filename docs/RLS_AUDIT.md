# Flux Planner — RLS & policy audit (codebase / migrations)

**Scope:** Policies as defined in `supabase/migrations/` in this repo. **Live Supabase may differ** — diff against the dashboard before production changes. The monolith **`PASTE-INTO-SUPABASE.sql`** part 1 **§11b** mirrors **`20260519120000_user_roles_select_tighten.sql`** (same `DROP`/`CREATE` order, idempotent).

---

## 1. `user_roles` — HIGH PRIORITY

**Original migration:** `20260513120000_educator_platform.sql` created `roles_select_educators` (over-broad).

**Fix migration:** `20260519120000_user_roles_select_tighten.sql` — drops `roles_select_educators` and adds:

| Policy | SELECT allowed when |
|--------|---------------------|
| `roles_select_own` | *(unchanged)* `auth.uid() = user_id` |
| `roles_select_educators_same_school` | Target row is educator role **and** viewer’s `user_roles.school` matches (non-empty, trimmed, lowercased). |
| `roles_select_students_i_teacher` | Target is `student` **and** viewer is their `teacher_students.teacher_id` (active). |
| `roles_select_students_i_counselor` | Target is `student` **and** viewer is their counselor (`student_counselors` or `counselor_appointments`). |
| `roles_select_as_admin` | Viewer’s own `user_roles.role = 'admin'` (school admin user manager / stats). |

**Product note:** Join-class **code preview** loads teacher `display_name` from `user_roles`; that still works if both accounts have **matching `school`** on `user_roles`, or use another path later (e.g. denormalize on `teacher_classes`). Students with **no** `school` set will not resolve educator rows via same-school policy.

**Other migrations on this table:** `roles_platform_owner_update` — v1 used hardcoded owner email; **`20260521130000_staff_platform_v2_fixes.sql`** uses `public.flux_is_platform_admin()` + `platform_admins` table.

---

## 2. Teacher / student data path (post lockdown)

**Migration:** `20260514120000_educator_rls_lockdown.sql`

| Table | Student access | Notes |
|-------|----------------|-------|
| `student_class_codes` | own rows | Subscription list for class codes |
| `teacher_classes` | SELECT if enrolled **or** code in `student_class_codes` | Replaces wide open read |
| `teacher_assignments` | same gate + `visible` | Scoped |
| `teacher_announcements` | via `class_id` in allowed classes | Scoped |
| `no_homework_days` | via class membership | Scoped |

**Teachers:** policies unchanged in spirit — `teacher_id = auth.uid()` for mutations.

---

## 3. `student_completions`

**Original migration:** students `FOR ALL` own rows; teachers SELECT/UPDATE via subquery on assignments they own.

**Risk:** Low if assignment RLS is correct; verify INSERT policy allows student to create completion only for visible assignments (check later migrations).

---

## 4. Messaging (`flux_threads`, `flux_messages`)

Participants only — **OK** for privacy between two users.

---

## 5. `counselors`

- `counselors_public_read`: all active rows visible to authenticated users (directory model).
- `counselor_self_provision.sql`: insert own row; claim by email when `user_id` null.

**Risk:** Directory exposure is intentional; PII in `bio` / `email` — acceptable only for school product context.

### `counselor_availability_slots`

- `cas_public_read` (**`20260533700000_counselor_availability_student_read.sql`**): authenticated SELECT where `is_available = true` and parent counselor `active`.
- `cas_counselor_all`: counselor owns row via `counselors.user_id = auth.uid()`.
- Client normalizes `day_of_week` to lowercase; backfill migration syncs JSON → slots.

---

## 6. Staff platform (`20260518220000_staff_platform_v1.sql`)

| Table | Notes |
|-------|------|
| `staff_verification_requests` | Owner moderation via `flux_is_platform_admin()` + `platform_admins` (v2) |
| `staff_tickets` | Same-school educator SELECT/UPDATE; **`staff_tickets_insert_strict`** (`created_by = auth.uid()`, educator role, non-empty `user_roles.school`); creator DELETE |
| `admin_duty_logs` | **`20260525100000_final_audit.sql`** — admin same-school SELECT; **`admin_duty_logs_insert_strict`** (`admin_id = auth.uid()`, school match); own UPDATE/DELETE |
| `staff_directory` | Authenticated read active; claim UPDATE | OK |
| `staff_personal_data` | own user only | OK |
| `school_feed` | read with expiry; insert for educators; owner delete | OK |
| `meeting_notes`, `professional_development` | own rows | OK |

---

## 7. Product events (`20260524140000_flux_product_events_skeleton.sql`)

| Table | Notes |
|-------|------|
| `flux_product_events` | Append-only telemetry; INSERT/SELECT own; admin SELECT all. Batch via `flux_record_product_events`. |

**Not** the same as calendar data in `localStorage` key `flux_events`.

---

## 8. Billing / usage

See `20260425120000_billing_entitlements.sql`, `20260514130000_check_and_increment_usage.sql` — audit separately against Edge Functions.

---

## 9. Verification checklist (manual / SQL)

Run **`docs/P1-RLS-VERIFICATION.md`** and **`supabase/scripts/verify_rls_policies.sql`** on production.

- [ ] Student A **cannot** `select * from teacher_classes` for classes they did not join.  
- [ ] Student A **cannot** read Student B’s `student_completions`.  
- [ ] Teacher T **cannot** update assignments of teacher U.  
- [x] **user_roles** educator enumeration — `20260519120000` + `20260524130000` drops legacy `roles_select_educators`.  
- [x] **teacher_classes** — split teacher policies + code-scoped student read (`20260523120000`, sweep `20260524130000`).  
- [ ] Owner-only policies match **production** owner email if changed.

---

## 10. Staff Productivity Suite (`20260528100000_staff_productivity_suite.sql`)

| Table | Who can read | Who can write |
|-------|----------------|---------------|
| `staff_student_accommodations` | Same-school educators; teachers need roster or counselor assignment to student | Author only (`author_id = auth.uid()`), educator same school |
| `staff_counselor_private_notes` | Owning counselor; school admin + `flux_is_platform_admin()` | Owning counselor only |
| `staff_parent_contact_logs` | Owner educator; counselors/admins same school | Insert as owner educator |
| `student_counselor_checkins` | Assigned counselor (via `counselors.user_id`); student read own | Student insert if `student_counselors` link exists |
| `counselor_referrals` | Owning counselor | Counselor insert/update; school admin SELECT same school |

**Personal Hub** (`FluxPersonalHub`) — no table; `localStorage` only.

---

## 11. AI proxy rate guard (`20260709110000_flux_ai_guard.sql`, P0 A5)

| Table | Who can read | Who can write |
|-------|----------------|---------------|
| `flux_ai_guard` | Nobody via PostgREST — RLS enabled with **no policies**; service role only (edge functions) | Service role only, through SECURITY DEFINER RPC `flux_bump_ai_guard` (EXECUTE revoked from `anon`/`authenticated`/PUBLIC) |

Buckets are hashed (`guest:<sha256(ip|ua|fingerprint)>`, `user:<uid>`); rows TTL-swept after 2 days inside the RPC. Probes: `select * from flux_ai_guard` as anon/authenticated must return zero rows / permission denied; `select flux_bump_ai_guard('x')` as anon/authenticated must fail.

---

## 12. District Schedule Authority (`20260710100000_school_schedules.sql`, C2)

| Table | Who can read | Who can write |
|-------|----------------|---------------|
| `flux_school_bell_schedules` | Same-school members (any authenticated user whose `user_roles.school` matches) | Same-school `admin` role only (FOR ALL + WITH CHECK) |
| `flux_school_calendar_days` | Same-school members | Same-school `admin` role only (FOR ALL + WITH CHECK) |

Probes: student of school A must not read school B's rows; student INSERT/UPDATE must fail; teacher/counselor writes must fail (admin only); user with blank `user_roles.school` reads zero rows.

---

## 13. Sub-Plan Generator (`20260710110000_sub_plans.sql`, C3)

| Table | Who can read | Who can write |
|-------|----------------|---------------|
| `flux_sub_plans` | Owner teacher only (no public SELECT policy — anonymous access exists solely through `flux_get_sub_plan(code)`) | Owner teacher only (FOR ALL + WITH CHECK) |
| `flux_sub_plan_views` | Owner teacher of the parent plan (audit trail) | Only inside the SECURITY DEFINER RPC (view audit rows) |

`flux_get_sub_plan(p_code)` — SECURITY DEFINER, granted to `anon` + `authenticated`; rejects codes <10 chars, returns `expired` after 48h `expires_at`, inserts an audit row (truncated user-agent) on every successful view. Probes: direct `select * from flux_sub_plans` as anon/another teacher returns zero rows; RPC with a wrong code returns `not_found` without an audit row; RPC after expiry returns `expired`.

---

## 14. Accommodation Cards (`20260711090000_accommodation_cards.sql`, C5)

| Table | Who can read | Who can write |
|-------|----------------|---------------|
| `flux_student_accommodations` | Same-school `counselor` role; the student (own rows only). **No teacher policy** — teachers go through the RPCs. | Same-school `counselor` role only (FOR ALL + WITH CHECK) |
| `flux_accommodation_audit` | The student (own trail); same-school counselors | Only inside the SECURITY DEFINER detail RPC |

RPCs (SECURITY DEFINER, `authenticated` only):
- `flux_teacher_accommodation_chips(class_code)` — rejects callers who don't own the active class; returns `[{kind, n}]` aggregates over the class roster — **no names, no notes**, private rows included in counts by design.
- `flux_teacher_accommodation_details(class_code)` — same ownership check; returns name+kind+note ONLY for `consent_state='staff_visible'` rows; inserts one audit row per returned accommodation (student-readable).

Probes: teacher direct `select` on the table returns zero rows; chips RPC with another teacher's class code returns `not_your_class`; details RPC never returns `consent_state='private'` rows; every details call with N consented rows adds N audit rows; student A cannot read student B's accommodations or audit trail; counselor of school X sees zero rows from school Y.

---

## 15. Family Digest (`20260711100000_family_digest.sql`, C6)

| Table | Who can read | Who can write |
|-------|----------------|---------------|
| `flux_parent_links` (+digest columns) | unchanged (P7-PARENT: student own rows; parent active link) | Student owns all digest prefs (existing `flux_parent_links_student_all`); parents cannot change them |
| `flux_family_digests` | Student (own digests — transparency); guardian of the ACTIVE link | Service role only (weekly cron); no authenticated write policies |

The `family-digest` edge function gates on CRON_SECRET/service-role, checks the flag registry as a kill switch, processes only `digest_opt_in = true` links, and never includes grades in any payload. Probes: parent cannot UPDATE digest prefs; revoked-link guardian reads zero digests; student sees exactly the payload rows generated about them; anon/authenticated INSERT into `flux_family_digests` fails.

---

## 16. Web Push (`20260711110000_web_push.sql`, C7)

| Table | Who can read | Who can write |
|-------|----------------|---------------|
| `push_subscriptions` | Owner only | Owner only (FOR ALL + WITH CHECK); sender runs service-role |

The `notify-push` function gates on CRON_SECRET/service-role, honors the flag-registry kill switch, enforces quiet hours (`settings.quiet` + DND window) and a hard 21:00–07:00 overnight suppression server-side, and prunes 404/410 endpoints. Probes: user A cannot read/delete user B's subscriptions; anon INSERT fails; unauthenticated POST to notify-push returns 401.

---

## Rollback

RLS changes ship as **new** migrations with `DROP POLICY IF EXISTS` + `CREATE POLICY`. Revert = new migration restoring old policy **only** if legally required; prefer forward fix.
