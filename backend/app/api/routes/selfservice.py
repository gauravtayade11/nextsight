import uuid
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, HTTPException, Query

from app.schemas.gitflow import Environment
from app.schemas.selfservice import (
    ActionStatus,
    ActionType,
    EnvironmentInfo,
    QuickAction,
    SelfServiceAction,
    SelfServiceActionRequest,
    ServiceCatalogItem,
)
from app.services.gitflow_service import gitflow_service
from app.services.k8s_deployment_service import k8s_deployment_service
from app.services.kubernetes_service import kubernetes_service

router = APIRouter()

_actions: dict[str, SelfServiceAction] = {}
_catalog: dict[str, ServiceCatalogItem] = {}


@router.get("/catalog", response_model=List[ServiceCatalogItem])
async def get_service_catalog(namespace: Optional[str] = Query(None), environment: Optional[str] = Query(None)):
    """Get the service catalog for self-service operations."""
    try:
        deployments = await kubernetes_service.get_deployments(namespace)

        services = []
        for dep in deployments:
            service = ServiceCatalogItem(
                name=dep.name,
                namespace=dep.namespace,
                environment=environment or "default",
                description=f"Deployment with {dep.replicas} replicas",
                current_version=dep.image.split(":")[-1] if dep.image and ":" in dep.image else "latest",
                allowed_actions=[ActionType.DEPLOY, ActionType.ROLLBACK, ActionType.SCALE, ActionType.RESTART],
                health_status="healthy" if dep.ready_replicas == dep.replicas else "degraded",
                last_deployed=None,
            )
            services.append(service)
            _catalog[f"{dep.namespace}/{dep.name}"] = service

        return services
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/catalog/{namespace}/{service_name}", response_model=ServiceCatalogItem)
async def get_service(namespace: str, service_name: str):
    """Get details of a specific service."""
    key = f"{namespace}/{service_name}"
    if key in _catalog:
        return _catalog[key]

    try:
        deployments = await kubernetes_service.get_deployments(namespace)
        for dep in deployments:
            if dep.name == service_name:
                return ServiceCatalogItem(
                    name=dep.name,
                    namespace=dep.namespace,
                    environment="default",
                    current_version=dep.image.split(":")[-1] if dep.image and ":" in dep.image else "latest",
                    allowed_actions=[ActionType.DEPLOY, ActionType.ROLLBACK, ActionType.SCALE, ActionType.RESTART],
                    health_status="healthy" if dep.ready_replicas == dep.replicas else "degraded",
                )
    except Exception:
        pass

    raise HTTPException(status_code=404, detail="Service not found")


@router.get("/environments", response_model=List[EnvironmentInfo])
async def get_environments():
    """Get list of available environments."""
    try:
        namespaces = await kubernetes_service.get_namespaces()
        pods = await kubernetes_service.get_pods()

        environments = []
        for ns in namespaces:
            ns_pods = [p for p in pods if p.namespace == ns.name]
            running = sum(1 for p in ns_pods if p.status.value == "Running")

            is_prod = any(kw in ns.name.lower() for kw in ["prod", "production", "live"])

            environments.append(
                EnvironmentInfo(
                    name=ns.name,
                    cluster="default",
                    description=f"Namespace with {len(ns_pods)} pods",
                    is_production=is_prod,
                    services_count=len(set(p.name.rsplit("-", 2)[0] for p in ns_pods if "-" in p.name)),
                    health_status="healthy" if running == len(ns_pods) else "degraded",
                )
            )

        return environments
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/quick-actions", response_model=List[QuickAction])
async def get_quick_actions():
    """Get available quick actions for self-service."""
    return [
        QuickAction(
            id="scale-up",
            name="Scale Up",
            description="Increase replica count by 1",
            action_type=ActionType.SCALE,
            icon="arrow-up",
            requires_confirmation=True,
            parameters_schema={"namespace": "string", "deployment": "string"},
        ),
        QuickAction(
            id="scale-down",
            name="Scale Down",
            description="Decrease replica count by 1",
            action_type=ActionType.SCALE,
            icon="arrow-down",
            requires_confirmation=True,
            parameters_schema={"namespace": "string", "deployment": "string"},
        ),
        QuickAction(
            id="restart",
            name="Restart Service",
            description="Rolling restart of all pods",
            action_type=ActionType.RESTART,
            icon="refresh",
            requires_confirmation=True,
            parameters_schema={"namespace": "string", "deployment": "string"},
        ),
        QuickAction(
            id="rollback",
            name="Rollback",
            description="Rollback to previous version",
            action_type=ActionType.ROLLBACK,
            icon="undo",
            requires_confirmation=True,
            parameters_schema={"namespace": "string", "deployment": "string", "version": "string?"},
        ),
    ]


@router.post("/actions", response_model=SelfServiceAction)
async def create_action(request: SelfServiceActionRequest):
    """Request a self-service action."""
    action_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)

    status = ActionStatus.PENDING if request.requires_approval else ActionStatus.APPROVED

    action = SelfServiceAction(
        id=action_id,
        action_type=request.action_type,
        target_service=request.target_service,
        target_namespace=request.target_namespace,
        target_environment=request.target_environment,
        parameters=request.parameters,
        reason=request.reason,
        status=status,
        requested_by="self-service",
        created_at=now,
    )

    _actions[action_id] = action

    if not request.requires_approval:
        action = await _execute_action(action)

    return action


@router.get("/actions", response_model=List[SelfServiceAction])
async def list_actions(status: Optional[ActionStatus] = Query(None), limit: int = Query(50, ge=1, le=200)):
    """List all self-service actions."""
    actions = list(_actions.values())

    if status:
        actions = [a for a in actions if a.status == status]

    actions.sort(key=lambda x: x.created_at, reverse=True)
    return actions[:limit]


@router.get("/actions/{action_id}", response_model=SelfServiceAction)
async def get_action(action_id: str):
    """Get details of a specific action."""
    if action_id not in _actions:
        raise HTTPException(status_code=404, detail="Action not found")
    return _actions[action_id]


@router.post("/actions/{action_id}/approve", response_model=SelfServiceAction)
async def approve_action(action_id: str, approved_by: str = Query(...)):
    """Approve a pending action."""
    if action_id not in _actions:
        raise HTTPException(status_code=404, detail="Action not found")

    action = _actions[action_id]

    if action.status != ActionStatus.PENDING:
        raise HTTPException(status_code=400, detail="Action is not pending approval")

    action.status = ActionStatus.APPROVED
    action.approved_by = approved_by

    action = await _execute_action(action)
    return action


@router.post("/actions/{action_id}/reject", response_model=SelfServiceAction)
async def reject_action(action_id: str, reason: str = Query(...)):
    """Reject a pending action."""
    if action_id not in _actions:
        raise HTTPException(status_code=404, detail="Action not found")

    action = _actions[action_id]

    if action.status != ActionStatus.PENDING:
        raise HTTPException(status_code=400, detail="Action is not pending approval")

    action.status = ActionStatus.REJECTED
    action.error_message = f"Rejected: {reason}"
    return action


async def _execute_action(action: SelfServiceAction) -> SelfServiceAction:
    """Execute an approved action."""
    action.status = ActionStatus.RUNNING
    action.executed_at = datetime.now(timezone.utc)

    try:
        if action.action_type == ActionType.SCALE:
            replicas = action.parameters.get("replicas", 1)
            result = await kubernetes_service.scale_deployment(
                namespace=action.target_namespace, deployment_name=action.target_service, replicas=replicas
            )
            action.result = result

        elif action.action_type == ActionType.RESTART:
            result = await kubernetes_service.restart_deployment(
                namespace=action.target_namespace, deployment_name=action.target_service
            )
            action.result = result

        elif action.action_type == ActionType.ROLLBACK:
            target_version = action.parameters.get("version")
            deployment_id = action.parameters.get("deployment_id")
            if deployment_id:
                result = await k8s_deployment_service.rollback(
                    deployment_id=deployment_id, target_version=target_version, reason=action.reason
                )
                action.result = {"deployment_status": result.status}

        elif action.action_type == ActionType.DEPLOY:
            release_id = action.parameters.get("release_id")
            if release_id:
                result = await k8s_deployment_service.deploy_release(
                    release_id=release_id,
                    version=action.parameters.get("version", "latest"),
                    environment=Environment(action.target_environment),
                    namespace=action.target_namespace,
                    services=[action.target_service],
                    image_registry=action.parameters.get("registry", ""),
                )
                action.result = {"deployment_id": result.id, "status": result.status}

        action.status = ActionStatus.COMPLETED

    except Exception as e:
        action.status = ActionStatus.FAILED
        action.error_message = str(e)

    return action
