from datetime import datetime, timezone

from fastapi import APIRouter

from app.core.config import settings

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
    except Exception:
        pass

    try:
        from app.services.jenkins_service import jenkins_service

        jenkins_service._initialize()
        checks["jenkins"] = True
    except Exception:
        pass

    if settings.ANTHROPIC_API_KEY:
        checks["ai"] = True

    all_healthy = all(checks.values())

    return {"ready": all_healthy, "checks": checks, "timestamp": datetime.now(timezone.utc).isoformat()}


@router.get("/live")
async def liveness_check():
    """Liveness check - simple ping to verify the service is running."""
    return {"alive": True}
