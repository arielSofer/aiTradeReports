# API Routers
from .auth import router as auth_router
from .accounts import router as accounts_router
from .trades import router as trades_router
from .upload import router as upload_router
from .stats import router as stats_router

__all__ = [
    "auth_router",
    "accounts_router", 
    "trades_router",
    "upload_router",
    "stats_router"
]




