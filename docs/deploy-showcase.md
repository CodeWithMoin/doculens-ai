# Deploy the portfolio showcase

This deployment is intentionally a **read-only product tour**, not a public SaaS trial. Visitors can inspect the synthetic workspace, navigate documents, use global search, and review grounded answers with citations. Uploads, live model calls, classification changes, and destructive actions are removed in the UI and rejected by the API.

## Recommended shape

Use one Ubuntu VPS with at least 2 vCPUs and 4 GB RAM. The showcase runs four containers on a private Compose network:

```text
Internet → Caddy (HTTPS) → React frontend
                         → FastAPI read API → PostgreSQL + pgvector
```

There is no Celery worker in showcase mode because visitors cannot enqueue work. This materially reduces memory use and removes surprise AI-provider spend. The tradeoff is deliberate: the hosted site demonstrates completed pipeline outputs rather than processing arbitrary visitor files.

## 1. Prepare DNS and the server

1. Create an Ubuntu VPS and add an `A` record such as `demo.example.com` pointing to its public IPv4 address.
2. Allow inbound TCP 22, 80, and 443 and UDP 443. Keep PostgreSQL private.
3. Install Docker Engine and the Compose plugin using Docker's official Ubuntu instructions.
4. Clone the repository onto the server.

## 2. Configure the showcase

```bash
cp .env.showcase.example .env.showcase
openssl rand -hex 32
openssl rand -base64 36
```

Edit `.env.showcase`:

- set `CADDY_DOMAIN` to the DNS name;
- put the same HTTPS origin in `DOCULENS_CORS_ORIGINS`;
- replace the auth secret and database password with the generated values.

Do not add real provider keys. The API blocks all state-changing event routes before a pipeline or provider can run.

## 3. Launch

```bash
make showcase-up
docker compose --env-file .env.showcase -f docker/docker-compose.showcase.yml ps
curl --fail https://demo.example.com/health/live
```

Caddy obtains and renews the TLS certificate automatically after DNS resolves and ports 80/443 are reachable. The first API startup applies Alembic migrations, creates the vector table/index if absent, and inserts the versioned synthetic workspace. Seeding is idempotent, so restarts do not duplicate data.

## 4. Update and roll back

Before an update, record the deployed commit and take a database dump:

```bash
git rev-parse HEAD
docker compose --env-file .env.showcase -f docker/docker-compose.showcase.yml exec -T database \
  pg_dump -U postgres -d doculens -Fc > doculens-showcase.dump
git pull --ff-only
make showcase-up
```

To roll back application code, check out the previously recorded commit and run `make showcase-up` again. Restore the database dump only when a migration is not backward-compatible; routine UI/API rollbacks should not require it.

## 5. Verify the public boundary

```bash
# Read succeeds.
curl --fail https://demo.example.com/api/v1/events/config

# Mutation must return HTTP 403.
curl -i https://demo.example.com/api/v1/events \
  -H 'Content-Type: application/json' \
  -d '{"event_type":"qa_query","query":"test"}'
```

Also verify `/`, `/app`, `/app/qa`, `/app/pipeline`, and `/docs` in a private browser window. `/app` should open without credentials and show a visible **Read-only showcase** label.

## Operational notes

- Back up the `postgres_data` volume or schedule `pg_dump`; Caddy certificates live in `caddy_data`.
- Use provider/VPS uptime monitoring against `/health/live` and the homepage.
- Keep Docker and the host patched. Rebuild monthly even when application code has not changed.
- This manifest is for a single-node portfolio demo. A real customer deployment would need user-scoped authorization, object storage, managed secrets, a worker, durable provider budgets, and tenant isolation.
