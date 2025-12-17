from __future__ import annotations

import re
from datetime import datetime
from enum import Enum
from typing import TYPE_CHECKING, List, Optional

from pydantic import BaseModel, Field, field_validator


class UserRole(str, Enum):
    VIEWER = "viewer"
    OPERATOR = "operator"
    DEVELOPER = "developer"
    ADMIN = "admin"


class PermissionCategory(str, Enum):
    """Permission category enumeration."""
    KUBERNETES = "kubernetes"
    GITOPS = "gitops"
    HELM = "helm"
    SECURITY = "security"
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
    use_custom_permissions: bool = False
    custom_permissions: Optional[List[str]] = None  # List of permission keys if custom


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int
    refresh_expires_in: int
    user: UserInfo


class RefreshTokenRequest(BaseModel):
    refresh_token: str


class RefreshTokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int


class LoginRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=6)


class LogoutRequest(BaseModel):
    refresh_token: Optional[str] = None


def validate_password_strength(password: str) -> str:
    """Validate password meets security requirements."""
    if len(password) < 8:
        raise ValueError("Password must be at least 8 characters long")
    if not re.search(r"[A-Z]", password):
        raise ValueError("Password must contain at least one uppercase letter")
    if not re.search(r"[a-z]", password):
        raise ValueError("Password must contain at least one lowercase letter")
    if not re.search(r"\d", password):
        raise ValueError("Password must contain at least one digit")
    if not re.search(r"[!@#$%^&*(),.?\":{}|<>]", password):
        raise ValueError("Password must contain at least one special character (!@#$%^&*(),.?\":{}|<>)")
    return password


class UserCreate(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    email: Optional[str] = None
    full_name: Optional[str] = None
    password: str = Field(..., min_length=8)
    role: UserRole = UserRole.VIEWER

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        return validate_password_strength(v)


class UserUpdate(BaseModel):
    email: Optional[str] = None
    full_name: Optional[str] = None
    role: Optional[UserRole] = None
    is_active: Optional[bool] = None


class PasswordChange(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=8)

    @field_validator("new_password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        return validate_password_strength(v)


class PasswordReset(BaseModel):
    """Admin password reset for a user."""
    new_password: str = Field(..., min_length=8)

    @field_validator("new_password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        return validate_password_strength(v)


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


# ==================== Custom Permission Schemas ====================

# Default role permissions for UI display (maps to granular permissions)
DEFAULT_ROLE_PERMISSIONS_UI = {
    UserRole.ADMIN: ["*"],  # Full access
    UserRole.DEVELOPER: [
        "k8s.view", "k8s.create", "k8s.edit", "k8s.delete", "k8s.exec", "k8s.logs",
        "argocd.view", "argocd.sync", "argocd.create", "argocd.rollback",
        "helm.view", "helm.install", "helm.upgrade",
        "security.view", "security.scan",
    ],
    UserRole.OPERATOR: [
        "k8s.view", "k8s.edit", "k8s.exec", "k8s.logs",
        "argocd.view", "argocd.sync", "argocd.rollback",
        "helm.view", "helm.upgrade",
        "security.view",
    ],
    UserRole.VIEWER: [
        "k8s.view", "k8s.logs",
        "argocd.view",
        "helm.view",
        "security.view",
    ],
}


class PermissionInfo(BaseModel):
    """Information about a single permission."""
    key: str
    label: str
    category: PermissionCategory


class PermissionCategoryInfo(BaseModel):
    """A category of permissions."""
    name: str
    category: PermissionCategory
    permissions: List[PermissionInfo]


class AvailablePermissionsResponse(BaseModel):
    """Response containing all available permissions in the system."""
    categories: List[PermissionCategoryInfo]


class UserPermissionEntry(BaseModel):
    """A single permission assigned to a user."""
    id: str
    permission: str
    category: PermissionCategory
    granted_by: Optional[str] = None
    granted_at: datetime


class UserPermissionsResponse(BaseModel):
    """Response containing a user's permissions."""
    user_id: str
    username: str
    role: UserRole
    use_custom_permissions: bool
    permissions: List[str]  # List of permission keys
    role_default_permissions: List[str]  # What they would have from role alone


class SetUserPermissionsRequest(BaseModel):
    """Request to set a user's custom permissions."""
    use_custom_permissions: bool
    permissions: List[str] = []  # List of permission keys to assign


class SetUserPermissionsResponse(BaseModel):
    """Response after setting permissions."""
    user_id: str
    use_custom_permissions: bool
    permissions: List[str]
    message: str
