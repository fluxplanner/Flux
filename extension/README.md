# Flux — Universal browser extension

Flux side rail for **every major browser**: Chrome, Arc, Edge, Brave, Opera,
Vivaldi (all Chromium → one build), plus Firefox and Safari. It always sees
your current tab (fresh text snapshot + optional live screenshot), streams
answers from Flux AI, renders math properly, and hands off sign-in from the
planner.

## Build

```bash
npm run ext:chrome     # → dist/chrome   (Chrome, Arc, Edge, Brave, Opera, Vivaldi)
npm run ext:firefox    # → dist/firefox
npm run ext:safari     # → dist/safari   (wrap with Xcode's safari-web-extension-converter)
npm run ext:all        # all three
```

## Install

| Browser | Steps |
|---|---|
| **Chrome / Brave / Opera / Vivaldi** | `chrome://extensions` → Developer mode → Load unpacked → `dist/chrome` |
| **Arc** | `arc://extensions` → Developer mode → Load unpacked → `dist/chrome`. Arc shows the rail via the extension icon; if Arc's sidebar doesn't open it, Flux automatically falls back to a popout window. |
| **Edge** | `edge://extensions` → Developer mode → Load unpacked → `dist/chrome` |
| **Firefox** | `about:debugging#/runtime/this-firefox` → Load Temporary Add-on → `dist/firefox/manifest.json` (uses `sidebar_action`) |
| **Safari** | `xcrun safari-web-extension-converter dist/safari` → run the generated Xcode project (no side panel: opens as a popover/window) |

## How it works

```
extension/
  manifest.chrome.json     MV3 + sidePanel (all Chromium browsers)
  manifest.firefox.json    MV3 + sidebar_action
  manifest.safari.json     trimmed MV3 for the Safari converter
  src/
    background.js          on-demand page snapshots (content script →
                           scripting.executeScript fallback), context menus,
                           omnibox `fx`, AI streaming port, auth handoff
    content.js             reactive page readers (per-site extractors) +
                           planner→extension session relay
    sidebar/               the rail UI: live context bar, streaming chat,
                           markdown + LaTeX (flux-tex) rendering
    popup/                 sign-in entry + planner host override
    lib/
      browser-shim.js      chrome.*/browser.* differences in one place
      api.js               config discovery, auth/refresh, two-stage
                           vision (transcribe → reason), SSE streaming
      page-context.js      Canvas/Gmail/Docs/YouTube/etc. extractors
  build.mjs                esbuild → per-browser bundles in dist/
```

Key behaviors:

- **Page awareness** — every message pulls a fresh snapshot of the active tab;
  works on tabs that were open before install. With **Live** on, a screenshot
  rides along and a vision model transcribes it so the strong reasoning model
  does the solving (two-stage = right answers on homework).
- **Sign-in** — popup → "Sign in to Flux" opens the planner with `?ext_auth=1`;
  after login the planner hands the session to the extension and the tab
  closes itself. Tokens auto-refresh; signed-out calls use the anon key.
- **Config** — no hardcoded URLs: the extension loads `config.json` from the
  planner host (override in the popup), with a baked-in fallback.
- **Resilience** — the AI proxy steps down a model ladder on rate limits, so
  a saturated model degrades quality slightly instead of erroring.

## Cross-browser notes

| Feature | Chromium (Chrome/Arc/Edge/Brave/…) | Firefox | Safari |
|---|---|---|---|
| Side rail | `chrome.sidePanel` (popout fallback) | `sidebarAction` | popover/window |
| Page snapshot | content script + `scripting` | same | same |
| Screenshot (Live view) | `tabs.captureVisibleTab` | same | where granted |
| Context menus | ✓ | ✓ | n/a (graceful) |
| Omnibox `fx` | ✓ | ✓ | n/a |
| Auth handoff | ✓ | ✓ | ✓ (content-script relay, no externally_connectable needed) |

## Testing

```bash
node scripts/ext-smoke.mjs        # real Chromium + live proxy: context tracking,
                                  # page-aware answer, vision answer, math rendering
node scripts/ext-auth-smoke.mjs   # sign-in handoff: session stored, tab closes,
                                  # foreign origins rejected
```
