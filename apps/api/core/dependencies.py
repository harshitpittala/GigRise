"""Dependency-injection wiring (PROJECT_SETUP.md §4).

A single, canonical import point for FastAPI `Depends()` targets, so a
future router never has to know whether a dependency comes from
`core.config` or `core.database` — it just imports from here. No
authentication dependency exists yet (Phase 0.2 explicitly excludes it);
that is added in a later phase alongside the Custom Access Token Hook
(AUTHENTICATION.md §5.1) once Supabase Auth is wired up.
"""

from core.config import Settings, get_settings
from core.database import get_db_session

__all__ = ["Settings", "get_settings", "get_db_session"]
