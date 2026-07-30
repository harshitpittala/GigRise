"""SQLAlchemy configuration — engine, session factory, and the declarative
base class every future ORM model (models/, DATABASE_ARCHITECTURE.md) will
inherit from. This module intentionally defines no models itself (Phase
0.2 explicitly excludes database models) and never eagerly connects at
import time — the engine is created lazily, and nothing in this codebase
calls it yet, since no routes exist to need a session.
"""

from collections.abc import AsyncGenerator
from functools import lru_cache

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from core.config import get_settings


class Base(DeclarativeBase):
    """Shared declarative base for every SQLAlchemy ORM model.

    Empty metadata at Phase 0.2 — this is what Alembic's `env.py` points
    `target_metadata` at; the first real migration lands once `models/`
    gains actual model classes (DATABASE_ARCHITECTURE.md, later phases).
    """


@lru_cache
def get_engine() -> AsyncEngine:
    """Lazily-created async engine, built once and cached.

    Reads `DATABASE_URL` from settings; deliberately does not validate or
    connect here — a missing/placeholder URL at Phase 0.2 (no Supabase
    project connected yet) must not prevent the application from starting,
    since no code path uses a session until real endpoints exist.
    """
    settings = get_settings()
    database_url = settings.database_url or "postgresql+asyncpg://localhost/gigrise_placeholder"
    return create_async_engine(
        database_url,
        pool_size=settings.database_pool_size,
        pool_pre_ping=True,
        echo=not settings.is_production,
    )


def get_session_factory() -> async_sessionmaker[AsyncSession]:
    return async_sessionmaker(bind=get_engine(), expire_on_commit=False)


async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency yielding a request-scoped session.

    Not wired into any endpoint yet — no routes exist at Phase 0.2 — but
    this is the one, single place a future router's `Depends()` will point
    at, per PROJECT_SETUP.md §4's "a router never queries the database
    directly" rule.
    """
    session_factory = get_session_factory()
    async with session_factory() as session:
        yield session
