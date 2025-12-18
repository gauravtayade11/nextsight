# =============================================================================
# GitHub Integration Service - Connect repos, webhooks, fetch files
# =============================================================================
import httpx
import base64
import hmac
import hashlib
from typing import Optional, List, Dict, Any
from datetime import datetime
from pydantic import BaseModel
from fastapi import HTTPException

from app.core.config import settings


class GitHubRepository(BaseModel):
    id: int
    name: str
    full_name: str
    description: Optional[str] = None
    html_url: str
    clone_url: str
    ssh_url: str
    default_branch: str
    private: bool
    owner: str


class GitHubBranch(BaseModel):
    name: str
    sha: str
    protected: bool = False


class GitHubCommit(BaseModel):
    sha: str
    message: str
    author: str
    date: str
    url: str


class GitHubWebhook(BaseModel):
    id: int
    url: str
    events: List[str]
    active: bool


class GitHubService:
    """Service for GitHub API interactions"""

    BASE_URL = "https://api.github.com"

    def __init__(self, access_token: Optional[str] = None):
        self.access_token = access_token or getattr(settings, 'GITHUB_TOKEN', None)
        self.headers = {
            "Accept": "application/vnd.github.v3+json",
            "X-GitHub-Api-Version": "2022-11-28",
        }
        if self.access_token:
            self.headers["Authorization"] = f"Bearer {self.access_token}"

    async def _request(
        self,
        method: str,
        endpoint: str,
        data: Optional[Dict] = None,
        params: Optional[Dict] = None
    ) -> Dict[str, Any]:
        """Make authenticated request to GitHub API"""
        # Validate endpoint to prevent SSRF
        if not endpoint.startswith('/'):
            raise HTTPException(status_code=400, detail="Endpoint must start with /")

        # Prevent absolute URLs in endpoint parameter
        if any(proto in endpoint.lower() for proto in ['http://', 'https://', '//']):
            raise HTTPException(status_code=400, detail="Endpoint cannot contain absolute URLs")

        async with httpx.AsyncClient() as client:
            response = await client.request(
                method=method,
                url=f"{self.BASE_URL}{endpoint}",
                headers=self.headers,
                json=data,
                params=params,
                timeout=30.0
            )
            response.raise_for_status()
            return response.json() if response.content else {}

    # =========================================================================
    # Repository Operations
    # =========================================================================

    async def get_user_repos(self, page: int = 1, per_page: int = 30) -> List[GitHubRepository]:
        """Get repositories for authenticated user"""
        data = await self._request(
            "GET",
            "/user/repos",
            params={"page": page, "per_page": per_page, "sort": "updated"}
        )
        return [
            GitHubRepository(
                id=repo["id"],
                name=repo["name"],
                full_name=repo["full_name"],
                description=repo.get("description"),
                html_url=repo["html_url"],
                clone_url=repo["clone_url"],
                ssh_url=repo["ssh_url"],
                default_branch=repo["default_branch"],
                private=repo["private"],
                owner=repo["owner"]["login"]
            )
            for repo in data
        ]

    async def get_repo(self, owner: str, repo: str) -> GitHubRepository:
        """Get specific repository details"""
        data = await self._request("GET", f"/repos/{owner}/{repo}")
        return GitHubRepository(
            id=data["id"],
            name=data["name"],
            full_name=data["full_name"],
            description=data.get("description"),
            html_url=data["html_url"],
            clone_url=data["clone_url"],
            ssh_url=data["ssh_url"],
            default_branch=data["default_branch"],
            private=data["private"],
            owner=data["owner"]["login"]
        )

    async def get_branches(self, owner: str, repo: str) -> List[GitHubBranch]:
        """Get repository branches"""
        data = await self._request("GET", f"/repos/{owner}/{repo}/branches")
        return [
            GitHubBranch(
                name=branch["name"],
                sha=branch["commit"]["sha"],
                protected=branch.get("protected", False)
            )
            for branch in data
        ]

    async def get_commits(
        self,
        owner: str,
        repo: str,
        branch: Optional[str] = None,
        limit: int = 10
    ) -> List[GitHubCommit]:
        """Get recent commits"""
        params = {"per_page": limit}
        if branch:
            params["sha"] = branch

        data = await self._request("GET", f"/repos/{owner}/{repo}/commits", params=params)
        return [
            GitHubCommit(
                sha=commit["sha"][:7],
                message=commit["commit"]["message"].split("\n")[0],
                author=commit["commit"]["author"]["name"],
                date=commit["commit"]["author"]["date"],
                url=commit["html_url"]
            )
            for commit in data
        ]

    # =========================================================================
    # File Operations
    # =========================================================================

    async def get_file_content(
        self,
        owner: str,
        repo: str,
        path: str,
        ref: Optional[str] = None
    ) -> str:
        """Get file content from repository"""
        params = {"ref": ref} if ref else {}
        data = await self._request(
            "GET",
            f"/repos/{owner}/{repo}/contents/{path}",
            params=params
        )

        if data.get("encoding") == "base64":
            return base64.b64decode(data["content"]).decode("utf-8")
        return data.get("content", "")

    async def get_pipeline_file(
        self,
        owner: str,
        repo: str,
        ref: Optional[str] = None
    ) -> Optional[str]:
        """Try to find and read pipeline configuration file"""
        # Common pipeline file locations
        pipeline_files = [
            ".nextsight/pipeline.yaml",
            ".nextsight/pipeline.yml",
            "nextsight-pipeline.yaml",
            "nextsight-pipeline.yml",
            ".github/workflows/nextsight.yaml",
            ".github/workflows/nextsight.yml",
        ]

        for file_path in pipeline_files:
            try:
                content = await self.get_file_content(owner, repo, file_path, ref)
                return content
            except httpx.HTTPStatusError:
                continue

        return None

    # =========================================================================
    # Webhook Operations
    # =========================================================================

    async def create_webhook(
        self,
        owner: str,
        repo: str,
        webhook_url: str,
        secret: str,
        events: List[str] = None
    ) -> GitHubWebhook:
        """Create webhook for repository"""
        if events is None:
            events = ["push", "pull_request"]

        data = await self._request(
            "POST",
            f"/repos/{owner}/{repo}/hooks",
            data={
                "name": "web",
                "active": True,
                "events": events,
                "config": {
                    "url": webhook_url,
                    "content_type": "json",
                    "secret": secret,
                    "insecure_ssl": "0"
                }
            }
        )

        return GitHubWebhook(
            id=data["id"],
            url=data["config"]["url"],
            events=data["events"],
            active=data["active"]
        )

    async def delete_webhook(self, owner: str, repo: str, hook_id: int) -> bool:
        """Delete webhook from repository"""
        try:
            await self._request("DELETE", f"/repos/{owner}/{repo}/hooks/{hook_id}")
            return True
        except httpx.HTTPStatusError:
            return False

    async def list_webhooks(self, owner: str, repo: str) -> List[GitHubWebhook]:
        """List all webhooks for repository"""
        data = await self._request("GET", f"/repos/{owner}/{repo}/hooks")
        return [
            GitHubWebhook(
                id=hook["id"],
                url=hook["config"].get("url", ""),
                events=hook["events"],
                active=hook["active"]
            )
            for hook in data
        ]

    # =========================================================================
    # Webhook Verification
    # =========================================================================

    @staticmethod
    def verify_webhook_signature(payload: bytes, signature: str, secret: str) -> bool:
        """Verify GitHub webhook signature"""
        if not signature.startswith("sha256="):
            return False

        expected = hmac.new(
            secret.encode(),
            payload,
            hashlib.sha256
        ).hexdigest()

        return hmac.compare_digest(f"sha256={expected}", signature)

    # =========================================================================
    # OAuth Flow Helpers
    # =========================================================================

    @staticmethod
    def get_oauth_url(client_id: str, redirect_uri: str, state: str) -> str:
        """Generate GitHub OAuth authorization URL"""
        scope = "repo,read:user,admin:repo_hook"
        return (
            f"https://github.com/login/oauth/authorize"
            f"?client_id={client_id}"
            f"&redirect_uri={redirect_uri}"
            f"&scope={scope}"
            f"&state={state}"
        )

    @staticmethod
    async def exchange_code_for_token(
        client_id: str,
        client_secret: str,
        code: str
    ) -> Dict[str, str]:
        """Exchange OAuth code for access token"""
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://github.com/login/oauth/access_token",
                headers={"Accept": "application/json"},
                data={
                    "client_id": client_id,
                    "client_secret": client_secret,
                    "code": code
                }
            )
            return response.json()


# Singleton instance
github_service = GitHubService()
