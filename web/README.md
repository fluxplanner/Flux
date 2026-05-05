# Flux Planner — Next.js shell

Premium motion layer (parallel to the static GitHub Pages app in the repo root).

## Stack

- Next.js 15 (App Router) · TypeScript · Tailwind CSS v4
- framer-motion · anime.js v4 · lucide-react
- Radix primitives + `cmdk` (command palette patterns aligned with **shadcn/ui** conventions: `cn()`, `components/ui`)

## Scripts

```bash
cd web
npm install
npm run dev    # http://localhost:3000
npm run build
```

## Routes

| Path        | Purpose                                      |
|------------|-----------------------------------------------|
| `/`        | Dashboard — glass panels, floats, stagger     |
| `/planner` | Drag-and-drop task board (@dnd-kit)           |
| `/ai`      | Flux AI chat demo + typing indicator          |
| `/sign-in` | Apple-style scroll section + magnetic CTAs    |

**⌘K / Ctrl+K** opens the command palette anywhere.

Legacy static planner remains at repo root (`index.html`); this app is deployable separately (e.g. Vercel as `web/` project).
