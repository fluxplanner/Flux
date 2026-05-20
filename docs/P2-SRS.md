# P2-SRS

**Step ID:** `P2-SRS`  
**Flag:** `enable_srs_v2` (default **off**)

## Behavior

| Area | v2 (flag on) | Legacy (flag off) |
|------|----------------|-------------------|
| Schedule trigger | On parent task **complete** (unchanged) | Same |
| Base date | **Completion day** (not original due date) | Original due date |
| Deduping | Skips intervals already scheduled (`srsParentId` + `srsIntervalDays`) | May duplicate on re-complete |
| Review fields | `srsParentId`, `srsStage`, `srsIntervalDays`, `srsReviewsScheduled` | `srsReview`, `cogLoadWeight` only |
| Card UI | Badges (today / soon / overdue) + `srs-review` class | `srs-review` class only if manually styled |
| Dashboard | **N reviews due** chip when reviews are due/overdue | — |
| Telemetry | `srs_reviews_scheduled`, `srs_review_completed` (with `enable_event_bus`) | — |

Intervals: **1, 7, 30** days after completion.

## Modules

| File | Role |
|------|------|
| `public/js/flux-srs-v2.js` | Schedule, badges, due chip, bus hooks |
| `public/css/flux-srs-v2.css` | Badge + chip styles |
| `public/js/flux-telemetry.js` | Persisted event normalizers |
| `supabase/migrations/20260525170000_enable_srs_v2_flag.sql` | Flag seed |

## Enable (dev)

```javascript
window.FLUX_EXPERIMENTS = { enable_srs_v2: true, enable_event_bus: true };
await FluxFeatureFlags.load({ force: true });
FluxSrsV2.install();
// Add task with SRS checked → complete it → 3 review tasks appear
```

## Rollback

Disable flag; legacy `generateSRSReviews` runs. Existing review tasks remain in `tasks`.
