"""
Movie routes with development rate limiting wrappers.
"""

import logging
import time
from collections import defaultdict
from typing import Callable

from fastapi import APIRouter, Request, Response
from fastapi.routing import APIRoute

from src.controllers.movie_controller import router as movie_controller_router

logger = logging.getLogger(__name__)


class RateLimiter:
    """Simple sliding-window in-memory rate limiter for development."""

    def __init__(self, max_requests: int = 60, window_seconds: int = 60):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self._requests: dict = defaultdict(list)

    def is_allowed(self, client_ip: str) -> bool:
        now = time.time()
        window_start = now - self.window_seconds
        self._requests[client_ip] = [
            req_time
            for req_time in self._requests[client_ip]
            if req_time > window_start
        ]
        if len(self._requests[client_ip]) >= self.max_requests:
            return False
        self._requests[client_ip].append(now)
        return True

    def get_remaining(self, client_ip: str) -> int:
        return max(0, self.max_requests - len(self._requests.get(client_ip, [])))


class ResponseCache:
    """Small TTL cache kept for parity with the original route module."""

    def __init__(self, ttl_seconds: int = 300):
        self.ttl = ttl_seconds
        self._cache: dict = {}

    def get(self, key: str):
        if key in self._cache:
            data, timestamp = self._cache[key]
            if time.time() - timestamp < self.ttl:
                return data
            del self._cache[key]
        return None

    def set(self, key: str, data):
        self._cache[key] = (data, time.time())

    def invalidate(self, key: str):
        self._cache.pop(key, None)

    def invalidate_prefix(self, prefix: str):
        keys_to_remove = [key for key in self._cache if key.startswith(prefix)]
        for key in keys_to_remove:
            del self._cache[key]


general_limiter = RateLimiter(max_requests=100, window_seconds=60)
upload_limiter = RateLimiter(max_requests=5, window_seconds=60)
search_limiter = RateLimiter(max_requests=30, window_seconds=60)

genre_cache = ResponseCache(ttl_seconds=600)
movie_list_cache = ResponseCache(ttl_seconds=60)


def resolve_limiter(path: str):
    if "/upload" in path:
        return upload_limiter, "upload"
    if "/search" in path:
        return search_limiter, "search"
    return general_limiter, "general"


class RateLimitedRoute(APIRoute):
    """Apply per-route rate limiting to movie endpoints."""

    def get_route_handler(self) -> Callable:
        original_handler = super().get_route_handler()

        async def custom_handler(request: Request) -> Response:
            client_ip = request.client.host if request.client else "unknown"
            limiter, limit_name = resolve_limiter(request.url.path)

            if not limiter.is_allowed(client_ip):
                logger.warning(
                    f"Rate limit exceeded: IP={client_ip} | "
                    f"Limit={limit_name} | Path={request.url.path}"
                )
                from fastapi.responses import JSONResponse

                return JSONResponse(
                    status_code=429,
                    content={
                        "error": True,
                        "error_code": "RATE_LIMIT_EXCEEDED",
                        "message": f"Too many requests. Limit: {limiter.max_requests} per {limiter.window_seconds}s",
                    },
                    headers={
                        "Retry-After": str(limiter.window_seconds),
                        "X-RateLimit-Limit": str(limiter.max_requests),
                        "X-RateLimit-Remaining": "0",
                    },
                )

            response: Response = await original_handler(request)
            remaining = limiter.get_remaining(client_ip)
            response.headers["X-RateLimit-Limit"] = str(limiter.max_requests)
            response.headers["X-RateLimit-Remaining"] = str(remaining)
            return response

        return custom_handler


router = APIRouter(route_class=RateLimitedRoute)
router.include_router(movie_controller_router)


MOVIE_ROUTE_MAP = """
Movie endpoints:
GET  /api/movies/
GET  /api/movies/search
GET  /api/movies/genres
GET  /api/movies/{id}
POST /api/movies/
POST /api/movies/{id}/upload
PUT  /api/movies/{id}
DEL  /api/movies/{id}
"""

logger.info(MOVIE_ROUTE_MAP)
