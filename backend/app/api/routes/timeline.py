from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, HTTPException, Query

from app.schemas.timeline import (
    ChangeSource,
    ChangeType,
    TimelineCorrelation,
    TimelineEventCreate,
    TimelineEventResponse,
    TimelineFilter,
)
from app.services.timeline_service import timeline_service

router = APIRouter()


@router.get("", response_model=List[TimelineEventResponse])
async def list_events(
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    event_types: Optional[List[ChangeType]] = Query(None),
    sources: Optional[List[ChangeSource]] = Query(None),
    namespaces: Optional[List[str]] = Query(None),
    services: Optional[List[str]] = Query(None),
    environments: Optional[List[str]] = Query(None),
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
):
    """List timeline events with filters."""
    filter_params = TimelineFilter(
        start_date=start_date,
        end_date=end_date,
        event_types=event_types,
        sources=sources,
        namespaces=namespaces,
        services=services,
        environments=environments,
        limit=limit,
        offset=offset,
    )

    return await timeline_service.get_events(filter_params)


@router.post("", response_model=TimelineEventResponse)
async def create_event(event: TimelineEventCreate):
    """Create a new timeline event."""
    return await timeline_service.create_event(event)


@router.get("/stats")
async def get_timeline_stats(hours: int = Query(24, ge=1, le=168)):
    """Get timeline statistics for the specified time window."""
    return await timeline_service.get_timeline_stats(hours)


@router.get("/{event_id}", response_model=TimelineEventResponse)
async def get_event(event_id: str):
    """Get details of a specific timeline event."""
    event = await timeline_service.get_event(event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    return event


@router.post("/{event_id}/link-incident")
async def link_event_to_incident(event_id: str, incident_id: str = Query(...)):
    """Link a timeline event to an incident."""
    event = await timeline_service.link_incident(event_id, incident_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    return {"message": "Event linked to incident", "event_id": event_id, "incident_id": incident_id}


@router.get("/correlate/{incident_id}", response_model=TimelineCorrelation)
async def correlate_incident_events(
    incident_id: str,
    incident_timestamp: datetime = Query(...),
    window_before: int = Query(60, ge=5, le=180),
    window_after: int = Query(30, ge=5, le=60),
):
    """Get correlated timeline events for an incident."""
    return await timeline_service.get_events_for_incident(
        incident_id=incident_id,
        incident_timestamp=incident_timestamp,
        window_before_minutes=window_before,
        window_after_minutes=window_after,
    )
