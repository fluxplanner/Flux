# Flux Planner — Master Roadmap (execution steps)

This breaks the [Ultimate Master Cursor Prompt](./MASTER-PROMPT-INDEX.md) into **shippable steps**. Each step should land as its own PR or tagged commit when possible. Do not skip stabilization (Phase 1).

**Principles:** modular · feature-flagged · reversible migrations · student systems protected · RLS-first · no giant rewrites.

---

## Phase 1 — Stabilization & platform foundation (NOW)

| Step | ID | Deliverable | Status |
|------|-----|-------------|--------|
| 1.1 | `P1-RLS` | Apply + verify all educator/school migrations on Supabase; run `docs/RLS_AUDIT.md` checklist | In progress |
| 1.2 | `P1-SCHOOL-JOIN` | School join (`join_flux_school`, IA-EAST) + client fallbacks | Done |
| 1.3 | `P1-CLASS-ISOLATION` | Teacher class RLS isolation + student join RPC | Done |
| 1.4 | `P1-GOOGLE-STAFF` | Staff/admin Google tab (work + personal) + hub tabs | Done |
| 1.5 | `P1-FEATURE-FLAGS` | DB `flux_feature_flags` + school/user overrides + `FluxFeatureFlags` client | **This push** |
| 1.6 | `P1-EVENTS-SKELETON` | `flux_events` table + client `FluxBus` emit helpers (no heavy processors) | Planned |
| 1.7 | `P1-ROLE-ROUTING` | Harden `assertRoleAccess`, educator nav, work/personal mode QA (`docs/QA_MATRIX.md`) | Planned |
| 1.8 | `P1-STORAGE` | Continue raw `localStorage` audit (`docs/STORAGE_RAW_INVENTORY.md`); namespaced keys for new features | Planned |
| 1.9 | `P1-TELEMETRY` | Product telemetry schema + privacy-reviewed event names | Planned |
| 1.10 | `P1-DOCS` | Keep `ARCHITECTURE_AUDIT_V2.md`, checkpoint, QA matrix current per release | Ongoing |

**Phase 1 exit criteria:** Production Supabase matches migrations; no cross-teacher class leak; school join works; feature flags resolve server-side; QA matrix smoke pass for all roles.

---

## Phase 2 — Intelligence expansion (student core protected)

| Step | ID | Deliverable |
|------|-----|-------------|
| 2.1 | `P2-MOMENTUM-V2` | Momentum domains (task / academic / emotional / recovery) behind `enable_momentum_v2` |
| 2.2 | `P2-COGNITIVE-V2` | Cognitive load v2 signals + overload UI states (Cognitive UI tokens) |
| 2.3 | `P2-FRICTION` | Task friction & aging integrated with task cards |
| 2.4 | `P2-SHUTDOWN-V2` | Shutdown protocol v2 (reflection + tomorrow preview) |
| 2.5 | `P2-GHOST-DRAFT-V2` | Ghost draft v2 + rubric-aware scaffolding |
| 2.6 | `P2-NEURO-DASHBOARD` | Adaptive dashboard density (overload vs momentum modes) |
| 2.7 | `P2-SRS` | SRS automation hardening + telemetry |
| 2.8 | `P2-PREDICT` | Predictive layers (read-only insights first, no auto-actions) |

---

## Phase 3 — Teacher mission control

| Step | ID | Deliverable |
|------|-----|-------------|
| 3.1 | `P3-TEACHER-DASH` | Class momentum overview cards (aggregates only, no PII dump) |
| 3.2 | `P3-ASSIGN-INTEL` | Assignment decomposition + friction scores on `teacher_assignments` |
| 3.3 | `P3-ROSTER` | Roster + join-by-code polish; teacher-only class scope |
| 3.4 | `P3-START-CLASS` | Start Class mode (immersive) behind `enable_live_class_mode` |
| 3.5 | `P3-LESSON-AI` | AI lesson generator behind `enable_teacher_ai` |
| 3.6 | `P3-TEACHER-COPILOT` | Teacher copilot panel (class-scoped context) |
| 3.7 | `P3-RECOVERY` | Assignment recovery plans (teacher approve workflow) |
| 3.8 | `P3-TEACHER-WELLNESS` | Teacher burnout signals (aggregate, opt-in) |

---

## Phase 4 — Counselor intelligence

| Step | ID | Deliverable |
|------|-----|-------------|
| 4.1 | `P4-CASELOAD` | Caseload health dashboard (consent-gated) |
| 4.2 | `P4-TIMELINE` | Student wellness timeline (momentum + mood + load) |
| 4.3 | `P4-ALERTS` | Risk queue (non-diagnostic engagement signals) |
| 4.4 | `P4-CONSENT` | Student visibility tiers + consent flows |
| 4.5 | `P4-COUNSELOR-AI` | Counselor copilot (summaries only, audit log) |

---

## Phase 5 — Admin & school OS

| Step | ID | Deliverable |
|------|-----|-------------|
| 5.1 | `P5-COMMAND` | School command center (aggregate metrics) |
| 5.2 | `P5-EMERGENCY` | Emergency / calm mode broadcast |
| 5.3 | `P5-DISTRICT` | Multi-school rollup (schema + RLS) |
| 5.4 | `P5-OPS` | Operations intelligence (overload week prediction) |

---

## Phase 6 — Google & LMS depth

| Step | ID | Deliverable |
|------|-----|-------------|
| 6.1 | `P6-GCAL-2WAY` | Calendar two-way sync + overload-aware scheduling |
| 6.2 | `P6-CLASSROOM` | Google Classroom sync (classes, assignments, grades) |
| 6.3 | `P6-DRIVE` | Drive import → lesson / assignment generation |
| 6.4 | `P6-DOCS` | Docs ↔ Ghost draft bidirectional flow |
| 6.5 | `P6-GMAIL` | Gmail → task import (educators, optional) |

---

## Phase 7 — Infrastructure & scale

| Step | ID | Deliverable |
|------|-----|-------------|
| 7.1 | `P7-EVENT-BUS` | Event processors (queue / edge workers) |
| 7.2 | `P7-AI-ORCH` | Multi-agent orchestration layer |
| 7.3 | `P7-OFFLINE` | Offline-first sync (CRDT / conflict rules) |
| 7.4 | `P7-MEMORY` | Layered memory + user reset controls |
| 7.5 | `P7-PARENT` | Parent portal behind `enable_parent_portal` |
| 7.6 | `P7-A11Y` | Reduced motion, calm mode, ADHD-friendly layouts |
| 7.7 | `P7-TESTS` | E2E: student semester, teacher workflow, counselor path |

---

## Per-step template (required for every step ≥ P2)

1. **Reasoning** — why this step, what user pain it solves  
2. **Architecture** — tables, RPCs, modules, flags  
3. **Migration** — up SQL + documented down/rollback  
4. **Feature flag** — key in `flux_feature_flags`  
5. **Telemetry** — events + dashboards  
6. **QA** — rows added to `docs/QA_MATRIX.md`  
7. **Performance** — query budgets, lazy load plan  
8. **Security** — RLS policies + audit  
9. **UX** — overload/momentum states considered  
10. **Rollback** — disable flag + revert migration path  

---

## How to use this in Cursor

1. Pick the **lowest numbered incomplete step** in Phase 1.  
2. Read linked docs only for that step (do not re-read the entire master prompt).  
3. Implement behind a feature flag unless the step is a pure fix.  
4. Update the **Status** column in this file.  
5. Run `docs/QA_MATRIX.md` scenarios for touched roles.  
6. `git push` when the step is complete.

See also: `.cursor/rules/flux-roadmap.mdc` (agent guardrails).
