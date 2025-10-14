#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

if [[ ! -f "${PROJECT_ROOT}/.venv/bin/python" ]]; then
  echo "Virtual environment not found at ${PROJECT_ROOT}/.venv. Create it with 'python -m venv .venv'." >&2
  exit 1
fi

source "${PROJECT_ROOT}/.venv/bin/activate"

cd "${PROJECT_ROOT}"

run_event() {
  local event_file="$1"
  echo ">>> Sending ${event_file}"
  python requests/send_event.py "${event_file}"
  echo
}

run_event document_upload_local.json
run_event document_upload_resume.json
run_event document_upload_gst.json
run_event document_classification.json
run_event information_extraction.json
run_event document_routing.json
run_event document_summary_resume.json
run_event document_summary_gst.json
run_event search_query.json
run_event qa_query.json

echo "Smoke run complete. Check Celery logs with:"
echo "  docker logs doculens_celery_worker --tail 120"
