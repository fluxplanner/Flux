# P20.1 — Automation URL hooks

**Step ID:** `P20-AUTOMATION-HOOKS`  
**Flag:** `enable_automation_hooks` (default **off**)  
**Backlog #67**

Documents and extends Flux URL schemes for iOS Shortcuts, Android intents, and bookmarklets.

## Hooks

| URL | Action |
|-----|--------|
| `?quick=task` | Dashboard + quick add (optional `&text=` prefills) |
| `?quick=focus` | Focus Timer + start session |
| `?quick=timer` | Focus Timer tab |
| `?quick=mood` | Mood check-in |
| `?quick=note` | Notes tab |
| `?panel=calendar` | Calendar tab |
| `?panel=dashboard` | Dashboard |

Entity deep links (`?task=`, `?note=`) remain on `enable_deep_links` (P12.1).

## Dev enable

```javascript
window.FLUX_EXPERIMENTS = { enable_automation_hooks: true };
await FluxFeatureFlags.load({ force: true });
location.reload();
```

**Settings → Data** → Automation hooks card with copy buttons.

## Rollback

Disable flag — legacy `?quick=task` / `?quick=ai` in `handleDeepLinkParams` unchanged; extended hooks inactive.

Migration: `20260531800000_automation_hooks.sql`
