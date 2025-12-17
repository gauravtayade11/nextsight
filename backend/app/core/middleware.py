"""
Production-ready middleware for security, rate limiting, and observability.
"""

import logging
import time
import uuid
from collections import defaultdict
from datetime import datetime, timedelta
from functools import wraps
from typing import Callable, Dict, Optional, Set

from fastapi import FastAPI, Request, Response, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

logger = logging.getLogger(__name__)


# =============================================================================
# Request Context - Correlation ID for distributed tracing
# =============================================================================

class RequestContextMiddleware(BaseHTTPMiddleware):
    """Add correlation ID and request context to all requests."""

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Generate or extract correlation ID
        correlation_id = request.headers.get("X-Correlation-ID") or str(uuid.uuid4())
        request.state.correlation_id = correlation_id
        request.state.start_time = time.time()

        # Process request
        response = await call_next(request)

        # Add correlation ID to response
        response.headers["X-Correlation-ID"] = correlation_id

        # Log request completion
        duration = time.time() - request.state.start_time
        logger.info(
            f"[{correlation_id}] {request.method} {request.url.path} "
            f"completed in {duration:.3f}s with status {response.status_code}"
        )

        return response


# =============================================================================
# Rate Limiting Middleware
# =============================================================================

class RateLimitStore:
    """In-memory rate limit store with sliding window."""

    def __init__(self):
        self._requests: Dict[str, list] = defaultdict(list)
        self._blocked: Dict[str, datetime] = {}

    def is_blocked(self, key: str) -> bool:
        """Check if a key is temporarily blocked."""
        if key in self._blocked:
            if datetime.now() < self._blocked[key]:
                return True
            del self._blocked[key]
        return False

    def block(self, key: str, duration_seconds: int = 60):
        """Block a key for a duration."""
        self._blocked[key] = datetime.now() + timedelta(seconds=duration_seconds)

    def add_request(self, key: str, window_seconds: int) -> int:
        """Add a request and return count in window."""
        now = datetime.now()
        cutoff = now - timedelta(seconds=window_seconds)

        # Clean old requests
        self._requests[key] = [
            ts for ts in self._requests[key] if ts > cutoff
        ]

        # Add new request
        self._requests[key].append(now)

        return len(self._requests[key])

    def cleanup(self, max_age_seconds: int = 3600):
        """Remove stale entries."""
        cutoff = datetime.now() - timedelta(seconds=max_age_seconds)
        keys_to_remove = []

        for key, timestamps in self._requests.items():
            self._requests[key] = [ts for ts in timestamps if ts > cutoff]
            if not self._requests[key]:
                keys_to_remove.append(key)

        for key in keys_to_remove:
            del self._requests[key]


# Global rate limit store
_rate_limit_store = RateLimitStore()


class RateLimitConfig:
    """Rate limiting configuration."""

    def __init__(
        self,
        requests_per_minute: int = 60,
        requests_per_hour: int = 1000,
        burst_limit: int = 20,
        burst_window_seconds: int = 10,
        block_duration_seconds: int = 60,
    ):
        self.requests_per_minute = requests_per_minute
        self.requests_per_hour = requests_per_hour
        self.burst_limit = burst_limit
        self.burst_window_seconds = burst_window_seconds
        self.block_duration_seconds = block_duration_seconds


# Default configurations for different endpoint types
RATE_LIMIT_CONFIGS = {
    "default": RateLimitConfig(
        requests_per_minute=60,
        requests_per_hour=1000,
        burst_limit=20,
    ),
    "auth": RateLimitConfig(
        requests_per_minute=10,
        requests_per_hour=100,
        burst_limit=5,
        block_duration_seconds=300,  # 5 min block for auth abuse
    ),
    "ai": RateLimitConfig(
        requests_per_minute=20,
        requests_per_hour=200,
        burst_limit=5,
    ),
    "webhook": RateLimitConfig(
        requests_per_minute=100,
        requests_per_hour=5000,
        burst_limit=50,
    ),
}


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Rate limiting middleware with sliding window algorithm."""

    # Paths that bypass rate limiting
    EXEMPT_PATHS: Set[str] = {
        "/health",
        "/ready",
        "/live",
        "/docs",
        "/redoc",
        "/openapi.json",
    }

    def __init__(self, app: FastAPI, enabled: bool = True):
        super().__init__(app)
        self.enabled = enabled

    def _get_client_id(self, request: Request) -> str:
        """Get unique client identifier."""
        # Try to get real IP behind proxy
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            return forwarded.split(",")[0].strip()

        real_ip = request.headers.get("X-Real-IP")
        if real_ip:
            return real_ip

        # Fall back to direct client IP
        return request.client.host if request.client else "unknown"

    def _get_rate_config(self, path: str) -> RateLimitConfig:
        """Get rate limit config based on path."""
        if path.startswith("/api/v1/auth"):
            return RATE_LIMIT_CONFIGS["auth"]
        elif path.startswith("/api/v1/ai") or "/ai/" in path:
            return RATE_LIMIT_CONFIGS["ai"]
        elif "/webhook" in path:
            return RATE_LIMIT_CONFIGS["webhook"]
        return RATE_LIMIT_CONFIGS["default"]

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        if not self.enabled:
            return await call_next(request)

        # Skip rate limiting for exempt paths
        if request.url.path in self.EXEMPT_PATHS:
            return await call_next(request)

        client_id = self._get_client_id(request)
        config = self._get_rate_config(request.url.path)
        rate_key = f"{client_id}:{request.url.path.split('/')[3] if len(request.url.path.split('/')) > 3 else 'default'}"

        # Check if client is blocked
        if _rate_limit_store.is_blocked(rate_key):
            logger.warning(f"Rate limit: blocked client {client_id} attempted request")
            return JSONResponse(
                status_code=429,
                content={
                    "detail": "Too many requests. Please try again later.",
                    "retry_after": config.block_duration_seconds,
                },
                headers={"Retry-After": str(config.block_duration_seconds)},
            )

        # Check burst limit
        burst_count = _rate_limit_store.add_request(
            f"{rate_key}:burst", config.burst_window_seconds
        )
        if burst_count > config.burst_limit:
            logger.warning(f"Rate limit: burst limit exceeded for {client_id}")
            _rate_limit_store.block(rate_key, config.block_duration_seconds)
            return JSONResponse(
                status_code=429,
                content={
                    "detail": "Request rate too high. Please slow down.",
                    "retry_after": config.block_duration_seconds,
                },
                headers={"Retry-After": str(config.block_duration_seconds)},
            )

        # Check per-minute limit
        minute_count = _rate_limit_store.add_request(f"{rate_key}:minute", 60)
        if minute_count > config.requests_per_minute:
            remaining = 60 - (datetime.now().second)
            return JSONResponse(
                status_code=429,
                content={
                    "detail": "Rate limit exceeded. Please wait.",
                    "retry_after": remaining,
                },
                headers={
                    "Retry-After": str(remaining),
                    "X-RateLimit-Limit": str(config.requests_per_minute),
                    "X-RateLimit-Remaining": "0",
                    "X-RateLimit-Reset": str(int(time.time()) + remaining),
                },
            )

        # Process request and add rate limit headers
        response = await call_next(request)

        response.headers["X-RateLimit-Limit"] = str(config.requests_per_minute)
        response.headers["X-RateLimit-Remaining"] = str(
            max(0, config.requests_per_minute - minute_count)
        )
        response.headers["X-RateLimit-Reset"] = str(
            int(time.time()) + (60 - datetime.now().second)
        )

        return response


# =============================================================================
# Security Headers Middleware
# =============================================================================

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Add security headers to all responses."""

    # Content Security Policy
    CSP_POLICY = (
        "default-src 'self'; "
        "script-src 'self' 'unsafe-inline' 'unsafe-eval'; "
        "style-src 'self' 'unsafe-inline'; "
        "img-src 'self' data: https:; "
        "font-src 'self' data:; "
        "connect-src 'self' https:; "
        "frame-ancestors 'none'; "
        "base-uri 'self'; "
        "form-action 'self'"
    )

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        response = await call_next(request)

        # Security headers
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = (
            "accelerometer=(), camera=(), geolocation=(), gyroscope=(), "
            "magnetometer=(), microphone=(), payment=(), usb=()"
        )

        # HSTS - only in production with HTTPS
        # response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"

        # CSP for API responses (relaxed for docs)
        if not request.url.path.startswith(("/docs", "/redoc")):
            response.headers["Content-Security-Policy"] = self.CSP_POLICY

        # Remove server header
        if "server" in response.headers:
            del response.headers["server"]

        return response


# =============================================================================
# Request Validation Middleware
# =============================================================================

class RequestValidationMiddleware(BaseHTTPMiddleware):
    """Validate incoming requests for security."""

    # Maximum allowed content length (10MB)
    MAX_CONTENT_LENGTH = 10 * 1024 * 1024

    # Blocked patterns in paths
    BLOCKED_PATTERNS = [
        "../",
        "..\\",
        "<script",
        "javascript:",
        "data:text/html",
    ]

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Check content length
        content_length = request.headers.get("content-length")
        if content_length and int(content_length) > self.MAX_CONTENT_LENGTH:
            return JSONResponse(
                status_code=413,
                content={"detail": "Request entity too large"},
            )

        # Check for blocked patterns in URL
        request_path = request.url.path.lower()
        query_string = str(request.url.query).lower()

        for pattern in self.BLOCKED_PATTERNS:
            if pattern in request_path or pattern in query_string:
                logger.warning(
                    f"Blocked request with suspicious pattern: {pattern} "
                    f"from {request.client.host if request.client else 'unknown'}"
                )
                return JSONResponse(
                    status_code=400,
                    content={"detail": "Invalid request"},
                )

        # Validate content type for POST/PUT/PATCH
        if request.method in ("POST", "PUT", "PATCH"):
            content_type = request.headers.get("content-type", "")
            if content_type and not any(
                ct in content_type
                for ct in ["application/json", "multipart/form-data", "application/x-www-form-urlencoded"]
            ):
                # Allow requests without content-type for flexibility
                pass

        return await call_next(request)


# =============================================================================
# Logging Middleware
# =============================================================================

class StructuredLoggingMiddleware(BaseHTTPMiddleware):
    """Structured logging for requests and responses."""

    # Paths to exclude from detailed logging
    EXCLUDE_PATHS = {"/health", "/ready", "/live", "/metrics"}

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        if request.url.path in self.EXCLUDE_PATHS:
            return await call_next(request)

        start_time = time.time()
        correlation_id = getattr(request.state, "correlation_id", str(uuid.uuid4()))

        # Log request
        logger.info(
            "request_started",
            extra={
                "correlation_id": correlation_id,
                "method": request.method,
                "path": request.url.path,
                "query": str(request.url.query),
                "client_ip": request.client.host if request.client else "unknown",
                "user_agent": request.headers.get("user-agent", ""),
            },
        )

        try:
            response = await call_next(request)
            duration = time.time() - start_time

            # Log response
            logger.info(
                "request_completed",
                extra={
                    "correlation_id": correlation_id,
                    "method": request.method,
                    "path": request.url.path,
                    "status_code": response.status_code,
                    "duration_ms": round(duration * 1000, 2),
                },
            )

            return response

        except Exception as e:
            duration = time.time() - start_time
            logger.error(
                "request_failed",
                extra={
                    "correlation_id": correlation_id,
                    "method": request.method,
                    "path": request.url.path,
                    "error": str(e),
                    "duration_ms": round(duration * 1000, 2),
                },
                exc_info=True,
            )
            raise


# =============================================================================
# Middleware Setup Helper
# =============================================================================

def setup_middleware(
    app: FastAPI,
    cors_origins: list = None,
    rate_limiting_enabled: bool = True,
    debug: bool = False,
):
    """Configure all middleware for the application."""

    # CORS (must be first)
    if cors_origins is None:
        cors_origins = ["*"] if debug else []

    app.add_middleware(
        CORSMiddleware,
        allow_origins=cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["X-Correlation-ID", "X-RateLimit-Limit", "X-RateLimit-Remaining", "X-RateLimit-Reset"],
    )

    # Security headers
    app.add_middleware(SecurityHeadersMiddleware)

    # Request validation
    app.add_middleware(RequestValidationMiddleware)

    # Rate limiting
    app.add_middleware(RateLimitMiddleware, enabled=rate_limiting_enabled)

    # Request context (correlation ID)
    app.add_middleware(RequestContextMiddleware)

    # Structured logging
    app.add_middleware(StructuredLoggingMiddleware)

    logger.info(
        f"Middleware configured: rate_limiting={rate_limiting_enabled}, "
        f"debug={debug}, cors_origins={len(cors_origins)} origins"
    )
