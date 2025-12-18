"""Settings and Integrations service layer."""
import asyncio
import hashlib
import logging
import secrets
import httpx
from datetime import datetime, timedelta, timezone
from typing import List, Optional, Dict, Any

from sqlalchemy import select, update, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.settings import (
    Integration, IntegrationStatus, IntegrationCategory,
    APIToken, UserSettings
)
from app.models.user import User, UserRole
from app.core.security import get_password_hash
from app.schemas.settings import (
    IntegrationCreate, IntegrationUpdate, IntegrationConnectRequest,
    APITokenCreate, UserSettingsUpdate, UserCreate, UserUpdate,
    IntegrationStatusResponse
)
from app.utils.security import validate_url_safe

logger = logging.getLogger(__name__)


class SettingsService:
    """Service for managing settings, integrations, users, and tokens."""

    def __init__(self, db: AsyncSession):
        self.db = db

    # ============ Integrations ============

    async def list_integrations(self) -> List[Integration]:
        """List all integrations."""
        result = await self.db.execute(
            select(Integration).order_by(Integration.category, Integration.name)
        )
        return list(result.scalars().all())

    async def get_integration(self, integration_id: str) -> Optional[Integration]:
        """Get a specific integration by ID."""
        result = await self.db.execute(
            select(Integration).where(Integration.id == integration_id)
        )
        return result.scalar_one_or_none()

    async def get_integration_by_name(self, name: str) -> Optional[Integration]:
        """Get integration by name."""
        result = await self.db.execute(
            select(Integration).where(Integration.name == name)
        )
        return result.scalar_one_or_none()

    async def create_integration(self, data: IntegrationCreate) -> Integration:
        """Create a new integration."""
        integration = Integration(
            name=data.name,
            description=data.description,
            icon=data.icon,
            category=IntegrationCategory(data.category),
            config=data.config,
            auto_sync=data.auto_sync,
            sync_interval_seconds=data.sync_interval_seconds,
            health_check_url=data.health_check_url,
            status=IntegrationStatus.DISCONNECTED,
        )
        self.db.add(integration)
        await self.db.flush()
        return integration

    async def update_integration(self, integration_id: str, data: IntegrationUpdate) -> Optional[Integration]:
        """Update an integration."""
        integration = await self.get_integration(integration_id)
        if not integration:
            return None

        update_data = data.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(integration, key, value)

        await self.db.flush()
        return integration

    async def delete_integration(self, integration_id: str) -> bool:
        """Delete an integration."""
        result = await self.db.execute(
            delete(Integration).where(Integration.id == integration_id)
        )
        return result.rowcount > 0

    async def connect_integration(self, integration_id: str, data: IntegrationConnectRequest) -> Optional[Integration]:
        """Connect/configure an integration."""
        integration = await self.get_integration(integration_id)
        if not integration:
            return None

        # Build config from request
        config = {
            "endpoint": data.endpoint,
            **(data.additional_config or {})
        }
        if data.api_token:
            config["api_token"] = data.api_token  # In production, encrypt this
        if data.username:
            config["username"] = data.username
        if data.password:
            config["password"] = data.password  # In production, encrypt this

        integration.config = config

        # Test connection
        is_connected = await self._test_integration_connection(integration)

        if is_connected:
            integration.status = IntegrationStatus.CONNECTED
            integration.last_sync = datetime.utcnow()
            integration.last_error = None
        else:
            integration.status = IntegrationStatus.ERROR
            integration.last_error = "Failed to connect to the integration endpoint"

        await self.db.flush()
        return integration

    async def disconnect_integration(self, integration_id: str) -> Optional[Integration]:
        """Disconnect an integration."""
        integration = await self.get_integration(integration_id)
        if not integration:
            return None

        integration.status = IntegrationStatus.DISCONNECTED
        integration.config = None
        await self.db.flush()
        return integration

    async def check_integration_status(self, integration_id: str) -> Optional[IntegrationStatusResponse]:
        """Check real-time status of an integration."""
        integration = await self.get_integration(integration_id)
        if not integration:
            return None

        is_healthy = False
        response_time_ms = None

        if integration.config and integration.status != IntegrationStatus.DISCONNECTED:
            start_time = datetime.utcnow()
            is_healthy = await self._test_integration_connection(integration)
            response_time_ms = int((datetime.utcnow() - start_time).total_seconds() * 1000)

            # Update status based on health check
            if is_healthy:
                integration.status = IntegrationStatus.CONNECTED
                integration.last_sync = datetime.utcnow()
                integration.last_error = None
            else:
                integration.status = IntegrationStatus.ERROR

            await self.db.flush()

        return IntegrationStatusResponse(
            id=integration.id,
            name=integration.name,
            status=integration.status.value,
            last_sync=integration.last_sync,
            last_error=integration.last_error,
            is_healthy=is_healthy,
            response_time_ms=response_time_ms
        )

    async def _test_integration_connection(self, integration: Integration) -> bool:
        """Test if an integration is reachable."""
        if not integration.config:
            return False

        endpoint = integration.config.get("endpoint") or integration.health_check_url
        if not endpoint:
            return False

        try:
            # Validate URL to prevent SSRF attacks
            # Allow private IPs for internal services (ArgoCD, Jenkins, etc.)
            validated_endpoint = validate_url_safe(endpoint, allow_private=True)

            async with httpx.AsyncClient(timeout=10.0) as client:
                headers = {}
                if integration.config.get("api_token"):
                    headers["Authorization"] = f"Bearer {integration.config['api_token']}"

                response = await client.get(validated_endpoint, headers=headers)
                return response.status_code < 500
        except Exception as e:
            logger.warning(f"Integration health check failed for {integration.name}: {e}")
            integration.last_error = str(e)
            return False

    async def seed_default_integrations(self):
        """Seed default integrations if none exist, or update managed integrations."""
        existing = await self.list_integrations()

        defaults = [
            {"name": "GitHub", "description": "Source code management and CI/CD", "icon": "github", "category": "source-control"},
            {"name": "GitLab", "description": "DevOps platform for source control", "icon": "gitlab", "category": "source-control"},
            {"name": "ArgoCD", "description": "GitOps continuous delivery", "icon": "argocd", "category": "ci-cd"},
            {"name": "Helm", "description": "Kubernetes package manager", "icon": "helm", "category": "ci-cd"},
            {"name": "Jenkins", "description": "Automation server", "icon": "jenkins", "category": "ci-cd"},
            {"name": "Prometheus", "description": "Full observability stack with Prometheus, Alertmanager & Node Exporter. Managed by NextSight AI.", "icon": "prometheus", "category": "monitoring", "is_managed": True, "setup_url": "/monitoring/prometheus"},
            {"name": "Grafana", "description": "Analytics and visualization", "icon": "grafana", "category": "monitoring"},
            {"name": "Loki", "description": "Log aggregation system", "icon": "loki", "category": "logging"},
            {"name": "Slack", "description": "Team notifications", "icon": "slack", "category": "notification"},
            {"name": "AWS", "description": "Amazon Web Services", "icon": "aws", "category": "cloud"},
            {"name": "GCP", "description": "Google Cloud Platform", "icon": "gcp", "category": "cloud"},
            {"name": "Azure", "description": "Microsoft Azure", "icon": "azure", "category": "cloud"},
        ]

        # Build a map of existing integrations by name
        existing_map = {i.name: i for i in existing}

        for item in defaults:
            if item["name"] in existing_map:
                # Update existing managed integrations
                if item.get("is_managed"):
                    integration = existing_map[item["name"]]
                    integration.is_managed = True
                    integration.setup_url = item.get("setup_url")
                    integration.description = item["description"]
            else:
                # Create new integration
                integration = Integration(
                    name=item["name"],
                    description=item["description"],
                    icon=item["icon"],
                    category=IntegrationCategory(item["category"]),
                    status=IntegrationStatus.DISCONNECTED,
                    is_managed=item.get("is_managed", False),
                    setup_url=item.get("setup_url"),
                )
                self.db.add(integration)

        await self.db.flush()

        # Auto-detect in-cluster integrations
        await self._auto_detect_integrations(existing_map)

        logger.info("Seeded/updated default integrations")

    async def _auto_detect_integrations(self, existing_map: Dict[str, Integration]):
        """Auto-detect and connect integrations running in the cluster."""
        try:
            from kubernetes import client, config

            # Try to load in-cluster config first, fall back to kubeconfig
            try:
                config.load_incluster_config()
            except config.ConfigException:
                config.load_kube_config()

            v1 = client.CoreV1Api()

            # Detection rules: name -> (namespace patterns, service name patterns, port)
            detection_rules = {
                "Prometheus": {
                    "namespaces": ["monitoring", "prometheus", "observability"],
                    "service_patterns": ["prometheus", "prom-server", "kube-prom-prometheus"],
                    "port": 9090,
                },
                "Grafana": {
                    "namespaces": ["monitoring", "grafana", "observability"],
                    "service_patterns": ["grafana"],
                    "port": 80,
                },
                "ArgoCD": {
                    "namespaces": ["argocd", "argo-cd"],
                    "service_patterns": ["argocd-server", "argo-cd-server"],
                    "port": 443,
                },
                "Jenkins": {
                    "namespaces": ["jenkins", "ci", "cicd"],
                    "service_patterns": ["jenkins"],
                    "port": 8080,
                },
            }

            for name, rules in detection_rules.items():
                if name not in existing_map:
                    continue

                integration = existing_map[name]

                # Skip if already connected
                if integration.status == IntegrationStatus.CONNECTED:
                    continue

                # Search for matching services
                for namespace in rules["namespaces"]:
                    try:
                        services = v1.list_namespaced_service(namespace)
                        for svc in services.items:
                            svc_name = svc.metadata.name.lower()
                            if any(pattern in svc_name for pattern in rules["service_patterns"]):
                                # Found a matching service - check if pods are running
                                pods = v1.list_namespaced_pod(
                                    namespace,
                                    label_selector=f"app.kubernetes.io/name={svc.metadata.labels.get('app.kubernetes.io/name', '')}" if svc.metadata.labels else ""
                                )

                                # Check if any pod is running
                                running_pods = [p for p in pods.items if p.status.phase == "Running"]

                                if running_pods or True:  # Accept if service exists
                                    endpoint = f"http://{svc.metadata.name}.{namespace}.svc.cluster.local:{rules['port']}"

                                    integration.status = IntegrationStatus.CONNECTED
                                    integration.config = {
                                        "endpoint": endpoint,
                                        "auto_detected": True,
                                        "namespace": namespace,
                                        "service": svc.metadata.name,
                                    }
                                    integration.last_sync = datetime.now(timezone.utc)
                                    logger.info(f"Auto-detected {name} at {endpoint}")
                                    break

                        if integration.status == IntegrationStatus.CONNECTED:
                            break
                    except Exception as e:
                        # Namespace doesn't exist or other error, continue
                        logger.debug(f"Auto-detection error for {name} in {namespace}: {e}")
                        continue

            await self.db.flush()

        except ImportError:
            logger.warning("kubernetes package not available for auto-detection")
        except Exception as e:
            logger.warning(f"Auto-detection failed: {e}")

    async def _test_endpoint(self, url: str, timeout: float = 3.0, verify_ssl: bool = True) -> bool:
        """Test if an endpoint is reachable.

        Args:
            url: URL to test
            timeout: Request timeout in seconds
            verify_ssl: Whether to verify SSL certificates (default: True for security)
        """
        try:
            # SSL verification enabled by default for security
            # Only disable for internal/development endpoints if explicitly needed
            async with httpx.AsyncClient(timeout=timeout, verify=verify_ssl) as client:
                response = await client.get(url)
                return response.status_code < 500
        except httpx.ConnectError:
            # Connection failed - endpoint not reachable
            return False
        except httpx.SSLError:
            # SSL verification failed - could be self-signed cert
            # Return False to indicate endpoint not properly configured
            return False
        except Exception:
            return False

    # ============ API Tokens ============

    async def list_tokens(self, user_id: str) -> List[APIToken]:
        """List all API tokens for a user."""
        result = await self.db.execute(
            select(APIToken)
            .where(APIToken.user_id == user_id)
            .order_by(APIToken.created_at.desc())
        )
        return list(result.scalars().all())

    async def get_token(self, token_id: str, user_id: str) -> Optional[APIToken]:
        """Get a specific token."""
        result = await self.db.execute(
            select(APIToken).where(
                APIToken.id == token_id,
                APIToken.user_id == user_id
            )
        )
        return result.scalar_one_or_none()

    async def create_token(self, user_id: str, data: APITokenCreate) -> tuple[APIToken, str]:
        """Create a new API token. Returns tuple of (token_record, raw_token)."""
        # Generate token
        raw_token = f"nxo_{secrets.token_urlsafe(32)}"
        token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
        prefix = raw_token[:7]

        token = APIToken(
            user_id=user_id,
            name=data.name,
            token_hash=token_hash,
            prefix=prefix,
            scopes=data.scopes,
            expires_at=datetime.now(timezone.utc) + timedelta(days=data.expires_in_days),
        )
        self.db.add(token)
        await self.db.commit()
        await self.db.refresh(token)

        return token, raw_token

    async def revoke_token(self, token_id: str, user_id: str) -> bool:
        """Revoke an API token."""
        result = await self.db.execute(
            update(APIToken)
            .where(APIToken.id == token_id, APIToken.user_id == user_id)
            .values(is_revoked=True)
        )
        await self.db.commit()
        return result.rowcount > 0

    async def delete_token(self, token_id: str, user_id: str) -> bool:
        """Delete an API token."""
        result = await self.db.execute(
            delete(APIToken).where(
                APIToken.id == token_id,
                APIToken.user_id == user_id
            )
        )
        await self.db.commit()
        return result.rowcount > 0

    async def validate_token(self, raw_token: str) -> Optional[APIToken]:
        """Validate an API token and return the token record if valid."""
        token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
        result = await self.db.execute(
            select(APIToken).where(
                APIToken.token_hash == token_hash,
                APIToken.is_revoked == False
            )
        )
        token = result.scalar_one_or_none()

        if token and token.expires_at > datetime.utcnow():
            # Update last used
            token.last_used = datetime.utcnow()
            await self.db.flush()
            return token

        return None

    # ============ User Settings ============

    async def get_user_settings(self, user_id: str) -> UserSettings:
        """Get user settings, creating defaults if not exists."""
        result = await self.db.execute(
            select(UserSettings).where(UserSettings.user_id == user_id)
        )
        settings = result.scalar_one_or_none()

        if not settings:
            settings = UserSettings(user_id=user_id)
            self.db.add(settings)
            await self.db.flush()
            await self.db.refresh(settings)

        return settings

    async def update_user_settings(self, user_id: str, data: UserSettingsUpdate) -> UserSettings:
        """Update user settings."""
        settings = await self.get_user_settings(user_id)

        update_data = data.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            if key == "notifications" and value:
                # Merge notification settings
                current = settings.notifications or {}
                current.update(value.model_dump() if hasattr(value, 'model_dump') else value)
                settings.notifications = current
            else:
                setattr(settings, key, value)

        await self.db.flush()
        # Refresh to ensure all attributes are loaded for serialization
        await self.db.refresh(settings)
        return settings

    # ============ User Management (Admin) ============

    async def list_users(self) -> List[User]:
        """List all users (admin only)."""
        result = await self.db.execute(
            select(User).order_by(User.created_at.desc())
        )
        return list(result.scalars().all())

    async def get_user(self, user_id: str) -> Optional[User]:
        """Get a specific user."""
        result = await self.db.execute(
            select(User).where(User.id == user_id)
        )
        return result.scalar_one_or_none()

    async def create_user(self, data: UserCreate) -> User:
        """Create a new local user."""
        user = User(
            username=data.username,
            email=data.email,
            full_name=data.full_name,
            password_hash=get_password_hash(data.password),
            role=UserRole(data.role),
            is_active=True,
        )
        self.db.add(user)
        await self.db.flush()
        return user

    async def update_user(self, user_id: str, data: UserUpdate) -> Optional[User]:
        """Update a user."""
        user = await self.get_user(user_id)
        if not user:
            return None

        update_data = data.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            if key == "role":
                setattr(user, key, UserRole(value))
            else:
                setattr(user, key, value)

        await self.db.flush()
        return user

    async def delete_user(self, user_id: str) -> bool:
        """Delete a user."""
        result = await self.db.execute(
            delete(User).where(User.id == user_id)
        )
        return result.rowcount > 0

    async def toggle_user_status(self, user_id: str) -> Optional[User]:
        """Toggle user active status."""
        user = await self.get_user(user_id)
        if not user:
            return None

        user.is_active = not user.is_active
        await self.db.flush()
        return user
