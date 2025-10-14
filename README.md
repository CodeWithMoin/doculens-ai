# DocuLens AI Console

DocuLens is our end-to-end document intelligence platform: a FastAPI/Celery
backend orchestrates ingestion, summarisation, semantic search, and Q&A, while
the React console provides the control room for analysts to triage documents in
real time.

This repository contains everything needed to run the DocuLens stack locally or
in CI, including the pipelines, Timescale/pgvector integration, and a frontend
designed for rapid operator feedback.

---

## Feature Highlights

- **Event-driven ingestion pipeline** – Queue `document_upload` events and let
  the Celery worker orchestrate extraction, chunking, embedding, and storage.
- **LLM-powered summaries** – Trigger `document_summary` jobs that read from the
  vector store with configurable chunk limits.
- **Semantic search & QA** – Use the `/events/search/history` and
  `/events/qa/history` endpoints (or the workspace UI) to explore results with
  preserved metadata and references.
- **Persona-aware React console** – Analysts, operations managers, business
  stakeholders, and integrators each get tailored quickstarts, metrics, and copy.
- **Notifications & activity feed** – Uploads, QA jobs, and search results raise
  toasts and surface in a persistent notification bell and dashboard feed.
- **Governance-ready settings** – Revamped settings page with API key controls,
  persona selection, and integration playbook snippets for faster onboarding.
- **Insights dashboard** – Backend `/events/insights/dashboard` aggregates
  throughput, ROI, compliance, and SLA risk for the operations KPIs.
- **Automated verification** – Pytest suite and GitHub Actions workflow assert
  API behaviour, event dispatch, and pipeline defaults on every push (including
  coverage for the dashboard insights endpoint).

---

## Architecture Overview

```text
┌──────────────────┐        ┌──────────────────────┐        ┌──────────────────┐
│ React Console    │ ─────▶ │ FastAPI Gateway      │ ─────▶ │ PostgreSQL/      │
│ (Vite + TS)      │        │  /events endpoints    │        │ Timescale + pgvec│
└──────────────────┘        │   └ Celery dispatcher │        └──────────────────┘
         ▲                  │                      │                 ▲
         │                  └──────────────┬──────┘                 │
         │                                 │                        │
         │                  ┌──────────────▼───────────────┐        │
         └──────────────────┤ Celery Worker (pipelines)    │ ◀──────┘
                            │  • chunking/embedding        │
                            │  • summaries / QA / search   │
                            │  • vector store operations   │
                            └──────────────────────────────┘
```

Key technologies:

- **Backend:** FastAPI, SQLAlchemy, Celery, Timescale Vector, OpenAI/Anthropic LLM
- **Storage:** PostgreSQL/TimescaleDB for events and vectors, Redis for Celery
- **Frontend:** React 18, TypeScript, Vite, CSS Modules
- **Tooling:** Docker Compose, pytest, GitHub Actions

---

## Repository Layout

```text
app/                # FastAPI application, pipelines, services, tasks
frontend/           # React console (Vite + TypeScript)
docker/             # Docker Compose + container assets
requests/           # Example event payloads & sender script
scripts/            # Smoke tests and operational helpers
tests/              # Pytest suite covering API + pipeline logic
.github/workflows/  # Continuous integration configuration
```

---

## Getting Started

### Prerequisites

- Python 3.12+
- Node.js 18+
- Docker Desktop (for Postgres/Timescale, Redis, and auxiliary services)
- Make sure you have OpenAI (or Anthropic) credentials configured in `.env`
  according to `app/config/llm_config.py`.

### 1. Clone and set environment variables

```bash
git clone <your repo url>
cd Doculens AI
cp .env.example .env   # if you already have one, update values below instead

# Required env vars (set in .env)
export DOCULENS_API_KEY="your-local-key"          # optional for local dev
export DOCULENS_API_KEY_HEADER="X-API-Key"       # customise if needed
export DOCULENS_SUMMARY_CHUNK_LIMIT=12
export DOCULENS_QA_TOP_K=5
export DOCULENS_SEARCH_RESULT_LIMIT=10
export DOCULENS_CHUNK_PREVIEW_LIMIT=25

# Database overrides if you prefer local Postgres over docker defaults
export DATABASE_HOST=localhost
export DATABASE_USER=postgres
export DATABASE_PASSWORD=postgres
export DATABASE_NAME=doculens
```

> The backend falls back to sane defaults, but setting the `DOCULENS_*`
> variables lets you expose consistent limits to the frontend and pipelines.

### 2. Bootstrap backend services (one-liner)

You can launch the full stack—Docker services, FastAPI, Celery, and the Vite
console—with the helper script:

```bash
./scripts/dev_stack.sh
```

The script:

- Stops any stray dev processes and frees ports 8080/5173
- Restarts the Postgres/Redis containers via Docker Compose
- Runs `uvicorn` and the Celery worker from your virtualenv
- Starts `npm run dev` inside `frontend/`

Leave it running while you work; press `Ctrl+C` to shut down the app processes
(containers are left running for quick restarts).

### Manual start (if you prefer)

```bash
# Create a Python virtual environment
python3 -m venv .venv
source .venv/bin/activate

# Install backend dependencies
pip install --upgrade pip
pip install -r app/requirements.txt

# Start Postgres/Timescale & Redis
docker compose -f docker/docker-compose.yml up -d database redis

# Apply database migrations (UUID events table)
./app/migrate.sh   # or alembic upgrade head

# Run the API (localhost:8080) and Celery worker
uvicorn app.main:app --reload --host 0.0.0.0 --port 8080
# in another terminal
celery -A tasks.tasks worker --loglevel=info
```

### 3. Launch the React console

```bash
cd frontend
npm install
npm run dev   # defaults to http://localhost:5173
```

If you used `scripts/dev_stack.sh`, the console is already running. Otherwise
open it in a browser, navigate to **Settings**, and set the API base URL (e.g.
`http://localhost:8080`). If you configured an API key, paste it into the
console; otherwise leave blank for local development.

---

## Using DocuLens

### Document ingestion

1. Go to **Documents → Upload new document** in the console, or POST to
   `/events/documents/upload` with a multipart request (see below).
2. The API persists the file under `data/ingestion/` and enqueues a
   `document_upload` event.
3. The Celery worker runs extraction, chunking, embedding, and stores the task
   context on the `events` table.

### Summaries

- From the document detail page, press **Summarise Again**. The frontend POSTs a
  `document_summary` event with the configured chunk limit.
- The summary is displayed alongside bullet points, next steps, and source chunk
  counts.

### Semantic search & QA

- Use the **Workspace** tab to trigger semantic searches or corpus-wide QA.
- Results and QA responses are appended to `/events/search/history` and
  `/events/qa/history`, which the console reads to populate preview panes.

### Notifications & activity feed

- Actions you take (uploads, summaries, QA requests) trigger toasts via the
  notification bell; the **Recent activity** card on the Documents page keeps a
  scrolling history of the latest pipeline events.
- The console also polls for new QA answers and search results, alerting you
  when a response is ready without a manual refresh.

---

## API Reference

All routes sit under the `/events` prefix. Authentication is enforced via the
header defined in `DOCULENS_API_KEY_HEADER` when `DOCULENS_API_KEY` is set.

| Method | Route                              | Description                                                  |
| ------ | ---------------------------------- | ------------------------------------------------------------ |
| GET    | `/events/config`                   | Returns runtime defaults, header name, and auth requirement. |
| GET    | `/events/insights/dashboard`       | Aggregated metrics for throughput, savings, and compliance.  |
| GET    | `/events`                          | List most recent raw events + task contexts.                 |
| GET    | `/events/documents`                | Latest ingested documents with metadata & summaries.         |
| GET    | `/events/documents/{id}/chunks`    | Preview chunks for a document, obeying `chunk_preview_limit`.|
| POST   | `/events/documents/upload`         | Multipart upload (`file`, optional `doc_type`, `metadata`).  |
| POST   | `/events`                          | Generic event ingestion (summary, QA, search, etc.).         |
| GET    | `/events/search/history`           | Recent semantic searches with preview results.               |
| GET    | `/events/qa/history`               | Latest QA answers, reasoning, citations, chunk refs.         |

### Upload example

```bash
curl -X POST "http://localhost:8080/events/documents/upload" \
  -H "X-API-Key: ${DOCULENS_API_KEY:-local-dev}" \
  -F "file=@/path/to/document.pdf" \
  -F 'doc_type=contract' \
  -F 'metadata={"case_id":"acme-42"}'
```

Successful responses include `event_id`, `task_id`, the original filename, and
the on-disk path used by the ingestion pipeline.

---

## Frontend Console

The React app (Vite + TypeScript) lives in `frontend/` and exposes three main
views:

- **Documents** – filterable list of uploaded files, chunk previews, summary
  metadata, local QA form, and pipeline banners.
- **Workspace** – run ad-hoc semantic searches and corpus-wide QA, with live
  history feeds and metadata inspection.
- **Settings** – configure API base URL/key and override chunk/search/QA limits
  (persisted to `localStorage`).

The API client automatically propagates the configured key via the correct
header, and all responses surface errors in-context.

To build for production:

```bash
cd frontend
npm run build
npm run preview
```

---

## Testing & Automation

- **Unit & endpoint tests:**

  ```bash
  .venv/bin/python -m pytest
  ```

  The suite includes FastAPI `TestClient` coverage for uploads/config endpoints
  and ensures the semantic search pipeline honours configured limits.

- **Smoke tests:** `scripts/backend_smoke.sh` replays sample events via
  `requests/send_event.py` and asserts `event_id`/`task_id` payloads.

- **GitHub Actions:** `.github/workflows/backend-ci.yml` installs
  `app/requirements.txt` and runs pytest on every push and pull request.

---

## Operational Notes

- **Start everything:** `./scripts/dev_stack.sh`
- **Stop everything:** `./scripts/dev_stack_stop.sh`
- **Inspecting events:** connect to the database (`events` table) to view raw
  pipeline outputs per event.
- **Vector store:** `services/vector_store.VectorStore` wraps Timescale Vector
  operations (`semantic_search`, `fetch_document_chunks`, `upsert`, etc.).
- **Environment tuning:** the `DOCULENS_*` env vars bound via `Settings`
  propagate through the API, pipelines, and frontend configuration endpoint.

---

## Roadmap

- Configure production-ready build pipeline (Docker images for API, worker, UI).
- Add role-based access to the console (read-only vs operator actions).
- Layer in additional analytical tasks (document classification, extraction,
  routing) already scaffolded in `pipelines/`.
- Extend monitoring with Prometheus/Grafana dashboards fed by Celery events.

---

## License

The DocuLens codebase is distributed under the CodeWithMoin license. See
[`LICENSE`](LICENSE) for the full terms of use.
