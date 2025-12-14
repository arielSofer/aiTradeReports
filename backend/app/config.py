"""
Application Configuration
=========================
הגדרות סביבה ותצורה
"""

from functools import lru_cache
from typing import Optional, List
from pydantic_settings import BaseSettings
import os


class Settings(BaseSettings):
    """הגדרות האפליקציה"""
    
    # App Settings
    app_name: str = "TradeTracker API"
    debug: bool = True
    api_prefix: str = "/api/v1"
    
    # Database
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/tradetracker"
    
    # For SQLite (development without PostgreSQL)
    use_sqlite: bool = True
    sqlite_url: str = "sqlite+aiosqlite:///./tradetracker.db"
    
    # JWT Authentication
    secret_key: str = "your-super-secret-key-change-in-production-12345"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24 * 7  # 7 days
    
    # CORS - Allow specific origins and Vercel preview URLs via regex
    cors_origins: List[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://ai-trade-reports.vercel.app",
        "https://trade-d720f.web.app",
        "https://trade-d720f.firebaseapp.com",
    ]
    cors_origin_regex: str = r"https://.*\.vercel\.app"  # Allow all Vercel preview deployments
    
    # File Upload
    max_file_size: int = 10 * 1024 * 1024  # 10MB
    allowed_extensions: list = [".csv", ".xlsx", ".xls"]
    
    @property
    def db_url(self) -> str:
        """Get the appropriate database URL"""
        import os
        if self.use_sqlite:
            # If running on Vercel (read-only filesystem), use /tmp
            if os.environ.get("VERCEL"):
                return "sqlite+aiosqlite:////tmp/tradetracker.db"
            return self.sqlite_url
        return self.database_url
    
    class Config:
        env_file = ".env"
        case_sensitive = False


@lru_cache()
def get_settings() -> Settings:
    """קבל את ההגדרות (cached)"""
    return Settings()


settings = get_settings()





