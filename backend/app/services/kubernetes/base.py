"""Base class for Kubernetes services with shared initialization and utilities."""

import logging
import os
from datetime import datetime, timezone
from typing import Optional

from kubernetes import client, config
from kubernetes.client.rest import ApiException

from app.core.config import settings

logger = logging.getLogger(__name__)


class KubernetesBase:
    """Base class providing Kubernetes client initialization and utilities."""

    _instance = None
    _initialized = False

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self):
        if not hasattr(self, '_api_client'):
            self._api_client = None
            self._core_v1 = None
            self._apps_v1 = None
            self._networking_v1 = None
            self._batch_v1 = None
            self._autoscaling_v1 = None
            self._storage_v1 = None

    def _initialize(self):
        """Initialize Kubernetes client connections."""
        if self._initialized:
            return

        try:
            if settings.K8S_IN_CLUSTER:
                config.load_incluster_config()
            elif settings.K8S_CONFIG_PATH:
                config_path = os.path.expanduser(settings.K8S_CONFIG_PATH)
                config.load_kube_config(config_file=config_path)
            else:
                config.load_kube_config()

            # Override host for Docker Desktop compatibility
            if settings.K8S_HOST_OVERRIDE:
                configuration = client.Configuration.get_default_copy()
                if configuration.host:
                    configuration.host = configuration.host.replace(
                        "127.0.0.1", settings.K8S_HOST_OVERRIDE
                    ).replace("localhost", settings.K8S_HOST_OVERRIDE)
                    client.Configuration.set_default(configuration)
                    logger.info(f"K8s host overridden to: {configuration.host}")

            self._api_client = client.ApiClient()
            self._core_v1 = client.CoreV1Api(self._api_client)
            self._apps_v1 = client.AppsV1Api(self._api_client)
            self._networking_v1 = client.NetworkingV1Api(self._api_client)
            self._batch_v1 = client.BatchV1Api(self._api_client)
            self._autoscaling_v1 = client.AutoscalingV1Api(self._api_client)
            self._storage_v1 = client.StorageV1Api(self._api_client)
            KubernetesBase._initialized = True
        except Exception as e:
            logger.error(f"Failed to initialize Kubernetes client: {e}")
            raise

    @staticmethod
    def calculate_age(created_at: Optional[datetime]) -> str:
        """Calculate human-readable age from a creation timestamp."""
        if not created_at:
            return "Unknown"
        now = datetime.now(timezone.utc)
        if created_at.tzinfo is None:
            created_at = created_at.replace(tzinfo=timezone.utc)
        delta = now - created_at
        days = delta.days
        hours = delta.seconds // 3600
        minutes = (delta.seconds % 3600) // 60

        if days > 0:
            return f"{days}d"
        elif hours > 0:
            return f"{hours}h"
        else:
            return f"{minutes}m"

    @property
    def core_v1(self):
        """Get CoreV1Api client."""
        self._initialize()
        return self._core_v1

    @property
    def apps_v1(self):
        """Get AppsV1Api client."""
        self._initialize()
        return self._apps_v1

    @property
    def networking_v1(self):
        """Get NetworkingV1Api client."""
        self._initialize()
        return self._networking_v1

    @property
    def batch_v1(self):
        """Get BatchV1Api client."""
        self._initialize()
        return self._batch_v1

    @property
    def autoscaling_v1(self):
        """Get AutoscalingV1Api client."""
        self._initialize()
        return self._autoscaling_v1

    @property
    def storage_v1(self):
        """Get StorageV1Api client."""
        self._initialize()
        return self._storage_v1
