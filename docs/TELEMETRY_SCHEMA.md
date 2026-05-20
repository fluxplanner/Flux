# Flux product telemetry schema (v1)

**Machine catalog:** `public/js/flux-telemetry.js` (`FluxTelemetry.CATALOG`)  
**Storage:** `public.flux_product_events` (flag `enable_event_bus`, default off)  
**Privacy review date:** 2026-05-19

## Principles

| Rule | Implementation |
|------|----------------|
| No free-text PII | Task titles, notes, emails, tokens stripped by normalizers + `FORBIDDEN_KEYS` |
| Aggregates preferred | Momentum = count; sessions = mins + optional subject label (max 64 chars) |
| Opt-in server write | `enable_event_bus` must be true |
| User owns rows | RLS insert/select own; admin read for ops |
| Append-only | No client updates/deletes |

## Persisted events (v1)

| Event | Category | Payload fields | Emitted when |
|-------|----------|----------------|--------------|
| `sign_in` | platform | `via`, `schema_version` | Event bus installed with flag on |
| `task_completed` | student | `task_id`, `subject`, `priority`, `est_mins` | Task marked done |
| `session_ended` | student | `mins`, `date`, `hour`, `subject` | Pomodoro / focus timer completes |
| `momentum_update` | student | `count` (0–99) | Momentum counter changes on task complete |
| `school_joined` | school | `school`, `short_name` | School registry join success |
| `class_joined` | school | `class_code`, `class_id` | Student class join RPC success |
| `role_mode_changed` | educator | `mode` (`work`\|`personal`), `role` | Educator mode toggle |
| `srs_reviews_scheduled` | student | `parent_id`, `count`, `intervals[]`, `subject` | SRS v2 created review tasks |
| `srs_review_completed` | student | `parent_id`, `stage`, `interval_days`, `subject` | SRS review task marked done |
| `predict_insight_shown` | intelligence | `kind`, `at_risk_count`, `overload_level`, `slot_count`, `cognitive_score` | Predict v2 panel or gap-fill rendered |
| `client_error` | platform | `kind`, `message`, `source`, `line`, `col` | JS error / unhandled rejection when `enable_client_error_reporting` + `enable_event_bus` |

## Explicitly excluded from payloads

- User email, display name, OAuth tokens  
- Task / note / message body text  
- Student notes on class join  
- Full planner export blobs  
- IP, device fingerprint (not collected client-side)  
- Full stack traces (client ring may hold more locally; server gets scrubbed message + basename only)

## Bus-only (not persisted)

Same event names may fire on `FluxBus` for UI; only normalized rows above are queued for Supabase.

## Adding an event

1. Add row here + entry in `FluxTelemetry.CATALOG` with `normalize()`.  
2. Privacy review checkbox in PR description.  
3. QA row in `docs/QA_MATRIX.md` §7.  
4. Do **not** enable `enable_event_bus` globally until smoke-tested.

## Rollback

Disable `enable_event_bus` (default). Catalog changes are client-only; old rows remain valid JSON.
