from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class BuildResult(str, Enum):
    SUCCESS = "SUCCESS"
    FAILURE = "FAILURE"
    UNSTABLE = "UNSTABLE"
    ABORTED = "ABORTED"
    NOT_BUILT = "NOT_BUILT"
    BUILDING = "BUILDING"


class JobInfo(BaseModel):
    name: str
    url: str
    color: str
    buildable: bool
    last_build_number: Optional[int] = None
    last_successful_build: Optional[int] = None
    last_failed_build: Optional[int] = None
    health_score: int = 0
    description: Optional[str] = None


class BuildInfo(BaseModel):
    number: int
    url: str
    result: Optional[BuildResult] = None
    building: bool
    duration: int  # milliseconds
    timestamp: datetime
    display_name: str
    description: Optional[str] = None
    triggered_by: Optional[str] = None
    changes: List[Dict[str, Any]] = []
    artifacts: List[str] = []


class BuildLogResponse(BaseModel):
    job_name: str
    build_number: int
    log: str
    truncated: bool = False


class TriggerBuildRequest(BaseModel):
    job_name: str
    parameters: Dict[str, str] = {}


class TriggerBuildResponse(BaseModel):
    job_name: str
    queue_id: int
    message: str


class PipelineStage(BaseModel):
    name: str
    status: str
    duration: int
    start_time: Optional[datetime] = None


class PipelineInfo(BaseModel):
    job_name: str
    build_number: int
    stages: List[PipelineStage] = []
    total_duration: int
    status: str


class JenkinsHealth(BaseModel):
    healthy: bool
    version: Optional[str] = None
    total_jobs: int
    running_builds: int
    queued_builds: int
    failed_jobs_24h: int
    success_rate_24h: float
