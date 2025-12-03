import uuid
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, HTTPException, Query

from app.schemas.incident import (
    IncidentAnalysisRequest,
    IncidentAnalysisResponse,
    IncidentCreate,
    IncidentResponse,
    IncidentSeverity,
    IncidentStatus,
    IncidentUpdate,
)
from app.services.ai_analysis_service import ai_analysis_service
from app.services.kubernetes_service import kubernetes_service
from app.services.timeline_service import timeline_service

router = APIRouter()

_incidents: dict[str, IncidentResponse] = {}


@router.get("", response_model=List[IncidentResponse])
async def list_incidents(
    status: Optional[IncidentStatus] = Query(None),
    severity: Optional[IncidentSeverity] = Query(None),
    namespace: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    """List all incidents with optional filters."""
    incidents = list(_incidents.values())

    if status:
        incidents = [i for i in incidents if i.status == status]
    if severity:
        incidents = [i for i in incidents if i.severity == severity]
    if namespace:
        incidents = [i for i in incidents if i.namespace == namespace]

    incidents.sort(key=lambda x: x.created_at, reverse=True)
    return incidents[offset : offset + limit]


@router.post("", response_model=IncidentResponse)
async def create_incident(incident: IncidentCreate):
    """Create a new incident."""
    incident_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)

    response = IncidentResponse(
        id=incident_id,
        title=incident.title,
        description=incident.description,
        severity=incident.severity,
        status=IncidentStatus.OPEN,
        source=incident.source,
        source_id=incident.source_id,
        namespace=incident.namespace,
        affected_services=incident.affected_services,
        tags=incident.tags,
        ai_analysis=None,
        ai_recommendations=[],
        assigned_to=None,
        resolved_at=None,
        created_at=now,
        updated_at=now,
    )

    _incidents[incident_id] = response
    return response


@router.get("/{incident_id}", response_model=IncidentResponse)
async def get_incident(incident_id: str):
    """Get details of a specific incident."""
    if incident_id not in _incidents:
        raise HTTPException(status_code=404, detail="Incident not found")
    return _incidents[incident_id]


@router.patch("/{incident_id}", response_model=IncidentResponse)
async def update_incident(incident_id: str, update: IncidentUpdate):
    """Update an incident."""
    if incident_id not in _incidents:
        raise HTTPException(status_code=404, detail="Incident not found")

    incident = _incidents[incident_id]
    update_data = update.model_dump(exclude_unset=True)

    for field, value in update_data.items():
        setattr(incident, field, value)

    if update.status == IncidentStatus.RESOLVED:
        incident.resolved_at = datetime.now(timezone.utc)

    incident.updated_at = datetime.now(timezone.utc)
    return incident


@router.post("/{incident_id}/analyze", response_model=IncidentAnalysisResponse)
async def analyze_incident(incident_id: str, request: IncidentAnalysisRequest):
    """Trigger AI analysis of an incident."""
    if incident_id not in _incidents:
        raise HTTPException(status_code=404, detail="Incident not found")

    incident = _incidents[incident_id]

    k8s_context = None
    if request.include_k8s_context and incident.namespace:
        try:
            pods = await kubernetes_service.get_pods(incident.namespace)
            events = await kubernetes_service.get_events(incident.namespace, limit=20)
            deployments = await kubernetes_service.get_deployments(incident.namespace)

            k8s_context = {
                "namespace": incident.namespace,
                "pods": [{"name": p.name, "status": p.status.value, "restarts": p.restarts} for p in pods],
                "events": [{"reason": e.reason, "message": e.message, "type": e.type} for e in events],
                "deployments": [
                    {"name": d.name, "ready": d.ready_replicas, "desired": d.replicas} for d in deployments
                ],
            }
        except Exception:
            k8s_context = None

    timeline_events = None
    try:
        correlation = await timeline_service.get_events_for_incident(
            incident_id=incident_id, incident_timestamp=incident.created_at
        )
        timeline_events = [
            {
                "title": e.title,
                "type": e.event_type.value,
                "source": e.source.value,
                "timestamp": e.event_timestamp.isoformat(),
            }
            for e in correlation.events_before + correlation.events_during
        ]
    except Exception:
        timeline_events = None

    analysis = await ai_analysis_service.analyze_incident(
        incident_id=incident_id,
        incident_title=incident.title,
        incident_description=incident.description or "",
        severity=incident.severity.value,
        k8s_context=k8s_context,
        jenkins_context=None,
        timeline_events=timeline_events,
        additional_context=request.additional_context,
    )

    incident.ai_analysis = analysis.analysis
    incident.ai_recommendations = analysis.recommendations
    incident.updated_at = datetime.now(timezone.utc)

    return analysis


@router.post("/{incident_id}/runbook")
async def suggest_runbook(incident_id: str):
    """Get AI-suggested runbook for an incident."""
    if incident_id not in _incidents:
        raise HTTPException(status_code=404, detail="Incident not found")

    incident = _incidents[incident_id]

    symptoms = []
    if incident.description:
        symptoms.append(incident.description)

    runbook = await ai_analysis_service.suggest_runbook(
        incident_type=incident.severity.value, symptoms=symptoms, affected_services=incident.affected_services
    )

    return runbook


@router.get("/{incident_id}/timeline")
async def get_incident_timeline(incident_id: str):
    """Get timeline events related to an incident."""
    if incident_id not in _incidents:
        raise HTTPException(status_code=404, detail="Incident not found")

    incident = _incidents[incident_id]

    correlation = await timeline_service.get_events_for_incident(
        incident_id=incident_id, incident_timestamp=incident.created_at
    )

    return correlation


@router.delete("/{incident_id}")
async def delete_incident(incident_id: str):
    """Delete an incident."""
    if incident_id not in _incidents:
        raise HTTPException(status_code=404, detail="Incident not found")

    del _incidents[incident_id]
    return {"message": "Incident deleted", "id": incident_id}
