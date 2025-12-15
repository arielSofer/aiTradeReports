"""
TradeTracker API
================
FastAPI Backend for Trade Analysis Platform (Stateless Parser)

Run with: uvicorn app.main:app --reload
"""

import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import traceback

from .config import settings
from .routers import upload_router


# Create FastAPI app
app = FastAPI(
    title=settings.app_name,
    description="""
## 🚀 TradeTracker Parser API

Stateless API for parsing trade CSVs. Persistence is handled by Frontend (Firebase).

### Features
- 📊 Parse trades from multiple brokers (IB, MT4, Binance)
- 🔄 Returns JSON for frontend processing
    """,
    version="0.2.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Exception handler for debugging
from fastapi import Request
from fastapi.responses import JSONResponse

@app.exception_handler(Exception)
async def debug_exception_handler(request: Request, exc: Exception):
    error_details = traceback.format_exc()
    print(f"Server Error: {error_details}")
    return JSONResponse(
        status_code=500,
        content={
            "error": "Internal Server Error",
            "detail": str(exc),
            "traceback": error_details.split("\n")
        }
    )


# CORS middleware
# Use both allow_origins and allow_origin_regex to support Vercel preview URLs
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_origin_regex=settings.cors_origin_regex if hasattr(settings, 'cors_origin_regex') else None,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(upload_router, prefix=settings.api_prefix)


@app.get("/")
async def root():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "app": settings.app_name,
        "version": "0.2.0",
        "docs": "/docs"
    }


@app.get("/health")
@app.get("/api/v1/health")
async def health_check():
    """Detailed health check"""
    return {
        "status": "healthy",
        "mode": "stateless",
        "api_version": "v2"
    }
