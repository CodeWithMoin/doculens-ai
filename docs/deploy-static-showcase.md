# Deploy the zero-cost static showcase

The recommended portfolio deployment is a static, read-only product tour on Cloudflare Pages. It bundles the same synthetic six-document workspace used by the backend demo, so recruiters can explore the complete UI without a database, API server, model key, or paid compute.

## What this deployment demonstrates

- the landing page and complete responsive application shell;
- document summaries, classification, ownership, and pipeline status;
- evidence-first Ask DocuLens history with confidence and citations;
- command search, work queues, activity, taxonomy, dark mode, and keyboard navigation.

It intentionally does not accept uploads, execute live model calls, or persist visitor changes. That boundary keeps the public link safe and predictable while the repository still contains the full FastAPI, Celery, PostgreSQL, and RAG implementation.

## Deploy with Cloudflare Pages

1. In Cloudflare, open **Workers & Pages**, create a Pages application, and connect `codewithmoin/doculens-ai`.
2. Select the branch to publish (`main` after the portfolio PR is merged).
3. Configure the build:

   | Setting | Value |
   | --- | --- |
   | Framework preset | Vite |
   | Root directory | `frontend` |
   | Build command | `npm run build:showcase` |
   | Build output directory | `dist` |
   | Node version | `20` |

4. Do not add API keys, database credentials, or model-provider secrets. This build does not use them.
5. Deploy. Cloudflare will publish a `pages.dev` URL and rebuild it when the selected Git branch changes.

The included `_redirects` file sends direct SPA routes such as `/app/qa` and `/app/pipeline` to the React entry point. `_headers` adds conservative browser security headers and immutable caching for fingerprinted assets.

## Validate before sharing

Run the exact production build locally:

```bash
cd frontend
npm ci
npm run build:showcase
npm run preview -- --host 127.0.0.1
```

Verify these URLs in a private browser window:

- `/` explains the product before asking visitors to enter the workspace;
- `/app` opens without a login or backend service;
- `/app/qa` shows the cited Acme renewal answer;
- `/app/pipeline` shows all six synthetic documents;
- the header says **Read-only showcase · synthetic data**;
- the browser Network panel contains no failed API requests.

## Optional custom domain

A custom domain is not required for interviews. The generated `pages.dev` URL is enough. If you already own a domain, add a subdomain such as `demo.example.com` in the Pages dashboard; keep the generated URL available as a fallback.

## When to use the full-stack deployment

Use the [single-node showcase](deploy-showcase.md) only when someone specifically needs to inspect real HTTP API behavior or you want to demonstrate the database-backed seed. It costs more and has a larger operational surface. For recruiter and founder walkthroughs, the static deployment communicates the product while the source code communicates the production architecture.
