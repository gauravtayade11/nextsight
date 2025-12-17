from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class PodPhase(str, Enum):
    PENDING = "Pending"
    RUNNING = "Running"
    SUCCEEDED = "Succeeded"
    FAILED = "Failed"
    UNKNOWN = "Unknown"


class ResourceType(str, Enum):
    POD = "pod"
    DEPLOYMENT = "deployment"
    SERVICE = "service"
    CONFIGMAP = "configmap"
    SECRET = "secret"
    INGRESS = "ingress"
    NAMESPACE = "namespace"


class NamespaceInfo(BaseModel):
    name: str
    status: str
    created_at: Optional[datetime] = None
    labels: Dict[str, str] = {}


class NamespaceDetail(BaseModel):
    """Namespace with resource counts."""
    name: str
    status: str
    created_at: Optional[datetime] = None
    labels: Dict[str, str] = {}
    age: str = ""
    pods: int = 0
    deployments: int = 0
    services: int = 0
    configmaps: int = 0
    secrets: int = 0


class NamespaceCreateRequest(BaseModel):
    """Request to create a new namespace."""
    name: str
    labels: Dict[str, str] = {}


class PodInfo(BaseModel):
    name: str
    namespace: str
    status: PodPhase
    ready: bool
    restarts: int = 0
    age: str
    node: Optional[str] = None
    ip: Optional[str] = None
    containers: List[str] = []


class DeploymentInfo(BaseModel):
    name: str
    namespace: str
    replicas: int
    ready_replicas: int
    available_replicas: int
    image: Optional[str] = None
    age: str
    labels: Dict[str, str] = {}


class ServiceInfo(BaseModel):
    name: str
    namespace: str
    type: str
    cluster_ip: Optional[str] = None
    external_ip: Optional[str] = None
    ports: List[Dict[str, Any]] = []


class K8sEvent(BaseModel):
    name: str
    namespace: str
    type: str
    reason: str
    message: str
    count: int
    first_timestamp: Optional[datetime] = None
    last_timestamp: Optional[datetime] = None
    involved_object: Dict[str, str] = {}


class ScaleRequest(BaseModel):
    namespace: str
    deployment_name: str
    replicas: int = Field(..., ge=0, le=100)


class RestartRequest(BaseModel):
    namespace: str
    deployment_name: str


class K8sClusterHealth(BaseModel):
    healthy: bool
    node_count: int
    ready_nodes: int
    total_pods: int
    running_pods: int
    namespaces: int
    warnings: List[str] = []


# Node Info
class NodeCondition(BaseModel):
    type: str
    status: str
    reason: Optional[str] = None
    message: Optional[str] = None


class NodeResources(BaseModel):
    cpu: str
    memory: str
    pods: str
    storage: Optional[str] = None


class NodeInfo(BaseModel):
    name: str
    status: str
    roles: List[str] = []
    age: str
    version: str
    os_image: str
    kernel_version: str
    container_runtime: str
    internal_ip: Optional[str] = None
    external_ip: Optional[str] = None
    conditions: List[NodeCondition] = []
    capacity: NodeResources
    allocatable: NodeResources
    labels: Dict[str, str] = {}
    taints: List[Dict[str, str]] = []


# Resource Metrics
class ContainerMetrics(BaseModel):
    name: str
    cpu_usage: str  # e.g., "100m" (millicores)
    cpu_percent: float
    memory_usage: str  # e.g., "256Mi"
    memory_percent: float


class PodMetrics(BaseModel):
    name: str
    namespace: str
    containers: List[ContainerMetrics]
    total_cpu: str
    total_memory: str
    timestamp: datetime


class NodeMetrics(BaseModel):
    name: str
    cpu_usage: str
    cpu_percent: float
    memory_usage: str
    memory_percent: float
    timestamp: datetime


class ClusterMetrics(BaseModel):
    total_cpu_capacity: str
    total_cpu_usage: str
    cpu_percent: float
    total_memory_capacity: str
    total_memory_usage: str
    memory_percent: float
    nodes: List[NodeMetrics]
    timestamp: datetime


# Pod Logs
class PodLogRequest(BaseModel):
    namespace: str
    pod_name: str
    container: Optional[str] = None
    tail_lines: int = Field(default=100, ge=1, le=5000)
    since_seconds: Optional[int] = Field(default=None, ge=1)
    timestamps: bool = False
    previous: bool = False


class PodLogResponse(BaseModel):
    namespace: str
    pod_name: str
    container: str
    logs: str
    truncated: bool = False


# Pod Exec
class PodExecRequest(BaseModel):
    namespace: str
    pod_name: str
    container: Optional[str] = None
    command: List[str]


class PodExecResponse(BaseModel):
    namespace: str
    pod_name: str
    container: str
    command: List[str]
    stdout: str
    stderr: str
    exit_code: int


# Ingress
class IngressRule(BaseModel):
    host: Optional[str] = None
    paths: List[Dict[str, Any]] = []


class IngressInfo(BaseModel):
    name: str
    namespace: str
    class_name: Optional[str] = None
    hosts: List[str] = []
    address: Optional[str] = None
    rules: List[IngressRule] = []
    tls: List[Dict[str, Any]] = []
    age: str
    labels: Dict[str, str] = {}
    annotations: Dict[str, str] = {}


# ConfigMap
class ConfigMapInfo(BaseModel):
    name: str
    namespace: str
    data_keys: List[str] = []  # Only keys, not values
    data_count: int = 0
    age: str
    labels: Dict[str, str] = {}


class ConfigMapDetail(BaseModel):
    """ConfigMap with full data values for viewing/editing."""
    name: str
    namespace: str
    data: Dict[str, str] = {}
    binary_data_keys: List[str] = []  # Keys of binary data (values not exposed)
    labels: Dict[str, str] = {}
    annotations: Dict[str, str] = {}
    created_at: Optional[str] = None


class ConfigMapCreateRequest(BaseModel):
    """Request to create a new ConfigMap."""
    name: str
    namespace: str
    data: Dict[str, str] = {}
    labels: Dict[str, str] = {}


class ConfigMapUpdateRequest(BaseModel):
    """Request to update an existing ConfigMap."""
    data: Dict[str, str] = {}
    labels: Optional[Dict[str, str]] = None


# Secret
class SecretInfo(BaseModel):
    name: str
    namespace: str
    type: str
    data_keys: List[str] = []  # Only keys, not values for security
    data_count: int = 0
    age: str
    labels: Dict[str, str] = {}


class SecretDetail(BaseModel):
    """Secret with decoded data values for viewing/editing."""
    name: str
    namespace: str
    type: str
    data: Dict[str, str] = {}  # Decoded string values
    labels: Dict[str, str] = {}
    annotations: Dict[str, str] = {}
    created_at: Optional[str] = None


class SecretCreateRequest(BaseModel):
    """Request to create a new secret."""
    name: str
    namespace: str
    type: str = "Opaque"
    data: Dict[str, str] = {}  # Plain text values, will be base64 encoded
    labels: Dict[str, str] = {}


class SecretUpdateRequest(BaseModel):
    """Request to update an existing secret."""
    data: Dict[str, str] = {}  # Plain text values, will be base64 encoded
    labels: Optional[Dict[str, str]] = None


# PersistentVolumeClaim
class PVCInfo(BaseModel):
    name: str
    namespace: str
    status: str
    volume: Optional[str] = None
    capacity: Optional[str] = None
    access_modes: List[str] = []
    storage_class: Optional[str] = None
    age: str
    labels: Dict[str, str] = {}


# StatefulSet
class StatefulSetInfo(BaseModel):
    name: str
    namespace: str
    replicas: int
    ready_replicas: int
    current_replicas: int
    image: Optional[str] = None
    service_name: Optional[str] = None
    age: str
    labels: Dict[str, str] = {}


# DaemonSet
class DaemonSetInfo(BaseModel):
    name: str
    namespace: str
    desired: int
    current: int
    ready: int
    available: int
    node_selector: Dict[str, str] = {}
    image: Optional[str] = None
    age: str
    labels: Dict[str, str] = {}


# Job
class JobInfo(BaseModel):
    name: str
    namespace: str
    completions: Optional[int] = None
    succeeded: int = 0
    failed: int = 0
    active: int = 0
    duration: Optional[str] = None
    age: str
    labels: Dict[str, str] = {}


# CronJob
class CronJobInfo(BaseModel):
    name: str
    namespace: str
    schedule: str
    suspend: bool = False
    active: int = 0
    last_schedule: Optional[datetime] = None
    age: str
    labels: Dict[str, str] = {}


# HPA
class HPAInfo(BaseModel):
    name: str
    namespace: str
    reference: str  # e.g., "Deployment/my-app"
    min_replicas: int
    max_replicas: int
    current_replicas: int
    target_cpu: Optional[str] = None
    current_cpu: Optional[str] = None
    target_memory: Optional[str] = None
    current_memory: Optional[str] = None
    age: str


# YAML Apply
class YAMLApplyRequest(BaseModel):
    yaml_content: str = Field(..., description="YAML manifest content to apply")
    namespace: Optional[str] = Field(None, description="Target namespace (overrides namespace in manifest)")
    dry_run: bool = Field(False, description="If true, only validate without applying")


class AppliedResourceInfo(BaseModel):
    kind: str
    name: str
    namespace: Optional[str] = None
    action: str  # created, configured, unchanged
    message: Optional[str] = None


class YAMLApplyResponse(BaseModel):
    success: bool
    message: str
    resources: List[AppliedResourceInfo] = []
    errors: List[str] = []
    dry_run: bool = False


# Kubectl Exec
class KubectlRequest(BaseModel):
    command: str = Field(..., description="kubectl command to execute (without 'kubectl' prefix)")
    timeout: int = Field(30, ge=1, le=300, description="Command timeout in seconds")


class KubectlResponse(BaseModel):
    success: bool
    command: str
    stdout: str
    stderr: str
    exit_code: int
    execution_time: float


# Shell Execution (Full Terminal)
class ShellRequest(BaseModel):
    command: str = Field(..., description="Shell command to execute")
    timeout: int = Field(30, ge=1, le=300, description="Command timeout in seconds")
    working_directory: Optional[str] = Field(None, description="Working directory for command execution")


class ShellResponse(BaseModel):
    success: bool
    command: str
    stdout: str
    stderr: str
    exit_code: int
    execution_time: float
    working_directory: str


# Resource YAML
class ResourceYAMLRequest(BaseModel):
    """Request to get resource YAML."""
    kind: str = Field(..., description="Resource kind (e.g., Deployment, Service, Pod)")
    name: str = Field(..., description="Resource name")
    namespace: Optional[str] = Field(None, description="Namespace (required for namespaced resources)")


class ResourceYAMLResponse(BaseModel):
    """Response containing resource YAML."""
    success: bool
    kind: str
    name: str
    namespace: Optional[str] = None
    yaml_content: str = ""
    error: Optional[str] = None


# Service CRUD
class ServicePort(BaseModel):
    """Service port definition."""
    name: Optional[str] = None
    port: int = Field(..., ge=1, le=65535)
    target_port: int = Field(..., ge=1, le=65535)
    protocol: str = "TCP"
    node_port: Optional[int] = Field(None, ge=30000, le=32767)


class ServiceCreateRequest(BaseModel):
    """Request to create a new Kubernetes Service."""
    name: str = Field(..., min_length=1, max_length=253)
    namespace: str = Field(..., min_length=1)
    type: str = Field(default="ClusterIP", description="ClusterIP, NodePort, LoadBalancer, or ExternalName")
    selector: Dict[str, str] = Field(default={}, description="Pod selector labels")
    ports: List[ServicePort] = Field(default=[], description="Service ports")
    labels: Dict[str, str] = {}
    annotations: Dict[str, str] = {}


class ServiceUpdateRequest(BaseModel):
    """Request to update an existing Kubernetes Service."""
    type: Optional[str] = None
    selector: Optional[Dict[str, str]] = None
    ports: Optional[List[ServicePort]] = None
    labels: Optional[Dict[str, str]] = None
    annotations: Optional[Dict[str, str]] = None


# Ingress CRUD
class IngressPath(BaseModel):
    """Ingress path definition."""
    path: str = "/"
    path_type: str = "Prefix"  # Exact, Prefix, ImplementationSpecific
    service_name: str
    service_port: int


class IngressRuleSpec(BaseModel):
    """Ingress rule definition."""
    host: Optional[str] = None
    paths: List[IngressPath] = []


class IngressTLSSpec(BaseModel):
    """Ingress TLS definition."""
    hosts: List[str] = []
    secret_name: Optional[str] = None


class IngressCreateRequest(BaseModel):
    """Request to create a new Kubernetes Ingress."""
    name: str = Field(..., min_length=1, max_length=253)
    namespace: str = Field(..., min_length=1)
    ingress_class_name: Optional[str] = None
    rules: List[IngressRuleSpec] = []
    tls: List[IngressTLSSpec] = []
    labels: Dict[str, str] = {}
    annotations: Dict[str, str] = {}


class IngressUpdateRequest(BaseModel):
    """Request to update an existing Kubernetes Ingress."""
    ingress_class_name: Optional[str] = None
    rules: Optional[List[IngressRuleSpec]] = None
    tls: Optional[List[IngressTLSSpec]] = None
    labels: Optional[Dict[str, str]] = None
    annotations: Optional[Dict[str, str]] = None


class ResourceDeleteResponse(BaseModel):
    """Response for resource deletion."""
    success: bool
    message: str
    kind: str
    name: str
    namespace: str


# PersistentVolume
class PVInfo(BaseModel):
    """PersistentVolume information."""
    name: str
    capacity: str
    access_modes: List[str] = []
    reclaim_policy: str
    status: str
    claim: Optional[str] = None
    storage_class: Optional[str] = None
    volume_mode: Optional[str] = None
    age: str
    labels: Dict[str, str] = {}


# StorageClass
class StorageClassInfo(BaseModel):
    """StorageClass information."""
    name: str
    provisioner: str
    reclaim_policy: str
    volume_binding_mode: str
    allow_volume_expansion: bool = False
    is_default: bool = False
    parameters: Dict[str, str] = {}
    age: str


# PVC CRUD
class PVCCreateRequest(BaseModel):
    """Request to create a PersistentVolumeClaim."""
    name: str = Field(..., min_length=1, max_length=253)
    namespace: str = Field(..., min_length=1)
    storage_class_name: Optional[str] = None
    access_modes: List[str] = Field(default=["ReadWriteOnce"])
    storage: str = Field(..., description="Storage size e.g., '10Gi'")
    volume_mode: str = Field(default="Filesystem", description="Filesystem or Block")
    labels: Dict[str, str] = {}
    annotations: Dict[str, str] = {}


class PVCUpdateRequest(BaseModel):
    """Request to update PVC (only storage expansion if supported)."""
    storage: Optional[str] = None  # New size for expansion
    labels: Optional[Dict[str, str]] = None
    annotations: Optional[Dict[str, str]] = None


# StorageClass CRUD
class StorageClassParameter(BaseModel):
    """Storage class parameter."""
    key: str
    value: str


class StorageClassCreateRequest(BaseModel):
    """Request to create a StorageClass."""
    name: str = Field(..., min_length=1, max_length=253)
    provisioner: str = Field(..., description="e.g., kubernetes.io/gce-pd, ebs.csi.aws.com")
    reclaim_policy: str = Field(default="Delete", description="Delete or Retain")
    volume_binding_mode: str = Field(default="WaitForFirstConsumer", description="Immediate or WaitForFirstConsumer")
    allow_volume_expansion: bool = False
    is_default: bool = False
    parameters: Dict[str, str] = {}
    mount_options: List[str] = []


class StorageClassUpdateRequest(BaseModel):
    """Request to update StorageClass (limited updates allowed by K8s)."""
    allow_volume_expansion: Optional[bool] = None
    is_default: Optional[bool] = None
    parameters: Optional[Dict[str, str]] = None


# PV CRUD
class PVCreateRequest(BaseModel):
    """Request to create a PersistentVolume."""
    name: str = Field(..., min_length=1, max_length=253)
    capacity: str = Field(..., description="Storage size e.g., '100Gi'")
    access_modes: List[str] = Field(default=["ReadWriteOnce"])
    reclaim_policy: str = Field(default="Retain", description="Delete, Retain, or Recycle")
    storage_class_name: Optional[str] = None
    volume_mode: str = Field(default="Filesystem")
    host_path: Optional[str] = None  # For local volumes
    nfs_server: Optional[str] = None  # For NFS volumes
    nfs_path: Optional[str] = None
    labels: Dict[str, str] = {}
    annotations: Dict[str, str] = {}
