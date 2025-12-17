"""
Prometheus-compatible metrics for application monitoring.
Lightweight implementation without external dependencies.
"""

import time
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime
from threading import Lock
from typing import Dict, List, Optional

from fastapi import APIRouter, Request, Response
from starlette.middleware.base import BaseHTTPMiddleware


# =============================================================================
# Metric Types
# =============================================================================

@dataclass
class Counter:
    """A cumulative metric that only increases."""
    name: str
    help: str
    labels: List[str] = field(default_factory=list)
    _values: Dict[str, float] = field(default_factory=lambda: defaultdict(float))
    _lock: Lock = field(default_factory=Lock)

    def inc(self, value: float = 1.0, **label_values):
        """Increment the counter."""
        key = self._label_key(label_values)
        with self._lock:
            self._values[key] += value

    def _label_key(self, label_values: dict) -> str:
        if not label_values:
            return ""
        return ",".join(f'{k}="{v}"' for k, v in sorted(label_values.items()))

    def collect(self) -> str:
        """Collect metric in Prometheus format."""
        lines = [f"# HELP {self.name} {self.help}", f"# TYPE {self.name} counter"]
        with self._lock:
            for key, value in self._values.items():
                if key:
                    lines.append(f"{self.name}{{{key}}} {value}")
                else:
                    lines.append(f"{self.name} {value}")
        return "\n".join(lines)


@dataclass
class Gauge:
    """A metric that can go up and down."""
    name: str
    help: str
    labels: List[str] = field(default_factory=list)
    _values: Dict[str, float] = field(default_factory=lambda: defaultdict(float))
    _lock: Lock = field(default_factory=Lock)

    def set(self, value: float, **label_values):
        """Set the gauge value."""
        key = self._label_key(label_values)
        with self._lock:
            self._values[key] = value

    def inc(self, value: float = 1.0, **label_values):
        """Increment the gauge."""
        key = self._label_key(label_values)
        with self._lock:
            self._values[key] += value

    def dec(self, value: float = 1.0, **label_values):
        """Decrement the gauge."""
        key = self._label_key(label_values)
        with self._lock:
            self._values[key] -= value

    def _label_key(self, label_values: dict) -> str:
        if not label_values:
            return ""
        return ",".join(f'{k}="{v}"' for k, v in sorted(label_values.items()))

    def collect(self) -> str:
        """Collect metric in Prometheus format."""
        lines = [f"# HELP {self.name} {self.help}", f"# TYPE {self.name} gauge"]
        with self._lock:
            for key, value in self._values.items():
                if key:
                    lines.append(f"{self.name}{{{key}}} {value}")
                else:
                    lines.append(f"{self.name} {value}")
        return "\n".join(lines)


@dataclass
class Histogram:
    """A metric that samples observations and counts them in buckets."""
    name: str
    help: str
    labels: List[str] = field(default_factory=list)
    buckets: List[float] = field(default_factory=lambda: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0])
    _counts: Dict[str, Dict[float, int]] = field(default_factory=lambda: defaultdict(lambda: defaultdict(int)))
    _sums: Dict[str, float] = field(default_factory=lambda: defaultdict(float))
    _totals: Dict[str, int] = field(default_factory=lambda: defaultdict(int))
    _lock: Lock = field(default_factory=Lock)

    def observe(self, value: float, **label_values):
        """Record an observation."""
        key = self._label_key(label_values)
        with self._lock:
            self._sums[key] += value
            self._totals[key] += 1
            for bucket in self.buckets:
                if value <= bucket:
                    self._counts[key][bucket] += 1

    def _label_key(self, label_values: dict) -> str:
        if not label_values:
            return ""
        return ",".join(f'{k}="{v}"' for k, v in sorted(label_values.items()))

    def collect(self) -> str:
        """Collect metric in Prometheus format."""
        lines = [f"# HELP {self.name} {self.help}", f"# TYPE {self.name} histogram"]
        with self._lock:
            for key in set(list(self._counts.keys()) + list(self._sums.keys())):
                label_prefix = f"{{{key}," if key else "{"
                cumulative = 0
                for bucket in sorted(self.buckets):
                    cumulative += self._counts[key].get(bucket, 0)
                    if key:
                        lines.append(f'{self.name}_bucket{{{key},le="{bucket}"}} {cumulative}')
                    else:
                        lines.append(f'{self.name}_bucket{{le="{bucket}"}} {cumulative}')
                # +Inf bucket
                if key:
                    lines.append(f'{self.name}_bucket{{{key},le="+Inf"}} {self._totals[key]}')
                    lines.append(f"{self.name}_sum{{{key}}} {self._sums[key]}")
                    lines.append(f"{self.name}_count{{{key}}} {self._totals[key]}")
                else:
                    lines.append(f'{self.name}_bucket{{le="+Inf"}} {self._totals[key]}')
                    lines.append(f"{self.name}_sum {self._sums[key]}")
                    lines.append(f"{self.name}_count {self._totals[key]}")
        return "\n".join(lines)


# =============================================================================
# Application Metrics Registry
# =============================================================================

class MetricsRegistry:
    """Registry for all application metrics."""

    def __init__(self):
        self._metrics: Dict[str, any] = {}

        # HTTP metrics
        self.http_requests_total = self._register(Counter(
            name="http_requests_total",
            help="Total number of HTTP requests",
            labels=["method", "endpoint", "status"],
        ))

        self.http_request_duration_seconds = self._register(Histogram(
            name="http_request_duration_seconds",
            help="HTTP request duration in seconds",
            labels=["method", "endpoint"],
            buckets=[0.01, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0],
        ))

        self.http_requests_in_progress = self._register(Gauge(
            name="http_requests_in_progress",
            help="Number of HTTP requests currently being processed",
            labels=["method"],
        ))

        # Application metrics
        self.app_info = self._register(Gauge(
            name="app_info",
            help="Application information",
            labels=["version", "environment"],
        ))

        # Pipeline metrics
        self.pipeline_runs_total = self._register(Counter(
            name="pipeline_runs_total",
            help="Total number of pipeline runs",
            labels=["pipeline_id", "status"],
        ))

        self.pipeline_run_duration_seconds = self._register(Histogram(
            name="pipeline_run_duration_seconds",
            help="Pipeline run duration in seconds",
            labels=["pipeline_id"],
        ))

        # Auth metrics
        self.auth_attempts_total = self._register(Counter(
            name="auth_attempts_total",
            help="Total authentication attempts",
            labels=["type", "status"],
        ))

        # Cache metrics
        self.cache_hits_total = self._register(Counter(
            name="cache_hits_total",
            help="Total cache hits",
            labels=["cache_type"],
        ))

        self.cache_misses_total = self._register(Counter(
            name="cache_misses_total",
            help="Total cache misses",
            labels=["cache_type"],
        ))

        # Database metrics
        self.db_queries_total = self._register(Counter(
            name="db_queries_total",
            help="Total database queries",
            labels=["operation"],
        ))

        self.db_query_duration_seconds = self._register(Histogram(
            name="db_query_duration_seconds",
            help="Database query duration in seconds",
            labels=["operation"],
        ))

        # Error metrics
        self.errors_total = self._register(Counter(
            name="errors_total",
            help="Total number of errors",
            labels=["type", "endpoint"],
        ))

    def _register(self, metric):
        self._metrics[metric.name] = metric
        return metric

    def collect_all(self) -> str:
        """Collect all metrics in Prometheus format."""
        lines = []
        for metric in self._metrics.values():
            lines.append(metric.collect())
        return "\n\n".join(lines)


# Global metrics registry
metrics = MetricsRegistry()


# =============================================================================
# Metrics Middleware
# =============================================================================

class MetricsMiddleware(BaseHTTPMiddleware):
    """Middleware to collect HTTP metrics."""

    # Paths to exclude from metrics
    EXCLUDE_PATHS = {"/metrics", "/health", "/ready", "/live"}

    async def dispatch(self, request: Request, call_next) -> Response:
        if request.url.path in self.EXCLUDE_PATHS:
            return await call_next(request)

        method = request.method
        # Normalize endpoint to avoid high cardinality
        endpoint = self._normalize_endpoint(request.url.path)

        # Track in-progress requests
        metrics.http_requests_in_progress.inc(method=method)

        start_time = time.time()
        try:
            response = await call_next(request)
            status = str(response.status_code)
        except Exception as e:
            status = "500"
            metrics.errors_total.inc(type=type(e).__name__, endpoint=endpoint)
            raise
        finally:
            duration = time.time() - start_time
            metrics.http_requests_in_progress.dec(method=method)

            # Record metrics
            metrics.http_requests_total.inc(method=method, endpoint=endpoint, status=status)
            metrics.http_request_duration_seconds.observe(duration, method=method, endpoint=endpoint)

        return response

    def _normalize_endpoint(self, path: str) -> str:
        """Normalize endpoint path to reduce cardinality."""
        # Replace UUIDs and IDs with placeholders
        import re
        # UUID pattern
        path = re.sub(
            r'[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}',
            ':id',
            path,
            flags=re.IGNORECASE
        )
        # Numeric IDs
        path = re.sub(r'/\d+(?=/|$)', '/:id', path)
        return path


# =============================================================================
# Metrics Router
# =============================================================================

router = APIRouter(tags=["Metrics"])


@router.get("/metrics")
async def get_metrics():
    """Prometheus metrics endpoint."""
    return Response(
        content=metrics.collect_all(),
        media_type="text/plain; version=0.0.4; charset=utf-8",
    )


@router.get("/metrics/json")
async def get_metrics_json():
    """JSON metrics endpoint for debugging."""
    from app.core.cache import cache_service

    return {
        "http": {
            "requests_total": dict(metrics.http_requests_total._values),
            "in_progress": dict(metrics.http_requests_in_progress._values),
        },
        "auth": {
            "attempts_total": dict(metrics.auth_attempts_total._values),
        },
        "cache": {
            "hits": dict(metrics.cache_hits_total._values),
            "misses": dict(metrics.cache_misses_total._values),
            "stats": cache_service.stats() if cache_service else {},
        },
        "errors": {
            "total": dict(metrics.errors_total._values),
        },
        "pipelines": {
            "runs_total": dict(metrics.pipeline_runs_total._values),
        },
    }


# =============================================================================
# Helper Functions
# =============================================================================

def track_auth_attempt(auth_type: str, success: bool):
    """Track an authentication attempt."""
    status = "success" if success else "failure"
    metrics.auth_attempts_total.inc(type=auth_type, status=status)


def track_cache_operation(cache_type: str, hit: bool):
    """Track a cache operation."""
    if hit:
        metrics.cache_hits_total.inc(cache_type=cache_type)
    else:
        metrics.cache_misses_total.inc(cache_type=cache_type)


def track_pipeline_run(pipeline_id: str, status: str, duration_seconds: float = None):
    """Track a pipeline run."""
    metrics.pipeline_runs_total.inc(pipeline_id=pipeline_id, status=status)
    if duration_seconds is not None:
        metrics.pipeline_run_duration_seconds.observe(duration_seconds, pipeline_id=pipeline_id)


def track_error(error_type: str, endpoint: str):
    """Track an error."""
    metrics.errors_total.inc(type=error_type, endpoint=endpoint)


def set_app_info(version: str, environment: str):
    """Set application info metric."""
    metrics.app_info.set(1, version=version, environment=environment)
