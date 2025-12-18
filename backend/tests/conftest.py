"""
Pytest configuration and fixtures for NextSight backend tests.
"""
import pytest
import sys
import os
from pathlib import Path

# Load test environment configuration before importing app
test_env_file = Path(__file__).parent.parent / ".env.test"
if test_env_file.exists():
    from dotenv import load_dotenv
    load_dotenv(test_env_file, override=True)
else:
    # Set minimal test environment variables if .env.test doesn't exist
    os.environ.setdefault("USE_DATABASE_AUTH", "false")
    os.environ.setdefault("REDIS_ENABLED", "false")
    os.environ.setdefault("DEBUG", "true")

# Set flag early
APP_AVAILABLE = False
app = None
TestClient = None
AsyncClient = None
ASGITransport = None

# Try to import app, handle gracefully if dependencies aren't available
try:
    from fastapi.testclient import TestClient as _TestClient
    from httpx import AsyncClient as _AsyncClient, ASGITransport as _ASGITransport
    from app.main import app as _app

    APP_AVAILABLE = True
    app = _app
    TestClient = _TestClient
    AsyncClient = _AsyncClient
    ASGITransport = _ASGITransport
except Exception as e:
    print(f"Warning: Could not import app: {e}", file=sys.stderr)


@pytest.fixture(scope="module")
def test_client():
    """Synchronous test client for simple tests."""
    if not APP_AVAILABLE:
        pytest.skip("App not available - dependencies missing")
    with TestClient(app) as client:
        yield client


@pytest.fixture
async def async_client():
    """Async test client for async endpoint testing."""
    if not APP_AVAILABLE:
        pytest.skip("App not available - dependencies missing")
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client


@pytest.fixture
def auth_headers():
    """
    Generate auth headers for protected endpoints.
    Uses a test JWT token - in real tests, this would be dynamically generated.
    """
    return {"Authorization": "Bearer test-token"}


@pytest.fixture
def sample_namespace():
    """Sample namespace for testing."""
    return "default"


@pytest.fixture
def sample_pod_name():
    """Sample pod name for testing."""
    return "test-pod"
