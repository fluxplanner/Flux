# Flux Planner — RLS & policy audit (codebase / migrations)

**Scope:** Policies as defined in `supabase/migrations/` in this repo. **Live Supabase may differ** — diff against the dashboard before production changes.

---

## 1. `user_roles` — HIGH PRIORITY

**Migration:** `20260513120000_educator_platform.sql`

| Policy | Action | USING / WITH CHECK | Risk |
|--------|--------|---------------------|------|
| `roles_select_own` | SELECT | `auth.uid() = user_id` | OK |
| `roles_select_educators` | SELECT | `role IN ('teacher','counselor','staff','admin')` on **the row** | **Any authenticated user can SELECT every educator row** (student enumerates all teachers). Verify intent; likely should be **removed or replaced** with scoped policy (e.g. same school only) or dropped if unused. |
| `roles_insert_own` | INSERT | self | OK |
| `roles_update_own` | UPDATE | self | OK |

**Recommendation:** In a **new** migration: drop `roles_select_educators` unless product explicitly needs a public educator directory via this table; if needed, gate by `school` or a join table.

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
- [ ] **user_roles** educator enumeration fixed or accepted as product decision.  
- [ ] Owner-only policies match **production** owner email if changed.

---

## Rollback

RLS changes ship as **new** migrations with `DROP POLICY IF EXISTS` + `CREATE POLICY`. Revert = new migration restoring old policy **only** if legally required; prefer forward fix.
