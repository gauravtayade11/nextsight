from datetime import datetime
from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, Field


class IncidentSeverity(str, Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class IncidentStatus(str, Enum):
    OPEN = "open"
    INVESTIGATING = "investigating"
    IDENTIFIED = "identified"
    MONITORING = "monitoring"
    RESOLVED = "resolved"


class IncidentBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    severity: IncidentSeverity = IncidentSeverity.MEDIUM
    source: Optional[str] = None
    source_id: Optional[str] = None
    namespace: Optional[str] = None
    affected_services: List[str] = []
    tags: List[str] = []


class IncidentCreate(IncidentBase):
    pass


class IncidentUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    severity: Optional[IncidentSeverity] = None
    status: Optional[IncidentStatus] = None
    assigned_to: Optional[str] = None
    tags: Optional[List[str]] = None


class IncidentAnalysisRequest(BaseModel):
    incident_id: str
    include_k8s_context: bool = True
    include_jenkins_context: bool = True
    additional_context: Optional[str] = None


class IncidentAnalysisResponse(BaseModel):
    incident_id: str
    analysis: str
    root_cause_hypothesis: Optional[str] = None
    recommendations: List[str] = []
    related_events: List[dict] = []
    confidence_score: float = 0.0


class IncidentResponse(IncidentBase):
    id: str
    status: IncidentStatus
    ai_analysis: Optional[str] = None
    ai_recommendations: List[str] = []
    assigned_to: Optional[str] = None
    resolved_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
