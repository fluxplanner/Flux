# Flux Planner — handoff brief

Written 2026-08-23, at the end of a long working session. Everything below is
either verified in a browser against the deployed build or traced to a specific
line. Where something is unverified, it says so.

**Live:** https://fluxplanner.github.io/Flux/ · **Repo:** fluxplanner/Flux ·
deploys from `main` via GitHub Pages.

---

## Read this first: five things that will otherwise waste your time

1. **Source edits do not ship.** `index.html` loads minified bundles from
   `public/bundles/`, not `public/js`. Run `npm run build:web` and stage the
   outputs, or the change silently does nothing. A pre-commit hook blocks stale
   bundles — don't bypass it, it is protecting you.

2. **CI and Pages only run on `main`.** Work on a branch is invisible to both.
   Before debugging any "broken in production" report, check whether a fix is
   already sitting on an unmerged branch — that was the cause of *seven* live
   bugs here, all fixed weeks earlier and never merged.

3. **A service worker precaches the bundles.** After deploying, a normal refresh
   can still serve the old build. Hard-reload or use a private window before
   concluding a change didn't work.

4. **`requestAnimationFrame` is paused in a backgrounded tab.** Any automated
   check that waits on rAF hangs forever headless. This masked a real bug (the
   splash screen stranding users) and cost real debugging time. Prefer
   `setTimeout` in test harnesses.

5. **The owner does not read code.** Explain in plain cause-and-effect, no file
   paths or jargon in chat, and give numbered click-by-click steps for anything
   he must do himself. He is decisive when given a clear choice.

---

## Current state

Ten PRs merged today (#11–#20), all green through Playwright, all deployed.

**Fixed:** seven stranded bug fixes finally shipped · guest staff signup no longer
produces a student account · Notes panel reachable again (two modules were
fighting over it) · blank teacher and counselor dashboards · calendar day-tap no
longer hijacked by quick-add · splash no longer strands backgrounded tabs ·
keyboard access for onboarding chips, calendar days and accent swatches · native
dropdowns and date pickers now follow the theme · tab-switch performance (two
rounds) · IAE bell-schedule preset · IAE 2026-27 school year.

**Broken, and not fixable in code:** Flux AI is down. All four Groq models return
`model_not_found`. The fallback ladder works correctly — server logs show it
walking all four in ~150ms — so this is the API key or account, not the code.
The owner has the steps. Until the key is replaced, nothing about AI can be tested.

---

## Where a fresh, long run genuinely helps

These are not beyond the previous agent. They are work that suffers when done at
the tail of a long session and benefits from sustained attention with a full
context budget.

### 1. Design-system consolidation (highest value, highest risk)

`.nav-item.active` is styled in **five** places: `styles.css`,
`flux-modern-ui.css`, `flux-motion.css`, `flux-claude-magic.css`, plus a light
theme override. There are **144 stylesheets** in the bundle. A sidebar indicator
was deliberately not added because it was not predictable which of the five would
win, and a wrong guess is a visible regression on a launched product.

This wants one agent holding the whole cascade at once: audit what overrides what,
collapse to tokens, delete dead rules. Guardrail: `npm run check:contrast`
enforces WCAG AA across 8 themes × 4 pairs and must keep passing. Work on a branch
and compare screenshots per theme.

### 2. Study Tools favourites — specifically requested, not built

The owner asked for this and the session ran out of runway. His words:

> *"I want to be able to favorite different classes in study tools so that you
> don't get mixed up or have to keep scrolling forever"*

Everything needed is in `public/js/flux-study-hub.js`:
- state persists to localStorage key `flux_study_hub`, shape
  `{subject, tool:{...}, chemTab, recent:[{sid,tid,name,icon}]}`
- there is already a `recordRecent()` and a `recent` array — favourites should sit
  beside it, not replace it
- the subject rail is `#fshRail .fsh-pill`; tools are `.fsh-chem-tab[data-tool]`
- `save()` near the top of the module persists state

Suggested shape: a star affordance on each subject pill and tool tab, favourites
pinned to the front of the rail, and a "Favourites" cluster above the rail when
any exist. Keep it re-runnable and never lose an existing selection.

### 3. The remaining accessibility work

An audit found **112 elements** with an `onclick` that were `div`/`span` with no
`role` and no `tabindex` — invisible to keyboard and screen readers. Three
clusters are fixed (onboarding chips, calendar day cells, accent swatches).
Remaining: the School Info cluster (8), AI/Notes (4), and two delete affordances.

More useful than finishing the list: **work out why `e2e/a11y.spec.ts` passes
while all of this exists.** It runs axe against the sidebar, topbar and the New
Task modal only. Widening it to the panels students actually use would catch the
next regression automatically. For a product sold to schools this is likely a
procurement requirement, not polish.

### 4. Admin "Users" panel has no user management

`adminDashboard` renders 239 characters and one button. Meanwhile
`openAdminUserManager`, `exportUsersCSV`, `filterUserList` and
`ownerAuthUsersLoad` all exist and work — `openAdminUserManager()` does open a
real User Management modal, it just takes ~2.5s against an unreachable backend
and then shows zero accounts. The functionality exists and is not surfaced. Needs
a real backend to develop against.

### 5. The 100-feature list

The owner produced a list of 100 features. A sample of 22 found **21 already had
implementations**, several with dedicated files (`flux-srs-deck-mode.js`,
`flux-gcal-2way.js`, `flux-deep-links.js`, `flux-mind-map-tasks.js`,
`flux-parent-portal.js`, `flux-task-template-marketplace.js`). Only the offline
queue looked genuinely absent.

**This is the most valuable item in this document.** Flux does not have a
missing-features problem, it has a *features-exist-but-are-unreachable* problem —
exactly what the Notes bug turned out to be. Before building anything from that
list, audit each item as built-and-working / built-but-unreachable / genuinely
missing. The second bucket is where the wins are, and they are cheap.

---

## Things to be careful about

- **Don't trust `getComputedStyle` in headless checks.** It returns wrong values
  in render-skipped subtrees. Trust the screenshot.
- **Don't resolve conflicts in `public/bundles/` by taking one side wholesale.**
  Doing that silently reverted a feature here; Playwright caught it. Cherry-pick
  source only, then rebuild.
- **Don't fabricate school calendar dates.** A wrong no-school day is something a
  student trusts and then misses class over. The IAE calendar in
  `flux-school-calendars.js` was read off the official PDF at 400 DPI and
  cross-checked two ways.
- **Verify against the deployed bundle, not just source.** A fix was twice nearly
  reported as live when it was not.

---

## Open question for the owner

On the calendar, a closure still shows its A/B letter — Sept 4 renders "A". That
is *correct* (the rotation ignores closures: a snow day consumes its slot rather
than pausing the cycle) but may read as "there is school" at a glance. It is a
display decision, so it was left to him.

---

## Useful commands

```
npm run build:web      # rebuild bundles — required for any public/js|css edit
npm run check:bundles  # verify bundles match source
npm run test:unit      # 109 tests
npm run test:flags     # feature flag registry
npm run check:contrast # WCAG AA across 8 themes
E2E_PORT=4199 npx playwright test    # full suite, ~3 min
```

Use `E2E_PORT` — Playwright otherwise reuses a stray server from another worktree
and you will test the wrong build.
