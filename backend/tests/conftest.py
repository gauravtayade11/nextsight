"""
Pytest configuration and fixtures for NexOps backend tests.
"""
import pytest
from fastapi.testclient import TestClient
from httpx import AsyncClient, ASGITransport

from app.main import app


@pytest.fixture(scope="module")
def test_client():
    """Synchronous test client for simple tests."""
    with TestClient(app) as client:
        yield client


@pytest.fixture
async def async_client():
    """Async test client for async endpoint testing."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client


@pytest.fixture
def auth_headers():
    """
    Generate auth headers for protected endpoints.
    Uses a test JWT token - in real tests, this would be dynamically generated.
    """
    # This is a test token - replace with actual token generation in integration tests
    return {"Authorization": "Bearer test-token"}


@pytest.fixture
def sample_namespace():
    """Sample namespace for testing."""
    return "default"


@pytest.fixture
def sample_pod_name():
    """Sample pod name for testing."""
    return "test-pod"
