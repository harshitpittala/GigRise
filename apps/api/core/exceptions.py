"""Exception handling framework (API_SPECIFICATION.md §1.4/§19).

Defines the generic domain-error taxonomy and wires it to FastAPI's
exception-handler mechanism so every error response — regardless of which
future router raises it — uses the same envelope:

    { "error": { "code": "...", "message": "...", "details": [...] } }

No feature-specific error codes are defined here (e.g. no
`verification_reason_required`) — those belong to the phase that
implements the corresponding endpoint. This module only provides the
shapes and the registration mechanism, per Phase 0.2's "no business logic"
scope.
"""

import logging
from typing import Any

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

logger = logging.getLogger(__name__)


class AppError(Exception):
    """Base class for every domain error this codebase raises deliberately.

    Never thrown directly — always one of the subclasses below, per
    MASTER_DEVELOPMENT_GUIDE.md §12's "domain errors are typed/classed,
    never bare strings."
    """

    status_code: int = status.HTTP_500_INTERNAL_SERVER_ERROR
    code: str = "internal_error"

    def __init__(self, message: str, *, details: list[dict[str, Any]] | None = None) -> None:
        super().__init__(message)
        self.message = message
        self.details = details or []


class ValidationAppError(AppError):
    status_code = status.HTTP_422_UNPROCESSABLE_ENTITY
    code = "validation_failed"


class NotFoundError(AppError):
    status_code = status.HTTP_404_NOT_FOUND
    code = "not_found"


class PermissionDeniedError(AppError):
    status_code = status.HTTP_403_FORBIDDEN
    code = "permission_denied"


class ConflictError(AppError):
    status_code = status.HTTP_409_CONFLICT
    code = "conflict"


class RateLimitedError(AppError):
    status_code = status.HTTP_429_TOO_MANY_REQUESTS
    code = "rate_limited"


def _error_envelope(
    code: str, message: str, details: list[dict[str, Any]] | None = None
) -> dict[str, Any]:
    return {"error": {"code": code, "message": message, "details": details or []}}


async def _handle_app_error(_: Request, exc: AppError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content=_error_envelope(exc.code, exc.message, exc.details),
    )


async def _handle_validation_error(_: Request, exc: RequestValidationError) -> JSONResponse:
    details = [
        {"field": ".".join(str(part) for part in error["loc"]), "issue": error["msg"]}
        for error in exc.errors()
    ]
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content=_error_envelope("validation_failed", "Request validation failed.", details),
    )


async def _handle_unexpected_error(_: Request, exc: Exception) -> JSONResponse:
    # Never leak internals (stack traces, exception messages) to the
    # client — logged server-side only, per MASTER_DEVELOPMENT_GUIDE.md §13.
    logger.error("Unhandled exception", exc_info=exc)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content=_error_envelope("internal_error", "An unexpected error occurred."),
    )


def register_exception_handlers(app: FastAPI) -> None:
    # Below: Starlette's add_exception_handler stub types the handler as
    # Callable[[Request, Exception], ...], but registering a handler narrowed
    # to a specific exception subclass (the whole point of this function) is
    # the documented, correct FastAPI pattern — a known stub limitation, not
    # an actual type-safety gap in this code. Hence the two ignores below.
    app.add_exception_handler(AppError, _handle_app_error)  # type: ignore[arg-type]
    app.add_exception_handler(RequestValidationError, _handle_validation_error)  # type: ignore[arg-type]
    app.add_exception_handler(Exception, _handle_unexpected_error)
