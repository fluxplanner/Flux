# Flux — Universal browser extension

Gemini-style side rail for the Flux Planner that runs in **Chrome, Edge, Brave, Arc, Firefox, and Safari**. Knows what tab you're on, captures into the planner, runs skills, and chats with Flux AI without leaving the page.

## Why this replaces `chrome-extension/` and `flux-extension/`

Both legacy extensions are Chrome-only and depend on hardcoded Supabase URLs.
This rewrite:

- Targets MV3 with per-browser manifest variants
- Uses a `browser-shim.ts` polyfill so the same code runs everywhere
- Loads `config.json` from the planner domain at boot — no hardcoded URLs
- Shares auth with the web app via `externally_connectable`
- Falls back gracefully where browsers diverge (Safari has no sidePanel → popover)

## File map

```
extension/
  manifest.chrome.json       MV3 + sidePanel + scripting
  manifest.firefox.json      MV3 + sidebar_action + activeTab
  manifest.safari.json       Safari Web Extension wrapper
  src/
    background.js            Service worker: AI proxy + auth bridge + capture
                             + "fx" omnibox + context menus
    content.js               Page reader (Canvas/Gmail/Docs/YT/etc.)
    sidebar/                 Side-rail UI (chat + skills + actions)
      sidebar.html
      sidebar.js
      sidebar.css
    popup/                   Browser-action popup (sign-in entry + planner host)
      popup.html
      popup.js
    lib/
      browser-shim.js        chrome.* / browser.* polyfill
                             (incl. storage.session → local TTL fallback)
      api.js                 Planner config loader + AI proxy client
      page-context.js        Per-page extractors
  icons/
  build.mjs                  esbuild → per-browser bundles (dist/<target>)
```

## Cross-browser strategy

| Feature            | Chrome / Edge / Brave / Arc | Firefox                | Safari               |
|--------------------|----------------------------|------------------------|----------------------|
| Side rail          | `chrome.sidePanel`         | `sidebarAction`        | popover (action)     |
| OAuth              | `chrome.identity`          | `browser.identity`     | `webAuthFlow` popup  |
| Storage            | `storage.session` + local  | `storage.local` + TTL  | `storage.local` + TTL |
| Context menus      | `chrome.contextMenus`      | `browser.contextMenus` | n/a (graceful)       |
| Page capture       | `tabs.captureVisibleTab`   | same                   | same (where granted) |
| External messages  | `externallyConnectable`    | runtime.onMessage      | `messages` (limited) |

## Build

```bash
node extension/build.mjs --target=chrome    # → dist/chrome
node extension/build.mjs --target=firefox   # → dist/firefox
node extension/build.mjs --target=safari    # → dist/safari (Xcode wrapper)
```

## Skills + AI

The extension shares the same skill registry as the web app
(`/public/js/flux-skills.js`). When the side rail receives a slash command,
it calls the AI proxy via `src/lib/api.js`. AI responses can include a fenced
`\`\`\`skill\`\`\`` block that the extension parses and executes — same as in
the web app.

## Install (unpacked, while unlisted)

```bash
npm run ext:all        # builds dist/chrome, dist/firefox, dist/safari
```

- **Chrome / Edge / Brave / Arc**: chrome://extensions → Developer mode → "Load unpacked" → `dist/chrome`
- **Firefox**: about:debugging → This Firefox → "Load Temporary Add-on…" → `dist/firefox/manifest.json`
- **Safari**: `xcrun safari-web-extension-converter dist/safari` → run the generated Xcode project

The extension reads `config.json` from the planner host at boot (AI proxy +
app URL) — change hosts from the popup without rebuilding.

## Status

| Component         | State    |
|-------------------|----------|
| Manifests         | shipped  |
| Browser shim      | shipped  |
| Background        | shipped (incl. FLUX_GET_TAB_CONTEXT) |
| Content reader    | shipped  |
| Side rail UI      | shipped (page context reaches the model) |
| Popup             | shipped  |
| Omnibox `fx`      | shipped  |
| Context menus     | shipped  |
| Icons             | shipped  |
| OAuth             | scaffold (proxy accepts anonymous calls) |
| Build pipeline    | shipped (`npm run ext:all`) |
| Safari packaging  | converter-ready (Xcode wrapper not committed) |

Once stable, `chrome-extension/` and `flux-extension/` can be deleted.
