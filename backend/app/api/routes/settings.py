"""Settings and Integrations API routes."""
import logging
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user, require_role
from app.models.user import UserRole
from app.services.settings_service import SettingsService
from app.schemas.settings import (
    # Integration schemas
    IntegrationCreate, IntegrationUpdate, IntegrationResponse,
    IntegrationConnectRequest, IntegrationStatusResponse,
    # Token schemas
    APITokenCreate, APITokenResponse, APITokenCreated,
    # User settings schemas
    UserSettingsUpdate, UserSettingsResponse,
    # User management schemas
    UserCreate, UserUpdate, UserResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter()


# ============ Dependencies ============

def get_settings_service(db: AsyncSession = Depends(get_db)) -> SettingsService:
    """Get settings service instance."""
    return SettingsService(db)


# ============ Integration Endpoints ============

@router.get("/integrations", response_model=List[IntegrationResponse])
async def list_integrations(
    service: SettingsService = Depends(get_settings_service),
    current_user = Depends(get_current_user),
):
    """List all configured integrations."""
    # Seed/update integrations (handles both new and existing)
    await service.seed_default_integrations()
    integrations = await service.list_integrations()

    return integrations


@router.get("/integrations/{integration_id}", response_model=IntegrationResponse)
async def get_integration(
    integration_id: str,
    service: SettingsService = Depends(get_settings_service),
    current_user = Depends(get_current_user),
):
    """Get a specific integration."""
    integration = await service.get_integration(integration_id)
    if not integration:
        raise HTTPException(status_code=404, detail="Integration not found")
    return integration


@router.post("/integrations", response_model=IntegrationResponse, status_code=status.HTTP_201_CREATED)
async def create_integration(
    data: IntegrationCreate,
    service: SettingsService = Depends(get_settings_service),
    current_user = Depends(require_role([UserRole.ADMIN])),
):
    """Create a new integration (admin only)."""
    # Check if integration with same name exists
    existing = await service.get_integration_by_name(data.name)
    if existing:
        raise HTTPException(status_code=400, detail="Integration with this name already exists")

    integration = await service.create_integration(data)
    return integration


@router.put("/integrations/{integration_id}", response_model=IntegrationResponse)
async def update_integration(
    integration_id: str,
    data: IntegrationUpdate,
    service: SettingsService = Depends(get_settings_service),
    current_user = Depends(require_role([UserRole.ADMIN])),
):
    """Update an integration (admin only)."""
    integration = await service.update_integration(integration_id, data)
    if not integration:
        raise HTTPException(status_code=404, detail="Integration not found")
    return integration


@router.delete("/integrations/{integration_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_integration(
    integration_id: str,
    service: SettingsService = Depends(get_settings_service),
    current_user = Depends(require_role([UserRole.ADMIN])),
):
    """Delete an integration (admin only)."""
    deleted = await service.delete_integration(integration_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Integration not found")


@router.post("/integrations/{integration_id}/connect", response_model=IntegrationResponse)
async def connect_integration(
    integration_id: str,
    data: IntegrationConnectRequest,
    service: SettingsService = Depends(get_settings_service),
    current_user = Depends(require_role([UserRole.ADMIN, UserRole.OPERATOR])),
):
    """Connect/configure an integration."""
    integration = await service.connect_integration(integration_id, data)
    if not integration:
        raise HTTPException(status_code=404, detail="Integration not found")
    return integration


@router.post("/integrations/{integration_id}/disconnect", response_model=IntegrationResponse)
async def disconnect_integration(
    integration_id: str,
    service: SettingsService = Depends(get_settings_service),
    current_user = Depends(require_role([UserRole.ADMIN, UserRole.OPERATOR])),
):
    """Disconnect an integration."""
    integration = await service.disconnect_integration(integration_id)
    if not integration:
        raise HTTPException(status_code=404, detail="Integration not found")
    return integration


@router.get("/integrations/{integration_id}/status", response_model=IntegrationStatusResponse)
async def check_integration_status(
    integration_id: str,
    service: SettingsService = Depends(get_settings_service),
    current_user = Depends(get_current_user),
):
    """Check real-time status of an integration."""
    status_response = await service.check_integration_status(integration_id)
    if not status_response:
        raise HTTPException(status_code=404, detail="Integration not found")
    return status_response


@router.get("/integrations/status/all", response_model=List[IntegrationStatusResponse])
async def check_all_integrations_status(
    service: SettingsService = Depends(get_settings_service),
    current_user = Depends(get_current_user),
):
    """Check status of all connected integrations."""
    integrations = await service.list_integrations()
    results = []

    for integration in integrations:
        if integration.status.value != "disconnected":
            status_response = await service.check_integration_status(integration.id)
            if status_response:
                results.append(status_response)

    return results


# ============ API Token Endpoints ============

@router.get("/tokens", response_model=List[APITokenResponse])
async def list_tokens(
    service: SettingsService = Depends(get_settings_service),
    current_user = Depends(get_current_user),
):
    """List all API tokens for the current user."""
    tokens = await service.list_tokens(current_user.id)
    return [
        APITokenResponse(
            id=t.id,
            name=t.name,
            prefix=t.prefix,
            scopes=t.scopes or [],
            created_at=t.created_at,
            expires_at=t.expires_at,
            last_used=t.last_used,
            status=t.status,
        )
        for t in tokens
    ]


@router.post("/tokens", response_model=APITokenCreated, status_code=status.HTTP_201_CREATED)
async def create_token(
    data: APITokenCreate,
    service: SettingsService = Depends(get_settings_service),
    current_user = Depends(get_current_user),
):
    """Create a new API token."""
    token, raw_token = await service.create_token(current_user.id, data)
    return APITokenCreated(
        id=token.id,
        name=token.name,
        prefix=token.prefix,
        scopes=token.scopes or [],
        created_at=token.created_at,
        expires_at=token.expires_at,
        last_used=token.last_used,
        status=token.status,
        token=raw_token,  # Only returned once
    )


@router.post("/tokens/{token_id}/revoke", response_model=dict)
async def revoke_token(
    token_id: str,
    service: SettingsService = Depends(get_settings_service),
    current_user = Depends(get_current_user),
):
    """Revoke an API token."""
    revoked = await service.revoke_token(token_id, current_user.id)
    if not revoked:
        raise HTTPException(status_code=404, detail="Token not found")
    return {"message": "Token revoked successfully"}


@router.delete("/tokens/{token_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_token(
    token_id: str,
    service: SettingsService = Depends(get_settings_service),
    current_user = Depends(get_current_user),
):
    """Delete an API token."""
    deleted = await service.delete_token(token_id, current_user.id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Token not found")


# ============ User Settings Endpoints ============

@router.get("/settings", response_model=UserSettingsResponse)
async def get_user_settings(
    service: SettingsService = Depends(get_settings_service),
    current_user = Depends(get_current_user),
):
    """Get current user's settings."""
    settings = await service.get_user_settings(current_user.id)
    return settings


@router.put("/settings", response_model=UserSettingsResponse)
async def update_user_settings(
    data: UserSettingsUpdate,
    service: SettingsService = Depends(get_settings_service),
    current_user = Depends(get_current_user),
):
    """Update current user's settings."""
    settings = await service.update_user_settings(current_user.id, data)
    return settings


@router.post("/settings/reset", response_model=UserSettingsResponse)
async def reset_user_settings(
    service: SettingsService = Depends(get_settings_service),
    current_user = Depends(get_current_user),
):
    """Reset user settings to defaults."""
    # Delete current settings
    from sqlalchemy import delete
    from app.models.settings import UserSettings
    await service.db.execute(
        delete(UserSettings).where(UserSettings.user_id == current_user.id)
    )
    # Create new defaults
    settings = await service.get_user_settings(current_user.id)
    return settings


# ============ User Management Endpoints (Admin) ============

@router.get("/users", response_model=List[UserResponse])
async def list_users(
    service: SettingsService = Depends(get_settings_service),
    current_user = Depends(require_role([UserRole.ADMIN])),
):
    """List all users (admin only)."""
    users = await service.list_users()
    return [
        UserResponse(
            id=u.id,
            username=u.username,
            email=u.email,
            full_name=u.full_name,
            role=u.role.value,
            is_active=u.is_active,
            auth_provider=u.auth_provider.value,
            avatar_url=u.avatar_url,
            last_login=u.last_login,
            created_at=u.created_at,
        )
        for u in users
    ]


@router.get("/users/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: str,
    service: SettingsService = Depends(get_settings_service),
    current_user = Depends(require_role([UserRole.ADMIN])),
):
    """Get a specific user (admin only)."""
    user = await service.get_user(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return UserResponse(
        id=user.id,
        username=user.username,
        email=user.email,
        full_name=user.full_name,
        role=user.role.value,
        is_active=user.is_active,
        auth_provider=user.auth_provider.value,
        avatar_url=user.avatar_url,
        last_login=user.last_login,
        created_at=user.created_at,
    )


@router.post("/users", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    data: UserCreate,
    service: SettingsService = Depends(get_settings_service),
    current_user = Depends(require_role([UserRole.ADMIN])),
):
    """Create a new user (admin only)."""
    try:
        user = await service.create_user(data)
        return UserResponse(
            id=user.id,
            username=user.username,
            email=user.email,
            full_name=user.full_name,
            role=user.role.value,
            is_active=user.is_active,
            auth_provider=user.auth_provider.value,
            avatar_url=user.avatar_url,
            last_login=user.last_login,
            created_at=user.created_at,
        )
    except Exception as e:
        if "unique" in str(e).lower():
            raise HTTPException(status_code=400, detail="Username or email already exists")
        raise


@router.put("/users/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: str,
    data: UserUpdate,
    service: SettingsService = Depends(get_settings_service),
    current_user = Depends(require_role([UserRole.ADMIN])),
):
    """Update a user (admin only)."""
    user = await service.update_user(user_id, data)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return UserResponse(
        id=user.id,
        username=user.username,
        email=user.email,
        full_name=user.full_name,
        role=user.role.value,
        is_active=user.is_active,
        auth_provider=user.auth_provider.value,
        avatar_url=user.avatar_url,
        last_login=user.last_login,
        created_at=user.created_at,
    )


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: str,
    service: SettingsService = Depends(get_settings_service),
    current_user = Depends(require_role([UserRole.ADMIN])),
):
    """Delete a user (admin only)."""
    # Prevent self-deletion
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")

    deleted = await service.delete_user(user_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="User not found")


@router.post("/users/{user_id}/toggle-status", response_model=UserResponse)
async def toggle_user_status(
    user_id: str,
    service: SettingsService = Depends(get_settings_service),
    current_user = Depends(require_role([UserRole.ADMIN])),
):
    """Toggle user active status (admin only)."""
    # Prevent self-deactivation
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot deactivate your own account")

    user = await service.toggle_user_status(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return UserResponse(
        id=user.id,
        username=user.username,
        email=user.email,
        full_name=user.full_name,
        role=user.role.value,
        is_active=user.is_active,
        auth_provider=user.auth_provider.value,
        avatar_url=user.avatar_url,
        last_login=user.last_login,
        created_at=user.created_at,
    )
