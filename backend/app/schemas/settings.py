"""Pydantic schemas for settings and integrations."""
from datetime import datetime
from typing import Optional, List, Dict, Any, Union
from pydantic import BaseModel, Field


# ============ Integration Schemas ============

class IntegrationBase(BaseModel):
    """Base integration schema."""
    name: str
    description: Optional[str] = None
    icon: Optional[str] = None
    category: str = Field(..., pattern="^(source-control|ci-cd|monitoring|logging|cloud|notification)$")


class IntegrationCreate(IntegrationBase):
    """Schema for creating an integration."""
    config: Optional[Dict[str, Any]] = None
    auto_sync: bool = True
    sync_interval_seconds: int = 300
    health_check_url: Optional[str] = None


class IntegrationUpdate(BaseModel):
    """Schema for updating an integration."""
    name: Optional[str] = None
    description: Optional[str] = None
    config: Optional[Dict[str, Any]] = None
    auto_sync: Optional[bool] = None
    sync_interval_seconds: Optional[int] = None
    health_check_url: Optional[str] = None


class IntegrationResponse(IntegrationBase):
    """Schema for integration response."""
    id: str
    status: str
    auto_sync: bool
    sync_interval_seconds: int
    last_sync: Optional[datetime] = None
    last_error: Optional[str] = None
    is_managed: bool = False
    setup_url: Optional[str] = None
    config: Optional[Dict[str, Any]] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class IntegrationStatusResponse(BaseModel):
    """Schema for integration status check response."""
    id: str
    name: str
    status: str
    last_sync: Optional[datetime] = None
    last_error: Optional[str] = None
    is_healthy: bool
    response_time_ms: Optional[int] = None


class IntegrationConnectRequest(BaseModel):
    """Schema for connecting an integration."""
    endpoint: str
    api_token: Optional[str] = None
    username: Optional[str] = None
    password: Optional[str] = None
    additional_config: Optional[Dict[str, Any]] = None


# ============ API Token Schemas ============

class APITokenCreate(BaseModel):
    """Schema for creating an API token."""
    name: str = Field(..., min_length=1, max_length=100)
    scopes: List[str] = Field(default_factory=list)
    expires_in_days: int = Field(default=90, ge=1, le=365)


class APITokenResponse(BaseModel):
    """Schema for API token response."""
    id: str
    name: str
    prefix: str
    scopes: List[str]
    created_at: datetime
    expires_at: datetime
    last_used: Optional[datetime] = None
    status: str

    class Config:
        from_attributes = True


class APITokenCreated(APITokenResponse):
    """Schema for newly created API token (includes the actual token value)."""
    token: str  # Only returned once on creation


# ============ User Settings Schemas ============

class NotificationSettings(BaseModel):
    """Notification preferences schema."""
    email: bool = True
    slack: bool = False
    inApp: bool = True
    deployments: bool = True
    alerts: bool = True
    security: bool = True

    model_config = {"extra": "ignore"}


class UserSettingsBase(BaseModel):
    """Base user settings schema."""
    theme: str = Field(default="system", pattern="^(light|dark|system)$")
    notifications: Union[NotificationSettings, Dict[str, Any]] = Field(default_factory=NotificationSettings)
    default_namespace: str = "default"
    auto_refresh: bool = True
    refresh_interval_seconds: int = Field(default=30, ge=5, le=300)
    timezone: str = "UTC"
    date_format: str = Field(default="YYYY-MM-DD", pattern="^(YYYY-MM-DD|DD/MM/YYYY|MM/DD/YYYY)$")


class UserSettingsUpdate(BaseModel):
    """Schema for updating user settings."""
    theme: Optional[str] = Field(None, pattern="^(light|dark|system)$")
    notifications: Optional[NotificationSettings] = None
    default_namespace: Optional[str] = None
    auto_refresh: Optional[bool] = None
    refresh_interval_seconds: Optional[int] = Field(None, ge=5, le=300)
    timezone: Optional[str] = None
    date_format: Optional[str] = Field(None, pattern="^(YYYY-MM-DD|DD/MM/YYYY|MM/DD/YYYY)$")


class UserSettingsResponse(UserSettingsBase):
    """Schema for user settings response."""
    id: str
    user_id: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ============ User Management Schemas (for Admin) ============

class UserResponse(BaseModel):
    """Schema for user response in settings page."""
    id: str
    username: str
    email: Optional[str] = None
    full_name: Optional[str] = None
    role: str
    is_active: bool
    auth_provider: str
    avatar_url: Optional[str] = None
    last_login: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


class UserCreate(BaseModel):
    """Schema for creating a new user."""
    username: str = Field(..., min_length=3, max_length=100)
    email: Optional[str] = None
    full_name: Optional[str] = None
    password: str = Field(..., min_length=8)
    role: str = Field(default="viewer", pattern="^(admin|developer|operator|viewer)$")


class UserUpdate(BaseModel):
    """Schema for updating a user."""
    email: Optional[str] = None
    full_name: Optional[str] = None
    role: Optional[str] = Field(None, pattern="^(admin|developer|operator|viewer)$")
    is_active: Optional[bool] = None


# ============ Cluster Schemas (for Settings) ============

class ClusterSettingsResponse(BaseModel):
    """Schema for cluster in settings page."""
    id: str
    name: str
    endpoint: str
    status: str
    version: Optional[str] = None
    nodes: int = 0
    is_default: bool = False


class ClusterCreate(BaseModel):
    """Schema for adding a cluster."""
    name: str = Field(..., min_length=1, max_length=100)
    endpoint: str
    kubeconfig: Optional[str] = None  # Base64 encoded kubeconfig
    is_default: bool = False


class ClusterUpdate(BaseModel):
    """Schema for updating a cluster."""
    name: Optional[str] = Field(None, max_length=100)
    endpoint: Optional[str] = None
    is_default: Optional[bool] = None
