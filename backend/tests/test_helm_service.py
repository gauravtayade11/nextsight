"""
Tests for Helm service endpoints.
"""
import pytest


class TestHelmReleases:
    """Test Helm release-related endpoints."""

    def test_list_releases_requires_auth(self, test_client):
        """Test that listing releases requires authentication."""
        response = test_client.get("/api/v1/helm/releases")
        assert response.status_code == 401

    def test_list_releases_with_namespace(self, test_client):
        """Test releases endpoint accepts namespace parameter."""
        response = test_client.get("/api/v1/helm/releases?namespace=default")
        assert response.status_code == 401

    def test_get_release_details_endpoint_exists(self, test_client):
        """Test release details endpoint exists."""
        response = test_client.get(
            "/api/v1/helm/releases/test-release",
            params={"namespace": "default"},
        )
        assert response.status_code != 404


class TestHelmCharts:
    """Test Helm chart-related endpoints."""

    def test_search_charts_endpoint_exists(self, test_client):
        """Test chart search endpoint exists."""
        response = test_client.get("/api/v1/helm/charts/search?q=nginx")
        assert response.status_code != 404

    def test_chart_info_endpoint_exists(self, test_client):
        """Test chart info endpoint exists."""
        response = test_client.get("/api/v1/helm/charts/bitnami/nginx")
        assert response.status_code != 404


class TestHelmRepositories:
    """Test Helm repository-related endpoints."""

    def test_list_repositories_requires_auth(self, test_client):
        """Test that listing repos requires authentication."""
        response = test_client.get("/api/v1/helm/repositories")
        assert response.status_code == 401

    def test_add_repository_endpoint_exists(self, test_client):
        """Test add repository endpoint exists."""
        response = test_client.post(
            "/api/v1/helm/repositories",
            json={
                "name": "test-repo",
                "url": "https://charts.example.com",
            },
        )
        assert response.status_code != 404

    def test_update_repositories_endpoint_exists(self, test_client):
        """Test update repositories endpoint exists."""
        response = test_client.post("/api/v1/helm/repositories/update")
        assert response.status_code != 404


class TestHelmInstall:
    """Test Helm install-related endpoints."""

    def test_install_chart_endpoint_exists(self, test_client):
        """Test chart install endpoint exists."""
        response = test_client.post(
            "/api/v1/helm/install",
            json={
                "name": "test-release",
                "chart": "bitnami/nginx",
                "namespace": "default",
            },
        )
        assert response.status_code != 404


class TestHelmUpgrade:
    """Test Helm upgrade-related endpoints."""

    def test_upgrade_release_endpoint_exists(self, test_client):
        """Test release upgrade endpoint exists."""
        response = test_client.post(
            "/api/v1/helm/releases/test-release/upgrade",
            json={
                "chart": "bitnami/nginx",
                "namespace": "default",
            },
        )
        assert response.status_code != 404


class TestHelmUninstall:
    """Test Helm uninstall-related endpoints."""

    def test_uninstall_release_endpoint_exists(self, test_client):
        """Test release uninstall endpoint exists."""
        response = test_client.delete(
            "/api/v1/helm/releases/test-release",
            params={"namespace": "default"},
        )
        assert response.status_code != 404


class TestHelmRollback:
    """Test Helm rollback-related endpoints."""

    def test_rollback_release_endpoint_exists(self, test_client):
        """Test release rollback endpoint exists."""
        response = test_client.post(
            "/api/v1/helm/releases/test-release/rollback",
            json={"namespace": "default", "revision": 1},
        )
        assert response.status_code != 404


class TestHelmHistory:
    """Test Helm history-related endpoints."""

    def test_release_history_endpoint_exists(self, test_client):
        """Test release history endpoint exists."""
        response = test_client.get(
            "/api/v1/helm/releases/test-release/history",
            params={"namespace": "default"},
        )
        assert response.status_code != 404


class TestHelmValues:
    """Test Helm values-related endpoints."""

    def test_release_values_endpoint_exists(self, test_client):
        """Test release values endpoint exists."""
        response = test_client.get(
            "/api/v1/helm/releases/test-release/values",
            params={"namespace": "default"},
        )
        assert response.status_code != 404

    def test_chart_default_values_endpoint_exists(self, test_client):
        """Test chart default values endpoint exists."""
        response = test_client.get("/api/v1/helm/charts/bitnami/nginx/values")
        assert response.status_code != 404


class TestHelmTemplates:
    """Test Helm template-related endpoints."""

    def test_template_preview_endpoint_exists(self, test_client):
        """Test template preview endpoint exists."""
        response = test_client.post(
            "/api/v1/helm/template",
            json={
                "chart": "bitnami/nginx",
                "values": {},
            },
        )
        assert response.status_code != 404
