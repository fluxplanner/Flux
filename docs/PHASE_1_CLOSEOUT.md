# Phase 1 closeout — Stabilization & platform foundation

**Status:** Code + docs landed; **manual QA** still required before calling production “Phase 1 complete.”  
**Roadmap:** `docs/ROADMAP.md` steps **P1-RLS** through **P1-TELEMETRY**.

---

## Step index

| ID | Doc | Primary modules / migrations |
|----|-----|------------------------------|
| P1-RLS | `docs/P1-RLS-VERIFICATION.md` | `20260519120000`, `20260523120000`, `20260524130000`, `verify_rls_policies.sql` |
| P1-SCHOOL-JOIN | — | `flux-school-registry.js`, `20260520120000`, `20260522120000`, `20260522130000` |
| P1-CLASS-ISOLATION | — | `20260523120000`, join RPCs, `teacher_id` client filters |
| P1-GOOGLE-STAFF | — | `flux-google-hub.js`, `flux-google-tasks.js`, staff Google nav |
| P1-FEATURE-FLAGS | — | `20260524120000`, `flux-feature-flags.js` |
| P1-EVENTS-SKELETON | `docs/P1-EVENTS-SKELETON.md` | `20260524140000`, `flux-event-bus.js` |
| P1-ROLE-ROUTING | `docs/P1-ROLE-ROUTING.md` | `flux-role-routing.js`, `assertRoleAccess` |
| P1-STORAGE | `docs/P1-STORAGE.md` | `flux-storage-keys.js`, Wave 22 inventory |
| P1-TELEMETRY | `docs/P1-TELEMETRY.md`, `docs/TELEMETRY_SCHEMA.md` | `flux-telemetry.js` |
| P1-DOCS | `docs/P1-DOCS.md` | This file + audit sync |

---

## Platform module map (load order snippet)

```
core/debug.js → flux-storage-keys.js → flux-role-routing.js → app.js
→ flux-school-registry.js → flux-feature-flags.js → flux-telemetry.js → flux-event-bus.js
→ flux-google-hub.js …
```

---

## Exit criteria checklist

| Criterion | How to verify |
|-----------|----------------|
| Migrations match production | `supabase migration list --linked` — no pending through `20260524140000` |
| No cross-teacher class leak | `docs/P1-RLS-VERIFICATION.md` + two-teacher manual QA |
| School join (IA-East) | Join code **IA-EAST** / display **IA-East** |
| Feature flags server-side | `FluxFeatureFlags.load()` + `flux_resolve_feature_flags` RPC |
| Role routing | `docs/QA_MATRIX.md` §2–§4, `FluxRoleRouting.auditMatrix()` |
| Storage namespacing | `docs/QA_MATRIX.md` §5, `FluxStorageKeys.auditStragglers()` |
| Telemetry dark launch | `enable_event_bus` **false**; schema in `docs/TELEMETRY_SCHEMA.md` |
| Full smoke | `docs/QA_MATRIX.md` all sections (mark ✓ as you run) |

---

## Feature flags (Phase 1)

| Key | Default | Notes |
|-----|---------|--------|
| `enable_staff_google_hub` | true | Staff Google tab |
| `enable_event_bus` | false | Server `flux_product_events` writes |
| Others | false | Phase 2+ |

---

## After Phase 1

Start **Phase 2** at `P2-MOMENTUM-V2` only after exit criteria above are checked. Each P2 step needs flag + QA row per `docs/ROADMAP.md` template.
