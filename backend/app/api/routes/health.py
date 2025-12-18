import logging
from datetime import datetime, timezone

from fastapi import APIRouter

from app.core.config import settings

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/health")
async def health_check():
    """Basic health check endpoint."""
    return {
        "status": "healthy",
        "service": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/ready")
async def readiness_check():
    """Readiness check - verifies all dependencies are available."""
    checks = {"api": True, "kubernetes": False, "jenkins": False, "ai": False}

    try:
        from app.services.kubernetes_service import kubernetes_service

        kubernetes_service._initialize()
        checks["kubernetes"] = True
    except Exception as e:
        logger.debug(f"Kubernetes not ready: {type(e).__name__}")

    try:
        from app.services.jenkins_service import jenkins_service

        jenkins_service._initialize()
        checks["jenkins"] = True
    except Exception as e:
        logger.debug(f"Jenkins not ready: {type(e).__name__}")

    if settings.ANTHROPIC_API_KEY:
        checks["ai"] = True

    all_healthy = all(checks.values())

    return {"ready": all_healthy, "checks": checks, "timestamp": datetime.now(timezone.utc).isoformat()}


@router.get("/live")
async def liveness_check():
    """Liveness check - simple ping to verify the service is running."""
    return {"alive": True}


@router.get("/system/status")
async def system_status():
    """Get detailed system status including cache, database, and OAuth."""
    status = {
        "service": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "components": {},
    }

    # Cache status
    try:
        from app.core.cache import cache_service
        cache_stats = await cache_service.get_stats()
        status["components"]["cache"] = {
            "type": "redis",
            "enabled": settings.REDIS_ENABLED,
            **cache_stats,
        }
    except Exception as e:
        status["components"]["cache"] = {"enabled": False, "error": str(e)}

    # Database status
    status["components"]["database"] = {
        "type": "postgresql",
        "enabled": settings.USE_DATABASE_AUTH,
        "url": settings.DATABASE_URL.split("@")[-1] if settings.USE_DATABASE_AUTH else None,
    }

    # OAuth status
    try:
        from app.services.oauth_service import oauth_service
        providers = oauth_service.get_enabled_providers()
        status["components"]["oauth"] = {
            "enabled": settings.OAUTH_ENABLED,
            "providers": providers,
        }
    except Exception:
        status["components"]["oauth"] = {"enabled": False, "providers": []}

    # AI status
    status["components"]["ai"] = {
        "provider": settings.AI_PROVIDER,
        "gemini_enabled": bool(settings.GEMINI_API_KEY),
        "anthropic_enabled": bool(settings.ANTHROPIC_API_KEY),
    }

    return status


@router.get("/cache/stats")
async def cache_stats():
    """Get Redis cache statistics."""
    try:
        from app.core.cache import cache_service
        return await cache_service.get_stats()
    except Exception as e:
        return {"error": str(e), "enabled": False}


@router.post("/cache/flush")
async def flush_cache():
    """Flush all cache entries. Admin use only."""
    try:
        from app.core.cache import cache_service
        success = await cache_service.flush()
        return {"flushed": success, "message": "Cache flushed successfully" if success else "No cache to flush"}
    except Exception as e:
        return {"error": str(e), "flushed": False}
