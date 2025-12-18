"""Settings and Integration database models."""
import enum
from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, Column, DateTime, Enum, String, Text, Integer, JSON, ForeignKey
from sqlalchemy.sql import func

from app.models.base import Base, TimestampMixin, generate_uuid


class IntegrationCategory(str, enum.Enum):
    """Integration category enumeration."""
    SOURCE_CONTROL = "source-control"
    CI_CD = "ci-cd"
    MONITORING = "monitoring"
    LOGGING = "logging"
    CLOUD = "cloud"
    NOTIFICATION = "notification"


class IntegrationStatus(str, enum.Enum):
    """Integration status enumeration."""
    CONNECTED = "connected"
    DISCONNECTED = "disconnected"
    ERROR = "error"


class Integration(Base, TimestampMixin):
    """Integration configuration model."""

    __tablename__ = "integrations"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    name = Column(String(100), nullable=False, index=True)
    description = Column(String(500), nullable=True)
    icon = Column(String(50), nullable=True)
    category = Column(
        Enum(IntegrationCategory, values_callable=lambda x: [e.value for e in x]),
        nullable=False
    )
    status = Column(
        Enum(IntegrationStatus, values_callable=lambda x: [e.value for e in x]),
        default=IntegrationStatus.DISCONNECTED,
        nullable=False
    )

    # Connection configuration (stored as encrypted JSON in production)
    config = Column(JSON, nullable=True)  # endpoint, credentials, etc.

    # Auto-sync settings
    auto_sync = Column(Boolean, default=True, nullable=False)
    sync_interval_seconds = Column(Integer, default=300, nullable=False)  # 5 minutes default

    # Status tracking
    last_sync = Column(DateTime(timezone=True), nullable=True)
    last_error = Column(Text, nullable=True)
    health_check_url = Column(String(500), nullable=True)

    # Managed integration settings (deployed by NextSight AI)
    is_managed = Column(Boolean, default=False, nullable=False)
    setup_url = Column(String(200), nullable=True)  # URL to setup wizard (e.g., /monitoring/prometheus)

    def __repr__(self):
        return f"<Integration(id={self.id}, name={self.name}, status={self.status})>"


class APIToken(Base, TimestampMixin):
    """API Token model for programmatic access."""

    __tablename__ = "api_tokens"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    name = Column(String(100), nullable=False)
    token_hash = Column(String(255), nullable=False)  # Hashed token
    prefix = Column(String(20), nullable=False)  # Token prefix for identification

    # Scopes/permissions
    scopes = Column(JSON, default=list)  # e.g., ["read:deployments", "write:deployments"]

    # Expiration
    expires_at = Column(DateTime(timezone=True), nullable=False)

    # Usage tracking
    last_used = Column(DateTime(timezone=True), nullable=True)

    # Status
    is_revoked = Column(Boolean, default=False, nullable=False)

    def __repr__(self):
        return f"<APIToken(id={self.id}, name={self.name}, prefix={self.prefix})>"

    @property
    def status(self) -> str:
        """Get token status."""
        from datetime import timezone
        if self.is_revoked:
            return "revoked"
        if not self.expires_at:
            return "active"  # No expiration set
        # Handle both timezone-aware and naive datetimes
        now = datetime.now(timezone.utc)
        expires = self.expires_at
        if expires.tzinfo is None:
            expires = expires.replace(tzinfo=timezone.utc)
        if expires < now:
            return "expired"
        return "active"


class UserSettings(Base, TimestampMixin):
    """User-specific settings and preferences."""

    __tablename__ = "user_settings"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey('users.id', ondelete='CASCADE'), unique=True, nullable=False, index=True)

    # Theme preferences
    theme = Column(String(20), default="system", nullable=False)  # light, dark, system

    # Notification preferences (JSON for flexibility)
    notifications = Column(JSON, default=lambda: {
        "email": True,
        "slack": False,
        "inApp": True,
        "deployments": True,
        "alerts": True,
        "security": True,
    })

    # General settings
    default_namespace = Column(String(100), default="default", nullable=False)
    auto_refresh = Column(Boolean, default=True, nullable=False)
    refresh_interval_seconds = Column(Integer, default=30, nullable=False)
    timezone = Column(String(50), default="UTC", nullable=False)
    date_format = Column(String(20), default="YYYY-MM-DD", nullable=False)

    def __repr__(self):
        return f"<UserSettings(id={self.id}, user_id={self.user_id})>"
