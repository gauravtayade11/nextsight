from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import TYPE_CHECKING, List, Optional

from pydantic import BaseModel, Field


class UserRole(str, Enum):
    VIEWER = "viewer"
    OPERATOR = "operator"
    DEVELOPER = "developer"
    ADMIN = "admin"


class UserInfo(BaseModel):
    id: str
    username: str
    email: Optional[str] = None
    full_name: Optional[str] = None
    role: UserRole
    is_active: bool = True
    created_at: datetime
    last_login: Optional[datetime] = None


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserInfo


class LoginRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=6)


class UserCreate(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    email: Optional[str] = None
    full_name: Optional[str] = None
    password: str = Field(..., min_length=6)
    role: UserRole = UserRole.VIEWER


class UserUpdate(BaseModel):
    email: Optional[str] = None
    full_name: Optional[str] = None
    role: Optional[UserRole] = None
    is_active: Optional[bool] = None


class PasswordChange(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=6)


class AuditLogEntry(BaseModel):
    id: str
    user_id: str
    username: str
    action: str
    resource_type: str
    resource_name: Optional[str] = None
    namespace: Optional[str] = None
    details: Optional[str] = None
    ip_address: Optional[str] = None
    timestamp: datetime


class AuditLogResponse(BaseModel):
    logs: List[AuditLogEntry]
    total: int
    page: int
    page_size: int


# Role permissions mapping
ROLE_PERMISSIONS = {
    UserRole.VIEWER: [
        "read:namespaces",
        "read:pods",
        "read:deployments",
        "read:services",
        "read:nodes",
        "read:events",
        "read:metrics",
        "read:configmaps",
        "read:secrets:keys",  # Only keys, not values
        "read:logs",
    ],
    UserRole.OPERATOR: [
        # All viewer permissions
        "read:namespaces",
        "read:pods",
        "read:deployments",
        "read:services",
        "read:nodes",
        "read:events",
        "read:metrics",
        "read:configmaps",
        "read:secrets:keys",
        "read:logs",
        # Operator permissions
        "scale:deployments",
        "restart:deployments",
        "read:secrets",  # Full secret access
        # Helm read operations
        "helm:read",
    ],
    UserRole.DEVELOPER: [
        # All operator permissions
        "read:namespaces",
        "read:pods",
        "read:deployments",
        "read:services",
        "read:nodes",
        "read:events",
        "read:metrics",
        "read:configmaps",
        "read:secrets",
        "read:logs",
        "scale:deployments",
        "restart:deployments",
        # Developer permissions
        "deploy:yaml",
        "exec:pods",
        "kubectl:commands",
        # Helm permissions
        "helm:read",
        "helm:install",
        "helm:upgrade",
        "helm:rollback",
        "helm:uninstall",
        "helm:manage_repos",
    ],
    UserRole.ADMIN: [
        # All permissions
        "*",
    ],
}


def has_permission(role: UserRole, permission: str) -> bool:
    """Check if a role has a specific permission."""
    permissions = ROLE_PERMISSIONS.get(role, [])
    if "*" in permissions:
        return True
    return permission in permissions
