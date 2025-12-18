"""Redis caching service for NextSight AI."""
import json
import logging
from datetime import timedelta
from functools import wraps
from typing import Any, Callable, Optional, TypeVar, Union

import redis.asyncio as redis
from redis.asyncio import Redis

from app.core.config import settings
from app.utils.security import sanitize_log_input

logger = logging.getLogger(__name__)

# Type variable for generic cache decorator
T = TypeVar("T")

# Global Redis connection pool
_redis_pool: Optional[Redis] = None


class CacheConfig:
    """Cache TTL configurations for different resource types."""

    # Kubernetes resources (frequently changing)
    PODS: int = 30  # 30 seconds
    DEPLOYMENTS: int = 60  # 1 minute
    SERVICES: int = 120  # 2 minutes
    NAMESPACES: int = 300  # 5 minutes
    NODES: int = 60  # 1 minute
    EVENTS: int = 15  # 15 seconds (fast changing)

    # Metrics (real-time)
    CLUSTER_METRICS: int = 10  # 10 seconds
    POD_METRICS: int = 10
    NODE_METRICS: int = 10

    # Configuration (slower changing)
    CONFIGMAPS: int = 120  # 2 minutes
    SECRETS: int = 120
    INGRESSES: int = 120

    # Helm
    HELM_RELEASES: int = 60
    HELM_CHARTS: int = 300  # 5 minutes
    HELM_REPOS: int = 600  # 10 minutes

    # Security/Optimization (computed, expensive)
    SECURITY_DASHBOARD: int = 120
    OPTIMIZATION_DASHBOARD: int = 120

    # User sessions
    USER_SESSION: int = 1800  # 30 minutes
    REFRESH_TOKEN: int = 604800  # 7 days

    # Default
    DEFAULT: int = 60


async def get_redis() -> Optional[Redis]:
    """Get or create Redis connection pool."""
    global _redis_pool

    if _redis_pool is None:
        try:
            _redis_pool = redis.from_url(
                settings.REDIS_URL,
                encoding="utf-8",
                decode_responses=True,
                socket_timeout=5,
                socket_connect_timeout=5,
            )
            # Test connection
            await _redis_pool.ping()
            logger.info("Redis connection established: %s", settings.REDIS_URL)
        except Exception as e:
            logger.warning("Redis connection failed: %s. Caching disabled.", str(e))
            _redis_pool = None

    return _redis_pool


async def close_redis():
    """Close Redis connection pool."""
    global _redis_pool
    if _redis_pool:
        await _redis_pool.close()
        _redis_pool = None
        logger.info("Redis connection closed")


class CacheService:
    """Redis caching service with automatic serialization."""

    def __init__(self):
        self.prefix = "nextsight:"
        self.enabled = True

    async def _get_client(self) -> Optional[Redis]:
        """Get Redis client."""
        if not self.enabled:
            return None
        return await get_redis()

    def _make_key(self, key: str) -> str:
        """Create cache key with prefix."""
        return f"{self.prefix}{key}"

    async def get(self, key: str) -> Optional[Any]:
        """Get value from cache."""
        client = await self._get_client()
        if not client:
            return None

        try:
            cache_key = self._make_key(key)
            value = await client.get(cache_key)
            if value:
                logger.debug("Cache HIT: %s", sanitize_log_input(key))
                return json.loads(value)
            logger.debug("Cache MISS: %s", sanitize_log_input(key))
            return None
        except Exception as e:
            logger.warning("Cache get error for %s: %s", sanitize_log_input(key), str(e))
            return None

    async def set(
        self,
        key: str,
        value: Any,
        ttl: int = CacheConfig.DEFAULT,
    ) -> bool:
        """Set value in cache with TTL."""
        client = await self._get_client()
        if not client:
            return False

        try:
            cache_key = self._make_key(key)
            serialized = json.dumps(value, default=str)
            await client.setex(cache_key, ttl, serialized)
            logger.debug("Cache SET: %s (TTL: %ds)", key, ttl)
            return True
        except Exception as e:
            logger.warning("Cache set error for %s: %s", key, str(e))
            return False

    async def delete(self, key: str) -> bool:
        """Delete key from cache."""
        client = await self._get_client()
        if not client:
            return False

        try:
            cache_key = self._make_key(key)
            await client.delete(cache_key)
            logger.debug("Cache DELETE: %s", key)
            return True
        except Exception as e:
            logger.warning("Cache delete error for %s: %s", key, str(e))
            return False

    async def delete_pattern(self, pattern: str) -> int:
        """Delete all keys matching pattern."""
        client = await self._get_client()
        if not client:
            return 0

        try:
            cache_pattern = self._make_key(pattern)
            keys = []
            async for key in client.scan_iter(match=cache_pattern):
                keys.append(key)

            if keys:
                deleted = await client.delete(*keys)
                logger.debug("Cache DELETE PATTERN: %s (%d keys)", pattern, deleted)
                return deleted
            return 0
        except Exception as e:
            logger.warning("Cache delete pattern error for %s: %s", pattern, str(e))
            return 0

    async def invalidate_namespace(self, namespace: str) -> int:
        """Invalidate all cache entries for a namespace."""
        return await self.delete_pattern(f"*:{namespace}:*")

    async def invalidate_resource_type(self, resource_type: str) -> int:
        """Invalidate all cache entries for a resource type."""
        return await self.delete_pattern(f"{resource_type}:*")

    async def get_or_set(
        self,
        key: str,
        factory: Callable[[], Any],
        ttl: int = CacheConfig.DEFAULT,
    ) -> Any:
        """Get from cache or compute and store."""
        # Try to get from cache
        cached = await self.get(key)
        if cached is not None:
            return cached

        # Compute value
        if callable(factory):
            value = await factory() if hasattr(factory, '__await__') or hasattr(factory, '__call__') else factory()
            # Handle coroutines
            if hasattr(value, '__await__'):
                value = await value
        else:
            value = factory

        # Store in cache
        await self.set(key, value, ttl)
        return value

    async def get_stats(self) -> dict:
        """Get cache statistics."""
        client = await self._get_client()
        if not client:
            return {"enabled": False, "connected": False}

        try:
            info = await client.info("stats")
            memory = await client.info("memory")

            # Count keys with our prefix
            key_count = 0
            async for _ in client.scan_iter(match=f"{self.prefix}*"):
                key_count += 1

            return {
                "enabled": True,
                "connected": True,
                "keys": key_count,
                "hits": info.get("keyspace_hits", 0),
                "misses": info.get("keyspace_misses", 0),
                "memory_used": memory.get("used_memory_human", "N/A"),
                "memory_peak": memory.get("used_memory_peak_human", "N/A"),
            }
        except Exception as e:
            return {"enabled": True, "connected": False, "error": str(e)}

    async def flush(self) -> bool:
        """Flush all cache entries with our prefix."""
        return await self.delete_pattern("*") > 0


# Decorator for caching function results
def cached(
    key_prefix: str,
    ttl: int = CacheConfig.DEFAULT,
    key_builder: Optional[Callable[..., str]] = None,
):
    """
    Decorator to cache async function results.

    Usage:
        @cached("pods", ttl=30)
        async def get_pods(namespace: str):
            ...

        @cached("pod", ttl=30, key_builder=lambda ns, name: f"{ns}:{name}")
        async def get_pod(namespace: str, name: str):
            ...
    """
    def decorator(func: Callable[..., T]) -> Callable[..., T]:
        @wraps(func)
        async def wrapper(*args, **kwargs) -> T:
            cache = cache_service

            # Build cache key
            if key_builder:
                key_suffix = key_builder(*args, **kwargs)
            else:
                # Auto-generate key from arguments
                arg_parts = [str(a) for a in args if a is not None]
                kwarg_parts = [f"{k}={v}" for k, v in sorted(kwargs.items()) if v is not None]
                key_suffix = ":".join(arg_parts + kwarg_parts) or "default"

            cache_key = f"{key_prefix}:{key_suffix}"

            # Try cache first
            cached_value = await cache.get(cache_key)
            if cached_value is not None:
                return cached_value

            # Call function
            result = await func(*args, **kwargs)

            # Cache result
            await cache.set(cache_key, result, ttl)

            return result

        return wrapper
    return decorator


# Cache invalidation decorator
def invalidates_cache(*patterns: str):
    """
    Decorator to invalidate cache patterns after function execution.

    Usage:
        @invalidates_cache("pods:*", "deployments:*")
        async def delete_deployment(namespace: str, name: str):
            ...
    """
    def decorator(func: Callable[..., T]) -> Callable[..., T]:
        @wraps(func)
        async def wrapper(*args, **kwargs) -> T:
            result = await func(*args, **kwargs)

            # Invalidate cache patterns
            cache = cache_service
            for pattern in patterns:
                # Replace placeholders with actual values
                actual_pattern = pattern
                if "{namespace}" in pattern and "namespace" in kwargs:
                    actual_pattern = actual_pattern.replace("{namespace}", kwargs["namespace"])
                elif "{namespace}" in pattern and len(args) > 0:
                    actual_pattern = actual_pattern.replace("{namespace}", str(args[0]))

                await cache.delete_pattern(actual_pattern)

            return result

        return wrapper
    return decorator


# Global cache service instance
cache_service = CacheService()


# Helper functions for common cache operations
async def cache_k8s_resource(
    resource_type: str,
    namespace: Optional[str],
    data: Any,
    ttl: Optional[int] = None,
) -> bool:
    """Cache a Kubernetes resource."""
    if ttl is None:
        ttl = getattr(CacheConfig, resource_type.upper(), CacheConfig.DEFAULT)

    key = f"k8s:{resource_type}:{namespace or 'cluster'}"
    return await cache_service.set(key, data, ttl)


async def get_cached_k8s_resource(
    resource_type: str,
    namespace: Optional[str],
) -> Optional[Any]:
    """Get cached Kubernetes resource."""
    key = f"k8s:{resource_type}:{namespace or 'cluster'}"
    return await cache_service.get(key)


async def invalidate_k8s_cache(
    resource_type: Optional[str] = None,
    namespace: Optional[str] = None,
) -> int:
    """Invalidate Kubernetes cache."""
    if resource_type and namespace:
        pattern = f"k8s:{resource_type}:{namespace}"
    elif resource_type:
        pattern = f"k8s:{resource_type}:*"
    elif namespace:
        pattern = f"k8s:*:{namespace}"
    else:
        pattern = "k8s:*"

    return await cache_service.delete_pattern(pattern)
