import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.api.routes import (
    agents,
    ai,
    argocd,
    auth,
    clusters,
    # cost,  # Excluded from v1.4.0 release - coming in future version
    gitflow,
    health,
    helm,
    incidents,
    jenkins,
    kubernetes,
    optimization,
    # pipelines,  # Excluded from v1.4.0 release - coming in future version
    prometheus,
    security,
    selfservice,
    settings as settings_routes,
    testing,
    timeline,
    websocket,
)
from app.core.config import settings
from app.core.database import init_db, close_db, async_session_maker
from app.core.exceptions import ServiceException, service_exception_handler, generic_exception_handler
from app.core.cache import get_redis, close_redis, cache_service
from app.core.middleware import setup_middleware
from app.core.startup import run_startup_checks, get_environment
from app.core.metrics import router as metrics_router, MetricsMiddleware, set_app_info
from app.services.auth_service_db import create_default_admin

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    env = get_environment()
    logger.info(f"Starting {settings.APP_NAME} v{settings.APP_VERSION} ({env})")

    # Run production validation checks
    run_startup_checks(settings, block_on_failure=not settings.DEBUG)

    # Set app info metric
    set_app_info(settings.APP_VERSION, env)

    # Initialize Redis cache
    if settings.REDIS_ENABLED:
        try:
            redis_client = await get_redis()
            if redis_client:
                logger.info("Redis cache connected: %s", settings.REDIS_URL)
            else:
                logger.warning("Redis not available - caching disabled")
        except Exception as e:
            logger.warning("Redis connection failed: %s - caching disabled", e)

    # Initialize database tables only if database auth is enabled
    if settings.USE_DATABASE_AUTH:
        try:
            await init_db()
            logger.info("Database tables initialized")

            # Create default admin user if needed
            async with async_session_maker() as session:
                await create_default_admin(session)
            logger.info("Using PostgreSQL database for authentication")
        except Exception as e:
            logger.error("Database initialization failed: %s", e)
            logger.error("Set USE_DATABASE_AUTH=false or configure DATABASE_URL correctly")
            raise
    else:
        logger.info("Using in-memory authentication (demo mode)")
        logger.info("Set USE_DATABASE_AUTH=true to use PostgreSQL database")

    # Log OAuth status
    if settings.OAUTH_ENABLED:
        from app.services.oauth_service import oauth_service
        providers = oauth_service.get_enabled_providers()
        if providers:
            # Only log provider names, not the full configuration (which may contain secrets)
            provider_names = [p.get("name", "unknown") for p in providers if isinstance(p, dict)]
            logger.info("OAuth providers enabled: %s", provider_names)
        else:
            logger.info("OAuth enabled but no providers configured")

    yield

    # Shutdown
    logger.info("Shutting down NextSight Center")
    await close_redis()
    if settings.USE_DATABASE_AUTH:
        await close_db()


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Unified DevOps Operations Center with AI-powered incident analysis",
    lifespan=lifespan,
)

# Add exception handlers
app.add_exception_handler(ServiceException, service_exception_handler)
app.add_exception_handler(Exception, generic_exception_handler)

# Setup middleware (CORS, security headers, rate limiting, etc.)
setup_middleware(
    app,
    cors_origins=settings.CORS_ORIGINS,
    rate_limiting_enabled=not settings.DEBUG,  # Disable rate limiting in debug mode
    debug=settings.DEBUG,
)

# Metrics middleware
app.add_middleware(MetricsMiddleware)

# Include routers
app.include_router(metrics_router, tags=["Metrics"])
app.include_router(health.router, tags=["Health"])
app.include_router(kubernetes.router, prefix=f"{settings.API_PREFIX}/kubernetes", tags=["Kubernetes"])
app.include_router(jenkins.router, prefix=f"{settings.API_PREFIX}/jenkins", tags=["Jenkins"])
app.include_router(incidents.router, prefix=f"{settings.API_PREFIX}/incidents", tags=["Incidents"])
app.include_router(timeline.router, prefix=f"{settings.API_PREFIX}/timeline", tags=["Timeline"])
app.include_router(selfservice.router, prefix=f"{settings.API_PREFIX}/selfservice", tags=["Self-Service"])
app.include_router(gitflow.router, prefix=f"{settings.API_PREFIX}/gitflow", tags=["GitFlow"])
app.include_router(websocket.router, prefix=f"{settings.API_PREFIX}/ws", tags=["WebSocket"])
app.include_router(clusters.router, prefix=f"{settings.API_PREFIX}/clusters", tags=["Clusters"])
app.include_router(auth.router, prefix=f"{settings.API_PREFIX}/auth", tags=["Authentication"])
app.include_router(helm.router, prefix=f"{settings.API_PREFIX}", tags=["Helm"])
# app.include_router(cost.router, prefix=f"{settings.API_PREFIX}", tags=["Cost"])  # Excluded from v1.4.0
app.include_router(security.router, prefix=f"{settings.API_PREFIX}", tags=["Security"])
app.include_router(ai.router, prefix=f"{settings.API_PREFIX}", tags=["AI"])
app.include_router(argocd.router, prefix=f"{settings.API_PREFIX}", tags=["ArgoCD"])
app.include_router(optimization.router, prefix=f"{settings.API_PREFIX}/optimization", tags=["Optimization"])
# app.include_router(pipelines.router, prefix=f"{settings.API_PREFIX}", tags=["Pipelines"])  # Excluded from v1.4.0
app.include_router(testing.router, prefix=f"{settings.API_PREFIX}", tags=["Testing & Coverage"])
app.include_router(agents.router, prefix=f"{settings.API_PREFIX}", tags=["Agents"])
app.include_router(prometheus.router, prefix=f"{settings.API_PREFIX}", tags=["Prometheus"])
app.include_router(settings_routes.router, prefix=f"{settings.API_PREFIX}/settings", tags=["Settings"])


@app.get("/")
async def root():
    return {
        "name": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "status": "operational",
    }
