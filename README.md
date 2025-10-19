# DocuLens AI Console

DocuLens AI is a full-stack document intelligence workstation. The FastAPI/Celery
backend ingests files, runs summarisation and retrieval pipelines, and exposes a
task-driven event API. The React (Vite + TypeScript) console gives analysts,
operations teams, and integrators a control room for uploads, work queues, QA,
and governance.

This repository contains the entire stack used in local development and CI:
pipelines, Timescale/pgvector integration, a modern UI, and supporting scripts.

---

## Highlights

- **Event-driven pipelines** – Queue `document_upload`, `document_summary`,
  `qa_query`, and related events. Celery orchestrates extraction, chunking,
  embedding, and persistence to Timescale Vector.
- **Operator-first console** – Intake dashboards, role-aware work queues
  (Finance, Compliance, Operations, Legal, HR, Integrator), and the dedicated QA
  Studio keep reviewers in flow.
- **Retrieval-augmented QA** – QA Studio streams pending questions, polling for
  answers without requiring A page reload. Pending states surface inline with
  animated typing indicators and citations.
- **Insights & notifications** – Uploads, QA completions, and routing actions
  raise toasts and persist in the activity feed. Polling keeps stakeholders
  informed when answers or summaries finish processing.
- **Governance-ready settings** – Persona selection, API key management, and
  configurable limits (chunk preview, QA `top_k`, search result counts) are
  exposed in the console with local persistence.
- **Comprehensive automation** – Docker Compose environments, smoke-test
  scripts, pytest coverage, and GitHub Actions ensure the pipelines remain
  reliable as the product evolves.

---

## Architecture at a Glance

```text
┌──────────────────┐        ┌──────────────────────┐        ┌──────────────────┐
│ React Console    │ ─────▶ │ FastAPI Gateway      │ ─────▶ │ PostgreSQL/      │
│ (Vite + TS)      │        │  /events endpoints   │        │ Timescale + pgvec│
└──────────────────┘        │   └ Celery dispatcher│        └──────────────────┘
         ▲                  │                      │                 ▲
         │                  └──────────────┬──────┘                 │
         │                                 │                        │
         │                  ┌──────────────▼───────────────┐        │
         └──────────────────┤ Celery Worker (pipelines)    │ ◀──────┘
                            │  • chunking & embedding      │
                            │  • summarisation & QA        │
                            │  • semantic search           │
                            └──────────────────────────────┘
```

**Backend**: FastAPI, SQLAlchemy, Celery, TimescaleDB + pgvector, Redis  
**LLM/Retrieval**: OpenAI/Anthropic (configurable), in-house chunker/tokeniser  
**Frontend**: React 18, TypeScript, Vite, Tailwind, shadcn/ui components  
**Tooling**: Docker Compose, pytest, GitHub Actions, scripts for smoke testing

---

## Repository Layout

```text
app/                FastAPI application, pipelines, Celery tasks
frontend/           React console (Vite + TypeScript)
docker/             Container definitions and compose files
requests/           Sample payloads and helper scripts
scripts/            Developer utilities and smoke tests
tests/              Pytest suite covering API & pipelines
.github/workflows/  Continuous integration pipelines
```

---

## Getting Started

### Prerequisites

- Python 3.12+
- Node.js 18+
- Docker Desktop (Postgres/Timescale, Redis, ancillary services)
- OpenAI or Anthropic credentials (configure in `.env`)

### 1. Clone & configure environment

```bash
git clone <repo-url>
cd "Doculens AI"
cp .env.example .env
# edit .env with provider keys, database overrides, and doculens settings
```

Key variables:

| Variable | Purpose |
| --- | --- |
| `DOCULENS_SUMMARY_CHUNK_LIMIT` | Max chunks fed into the summariser |
| `DOCULENS_QA_TOP_K` | Retrieval breadth for QA Studio |
| `DOCULENS_SEARCH_RESULT_LIMIT` | Default search pagination |
| `DATABASE_*` | Optional overrides when not using Docker Postgres |
| `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` | LLM provider credentials |

### 2. Start the stack

```bash
./scripts/dev_stack.sh         # boots Postgres, Redis, API, worker, UI
```

Backends start on `http://localhost:8080`, the console on `http://localhost:5173`.

### 3. Frontend in development mode

```bash
cd frontend
npm install
npm run dev
```

### 4. Run tests

```bash
.venv/bin/python -m pytest     # backend + pipeline coverage
```

---

## Everyday Workflows

1. **Upload documents** – use the Intake page or POST to `/events/documents/upload`.
   Uploaded files appear in the Intake dashboard and work queues with automatic
   status tags.
2. **Process & route** – Work Queues group documents by inferred or assigned
   role (Finance, Compliance, Operations, Legal, HR, Integrator). HR-specific
   labels (Resume/CV, Offer Letter, Training Certificate, etc.) now stay within
   the HR lane.
3. **Summarise** – Document detail pages expose “Summarise again”. If no
   summary exists, placeholders prompt operators to run one (and the processing
   timeline remains visible).
4. **Ask questions** – QA Studio stores per-document chat history, keeps pending
   messages visible with typing indicators, and pulls in completed answers
   automatically—no page refresh needed.
5. **Stay informed** – Notification toasts and the bell keep track of uploads,
   QA completions, routing changes, and summary jobs.

---

## API Quick Reference

All routes live under `/events`. Authentication is controlled via the header
defined by `DOCULENS_API_KEY_HEADER` when `DOCULENS_API_KEY` is set.

| Method | Route | Description |
| --- | --- | --- |
| `POST` | `/events/documents/upload` | Multipart upload (`file`, `doc_type`, `metadata`) |
| `POST` | `/events` | Generic event ingestion (summary, QA, search, routing) |
| `GET` | `/events/documents` | Latest documents + metadata |
| `GET` | `/events/qa/history` | Historical QA answers, citations, reasoning |
| `GET` | `/events/search/history` | Semantic search history with snippets |
| `GET` | `/events/insights/dashboard` | Throughput, SLA risk, ROI metrics |

Example upload:

```bash
curl -X POST "http://localhost:8080/events/documents/upload" \
  -H "X-API-Key: ${DOCULENS_API_KEY:-local-dev}" \
  -F "file=@/path/to/document.pdf" \
  -F 'doc_type=resume' \
  -F 'metadata={"role":"HR","source":"careers-portal"}'
```

---

## Testing & Automation

- **Unit & integration tests:** `pytest` targets FastAPI endpoints, pipeline
  orchestration, and dashboard metrics.
- **Smoke tests:** `scripts/backend_smoke.sh` replays sample events. Use
  `requests/send_event.py` to post custom payloads.
- **Continuous integration:** `.github/workflows/backend-ci.yml` runs linting
  and pytest on every push/PR.
- **Frontend builds:** `npm run build && npm run preview` produce a static Vite
  bundle for deployment.

---

## Roadmap & Ideas

- Harden production deployment (container images + helm charts).
- Add role-based access controls inside the console.
- Expand analytics with richer HR/Finance KPIs and Prometheus scraping.
- Extend extraction pipelines with structured field capture.

---

## License

DocuLens AI is released under the CodeWithMoin license. Refer to
[`LICENSE`](LICENSE) for terms.

