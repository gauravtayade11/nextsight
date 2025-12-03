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


# Secret
class SecretInfo(BaseModel):
    name: str
    namespace: str
    type: str
    data_keys: List[str] = []  # Only keys, not values for security
    data_count: int = 0
    age: str
    labels: Dict[str, str] = {}


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
