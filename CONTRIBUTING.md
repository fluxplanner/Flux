# Contributing to Flux Planner

## Frontend bundles — rebuild after editing `public/js/`

`index.html` loads **3 built bundles** from `public/bundles/`
(`flux-vendor.js`, `flux-core.js`, `flux-features.js`), **not** the individual
`public/js/*.js` files. A change to any `public/js/*.js` script does **not**
ship until the bundles are rebuilt.

After editing anything under `public/js/`:

1. `npm run build:web` — regenerates `public/bundles/*` (load order lives in `scripts/web-bundle-manifest.json`; add new scripts there, not to `index.html`).
2. Stage the rebuilt bundles: `git add public/bundles/`.
3. Bump the `STATIC` cache version in `service-worker.js` (else clients keep serving the old build).

This is enforced automatically:

- **CI** (`.github/workflows/bundle-freshness.yml`) fails any push/PR where `public/bundles/` is out of date with `public/js/`.
- **Pre-commit hook** (`.githooks/pre-commit`) runs the same check locally. It is wired automatically by `npm install` (`prepare` sets `core.hooksPath=.githooks`); to enable manually, run `git config core.hooksPath .githooks`.

Run the check on demand with `npm run check:bundles`.
