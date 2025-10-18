from fastapi import APIRouter, Depends

from app.api.dependencies import require_api_key
from app.api.endpoint import router as endpoint_router, public_router as public_endpoint_router
from app.api.auth_router import router as auth_router

"""
API Router Module

This module sets up the API router and includes all defined endpoints.
It uses FastAPI's APIRouter to group related endpoints and provide a prefix.
"""

router = APIRouter()

secured_router = APIRouter(dependencies=[Depends(require_api_key)])
secured_router.include_router(endpoint_router, prefix="/events", tags=["events"])

router.include_router(auth_router)
router.include_router(public_endpoint_router, prefix="/events", tags=["events"])
router.include_router(secured_router)
