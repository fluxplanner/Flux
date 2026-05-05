# Flux scroll capabilities (React + Tailwind + Framer Motion)

The main **Flux Planner** repo at the workspace root is **static HTML/CSS/JS** (GitHub Pages style). It does **not** include React, TypeScript, Tailwind, or shadcn. This folder is a **self-contained Vite app** so you can run the scroll-stroke showcase without converting the entire product to React.

## Default paths (this mini-app)

| Purpose | Path |
|--------|------|
| **UI / shadcn-style components** | `src/components/ui/` |
| **Global styles + Tailwind layers** | `src/index.css` |
| **Utilities (`cn`, etc.)** | `src/lib/utils.ts` |
| **Path alias `@/`** | → `src/` (see `vite.config.ts` + `tsconfig.json`) |

### Why `components/ui` matters

The **shadcn CLI** installs primitives into `components/ui` by convention. Keeping that folder:

- Matches official docs and community examples (`import { Button } from "@/components/ui/button"`).
- Avoids merging generated code with your own feature components in `components/`.
- Makes upgrades and `npx shadcn@latest add …` predictable.

If you start a **new** Next.js app from scratch, initialize shadcn **before** moving files around so `components.json` points at `@/components/ui`.

## Run this showcase

```bash
cd showcase/scroll-capabilities
npm install
npm run dev
```

Build static files:

```bash
npm run build
npm run preview
```

Output is in `dist/` — you can host it beside `index.html` or link from marketing.

## If you want a fresh Next.js + shadcn + Tailwind + TypeScript app

From an **empty** directory (not required for this showcase):

```bash
npx create-next-app@latest flux-web --typescript --tailwind --eslint --app --src-dir
cd flux-web
npx shadcn@latest init
```

Then copy `src/components/ui/svg-follow-scroll.tsx` and `src/lib/utils.ts` (if not already created by shadcn), install `framer-motion` and `lucide-react`, and import the component in a route:

```tsx
import { FluxScrollCapabilities } from "@/components/ui/svg-follow-scroll";

export default function Page() {
  return <FluxScrollCapabilities />;
}
```

## Dependencies (already in `package.json`)

- `framer-motion` — scroll-linked `pathLength` / stroke animation  
- `lucide-react` — capability icons  
- `tailwindcss` + `postcss` + `autoprefixer`  
- `clsx` + `tailwind-merge` — typical `cn()` helper used by shadcn

## Component notes

- The original snippet called `useTransform` **inside** a `style={{ … }}` object — that violates the Rules of Hooks. **`LinePath`** now declares both `pathLength` and `strokeDashoffset` at the top of the component.
- **`"use client"`** is harmless in Vite; it matters for Next.js App Router.
- Export **`FluxScrollCapabilities`** is the Flux-branded section; **`Skiper19`** is kept as an alias for compatibility with the reference `demo.tsx` name.

## Where to use it in the product

- **Marketing / landing** route (separate deploy or subdomain).  
- **Embedded iframe** from the static Flux site (if you expose this build URL).  
- **Future** monorepo: move `showcase/scroll-capabilities` into `apps/marketing` and wire Turborepo/pnpm workspaces.

Integrating the same effect **inside** the current vanilla `index.html` login shell would require a **non-React** port (e.g. CSS scroll-driven animations or `anime.js` + `IntersectionObserver`), not this file.
