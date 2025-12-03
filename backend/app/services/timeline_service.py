import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from app.schemas.timeline import (
    ChangeSource,
    ChangeType,
    TimelineCorrelation,
    TimelineEventCreate,
    TimelineEventResponse,
    TimelineFilter,
)

logger = logging.getLogger(__name__)


class TimelineService:
    def __init__(self):
        self._events: Dict[str, TimelineEventResponse] = {}

    async def create_event(self, event: TimelineEventCreate) -> TimelineEventResponse:
        event_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc)

        response = TimelineEventResponse(
            id=event_id,
            event_type=event.event_type,
            source=event.source,
            title=event.title,
            description=event.description,
            source_id=event.source_id,
            namespace=event.namespace,
            service_name=event.service_name,
            environment=event.environment,
            user=event.user,
            metadata=event.metadata,
            event_timestamp=event.event_timestamp or now,
            related_incident_id=None,
            created_at=now,
            updated_at=now,
        )

        self._events[event_id] = response
        return response

    async def get_events(self, filter_params: Optional[TimelineFilter] = None) -> List[TimelineEventResponse]:
        events = list(self._events.values())

        if filter_params:
            if filter_params.start_date:
                events = [e for e in events if e.event_timestamp >= filter_params.start_date]

            if filter_params.end_date:
                events = [e for e in events if e.event_timestamp <= filter_params.end_date]

            if filter_params.event_types:
                events = [e for e in events if e.event_type in filter_params.event_types]

            if filter_params.sources:
                events = [e for e in events if e.source in filter_params.sources]

            if filter_params.namespaces:
                events = [e for e in events if e.namespace in filter_params.namespaces]

            if filter_params.services:
                events = [e for e in events if e.service_name in filter_params.services]

            if filter_params.environments:
                events = [e for e in events if e.environment in filter_params.environments]

        events.sort(key=lambda x: x.event_timestamp, reverse=True)

        offset = filter_params.offset if filter_params else 0
        limit = filter_params.limit if filter_params else 100

        return events[offset : offset + limit]

    async def get_event(self, event_id: str) -> Optional[TimelineEventResponse]:
        return self._events.get(event_id)

    async def link_incident(self, event_id: str, incident_id: str) -> Optional[TimelineEventResponse]:
        if event_id not in self._events:
            return None

        event = self._events[event_id]
        event.related_incident_id = incident_id
        event.updated_at = datetime.now(timezone.utc)
        return event

    async def get_events_for_incident(
        self,
        incident_id: str,
        incident_timestamp: datetime,
        window_before_minutes: int = 60,
        window_after_minutes: int = 30,
    ) -> TimelineCorrelation:
        window_start = incident_timestamp - timedelta(minutes=window_before_minutes)
        window_end = incident_timestamp + timedelta(minutes=window_after_minutes)

        all_events = list(self._events.values())

        events_before = []
        events_during = []

        for event in all_events:
            if window_start <= event.event_timestamp < incident_timestamp:
                events_before.append(event)
            elif incident_timestamp <= event.event_timestamp <= window_end:
                events_during.append(event)

        events_before.sort(key=lambda x: x.event_timestamp, reverse=True)
        events_during.sort(key=lambda x: x.event_timestamp)

        potential_causes = self._identify_potential_causes(events_before)

        return TimelineCorrelation(
            incident_id=incident_id,
            events_before=events_before[:20],
            events_during=events_during[:20],
            potential_causes=potential_causes,
        )

    def _identify_potential_causes(self, events: List[TimelineEventResponse]) -> List[Dict[str, Any]]:
        potential_causes = []

        high_risk_types = {
            ChangeType.DEPLOYMENT: 0.8,
            ChangeType.CONFIG_CHANGE: 0.7,
            ChangeType.INFRASTRUCTURE: 0.6,
            ChangeType.SCALE_EVENT: 0.4,
        }

        for event in events[:10]:
            if event.event_type in high_risk_types:
                potential_causes.append(
                    {
                        "event_id": event.id,
                        "event_type": event.event_type.value,
                        "title": event.title,
                        "timestamp": event.event_timestamp.isoformat(),
                        "risk_score": high_risk_types[event.event_type],
                        "source": event.source.value,
                        "service": event.service_name,
                    }
                )

        potential_causes.sort(key=lambda x: x["risk_score"], reverse=True)
        return potential_causes[:5]

    async def get_timeline_stats(self, hours: int = 24) -> Dict[str, Any]:
        cutoff = datetime.now(timezone.utc) - timedelta(hours=hours)

        recent_events = [e for e in self._events.values() if e.event_timestamp >= cutoff]

        by_type = {}
        by_source = {}
        by_environment = {}
        by_hour = {}

        for event in recent_events:
            by_type[event.event_type.value] = by_type.get(event.event_type.value, 0) + 1
            by_source[event.source.value] = by_source.get(event.source.value, 0) + 1

            if event.environment:
                by_environment[event.environment] = by_environment.get(event.environment, 0) + 1

            hour_key = event.event_timestamp.strftime("%Y-%m-%d %H:00")
            by_hour[hour_key] = by_hour.get(hour_key, 0) + 1

        return {
            "total_events": len(recent_events),
            "by_type": by_type,
            "by_source": by_source,
            "by_environment": by_environment,
            "by_hour": by_hour,
            "period_hours": hours,
        }

    async def record_k8s_event(
        self,
        event_type: ChangeType,
        namespace: str,
        resource_name: str,
        description: str,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> TimelineEventResponse:
        return await self.create_event(
            TimelineEventCreate(
                event_type=event_type,
                source=ChangeSource.KUBERNETES,
                title=f"K8s: {resource_name}",
                description=description,
                namespace=namespace,
                service_name=resource_name,
                metadata=metadata or {},
            )
        )

    async def record_jenkins_event(
        self,
        job_name: str,
        build_number: int,
        result: str,
        environment: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> TimelineEventResponse:
        event_type = ChangeType.BUILD
        if "deploy" in job_name.lower():
            event_type = ChangeType.DEPLOYMENT

        return await self.create_event(
            TimelineEventCreate(
                event_type=event_type,
                source=ChangeSource.JENKINS,
                title=f"Jenkins: {job_name} #{build_number}",
                description=f"Build {result}",
                source_id=f"{job_name}#{build_number}",
                service_name=job_name,
                environment=environment,
                metadata=metadata or {"build_number": build_number, "result": result},
            )
        )


timeline_service = TimelineService()
