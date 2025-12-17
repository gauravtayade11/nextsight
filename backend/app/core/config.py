from functools import lru_cache
from typing import Optional

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Application
    APP_NAME: str = "NextSight AI"
    APP_VERSION: str = "1.4.0"
    DEBUG: bool = False
    API_PREFIX: str = "/api/v1"
    DEMO_MODE: bool = False  # Enable demo data when K8s is unavailable

    # Security
    SECRET_KEY: str = "your-secret-key-change-in-production"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    DEFAULT_ADMIN_PASSWORD: str = "admin123"  # CHANGE IN PRODUCTION via env var!

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/nextsight"
    USE_DATABASE_AUTH: bool = True  # Uses PostgreSQL for auth, pipelines, and OAuth users (required for production)

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"
    REDIS_ENABLED: bool = True

    # OAuth Providers
    OAUTH_ENABLED: bool = True
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    GITHUB_CLIENT_ID: str = ""
    GITHUB_CLIENT_SECRET: str = ""
    GITLAB_CLIENT_ID: str = ""
    GITLAB_CLIENT_SECRET: str = ""
    GITLAB_URL: str = "https://gitlab.com"
    OAUTH_REDIRECT_BASE: str = "http://localhost:3000"  # Frontend URL for OAuth callback

    # Kubernetes
    K8S_CONFIG_PATH: Optional[str] = None
    K8S_IN_CLUSTER: bool = False
    K8S_HOST_OVERRIDE: Optional[str] = None  # Use 'host.docker.internal' for Docker Desktop

    # Jenkins
    JENKINS_URL: str = "http://localhost:8080"
    JENKINS_USERNAME: str = ""
    JENKINS_TOKEN: str = ""

    # AI Provider (groq, gemini, anthropic)
    AI_PROVIDER: str = "groq"

    # Groq (FREE & FAST - recommended)
    GROQ_API_KEY: str = ""
    GROQ_MODEL: str = "llama-3.3-70b-versatile"

    # Google Gemini
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-2.0-flash"

    # Anthropic Claude (paid alternative)
    ANTHROPIC_API_KEY: str = ""
    CLAUDE_MODEL: str = "claude-sonnet-4-20250514"

    # CORS
    CORS_ORIGINS: list[str] = ["http://localhost:3000", "http://localhost:5173"]

    class Config:
        env_file = ".env"
        case_sensitive = True


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
