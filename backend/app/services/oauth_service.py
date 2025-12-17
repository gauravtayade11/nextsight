"""OAuth2 authentication service for Google, GitHub, and GitLab."""
import logging
import uuid
from datetime import datetime, timezone
from typing import Optional, Dict, Any
from urllib.parse import urlencode

import httpx
from pydantic import BaseModel

from app.core.config import settings
from app.core.security import create_access_token, create_refresh_token
from app.schemas.auth import TokenResponse, UserInfo, UserRole

logger = logging.getLogger(__name__)


class OAuthProvider(BaseModel):
    """OAuth provider configuration."""
    name: str
    client_id: str
    client_secret: str
    authorize_url: str
    token_url: str
    userinfo_url: str
    scopes: list[str]
    enabled: bool = False


class OAuthUserInfo(BaseModel):
    """Standardized user info from OAuth providers."""
    provider: str
    provider_id: str
    email: str
    name: Optional[str] = None
    avatar_url: Optional[str] = None
    username: Optional[str] = None


# OAuth provider configurations
OAUTH_PROVIDERS: Dict[str, OAuthProvider] = {
    "google": OAuthProvider(
        name="Google",
        client_id=getattr(settings, "GOOGLE_CLIENT_ID", ""),
        client_secret=getattr(settings, "GOOGLE_CLIENT_SECRET", ""),
        authorize_url="https://accounts.google.com/o/oauth2/v2/auth",
        token_url="https://oauth2.googleapis.com/token",
        userinfo_url="https://www.googleapis.com/oauth2/v2/userinfo",
        scopes=["openid", "email", "profile"],
        enabled=bool(getattr(settings, "GOOGLE_CLIENT_ID", "")),
    ),
    "github": OAuthProvider(
        name="GitHub",
        client_id=getattr(settings, "GITHUB_CLIENT_ID", ""),
        client_secret=getattr(settings, "GITHUB_CLIENT_SECRET", ""),
        authorize_url="https://github.com/login/oauth/authorize",
        token_url="https://github.com/login/oauth/access_token",
        userinfo_url="https://api.github.com/user",
        scopes=["read:user", "user:email"],
        enabled=bool(getattr(settings, "GITHUB_CLIENT_ID", "")),
    ),
    "gitlab": OAuthProvider(
        name="GitLab",
        client_id=getattr(settings, "GITLAB_CLIENT_ID", ""),
        client_secret=getattr(settings, "GITLAB_CLIENT_SECRET", ""),
        authorize_url=f"{getattr(settings, 'GITLAB_URL', 'https://gitlab.com')}/oauth/authorize",
        token_url=f"{getattr(settings, 'GITLAB_URL', 'https://gitlab.com')}/oauth/token",
        userinfo_url=f"{getattr(settings, 'GITLAB_URL', 'https://gitlab.com')}/api/v4/user",
        scopes=["read_user", "openid", "email"],
        enabled=bool(getattr(settings, "GITLAB_CLIENT_ID", "")),
    ),
}


class OAuthService:
    """Service for handling OAuth2 authentication flows."""

    def __init__(self):
        # State tokens stored in memory (short-lived, safe to lose on restart)
        self._state_store: Dict[str, dict] = {}  # CSRF state tokens
        # Fallback in-memory store for when database is not available
        self._oauth_users_fallback: Dict[str, dict] = {}

    def get_enabled_providers(self) -> list[dict]:
        """Get list of enabled OAuth providers."""
        return [
            {"name": p.name, "key": key}
            for key, p in OAUTH_PROVIDERS.items()
            if p.enabled
        ]

    def get_provider(self, provider_name: str) -> Optional[OAuthProvider]:
        """Get OAuth provider configuration."""
        provider = OAUTH_PROVIDERS.get(provider_name)
        if provider and provider.enabled:
            return provider
        return None

    def generate_state(self, provider: str, redirect_uri: str) -> str:
        """Generate and store CSRF state token."""
        state = str(uuid.uuid4())
        self._state_store[state] = {
            "provider": provider,
            "redirect_uri": redirect_uri,
            "created_at": datetime.now(timezone.utc),
        }
        return state

    def verify_state(self, state: str) -> Optional[dict]:
        """Verify and consume state token."""
        state_data = self._state_store.pop(state, None)
        if not state_data:
            return None

        # Check expiration (5 minutes)
        created_at = state_data["created_at"]
        if (datetime.now(timezone.utc) - created_at).total_seconds() > 300:
            return None

        return state_data

    def get_authorization_url(
        self,
        provider_name: str,
        redirect_uri: str,
    ) -> Optional[str]:
        """Generate OAuth authorization URL."""
        provider = self.get_provider(provider_name)
        if not provider:
            return None

        state = self.generate_state(provider_name, redirect_uri)

        params = {
            "client_id": provider.client_id,
            "redirect_uri": redirect_uri,
            "scope": " ".join(provider.scopes),
            "state": state,
            "response_type": "code",
        }

        # Provider-specific params
        if provider_name == "google":
            params["access_type"] = "offline"
            params["prompt"] = "consent"

        return f"{provider.authorize_url}?{urlencode(params)}"

    async def exchange_code(
        self,
        provider_name: str,
        code: str,
        redirect_uri: str,
    ) -> Optional[dict]:
        """Exchange authorization code for access token."""
        provider = self.get_provider(provider_name)
        if not provider:
            return None

        data = {
            "client_id": provider.client_id,
            "client_secret": provider.client_secret,
            "code": code,
            "redirect_uri": redirect_uri,
            "grant_type": "authorization_code",
        }

        headers = {"Accept": "application/json"}

        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    provider.token_url,
                    data=data,
                    headers=headers,
                    timeout=30,
                )
                response.raise_for_status()

                # GitHub returns access_token in different format sometimes
                if provider_name == "github" and "access_token" not in response.text:
                    # Parse URL-encoded response
                    from urllib.parse import parse_qs
                    token_data = parse_qs(response.text)
                    return {"access_token": token_data.get("access_token", [""])[0]}

                return response.json()

        except Exception as e:
            logger.error(f"Token exchange failed for {provider_name}: {e}")
            return None

    async def get_user_info(
        self,
        provider_name: str,
        access_token: str,
    ) -> Optional[OAuthUserInfo]:
        """Fetch user info from OAuth provider."""
        provider = self.get_provider(provider_name)
        if not provider:
            return None

        headers = {"Authorization": f"Bearer {access_token}"}

        # GitHub uses different auth header
        if provider_name == "github":
            headers = {"Authorization": f"token {access_token}"}

        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    provider.userinfo_url,
                    headers=headers,
                    timeout=30,
                )
                response.raise_for_status()
                data = response.json()

                # Normalize user info across providers
                return self._normalize_user_info(provider_name, data, client, access_token)

        except Exception as e:
            logger.error(f"Failed to get user info from {provider_name}: {e}")
            return None

    async def _normalize_user_info(
        self,
        provider_name: str,
        data: dict,
        client: httpx.AsyncClient,
        access_token: str,
    ) -> OAuthUserInfo:
        """Normalize user info from different providers."""
        if provider_name == "google":
            return OAuthUserInfo(
                provider=provider_name,
                provider_id=str(data.get("id")),
                email=data.get("email", ""),
                name=data.get("name"),
                avatar_url=data.get("picture"),
                username=data.get("email", "").split("@")[0],
            )

        elif provider_name == "github":
            email = data.get("email")

            # GitHub may not return email in profile, fetch from emails endpoint
            if not email:
                try:
                    email_response = await client.get(
                        "https://api.github.com/user/emails",
                        headers={"Authorization": f"token {access_token}"},
                        timeout=30,
                    )
                    if email_response.status_code == 200:
                        emails = email_response.json()
                        primary_email = next(
                            (e["email"] for e in emails if e.get("primary")),
                            emails[0]["email"] if emails else None,
                        )
                        email = primary_email
                except Exception:
                    pass

            return OAuthUserInfo(
                provider=provider_name,
                provider_id=str(data.get("id")),
                email=email or f"{data.get('login')}@github.local",
                name=data.get("name") or data.get("login"),
                avatar_url=data.get("avatar_url"),
                username=data.get("login"),
            )

        elif provider_name == "gitlab":
            return OAuthUserInfo(
                provider=provider_name,
                provider_id=str(data.get("id")),
                email=data.get("email", ""),
                name=data.get("name"),
                avatar_url=data.get("avatar_url"),
                username=data.get("username"),
            )

        # Default fallback
        return OAuthUserInfo(
            provider=provider_name,
            provider_id=str(data.get("id", data.get("sub", ""))),
            email=data.get("email", ""),
            name=data.get("name"),
            username=data.get("preferred_username", data.get("login")),
        )

    async def authenticate_oauth(
        self,
        provider_name: str,
        code: str,
        redirect_uri: str,
        state: str,
    ) -> Optional[TokenResponse]:
        """Complete OAuth flow and return JWT tokens."""
        # Verify state
        state_data = self.verify_state(state)
        if not state_data or state_data["provider"] != provider_name:
            logger.warning(f"Invalid OAuth state for {provider_name}")
            return None

        # Exchange code for token
        token_data = await self.exchange_code(provider_name, code, redirect_uri)
        if not token_data or "access_token" not in token_data:
            logger.warning(f"Failed to exchange code for {provider_name}")
            return None

        # Get user info
        user_info = await self.get_user_info(provider_name, token_data["access_token"])
        if not user_info:
            logger.warning(f"Failed to get user info from {provider_name}")
            return None

        # Create or update user in our system
        user = await self._get_or_create_oauth_user(user_info)

        # Generate JWT tokens
        jwt_data = {
            "sub": user["id"],
            "username": user["username"],
            "role": user["role"],
        }
        access_token = create_access_token(data=jwt_data)
        refresh_token = create_refresh_token(data=jwt_data)

        return TokenResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            token_type="bearer",
            expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
            user=UserInfo(
                id=user["id"],
                username=user["username"],
                email=user["email"],
                full_name=user["full_name"],
                role=user["role"],
                is_active=user["is_active"],
                created_at=user["created_at"],
                last_login=user["last_login"],
            ),
        )

    async def _get_or_create_oauth_user(self, oauth_info: OAuthUserInfo) -> dict:
        """Get existing OAuth user or create new one (uses database when available)."""
        from app.core.config import settings

        if settings.USE_DATABASE_AUTH:
            return await self._get_or_create_oauth_user_db(oauth_info)
        else:
            return await self._get_or_create_oauth_user_memory(oauth_info)

    async def _get_or_create_oauth_user_db(self, oauth_info: OAuthUserInfo) -> dict:
        """Get or create OAuth user in database."""
        from app.core.database import async_session_maker
        from app.models.user import User, AuthProvider, UserRole as DBUserRole
        from sqlalchemy import select

        async with async_session_maker() as session:
            # Map OAuth provider to AuthProvider enum
            provider_map = {
                "google": AuthProvider.GOOGLE,
                "github": AuthProvider.GITHUB,
                "gitlab": AuthProvider.GITLAB,
            }
            auth_provider = provider_map.get(oauth_info.provider, AuthProvider.LOCAL)

            # Check if user exists by provider+provider_id
            query = select(User).where(
                User.auth_provider == auth_provider,
                User.oauth_provider_id == oauth_info.provider_id
            )
            result = await session.execute(query)
            existing_user = result.scalar_one_or_none()

            if existing_user:
                # Update last login
                existing_user.last_login = datetime.now(timezone.utc)
                await session.commit()
                return self._user_to_dict(existing_user)

            # Check if username is unique
            username = oauth_info.username or oauth_info.email.split("@")[0]
            base_username = username
            counter = 1

            while True:
                query = select(User).where(User.username == username)
                result = await session.execute(query)
                if not result.scalar_one_or_none():
                    break
                username = f"{base_username}{counter}"
                counter += 1

            # Create new user
            new_user = User(
                username=username,
                email=oauth_info.email,
                full_name=oauth_info.name or username,
                password_hash=None,  # OAuth users don't have password
                role=DBUserRole.VIEWER,
                is_active=True,
                last_login=datetime.now(timezone.utc),
                auth_provider=auth_provider,
                oauth_provider_id=oauth_info.provider_id,
                avatar_url=oauth_info.avatar_url,
            )

            session.add(new_user)
            await session.commit()
            await session.refresh(new_user)

            logger.info(f"Created OAuth user in database: {username} via {oauth_info.provider}")
            return self._user_to_dict(new_user)

    async def _get_or_create_oauth_user_memory(self, oauth_info: OAuthUserInfo) -> dict:
        """Fallback: Get or create OAuth user in memory."""
        oauth_key = f"{oauth_info.provider}:{oauth_info.provider_id}"

        if oauth_key in self._oauth_users_fallback:
            user = self._oauth_users_fallback[oauth_key]
            user["last_login"] = datetime.now(timezone.utc)
            return user

        # Create new user
        user_id = str(uuid.uuid4())
        username = oauth_info.username or oauth_info.email.split("@")[0]

        # Ensure unique username
        base_username = username
        counter = 1
        while any(u["username"] == username for u in self._oauth_users_fallback.values()):
            username = f"{base_username}{counter}"
            counter += 1

        user = {
            "id": user_id,
            "username": username,
            "email": oauth_info.email,
            "full_name": oauth_info.name or username,
            "role": UserRole.VIEWER,
            "is_active": True,
            "created_at": datetime.now(timezone.utc),
            "last_login": datetime.now(timezone.utc),
            "oauth_provider": oauth_info.provider,
            "oauth_provider_id": oauth_info.provider_id,
            "avatar_url": oauth_info.avatar_url,
        }

        self._oauth_users_fallback[oauth_key] = user
        logger.info(f"Created OAuth user (in-memory): {username} via {oauth_info.provider}")

        return user

    def _user_to_dict(self, user) -> dict:
        """Convert User model to dict for token generation."""
        return {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "full_name": user.full_name,
            "role": user.role,
            "is_active": user.is_active,
            "created_at": user.created_at,
            "last_login": user.last_login,
            "oauth_provider": user.auth_provider.value if hasattr(user.auth_provider, 'value') else user.auth_provider,
            "oauth_provider_id": user.oauth_provider_id,
            "avatar_url": user.avatar_url,
        }

    async def get_oauth_user_by_id(self, user_id: str) -> Optional[dict]:
        """Get OAuth user by internal ID."""
        from app.core.config import settings

        if settings.USE_DATABASE_AUTH:
            from app.core.database import async_session_maker
            from app.models.user import User
            from sqlalchemy import select

            async with async_session_maker() as session:
                query = select(User).where(User.id == user_id)
                result = await session.execute(query)
                user = result.scalar_one_or_none()
                if user:
                    return self._user_to_dict(user)
                return None
        else:
            for user in self._oauth_users_fallback.values():
                if user["id"] == user_id:
                    return user
            return None


# Global OAuth service instance
oauth_service = OAuthService()
