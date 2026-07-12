# P46 — OriginKit motion primitives (M1)

**Step ID:** `P46-ORIGINKIT-MOTION`
**Flag:** `enable_originkit_motion` (default **on**)
**Motion initiative:** M1 (foundation)

The first increment of the "make the whole site feel alive" work. OriginKit
ships React/Framer components; Flux is a vanilla PWA with its own engine
(`FluxAnim`). Rather than add React islands, this ports the *interaction
patterns* into reusable, CSS-first primitives on the canonical `FluxAnim`
owner — a shared vocabulary the rest of the initiative builds on.

## Primitives (all reduced-motion / perf / lowend safe)

| Primitive | `FluxAnim.*` / attribute | Use |
|-----------|--------------------------|-----|
| Border beam | `borderBeam` · `data-flux-beam` | CTA / insight-card accent ring |
| Shimmer text | `shimmerText` · `data-flux-shimmer` | greeting, AI stream headline |
| Breathing glow | `breathingGlow` | timer, at-risk cell (calm, non-alarming) |
| Tilt card | `tiltCard` · `data-flux-tilt` | audience / feature cards (3D + glare) |
| Spotlight | `spotlight` · `data-flux-spotlight` | pointer-follow highlight on cards |
| Magnet | `magnet` · `data-flux-magnet` | buttons |
| Stagger list | `staggerList` · `data-flux-stagger` | domino reveal on scroll-in |
| Count-up | `countUp` · `data-flux-countup` | stat bands (spring ease, "57+" aware) |

## Architecture

- **Module:** `public/js/flux-originkit-motion.js` — classic IIFE, extends
  `window.FluxAnim` when present AND self-inits standalone on `landing.html`
  (which loads no bundle/flag system). Auto-wires `data-flux-*` on load +
  `flux-nav`; idempotent.
- **CSS:** `public/css/flux-originkit-motion.css` — `@property`-driven beam,
  clip-text shimmer, transform tilt/magnet, stagger; a
  `@media (prefers-reduced-motion: reduce)` block is a hard CSS belt on top
  of the JS gate.
- **Safety (the point):** `active()` is false whenever
  `prefers-reduced-motion`, `.flux-reduce-motion`, `data-flux-perf=on`, or
  `data-flux-lowend` is set — **regardless of the flag**. Everything is
  one-shot or pointer-driven (no perpetual rAF on data views) → Chromebook
  safe. No localStorage, no tables, no student-system coupling.
- **Flag:** default **on** (subtle micro-interactions); districts can force
  off fleet-wide via `flux_school_feature_flags`. Migration
  `20260711140000_originkit_motion_flag.sql`, reversible.

## Wired this increment

- `landing.html`: stat count-up (×4), audience-card tilt+spotlight,
  feature-card stagger+spotlight, final-CTA beam+magnet.
- `index.html`: dashboard greeting + AI greeting shimmer.

## Tests

Unit: `test/unit/originkit-motion.test.mjs` (ease/parse/format — 5 tests,
"57+" round-trip). E2E: `e2e/originkit-motion.spec.ts` (load+extend+shimmer,
three kill switches, flag-off, count-up target, idempotent tilt — 5 tests).
Live-verified in preview: greeting gradient renders, zero console errors,
all three overrides flip `active()` to false.

## Dev / kill switch

```javascript
// force off everywhere:
window.FLUX_EXPERIMENTS = { enable_originkit_motion: false };
await FluxFeatureFlags.load({ force: true });
```

## Rollback

Disable the flag (or set `data-flux-perf="on"` on `<html>`): all primitives
go inert, classes stop animating (CSS belt), `data-flux-*` attributes are
harmless no-ops. Drop the flag row via the migration rollback. No residue.

## M2 — Onboarding step transitions (done)

`FluxMotion.stepTransition(inEl, dir)` gives the 6-step onboarding a
directional slide+fade (forward from the right, back from the left) with a
child-chip stagger, plus a pop on the newly-active progress dot. Wired in
`showObStep` (direction computed against the outgoing step before
`obCurrentStep` updates). Reduced-motion / perf / lowend safe; e2e covers
the directional `--ob-dir` + stagger index.

## M3 — Gamification unlock ceremonies (done)

`FluxMotion.celebrate(kind, opts)` — the audit's single celebration owner.
`'unlock'` = accent wash + confetti + label card (seasons cosmetic unlock);
`'calm'` = soft wash, no confetti (shutdown ritual complete); `'win'` =
confetti only. Full-viewport, pointer-through, self-removing (~1.15s + fade).
Wired: `FluxSeasons.earn` newUnlocks branch (keeps the actionable toast for
reduced-motion), and the `shutdown_completed` emit site. Motion-gated;
reduced-motion renders nothing. E2E: mount+self-remove, pointer-through,
reduced-motion no-op.

## M4 — Educator panels + AI cards (done)

`autoEnhance(panelId)` applies spotlight/stagger to async-rendered panels
**by real class name** — no markup edits to 30+ renderers. A per-panel
`ENHANCE` map lists selectors (`.lh-class-card`, `.ao-stat`,
`.flux-ai-proposal`, …). Because educator dashboards render after Supabase
round-trips at unpredictable times, `autoEnhanceWatched` runs it once then
attaches a MutationObserver for ~2.5s, re-enhancing as content lands (all
primitives idempotent), then disconnects. Fired from the `flux-nav` handler.
E2E: lesson-hub class cards spotlit + list staggered after async render;
no-op for unlisted panels and under reduced-motion.

The live AI SSE bubble was deliberately left untouched (protected stream
path); AI text treatment is the greeting shimmer (M1) + proposal-card
stagger here.

## M5 — Broad sweep (next)

Extend the `ENHANCE` map + `data-flux-*` attributes to the student panels
(dashboard, settings, toolbox, notes, calendar). (Later) Lottie pipeline
(`enable_lottie_delight`) for empty states + season confetti packs.
