from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class ActionType(str, Enum):
    DEPLOY = "deploy"
    ROLLBACK = "rollback"
    SCALE = "scale"
    RESTART = "restart"
    BUILD = "build"
    CONFIG_UPDATE = "config_update"


class ActionStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


class SelfServiceActionRequest(BaseModel):
    action_type: ActionType
    target_service: str
    target_namespace: str
    target_environment: str
    parameters: Dict[str, Any] = {}
    reason: str = Field(..., min_length=10, max_length=500)
    requires_approval: bool = False


class SelfServiceAction(BaseModel):
    id: str
    action_type: ActionType
    target_service: str
    target_namespace: str
    target_environment: str
    parameters: Dict[str, Any] = {}
    reason: str
    status: ActionStatus
    requested_by: str
    approved_by: Optional[str] = None
    executed_at: Optional[datetime] = None
    result: Optional[Dict[str, Any]] = None
    error_message: Optional[str] = None
    created_at: datetime


class ServiceCatalogItem(BaseModel):
    name: str
    namespace: str
    environment: str
    description: Optional[str] = None
    owner_team: Optional[str] = None
    repository_url: Optional[str] = None
    documentation_url: Optional[str] = None
    current_version: Optional[str] = None
    allowed_actions: List[ActionType] = []
    health_status: str = "unknown"
    last_deployed: Optional[datetime] = None


class EnvironmentInfo(BaseModel):
    name: str
    cluster: str
    description: Optional[str] = None
    is_production: bool = False
    services_count: int = 0
    health_status: str = "unknown"


class QuickAction(BaseModel):
    id: str
    name: str
    description: str
    action_type: ActionType
    icon: str
    requires_confirmation: bool = True
    parameters_schema: Dict[str, Any] = {}
