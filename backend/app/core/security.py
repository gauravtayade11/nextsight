import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import settings

logger = logging.getLogger(__name__)

# Password hashing - using pbkdf2_sha256 for better compatibility
pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")

# JWT settings
ALGORITHM = "HS256"

# Bearer token scheme
security = HTTPBearer()


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

    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def decode_access_token(token: str) -> Optional[dict]:
    """Decode and validate a JWT access token."""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError as e:
        logger.warning(f"JWT decode error: {e}")
        return None


async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Dependency to get the current authenticated user from the JWT token."""
    from app.services.auth_service import auth_service

    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    token = credentials.credentials
    payload = decode_access_token(token)

    if payload is None:
        raise credentials_exception

    user_id: str = payload.get("sub")
    if user_id is None:
        raise credentials_exception

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
    """Dependency factory to require a specific permission."""

    async def permission_checker(current_user=Depends(get_current_user)):
        from app.schemas.auth import has_permission

        if not has_permission(current_user.role, permission):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=f"Permission denied: {permission}")
        return current_user

    return permission_checker


def require_role(role: str):
    """Dependency factory to require a minimum role."""
    from app.schemas.auth import UserRole

    role_hierarchy = {
        UserRole.VIEWER: 1,
        UserRole.OPERATOR: 2,
        UserRole.DEVELOPER: 3,
        UserRole.ADMIN: 4,
    }

    async def role_checker(current_user=Depends(get_current_user)):
        required_level = role_hierarchy.get(UserRole(role), 0)
        user_level = role_hierarchy.get(current_user.role, 0)

        if user_level < required_level:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=f"Insufficient role: requires {role}")
        return current_user

    return role_checker
