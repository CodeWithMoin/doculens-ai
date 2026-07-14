# DocuLens web

The DocuLens web application combines a public product experience with an authenticated document-intelligence workspace. It is built with React 19, TypeScript, Vite, TanStack Query, and a small token-driven component system.

## Routes

| Route | Experience |
| --- | --- |
| `/` | Public product landing page |
| `/login` | Workspace authentication |
| `/app` | Document intake and workspace overview |
| `/app/qa` | Citation-first document chat |
| `/app/work-queues` | Review and processing queues |
| `/app/pipeline` | Pipeline activity and diagnostics |
| `/app/settings` | Workspace preferences |

Protected routes redirect unauthenticated users to `/login`. Product routes are lazy-loaded so the public landing page does not pay the cost of the authenticated workspace bundle.

## Local development

```bash
npm ci
npm run dev
```

Vite proxies `/api` to `http://localhost:8080` by default. Run the backend stack from the repository root with `make up`, or configure the target in `vite.config.ts`.

```bash
npm run lint
npm run build
npm run preview
```

## Design system

Global semantic tokens, motion primitives, focus treatment, and dark-mode behavior live in `src/styles/globals.css`. Reusable primitives live in `src/components/ui`; product identity is isolated in `src/components/brand`. The interface uses native CSS motion with a `prefers-reduced-motion` fallback to keep the initial bundle small.

The complete system rationale is documented in [`../docs/design-system.md`](../docs/design-system.md).
