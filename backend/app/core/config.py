from functools import lru_cache
from typing import Optional

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Application
    APP_NAME: str = "NexOps Center"
    APP_VERSION: str = "1.3.0"
    DEBUG: bool = False
    API_PREFIX: str = "/api/v1"

    # Security
    SECRET_KEY: str = "your-secret-key-change-in-production"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/nexops"

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"

    # Kubernetes
    K8S_CONFIG_PATH: Optional[str] = None
    K8S_IN_CLUSTER: bool = False
    K8S_HOST_OVERRIDE: Optional[str] = None  # Use 'host.docker.internal' for Docker Desktop

    # Jenkins
    JENKINS_URL: str = "http://localhost:8080"
    JENKINS_USERNAME: str = ""
    JENKINS_TOKEN: str = ""

    # AI Provider (gemini, anthropic)
    AI_PROVIDER: str = "gemini"

    # Google Gemini
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-2.0-flash"

    # Anthropic Claude (alternative)
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
