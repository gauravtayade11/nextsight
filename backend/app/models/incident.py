import enum

from sqlalchemy import JSON, Column, DateTime, Enum, String, Text
from sqlalchemy.sql import func

from app.models.base import Base, TimestampMixin, generate_uuid


class IncidentSeverity(str, enum.Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class IncidentStatus(str, enum.Enum):
    OPEN = "open"
    INVESTIGATING = "investigating"
    IDENTIFIED = "identified"
    MONITORING = "monitoring"
    RESOLVED = "resolved"


class Incident(Base, TimestampMixin):
    __tablename__ = "incidents"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    severity = Column(Enum(IncidentSeverity), default=IncidentSeverity.MEDIUM)
    status = Column(Enum(IncidentStatus), default=IncidentStatus.OPEN)
    source = Column(String(50), nullable=True)  # kubernetes, jenkins, manual, etc.
    source_id = Column(String(255), nullable=True)  # Reference ID in source system
    namespace = Column(String(255), nullable=True)
    affected_services = Column(JSON, default=list)
    ai_analysis = Column(Text, nullable=True)
    ai_recommendations = Column(JSON, default=list)
    resolved_at = Column(DateTime(timezone=True), nullable=True)
    assigned_to = Column(String(255), nullable=True)
    tags = Column(JSON, default=list)
