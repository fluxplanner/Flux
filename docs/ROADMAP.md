# Flux Planner — Master Roadmap (execution steps)

This breaks the [Ultimate Master Cursor Prompt](./MASTER-PROMPT-INDEX.md) into **shippable steps**. Each step should land as its own PR or tagged commit when possible. Do not skip stabilization (Phase 1).

**Principles:** modular · feature-flagged · reversible migrations · student systems protected · RLS-first · no giant rewrites.

---

## Phase 1 — Stabilization & platform foundation (NOW)

| Step | ID | Deliverable | Status |
|------|-----|-------------|--------|
| 1.1 | `P1-RLS` | Apply + verify all educator/school migrations on Supabase; run `docs/RLS_AUDIT.md` checklist | Done (see `docs/P1-RLS-VERIFICATION.md`) |
| 1.2 | `P1-SCHOOL-JOIN` | School join (`join_flux_school`, IA-EAST) + client fallbacks | Done |
| 1.3 | `P1-CLASS-ISOLATION` | Teacher class RLS isolation + student join RPC | Done |
| 1.4 | `P1-GOOGLE-STAFF` | Staff/admin Google tab (work + personal) + hub tabs | Done |
| 1.5 | `P1-FEATURE-FLAGS` | DB `flux_feature_flags` + school/user overrides + `FluxFeatureFlags` client | Done |
| 1.6 | `P1-EVENTS-SKELETON` | `flux_product_events` + `flux-event-bus.js` (flag `enable_event_bus`, no processors) | Done (see `docs/P1-EVENTS-SKELETON.md`) |
| 1.7 | `P1-ROLE-ROUTING` | Harden `assertRoleAccess`, educator nav, work/personal mode QA (`docs/QA_MATRIX.md`) | Done (see `docs/P1-ROLE-ROUTING.md`) |
| 1.8 | `P1-STORAGE` | Continue raw `localStorage` audit (`docs/STORAGE_RAW_INVENTORY.md`); namespaced keys for new features | Done (see `docs/P1-STORAGE.md`) |
| 1.9 | `P1-TELEMETRY` | Product telemetry schema + privacy-reviewed event names | Done (see `docs/TELEMETRY_SCHEMA.md`) |
| 1.10 | `P1-DOCS` | Keep `ARCHITECTURE_AUDIT_V2.md`, checkpoint, QA matrix current per release | Done (2026-05-19 sync; ongoing per release — see `docs/P1-DOCS.md`) |

**Phase 1 exit criteria:** See **`docs/PHASE_1_CLOSEOUT.md`** — production migrations synced; no cross-teacher class leak; school join works; feature flags resolve server-side; **manual** QA matrix smoke pass for all roles.

---

## Phase 2 — Intelligence expansion (student core protected)

| Step | ID | Deliverable |
|------|-----|-------------|
| 2.1 | `P2-MOMENTUM-V2` | Momentum domains (task / academic / emotional / recovery) behind `enable_momentum_v2` | Done (see `docs/P2-MOMENTUM-V2.md`) |
| 2.2 | `P2-COGNITIVE-V2` | Cognitive load v2 signals + overload UI states (Cognitive UI tokens) | Done (see `docs/P2-COGNITIVE-V2.md`) |
| 2.3 | `P2-FRICTION` | Task friction & aging integrated with task cards | Done (see `docs/P2-FRICTION.md`) |
| 2.4 | `P2-SHUTDOWN-V2` | Shutdown protocol v2 (reflection + tomorrow preview) | Done (see `docs/P2-SHUTDOWN-V2.md`) |
| 2.5 | `P2-GHOST-DRAFT-V2` | Ghost draft v2 + rubric-aware scaffolding | Done (see `docs/P2-GHOST-DRAFT-V2.md`) |
| 2.6 | `P2-NEURO-DASHBOARD` | Adaptive dashboard density (overload vs momentum modes) | Done (see `docs/P2-NEURO-DASHBOARD.md`) |
| 2.7 | `P2-SRS` | SRS automation hardening + telemetry | Done (see `docs/P2-SRS.md`) |
| 2.8 | `P2-PREDICT` | Predictive layers (read-only insights first, no auto-actions) | Done (see `docs/P2-PREDICT.md`) |

---

## Phase 3 — Teacher mission control

| Step | ID | Deliverable |
|------|-----|-------------|
| 3.1 | `P3-TEACHER-DASH` | Class momentum overview cards (aggregates only, no PII dump) | Done (see `docs/P3-TEACHER-DASH.md`) |
| 3.2 | `P3-ASSIGN-INTEL` | Assignment decomposition + friction scores on `teacher_assignments` | Done (see `docs/P3-ASSIGN-INTEL.md`) |
| 3.3 | `P3-ROSTER` | Roster + join-by-code polish; teacher-only class scope | Done (see `docs/P3-ROSTER.md`) |
| 3.4 | `P3-START-CLASS` | Start Class mode (immersive) behind `enable_live_class_mode` | Done (see `docs/P3-START-CLASS.md`) |
| 3.5 | `P3-LESSON-AI` | AI lesson generator behind `enable_teacher_ai` | Done (see `docs/P3-LESSON-AI.md`) |
| 3.6 | `P3-TEACHER-COPILOT` | Teacher copilot panel (class-scoped context) | Done (see `docs/P3-TEACHER-COPILOT.md`) |
| 3.7 | `P3-RECOVERY` | Assignment recovery plans (teacher approve workflow) | Done (see `docs/P3-RECOVERY.md`) |
| 3.8 | `P3-TEACHER-WELLNESS` | Teacher burnout signals (aggregate, opt-in) | Done (see `docs/P3-TEACHER-WELLNESS.md`) |

---

## Phase 4 — Counselor intelligence

| Step | ID | Deliverable |
|------|-----|-------------|
| 4.1 | `P4-CASELOAD` | Caseload health dashboard (consent-gated) | Done (see `docs/P4-CASELOAD.md`) |
| 4.2 | `P4-TIMELINE` | Student wellness timeline (momentum + mood + load) | Done (see `docs/P4-TIMELINE.md`) |
| 4.3 | `P4-ALERTS` | Risk queue (non-diagnostic engagement signals) | Done (see `docs/P4-ALERTS.md`) |
| 4.4 | `P4-CONSENT` | Student visibility tiers + consent flows | Done (see `docs/P4-CONSENT.md`) |
| 4.5 | `P4-COUNSELOR-AI` | Counselor copilot (summaries only, audit log) | Done (see `docs/P4-COUNSELOR-AI.md`) |

---

## Phase 5 — Admin & school OS

| Step | ID | Deliverable |
|------|-----|-------------|
| 5.1 | `P5-COMMAND` | School command center (aggregate metrics) | Done (see `docs/P5-COMMAND.md`) |
| 5.2 | `P5-EMERGENCY` | Emergency / calm mode broadcast | Done (see `docs/P5-EMERGENCY.md`) |
| 5.3 | `P5-DISTRICT` | Multi-school rollup (schema + RLS) | Done (see `docs/P5-DISTRICT.md`) |
| 5.4 | `P5-OPS` | Operations intelligence (overload week prediction) | Done (see `docs/P5-OPS.md`) |

---

## Phase 6 — Google & LMS depth

| Step | ID | Deliverable |
|------|-----|-------------|
| 6.1 | `P6-GCAL-2WAY` | Calendar two-way sync + overload-aware scheduling | Done (see `docs/P6-GCAL-2WAY.md`) |
| 6.2 | `P6-CLASSROOM` | Google Classroom sync (classes, assignments, grades) | Done (see `docs/P6-CLASSROOM.md`) |
| 6.3 | `P6-DRIVE` | Drive import → lesson / assignment generation | Done (see `docs/P6-DRIVE.md`) |
| 6.4 | `P6-DOCS` | Docs ↔ Ghost draft bidirectional flow | Done (see `docs/P6-DOCS.md`) |
| 6.5 | `P6-GMAIL` | Gmail → task import (educators, optional) | Done (see `docs/P6-GMAIL.md`) |

---

## Phase 7 — Infrastructure & scale

| Step | ID | Deliverable |
|------|-----|-------------|
| 7.1 | `P7-EVENT-BUS` | Event processors (queue / edge workers) | Done (see `docs/P7-EVENT-BUS.md`) |
| 7.2 | `P7-AI-ORCH` | Multi-agent orchestration layer | Done (see `docs/P7-AI-ORCH.md`) |
| 7.3 | `P7-OFFLINE` | Offline-first sync (CRDT / conflict rules) | Done (see `docs/P7-OFFLINE.md`) |
| 7.4 | `P7-MEMORY` | Layered memory + user reset controls | Done (see `docs/P7-MEMORY.md`) |
| 7.5 | `P7-PARENT` | Parent portal behind `enable_parent_portal` | Done (see `docs/P7-PARENT.md`) |
| 7.6 | `P7-A11Y` | Reduced motion, calm mode, ADHD-friendly layouts | Done (see `docs/P7-A11Y.md`) |
| 7.7 | `P7-TESTS` | E2E: student semester, teacher workflow, counselor path | Done (see `docs/P7-TESTS.md`) |

**Phase 7 exit:** See **`docs/PHASE_7_CLOSEOUT.md`**. E2E runs in CI (`.github/workflows/e2e.yml`).

---

## Phase 8 — Production hardening

| Step | ID | Deliverable |
|------|-----|-------------|
| 8.1 | `P8-ERRORS` | Client error reporting (scrubbed, rate-limited) | Done (see `docs/P8-ERRORS.md`) |
| 8.2 | `P8-HEALTH` | Ops health / readiness checks | Done (see `docs/P8-HEALTH.md`) |
| 8.3 | `P8-I18N` | Locale + date formatting foundation | Done (see `docs/P8-I18N.md`) |

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

**Phases 1–7 are complete.** Phase 8 slices below; see also `docs/SITE_IMPROVEMENTS_50.md`.

| Step | ID | Deliverable | Status |
|------|-----|-------------|--------|
| 8.1 | `P8-SITE-ENH` | 50 UX enhancements pack (`enable_site_enhancements_pack`) | Done |
| 8.2 | `P8-STAFF-PROD` | Staff Productivity Suite — ModuleLoader, classroom/counselor/personal modules, SQL | Done (foundation); 8.3 classroom widgets ongoing |
| 8.3 | `P8-CLASSROOM` | Student picker, classroom timer, roster pickers for logs | Done |
| 8.4 | `P8-CLASSROOM-B` | Hall pass, exit ticket, Oops broadcast + student alert banner | Done |
| 8.5 | `P8-COUNSELOR-B` | Wellness check-in queue, crisis cheat-sheet, referral tracker + student check-in | Done |
| 8.6 | `P8-ADMIN-B` | Duty roster alerts + sub-coverage swap widgets (`FluxAdminWidgets`) | Done |
| 8.7 | `P8-SYSTEM-B` | Staff ⌘K commands (role shortcuts) + Gmail quick import palette/widget | Done |
| 8.8 | `P8-PILOT` | IA East school flag overrides + counselor roster pickers for notes/referrals | Done |
| 8.9 | `P8-HEALTH-PANEL` | Admin system health widget + extended RLS snapshot | Done |
| 8.10 | `P8-I18N` | Locale picker, Intl formatters, RTL, settings card | Done |
| 8.11 | `P8-I18N-B` | Adopt `fmtFluxDate` across dashboard tasks, calendar strip, countdown | Done |

## Phase 9 — Student experience polish

| Step | ID | Deliverable | Status |
|------|-----|-------------|--------|
| 9.1 | `P9-DASH-WIDGETS` | Dashboard widget show/hide + reorder (`enable_dashboard_widget_picker`) | Done |
| 9.2 | `P9-PILOT-B` | `PHASE_8_CLOSEOUT.md` + IA East locale/ops health pilot extension | Done |
| 9.3 | `P9-SYNC-CONFLICT` | Enhanced conflict modal + Settings card (`enable_sync_conflict_ui`) | Done |
| 9.4 | `P9-I18N-EDUCATOR` | `fmtFluxDate` / `fluxFmtStaffDate` in educator & staff panels | Done |
| 9.5 | `P9-PRODUCTION-SMOKE` | IAE smoke checklist + E2E harness scenarios | Done |

**Phase 9 exit:** `docs/PHASE_9_CLOSEOUT.md` · **Phase 8 exit:** `docs/PHASE_8_CLOSEOUT.md`

## Phase 10 — Reliability & data hygiene

| Step | ID | Deliverable | Status |
|------|-----|-------------|--------|
| 10.1 | `P10-STORAGE-REPAIR` | Corrupt localStorage scan/repair (`enable_storage_repair`) | Done |
| 10.2 | `P10-I18N-STRINGS` | `fluxT` strings for sync conflict, storage repair, widget picker | Done |

**Phase 10 exit:** `docs/PHASE_10_CLOSEOUT.md`

## Phase 11 — Schedule intelligence

| Step | ID | Deliverable | Status |
|------|-----|-------------|--------|
| 11.1 | `P11-SYLLABUS-CONFLICT` | Syllabus conflict banner (`enable_syllabus_conflict_check`) | Done |
| 11.2 | `P11-PILOT-B` | IA East school override for syllabus conflicts + live banner refresh | Done |
| 11.3 | `P11-CALENDAR-CONFLICT` | Calendar day markers + day-panel hints (`cal-day--conflict`) | Done |

**Phase 11 exit:** `docs/PHASE_11_CLOSEOUT.md`

For new work beyond Phase 11, add rows here or pick items from `IMPROVEMENTS.md`.

1. Read `docs/PHASE_7_CLOSEOUT.md` (or `docs/PHASE_1_CLOSEOUT.md` for stabilization checks).  
2. Run `npm run test:e2e` before large UI changes.  
3. Implement behind a feature flag unless the change is a pure fix.  
4. Add QA rows to `docs/QA_MATRIX.md` for touched roles.  
5. `git push` when a slice is ready (full working tree per project rules).

See also: `.cursor/rules/flux-roadmap.mdc` (agent guardrails).
