from typing import List, Optional

from fastapi import APIRouter, HTTPException, Query

from app.schemas.jenkins import (
    BuildInfo,
    BuildLogResponse,
    JenkinsHealth,
    JobInfo,
    TriggerBuildRequest,
    TriggerBuildResponse,
)
from app.services.jenkins_service import jenkins_service
from app.services.timeline_service import timeline_service

router = APIRouter()


@router.get("/health", response_model=JenkinsHealth)
async def get_jenkins_health():
    """Get Jenkins server health status."""
    return await jenkins_service.get_health()


@router.get("/jobs", response_model=List[JobInfo])
async def list_jobs(folder: Optional[str] = Query(None)):
    """List all Jenkins jobs."""
    try:
        return await jenkins_service.get_jobs(folder)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/jobs/{job_name}", response_model=JobInfo)
async def get_job(job_name: str):
    """Get details of a specific job."""
    try:
        return await jenkins_service.get_job(job_name)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/jobs/{job_name}/builds/{build_number}", response_model=BuildInfo)
async def get_build(job_name: str, build_number: int):
    """Get details of a specific build."""
    try:
        return await jenkins_service.get_build(job_name, build_number)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/jobs/{job_name}/builds/{build_number}/log", response_model=BuildLogResponse)
async def get_build_log(job_name: str, build_number: int):
    """Get console output of a build."""
    try:
        log = await jenkins_service.get_build_log(job_name, build_number)
        truncated = len(log) > 100000
        if truncated:
            log = log[-100000:]
        return BuildLogResponse(job_name=job_name, build_number=build_number, log=log, truncated=truncated)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/jobs/{job_name}/build", response_model=TriggerBuildResponse)
async def trigger_build(job_name: str, request: Optional[TriggerBuildRequest] = None):
    """Trigger a new build for a job."""
    try:
        parameters = request.parameters if request else {}
        queue_id = await jenkins_service.trigger_build(job_name, parameters)
        return TriggerBuildResponse(job_name=job_name, queue_id=queue_id, message=f"Build queued for {job_name}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/jobs/{job_name}/builds/{build_number}/stop")
async def stop_build(job_name: str, build_number: int):
    """Stop a running build."""
    try:
        success = await jenkins_service.stop_build(job_name, build_number)
        return {"success": success, "message": f"Stopped build #{build_number}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/queue")
async def get_queue():
    """Get current build queue."""
    try:
        return await jenkins_service.get_queue_info()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
