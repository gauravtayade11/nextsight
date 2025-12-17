"""Authentication routes with support for both in-memory and database backends."""
import logging
from typing import List, Optional, Union

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import decode_access_token, get_current_user, require_role, security
from app.schemas.auth import (
    AuditLogResponse,
    LoginRequest,
    LogoutRequest,
    PasswordChange,
    PasswordReset,
    RefreshTokenRequest,
    RefreshTokenResponse,
    TokenResponse,
    UserCreate,
    UserInfo,
    UserUpdate,
)

# Import both auth services
from app.services.auth_service import AuthService, auth_service as memory_auth_service

logger = logging.getLogger(__name__)
router = APIRouter()


# Database session dependency (only when using database auth)
async def get_db_optional() -> Optional[AsyncSession]:
    """Get database session if database auth is enabled."""
    if settings.USE_DATABASE_AUTH:
        from app.core.database import async_session_maker
        async with async_session_maker() as session:
            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise
    else:
        yield None


async def get_auth_service(db: Optional[AsyncSession] = Depends(get_db_optional)):
    """Get the appropriate auth service based on configuration."""
    if settings.USE_DATABASE_AUTH and db:
        from app.services.auth_service_db import DatabaseAuthService
        return DatabaseAuthService(db)
    return memory_auth_service


@router.post("/login", response_model=TokenResponse)
async def login(
    request: LoginRequest,
    req: Request,
    auth_svc = Depends(get_auth_service),
):
    """Authenticate user and return JWT access and refresh tokens."""
    result = await auth_svc.authenticate(request.username, request.password)
    if not result:
        raise HTTPException(status_code=401, detail="Invalid username or password")
    return result


@router.post("/logout")
async def logout(
    request: LogoutRequest,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    current_user: UserInfo = Depends(get_current_user),
    auth_svc = Depends(get_auth_service),
):
    """Logout user and invalidate tokens."""
    # Get the current access token's JTI
    token = credentials.credentials
    payload = decode_access_token(token)
    access_token_jti = payload.get("jti") if payload else None

    await auth_svc.logout(
        user_id=current_user.id,
        username=current_user.username,
        access_token_jti=access_token_jti,
        refresh_token=request.refresh_token,
    )
    return {"message": "Successfully logged out"}


@router.post("/refresh", response_model=RefreshTokenResponse)
async def refresh_token(
    request: RefreshTokenRequest,
    auth_svc = Depends(get_auth_service),
):
    """Refresh access token using a valid refresh token."""
    result = await auth_svc.refresh_access_token(request.refresh_token)
    if not result:
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token")
    return result


@router.get("/me", response_model=UserInfo)
async def get_current_user_info(current_user: UserInfo = Depends(get_current_user)):
    """Get current authenticated user info."""
    return current_user


@router.post("/me/password")
async def change_password(
    request: PasswordChange,
    current_user: UserInfo = Depends(get_current_user),
    auth_svc = Depends(get_auth_service),
):
    """Change the current user's password."""
    success, message = await auth_svc.change_password(
        user_id=current_user.id,
        current_password=request.current_password,
        new_password=request.new_password,
    )
    if not success:
        raise HTTPException(status_code=400, detail=message)
    return {"message": message}


@router.get("/users", response_model=List[UserInfo])
async def list_users(
    current_user: UserInfo = Depends(require_role("admin")),
    auth_svc = Depends(get_auth_service),
):
    """List all users. Admin only."""
    return await auth_svc.list_users()


@router.post("/users", response_model=UserInfo)
async def create_user(
    user_create: UserCreate,
    current_user: UserInfo = Depends(require_role("admin")),
    auth_svc = Depends(get_auth_service),
):
    """Create a new user. Admin only."""
    try:
        return await auth_svc.create_user(user_create)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/users/{user_id}", response_model=UserInfo)
async def get_user(
    user_id: str,
    current_user: UserInfo = Depends(require_role("admin")),
    auth_svc = Depends(get_auth_service),
):
    """Get a specific user. Admin only."""
    user = await auth_svc.get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.patch("/users/{user_id}", response_model=UserInfo)
async def update_user(
    user_id: str,
    user_update: UserUpdate,
    current_user: UserInfo = Depends(require_role("admin")),
    auth_svc = Depends(get_auth_service),
):
    """Update a user. Admin only."""
    update_data = user_update.model_dump(exclude_unset=True)
    user = await auth_svc.update_user(user_id, **update_data)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.delete("/users/{user_id}")
async def delete_user(
    user_id: str,
    current_user: UserInfo = Depends(require_role("admin")),
    auth_svc = Depends(get_auth_service),
):
    """Delete a user. Admin only."""
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")

    success = await auth_svc.delete_user(user_id)
    if not success:
        raise HTTPException(status_code=404, detail="User not found")

    return {"message": "User deleted successfully"}


@router.post("/users/{user_id}/reset-password")
async def reset_user_password(
    user_id: str,
    request: PasswordReset,
    current_user: UserInfo = Depends(require_role("admin")),
    auth_svc = Depends(get_auth_service),
):
    """Reset a user's password. Admin only."""
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot reset your own password. Use change password instead.")

    success, message = await auth_svc.reset_password(
        user_id=user_id,
        new_password=request.new_password,
        admin_id=current_user.id,
    )
    if not success:
        raise HTTPException(status_code=400, detail=message)
    return {"message": message}


@router.get("/audit", response_model=AuditLogResponse)
async def get_audit_logs(
    user_id: Optional[str] = Query(None),
    action: Optional[str] = Query(None),
    resource_type: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=500),
    page: int = Query(1, ge=1),
    current_user: UserInfo = Depends(require_role("admin")),
    auth_svc = Depends(get_auth_service),
):
    """Get audit logs. Admin only."""
    offset = (page - 1) * limit
    logs, total = await auth_svc.get_audit_logs(
        user_id=user_id, action=action, resource_type=resource_type, limit=limit, offset=offset
    )

    return AuditLogResponse(logs=logs, total=total, page=page, page_size=limit)


# ==================== OAuth Routes ====================

@router.get("/oauth/providers")
async def get_oauth_providers():
    """Get list of enabled OAuth providers."""
    if not settings.OAUTH_ENABLED:
        return {"enabled": False, "providers": []}

    from app.services.oauth_service import oauth_service
    providers = oauth_service.get_enabled_providers()
    return {"enabled": True, "providers": providers}


@router.get("/oauth/{provider}/authorize")
async def oauth_authorize(
    provider: str,
    redirect_uri: Optional[str] = Query(None),
):
    """Get OAuth authorization URL for a provider."""
    if not settings.OAUTH_ENABLED:
        raise HTTPException(status_code=400, detail="OAuth is not enabled")

    from app.services.oauth_service import oauth_service

    # Use default redirect URI if not provided
    final_redirect_uri = redirect_uri or f"{settings.OAUTH_REDIRECT_BASE}/auth/callback/{provider}"

    auth_url = oauth_service.get_authorization_url(provider, final_redirect_uri)
    if not auth_url:
        raise HTTPException(status_code=400, detail=f"OAuth provider '{provider}' is not enabled or configured")

    return {"authorization_url": auth_url, "provider": provider}


@router.post("/oauth/{provider}/callback", response_model=TokenResponse)
async def oauth_callback(
    provider: str,
    code: str = Query(...),
    state: str = Query(...),
    redirect_uri: Optional[str] = Query(None),
):
    """Handle OAuth callback and exchange code for tokens."""
    if not settings.OAUTH_ENABLED:
        raise HTTPException(status_code=400, detail="OAuth is not enabled")

    from app.services.oauth_service import oauth_service

    # Use default redirect URI if not provided
    final_redirect_uri = redirect_uri or f"{settings.OAUTH_REDIRECT_BASE}/auth/callback/{provider}"

    result = await oauth_service.authenticate_oauth(
        provider_name=provider,
        code=code,
        redirect_uri=final_redirect_uri,
        state=state,
    )

    if not result:
        raise HTTPException(status_code=401, detail="OAuth authentication failed")

    return result


@router.get("/oauth/{provider}/callback", response_model=TokenResponse)
async def oauth_callback_get(
    provider: str,
    code: str = Query(...),
    state: str = Query(...),
    redirect_uri: Optional[str] = Query(None),
):
    """Handle OAuth callback via GET (browser redirect)."""
    return await oauth_callback(provider, code, state, redirect_uri)


# ==================== Permission Management Routes ====================

from app.schemas.auth import (
    AvailablePermissionsResponse,
    PermissionCategoryInfo,
    PermissionInfo,
    PermissionCategory,
    UserPermissionsResponse,
    SetUserPermissionsRequest,
    SetUserPermissionsResponse,
    DEFAULT_ROLE_PERMISSIONS_UI,
)


# All available permissions in the system
AVAILABLE_PERMISSIONS_DATA = {
    PermissionCategory.KUBERNETES: [
        {"key": "k8s.view", "label": "View Resources"},
        {"key": "k8s.create", "label": "Create Resources"},
        {"key": "k8s.edit", "label": "Edit Resources"},
        {"key": "k8s.delete", "label": "Delete Resources"},
        {"key": "k8s.exec", "label": "Execute Commands"},
        {"key": "k8s.logs", "label": "View Logs"},
    ],
    PermissionCategory.GITOPS: [
        {"key": "argocd.view", "label": "View Apps"},
        {"key": "argocd.sync", "label": "Sync Apps"},
        {"key": "argocd.create", "label": "Create Apps"},
        {"key": "argocd.delete", "label": "Delete Apps"},
        {"key": "argocd.rollback", "label": "Rollback"},
    ],
    PermissionCategory.HELM: [
        {"key": "helm.view", "label": "View Releases"},
        {"key": "helm.install", "label": "Install"},
        {"key": "helm.upgrade", "label": "Upgrade"},
        {"key": "helm.uninstall", "label": "Uninstall"},
    ],
    PermissionCategory.SECURITY: [
        {"key": "security.view", "label": "View Scans"},
        {"key": "security.scan", "label": "Run Scans"},
        {"key": "security.config", "label": "Configure"},
    ],
    PermissionCategory.ADMIN: [
        {"key": "admin.users", "label": "User Management"},
        {"key": "admin.roles", "label": "Role Management"},
        {"key": "admin.clusters", "label": "Cluster Management"},
        {"key": "admin.audit", "label": "Audit Logs"},
    ],
}


@router.get("/permissions/available", response_model=AvailablePermissionsResponse)
async def get_available_permissions(
    current_user: UserInfo = Depends(require_role("admin")),
):
    """Get all available permissions in the system. Admin only."""
    categories = []
    category_names = {
        PermissionCategory.KUBERNETES: "Kubernetes",
        PermissionCategory.GITOPS: "GitOps",
        PermissionCategory.HELM: "Helm",
        PermissionCategory.SECURITY: "Security",
        PermissionCategory.ADMIN: "Admin",
    }

    for category, perms in AVAILABLE_PERMISSIONS_DATA.items():
        permissions = [
            PermissionInfo(key=p["key"], label=p["label"], category=category)
            for p in perms
        ]
        categories.append(PermissionCategoryInfo(
            name=category_names[category],
            category=category,
            permissions=permissions
        ))

    return AvailablePermissionsResponse(categories=categories)


@router.get("/users/{user_id}/permissions", response_model=UserPermissionsResponse)
async def get_user_permissions(
    user_id: str,
    current_user: UserInfo = Depends(require_role("admin")),
    db: Optional[AsyncSession] = Depends(get_db_optional),
):
    """Get a user's permissions. Admin only."""
    if not settings.USE_DATABASE_AUTH or not db:
        raise HTTPException(status_code=400, detail="Database auth required for permission management")

    from sqlalchemy import select
    from app.models.user import User, UserPermission

    # Get user
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Get custom permissions if enabled
    permissions = []
    if user.use_custom_permissions:
        perm_result = await db.execute(
            select(UserPermission).where(UserPermission.user_id == user_id)
        )
        user_perms = perm_result.scalars().all()
        permissions = [p.permission for p in user_perms]
    else:
        # Return role default permissions
        from app.schemas.auth import UserRole as SchemaUserRole
        role = SchemaUserRole(user.role.value)
        permissions = DEFAULT_ROLE_PERMISSIONS_UI.get(role, [])

    # Get role default for comparison
    from app.schemas.auth import UserRole as SchemaUserRole
    role = SchemaUserRole(user.role.value)
    role_defaults = DEFAULT_ROLE_PERMISSIONS_UI.get(role, [])

    return UserPermissionsResponse(
        user_id=user.id,
        username=user.username,
        role=role,
        use_custom_permissions=user.use_custom_permissions,
        permissions=permissions,
        role_default_permissions=role_defaults
    )


@router.put("/users/{user_id}/permissions", response_model=SetUserPermissionsResponse)
async def set_user_permissions(
    user_id: str,
    request: SetUserPermissionsRequest,
    current_user: UserInfo = Depends(require_role("admin")),
    db: Optional[AsyncSession] = Depends(get_db_optional),
):
    """Set a user's custom permissions. Admin only."""
    if not settings.USE_DATABASE_AUTH or not db:
        raise HTTPException(status_code=400, detail="Database auth required for permission management")

    from sqlalchemy import select, delete
    from app.models.user import User, UserPermission, PermissionCategory as DBPermCategory

    # Get user
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Prevent modifying your own permissions
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot modify your own permissions")

    # Update user's custom permissions flag
    user.use_custom_permissions = request.use_custom_permissions

    # Clear existing custom permissions
    await db.execute(
        delete(UserPermission).where(UserPermission.user_id == user_id)
    )

    if request.use_custom_permissions and request.permissions:
        # Validate and add new permissions
        valid_permissions = set()
        for category, perms in AVAILABLE_PERMISSIONS_DATA.items():
            for p in perms:
                valid_permissions.add(p["key"])

        # Map permission key to category
        perm_to_category = {}
        for category, perms in AVAILABLE_PERMISSIONS_DATA.items():
            for p in perms:
                perm_to_category[p["key"]] = category

        for perm_key in request.permissions:
            if perm_key not in valid_permissions:
                continue  # Skip invalid permissions

            category = perm_to_category.get(perm_key)
            if category:
                # Convert to DB enum
                db_category = DBPermCategory(category.value)
                new_perm = UserPermission(
                    user_id=user_id,
                    permission=perm_key,
                    category=db_category,
                    granted_by=current_user.id
                )
                db.add(new_perm)

    await db.commit()

    # Log the action
    from app.services.auth_service_db import DatabaseAuthService
    auth_svc = DatabaseAuthService(db)
    await auth_svc.log_action(
        user_id=current_user.id,
        username=current_user.username,
        action="permissions_updated",
        resource_type="user",
        resource_name=user.username,
        details=f"Custom permissions {'enabled' if request.use_custom_permissions else 'disabled'}. Permissions: {request.permissions if request.use_custom_permissions else 'role defaults'}"
    )

    return SetUserPermissionsResponse(
        user_id=user_id,
        use_custom_permissions=request.use_custom_permissions,
        permissions=request.permissions if request.use_custom_permissions else [],
        message=f"Permissions updated for {user.username}"
    )


@router.get("/roles/permissions")
async def get_role_default_permissions(
    current_user: UserInfo = Depends(get_current_user),
):
    """Get default permissions for each role."""
    return {
        "admin": DEFAULT_ROLE_PERMISSIONS_UI[UserRole.ADMIN] if hasattr(UserRole, 'ADMIN') else ["*"],
        "developer": DEFAULT_ROLE_PERMISSIONS_UI.get(UserRole.DEVELOPER, []),
        "operator": DEFAULT_ROLE_PERMISSIONS_UI.get(UserRole.OPERATOR, []),
        "viewer": DEFAULT_ROLE_PERMISSIONS_UI.get(UserRole.VIEWER, []),
    }


from app.schemas.auth import UserRole
