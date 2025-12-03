"""
Kubernetes Event Watcher Service
Automatically monitors K8s cluster for issues and creates incidents
"""

import asyncio
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from kubernetes import client, watch
from kubernetes.client.rest import ApiException

from app.core.config import settings

logger = logging.getLogger(__name__)


# Alert rules - define what K8s events trigger incidents
ALERT_RULES = {
    # Pod-level alerts
    "OOMKilled": {
        "severity": "critical",
        "title_template": "Pod OOMKilled: {pod_name}",
        "description_template": "Pod {pod_name} in namespace {namespace} was killed due to Out of Memory. Container: {container}",
    },
    "CrashLoopBackOff": {
        "severity": "high",
        "title_template": "CrashLoopBackOff: {pod_name}",
        "description_template": "Pod {pod_name} in namespace {namespace} is in CrashLoopBackOff state. Restarts: {restarts}",
    },
    "ImagePullBackOff": {
        "severity": "high",
        "title_template": "Image Pull Failed: {pod_name}",
        "description_template": "Pod {pod_name} in namespace {namespace} cannot pull image. Check image name and registry credentials.",
    },
    "FailedScheduling": {
        "severity": "high",
        "title_template": "Pod Scheduling Failed: {pod_name}",
        "description_template": "Pod {pod_name} cannot be scheduled. Reason: {message}",
    },
    # Node-level alerts
    "NodeNotReady": {
        "severity": "critical",
        "title_template": "Node NotReady: {node_name}",
        "description_template": "Kubernetes node {node_name} is in NotReady state. Pods may be evicted.",
    },
    "NodeMemoryPressure": {
        "severity": "high",
        "title_template": "Node Memory Pressure: {node_name}",
        "description_template": "Node {node_name} is experiencing memory pressure. Consider scaling or optimizing workloads.",
    },
    "NodeDiskPressure": {
        "severity": "high",
        "title_template": "Node Disk Pressure: {node_name}",
        "description_template": "Node {node_name} is experiencing disk pressure. Clean up or expand storage.",
    },
    # Deployment alerts
    "FailedCreate": {
        "severity": "high",
        "title_template": "Failed to Create Pod: {deployment}",
        "description_template": "Deployment {deployment} failed to create pods. Reason: {message}",
    },
    "ProgressDeadlineExceeded": {
        "severity": "critical",
        "title_template": "Deployment Stalled: {deployment}",
        "description_template": "Deployment {deployment} has exceeded progress deadline. Rollout may be stuck.",
    },
}


class K8sWatcherService:
    """Watches Kubernetes for events and creates incidents automatically"""

    def __init__(self):
        self._core_v1 = None
        self._apps_v1 = None
        self._initialized = False
        self._watching = False
        self._incident_callback = None
        self._timeline_callback = None
        self._recent_incidents: Dict[str, datetime] = {}  # Dedup cache
        self._dedup_window_seconds = 300  # 5 minutes

    def _initialize(self):
        if self._initialized:
            return

        try:
            from kubernetes import config

            if settings.K8S_IN_CLUSTER:
                config.load_incluster_config()
            elif settings.K8S_CONFIG_PATH:
                config.load_kube_config(config_file=settings.K8S_CONFIG_PATH)
            else:
                config.load_kube_config()

            self._core_v1 = client.CoreV1Api()
            self._apps_v1 = client.AppsV1Api()
            self._initialized = True
            logger.info("K8s Watcher initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize K8s Watcher: {e}")
            raise

    def set_callbacks(self, incident_callback, timeline_callback):
        """Set callbacks for creating incidents and timeline events"""
        self._incident_callback = incident_callback
        self._timeline_callback = timeline_callback

    def _should_create_incident(self, key: str) -> bool:
        """Check if we should create an incident (deduplication)"""
        now = datetime.now(timezone.utc)

        if key in self._recent_incidents:
            last_created = self._recent_incidents[key]
            if (now - last_created).total_seconds() < self._dedup_window_seconds:
                return False

        self._recent_incidents[key] = now

        # Cleanup old entries
        cutoff = now.timestamp() - self._dedup_window_seconds
        self._recent_incidents = {k: v for k, v in self._recent_incidents.items() if v.timestamp() > cutoff}

        return True

    async def check_pod_issues(self) -> List[Dict[str, Any]]:
        """Scan pods for issues and return detected problems"""
        self._initialize()
        issues = []

        try:
            pods = self._core_v1.list_pod_for_all_namespaces()

            for pod in pods.items:
                pod_name = pod.metadata.name
                namespace = pod.metadata.namespace

                # Skip system namespaces optionally
                if namespace in ["kube-system", "kube-public", "kube-node-lease"]:
                    continue

                # Check container statuses
                if pod.status.container_statuses:
                    for cs in pod.status.container_statuses:
                        # OOMKilled detection
                        if cs.last_state and cs.last_state.terminated:
                            if cs.last_state.terminated.reason == "OOMKilled":
                                issues.append(
                                    {
                                        "type": "OOMKilled",
                                        "pod_name": pod_name,
                                        "namespace": namespace,
                                        "container": cs.name,
                                        "restarts": cs.restart_count,
                                    }
                                )

                        # CrashLoopBackOff detection
                        if cs.state and cs.state.waiting:
                            if cs.state.waiting.reason == "CrashLoopBackOff":
                                issues.append(
                                    {
                                        "type": "CrashLoopBackOff",
                                        "pod_name": pod_name,
                                        "namespace": namespace,
                                        "container": cs.name,
                                        "restarts": cs.restart_count,
                                    }
                                )
                            elif cs.state.waiting.reason == "ImagePullBackOff":
                                issues.append(
                                    {
                                        "type": "ImagePullBackOff",
                                        "pod_name": pod_name,
                                        "namespace": namespace,
                                        "container": cs.name,
                                    }
                                )

                # Check for pending pods (scheduling issues)
                if pod.status.phase == "Pending":
                    if pod.status.conditions:
                        for cond in pod.status.conditions:
                            if cond.type == "PodScheduled" and cond.status == "False":
                                issues.append(
                                    {
                                        "type": "FailedScheduling",
                                        "pod_name": pod_name,
                                        "namespace": namespace,
                                        "message": cond.message or "Unknown scheduling issue",
                                    }
                                )

        except ApiException as e:
            logger.error(f"Error checking pods: {e}")

        return issues

    async def check_node_issues(self) -> List[Dict[str, Any]]:
        """Scan nodes for issues"""
        self._initialize()
        issues = []

        try:
            nodes = self._core_v1.list_node()

            for node in nodes.items:
                node_name = node.metadata.name

                if node.status.conditions:
                    for cond in node.status.conditions:
                        # Node NotReady
                        if cond.type == "Ready" and cond.status != "True":
                            issues.append(
                                {
                                    "type": "NodeNotReady",
                                    "node_name": node_name,
                                    "message": cond.message or "Node is not ready",
                                }
                            )

                        # Memory Pressure
                        if cond.type == "MemoryPressure" and cond.status == "True":
                            issues.append(
                                {
                                    "type": "NodeMemoryPressure",
                                    "node_name": node_name,
                                }
                            )

                        # Disk Pressure
                        if cond.type == "DiskPressure" and cond.status == "True":
                            issues.append(
                                {
                                    "type": "NodeDiskPressure",
                                    "node_name": node_name,
                                }
                            )

        except ApiException as e:
            logger.error(f"Error checking nodes: {e}")

        return issues

    async def check_deployment_issues(self) -> List[Dict[str, Any]]:
        """Scan deployments for issues"""
        self._initialize()
        issues = []

        try:
            deployments = self._apps_v1.list_deployment_for_all_namespaces()

            for dep in deployments.items:
                dep_name = dep.metadata.name
                namespace = dep.metadata.namespace

                # Skip system namespaces
                if namespace in ["kube-system", "kube-public", "kube-node-lease"]:
                    continue

                # Check for unavailable replicas
                if dep.status.unavailable_replicas and dep.status.unavailable_replicas > 0:
                    desired = dep.spec.replicas or 1
                    available = dep.status.available_replicas or 0

                    if available == 0 and desired > 0:
                        issues.append(
                            {
                                "type": "DeploymentUnavailable",
                                "deployment": dep_name,
                                "namespace": namespace,
                                "desired": desired,
                                "available": available,
                                "message": f"Deployment has 0/{desired} available replicas",
                            }
                        )

                # Check conditions for progress deadline
                if dep.status.conditions:
                    for cond in dep.status.conditions:
                        if cond.type == "Progressing" and cond.status == "False":
                            if "ProgressDeadlineExceeded" in (cond.reason or ""):
                                issues.append(
                                    {
                                        "type": "ProgressDeadlineExceeded",
                                        "deployment": dep_name,
                                        "namespace": namespace,
                                        "message": cond.message or "Deployment progress deadline exceeded",
                                    }
                                )

        except ApiException as e:
            logger.error(f"Error checking deployments: {e}")

        return issues

    async def check_recent_events(self, minutes: int = 5) -> List[Dict[str, Any]]:
        """Get recent warning events from K8s"""
        self._initialize()
        issues = []

        try:
            events = self._core_v1.list_event_for_all_namespaces()
            now = datetime.now(timezone.utc)

            for event in events.items:
                # Only warning events
                if event.type != "Warning":
                    continue

                # Check if event is recent
                event_time = event.last_timestamp or event.first_timestamp
                if event_time:
                    if event_time.tzinfo is None:
                        event_time = event_time.replace(tzinfo=timezone.utc)
                    age_minutes = (now - event_time).total_seconds() / 60
                    if age_minutes > minutes:
                        continue

                # Map event reason to issue type
                reason = event.reason or ""
                if reason in ALERT_RULES:
                    issues.append(
                        {
                            "type": reason,
                            "pod_name": event.involved_object.name,
                            "namespace": event.involved_object.namespace or "default",
                            "message": event.message,
                            "count": event.count or 1,
                        }
                    )

        except ApiException as e:
            logger.error(f"Error checking events: {e}")

        return issues

    async def scan_and_create_incidents(self) -> List[Dict[str, Any]]:
        """Full scan of cluster and create incidents for issues found"""
        all_issues = []
        created_incidents = []

        # Gather all issues
        pod_issues = await self.check_pod_issues()
        node_issues = await self.check_node_issues()
        deployment_issues = await self.check_deployment_issues()
        event_issues = await self.check_recent_events()

        all_issues.extend(pod_issues)
        all_issues.extend(node_issues)
        all_issues.extend(deployment_issues)
        all_issues.extend(event_issues)

        # Create incidents for each issue
        for issue in all_issues:
            issue_type = issue.get("type", "Unknown")

            if issue_type not in ALERT_RULES:
                continue

            rule = ALERT_RULES[issue_type]

            # Create dedup key
            dedup_key = f"{issue_type}:{issue.get('namespace', '')}:{issue.get('pod_name', issue.get('node_name', issue.get('deployment', '')))}"

            if not self._should_create_incident(dedup_key):
                continue

            # Format title and description
            title = rule["title_template"].format(**issue)
            description = rule["description_template"].format(**issue)

            incident_data = {
                "title": title,
                "description": description,
                "severity": rule["severity"],
                "source": "kubernetes",
                "source_id": dedup_key,
                "namespace": issue.get("namespace"),
                "affected_services": [issue.get("pod_name", issue.get("deployment", ""))],
                "tags": ["auto-detected", f"k8s-{issue_type.lower()}"],
            }

            created_incidents.append(incident_data)
            logger.info(f"Auto-created incident: {title}")

            # Call incident callback if set
            if self._incident_callback:
                await self._incident_callback(incident_data)

        return created_incidents

    async def start_watching(self, interval_seconds: int = 30):
        """Start continuous monitoring loop"""
        self._watching = True
        logger.info(f"Starting K8s watcher with {interval_seconds}s interval")

        while self._watching:
            try:
                await self.scan_and_create_incidents()
            except Exception as e:
                logger.error(f"Error in watcher loop: {e}")

            await asyncio.sleep(interval_seconds)

    def stop_watching(self):
        """Stop the monitoring loop"""
        self._watching = False
        logger.info("Stopping K8s watcher")


# Singleton instance
k8s_watcher_service = K8sWatcherService()
