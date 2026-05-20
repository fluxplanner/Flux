# P1-RLS — Verification guide

**Step ID:** `P1-RLS`  
**Goal:** Confirm production Supabase matches repo migrations and educator RLS cannot leak cross-teacher or cross-student data.

## 1. Migrations applied

All local migrations through `20260524130000_rls_audit_sweep.sql` must show on remote:

```bash
supabase migration list --linked
```

Local and remote columns should match (no pending rows).

## 2. Automated policy checks (SQL Editor)

Run [`supabase/scripts/verify_rls_policies.sql`](../supabase/scripts/verify_rls_policies.sql):

| Check | Expected |
|-------|----------|
| Legacy policy query | **0 rows** (`roles_select_educators`, `classes_teacher_all`) |
| `teacher_classes` policies | `classes_teacher_select`, `classes_teacher_insert`, `classes_teacher_update`, `classes_teacher_delete`, `classes_student_read`, `classes_admin_read` |
| `user_roles` policies | No `roles_select_educators`; has `roles_select_educators_same_school`, scoped student/teacher policies |

## 3. Admin health RPC (in app)

As a user with `user_roles.role = 'admin'`:

```javascript
const { data } = await getSB().rpc('flux_rls_health_snapshot');
console.log(data);
```

Expect `ok: true`, `legacy_roles_select_educators: false`, `legacy_classes_teacher_all: false`.

## 4. Manual QA (required once per release)

Use two student accounts + two teacher accounts on staging or production:

| Test | Pass criteria |
|------|----------------|
| Student A class list | Only classes joined via code / enrollment |
| Teacher T dashboard | Only T's `teacher_classes` rows |
| Teacher T vs U | T cannot open U's class by UUID in API |
| Join preview | Teacher name shows without `user_roles` error (uses RPC `teacher_display_name`) |
| Student completions | B cannot read A's completions |

Mark [`docs/RLS_AUDIT.md`](./RLS_AUDIT.md) checklist when done.

## 5. Rollback

- Forward-only migrations; revert via new migration restoring policies only if legally required.
- Emergency: disable educator panels via `flux_feature_flags` while fixing.

## Status

- [ ] Migrations synced (`migration list`)
- [ ] SQL script run — legacy policies absent
- [ ] Manual QA matrix (4-role smoke)
- [ ] `docs/RLS_AUDIT.md` §8 checkboxes updated
