import logging
import re
import subprocess
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from app.schemas.gitflow import (
    BranchType,
    DeploymentStatus,
    Environment,
    GitFlowBranch,
    GitFlowConfig,
    ReleaseCandidate,
    ReleaseHistory,
    ReleaseStatus,
)

logger = logging.getLogger(__name__)


class GitFlowService:
    def __init__(self, repo_path: str = "."):
        self.repo_path = repo_path
        self.config = GitFlowConfig()
        self._releases: Dict[str, ReleaseCandidate] = {}
        self._deployments: Dict[str, DeploymentStatus] = {}

    def _run_git(self, *args) -> tuple[bool, str]:
        try:
            result = subprocess.run(["git", *args], cwd=self.repo_path, capture_output=True, text=True)
            return result.returncode == 0, result.stdout.strip() or result.stderr.strip()
        except Exception as e:
            logger.error(f"Git command failed: {e}")
            return False, str(e)

    async def get_branches(self, branch_type: Optional[BranchType] = None) -> List[GitFlowBranch]:
        success, output = self._run_git("branch", "-a", "--format=%(refname:short)")
        if not success:
            return []

        branches = []
        for branch_name in output.split("\n"):
            branch_name = branch_name.strip()
            if not branch_name:
                continue

            detected_type = self._detect_branch_type(branch_name)
            if branch_type and detected_type != branch_type:
                continue

            _, last_commit = self._run_git("rev-parse", "--short", branch_name)
            _, created_date = self._run_git("log", "-1", "--format=%ci", branch_name)

            branches.append(
                GitFlowBranch(
                    name=branch_name,
                    branch_type=detected_type,
                    last_commit=last_commit if last_commit else None,
                    created_at=datetime.fromisoformat(created_date) if created_date else None,
                )
            )

        return branches

    def _detect_branch_type(self, branch_name: str) -> BranchType:
        if branch_name in ["main", "master"]:
            return BranchType.MAIN if branch_name == "main" else BranchType.MASTER
        elif branch_name == "develop":
            return BranchType.DEVELOP
        elif branch_name.startswith(self.config.feature_prefix):
            return BranchType.FEATURE
        elif branch_name.startswith(self.config.release_prefix):
            return BranchType.RELEASE
        elif branch_name.startswith(self.config.hotfix_prefix):
            return BranchType.HOTFIX
        return BranchType.FEATURE

    async def create_release(
        self,
        version: str,
        source_branch: str = "develop",
        changelog: Optional[str] = None,
        created_by: Optional[str] = None,
        auto_create_branch: bool = True,
    ) -> ReleaseCandidate:
        release_id = str(uuid.uuid4())
        release_branch = f"{self.config.release_prefix}{version}"

        if auto_create_branch:
            success, _ = self._run_git("checkout", source_branch)
            if not success:
                raise ValueError(f"Failed to checkout {source_branch}")

            success, _ = self._run_git("pull", "origin", source_branch)
            success, output = self._run_git("checkout", "-b", release_branch)
            if not success:
                raise ValueError(f"Failed to create release branch: {output}")

        commits = await self._get_commits_since_last_release(source_branch)

        release = ReleaseCandidate(
            id=release_id,
            version=version,
            release_branch=release_branch,
            source_branch=source_branch,
            target_branch=self.config.main_branch,
            status=ReleaseStatus.DRAFT,
            commits=commits,
            changelog=changelog or self._generate_changelog(commits),
            created_by=created_by,
            created_at=datetime.now(timezone.utc),
        )

        self._releases[release_id] = release
        return release

    async def _get_commits_since_last_release(self, branch: str) -> List[Dict[str, Any]]:
        _, last_tag = self._run_git("describe", "--tags", "--abbrev=0", branch)

        if last_tag:
            _, log_output = self._run_git("log", f"{last_tag}..{branch}", "--pretty=format:%H|%s|%an|%ci")
        else:
            _, log_output = self._run_git("log", branch, "-20", "--pretty=format:%H|%s|%an|%ci")

        commits = []
        for line in log_output.split("\n"):
            if not line.strip():
                continue
            parts = line.split("|")
            if len(parts) >= 4:
                commits.append({"sha": parts[0][:8], "message": parts[1], "author": parts[2], "date": parts[3]})
        return commits

    def _generate_changelog(self, commits: List[Dict[str, Any]]) -> str:
        features = []
        fixes = []
        others = []

        for commit in commits:
            msg = commit.get("message", "").lower()
            if any(kw in msg for kw in ["feat", "feature", "add"]):
                features.append(commit)
            elif any(kw in msg for kw in ["fix", "bug", "patch"]):
                fixes.append(commit)
            else:
                others.append(commit)

        changelog = "# Changelog\n\n"

        if features:
            changelog += "## Features\n"
            for c in features:
                changelog += f"- {c['message']} ({c['sha']})\n"
            changelog += "\n"

        if fixes:
            changelog += "## Bug Fixes\n"
            for c in fixes:
                changelog += f"- {c['message']} ({c['sha']})\n"
            changelog += "\n"

        if others:
            changelog += "## Other Changes\n"
            for c in others:
                changelog += f"- {c['message']} ({c['sha']})\n"

        return changelog

    async def approve_release(self, release_id: str, approved_by: str) -> ReleaseCandidate:
        if release_id not in self._releases:
            raise ValueError(f"Release {release_id} not found")

        release = self._releases[release_id]
        release.status = ReleaseStatus.APPROVED
        release.approved_by = approved_by
        release.approved_at = datetime.now(timezone.utc)
        return release

    async def finish_release(self, release_id: str) -> ReleaseCandidate:
        if release_id not in self._releases:
            raise ValueError(f"Release {release_id} not found")

        release = self._releases[release_id]

        self._run_git("checkout", self.config.main_branch)
        self._run_git("merge", "--no-ff", release.release_branch, "-m", f"Merge release {release.version}")

        tag_name = f"{self.config.version_tag_prefix}{release.version}"
        self._run_git("tag", "-a", tag_name, "-m", f"Release {release.version}")

        self._run_git("checkout", self.config.develop_branch)
        self._run_git(
            "merge", "--no-ff", release.release_branch, "-m", f"Merge release {release.version} back to develop"
        )

        self._run_git("branch", "-d", release.release_branch)

        release.status = ReleaseStatus.DEPLOYED
        return release

    async def create_hotfix(self, version: str, description: str, created_by: Optional[str] = None) -> ReleaseCandidate:
        hotfix_branch = f"{self.config.hotfix_prefix}{version}"

        self._run_git("checkout", self.config.main_branch)
        self._run_git("checkout", "-b", hotfix_branch)

        release = ReleaseCandidate(
            id=str(uuid.uuid4()),
            version=version,
            release_branch=hotfix_branch,
            source_branch=self.config.main_branch,
            target_branch=self.config.main_branch,
            status=ReleaseStatus.DRAFT,
            commits=[],
            changelog=f"# Hotfix {version}\n\n{description}",
            created_by=created_by,
            created_at=datetime.now(timezone.utc),
        )

        self._releases[release.id] = release
        return release

    async def finish_hotfix(self, release_id: str) -> ReleaseCandidate:
        if release_id not in self._releases:
            raise ValueError(f"Hotfix {release_id} not found")

        release = self._releases[release_id]

        self._run_git("checkout", self.config.main_branch)
        self._run_git("merge", "--no-ff", release.release_branch, "-m", f"Merge hotfix {release.version}")

        tag_name = f"{self.config.version_tag_prefix}{release.version}"
        self._run_git("tag", "-a", tag_name, "-m", f"Hotfix {release.version}")

        if self.config.auto_merge_hotfix_to_develop:
            self._run_git("checkout", self.config.develop_branch)
            self._run_git(
                "merge", "--no-ff", release.release_branch, "-m", f"Merge hotfix {release.version} to develop"
            )

        self._run_git("branch", "-d", release.release_branch)

        release.status = ReleaseStatus.DEPLOYED
        return release

    async def get_release(self, release_id: str) -> Optional[ReleaseCandidate]:
        return self._releases.get(release_id)

    async def get_releases(self, status: Optional[ReleaseStatus] = None, limit: int = 20) -> ReleaseHistory:
        releases = list(self._releases.values())

        if status:
            releases = [r for r in releases if r.status == status]

        releases.sort(key=lambda x: x.created_at, reverse=True)
        releases = releases[:limit]

        return ReleaseHistory(releases=releases, total_count=len(self._releases))

    async def get_current_versions(self) -> Dict[str, str]:
        versions = {}
        _, tags = self._run_git("tag", "-l", "--sort=-v:refname")

        if tags:
            latest_tag = tags.split("\n")[0].strip()
            versions["latest"] = latest_tag.replace(self.config.version_tag_prefix, "")

        return versions


gitflow_service = GitFlowService()
