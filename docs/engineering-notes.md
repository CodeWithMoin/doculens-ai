# Engineering notes

## Scope of the production hardening pass

This project deliberately remains a modular monolith. The main risks were inconsistent configuration, implicit global clients, unsafe startup defaults, coarse retrieval chunks, unbounded embedding requests, permissive API inputs, and a developer workflow that differed from CI.

## Major changes

### Application lifecycle and API versioning

FastAPI now uses an application factory and lifespan hook. This makes isolated testing possible and gives startup policy one owner. `/api/v1` is the canonical namespace; legacy routes are aliases so the React client is not broken. Database initialization is configurable, demo accounts are opt-in, and production rejects demo credentials.

Tradeoff: aliases duplicate paths in OpenAPI during the compatibility window. Functionality is otherwise unchanged.

### Configuration and security

Operational limits, CORS, environment, logging, provider timeout, chunk size, embedding batches, cache size, and upload size now live in the validated settings model. Vector-store construction no longer mutates the cached database configuration. Uploads are streamed with a hard byte limit and partial files are removed after failure.

Tradeoff: invalid configuration now fails early instead of being tolerated. This is intentional and does not affect correctly configured environments.

### Retrieval and embeddings

The default chunk target changed from the embedding model's 8,191-token ceiling to 800 tokens. Embeddings are requested in bounded batches through an injectable vector-store seam, reuse a bounded in-memory LRU, and retain page/chunk provenance for citations. Recall@K and MRR helpers make future retrieval changes measurable.

Tokenizer construction is lazy because tiktoken may fetch its vocabulary on first use. API imports, health checks, and unit-test collection therefore remain network-independent; the worker pays initialization cost only when it processes an embedding job. Docling is pinned to the Python 3.12-tested 2.95.0 release to prevent expensive resolver backtracking and surprise parser changes.

Tradeoff: smaller chunks create more rows and can increase embedding cost. They reduce irrelevant context per hit and make citations more precise. The exact value should be tuned against a labelled corpus.

### Reliability and observability

Requests receive correlation ids and emit duration/status logs. Celery uses late acknowledgement, worker-loss rejection, bounded execution time, single-message prefetch, and expiring results. Docker services have readiness ordering and restart policies appropriate for development.

Tradeoff: late-acknowledged tasks can execute more than once after a crash. Pipeline side effects therefore need to stay idempotent; vector upserts and event-based checks provide a foundation, but full idempotency deserves explicit integration coverage.

### Developer workflow

The repository root now owns packaging, Ruff, Pyright, pytest, coverage, Make targets, pre-commit, and a documented environment template. CI installs the same editable development package and executes the same quality gates.

Tradeoff: contributors using the former `app/requirements.txt` workflow must move to the root editable install. One dependency definition is worth the small migration cost because CI, local development, and containers can no longer drift.

## Intentionally deferred

The 1,200-line event endpoint module should be split by documents, labels, QA, search, and insights. Doing that safely requires route-level characterization tests first; moving it mechanically would create diff volume without improving behavior. Durable event status/error columns also require a migration and UI contract, so they are recorded on the roadmap instead of hidden inside JSON.
