"""Small, dependency-free logging and request tracing primitives."""

import logging
import time
from uuid import uuid4

from fastapi import Request, Response


def configure_logging(level: str) -> None:
    """Configure consistent process logging for API and worker processes."""
    logging.basicConfig(
        level=level,
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
        force=True,
    )


async def request_context_middleware(request: Request, call_next) -> Response:
    """Attach a correlation id and emit one structured request completion log."""
    request_id = request.headers.get("X-Request-ID") or uuid4().hex
    started = time.perf_counter()
    response = await call_next(request)
    response.headers["X-Request-ID"] = request_id
    logging.getLogger("doculens.http").info(
        "request_complete method=%s path=%s status=%s duration_ms=%.2f request_id=%s",
        request.method,
        request.url.path,
        response.status_code,
        (time.perf_counter() - started) * 1000,
        request_id,
    )
    return response
