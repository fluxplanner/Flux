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

## Rollback

RLS changes ship as **new** migrations with `DROP POLICY IF EXISTS` + `CREATE POLICY`. Revert = new migration restoring old policy **only** if legally required; prefer forward fix.
