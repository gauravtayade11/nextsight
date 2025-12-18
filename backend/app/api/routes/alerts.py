"""
Alerts API - Automatic incident detection and webhook endpoints
"""

import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, BackgroundTasks, HTTPException
from pydantic import BaseModel

from app.services.k8s_watcher_service import ALERT_RULES, k8s_watcher_service

router = APIRouter()

# In-memory incident store (reference to incidents route store)
_incidents: dict = {}


def get_incidents_store():
    """Get the incidents store from the incidents module"""
    from app.api.routes.incidents import _incidents as incidents_store

    return incidents_store


# Webhook payload models
class PrometheusAlert(BaseModel):
    status: str  # firing, resolved
    labels: Dict[str, str]
    annotations: Dict[str, str]
    startsAt: Optional[str] = None
    endsAt: Optional[str] = None
    generatorURL: Optional[str] = None


class AlertmanagerWebhook(BaseModel):
    version: str = "4"
    groupKey: str = ""
    status: str = "firing"
    receiver: str = ""
    alerts: List[PrometheusAlert] = []


class GenericWebhookAlert(BaseModel):
    title: str
    description: Optional[str] = None
    severity: str = "medium"  # critical, high, medium, low
    source: str = "webhook"
    namespace: Optional[str] = None
    service: Optional[str] = None
    labels: Dict[str, str] = {}


@router.get("/rules")
async def get_alert_rules():
    """Get all configured alert rules"""
    return {
        "rules": ALERT_RULES,
        "total": len(ALERT_RULES),
    }


@router.post("/scan")
async def trigger_scan(background_tasks: BackgroundTasks):
    """Manually trigger a K8s cluster scan for issues"""
    try:
        incidents = await k8s_watcher_service.scan_and_create_incidents()

        # Store created incidents
        incidents_store = get_incidents_store()
        created = []

        for incident_data in incidents:
            incident_id = str(uuid.uuid4())
            now = datetime.now(timezone.utc)

            incident = {
                "id": incident_id,
                **incident_data,
                "status": "open",
                "ai_analysis": None,
                "ai_recommendations": [],
                "assigned_to": None,
                "resolved_at": None,
                "created_at": now,
                "updated_at": now,
            }

            incidents_store[incident_id] = type("Incident", (), incident)()
            for k, v in incident.items():
                setattr(incidents_store[incident_id], k, v)

            created.append(
                {
                    "id": incident_id,
                    "title": incident_data["title"],
                    "severity": incident_data["severity"],
                }
            )

        return {
            "message": f"Scan complete. Created {len(created)} incidents.",
            "incidents": created,
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/scan/status")
async def get_scan_status():
    """Get current watcher status"""
    return {
        "watching": k8s_watcher_service._watching,
        "initialized": k8s_watcher_service._initialized,
        "recent_incidents_cached": len(k8s_watcher_service._recent_incidents),
    }


@router.post("/webhook/prometheus")
async def prometheus_webhook(payload: AlertmanagerWebhook):
    """
    Webhook endpoint for Prometheus Alertmanager
    Configure in Alertmanager:
    receivers:
      - name: 'nextsight'
        webhook_configs:
          - url: 'http://nextsight:8000/api/v1/alerts/webhook/prometheus'
    """
    incidents_store = get_incidents_store()
    created = []

    for alert in payload.alerts:
        if alert.status != "firing":
            continue

        # Map Prometheus severity to our severity
        severity_map = {
            "critical": "critical",
            "error": "high",
            "warning": "medium",
            "info": "low",
        }

        prom_severity = alert.labels.get("severity", "medium")
        severity = severity_map.get(prom_severity, "medium")

        # Build incident
        incident_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc)

        title = alert.annotations.get("summary", alert.labels.get("alertname", "Prometheus Alert"))
        description = alert.annotations.get("description", f"Alert: {alert.labels.get('alertname', 'Unknown')}")

        incident = {
            "id": incident_id,
            "title": title,
            "description": description,
            "severity": severity,
            "status": "open",
            "source": "prometheus",
            "source_id": alert.labels.get("alertname", ""),
            "namespace": alert.labels.get("namespace"),
            "affected_services": [alert.labels.get("service", alert.labels.get("pod", ""))],
            "tags": ["prometheus", alert.labels.get("alertname", "")],
            "ai_analysis": None,
            "ai_recommendations": [],
            "assigned_to": None,
            "resolved_at": None,
            "created_at": now,
            "updated_at": now,
        }

        # Create incident object
        incident_obj = type("Incident", (), incident)()
        for k, v in incident.items():
            setattr(incident_obj, k, v)
        incidents_store[incident_id] = incident_obj

        created.append({"id": incident_id, "title": title})

    return {
        "status": "ok",
        "created_incidents": len(created),
        "incidents": created,
    }


@router.post("/webhook/generic")
async def generic_webhook(alert: GenericWebhookAlert):
    """
    Generic webhook endpoint for any alerting system
    POST /api/v1/alerts/webhook/generic
    {
        "title": "Alert title",
        "description": "Details",
        "severity": "high",
        "source": "datadog",
        "namespace": "production",
        "service": "api-gateway"
    }
    """
    incidents_store = get_incidents_store()

    incident_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)

    incident = {
        "id": incident_id,
        "title": alert.title,
        "description": alert.description,
        "severity": alert.severity,
        "status": "open",
        "source": alert.source,
        "source_id": None,
        "namespace": alert.namespace,
        "affected_services": [alert.service] if alert.service else [],
        "tags": list(alert.labels.values()) if alert.labels else [],
        "ai_analysis": None,
        "ai_recommendations": [],
        "assigned_to": None,
        "resolved_at": None,
        "created_at": now,
        "updated_at": now,
    }

    incident_obj = type("Incident", (), incident)()
    for k, v in incident.items():
        setattr(incident_obj, k, v)
    incidents_store[incident_id] = incident_obj

    return {
        "status": "ok",
        "incident_id": incident_id,
        "title": alert.title,
    }


@router.post("/webhook/pagerduty")
async def pagerduty_webhook(payload: Dict[str, Any]):
    """Webhook endpoint for PagerDuty events"""
    incidents_store = get_incidents_store()

    # PagerDuty sends events in messages array
    messages = payload.get("messages", [payload])
    created = []

    for msg in messages:
        event = msg.get("event", msg)

        if event.get("event_type") not in ["incident.triggered", "incident.acknowledged"]:
            continue

        incident_data = event.get("incident", {})

        incident_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc)

        # Map PagerDuty urgency to severity
        urgency = incident_data.get("urgency", "high")
        severity = "critical" if urgency == "high" else "medium"

        incident = {
            "id": incident_id,
            "title": incident_data.get("title", "PagerDuty Incident"),
            "description": incident_data.get("description", ""),
            "severity": severity,
            "status": "open",
            "source": "pagerduty",
            "source_id": incident_data.get("id"),
            "namespace": None,
            "affected_services": [s.get("summary", "") for s in incident_data.get("impacted_services", [])],
            "tags": ["pagerduty"],
            "ai_analysis": None,
            "ai_recommendations": [],
            "assigned_to": None,
            "resolved_at": None,
            "created_at": now,
            "updated_at": now,
        }

        incident_obj = type("Incident", (), incident)()
        for k, v in incident.items():
            setattr(incident_obj, k, v)
        incidents_store[incident_id] = incident_obj

        created.append({"id": incident_id, "title": incident["title"]})

    return {"status": "ok", "created": len(created), "incidents": created}
