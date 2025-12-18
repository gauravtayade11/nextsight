import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional, Set

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import settings

logger = logging.getLogger(__name__)

# Password hashing - using pbkdf2_sha256 for better compatibility
pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")

# JWT settings
ALGORITHM = "HS256"
REFRESH_TOKEN_EXPIRE_DAYS = 7

# Bearer token scheme
security = HTTPBearer()
security_optional = HTTPBearer(auto_error=False)

# Token blacklist - uses Redis when available, falls back to in-memory
_token_blacklist_memory: Set[str] = set()
_blacklist_cleanup_time: Optional[datetime] = None
_redis_client = None


def _get_redis_client():
    """Get or create Redis client for token blacklist."""
    global _redis_client
    if _redis_client is None and settings.REDIS_ENABLED:
        try:
            import redis
            _redis_client = redis.from_url(settings.REDIS_URL, decode_responses=True)
            # Test connection
            _redis_client.ping()
            logger.info("Token blacklist using Redis")
        except Exception as e:
            logger.warning(f"Redis unavailable for token blacklist, using in-memory: {e}")
            _redis_client = False  # Mark as unavailable
    return _redis_client if _redis_client else None


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash."""
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """Hash a password."""
    return pwd_context.hash(password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create a JWT access token."""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)

    to_encode.update({
        "exp": expire,
        "type": "access",
        "jti": str(uuid.uuid4()),  # Unique token ID
    })
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def create_refresh_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create a JWT refresh token."""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)

    to_encode.update({
        "exp": expire,
        "type": "refresh",
        "jti": str(uuid.uuid4()),  # Unique token ID
    })
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def decode_access_token(token: str) -> Optional[dict]:
    """Decode and validate a JWT access token."""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[ALGORITHM])
        # Check if token is blacklisted
        jti = payload.get("jti")
        if jti and is_token_blacklisted(jti):
            logger.warning("Attempted use of blacklisted token")
            return None
        return payload
    except JWTError as e:
        logger.warning(f"JWT decode error: {e}")
        return None


def decode_refresh_token(token: str) -> Optional[dict]:
    """Decode and validate a JWT refresh token."""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[ALGORITHM])
        # Verify it's a refresh token
        if payload.get("type") != "refresh":
            logger.warning("Invalid token type for refresh")
            return None
        # Check if token is blacklisted
        jti = payload.get("jti")
        if jti and is_token_blacklisted(jti):
            logger.warning("Attempted use of blacklisted refresh token")
            return None
        return payload
    except JWTError as e:
        logger.warning(f"Refresh token decode error: {e}")
        return None


def blacklist_token(jti: str, ttl_seconds: int = None) -> None:
    """Add a token to the blacklist (uses Redis when available)."""
    global _blacklist_cleanup_time

    # Default TTL is refresh token expiry (7 days)
    if ttl_seconds is None:
        ttl_seconds = REFRESH_TOKEN_EXPIRE_DAYS * 24 * 3600

    redis_client = _get_redis_client()
    if redis_client:
        try:
            # Use Redis with TTL for automatic expiration
            redis_key = f"token_blacklist:{jti}"
            redis_client.setex(redis_key, ttl_seconds, "1")
            return
        except Exception as e:
            logger.warning(f"Redis blacklist failed, using in-memory: {e}")

    # Fallback to in-memory
    _token_blacklist_memory.add(jti)

    # Periodic cleanup of old entries
    now = datetime.now(timezone.utc)
    if _blacklist_cleanup_time is None or (now - _blacklist_cleanup_time).total_seconds() > 3600:
        _cleanup_blacklist()
        _blacklist_cleanup_time = now


def is_token_blacklisted(jti: str) -> bool:
    """Check if a token is blacklisted (uses Redis when available)."""
    redis_client = _get_redis_client()
    if redis_client:
        try:
            redis_key = f"token_blacklist:{jti}"
            return redis_client.exists(redis_key) > 0
        except Exception as e:
            logger.warning(f"Redis blacklist check failed, using in-memory: {e}")

    # Fallback to in-memory
    return jti in _token_blacklist_memory


def _cleanup_blacklist() -> None:
    """Clean up expired tokens from in-memory blacklist (Redis handles this automatically)."""
    global _token_blacklist_memory
    # Only applies to in-memory fallback
    if len(_token_blacklist_memory) > 10000:
        # Keep only the most recent 5000 entries (simple approach)
        _token_blacklist_memory = set(list(_token_blacklist_memory)[-5000:])
        logger.info("Cleaned up in-memory token blacklist")


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_optional),
):
    """Dependency to get the current authenticated user from the JWT token."""
    from app.core.config import settings

    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    # Get token from header
    if not credentials:
        raise credentials_exception
    
    auth_token = credentials.credentials

    payload = decode_access_token(auth_token)

    if payload is None:
        raise credentials_exception

    # Verify it's an access token (not refresh token)
    if payload.get("type") != "access":
        raise credentials_exception

    user_id: str = payload.get("sub")
    if user_id is None:
        raise credentials_exception

    # Use the appropriate auth service based on configuration
    if settings.USE_DATABASE_AUTH:
        from app.core.database import async_session_maker
        from app.services.auth_service_db import DatabaseAuthService
        async with async_session_maker() as session:
            db_auth_service = DatabaseAuthService(session)
            user = await db_auth_service.get_user_by_id(user_id)
    else:
        from app.services.auth_service import auth_service
        user = await auth_service.get_user_by_id(user_id)

    if user is None:
        raise credentials_exception

    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User account is disabled")

    return user


async def get_current_active_user(current_user=Depends(get_current_user)):
    """Dependency to ensure the current user is active."""
    if not current_user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    return current_user


def require_permission(permission: str):
    """Dependency factory to require a specific permission.

    Checks permissions in this order:
    1. If user has custom_permissions enabled, check against custom_permissions list
    2. Otherwise, check against role-based permissions
    """

    async def permission_checker(current_user=Depends(get_current_user)):
        from app.schemas.auth import has_permission, DEFAULT_ROLE_PERMISSIONS_UI, UserRole

        # Admin always has all permissions
        if current_user.role == UserRole.ADMIN or current_user.role.value == "admin":
            return current_user

        # Check if user has custom permissions enabled
        if current_user.use_custom_permissions and current_user.custom_permissions is not None:
            # Check against custom permissions
            if "*" in current_user.custom_permissions:
                return current_user
            if permission in current_user.custom_permissions:
                return current_user
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permission denied: {permission}"
            )

        # Fall back to role-based permissions
        role = UserRole(current_user.role.value) if hasattr(current_user.role, 'value') else UserRole(current_user.role)
        role_perms = DEFAULT_ROLE_PERMISSIONS_UI.get(role, [])

        if "*" in role_perms or permission in role_perms:
            return current_user

        # Also check legacy permission system
        if has_permission(current_user.role, permission):
            return current_user

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Permission denied: {permission}"
        )

    return permission_checker


def require_role(roles):
    """Dependency factory to require one of the specified roles.

    Args:
        roles: A single role (str or UserRole enum) or a list of roles.
               User must have at least one of the specified roles.
    """
    from app.schemas.auth import UserRole

    role_hierarchy = {
        UserRole.VIEWER: 1,
        UserRole.OPERATOR: 2,
        UserRole.DEVELOPER: 3,
        UserRole.ADMIN: 4,
    }

    # Normalize roles to a list
    if not isinstance(roles, (list, tuple)):
        roles = [roles]

    # Convert string roles to UserRole enums
    normalized_roles = []
    for r in roles:
        if isinstance(r, str):
            normalized_roles.append(UserRole(r))
        elif isinstance(r, UserRole):
            normalized_roles.append(r)
        else:
            # Handle UserRole from different module (app.models.user.UserRole)
            normalized_roles.append(UserRole(r.value))

    async def role_checker(current_user=Depends(get_current_user)):
        user_role = current_user.role

        # Normalize user role if from different enum
        if not isinstance(user_role, UserRole):
            try:
                user_role = UserRole(user_role.value if hasattr(user_role, 'value') else user_role)
            except ValueError:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Invalid user role: {user_role}"
                )

        user_level = role_hierarchy.get(user_role, 0)

        # Find the minimum required level among allowed roles
        required_level = min(role_hierarchy.get(r, 0) for r in normalized_roles)

        if user_level < required_level:
            role_names = [r.value for r in normalized_roles]
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Insufficient role: requires one of {role_names}"
            )
        return current_user

    return role_checker
