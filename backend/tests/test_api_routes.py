"""
Tests for API route availability.
These tests verify that routes are registered and respond appropriately.
"""
import pytest


class TestSecurityRoutes:
    """Test security-related API routes."""

    def test_security_score_endpoint_exists(self, test_client):
        """Test that security score endpoint is registered."""
        response = test_client.get("/api/v1/security/score")
        # Should return 200 or auth error, not 404
        assert response.status_code != 404

    def test_security_dashboard_endpoint_exists(self, test_client):
        """Test that security dashboard endpoint is registered."""
        response = test_client.get("/api/v1/security/dashboard")
        assert response.status_code != 404

    def test_security_rbac_endpoint_exists(self, test_client):
        """Test that RBAC analysis endpoint is registered."""
        response = test_client.get("/api/v1/security/rbac")
        assert response.status_code != 404

    def test_security_network_policies_endpoint_exists(self, test_client):
        """Test that network policies endpoint is registered."""
        response = test_client.get("/api/v1/security/network-policies")
        assert response.status_code != 404


class TestAuthRoutes:
    """Test authentication API routes."""

    def test_login_endpoint_exists(self, test_client):
        """Test that login endpoint is registered."""
        response = test_client.post("/api/v1/auth/login", json={})
        # Should return validation error or auth error, not 404
        assert response.status_code != 404

    def test_me_endpoint_exists(self, test_client):
        """Test that /me endpoint is registered."""
        response = test_client.get("/api/v1/auth/me")
        assert response.status_code != 404


class TestKubernetesRoutes:
    """Test Kubernetes API routes."""

    def test_namespaces_endpoint_exists(self, test_client):
        """Test that namespaces endpoint is registered."""
        response = test_client.get("/api/v1/kubernetes/namespaces")
        assert response.status_code != 404

    def test_pods_endpoint_exists(self, test_client):
        """Test that pods endpoint is registered."""
        response = test_client.get("/api/v1/kubernetes/pods")
        assert response.status_code != 404

    def test_deployments_endpoint_exists(self, test_client):
        """Test that deployments endpoint is registered."""
        response = test_client.get("/api/v1/kubernetes/deployments")
        assert response.status_code != 404

    def test_nodes_endpoint_exists(self, test_client):
        """Test that nodes endpoint is registered."""
        response = test_client.get("/api/v1/kubernetes/nodes")
        assert response.status_code != 404


class TestCostRoutes:
    """Test cost management API routes."""

    def test_cost_dashboard_endpoint_exists(self, test_client):
        """Test that cost dashboard endpoint is registered."""
        response = test_client.get("/api/v1/cost/dashboard")
        assert response.status_code != 404
