# P5-DISTRICT

**Step ID:** `P5-DISTRICT`  
**Flag:** `enable_district_rollup` (default **off**)

## Behavior

**District rollup** panel on the admin school dashboard — per-school aggregate counts across a district:

| Column | Source |
|--------|--------|
| Students / teachers / counselors / staff | `user_roles` matched by `school_slug` or school name |
| Active classes | `teacher_classes` for teachers at that school |
| District totals | Sum across schools |

### Schema

| Table / column | Purpose |
|----------------|---------|
| `flux_districts` | District registry |
| `flux_schools.district_slug` | School → district link |
| `user_roles.school_slug` | User → school link (backfilled from name) |
| `flux_district_admins` | Explicit district-wide admin grants |

### Access (RLS via RPC)

`flux_district_rollup_metrics()` allows:

- Users in `flux_district_admins` for that district
- School `admin` / `staff` whose school maps to the district (auto-resolve)
- Global `admin` role

Returns `{ forbidden }` otherwise. **No student names or row-level PII.**

## Modules

| File | Role |
|------|------|
| `public/js/flux-district-rollup.js` | RPC load + render table |
| `public/css/flux-district-rollup.css` | Rollup panel styles |
| `supabase/migrations/20260525330000_district_rollup.sql` | Schema + RPC + flag |

## Enable (dev)

```javascript
window.FLUX_EXPERIMENTS = { enable_district_rollup: true };
await FluxFeatureFlags.load({ force: true });
renderAdminDashboard();
```

Grant district admin (optional):

```sql
INSERT INTO flux_district_admins (user_id, district_slug)
VALUES ('<admin-uuid>', 'bloomfield');
```

## Rollback

Disable flag; panel hidden. Schema columns/tables remain.
