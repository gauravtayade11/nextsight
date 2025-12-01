from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.core.config import settings
from app.api.routes import kubernetes, jenkins, incidents, timeline, selfservice, health, gitflow, websocket


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    print(f"Starting {settings.APP_NAME} v{settings.APP_VERSION}")
    yield
    # Shutdown
    print("Shutting down NexOps Center")


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Unified DevOps Operations Center with AI-powered incident analysis",
    lifespan=lifespan,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(health.router, tags=["Health"])
app.include_router(kubernetes.router, prefix=f"{settings.API_PREFIX}/kubernetes", tags=["Kubernetes"])
app.include_router(jenkins.router, prefix=f"{settings.API_PREFIX}/jenkins", tags=["Jenkins"])
app.include_router(incidents.router, prefix=f"{settings.API_PREFIX}/incidents", tags=["Incidents"])
app.include_router(timeline.router, prefix=f"{settings.API_PREFIX}/timeline", tags=["Timeline"])
app.include_router(selfservice.router, prefix=f"{settings.API_PREFIX}/selfservice", tags=["Self-Service"])
app.include_router(gitflow.router, prefix=f"{settings.API_PREFIX}/gitflow", tags=["GitFlow"])
app.include_router(websocket.router, prefix=f"{settings.API_PREFIX}/ws", tags=["WebSocket"])


@app.get("/")
async def root():
    return {
        "name": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "status": "operational",
    }
