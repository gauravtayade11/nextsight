from typing import List, Optional

from fastapi import APIRouter, HTTPException, Query

from app.schemas.gitflow import DeploymentRequest, DeploymentStatus, Environment, RollbackRequest
from app.schemas.kubernetes import (
    ClusterMetrics,
    ConfigMapInfo,
    ConfigMapDetail,
    ConfigMapCreateRequest,
    ConfigMapUpdateRequest,
    CronJobInfo,
    DaemonSetInfo,
    DeploymentInfo,
    HPAInfo,
    IngressInfo,
    IngressCreateRequest,
    IngressUpdateRequest,
    JobInfo,
    K8sClusterHealth,
    K8sEvent,
    KubectlRequest,
    KubectlResponse,
    NamespaceInfo,
    NamespaceDetail,
    NamespaceCreateRequest,
    NodeInfo,
    NodeMetrics,
    PodExecRequest,
    PodExecResponse,
    PodInfo,
    PodLogResponse,
    PodMetrics,
    PVCInfo,
    PVCCreateRequest,
    PVCUpdateRequest,
    PVInfo,
    PVCreateRequest,
    ResourceDeleteResponse,
    ResourceYAMLRequest,
    ResourceYAMLResponse,
    RestartRequest,
    ScaleRequest,
    SecretInfo,
    SecretDetail,
    SecretCreateRequest,
    SecretUpdateRequest,
    ServiceInfo,
    ServiceCreateRequest,
    ServiceUpdateRequest,
    ShellRequest,
    ShellResponse,
    StatefulSetInfo,
    StorageClassInfo,
    StorageClassCreateRequest,
    YAMLApplyRequest,
    YAMLApplyResponse,
)
from app.services.k8s_deployment_service import k8s_deployment_service
from app.services.kubernetes_service import kubernetes_service

router = APIRouter()


@router.get("/health", response_model=K8sClusterHealth)
async def get_cluster_health():
    """Get Kubernetes cluster health status."""
    try:
        return await kubernetes_service.get_cluster_health()
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Failed to get cluster health: {str(e)}")
    return await kubernetes_service.get_cluster_health()


@router.get("/namespaces", response_model=List[NamespaceInfo])
async def list_namespaces():
    """List all Kubernetes namespaces."""
    try:
        return await kubernetes_service.get_namespaces()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/namespaces/details", response_model=List[NamespaceDetail])
async def list_namespaces_with_details():
    """List all namespaces with resource counts (pods, deployments, services, etc.)."""
    try:
        return await kubernetes_service.get_namespaces_with_details()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/namespaces", response_model=NamespaceInfo)
async def create_namespace(request: NamespaceCreateRequest):
    """Create a new namespace."""
    try:
        return await kubernetes_service.create_namespace(request)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/namespaces/{name}")
async def delete_namespace(name: str):
    """Delete a namespace."""
    try:
        await kubernetes_service.delete_namespace(name)
        return {"message": f"Namespace {name} deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/pods", response_model=List[PodInfo])
async def list_pods(namespace: Optional[str] = Query(None)):
    """List pods, optionally filtered by namespace."""
    try:
        return await kubernetes_service.get_pods(namespace)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    return await kubernetes_service.get_pods(namespace)


@router.get("/deployments", response_model=List[DeploymentInfo])
async def list_deployments(namespace: Optional[str] = Query(None)):
    """List deployments, optionally filtered by namespace."""
    try:
        return await kubernetes_service.get_deployments(namespace)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/deployments/{namespace}/{name}", response_model=DeploymentInfo)
async def get_deployment(namespace: str, name: str):
    """Get a specific deployment."""
    try:
        deployment = await kubernetes_service.get_deployment(namespace, name)
        if not deployment:
            raise HTTPException(status_code=404, detail=f"Deployment {namespace}/{name} not found")
        return deployment
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/deployments/{namespace}/{name}", response_model=ResourceDeleteResponse)
async def delete_deployment(namespace: str, name: str):
    """Delete a deployment."""
    try:
        return await kubernetes_service.delete_deployment(namespace, name)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/services", response_model=List[ServiceInfo])
async def list_services(namespace: Optional[str] = Query(None)):
    """List services, optionally filtered by namespace."""
    try:
        return await kubernetes_service.get_services(namespace)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/services", response_model=ServiceInfo)
async def create_service(request: ServiceCreateRequest):
    """Create a new Kubernetes Service."""
    try:
        return await kubernetes_service.create_service(request)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/services/{namespace}/{name}", response_model=ServiceInfo)
async def update_service(namespace: str, name: str, request: ServiceUpdateRequest):
    """Update an existing Kubernetes Service."""
    try:
        return await kubernetes_service.update_service(namespace, name, request)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/services/{namespace}/{name}", response_model=ResourceDeleteResponse)
async def delete_service(namespace: str, name: str):
    """Delete a Kubernetes Service."""
    try:
        return await kubernetes_service.delete_service(namespace, name)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/events", response_model=List[K8sEvent])
async def list_events(namespace: Optional[str] = Query(None), limit: int = Query(100, ge=1, le=500)):
    """List Kubernetes events."""
    try:
        return await kubernetes_service.get_events(namespace, limit)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/pods/{namespace}/{pod_name}/events", response_model=List[K8sEvent])
async def get_pod_events(namespace: str, pod_name: str):
    """Get events for a specific pod."""
    try:
        return await kubernetes_service.get_pod_events(namespace, pod_name)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/workloads/{kind}/{namespace}/{name}/events", response_model=List[K8sEvent])
async def get_workload_events(kind: str, namespace: str, name: str):
    """Get events for a specific workload (Deployment, StatefulSet, DaemonSet, Job)."""
    try:
        return await kubernetes_service.get_workload_events(kind, namespace, name)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/scale")
async def scale_deployment(request: ScaleRequest):
    """Scale a deployment to the specified number of replicas."""
    try:
        return await kubernetes_service.scale_deployment(
            namespace=request.namespace, deployment_name=request.deployment_name, replicas=request.replicas
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/restart")
async def restart_deployment(request: RestartRequest):
    """Restart a deployment by updating its pod template."""
    try:
        return await kubernetes_service.restart_deployment(
            namespace=request.namespace, deployment_name=request.deployment_name
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/deploy", response_model=DeploymentStatus)
async def deploy_release(request: DeploymentRequest):
    """Deploy a release to Kubernetes."""
    try:
        return await k8s_deployment_service.deploy_release(
            release_id=request.release_id,
            version="latest",
            environment=request.environment,
            namespace=request.namespace,
            services=request.services,
            image_registry="",
            dry_run=request.dry_run,
            wait_for_ready=request.wait_for_ready,
            timeout_seconds=request.timeout_seconds,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/rollback", response_model=DeploymentStatus)
async def rollback_deployment(request: RollbackRequest):
    """Rollback a deployment to a previous version."""
    try:
        return await k8s_deployment_service.rollback(
            deployment_id=request.deployment_id, target_version=request.target_version, reason=request.reason
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/deployments/{deployment_id}/status", response_model=DeploymentStatus)
async def get_deployment_status(deployment_id: str):
    """Get the status of a specific deployment."""
    status = await k8s_deployment_service.get_deployment_status(deployment_id)
    if not status:
        raise HTTPException(status_code=404, detail="Deployment not found")
    return status


@router.get("/namespaces/{namespace}/history", response_model=List[DeploymentStatus])
async def get_namespace_deployment_history(namespace: str, limit: int = Query(20, ge=1, le=100)):
    """Get deployment history for a namespace."""
    return await k8s_deployment_service.get_deployment_history(namespace, limit)


@router.get("/environments/{environment}/status")
async def get_environment_status(environment: Environment):
    """Get status summary for an environment."""
    return await k8s_deployment_service.get_environment_status(environment)


# Node endpoints
@router.get("/nodes", response_model=List[NodeInfo])
async def list_nodes():
    """List all nodes with detailed information."""
    try:
        return await kubernetes_service.get_nodes()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/nodes/{node_name}", response_model=NodeInfo)
async def get_node(node_name: str):
    """Get detailed information about a specific node."""
    try:
        node = await kubernetes_service.get_node(node_name)
        if not node:
            raise HTTPException(status_code=404, detail=f"Node {node_name} not found")
        return node
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/nodes/{node_name}/pods", response_model=List[PodInfo])
async def get_pods_on_node(node_name: str):
    """Get all pods running on a specific node."""
    try:
        return await kubernetes_service.get_pods_on_node(node_name)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Metrics endpoints
@router.get("/metrics/status")
async def get_metrics_server_status():
    """Check if metrics-server is available in the cluster."""
    try:
        metrics = await kubernetes_service.get_node_metrics()
        return {
            "available": len(metrics) > 0,
            "message": "Metrics server is available" if metrics else "Metrics server not found",
            "node_count": len(metrics)
        }
    except Exception:
        return {
            "available": False,
            "message": "Metrics server not available or not installed",
            "node_count": 0
        }


@router.get("/metrics", response_model=ClusterMetrics)
async def get_cluster_metrics():
    """Get cluster-wide resource metrics (requires metrics-server)."""
    try:
        metrics = await kubernetes_service.get_cluster_metrics()
        if not metrics:
            raise HTTPException(status_code=503, detail="Metrics server not available")
        return metrics
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/metrics/nodes", response_model=List[NodeMetrics])
async def get_node_metrics():
    """Get resource metrics for all nodes (requires metrics-server)."""
    try:
        return await kubernetes_service.get_node_metrics()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/metrics/pods", response_model=List[PodMetrics])
async def get_pod_metrics(namespace: Optional[str] = Query(None)):
    """Get resource metrics for pods (requires metrics-server)."""
    try:
        return await kubernetes_service.get_pod_metrics(namespace)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Logs endpoint
@router.get("/pods/{namespace}/{pod_name}/logs", response_model=PodLogResponse)
async def get_pod_logs(
    namespace: str,
    pod_name: str,
    container: Optional[str] = Query(None),
    tail_lines: int = Query(100, ge=1, le=5000),
    since_seconds: Optional[int] = Query(None, ge=1),
    timestamps: bool = Query(False),
    previous: bool = Query(False),
):
    """Get logs from a pod container."""
    from kubernetes.client.rest import ApiException

    try:
        return await kubernetes_service.get_pod_logs(
            namespace=namespace,
            pod_name=pod_name,
            container=container if container else None,
            tail_lines=tail_lines,
            since_seconds=since_seconds,
            timestamps=timestamps,
            previous=previous,
        )
    except ApiException as e:
        if e.status == 404:
            raise HTTPException(status_code=404, detail=f"Pod {pod_name} not found in namespace {namespace}")
        raise HTTPException(status_code=e.status or 500, detail=e.reason or str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get logs: {str(e)}")


# Exec endpoint
@router.post("/pods/{namespace}/{pod_name}/exec", response_model=PodExecResponse)
async def exec_pod_command(namespace: str, pod_name: str, request: PodExecRequest):
    """Execute a command in a pod container."""
    try:
        return await kubernetes_service.exec_command(
            namespace=namespace, pod_name=pod_name, command=request.command, container=request.container
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Ingress endpoints
@router.get("/ingresses", response_model=List[IngressInfo])
async def list_ingresses(namespace: Optional[str] = Query(None)):
    """List ingresses, optionally filtered by namespace."""
    try:
        return await kubernetes_service.get_ingresses(namespace)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/ingresses", response_model=IngressInfo)
async def create_ingress(request: IngressCreateRequest):
    """Create a new Kubernetes Ingress."""
    try:
        return await kubernetes_service.create_ingress(request)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/ingresses/{namespace}/{name}", response_model=IngressInfo)
async def update_ingress(namespace: str, name: str, request: IngressUpdateRequest):
    """Update an existing Kubernetes Ingress."""
    try:
        return await kubernetes_service.update_ingress(namespace, name, request)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/ingresses/{namespace}/{name}", response_model=ResourceDeleteResponse)
async def delete_ingress(namespace: str, name: str):
    """Delete a Kubernetes Ingress."""
    try:
        return await kubernetes_service.delete_ingress(namespace, name)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ConfigMap endpoints
@router.get("/configmaps", response_model=List[ConfigMapInfo])
async def list_configmaps(namespace: Optional[str] = Query(None)):
    """List ConfigMaps, optionally filtered by namespace."""
    try:
        return await kubernetes_service.get_configmaps(namespace)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/configmaps/{namespace}/{name}", response_model=ConfigMapDetail)
async def get_configmap(namespace: str, name: str):
    """Get a single ConfigMap with full data values."""
    try:
        return await kubernetes_service.get_configmap(namespace, name)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/configmaps", response_model=ConfigMapDetail)
async def create_configmap(request: ConfigMapCreateRequest):
    """Create a new ConfigMap."""
    try:
        return await kubernetes_service.create_configmap(request)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/configmaps/{namespace}/{name}", response_model=ConfigMapDetail)
async def update_configmap(namespace: str, name: str, request: ConfigMapUpdateRequest):
    """Update an existing ConfigMap."""
    try:
        return await kubernetes_service.update_configmap(namespace, name, request)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/configmaps/{namespace}/{name}")
async def delete_configmap(namespace: str, name: str):
    """Delete a ConfigMap."""
    try:
        await kubernetes_service.delete_configmap(namespace, name)
        return {"message": f"ConfigMap {namespace}/{name} deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Secret endpoints
@router.get("/secrets", response_model=List[SecretInfo])
async def list_secrets(namespace: Optional[str] = Query(None)):
    """List Secrets, optionally filtered by namespace (keys only, no values)."""
    try:
        return await kubernetes_service.get_secrets(namespace)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/secrets/{namespace}/{name}", response_model=SecretDetail)
async def get_secret(namespace: str, name: str):
    """Get a single secret with decoded data values."""
    try:
        return await kubernetes_service.get_secret(namespace, name)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/secrets", response_model=SecretDetail)
async def create_secret(request: SecretCreateRequest):
    """Create a new secret."""
    try:
        return await kubernetes_service.create_secret(request)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/secrets/{namespace}/{name}", response_model=SecretDetail)
async def update_secret(namespace: str, name: str, request: SecretUpdateRequest):
    """Update an existing secret."""
    try:
        return await kubernetes_service.update_secret(namespace, name, request)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/secrets/{namespace}/{name}")
async def delete_secret(namespace: str, name: str):
    """Delete a secret."""
    try:
        await kubernetes_service.delete_secret(namespace, name)
        return {"message": f"Secret {namespace}/{name} deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# PVC endpoints
@router.get("/pvcs", response_model=List[PVCInfo])
async def list_pvcs(namespace: Optional[str] = Query(None)):
    """List PersistentVolumeClaims, optionally filtered by namespace."""
    try:
        return await kubernetes_service.get_pvcs(namespace)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/pvcs", response_model=PVCInfo)
async def create_pvc(request: PVCCreateRequest):
    """Create a new PersistentVolumeClaim."""
    try:
        return await kubernetes_service.create_pvc(request)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/pvcs/{namespace}/{name}", response_model=PVCInfo)
async def update_pvc(namespace: str, name: str, request: PVCUpdateRequest):
    """Update a PersistentVolumeClaim (e.g., storage expansion)."""
    try:
        return await kubernetes_service.update_pvc(namespace, name, request)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/pvcs/{namespace}/{name}", response_model=ResourceDeleteResponse)
async def delete_pvc(namespace: str, name: str):
    """Delete a PersistentVolumeClaim."""
    try:
        return await kubernetes_service.delete_pvc(namespace, name)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# PV endpoints
@router.get("/pvs", response_model=List[PVInfo])
async def list_pvs():
    """List PersistentVolumes."""
    try:
        return await kubernetes_service.get_pvs()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/pvs", response_model=PVInfo)
async def create_pv(request: PVCreateRequest):
    """Create a new PersistentVolume."""
    try:
        return await kubernetes_service.create_pv(request)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/pvs/{name}", response_model=ResourceDeleteResponse)
async def delete_pv(name: str):
    """Delete a PersistentVolume."""
    try:
        return await kubernetes_service.delete_pv(name)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# StorageClass endpoints
@router.get("/storageclasses", response_model=List[StorageClassInfo])
async def list_storage_classes():
    """List StorageClasses."""
    try:
        return await kubernetes_service.get_storage_classes()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/storageclasses", response_model=StorageClassInfo)
async def create_storage_class(request: StorageClassCreateRequest):
    """Create a new StorageClass."""
    try:
        return await kubernetes_service.create_storage_class(request)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/storageclasses/{name}", response_model=ResourceDeleteResponse)
async def delete_storage_class(name: str):
    """Delete a StorageClass."""
    try:
        return await kubernetes_service.delete_storage_class(name)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# StatefulSet endpoints
@router.get("/statefulsets", response_model=List[StatefulSetInfo])
async def list_statefulsets(namespace: Optional[str] = Query(None)):
    """List StatefulSets, optionally filtered by namespace."""
    try:
        return await kubernetes_service.get_statefulsets(namespace)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/statefulsets/{namespace}/{name}", response_model=StatefulSetInfo)
async def get_statefulset(namespace: str, name: str):
    """Get a specific StatefulSet."""
    try:
        statefulset = await kubernetes_service.get_statefulset(namespace, name)
        if not statefulset:
            raise HTTPException(status_code=404, detail=f"StatefulSet {namespace}/{name} not found")
        return statefulset
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/statefulsets/{namespace}/{name}", response_model=ResourceDeleteResponse)
async def delete_statefulset(namespace: str, name: str):
    """Delete a StatefulSet."""
    try:
        return await kubernetes_service.delete_statefulset(namespace, name)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/statefulsets/{namespace}/{name}/scale")
async def scale_statefulset(namespace: str, name: str, replicas: int = Query(..., ge=0)):
    """Scale a StatefulSet to the specified number of replicas."""
    try:
        return await kubernetes_service.scale_statefulset(namespace, name, replicas)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/statefulsets/{namespace}/{name}/restart")
async def restart_statefulset(namespace: str, name: str):
    """Restart a StatefulSet by updating its pod template."""
    try:
        return await kubernetes_service.restart_statefulset(namespace, name)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# DaemonSet endpoints
@router.get("/daemonsets", response_model=List[DaemonSetInfo])
async def list_daemonsets(namespace: Optional[str] = Query(None)):
    """List DaemonSets, optionally filtered by namespace."""
    try:
        return await kubernetes_service.get_daemonsets(namespace)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/daemonsets/{namespace}/{name}", response_model=DaemonSetInfo)
async def get_daemonset(namespace: str, name: str):
    """Get a specific DaemonSet."""
    try:
        daemonset = await kubernetes_service.get_daemonset(namespace, name)
        if not daemonset:
            raise HTTPException(status_code=404, detail=f"DaemonSet {namespace}/{name} not found")
        return daemonset
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/daemonsets/{namespace}/{name}", response_model=ResourceDeleteResponse)
async def delete_daemonset(namespace: str, name: str):
    """Delete a DaemonSet."""
    try:
        return await kubernetes_service.delete_daemonset(namespace, name)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/daemonsets/{namespace}/{name}/restart")
async def restart_daemonset(namespace: str, name: str):
    """Restart a DaemonSet by updating its pod template."""
    try:
        return await kubernetes_service.restart_daemonset(namespace, name)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Job endpoints
@router.get("/jobs", response_model=List[JobInfo])
async def list_jobs(namespace: Optional[str] = Query(None)):
    """List Jobs, optionally filtered by namespace."""
    try:
        return await kubernetes_service.get_jobs(namespace)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/jobs/{namespace}/{name}", response_model=JobInfo)
async def get_job(namespace: str, name: str):
    """Get a specific Job."""
    try:
        job = await kubernetes_service.get_job(namespace, name)
        if not job:
            raise HTTPException(status_code=404, detail=f"Job {namespace}/{name} not found")
        return job
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/jobs/{namespace}/{name}", response_model=ResourceDeleteResponse)
async def delete_job(namespace: str, name: str):
    """Delete a Job."""
    try:
        return await kubernetes_service.delete_job(namespace, name)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# CronJob endpoints
@router.get("/cronjobs", response_model=List[CronJobInfo])
async def list_cronjobs(namespace: Optional[str] = Query(None)):
    """List CronJobs, optionally filtered by namespace."""
    try:
        return await kubernetes_service.get_cronjobs(namespace)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# HPA endpoints
@router.get("/hpas", response_model=List[HPAInfo])
async def list_hpas(namespace: Optional[str] = Query(None)):
    """List HorizontalPodAutoscalers, optionally filtered by namespace."""
    try:
        return await kubernetes_service.get_hpas(namespace)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# YAML Apply endpoint
@router.post("/apply", response_model=YAMLApplyResponse)
async def apply_yaml(request: YAMLApplyRequest):
    """Apply YAML manifest(s) to the cluster."""
    try:
        return await kubernetes_service.apply_yaml(
            yaml_content=request.yaml_content, namespace=request.namespace, dry_run=request.dry_run
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Kubectl endpoint
@router.post("/kubectl", response_model=KubectlResponse)
async def execute_kubectl(request: KubectlRequest):
    """Execute a kubectl command against the cluster."""
    try:
        return await kubernetes_service.execute_kubectl(command=request.command, timeout=request.timeout)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Shell endpoint
@router.post("/shell", response_model=ShellResponse)
async def execute_shell(request: ShellRequest):
    """Execute a shell command on the backend server."""
    try:
        return await kubernetes_service.execute_shell(
            command=request.command, timeout=request.timeout, working_directory=request.working_directory
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Deployment rollback endpoints
@router.get("/deployments/{namespace}/{deployment_name}/revisions")
async def get_deployment_revisions(namespace: str, deployment_name: str):
    """Get rollout history/revisions of a deployment."""
    try:
        return await kubernetes_service.get_deployment_revisions(namespace, deployment_name)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/deployments/{namespace}/{deployment_name}/rollback")
async def rollback_deployment_to_revision(
    namespace: str,
    deployment_name: str,
    revision: int = Query(..., ge=0, description="Target revision number to rollback to"),
):
    """Rollback a deployment to a specific revision."""
    try:
        result = await kubernetes_service.rollback_deployment_to_revision(
            namespace=namespace, deployment_name=deployment_name, revision=revision
        )
        if not result["success"]:
            raise HTTPException(status_code=400, detail=result.get("error", "Rollback failed"))
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Resource YAML endpoints
@router.post("/resource/yaml", response_model=ResourceYAMLResponse)
async def get_resource_yaml(request: ResourceYAMLRequest):
    """Get the YAML definition of any Kubernetes resource."""
    try:
        return await kubernetes_service.get_resource_yaml(
            kind=request.kind,
            name=request.name,
            namespace=request.namespace
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/resource/yaml")
async def update_resource_yaml(request: YAMLApplyRequest):
    """Update a Kubernetes resource by applying YAML."""
    try:
        return await kubernetes_service.apply_yaml(
            yaml_content=request.yaml_content,
            namespace=request.namespace,
            dry_run=request.dry_run
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
