"""
ArgoCD service for managing GitOps deployments.
Communicates with ArgoCD server via REST API.
"""

import logging
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

import httpx
from fastapi import HTTPException

from app.schemas.argocd import (
    Application,
    ApplicationDestination,
    ApplicationEvent,
    ApplicationEventsResponse,
    ApplicationListResponse,
    ApplicationSource,
    ApplicationSpec,
    ApplicationStatus,
    ApplicationSummary,
    ArgoCDConfig,
    ArgoCDStatus,
    CreateApplicationRequest,
    HealthInfo,
    HealthStatus,
    OperationPhase,
    OperationState,
    ProjectListResponse,
    ProjectSummary,
    RevisionHistory,
    RevisionHistoryResponse,
    RollbackRequest,
    SyncInfo,
    SyncRequest,
    SyncResult,
    SyncStatus,
    ResourceStatus,
)

logger = logging.getLogger(__name__)


class ArgoCDService:
    """Service for managing ArgoCD applications and deployments."""

    def __init__(
        self,
        server_url: str,
        token: Optional[str] = None,
        username: Optional[str] = None,
        password: Optional[str] = None,
        insecure: bool = False,
    ):
        """
        Initialize ArgoCD service.

        Args:
            server_url: ArgoCD server URL (e.g., https://argocd.example.com)
            token: ArgoCD API token for authentication
            username: Username for basic auth (alternative to token)
            password: Password for basic auth (alternative to token)
            insecure: Skip TLS verification
        """
        self.server_url = server_url.rstrip("/")
        self.token = token
        self.username = username
        self.password = password
        self.insecure = insecure
        self._session_token: Optional[str] = None

    def _get_headers(self) -> Dict[str, str]:
        """Get headers for API requests."""
        headers = {
            "Content-Type": "application/json",
        }
        token = self._session_token or self.token
        if token:
            headers["Authorization"] = f"Bearer {token}"
        return headers

    async def _ensure_authenticated(self) -> bool:
        """
        Ensure we have a valid session token.
        Returns True if authenticated, False otherwise.
        """
        # If we already have a session token, assume it's valid
        if self._session_token:
            return True

        # If we have a token provided, use it
        if self.token:
            return True

        # Authenticate with username/password
        if self.username and self.password:
            success, _ = await self.authenticate()
            return success

        return False

    async def _make_request(
        self,
        method: str,
        endpoint: str,
        data: Optional[Dict[str, Any]] = None,
        params: Optional[Dict[str, Any]] = None,
        timeout: int = 30,
    ) -> Tuple[bool, Optional[Dict[str, Any]], str]:
        """
        Make HTTP request to ArgoCD API.

        Returns:
            Tuple of (success, response_data, error_message)
        """
        # Validate endpoint to prevent SSRF
        if any(proto in endpoint.lower() for proto in ['http://', 'https://', '//']):
            raise HTTPException(status_code=400, detail="Endpoint cannot contain absolute URLs")

        # If endpoint starts with api/, use it as-is, otherwise prepend /api/v1/
        endpoint = endpoint.lstrip('/')
        if endpoint.startswith('api/'):
            url = f"{self.server_url}/{endpoint}"
        else:
            url = f"{self.server_url}/api/v1/{endpoint}"

        try:
            async with httpx.AsyncClient(verify=not self.insecure) as client:
                response = await client.request(
                    method=method,
                    url=url,
                    headers=self._get_headers(),
                    json=data,
                    params=params,
                    timeout=timeout,
                )

                if response.status_code == 401:
                    return False, None, "Authentication failed. Please check your credentials."

                if response.status_code == 403:
                    return False, None, "Access denied. Insufficient permissions."

                if response.status_code == 404:
                    return False, None, "Resource not found."

                if response.status_code >= 400:
                    error_msg = response.text
                    try:
                        error_data = response.json()
                        error_msg = error_data.get("message", error_msg)
                    except Exception:
                        pass
                    return False, None, f"Request failed: {error_msg}"

                try:
                    return True, response.json(), ""
                except Exception:
                    return True, None, ""

        except httpx.ConnectError:
            return False, None, f"Failed to connect to ArgoCD server at {self.server_url}"
        except httpx.TimeoutException:
            return False, None, f"Request timed out after {timeout} seconds"
        except Exception as e:
            logger.error(f"ArgoCD API request failed: {e}")
            return False, None, str(e)

    async def authenticate(self) -> Tuple[bool, str]:
        """
        Authenticate with ArgoCD server using username/password.

        Returns:
            Tuple of (success, message)
        """
        if self.token:
            # Token already provided, verify it works
            success, _, error = await self._make_request("GET", "session/userinfo")
            if success:
                return True, "Token authentication successful"
            return False, error

        if not self.username or not self.password:
            return False, "No credentials provided. Please provide either token or username/password."

        try:
            async with httpx.AsyncClient(verify=not self.insecure) as client:
                response = await client.post(
                    f"{self.server_url}/api/v1/session",
                    json={"username": self.username, "password": self.password},
                    timeout=30,
                )

                if response.status_code == 200:
                    data = response.json()
                    self._session_token = data.get("token")
                    return True, "Authentication successful"
                else:
                    return False, "Invalid username or password"

        except Exception as e:
            logger.error(f"Authentication failed: {e}")
            return False, str(e)

    async def check_connection(self) -> ArgoCDStatus:
        """
        Check connection to ArgoCD server.

        Returns:
            ArgoCDStatus with connection info
        """
        try:
            success, data, error = await self._make_request("GET", "api/version")

            if success and data:
                return ArgoCDStatus(
                    connected=True,
                    server_url=self.server_url,
                    version=data.get("Version", "unknown"),
                    message="Connected successfully",
                )

            return ArgoCDStatus(
                connected=False,
                server_url=self.server_url,
                message=error or "Connection failed",
            )

        except Exception as e:
            return ArgoCDStatus(
                connected=False,
                server_url=self.server_url,
                message=str(e),
            )

    async def list_applications(
        self,
        project: Optional[str] = None,
        selector: Optional[str] = None,
    ) -> ApplicationListResponse:
        """
        List all applications.

        Args:
            project: Filter by project name
            selector: Label selector for filtering

        Returns:
            ApplicationListResponse with list of applications
        """
        # Ensure we're authenticated
        if not await self._ensure_authenticated():
            logger.error("Failed to authenticate with ArgoCD")
            return ApplicationListResponse(applications=[], total=0)

        params = {}
        if project:
            params["project"] = project
        if selector:
            params["selector"] = selector

        success, data, error = await self._make_request(
            "GET", "applications", params=params
        )

        if not success or not data:
            logger.error(f"Failed to list applications: {error}")
            return ApplicationListResponse(applications=[], total=0)

        applications: List[ApplicationSummary] = []
        items = data.get("items", []) or []

        for item in items:
            try:
                metadata = item.get("metadata", {})
                spec = item.get("spec", {})
                status = item.get("status", {})
                source = spec.get("source", {})
                destination = spec.get("destination", {})
                health = status.get("health", {})
                sync = status.get("sync", {})

                app_summary = ApplicationSummary(
                    name=metadata.get("name", ""),
                    namespace=metadata.get("namespace", "argocd"),
                    project=spec.get("project", "default"),
                    repoURL=source.get("repoURL", ""),
                    path=source.get("path"),
                    targetRevision=source.get("targetRevision", "HEAD"),
                    destServer=destination.get("server", ""),
                    destNamespace=destination.get("namespace", ""),
                    healthStatus=HealthStatus(health.get("status", "Unknown")),
                    syncStatus=SyncStatus(sync.get("status", "Unknown")),
                    syncRevision=sync.get("revision"),
                    createdAt=metadata.get("creationTimestamp"),
                )
                applications.append(app_summary)
            except Exception as e:
                logger.warning(f"Failed to parse application: {e}")
                continue

        return ApplicationListResponse(
            applications=applications,
            total=len(applications),
        )

    async def get_application(self, name: str) -> Optional[Application]:
        """
        Get detailed application information.

        Args:
            name: Application name

        Returns:
            Application details or None if not found
        """
        # Ensure we're authenticated
        if not await self._ensure_authenticated():
            logger.error("Failed to authenticate with ArgoCD")
            return None

        success, data, error = await self._make_request(
            "GET", f"applications/{name}"
        )

        if not success or not data:
            logger.error(f"Failed to get application {name}: {error}")
            return None

        try:
            return self._parse_application(data)
        except Exception as e:
            logger.error(f"Failed to parse application {name}: {e}")
            return None

    def _parse_application(self, data: Dict[str, Any]) -> Application:
        """Parse application data from API response."""
        metadata = data.get("metadata", {})
        spec = data.get("spec", {})
        status = data.get("status", {})
        source = spec.get("source", {})
        destination = spec.get("destination", {})

        # Parse health status
        health_data = status.get("health", {})
        health_info = HealthInfo(
            status=HealthStatus(health_data.get("status", "Unknown")),
            message=health_data.get("message"),
        )

        # Parse sync status
        sync_data = status.get("sync", {})
        sync_info = SyncInfo(
            status=SyncStatus(sync_data.get("status", "Unknown")),
            revision=sync_data.get("revision"),
            comparedTo=sync_data.get("comparedTo"),
        )

        # Parse operation state
        operation_state = None
        if "operationState" in status:
            op_data = status["operationState"]
            operation_state = OperationState(
                phase=OperationPhase(op_data.get("phase", "Running")),
                message=op_data.get("message"),
                startedAt=op_data.get("startedAt"),
                finishedAt=op_data.get("finishedAt"),
                syncResult=op_data.get("syncResult"),
            )

        # Parse resources
        resources: List[ResourceStatus] = []
        for res in status.get("resources", []) or []:
            try:
                resources.append(ResourceStatus(
                    group=res.get("group"),
                    version=res.get("version", ""),
                    kind=res.get("kind", ""),
                    namespace=res.get("namespace"),
                    name=res.get("name", ""),
                    status=res.get("status"),
                    health=HealthStatus(res["health"]["status"]) if res.get("health") else None,
                    hook=res.get("hook"),
                    requiresPruning=res.get("requiresPruning", False),
                ))
            except Exception as e:
                logger.warning(f"Failed to parse resource: {e}")

        # Build application spec
        app_source = ApplicationSource(
            repoURL=source.get("repoURL", ""),
            path=source.get("path"),
            targetRevision=source.get("targetRevision", "HEAD"),
            chart=source.get("chart"),
            helm=source.get("helm"),
            kustomize=source.get("kustomize"),
            directory=source.get("directory"),
        )

        app_destination = ApplicationDestination(
            server=destination.get("server", ""),
            namespace=destination.get("namespace", ""),
            name=destination.get("name"),
        )

        sync_policy = None
        if "syncPolicy" in spec:
            from app.schemas.argocd import SyncPolicy
            sp = spec["syncPolicy"]
            sync_policy = SyncPolicy(
                automated=sp.get("automated"),
                syncOptions=sp.get("syncOptions"),
                retry=sp.get("retry"),
            )

        app_spec = ApplicationSpec(
            source=app_source,
            destination=app_destination,
            project=spec.get("project", "default"),
            syncPolicy=sync_policy,
        )

        app_status = ApplicationStatus(
            health=health_info,
            sync=sync_info,
            operationState=operation_state,
            resources=resources,
            summary=status.get("summary"),
            conditions=status.get("conditions"),
        )

        return Application(
            name=metadata.get("name", ""),
            namespace=metadata.get("namespace", "argocd"),
            project=spec.get("project", "default"),
            spec=app_spec,
            status=app_status,
            createdAt=metadata.get("creationTimestamp"),
        )

    async def create_application(
        self, request: CreateApplicationRequest
    ) -> Tuple[bool, Optional[Application], str]:
        """
        Create a new ArgoCD application.

        Args:
            request: Application creation request

        Returns:
            Tuple of (success, application, error_message)
        """
        # Ensure we're authenticated
        if not await self._ensure_authenticated():
            return False, None, "Authentication failed. Please check your credentials."

        # Build sync policy
        sync_policy = None
        if request.auto_sync:
            sync_policy = {
                "automated": {
                    "selfHeal": request.self_heal,
                    "prune": request.prune,
                }
            }

        # Build source
        source: Dict[str, Any] = {
            "repoURL": request.repo_url,
            "targetRevision": request.target_revision,
        }
        if request.path:
            source["path"] = request.path
        if request.chart:
            source["chart"] = request.chart
        if request.helm_values:
            source["helm"] = {"values": request.helm_values}

        # Build application manifest
        app_manifest = {
            "metadata": {
                "name": request.name,
            },
            "spec": {
                "project": request.project,
                "source": source,
                "destination": {
                    "server": request.dest_server,
                    "namespace": request.dest_namespace,
                },
            },
        }

        if sync_policy:
            app_manifest["spec"]["syncPolicy"] = sync_policy

        success, data, error = await self._make_request(
            "POST", "applications", data=app_manifest
        )

        if not success:
            return False, None, error

        try:
            app = self._parse_application(data)
            return True, app, ""
        except Exception as e:
            logger.error(f"Failed to parse created application: {e}")
            return True, None, ""

    async def delete_application(
        self, name: str, cascade: bool = True
    ) -> Tuple[bool, str]:
        """
        Delete an ArgoCD application.

        Args:
            name: Application name
            cascade: Delete application resources (default True)

        Returns:
            Tuple of (success, message)
        """
        params = {"cascade": str(cascade).lower()}
        success, _, error = await self._make_request(
            "DELETE", f"applications/{name}", params=params
        )

        if success:
            return True, f"Application '{name}' deleted successfully"
        return False, error

    async def sync_application(
        self, name: str, request: Optional[SyncRequest] = None
    ) -> SyncResult:
        """
        Sync an application.

        Args:
            name: Application name
            request: Sync options

        Returns:
            SyncResult with operation outcome
        """
        sync_data: Dict[str, Any] = {}

        if request:
            if request.revision:
                sync_data["revision"] = request.revision
            if request.dry_run:
                sync_data["dryRun"] = True
            if request.prune:
                sync_data["prune"] = True
            if request.force:
                sync_data["strategy"] = {"hook": {"force": True}}
            if request.resources:
                sync_data["resources"] = request.resources

        success, data, error = await self._make_request(
            "POST", f"applications/{name}/sync", data=sync_data
        )

        if not success:
            return SyncResult(
                success=False,
                message=error,
                resources=[],
            )

        # Parse resources from sync result
        resources: List[ResourceStatus] = []
        if data and "operationState" in data:
            sync_result = data["operationState"].get("syncResult", {})
            for res in sync_result.get("resources", []) or []:
                try:
                    resources.append(ResourceStatus(
                        group=res.get("group"),
                        version=res.get("version", ""),
                        kind=res.get("kind", ""),
                        namespace=res.get("namespace"),
                        name=res.get("name", ""),
                        status=res.get("status"),
                    ))
                except Exception:
                    pass

        return SyncResult(
            success=True,
            message="Sync initiated successfully",
            revision=sync_data.get("revision"),
            resources=resources,
        )

    async def refresh_application(self, name: str) -> Tuple[bool, str]:
        """
        Refresh application to get latest status from Git.

        Args:
            name: Application name

        Returns:
            Tuple of (success, message)
        """
        success, _, error = await self._make_request(
            "GET", f"applications/{name}", params={"refresh": "true"}
        )

        if success:
            return True, f"Application '{name}' refreshed successfully"
        return False, error

    async def get_application_history(
        self, name: str
    ) -> RevisionHistoryResponse:
        """
        Get application revision history.

        Args:
            name: Application name

        Returns:
            RevisionHistoryResponse with history entries
        """
        success, data, error = await self._make_request(
            "GET", f"applications/{name}"
        )

        if not success or not data:
            logger.error(f"Failed to get application history: {error}")
            return RevisionHistoryResponse(history=[])

        history: List[RevisionHistory] = []
        status = data.get("status", {})

        for entry in status.get("history", []) or []:
            try:
                source_data = entry.get("source", {})
                source = ApplicationSource(
                    repoURL=source_data.get("repoURL", ""),
                    path=source_data.get("path"),
                    targetRevision=source_data.get("targetRevision", "HEAD"),
                    chart=source_data.get("chart"),
                )

                history.append(RevisionHistory(
                    id=entry.get("id", 0),
                    revision=entry.get("revision", ""),
                    deployedAt=entry.get("deployedAt"),
                    source=source,
                    deployStartedAt=entry.get("deployStartedAt"),
                ))
            except Exception as e:
                logger.warning(f"Failed to parse history entry: {e}")

        return RevisionHistoryResponse(history=history)

    async def rollback_application(
        self, name: str, request: RollbackRequest
    ) -> Tuple[bool, str]:
        """
        Rollback application to a previous revision.

        Args:
            name: Application name
            request: Rollback options

        Returns:
            Tuple of (success, message)
        """
        rollback_data = {
            "id": request.id,
            "dryRun": request.dry_run,
            "prune": request.prune,
        }

        success, _, error = await self._make_request(
            "POST", f"applications/{name}/rollback", data=rollback_data
        )

        if success:
            return True, f"Rollback to revision {request.id} initiated"
        return False, error

    async def get_application_events(
        self, name: str
    ) -> ApplicationEventsResponse:
        """
        Get application events.

        Args:
            name: Application name

        Returns:
            ApplicationEventsResponse with events
        """
        success, data, error = await self._make_request(
            "GET", f"applications/{name}/events"
        )

        if not success or not data:
            logger.error(f"Failed to get application events: {error}")
            return ApplicationEventsResponse(events=[])

        events: List[ApplicationEvent] = []
        for item in data.get("items", []) or []:
            try:
                events.append(ApplicationEvent(
                    type=item.get("type", ""),
                    reason=item.get("reason", ""),
                    message=item.get("message", ""),
                    firstTimestamp=item.get("firstTimestamp"),
                    lastTimestamp=item.get("lastTimestamp"),
                    count=item.get("count", 1),
                ))
            except Exception as e:
                logger.warning(f"Failed to parse event: {e}")

        return ApplicationEventsResponse(events=events)

    async def get_application_resource_tree(
        self, name: str
    ) -> Optional[Dict[str, Any]]:
        """
        Get application resource tree.

        Args:
            name: Application name

        Returns:
            Resource tree data
        """
        success, data, error = await self._make_request(
            "GET", f"applications/{name}/resource-tree"
        )

        if not success:
            logger.error(f"Failed to get resource tree: {error}")
            return None

        return data

    async def list_projects(self) -> ProjectListResponse:
        """
        List all ArgoCD projects.

        Returns:
            ProjectListResponse with project list
        """
        # Ensure we're authenticated
        if not await self._ensure_authenticated():
            logger.error("Failed to authenticate with ArgoCD")
            return ProjectListResponse(projects=[])

        success, data, error = await self._make_request("GET", "projects")

        if not success or not data:
            logger.error(f"Failed to list projects: {error}")
            return ProjectListResponse(projects=[])

        projects: List[ProjectSummary] = []
        for item in data.get("items", []) or []:
            try:
                metadata = item.get("metadata", {})
                spec = item.get("spec", {})

                # Parse destinations
                destinations = []
                for dest in spec.get("destinations", []) or []:
                    destinations.append({
                        "server": dest.get("server", "*"),
                        "namespace": dest.get("namespace", "*"),
                    })

                projects.append(ProjectSummary(
                    name=metadata.get("name", ""),
                    description=spec.get("description"),
                    sourceRepos=spec.get("sourceRepos", []),
                    destinations=destinations,
                ))
            except Exception as e:
                logger.warning(f"Failed to parse project: {e}")

        return ProjectListResponse(projects=projects)

    async def terminate_operation(self, name: str) -> Tuple[bool, str]:
        """
        Terminate a running operation on an application.

        Args:
            name: Application name

        Returns:
            Tuple of (success, message)
        """
        success, _, error = await self._make_request(
            "DELETE", f"applications/{name}/operation"
        )

        if success:
            return True, f"Operation on '{name}' terminated"
        return False, error


# Singleton-like service factory
_argocd_services: Dict[str, ArgoCDService] = {}


def get_argocd_service(config: ArgoCDConfig) -> ArgoCDService:
    """
    Get or create ArgoCD service instance.

    Args:
        config: ArgoCD configuration

    Returns:
        ArgoCDService instance
    """
    cache_key = f"{config.server_url}:{config.token or config.username}"

    if cache_key not in _argocd_services:
        _argocd_services[cache_key] = ArgoCDService(
            server_url=config.server_url,
            token=config.token,
            username=config.username,
            password=config.password,
            insecure=config.insecure,
        )

    return _argocd_services[cache_key]
