from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class BranchType(str, Enum):
    MAIN = "main"
    MASTER = "master"
    DEVELOP = "develop"
    FEATURE = "feature"
    RELEASE = "release"
    HOTFIX = "hotfix"
    BUGFIX = "bugfix"


class ReleaseStatus(str, Enum):
    DRAFT = "draft"
    PENDING_APPROVAL = "pending_approval"
    APPROVED = "approved"
    DEPLOYING = "deploying"
    DEPLOYED = "deployed"
    ROLLED_BACK = "rolled_back"
    FAILED = "failed"


class Environment(str, Enum):
    DEVELOPMENT = "development"
    STAGING = "staging"
    UAT = "uat"
    PRODUCTION = "production"


class GitFlowBranch(BaseModel):
    name: str
    branch_type: BranchType
    base_branch: Optional[str] = None
    created_at: Optional[datetime] = None
    last_commit: Optional[str] = None
    is_merged: bool = False


class ReleaseCandidate(BaseModel):
    id: str
    version: str
    release_branch: str
    source_branch: str = "develop"
    target_branch: str = "main"
    status: ReleaseStatus = ReleaseStatus.DRAFT
    commits: List[Dict[str, Any]] = []
    changelog: Optional[str] = None
    created_by: Optional[str] = None
    created_at: datetime
    approved_by: Optional[str] = None
    approved_at: Optional[datetime] = None


class CreateReleaseRequest(BaseModel):
    version: str = Field(..., pattern=r"^\d+\.\d+\.\d+(-[a-zA-Z0-9]+)?$")
    source_branch: str = "develop"
    changelog: Optional[str] = None
    auto_create_branch: bool = True


class DeploymentRequest(BaseModel):
    release_id: str
    environment: Environment
    namespace: str
    services: List[str] = []
    dry_run: bool = False
    wait_for_ready: bool = True
    timeout_seconds: int = Field(default=300, ge=60, le=1800)


class RollbackRequest(BaseModel):
    deployment_id: str
    target_version: Optional[str] = None
    reason: str = Field(..., min_length=10)


class DeploymentStatus(BaseModel):
    id: str
    release_id: str
    environment: Environment
    namespace: str
    status: str
    services: List[Dict[str, Any]] = []
    started_at: datetime
    completed_at: Optional[datetime] = None
    deployed_by: Optional[str] = None
    rollback_available: bool = False
    previous_version: Optional[str] = None


class GitFlowConfig(BaseModel):
    main_branch: str = "main"
    develop_branch: str = "develop"
    feature_prefix: str = "feature/"
    release_prefix: str = "release/"
    hotfix_prefix: str = "hotfix/"
    version_tag_prefix: str = "v"
    require_approval_for_production: bool = True
    auto_merge_hotfix_to_develop: bool = True


class ReleaseHistory(BaseModel):
    releases: List[ReleaseCandidate] = []
    total_count: int = 0
    environments: Dict[str, str] = {}  # env -> current version


class PromoteRequest(BaseModel):
    release_id: str
    from_environment: Environment
    to_environment: Environment
    approval_required: bool = True
