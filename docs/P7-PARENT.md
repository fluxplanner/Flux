# P7-PARENT

**Step ID:** `P7-PARENT`  
**Flag:** `enable_parent_portal` (default **off**)

Parent/guardian visibility via **invite codes** and **student-controlled tiers** — aggregates only (wellness snapshots), no task titles, grades, or messages.

## Flow

1. **Student** (Settings → Account → Family sharing): creates an 8-character invite code and picks **Engagement** or **Wellness** tier.
2. **Parent** signs in, opens **Family** tab, enters the code.
3. Parent sees snapshot table (mood, stress, load, momentum by date) when the student has wellness check-in data.

## Tiers

| Tier | Parent sees |
|------|-------------|
| `basic` | Last 3 wellness snapshot rows (aggregates) |
| `wellness` | Last 14 snapshot rows |
| `none` | Link active but no metrics |

## Modules

| File | Role |
|------|------|
| `public/js/flux-parent-portal.js` | UI + RPC calls |
| `public/css/flux-parent-portal.css` | Portal + settings styles |
| `supabase/migrations/20260525440000_parent_portal.sql` | `flux_parent_links`, RPCs, RLS |

## Enable (dev)

```javascript
window.FLUX_EXPERIMENTS = { enable_parent_portal: true };
await FluxFeatureFlags.load({ force: true });
FluxParentPortal.install();
```

Student: Settings → Account → create invite.  
Parent: **Family** nav → claim code.

## Rollback

Disable flag; links remain in DB but UI and RPCs are unused.
