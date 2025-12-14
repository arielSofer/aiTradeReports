"""
Database Configuration
======================
הגדרת חיבור למסד הנתונים
"""

import os
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase

from .config import settings


# Create async engine
if settings.use_sqlite:
    # SQLite for development (uses db_url which handles Vercel /tmp path)
    engine = create_async_engine(
        settings.db_url,
        echo=settings.debug,
    )
else:
    # PostgreSQL for production
    engine = create_async_engine(
        settings.database_url,
        echo=settings.debug,
        pool_pre_ping=True,
        pool_size=5,
        max_overflow=10
    )

# Session factory
AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False
)


class Base(DeclarativeBase):
    """Base class for all models"""
    pass


# Track if DB is initialized (for serverless environments)
_db_initialized = False


async def init_db():
    """Initialize database tables"""
    global _db_initialized
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    _db_initialized = True


async def get_db() -> AsyncSession:
    """Dependency for getting DB session"""
    global _db_initialized
    # On Vercel (serverless), ensure DB is initialized on first request
    if os.environ.get("VERCEL") and not _db_initialized:
        await init_db()
    
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()



async def close_db():
    """Close database connection"""
    await engine.dispose()

