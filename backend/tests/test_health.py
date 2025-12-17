"""
Tests for health check endpoints.
"""
import pytest


class TestHealthEndpoints:
    """Test suite for health check endpoints."""

    def test_root_endpoint(self, test_client):
        """Test the root endpoint returns app info."""
        response = test_client.get("/")
        assert response.status_code == 200

        data = response.json()
        assert "name" in data
        assert "version" in data
        assert "status" in data
        assert data["status"] == "operational"

    def test_health_check(self, test_client):
        """Test the health check endpoint."""
        response = test_client.get("/health")
        assert response.status_code == 200

        data = response.json()
        assert data["status"] == "healthy"

    def test_health_check_response_time(self, test_client):
        """Test that health check responds quickly."""
        import time

        start = time.time()
        response = test_client.get("/health")
        elapsed = time.time() - start

        assert response.status_code == 200
        assert elapsed < 1.0  # Should respond in under 1 second


class TestAPIStructure:
    """Test API structure and documentation."""

    def test_openapi_docs_available(self, test_client):
        """Test that OpenAPI docs are available."""
        response = test_client.get("/openapi.json")
        assert response.status_code == 200

        data = response.json()
        assert "openapi" in data
        assert "info" in data
        assert "paths" in data

    def test_api_title_and_version(self, test_client):
        """Test API metadata is correctly set."""
        response = test_client.get("/openapi.json")
        data = response.json()

        assert data["info"]["title"] == "NextSight Center"
        assert "version" in data["info"]
