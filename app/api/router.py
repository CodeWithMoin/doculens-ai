from fastapi import APIRouter, Depends

from app.api.dependencies import require_api_key
from app.api.endpoint import router as endpoint_router

"""
API Router Module

This module sets up the API router and includes all defined endpoints.
It uses FastAPI's APIRouter to group related endpoints and provide a prefix.
"""

router = APIRouter(dependencies=[Depends(require_api_key)])

router.include_router(endpoint_router, prefix="/events", tags=["events"])
