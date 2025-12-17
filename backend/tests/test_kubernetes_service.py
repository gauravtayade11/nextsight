"""
Tests for Kubernetes service endpoints.
"""
import pytest


class TestNamespaces:
    """Test namespace-related endpoints."""

    def test_list_namespaces_requires_auth(self, test_client):
        """Test that listing namespaces requires authentication."""
        response = test_client.get("/api/v1/kubernetes/namespaces")
        assert response.status_code == 401

    def test_create_namespace_endpoint_exists(self, test_client):
        """Test namespace creation endpoint exists."""
        response = test_client.post(
            "/api/v1/kubernetes/namespaces",
            json={"name": "test-namespace"},
        )
        assert response.status_code != 404


class TestPods:
    """Test pod-related endpoints."""

    def test_list_pods_requires_auth(self, test_client):
        """Test that listing pods requires authentication."""
        response = test_client.get("/api/v1/kubernetes/pods")
        assert response.status_code == 401

    def test_list_pods_with_namespace_param(self, test_client):
        """Test pods endpoint accepts namespace parameter."""
        response = test_client.get("/api/v1/kubernetes/pods?namespace=default")
        # Should return 401 (auth required), not 422 (validation error)
        assert response.status_code == 401

    def test_pod_logs_endpoint_exists(self, test_client):
        """Test pod logs endpoint exists."""
        response = test_client.get(
            "/api/v1/kubernetes/pods/test-pod/logs",
            params={"namespace": "default"},
        )
        assert response.status_code != 404

    def test_pod_exec_endpoint_exists(self, test_client):
        """Test pod exec endpoint exists."""
        response = test_client.post(
            "/api/v1/kubernetes/pods/test-pod/exec",
            json={"namespace": "default", "command": "ls"},
        )
        assert response.status_code != 404


class TestDeployments:
    """Test deployment-related endpoints."""

    def test_list_deployments_requires_auth(self, test_client):
        """Test that listing deployments requires authentication."""
        response = test_client.get("/api/v1/kubernetes/deployments")
        assert response.status_code == 401

    def test_scale_deployment_endpoint_exists(self, test_client):
        """Test deployment scaling endpoint exists."""
        response = test_client.post(
            "/api/v1/kubernetes/deployments/test-deployment/scale",
            json={"namespace": "default", "replicas": 3},
        )
        assert response.status_code != 404

    def test_restart_deployment_endpoint_exists(self, test_client):
        """Test deployment restart endpoint exists."""
        response = test_client.post(
            "/api/v1/kubernetes/deployments/test-deployment/restart",
            json={"namespace": "default"},
        )
        assert response.status_code != 404


class TestStatefulSets:
    """Test statefulset-related endpoints."""

    def test_list_statefulsets_requires_auth(self, test_client):
        """Test that listing statefulsets requires authentication."""
        response = test_client.get("/api/v1/kubernetes/statefulsets")
        assert response.status_code == 401


class TestServices:
    """Test service-related endpoints."""

    def test_list_services_requires_auth(self, test_client):
        """Test that listing services requires authentication."""
        response = test_client.get("/api/v1/kubernetes/services")
        assert response.status_code == 401


class TestConfigMaps:
    """Test configmap-related endpoints."""

    def test_list_configmaps_requires_auth(self, test_client):
        """Test that listing configmaps requires authentication."""
        response = test_client.get("/api/v1/kubernetes/configmaps")
        assert response.status_code == 401


class TestSecrets:
    """Test secret-related endpoints."""

    def test_list_secrets_requires_auth(self, test_client):
        """Test that listing secrets requires authentication."""
        response = test_client.get("/api/v1/kubernetes/secrets")
        assert response.status_code == 401


class TestNodes:
    """Test node-related endpoints."""

    def test_list_nodes_requires_auth(self, test_client):
        """Test that listing nodes requires authentication."""
        response = test_client.get("/api/v1/kubernetes/nodes")
        assert response.status_code == 401


class TestStorage:
    """Test storage-related endpoints."""

    def test_list_pvcs_requires_auth(self, test_client):
        """Test that listing PVCs requires authentication."""
        response = test_client.get("/api/v1/kubernetes/pvcs")
        assert response.status_code == 401

    def test_list_pvs_requires_auth(self, test_client):
        """Test that listing PVs requires authentication."""
        response = test_client.get("/api/v1/kubernetes/pvs")
        assert response.status_code == 401

    def test_list_storage_classes_requires_auth(self, test_client):
        """Test that listing storage classes requires authentication."""
        response = test_client.get("/api/v1/kubernetes/storageclasses")
        assert response.status_code == 401


class TestClusterMetrics:
    """Test cluster metrics endpoints."""

    def test_cluster_metrics_endpoint_exists(self, test_client):
        """Test cluster metrics endpoint exists."""
        response = test_client.get("/api/v1/kubernetes/metrics/cluster")
        assert response.status_code != 404

    def test_node_metrics_endpoint_exists(self, test_client):
        """Test node metrics endpoint exists."""
        response = test_client.get("/api/v1/kubernetes/metrics/nodes")
        assert response.status_code != 404


class TestResourceYAML:
    """Test YAML-related endpoints."""

    def test_get_resource_yaml_endpoint_exists(self, test_client):
        """Test get resource YAML endpoint exists."""
        response = test_client.get(
            "/api/v1/kubernetes/yaml/deployments/test",
            params={"namespace": "default"},
        )
        assert response.status_code != 404

    def test_apply_yaml_endpoint_exists(self, test_client):
        """Test apply YAML endpoint exists."""
        response = test_client.post(
            "/api/v1/kubernetes/apply",
            json={
                "yaml": "apiVersion: v1\nkind: ConfigMap\nmetadata:\n  name: test",
                "namespace": "default",
            },
        )
        assert response.status_code != 404
