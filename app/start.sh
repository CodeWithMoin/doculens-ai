#!/bin/sh

# Ensure Python can resolve the project package when running inside the container
export PYTHONPATH=${PYTHONPATH:-/}

# Uncomment next line to automatically apply Alembic database migrations
# alembic upgrade head

exec uvicorn app.main:app --host 0.0.0.0 --port 8080 --reload
