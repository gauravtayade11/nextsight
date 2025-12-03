import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional

from app.core.config import settings
from app.core.security import create_access_token, get_password_hash, verify_password
from app.schemas.auth import AuditLogEntry, TokenResponse, UserCreate, UserInfo, UserRole

logger = logging.getLogger(__name__)


class AuthService:
    """Service for authentication and user management."""

    def __init__(self):
        # In-memory user store (replace with database in production)
        self._users: Dict[str, dict] = {}
        self._audit_logs: List[dict] = []
        self._initialized = False

    def _initialize(self):
        """Initialize with a default admin user."""
        if self._initialized:
            return

        # Create default admin user
        admin_id = str(uuid.uuid4())
        self._users[admin_id] = {
            "id": admin_id,
            "username": "admin",
            "email": "admin@nexops.local",
            "full_name": "System Administrator",
            "password_hash": get_password_hash("admin123"),  # Change in production!
            "role": UserRole.ADMIN,
            "is_active": True,
            "created_at": datetime.now(timezone.utc),
            "last_login": None,
        }

        # Create demo users for each role
        demo_users = [
            ("viewer", "Viewer User", UserRole.VIEWER),
            ("operator", "Operator User", UserRole.OPERATOR),
            ("developer", "Developer User", UserRole.DEVELOPER),
        ]

        for username, full_name, role in demo_users:
            user_id = str(uuid.uuid4())
            self._users[user_id] = {
                "id": user_id,
                "username": username,
                "email": f"{username}@nexops.local",
                "full_name": full_name,
                "password_hash": get_password_hash(f"{username}123"),
                "role": role,
                "is_active": True,
                "created_at": datetime.now(timezone.utc),
                "last_login": None,
            }

        self._initialized = True
        logger.info("AuthService initialized with default users")

    async def authenticate(self, username: str, password: str) -> Optional[TokenResponse]:
        """Authenticate a user and return a token."""
        self._initialize()

        user_data = None
        for user in self._users.values():
            if user["username"] == username:
                user_data = user
                break

        if not user_data:
            logger.warning(f"Login failed: user not found: {username}")
            return None

        if not verify_password(password, user_data["password_hash"]):
            logger.warning(f"Login failed: invalid password for user: {username}")
            return None

        if not user_data["is_active"]:
            logger.warning(f"Login failed: user disabled: {username}")
            return None

        # Update last login
        user_data["last_login"] = datetime.now(timezone.utc)

        # Create access token
        access_token = create_access_token(
            data={"sub": user_data["id"], "username": username, "role": user_data["role"].value}
        )

        user_info = UserInfo(
            id=user_data["id"],
            username=user_data["username"],
            email=user_data["email"],
            full_name=user_data["full_name"],
            role=user_data["role"],
            is_active=user_data["is_active"],
            created_at=user_data["created_at"],
            last_login=user_data["last_login"],
        )

        # Log the login
        await self.log_action(
            user_id=user_data["id"],
            username=username,
            action="login",
            resource_type="auth",
            details="User logged in successfully",
        )

        return TokenResponse(
            access_token=access_token,
            token_type="bearer",
            expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
            user=user_info,
        )

    async def get_user_by_id(self, user_id: str) -> Optional[UserInfo]:
        """Get a user by ID."""
        self._initialize()

        user_data = self._users.get(user_id)
        if not user_data:
            return None

        return UserInfo(
            id=user_data["id"],
            username=user_data["username"],
            email=user_data["email"],
            full_name=user_data["full_name"],
            role=user_data["role"],
            is_active=user_data["is_active"],
            created_at=user_data["created_at"],
            last_login=user_data["last_login"],
        )

    async def get_user_by_username(self, username: str) -> Optional[UserInfo]:
        """Get a user by username."""
        self._initialize()

        for user_data in self._users.values():
            if user_data["username"] == username:
                return UserInfo(
                    id=user_data["id"],
                    username=user_data["username"],
                    email=user_data["email"],
                    full_name=user_data["full_name"],
                    role=user_data["role"],
                    is_active=user_data["is_active"],
                    created_at=user_data["created_at"],
                    last_login=user_data["last_login"],
                )
        return None

    async def list_users(self) -> List[UserInfo]:
        """List all users."""
        self._initialize()

        return [
            UserInfo(
                id=user_data["id"],
                username=user_data["username"],
                email=user_data["email"],
                full_name=user_data["full_name"],
                role=user_data["role"],
                is_active=user_data["is_active"],
                created_at=user_data["created_at"],
                last_login=user_data["last_login"],
            )
            for user_data in self._users.values()
        ]

    async def create_user(self, user_create: UserCreate) -> UserInfo:
        """Create a new user."""
        self._initialize()

        # Check if username exists
        for user in self._users.values():
            if user["username"] == user_create.username:
                raise ValueError(f"Username already exists: {user_create.username}")

        user_id = str(uuid.uuid4())
        user_data = {
            "id": user_id,
            "username": user_create.username,
            "email": user_create.email,
            "full_name": user_create.full_name,
            "password_hash": get_password_hash(user_create.password),
            "role": user_create.role,
            "is_active": True,
            "created_at": datetime.now(timezone.utc),
            "last_login": None,
        }

        self._users[user_id] = user_data

        logger.info(f"Created user: {user_create.username} with role {user_create.role}")

        return UserInfo(
            id=user_data["id"],
            username=user_data["username"],
            email=user_data["email"],
            full_name=user_data["full_name"],
            role=user_data["role"],
            is_active=user_data["is_active"],
            created_at=user_data["created_at"],
            last_login=user_data["last_login"],
        )

    async def update_user(self, user_id: str, **kwargs) -> Optional[UserInfo]:
        """Update a user."""
        self._initialize()

        user_data = self._users.get(user_id)
        if not user_data:
            return None

        for key, value in kwargs.items():
            if value is not None and key in user_data:
                user_data[key] = value

        return await self.get_user_by_id(user_id)

    async def delete_user(self, user_id: str) -> bool:
        """Delete a user."""
        self._initialize()

        if user_id in self._users:
            del self._users[user_id]
            return True
        return False

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
        log_entry = {
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "username": username,
            "action": action,
            "resource_type": resource_type,
            "resource_name": resource_name,
            "namespace": namespace,
            "details": details,
            "ip_address": ip_address,
            "timestamp": datetime.now(timezone.utc),
        }
        self._audit_logs.append(log_entry)

        # Keep only last 10000 logs in memory
        if len(self._audit_logs) > 10000:
            self._audit_logs = self._audit_logs[-10000:]

    async def get_audit_logs(
        self,
        user_id: Optional[str] = None,
        action: Optional[str] = None,
        resource_type: Optional[str] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> tuple[List[AuditLogEntry], int]:
        """Get audit logs with filtering."""
        logs = self._audit_logs.copy()

        # Apply filters
        if user_id:
            logs = [log for log in logs if log["user_id"] == user_id]
        if action:
            logs = [log for log in logs if log["action"] == action]
        if resource_type:
            logs = [log for log in logs if log["resource_type"] == resource_type]

        # Sort by timestamp descending
        logs.sort(key=lambda x: x["timestamp"], reverse=True)

        total = len(logs)
        logs = logs[offset : offset + limit]

        return [
            AuditLogEntry(
                id=log["id"],
                user_id=log["user_id"],
                username=log["username"],
                action=log["action"],
                resource_type=log["resource_type"],
                resource_name=log["resource_name"],
                namespace=log["namespace"],
                details=log["details"],
                ip_address=log["ip_address"],
                timestamp=log["timestamp"],
            )
            for log in logs
        ], total


# Singleton instance
auth_service = AuthService()
