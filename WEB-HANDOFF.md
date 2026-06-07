# Flux Planner — `web/` Handoff Report

**Generated:** 2026-06-05 · **For:** the next Claude Code session working on the Next.js app
**Scope of this doc:** the `web/` Next.js app only (not the browser extension in `public/`).
**Build status:** `npx tsc --noEmit` → **0 errors** (verified). All changes below are live on disk, uncommitted.

> **⚡ Applied in a follow-up pass (already done — do NOT redo):**
> - **§4 security item is DONE** — `toEmbedUrl` now enforces `https:` + exact `docs.google.com` host and rebuilds the embed URL from the validated deck id; the `<iframe>` got `sandbox=…` + `referrerPolicy="no-referrer"`.
> - **Accessibility (DONE):** all modals now share a `web/components/ui/modal.tsx` primitive — `role="dialog"` + `aria-modal` + `aria-labelledby` + Esc-to-close + **focus-trap + focus-restore to the trigger** + labeled close button. Every expand toggle in `/units` and `/classes` exposes `aria-expanded`.
> - **Placeholder buttons (DONE, local-state):** "New task", "Add unit", "New class", and "Post announcement" are all functional now via in-memory React state — the `/units` `SUBJECTS` and `/classes` `CLASSES` arrays were lifted into component state. **Persistence still needs the Supabase wiring (§5) — adds survive until refresh only.** §4's "placeholder buttons" list below is superseded by this.

---

## 0. TL;DR for the next session

A previous session fixed 6 bugs and shipped 2 new staff pages (`/units`, `/classes`) with Google Slides embedding. **All of it compiles clean and is uncommitted.**

The single most important thing to know before you continue:

> **The `web/` Next.js app is a pure UI shell with hardcoded sample data. It has NO backend wiring at all** — no `@supabase/supabase-js` dependency, no Supabase client, no auth, no data fetching. The real Supabase backend (13 edge functions, teacher tables, AI proxy) is currently consumed only by the **vanilla-JS browser extension** in `public/` + `index.html`. Bridging the pretty new Next.js UI to that existing backend is the bulk of the remaining work.

So "next steps" = **wire the new UI to the backend that already exists.** Don't rebuild the backend; it's done.

---

## 1. What was completed this session (verified)

### Bugs fixed
| # | File | Was broken | Fix |
|---|------|-----------|-----|
| 1 | [`web/components/features/calendar-grid.tsx`](web/components/features/calendar-grid.tsx) | Hardcoded to "May"; day math `((d-1) % 31)+1` produced wrong dates; no navigation | Real `new Date()` month, Monday-first offset, prev/next buttons, today highlighted |
| 2 | [`web/app/(main)/page.tsx`](web/app/(main)/page.tsx) | `<h1>` was placeholder "Calm focus, dramatic polish."; copy was an internal dev note | Time-of-day greeting + today's date eyebrow + quick-links card |
| 3 | [`web/app/(main)/planner/page.tsx`](web/app/(main)/planner/page.tsx) | "New task" button did nothing | Working modal (title + due, spring anim, autofocus, prepends to board) |
| 4 | [`web/components/features/task-board.tsx`](web/components/features/task-board.tsx) | Owned its own state from `initial` → parent couldn't add tasks | Fully controlled: `tasks` + `onTasksChange` props; drag calls `onTasksChange(arrayMove(...))` |
| 5 | [`web/components/layout/command-palette.tsx`](web/components/layout/command-palette.tsx) | GPA item ran `setNext(false)` (no-op); new pages unreachable | GPA → navigates to `/planner`; added Units + Classes entries |
| 6 | [`web/components/layout/sidebar.tsx`](web/components/layout/sidebar.tsx) | 3 nav items only; badge said "Linear · Apple · Notion energy" | Added Units + Classes; badge → "Flux Planner v2.0.0" |

### New features
- **[`web/components/features/google-slides-embed.tsx`](web/components/features/google-slides-embed.tsx)** (new, 122 lines) — two exports:
  - `GoogleSlidesEmbed` — converts any Slides URL to embed format, renders in an `<iframe>` with expand/collapse + external-link. Invalid URL → red error state.
  - `SlidesLinkCard` — compact clickable deck card.
- **[`web/app/(main)/units/page.tsx`](web/app/(main)/units/page.tsx)** (new, 320 lines) — staff curriculum view. Subject → Unit → Lesson hierarchy, per-unit + per-lesson inline Slides.
- **[`web/app/(main)/classes/page.tsx`](web/app/(main)/classes/page.tsx)** (new, 316 lines) — staff classes view. Stats bar, per-class cards expanding into Assignments / Announcements / Class-slides tabs with an animated SVG submission-progress ring.

### Git state
```
 M web/app/(main)/page.tsx
 M web/app/(main)/planner/page.tsx
 M web/components/features/calendar-grid.tsx
 M web/components/features/task-board.tsx
 M web/components/layout/command-palette.tsx
 M web/components/layout/sidebar.tsx
?? web/app/(main)/classes/page.tsx
?? web/app/(main)/units/page.tsx
?? web/components/features/google-slides-embed.tsx
```
Nothing is committed. (Other `M`/`??` entries at repo root — `index.html`, `public/`, `supabase/` — are from a separate in-flight "Claude MCP connector" effort, not this session.)

---

## 2. Architecture you must understand before continuing

### Two frontends, one backend
```
Flux Planner/
├── index.html, public/js/*.js   ← Vanilla-JS browser extension (PRODUCTION, wired to Supabase)
├── config.json                  ← { ai_proxy_url, app_url, version } — fetched at runtime by the extension
├── supabase/
│   ├── functions/               ← 13 edge functions (ai-proxy, canvas-proxy, stripe-*, mcp, …) — ALL real
│   └── migrations/              ← teacher_classes, teacher_assignments, RLS lockdowns, … — ALL real
└── web/                         ← Next.js 15 / React 19 app (NEW UI SHELL — NO backend wiring yet)
    ├── lib/utils.ts             ← only `cn()`. No supabase client.
    └── app/(main)/{page,planner,units,classes,ai}/
```

### The backend that already exists (consume it, don't rebuild it)
- **AI proxy:** `config.json.ai_proxy_url` = `https://lfigdijuqmbensebnevo.supabase.co/functions/v1/ai-proxy`. Edge fn at [`supabase/functions/ai-proxy/index.ts`](supabase/functions/ai-proxy/index.ts) (multi-provider routing, usage limits, JWT auth).
- **Teacher data:** migrations `…_teacher_classes_isolation.sql`, `…_teacher_assign_intel.sql`, `…_teacher_class_schedule.sql`, `…_educator_rls_lockdown.sql` — tables with RLS already enforced.
- **Supabase project ref:** `lfigdijuqmbensebnevo`.

### `web/` dependency reality (checked `web/package.json`)
Present: `next@15.5.15`, `react@19.1.0`, `framer-motion`, `@dnd-kit/*`, `cmdk`, `lucide-react`, `tailwindcss@4`, `@radix-ui/react-dialog`.
**Missing (you'll need to add):** `@supabase/supabase-js`, any auth/session lib, any data-fetching lib.

> ⚠️ **Correction to the prior session's verbal report:** it implied the web app could "just POST to ai-proxy" and that sign-in was "a demo with auth nearby." In reality `web/` has *zero* Supabase code today. Step 0 for both Auth and AI below is **install `@supabase/supabase-js` and create a client** — there's nothing to extend yet.

---

## 3. Data shapes to map to Supabase

When you wire `/units` and `/classes` to real data, these are the inline TypeScript shapes currently used. Map them to the existing tables (or new `curriculum_units` if absent).

**`web/app/(main)/units/page.tsx`:**
```ts
type Lesson  = { id: string; title: string; type: "lecture"|"lab"|"discussion"|"assessment"; slidesUrl?: string };
type Unit    = { id: string; number: number; title: string; description: string; lessons: Lesson[]; slidesUrl?: string };
type Subject = { id: string; name: string; color: "sky"|"emerald"|"amber"; units: Unit[] };
```

**`web/app/(main)/classes/page.tsx`:**
```ts
type Assignment   = { id: string; title: string; due: string; submitted: number; total: number; slidesUrl?: string };
type Announcement = { id: string; text: string; date: string };
type ClassRecord  = {
  id: string; name: string; period: string; studentCount: number;
  currentUnit: string; joinCode: string; color: "sky"|"violet"|"rose"|"emerald";
  assignments: Assignment[]; announcements: Announcement[]; slidesDeckUrl?: string;
};
```
Replace the `const SUBJECTS` / `const CLASSES` arrays with server components (or a `lib/supabase` client + `useEffect`) querying the teacher tables, scoped by the signed-in teacher's id (RLS already enforces isolation).

---

## 4. Known follow-ups & one security item

### 🔒 Security — harden `toEmbedUrl` before it ever takes user input
[`web/components/features/google-slides-embed.tsx:12`](web/components/features/google-slides-embed.tsx#L12) validates the path but **not the hostname**. Today it's fed only hardcoded `docs.google.com` URLs, so it's safe *now* — but the `/embed` branch returns the raw URL unchecked, so once a teacher can paste a deck URL, `https://evil.com/x/embed` would be injected straight into `<iframe src>`. Replace with:

```ts
function toEmbedUrl(raw: string): string | null {
  try {
    const u = new URL(raw);
    // Hard requirement: HTTPS + exact Google host
    if (u.protocol !== "https:") return null;
    if (u.hostname !== "docs.google.com") return null;
    const match = u.pathname.match(/\/presentation\/d\/([A-Za-z0-9_-]+)/);
    if (!match) return null;
    return `https://docs.google.com/presentation/d/${match[1]}/embed?start=false&loop=false&delayms=3000`;
  } catch {
    return null;
  }
}
```
Also add `sandbox="allow-scripts allow-same-origin allow-popups"` to the `<iframe>` (line ~74) and a `referrerPolicy="no-referrer"`.

### Placeholder buttons that need wiring
- `/units` → "Add unit" (header) — no handler.
- `/classes` → "New class" (header), "Post announcement" (announcements tab) — no handlers.
- Command palette → "GPA calculator (coming soon)" currently just routes to `/planner`.
- New tasks in `/planner` are in-memory only (lost on refresh) — needs persistence.

---

## 5. Recommended next steps — skill-by-skill playbook

These are the Claude Code **skills** (slash commands you type) and **agents** (you spawn) most useful here. Ordered by priority. For each: what it does, the exact invocation, and why it fits.

### Foundation first

**① `/ecc:plan` — plan the Supabase wiring before writing code**
*What it does:* Restates requirements, assesses risks, and produces a step-by-step implementation plan, then **waits for your confirmation before touching code.** Best for anything cross-cutting.
*Run:*
```
/ecc:plan Wire @supabase/supabase-js into web/. Add a browser client in web/lib/supabase.ts,
a session provider, middleware protecting all /(main) routes, email/password + Google OAuth on
web/app/sign-in, and role-based redirect after login (student→/planner, teacher→/classes).
Backend already exists: Supabase project lfigdijuqmbensebnevo.
```
*Why:* Auth is the foundation for everything else (AI calls need a JWT; teacher data needs the signed-in teacher id). Plan it before building.

---

### Build

**② `/ecc:feature-dev` — guided feature implementation**
*What it does:* Implements a feature end-to-end with codebase-aware architecture decisions.
*Run (real AI chat):*
```
/ecc:feature-dev Replace the hardcoded demo in web/components/features/flux-ai-chat-demo.tsx with a
real streaming chat. POST to the ai-proxy URL from config.json
(https://lfigdijuqmbensebnevo.supabase.co/functions/v1/ai-proxy). Stream tokens, show a typing
indicator, handle errors. Anon key first; add the Bearer JWT once auth (step ①) lands.
```
*Why:* The AI page renders a fake Krebs-cycle Q&A on a timer. The proxy is production-ready — this is wiring, not invention.

**③ `ecc:database-reviewer` (agent) — wire `/units` + `/classes` to Supabase**
*What it does:* PostgreSQL/Supabase specialist — checks existing RLS, suggests query patterns, flags missing indexes.
*Spawn it* with: replace the inline `SUBJECTS`/`CLASSES` arrays (§3) with real queries against `teacher_classes`, `teacher_assignments`, the announcements table, scoped by teacher id; create a `curriculum_units` table + migration if one doesn't already exist.
*Why:* The RLS isolation migrations already exist — let the DB specialist confirm the right scoped query shape rather than guessing.

---

### Verify & harden (run after each build step)

**④ `/ecc:react-review` — React/JSX correctness review**
*What it does:* Reviews hook correctness, render performance, server/client boundaries, a11y, and React-specific security (auto-runs `typescript-reviewer` alongside on `.tsx`).
*Run:* `/ecc:react-review` — it picks up the changed files from git. Targets: the 3 new files + `task-board` refactor.

**⑤ `/security-review` (built-in) or `ecc:security-reviewer` (agent) — app-code vuln scan**
*What it does:* OWASP-style review of app code (XSS/SSRF/injection/secrets). *(Note: `/ecc:security-scan` is different — it audits agent/hook/MCP/secret surfaces, not app XSS. Use it only for the `supabase/functions/mcp` work.)*
*Run:* `/security-review` and point it at `web/components/features/google-slides-embed.tsx` (the iframe + `toEmbedUrl`, §4).

**⑥ `/ecc:accessibility` (skill) or `ecc:a11y-architect` (agent) — WCAG 2.2 audit**
*What it does:* Audits keyboard nav, ARIA, focus management, contrast for web + native.
*Why:* The expandable cards in `/units` + `/classes` are `<button>`s with no `aria-expanded`/`aria-controls`; the `/planner` modal needs `role="dialog"` + focus trap + Esc-to-close.

**⑦ `/ecc:e2e-testing` (skill) or `ecc:e2e-runner` (agent) — Playwright coverage**
*What it does:* Generates/maintains Playwright E2E journeys. *This repo already uses Playwright* (`e2e/teacher-workflow.spec.ts`, `e2e/student-semester.spec.ts`, +7 more) — so prefer this over the Vitest-based `/ecc:react-test`.
*Cover:* (a) `/units` expand subject→unit→toggle slides; (b) `/classes` expand class→switch tabs→view slides; (c) `/planner` open modal→fill→task appears.

**⑧ `ecc:performance-optimizer` (agent) or `/ecc:react-performance` (skill) — animation perf**
*What it does:* Finds render bottlenecks, unnecessary re-renders, layout thrash.
*Why:* `/units` and `/classes` deeply nest `AnimatePresence` + `layout` props (subject→unit→lesson). Fine at 3 subjects; will jank at 10+. Have it memoize rows and scope `layout`.

---

### Document

**⑨ `/ecc:update-docs` — sync docs/codemaps**
*What it does:* Updates `docs/CODEMAPS/*`, READMEs, and guides from source-of-truth. Existing `IMPROVEMENTS.md` / `ARCHITECTURE_AUDIT_V2.md` predate these pages.
*Run:* `/ecc:update-docs`

**Optional — `/ui-ux-pro-max` (skill):** UI/UX design intelligence (50+ styles, palettes, font pairings, a11y/animation guidance) if you want to polish the visual layer (`build`/`review`/`improve` actions on the new pages).

---

## 6. Suggested commit (work is clean & ready)

```bash
cd "Flux Planner"
git add web/
git commit -m "web: live calendar, staff Units/Classes + Google Slides, working New Task modal

- calendar-grid: real current month, Mon-first offset, prev/next nav, today highlight
- dashboard: time-of-day greeting + date + quick links (drop placeholder copy)
- planner: working New Task modal; TaskBoard now fully controlled
- command-palette + sidebar: Units & Classes routes; fix no-op GPA item
- new /units (curriculum) and /classes (roster) staff views
- new GoogleSlidesEmbed + SlidesLinkCard components

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```
*(Only `web/` is staged — keep the unrelated root/`supabase/` MCP-connector changes out of this commit.)*

---

### Quick reference — what each tool gives you
| Tool | Type | One-liner |
|------|------|-----------|
| `/ecc:plan` | skill | Step-by-step plan, waits for your OK before coding |
| `/ecc:feature-dev` | skill | End-to-end feature build with codebase context |
| `/ecc:react-review` | skill | React+TS review (hooks, perf, boundaries, a11y) |
| `/security-review` | skill | OWASP app-code vuln scan |
| `/ecc:accessibility` | skill | WCAG 2.2 audit + ARIA generation |
| `/ecc:e2e-testing` | skill | Playwright journey generation (matches this repo) |
| `/ecc:react-performance` | skill | React render/bundle optimization patterns |
| `/ecc:update-docs` | skill | Sync codemaps & docs from source |
| `/ui-ux-pro-max` | skill | UI/UX design system intelligence |
| `ecc:database-reviewer` | agent | Postgres/Supabase queries, RLS, schema |
| `ecc:security-reviewer` | agent | Deep app security remediation |
| `ecc:performance-optimizer` | agent | Profiling + bottleneck fixes |
| `ecc:a11y-architect` | agent | WCAG architecture for design systems |
