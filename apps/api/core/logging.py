"""Structured JSON logging (MASTER_DEVELOPMENT_GUIDE.md §13, PROJECT_SETUP.md
§11): every log line is a JSON object, correlation-ID-threaded via the
`X-Request-Id` header. No secrets, tokens, or passwords are ever logged —
enforced here by only ever serializing an explicit, known field set, never
an arbitrary object that might contain one.
"""

import json
import logging
from contextvars import ContextVar
from datetime import UTC, datetime
from typing import Any

# Populated by middlewares/request_id.py for the lifetime of one request,
# read here so every log line emitted during that request carries the same
# correlation ID without every call site having to pass it explicitly.
request_id_var: ContextVar[str | None] = ContextVar("request_id", default=None)


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, Any] = {
            "timestamp": datetime.now(UTC).isoformat(),
            "level": record.levelname.lower(),
            "logger": record.name,
            "message": record.getMessage(),
            "request_id": request_id_var.get(),
        }
        if record.exc_info:
            payload["exception"] = self.formatException(record.exc_info)
        return json.dumps(payload)


def configure_logging(log_level: str = "info") -> None:
    """Call once at application startup (main.py)."""
    root_logger = logging.getLogger()
    root_logger.setLevel(log_level.upper())

    handler = logging.StreamHandler()
    handler.setFormatter(JsonFormatter())

    root_logger.handlers.clear()
    root_logger.addHandler(handler)
