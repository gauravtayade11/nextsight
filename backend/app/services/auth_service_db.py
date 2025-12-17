"""Database-backed authentication service."""
import logging
from datetime import datetime, timezone
from typing import List, Optional, Tuple

from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import (
    REFRESH_TOKEN_EXPIRE_DAYS,
    blacklist_token,
    create_access_token,
    create_refresh_token,
    decode_refresh_token,
    get_password_hash,
    verify_password,
)
from app.models.user import User, UserRole, UserPermission, AuditLog
from app.schemas.auth import (
    AuditLogEntry,
    RefreshTokenResponse,
    TokenResponse,
    UserCreate,
    UserInfo,
    DEFAULT_ROLE_PERMISSIONS_UI,
)

logger = logging.getLogger(__name__)


class DatabaseAuthService:
    """Database-backed authentication service."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def _build_user_info(self, user: User) -> UserInfo:
        """Build UserInfo with custom permissions if enabled."""
        custom_permissions = None

        if user.use_custom_permissions:
            # Fetch custom permissions from database
            perm_result = await self.db.execute(
                select(UserPermission).where(UserPermission.user_id == user.id)
            )
            user_perms = perm_result.scalars().all()
            custom_permissions = [p.permission for p in user_perms]

        return UserInfo(
            id=user.id,
            username=user.username,
            email=user.email,
            full_name=user.full_name,
            role=user.role,
            is_active=user.is_active,
            created_at=user.created_at,
            last_login=user.last_login,
            use_custom_permissions=user.use_custom_permissions,
            custom_permissions=custom_permissions,
        )

    async def authenticate(self, username: str, password: str) -> Optional[TokenResponse]:
        """Authenticate a user and return access and refresh tokens."""
        # Find user by username
        result = await self.db.execute(
            select(User).where(User.username == username)
        )
        user = result.scalar_one_or_none()

        if not user:
            logger.warning("Login failed: user not found: %s", username)
            return None

        if not verify_password(password, user.password_hash):
            logger.warning("Login failed: invalid password for user: %s", username)
            return None

        if not user.is_active:
            logger.warning("Login failed: user disabled: %s", username)
            return None

        # Update last login
        user.last_login = datetime.now(timezone.utc)
        await self.db.commit()

        # Create tokens
        token_data = {"sub": user.id, "username": username, "role": user.role.value}
        access_token = create_access_token(data=token_data)
        refresh_token = create_refresh_token(data=token_data)

        user_info = await self._build_user_info(user)

        # Log the login
        await self.log_action(
            user_id=user.id,
            username=username,
            action="login",
            resource_type="auth",
            details="User logged in successfully",
        )

        return TokenResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            token_type="bearer",
            expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
            refresh_expires_in=REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
            user=user_info,
        )

    async def refresh_access_token(self, refresh_token: str) -> Optional[RefreshTokenResponse]:
        """Refresh an access token using a refresh token."""
        payload = decode_refresh_token(refresh_token)
        if not payload:
            logger.warning("Invalid refresh token")
            return None

        user_id = payload.get("sub")
        if not user_id:
            return None

        result = await self.db.execute(
            select(User).where(User.id == user_id)
        )
        user = result.scalar_one_or_none()

        if not user:
            logger.warning("Refresh failed: user not found: %s", user_id)
            return None

        if not user.is_active:
            logger.warning("Refresh failed: user disabled: %s", user_id)
            return None

        # Create new access token
        token_data = {
            "sub": user.id,
            "username": user.username,
            "role": user.role.value,
        }
        new_access_token = create_access_token(data=token_data)

        return RefreshTokenResponse(
            access_token=new_access_token,
            token_type="bearer",
            expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        )

    async def logout(
        self,
        user_id: str,
        username: str,
        access_token_jti: Optional[str] = None,
        refresh_token: Optional[str] = None,
    ) -> bool:
        """Logout user by blacklisting tokens."""
        # Blacklist the access token if provided
        if access_token_jti:
            blacklist_token(access_token_jti)

        # Blacklist the refresh token if provided
        if refresh_token:
            payload = decode_refresh_token(refresh_token)
            if payload:
                jti = payload.get("jti")
                if jti:
                    blacklist_token(jti)

        # Log the logout
        await self.log_action(
            user_id=user_id,
            username=username,
            action="logout",
            resource_type="auth",
            details="User logged out",
        )

        return True

    async def change_password(
        self, user_id: str, current_password: str, new_password: str
    ) -> Tuple[bool, str]:
        """Change a user's password."""
        result = await self.db.execute(
            select(User).where(User.id == user_id)
        )
        user = result.scalar_one_or_none()

        if not user:
            return False, "User not found"

        # Verify current password
        if not verify_password(current_password, user.password_hash):
            return False, "Current password is incorrect"

        # Update password
        user.password_hash = get_password_hash(new_password)
        await self.db.commit()

        # Log the password change
        await self.log_action(
            user_id=user_id,
            username=user.username,
            action="password_change",
            resource_type="auth",
            details="Password changed successfully",
        )

        logger.info("Password changed for user: %s", user.username)
        return True, "Password changed successfully"

    async def reset_password(self, user_id: str, new_password: str, admin_id: str) -> Tuple[bool, str]:
        """Reset a user's password (admin action)."""
        result = await self.db.execute(
            select(User).where(User.id == user_id)
        )
        user = result.scalar_one_or_none()

        if not user:
            return False, "User not found"

        admin_result = await self.db.execute(
            select(User).where(User.id == admin_id)
        )
        admin = admin_result.scalar_one_or_none()

        if not admin:
            return False, "Admin user not found"

        # Update password
        user.password_hash = get_password_hash(new_password)
        await self.db.commit()

        # Log the password reset
        await self.log_action(
            user_id=admin_id,
            username=admin.username,
            action="password_reset",
            resource_type="auth",
            resource_name=user.username,
            details=f"Password reset for user: {user.username}",
        )

        logger.info("Password reset for user: %s by admin: %s", user.username, admin.username)
        return True, "Password reset successfully"

    async def get_user_by_id(self, user_id: str) -> Optional[UserInfo]:
        """Get a user by ID."""
        result = await self.db.execute(
            select(User).where(User.id == user_id)
        )
        user = result.scalar_one_or_none()

        if not user:
            return None

        return await self._build_user_info(user)

    async def get_user_by_username(self, username: str) -> Optional[UserInfo]:
        """Get a user by username."""
        result = await self.db.execute(
            select(User).where(User.username == username)
        )
        user = result.scalar_one_or_none()

        if not user:
            return None

        return await self._build_user_info(user)

    async def list_users(self) -> List[UserInfo]:
        """List all users."""
        result = await self.db.execute(
            select(User).order_by(User.created_at)
        )
        users = result.scalars().all()

        # Build UserInfo for each user (includes custom permissions check)
        user_infos = []
        for user in users:
            user_info = await self._build_user_info(user)
            user_infos.append(user_info)

        return user_infos

    async def create_user(self, user_create: UserCreate) -> UserInfo:
        """Create a new user."""
        # Check if username exists
        result = await self.db.execute(
            select(User).where(User.username == user_create.username)
        )
        if result.scalar_one_or_none():
            raise ValueError(f"Username already exists: {user_create.username}")

        # Check if email exists (if provided)
        if user_create.email:
            result = await self.db.execute(
                select(User).where(User.email == user_create.email)
            )
            if result.scalar_one_or_none():
                raise ValueError(f"Email already exists: {user_create.email}")

        user = User(
            username=user_create.username,
            email=user_create.email,
            full_name=user_create.full_name,
            password_hash=get_password_hash(user_create.password),
            role=user_create.role,
            is_active=True,
        )

        self.db.add(user)
        await self.db.commit()
        await self.db.refresh(user)

        logger.info("Created user: %s with role %s", user_create.username, user_create.role)

        return await self._build_user_info(user)

    async def update_user(self, user_id: str, **kwargs) -> Optional[UserInfo]:
        """Update a user."""
        result = await self.db.execute(
            select(User).where(User.id == user_id)
        )
        user = result.scalar_one_or_none()

        if not user:
            return None

        for key, value in kwargs.items():
            if value is not None and hasattr(user, key):
                setattr(user, key, value)

        await self.db.commit()
        await self.db.refresh(user)

        return await self.get_user_by_id(user_id)

    async def delete_user(self, user_id: str) -> bool:
        """Delete a user."""
        result = await self.db.execute(
            select(User).where(User.id == user_id)
        )
        user = result.scalar_one_or_none()

        if not user:
            return False

        await self.db.delete(user)
        await self.db.commit()
        return True

    async def log_action(
        self,
        user_id: str,
        username: str,
        action: str,
        resource_type: str,
        resource_name: Optional[str] = None,
        namespace: Optional[str] = None,
        details: Optional[str] = None,
        ip_address: Optional[str] = None,
    ):
        """Log an audit action."""
        log_entry = AuditLog(
            user_id=user_id,
            username=username,
            action=action,
            resource_type=resource_type,
            resource_name=resource_name,
            namespace=namespace,
            details=details,
            ip_address=ip_address,
        )
        self.db.add(log_entry)
        await self.db.commit()

    async def get_audit_logs(
        self,
        user_id: Optional[str] = None,
        action: Optional[str] = None,
        resource_type: Optional[str] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> Tuple[List[AuditLogEntry], int]:
        """Get audit logs with filtering."""
        query = select(AuditLog)

        # Apply filters
        if user_id:
            query = query.where(AuditLog.user_id == user_id)
        if action:
            query = query.where(AuditLog.action == action)
        if resource_type:
            query = query.where(AuditLog.resource_type == resource_type)

        # Get total count
        count_query = select(func.count()).select_from(query.subquery())
        total_result = await self.db.execute(count_query)
        total = total_result.scalar() or 0

        # Apply pagination and ordering
        query = query.order_by(desc(AuditLog.timestamp)).offset(offset).limit(limit)

        result = await self.db.execute(query)
        logs = result.scalars().all()

        return [
            AuditLogEntry(
                id=log.id,
                user_id=log.user_id,
                username=log.username,
                action=log.action,
                resource_type=log.resource_type,
                resource_name=log.resource_name,
                namespace=log.namespace,
                details=log.details,
                ip_address=log.ip_address,
                timestamp=log.timestamp,
            )
            for log in logs
        ], total


async def create_default_admin(db: AsyncSession):
    """Create default admin user if no users exist."""
    result = await db.execute(select(func.count()).select_from(User))
    count = result.scalar() or 0

    if count == 0:
        logger.info("No users found. Creating default admin user...")
        admin = User(
            username="admin",
            email="admin@nextsight.local",
            full_name="System Administrator",
            password_hash=get_password_hash(settings.DEFAULT_ADMIN_PASSWORD),
            role=UserRole.ADMIN,
            is_active=True,
        )
        db.add(admin)

        # Create demo users
        demo_users = [
            ("viewer", "Viewer User", "viewer@nextsight.local", UserRole.VIEWER),
            ("operator", "Operator User", "operator@nextsight.local", UserRole.OPERATOR),
            ("developer", "Developer User", "developer@nextsight.local", UserRole.DEVELOPER),
        ]

        for username, full_name, email, role in demo_users:
            user = User(
                username=username,
                email=email,
                full_name=full_name,
                password_hash=get_password_hash(settings.DEFAULT_ADMIN_PASSWORD),
                role=role,
                is_active=True,
            )
            db.add(user)

        await db.commit()
        logger.info("Default users created successfully")
