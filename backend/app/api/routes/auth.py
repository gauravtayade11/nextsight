from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request

from app.core.security import get_current_user, require_role
from app.schemas.auth import AuditLogResponse, LoginRequest, TokenResponse, UserCreate, UserInfo, UserUpdate
from app.services.auth_service import auth_service

router = APIRouter()


@router.post("/login", response_model=TokenResponse)
async def login(request: LoginRequest, req: Request):
    """Authenticate user and return JWT token."""
    result = await auth_service.authenticate(request.username, request.password)
    if not result:
        raise HTTPException(status_code=401, detail="Invalid username or password")
    return result


@router.get("/me", response_model=UserInfo)
async def get_current_user_info(current_user: UserInfo = Depends(get_current_user)):
    """Get current authenticated user info."""
    return current_user


@router.get("/users", response_model=List[UserInfo])
async def list_users(current_user: UserInfo = Depends(require_role("admin"))):
    """List all users. Admin only."""
    return await auth_service.list_users()


@router.post("/users", response_model=UserInfo)
async def create_user(user_create: UserCreate, current_user: UserInfo = Depends(require_role("admin"))):
    """Create a new user. Admin only."""
    try:
        return await auth_service.create_user(user_create)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/users/{user_id}", response_model=UserInfo)
async def get_user(user_id: str, current_user: UserInfo = Depends(require_role("admin"))):
    """Get a specific user. Admin only."""
    user = await auth_service.get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.patch("/users/{user_id}", response_model=UserInfo)
async def update_user(user_id: str, user_update: UserUpdate, current_user: UserInfo = Depends(require_role("admin"))):
    """Update a user. Admin only."""
    update_data = user_update.model_dump(exclude_unset=True)
    user = await auth_service.update_user(user_id, **update_data)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.delete("/users/{user_id}")
async def delete_user(user_id: str, current_user: UserInfo = Depends(require_role("admin"))):
    """Delete a user. Admin only."""
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")

    success = await auth_service.delete_user(user_id)
    if not success:
        raise HTTPException(status_code=404, detail="User not found")

    return {"message": "User deleted successfully"}


@router.get("/audit", response_model=AuditLogResponse)
async def get_audit_logs(
    user_id: Optional[str] = Query(None),
    action: Optional[str] = Query(None),
    resource_type: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=500),
    page: int = Query(1, ge=1),
    current_user: UserInfo = Depends(require_role("admin")),
):
    """Get audit logs. Admin only."""
    offset = (page - 1) * limit
    logs, total = await auth_service.get_audit_logs(
        user_id=user_id, action=action, resource_type=resource_type, limit=limit, offset=offset
    )

    return AuditLogResponse(logs=logs, total=total, page=page, page_size=limit)
