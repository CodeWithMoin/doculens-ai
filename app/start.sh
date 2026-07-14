#!/bin/sh

if [ "${DOCULENS_RUN_MIGRATIONS:-false}" = "true" ]; then
  alembic -c /workspace/app/alembic.ini upgrade head
fi

exec uvicorn app.main:app --host 0.0.0.0 --port 8080 --proxy-headers
