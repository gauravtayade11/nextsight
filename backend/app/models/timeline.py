import enum

from sqlalchemy import JSON, Column, DateTime, Enum, String, Text
from sqlalchemy.sql import func

from app.models.base import Base, TimestampMixin, generate_uuid


class ChangeType(str, enum.Enum):
    DEPLOYMENT = "deployment"
    CONFIG_CHANGE = "config_change"
    SCALE_EVENT = "scale_event"
    BUILD = "build"
    INCIDENT = "incident"
    ROLLBACK = "rollback"
    FEATURE_FLAG = "feature_flag"
    INFRASTRUCTURE = "infrastructure"


class ChangeSource(str, enum.Enum):
    KUBERNETES = "kubernetes"
    JENKINS = "jenkins"
    MANUAL = "manual"
    GITHUB = "github"
    TERRAFORM = "terraform"


class TimelineEvent(Base, TimestampMixin):
    __tablename__ = "timeline_events"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    event_type = Column(Enum(ChangeType), nullable=False)
    source = Column(Enum(ChangeSource), nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    source_id = Column(String(255), nullable=True)
    namespace = Column(String(255), nullable=True)
    service_name = Column(String(255), nullable=True)
    environment = Column(String(50), nullable=True)
    user = Column(String(255), nullable=True)
    event_metadata = Column(JSON, default=dict)
    event_timestamp = Column(DateTime(timezone=True), server_default=func.now())
    related_incident_id = Column(String(36), nullable=True)
