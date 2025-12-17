from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class ChangeType(str, Enum):
    DEPLOYMENT = "deployment"
    CONFIG_CHANGE = "config_change"
    SCALE_EVENT = "scale_event"
    BUILD = "build"
    INCIDENT = "incident"
    ROLLBACK = "rollback"
    FEATURE_FLAG = "feature_flag"
    INFRASTRUCTURE = "infrastructure"


class ChangeSource(str, Enum):
    KUBERNETES = "kubernetes"
    JENKINS = "jenkins"
    MANUAL = "manual"
    GITHUB = "github"
    TERRAFORM = "terraform"


class TimelineEventBase(BaseModel):
    event_type: ChangeType
    source: ChangeSource
    title: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    source_id: Optional[str] = None
    namespace: Optional[str] = None
    service_name: Optional[str] = None
    environment: Optional[str] = None
    user: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)
    event_timestamp: Optional[datetime] = None


class TimelineEventCreate(TimelineEventBase):
    pass


class TimelineEventResponse(TimelineEventBase):
    id: str
    related_incident_id: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        # Pydantic v2 uses `from_attributes`, v1 uses `orm_mode`. Enable both for compatibility.
        from_attributes = True
        orm_mode = True


class TimelineFilter(BaseModel):
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    event_types: Optional[List[ChangeType]] = None
    sources: Optional[List[ChangeSource]] = None
    namespaces: Optional[List[str]] = None
    services: Optional[List[str]] = None
    environments: Optional[List[str]] = None
    limit: int = Field(default=100, ge=1, le=1000)
    offset: int = Field(default=0, ge=0)


class TimelineCorrelation(BaseModel):
    incident_id: str
    events_before: List[TimelineEventResponse] = Field(default_factory=list)
    events_during: List[TimelineEventResponse] = Field(default_factory=list)
    potential_causes: List[Dict[str, Any]] = Field(default_factory=list)
