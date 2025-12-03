"""
Helm-related Pydantic models for chart deployment management.
"""

from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class ReleaseStatus(str, Enum):
    """Helm release status types."""

    DEPLOYED = "deployed"
    FAILED = "failed"
    PENDING_INSTALL = "pending-install"
    PENDING_UPGRADE = "pending-upgrade"
    PENDING_ROLLBACK = "pending-rollback"
    UNINSTALLING = "uninstalling"
    SUPERSEDED = "superseded"
    UNKNOWN = "unknown"


class ChartInfo(BaseModel):
    """Helm chart information."""

    name: str
    version: str
    app_version: Optional[str] = None
    description: Optional[str] = None
    repository: Optional[str] = None
    icon: Optional[str] = None
    home: Optional[str] = None
    sources: List[str] = Field(default_factory=list)
    keywords: List[str] = Field(default_factory=list)
    maintainers: List[Dict[str, str]] = Field(default_factory=list)


class ReleaseInfo(BaseModel):
    """Helm release information."""

    name: str
    namespace: str
    revision: int
    status: ReleaseStatus = ReleaseStatus.UNKNOWN
    chart: str
    chart_version: str
    app_version: Optional[str] = None
    updated: Optional[datetime] = None
    description: Optional[str] = None


class ReleaseHistory(BaseModel):
    """Helm release revision history entry."""

    revision: int
    status: ReleaseStatus
    chart: str
    chart_version: str
    app_version: Optional[str] = None
    updated: datetime
    description: Optional[str] = None


class ReleaseValues(BaseModel):
    """Helm release values."""

    user_supplied: Dict[str, Any] = Field(default_factory=dict)
    computed: Dict[str, Any] = Field(default_factory=dict)


class Repository(BaseModel):
    """Helm repository information."""

    name: str
    url: str
    is_default: bool = False


class InstallRequest(BaseModel):
    """Request model for installing a Helm chart."""

    release_name: str
    chart: str  # chart name or URL
    namespace: str = "default"
    version: Optional[str] = None
    values: Dict[str, Any] = Field(default_factory=dict)
    create_namespace: bool = True
    wait: bool = False
    timeout: int = 300  # seconds
    dry_run: bool = False
    repository: Optional[str] = None


class UpgradeRequest(BaseModel):
    """Request model for upgrading a Helm release."""

    chart: Optional[str] = None  # Optional for using current chart
    version: Optional[str] = None
    values: Dict[str, Any] = Field(default_factory=dict)
    reset_values: bool = False
    reuse_values: bool = True
    wait: bool = False
    timeout: int = 300
    dry_run: bool = False
    force: bool = False
    repository: Optional[str] = None


class RollbackRequest(BaseModel):
    """Request model for rolling back a Helm release."""

    revision: int
    wait: bool = False
    timeout: int = 300
    dry_run: bool = False
    force: bool = False


class UninstallRequest(BaseModel):
    """Request model for uninstalling a Helm release."""

    keep_history: bool = False
    dry_run: bool = False
    timeout: int = 300


class ChartSearchResult(BaseModel):
    """Chart search result."""

    name: str
    version: str
    app_version: Optional[str] = None
    description: Optional[str] = None
    repository: str


class HelmOperationResult(BaseModel):
    """Result of a Helm operation."""

    success: bool
    message: str
    release: Optional[ReleaseInfo] = None
    manifest: Optional[str] = None
    notes: Optional[str] = None


class ReleaseListResponse(BaseModel):
    """Response model for listing releases."""

    releases: List[ReleaseInfo]
    total: int


class ChartListResponse(BaseModel):
    """Response model for listing charts."""

    charts: List[ChartInfo]
    total: int


class RepositoryListResponse(BaseModel):
    """Response model for listing repositories."""

    repositories: List[Repository]
