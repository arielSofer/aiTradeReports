"""
TradeTracker API
================
FastAPI Backend for Trade Analysis Platform

Run with: uvicorn app.main:app --reload
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .database import init_db, close_db
from .routers import (
    auth_router,
    accounts_router,
    trades_router,
    upload_router,
    stats_router
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler"""
    # Startup
    print("🚀 Starting TradeTracker API...")
    await init_db()
    print("✅ Database initialized")
    yield
    # Shutdown
    print("👋 Shutting down...")
    await close_db()


# Create FastAPI app
app = FastAPI(
    title=settings.app_name,
    description="""
## 🚀 TradeTracker API

Trade Analysis Platform - ניתוח עסקאות מסחר

### Features
- 📊 Import trades from multiple brokers (IB, MT4, Binance)
- 📈 Comprehensive trading statistics
- 🎯 Win rate, profit factor, R-multiple analysis
- 📅 Daily P&L tracking
- ⏰ Hourly performance analysis

### Authentication
All endpoints (except /auth/register and /auth/login) require JWT authentication.
Use the `/auth/login` endpoint to get an access token.
    """,
    version="0.1.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc"
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
app.include_router(auth_router, prefix=settings.api_prefix)
app.include_router(accounts_router, prefix=settings.api_prefix)
app.include_router(trades_router, prefix=settings.api_prefix)
app.include_router(upload_router, prefix=settings.api_prefix)
app.include_router(stats_router, prefix=settings.api_prefix)


@app.get("/")
async def root():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "app": settings.app_name,
        "version": "0.1.0",
        "docs": "/docs"
    }


@app.get("/health")
async def health_check():
    """Detailed health check"""
    return {
        "status": "healthy",
        "database": "connected",
        "api_version": "v1"
    }





