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

**Other migrations on this table:** `roles_platform_owner_update` in `20260518220000_staff_platform_v1.sql` (owner email) — unchanged.

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

---

## 6. Staff platform (`20260518220000_staff_platform_v1.sql`)

| Table | Notes |
|-------|------|
| `staff_verification_requests` | Owner email hardcoded for moderation — OK for single-tenant owner; bad for forks |
| `staff_directory` | Authenticated read active; claim UPDATE | OK |
| `staff_personal_data` | own user only | OK |
| `school_feed` | read with expiry; insert for educators; owner delete | OK |
| `meeting_notes`, `professional_development` | own rows | OK |

---

## 7. Billing / usage

See `20260425120000_billing_entitlements.sql`, `20260514130000_check_and_increment_usage.sql` — audit separately against Edge Functions.

---

## 8. Verification checklist (manual / SQL)

- [ ] Student A **cannot** `select * from teacher_classes` for classes they did not join.  
- [ ] Student A **cannot** read Student B’s `student_completions`.  
- [ ] Teacher T **cannot** update assignments of teacher U.  
- [x] **user_roles** educator enumeration — addressed by `20260519120000_user_roles_select_tighten.sql` (replaces `roles_select_educators` with scoped policies; verify on staging).  
- [ ] Owner-only policies match **production** owner email if changed.

---

## Rollback

RLS changes ship as **new** migrations with `DROP POLICY IF EXISTS` + `CREATE POLICY`. Revert = new migration restoring old policy **only** if legally required; prefer forward fix.
