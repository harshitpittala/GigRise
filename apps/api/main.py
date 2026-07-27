"""GigRise backend entrypoint.

Phase 0.2 (Framework Configuration): wires settings, structured logging,
the exception-handling framework, and base middleware. Deliberately zero
routes — this phase excludes APIs, authentication, and business logic;
the first router lands with Phase 1 (Authentication & Identity).
"""

from fastapi import FastAPI

from core.config import get_settings
from core.exceptions import register_exception_handlers
from core.logging import configure_logging
from middlewares.request_id import RequestIDMiddleware

settings = get_settings()
configure_logging(settings.log_level)

app = FastAPI(
    title="GigRise API",
    version="0.0.0",
)

app.add_middleware(RequestIDMiddleware)
register_exception_handlers(app)
