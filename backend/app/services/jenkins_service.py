import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import jenkins

from app.core.config import settings
from app.schemas.jenkins import BuildInfo, BuildResult, JenkinsHealth, JobInfo, PipelineInfo, PipelineStage

logger = logging.getLogger(__name__)


class JenkinsService:
    def __init__(self):
        self._server = None
        self._initialized = False

    def _initialize(self):
        if self._initialized:
            return

        try:
            self._server = jenkins.Jenkins(
                settings.JENKINS_URL, username=settings.JENKINS_USERNAME, password=settings.JENKINS_TOKEN
            )
            self._server.get_whoami()
            self._initialized = True
        except Exception as e:
            logger.error(f"Failed to initialize Jenkins client: {e}")
            raise

    async def get_jobs(self, folder: Optional[str] = None) -> List[JobInfo]:
        self._initialize()
        try:
            if folder:
                jobs = self._server.get_jobs(folder_depth=1, folder_depth_per_request=1)
            else:
                jobs = self._server.get_all_jobs()

            result = []
            for job in jobs:
                job_info = self._server.get_job_info(job["name"])

                last_build = job_info.get("lastBuild")
                last_successful = job_info.get("lastSuccessfulBuild")
                last_failed = job_info.get("lastFailedBuild")

                health_score = 100
                if job_info.get("healthReport"):
                    health_score = job_info["healthReport"][0].get("score", 100)

                result.append(
                    JobInfo(
                        name=job["name"],
                        url=job.get("url", ""),
                        color=job.get("color", "notbuilt"),
                        buildable=job_info.get("buildable", False),
                        last_build_number=last_build["number"] if last_build else None,
                        last_successful_build=last_successful["number"] if last_successful else None,
                        last_failed_build=last_failed["number"] if last_failed else None,
                        health_score=health_score,
                        description=job_info.get("description"),
                    )
                )

            return result
        except Exception as e:
            logger.error(f"Error listing jobs: {e}")
            raise

    async def get_job(self, job_name: str) -> JobInfo:
        self._initialize()
        try:
            job_info = self._server.get_job_info(job_name)

            last_build = job_info.get("lastBuild")
            last_successful = job_info.get("lastSuccessfulBuild")
            last_failed = job_info.get("lastFailedBuild")

            health_score = 100
            if job_info.get("healthReport"):
                health_score = job_info["healthReport"][0].get("score", 100)

            return JobInfo(
                name=job_name,
                url=job_info.get("url", ""),
                color=job_info.get("color", "notbuilt"),
                buildable=job_info.get("buildable", False),
                last_build_number=last_build["number"] if last_build else None,
                last_successful_build=last_successful["number"] if last_successful else None,
                last_failed_build=last_failed["number"] if last_failed else None,
                health_score=health_score,
                description=job_info.get("description"),
            )
        except Exception as e:
            logger.error(f"Error getting job {job_name}: {e}")
            raise

    async def get_build(self, job_name: str, build_number: int) -> BuildInfo:
        self._initialize()
        try:
            build_info = self._server.get_build_info(job_name, build_number)

            result = BuildResult.SUCCESS
            if build_info.get("building"):
                result = BuildResult.BUILDING
            elif build_info.get("result"):
                result = BuildResult(build_info["result"])

            timestamp = datetime.fromtimestamp(build_info["timestamp"] / 1000, tz=timezone.utc)

            triggered_by = None
            for action in build_info.get("actions", []):
                if action.get("_class") == "hudson.model.CauseAction":
                    causes = action.get("causes", [])
                    if causes:
                        triggered_by = causes[0].get("shortDescription", "")
                        break

            changes = []
            changeset = build_info.get("changeSet", {})
            for item in changeset.get("items", []):
                changes.append(
                    {
                        "commit": item.get("commitId", "")[:8],
                        "author": item.get("author", {}).get("fullName", ""),
                        "message": item.get("msg", ""),
                    }
                )

            artifacts = [a.get("fileName", "") for a in build_info.get("artifacts", [])]

            return BuildInfo(
                number=build_number,
                url=build_info.get("url", ""),
                result=result,
                building=build_info.get("building", False),
                duration=build_info.get("duration", 0),
                timestamp=timestamp,
                display_name=build_info.get("displayName", f"#{build_number}"),
                description=build_info.get("description"),
                triggered_by=triggered_by,
                changes=changes,
                artifacts=artifacts,
            )
        except Exception as e:
            logger.error(f"Error getting build {job_name}#{build_number}: {e}")
            raise

    async def get_build_log(self, job_name: str, build_number: int) -> str:
        self._initialize()
        try:
            return self._server.get_build_console_output(job_name, build_number)
        except Exception as e:
            logger.error(f"Error getting build log: {e}")
            raise

    async def trigger_build(self, job_name: str, parameters: Optional[Dict[str, str]] = None) -> int:
        self._initialize()
        try:
            if parameters:
                queue_id = self._server.build_job(job_name, parameters=parameters)
            else:
                queue_id = self._server.build_job(job_name)
            return queue_id
        except Exception as e:
            logger.error(f"Error triggering build for {job_name}: {e}")
            raise

    async def stop_build(self, job_name: str, build_number: int) -> bool:
        self._initialize()
        try:
            self._server.stop_build(job_name, build_number)
            return True
        except Exception as e:
            logger.error(f"Error stopping build: {e}")
            raise

    async def get_queue_info(self) -> List[Dict[str, Any]]:
        self._initialize()
        try:
            queue_info = self._server.get_queue_info()
            return [
                {
                    "id": item.get("id"),
                    "task": item.get("task", {}).get("name"),
                    "why": item.get("why"),
                    "stuck": item.get("stuck", False),
                    "blocked": item.get("blocked", False),
                }
                for item in queue_info
            ]
        except Exception as e:
            logger.error(f"Error getting queue info: {e}")
            raise

    async def get_health(self) -> JenkinsHealth:
        self._initialize()
        try:
            version = self._server.get_version()
            jobs = self._server.get_all_jobs()

            queue_info = self._server.get_queue_info()

            running_builds = 0
            failed_24h = 0
            total_builds_24h = 0

            cutoff = datetime.now(timezone.utc).timestamp() * 1000 - (24 * 60 * 60 * 1000)

            for job in jobs[:50]:
                try:
                    job_info = self._server.get_job_info(job["name"])
                    if job["color"] and "anime" in job["color"]:
                        running_builds += 1

                    for build in job_info.get("builds", [])[:5]:
                        build_info = self._server.get_build_info(job["name"], build["number"])
                        if build_info.get("timestamp", 0) >= cutoff:
                            total_builds_24h += 1
                            if build_info.get("result") == "FAILURE":
                                failed_24h += 1
                except Exception:
                    continue

            success_rate = 0.0
            if total_builds_24h > 0:
                success_rate = ((total_builds_24h - failed_24h) / total_builds_24h) * 100

            return JenkinsHealth(
                healthy=True,
                version=version,
                total_jobs=len(jobs),
                running_builds=running_builds,
                queued_builds=len(queue_info),
                failed_jobs_24h=failed_24h,
                success_rate_24h=round(success_rate, 2),
            )
        except Exception as e:
            logger.error(f"Error getting Jenkins health: {e}")
            return JenkinsHealth(
                healthy=False,
                version=None,
                total_jobs=0,
                running_builds=0,
                queued_builds=0,
                failed_jobs_24h=0,
                success_rate_24h=0.0,
            )


jenkins_service = JenkinsService()
