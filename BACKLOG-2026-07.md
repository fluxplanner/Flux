# Flux Planner — Master Backlog (July 2026 audit)

Everything that needs work or adding, from a full-codebase pass. Ordered by priority within each section. **P0** = do next, **P1** = high value, **P2** = solid improvement, **P3** = someday/nice.

---

## 1 · Architecture & tech debt

- **P0 — Bundle the app.** `index.html` loads ~150 CSS files and ~200 scripts individually. Move to Vite: one hashed JS bundle + one CSS bundle per route group. This is the single biggest performance and maintainability win; it also kills the manual service-worker version-bump ritual (hash the assets instead).
- **P0 — Split `app.js` (1 MB).** Extract modules: tasks, calendar, AI chat, sync/auth, settings, rendering helpers. Even without a framework, ES modules with a clear dependency graph.
- **P1 — Consolidate the polish layers.** `flux-motion`, `flux-apple-motion(-pro)`, `flux-motion-50`, `flux-elevate`, `flux-claude-magic`, `flux-refresh-26`, `flux-modern-ui`, `flux-theme-2026` all fight over the same selectors with `!important`. Distill into one design-system file + one theme token file; delete the rest.
- **P1 — Normalize data storage.** Tasks/notes/events live in a localStorage-first `user_data` blob. Move to real Supabase tables (tasks, notes, events) with RLS, an offline write queue, and conflict resolution. Enables: multi-device merge, parent portal, staff views, server-side AI retrieval.
- **P1 — One toolbox registry.** `flux-toolbox.js`, `flux-toolbox-dp.js`, and the Study Hub registry duplicate tool definitions. Single registry, per-curriculum overlays.
- **P2 — Delete dead code.** Pulse layout leftovers (`flux-pulse-layout.js`, `flux-pulse-perf.js` still in repo), legacy `roleSelectScreen` DOM, the four coexisting login CSS layers (`login.css`, `login-aurora`, `flux-login-split`, `login-refresh`) — collapse to one.
- **P2 — Decide on `web/` (Next.js shell).** It's unwired. Either commit to the migration with a plan, or remove it — it confuses every audit.
- **P2 — CI pipeline.** GitHub Action: `node --check` all JS, HTML validation, Playwright smoke (login → add task → settings), then deploy. Preview deploys per PR.
- **P3 — TypeScript migration** for new modules (checkJS + JSDoc first).

## 2 · Icons & visual system (follow-through from this pass)

- **P1 — Native icon adoption.** The new `flux-iconify.js` swaps emoji → SVG at render time. Migrate the big registries (`flux-skills.js`, `flux-toolbox*.js`, `owner-suite.js`, `flux-staff-platform.js`) to call `fluxIcon('name')` directly, then shrink the runtime layer to a safety net.
- **P1 — Light-theme parity.** Theme 2026 is dark-first; audit every new token against the light theme (stabs, cards, chips) for AA contrast.
- **P2 — Icon set completeness.** Add the ~30 less-common glyphs still falling back to the neutral dot; audit with a page that renders every mapped emoji.
- **P2 — Consistent empty states.** One reusable empty-state component (icon, one sentence, one primary action) across tasks/notes/calendar/staff tabs.

## 3 · Performance

- **P0 — Font diet.** Five Google font families load today (Inter, Plus Jakarta Sans, JetBrains Mono, Space Grotesk, Syne). Keep Inter + JetBrains Mono, self-host with `font-display:swap`, subset latin.
- **P1 — Service worker strategy.** Currently network-first for everything. Precache the app shell (hashed bundles), use stale-while-revalidate for assets, add navigation preload. Offline should be instant, not spinner-y.
- **P1 — Observer audit.** Three DOM-wide MutationObservers now run (i18n-dom, iconify, motion layers). Profile on a low-end device; coalesce into one shared walker if needed.
- **P2 — Image pipeline.** Convert PNGs (logos, screenshots, landing) to WebP/AVIF with fallbacks.
- **P2 — Virtualize long lists.** Task list, notebook list, staff rosters render every row; virtualize past ~100 items.

## 4 · Flux AI ("training" roadmap)

- **P0 — Server-side system prompt.** The prompt lives in client JS; move assembly to the `ai-proxy` edge function so improvements ship without client deploys and can't be trivially read/tampered.
- **P0 — Eval harness.** 20–30 canned planner scenarios (triage, schedule fix, flashcards, Canvas questions) with expected behaviors, run via `flux-eval.js` on every prompt change. This is how "training sessions" become measurable: change playbook → run evals → keep wins.
- **P1 — Sync learned notes.** `flux_brain_notes` (new Teach Flux layer) is device-local; fold into the `user_data` sync blob so Flux remembers across devices.
- **P1 — Retrieval over notes/knowledge.** Replace part of the 24k-char planner snapshot with embeddings search (Supabase pgvector) over notes, knowledge, and past chats — smarter context, fewer tokens.
- **P1 — Auto-memory.** After each chat, summarize durable facts into FluxBrain (with user review queue) instead of relying only on explicit "remember".
- **P2 — Model routing.** BYOK providers exist; route math/reasoning to a stronger model and quick chat to a fast one, automatically by intent.
- **P2 — Proactive insights.** Intelligence OS engines exist; let Flux open the conversation ("Your bio quiz moved — want me to reshuffle Thursday?") with a daily cap.
- **P2 — TTS responses** toggle to pair with voice capture.
- **P3 — Fine-tune-style persona packs.** Subject-specific playbooks (IB Chem, AP Calc) curated in dedicated training sessions, shipped as toggleable prompt packs.

## 5 · Student features

- **P1 — Grade what-if calculator.** "What do I need on the final for an A-?" — per-class weighting, trend chart, GPA projection.
- **P1 — A/B day + rotation timetables.** Many schools rotate; the class schedule assumes a fixed week.
- **P1 — Google Classroom assignment sync.** Canvas works; Classroom is the most-requested missing connector (API: courses.courseWork.list).
- **P1 — Push notifications on mobile.** Browser Notification API only fires while the tab lives. Add FCM/Web Push via the service worker for due-soon alerts.
- **P2 — Task attachments.** Files/links on tasks, with Drive picker integration.
- **P2 — Unified SRS dashboard.** Flashcards, periodic-table quiz, and SRS decks each track separately; one "reviews due today" surface.
- **P2 — Weekly review ritual.** Sunday review flow: last week's wins, slipped tasks, auto-proposed next week plan.
- **P2 — Study buddy / shared class lists.** Co-work rooms exist; add per-class shared task lists and peer accountability.
- **P2 — Morning digest email.** Edge function + Resend: today's classes, top 3 tasks, weather (weather module exists).
- **P3 — Sample-data demo mode** for new users and the landing page "try it" button.
- **P3 — Print/PDF week plan** export.

## 6 · Staff & counselor

- **P1 — Gradebook CSV import** with column mapping and at-risk auto-flags (explainable rules, not black box).
- **P1 — Office hours v2.** Recurring exceptions (holidays), ICS export, waitlist when slots fill, no-show tracking.
- **P2 — Staff messaging upgrades.** Read receipts, file attachments, search, push notifications.
- **P2 — Lesson planner standards tagging.** IB/Common Core alignment chips on lessons + unit template library.
- **P2 — Counselor session note templates** + FERPA-style audit log of who viewed what.
- **P3 — Sub-plan generator** one-click from today's lesson + roster.

## 7 · Settings, accounts & data

- **P1 — Settings search.** Filter cards live by keyword (the reorganized 6-tab layout makes this easy to add at the top).
- **P1 — Enable Microsoft + Apple OAuth** in Supabase Auth (client code is done; providers still off).
- **P2 — Full data export/import.** One-click JSON export of everything + iCal feed of tasks/deadlines.
- **P2 — Session management.** List active sessions/devices, revoke, and passkey support.
- **P2 — Per-theme accent memory** (accent resets when switching themes).
- **P3 — Scheduled quiet mode** per weekday.

## 8 · Accessibility & i18n

- **P1 — Keyboard audit.** Full tab-order pass on modals (focus traps), command palette, drag-reorder alternatives.
- **P1 — Contrast audit for all 8 themes** to WCAG AA (several themes predate the token system).
- **P2 — ARIA on dynamic cards.** Live regions for toasts exist; dynamic settings cards and AI messages need roles/labels.
- **P2 — Finish translations.** i18n scaffolding exists; complete locales and QA RTL (Arabic) layout.

## 9 · Security & compliance

- **P0 — RLS audit.** Run Supabase advisors across all `flux_*` tables; several were added quickly during feature passes.
- **P1 — Sanitization sweep.** Many `innerHTML` templates interpolate user data; `esc()` usage is inconsistent. Central escape helper + lint rule.
- **P1 — AI proxy quotas.** Per-user rate limits on the edge functions to prevent abuse of the shared key.
- **P2 — CSP.** Add a Content-Security-Policy meta (script-src self + cdn.jsdelivr, connect-src supabase) — catches whole bug classes.
- **P2 — Privacy page refresh** to reflect current data flows (AI providers, Google scopes, staff visibility).

## 10 · Marketing & growth

- **P2 — Landing page truthfulness pass.** Real screenshots of the 2026 theme, feature copy matched to what ships, working demo link.
- **P2 — SEO.** Meta/schema.org markup, sitemap.xml, og-images per page.
- **P3 — Changelog page** fed from CHANGELOG.md so users see momentum.

---

### Suggested next three sessions
1. **Bundler + font diet + SW strategy** (perf foundation; P0s from §1/§3).
2. **Flux training session #1**: build the eval harness, then iterate the playbook/prompt against it (P0s from §4).
3. **Grade what-if + Classroom sync** (highest-demand student features).
