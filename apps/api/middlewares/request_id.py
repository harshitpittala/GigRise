"""Request-ID injection middleware (PROJECT_SETUP.md §4, §8, §11).

Reads the client-supplied `X-Request-Id` header if present, otherwise
generates one, stores it in the logging correlation context var
(`core.logging.request_id_var`) for the lifetime of the request, and
echoes it back on the response — so a frontend error and its
corresponding backend log lines share one traceable ID
(API_SPECIFICATION.md §1.3, MASTER_DEVELOPMENT_GUIDE.md §13).
"""

import uuid
from collections.abc import Awaitable, Callable

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from core.logging import request_id_var

REQUEST_ID_HEADER = "X-Request-Id"


class RequestIDMiddleware(BaseHTTPMiddleware):
    async def dispatch(
        self, request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        request_id = request.headers.get(REQUEST_ID_HEADER) or str(uuid.uuid4())
        token = request_id_var.set(request_id)
        try:
            response = await call_next(request)
        finally:
            request_id_var.reset(token)
        response.headers[REQUEST_ID_HEADER] = request_id
        return response
