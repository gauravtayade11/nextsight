"""User, UserPermission, and AuditLog database models."""
import enum
from datetime import datetime
from typing import Optional, List

from sqlalchemy import Boolean, Column, DateTime, Enum, ForeignKey, String, Text, Index, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.models.base import Base, TimestampMixin, generate_uuid


class UserRole(str, enum.Enum):
    """User role enumeration."""
    ADMIN = "admin"
    DEVELOPER = "developer"
    OPERATOR = "operator"
    VIEWER = "viewer"


class AuthProvider(str, enum.Enum):
    """Authentication provider enumeration."""
    LOCAL = "local"
    GOOGLE = "google"
    GITHUB = "github"
    GITLAB = "gitlab"


class User(Base, TimestampMixin):
    """User model for authentication (supports both local and OAuth users)."""

    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    username = Column(String(100), unique=True, nullable=False, index=True)
    email = Column(String(255), unique=True, nullable=True, index=True)
    full_name = Column(String(255), nullable=True)
    password_hash = Column(String(255), nullable=True)  # Nullable for OAuth users
    role = Column(
        Enum(UserRole, values_callable=lambda x: [e.value for e in x]),
        default=UserRole.VIEWER,
        nullable=False
    )
    is_active = Column(Boolean, default=True, nullable=False)
    last_login = Column(DateTime(timezone=True), nullable=True)

    # Custom permissions flag - when True, use UserPermission table instead of role defaults
    use_custom_permissions = Column(Boolean, default=False, nullable=False)

    # Relationship to custom permissions
    custom_permissions = relationship("UserPermission", back_populates="user", cascade="all, delete-orphan")

    # OAuth-specific fields
    auth_provider = Column(
        Enum(AuthProvider, values_callable=lambda x: [e.value for e in x]),
        default=AuthProvider.LOCAL,
        nullable=False
    )
    oauth_provider_id = Column(String(255), nullable=True)  # Provider's user ID
    avatar_url = Column(String(500), nullable=True)

    # Unique constraint for OAuth users (one account per provider+provider_id)
    __table_args__ = (
        UniqueConstraint('auth_provider', 'oauth_provider_id', name='uq_oauth_provider_user'),
        Index('ix_users_oauth', 'auth_provider', 'oauth_provider_id'),
    )

    @property
    def is_oauth_user(self) -> bool:
        """Check if user authenticated via OAuth."""
        return self.auth_provider != AuthProvider.LOCAL

    def __repr__(self):
        return f"<User(id={self.id}, username={self.username}, role={self.role}, auth={self.auth_provider})>"


class PermissionCategory(str, enum.Enum):
    """Permission category enumeration."""
    KUBERNETES = "kubernetes"
    GITOPS = "gitops"
    HELM = "helm"
    SECURITY = "security"
    ADMIN = "admin"


class UserPermission(Base, TimestampMixin):
    """Custom user permissions - allows granular permission assignment per user."""

    __tablename__ = "user_permissions"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    permission = Column(String(100), nullable=False)  # e.g., "k8s.view", "helm.install"
    category = Column(
        Enum(PermissionCategory, values_callable=lambda x: [e.value for e in x]),
        nullable=False
    )
    granted_by = Column(String(36), nullable=True)  # User ID who granted the permission
    granted_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relationship back to user
    user = relationship("User", back_populates="custom_permissions")

    # Unique constraint - one permission per user
    __table_args__ = (
        UniqueConstraint('user_id', 'permission', name='uq_user_permission'),
        Index('ix_user_permissions_user', 'user_id'),
        Index('ix_user_permissions_category', 'category'),
    )

    def __repr__(self):
        return f"<UserPermission(user_id={self.user_id}, permission={self.permission})>"


# All available permissions in the system
AVAILABLE_PERMISSIONS = {
    PermissionCategory.KUBERNETES: [
        "k8s.view",      # View resources
        "k8s.create",    # Create resources
        "k8s.edit",      # Edit/update resources
        "k8s.delete",    # Delete resources
        "k8s.exec",      # Execute commands in pods
        "k8s.logs",      # View pod logs
    ],
    PermissionCategory.GITOPS: [
        "argocd.view",      # View ArgoCD apps
        "argocd.sync",      # Sync applications
        "argocd.create",    # Create applications
        "argocd.delete",    # Delete applications
        "argocd.rollback",  # Rollback applications
    ],
    PermissionCategory.HELM: [
        "helm.view",       # View Helm releases
        "helm.install",    # Install charts
        "helm.upgrade",    # Upgrade releases
        "helm.uninstall",  # Uninstall releases
    ],
    PermissionCategory.SECURITY: [
        "security.view",    # View security scans
        "security.scan",    # Run security scans
        "security.config",  # Configure security settings
    ],
    PermissionCategory.ADMIN: [
        "admin.users",      # Manage users
        "admin.roles",      # Manage roles/permissions
        "admin.clusters",   # Manage cluster connections
        "admin.audit",      # View audit logs
    ],
}


class AuditLog(Base):
    """Audit log for tracking user actions."""

    __tablename__ = "audit_logs"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), nullable=False, index=True)
    username = Column(String(100), nullable=False)
    action = Column(String(50), nullable=False, index=True)
    resource_type = Column(String(50), nullable=False, index=True)
    resource_name = Column(String(255), nullable=True)
    namespace = Column(String(100), nullable=True)
    details = Column(Text, nullable=True)
    ip_address = Column(String(45), nullable=True)
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)

    # Composite index for common query patterns
    __table_args__ = (
        Index('ix_audit_logs_user_action', 'user_id', 'action'),
        Index('ix_audit_logs_timestamp_desc', timestamp.desc()),
    )

    def __repr__(self):
        return f"<AuditLog(id={self.id}, user={self.username}, action={self.action})>"
