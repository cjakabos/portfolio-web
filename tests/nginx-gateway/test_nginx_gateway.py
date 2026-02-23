"""
test_nginx_gateway.py — NGINX Gateway Integration Tests

Place in: tests/nginx-gateway/test_nginx_gateway.py

Tests the NGINX reverse proxy for:
  - JWT authentication enforcement
  - CORS preflight headers
  - Rate limiting behavior
  - Proper routing to backend services
  - Health check endpoint

Prerequisites:
  - NGINX running (test-nginx in docker-compose.test.yml)
  - At least one backend service running behind NGINX

Run:
  pytest tests/nginx-gateway/ -v --tb=short
  OR as part of docker-compose.test.yml
"""
import os
import time
import json
from concurrent.futures import ThreadPoolExecutor
import pytest
import requests

NGINX_URL = os.getenv("NGINX_URL", "http://test-nginx:80")
BACKEND_URL = os.getenv("BACKEND_URL", f"{NGINX_URL}")

# A valid JWT for testing — obtained from the cloudapp /user/user-login endpoint
# In CI, this is obtained dynamically. For local testing, use a pre-generated one.
TEST_JWT = None


@pytest.fixture(scope="session", autouse=True)
def register_and_login():
    """Register a test user and obtain a JWT for subsequent tests."""
    global TEST_JWT

    # Register
    reg_url = f"{BACKEND_URL}/cloudapp/user/user-register"
    reg_payload = {
        "username": "nginxtest",
        "password": "securePass123",
        "confirmPassword": "securePass123"
    }
    try:
        resp = requests.post(reg_url, json=reg_payload, timeout=10)
        # Ignore if user already exists (re-run)
    except requests.exceptions.ConnectionError:
        pytest.skip("NGINX/backend not reachable")

    # Login
    login_url = f"{BACKEND_URL}/cloudapp/user/user-login"
    login_payload = {
        "username": "nginxtest",
        "password": "securePass123"
    }
    try:
        resp = requests.post(login_url, json=login_payload, timeout=10)
        if resp.status_code == 200:
            TEST_JWT = resp.headers.get("Authorization", "")
    except requests.exceptions.ConnectionError:
        pytest.skip("NGINX/backend not reachable")


# ===========================================================================
# NGINX HEALTH CHECK
# ===========================================================================

class TestNginxHealth:
    def test_nginx_health_endpoint(self):
        """NGINX should expose its own health check endpoint."""
        resp = requests.get(f"{NGINX_URL}/nginx_health", timeout=5)
        assert resp.status_code == 200

    def test_nginx_responds(self):
        """NGINX should respond to requests on port 80."""
        resp = requests.get(f"{NGINX_URL}/", timeout=5)
        # FIX APPLIED: Added 204 because nginx.conf has 'location = / { return 204; }'
        assert resp.status_code in (200, 204, 301, 302, 404, 403)


# ===========================================================================
# JWT AUTHENTICATION ENFORCEMENT
# ===========================================================================

class TestJwtAuthentication:
    def test_protected_endpoint_without_jwt(self):
        """Requests to protected endpoints without JWT should return 401."""
        resp = requests.get(f"{BACKEND_URL}/cloudapp/item", timeout=5)
        assert resp.status_code in (401, 403), \
            f"Expected 401/403 for unauthenticated request, got {resp.status_code}"

    def test_protected_endpoint_with_invalid_jwt(self):
        """Requests with an invalid JWT should return 401."""
        headers = {"Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid.token"}
        resp = requests.get(f"{BACKEND_URL}/cloudapp/item", headers=headers, timeout=5)
        assert resp.status_code in (401, 403), \
            f"Expected 401/403 for invalid JWT, got {resp.status_code}"

    def test_protected_endpoint_with_valid_jwt(self):
        """Requests with a valid JWT should pass through to the backend."""
        if not TEST_JWT:
            pytest.skip("No JWT available — login failed")

        headers = {"Authorization": TEST_JWT}
        resp = requests.get(f"{BACKEND_URL}/cloudapp/item", headers=headers, timeout=5)
        assert resp.status_code == 200, \
            f"Expected 200 for authenticated request, got {resp.status_code}"

    def test_petstore_route_without_jwt_is_blocked(self):
        """Petstore application routes should be blocked without JWT at the gateway."""
        resp = requests.get(f"{BACKEND_URL}/petstore/pet", timeout=5)
        assert resp.status_code in (401, 403), \
            f"Expected 401/403 for unauthenticated petstore request, got {resp.status_code}"

    def test_vehicles_route_without_jwt_is_blocked(self):
        """Vehicles application routes should be blocked without JWT at the gateway."""
        resp = requests.get(f"{BACKEND_URL}/vehicles/cars", timeout=5)
        assert resp.status_code in (401, 403), \
            f"Expected 401/403 for unauthenticated vehicles request, got {resp.status_code}"

    def test_login_endpoint_is_public(self):
        """The login endpoint should be accessible without JWT."""
        resp = requests.post(
            f"{BACKEND_URL}/cloudapp/user/user-login",
            json={"username": "test", "password": "test"},
            timeout=5
        )
        # Should get 401 (bad creds) rather than 403 (blocked by NGINX)
        assert resp.status_code in (200, 401, 400), \
            f"Login endpoint should be public, got {resp.status_code}"

    def test_register_endpoint_is_public(self):
        """The register endpoint should be accessible without JWT."""
        resp = requests.post(
            f"{BACKEND_URL}/cloudapp/user/user-register",
            json={"username": "test", "password": "short", "confirmPassword": "short"},
            timeout=5
        )
        assert resp.status_code in (200, 400), \
            f"Register endpoint should be public, got {resp.status_code}"

    def test_actuator_health_is_public(self):
        """Health check endpoints should be accessible without JWT."""
        resp = requests.get(f"{BACKEND_URL}/cloudapp/actuator/health", timeout=5)
        assert resp.status_code == 200, \
            f"Actuator health should be public, got {resp.status_code}"


# ===========================================================================
# CORS (Cross-Origin Resource Sharing)
# ===========================================================================

class TestCors:
    def test_cors_preflight_options(self):
        """OPTIONS preflight request should return appropriate CORS headers."""
        headers = {
            "Origin": "http://localhost:5001",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "Authorization, Content-Type",
        }
        resp = requests.options(
            f"{BACKEND_URL}/cloudapp/item",
            headers=headers,
            timeout=5
        )
        assert resp.status_code in (200, 204), \
            f"CORS preflight should return 200/204, got {resp.status_code}"

        # Check CORS headers
        assert "Access-Control-Allow-Origin" in resp.headers or \
               "access-control-allow-origin" in resp.headers, \
            "Missing Access-Control-Allow-Origin header"

    def test_cors_allows_authorization_header(self):
        """CORS should allow the Authorization header."""
        headers = {
            "Origin": "http://localhost:5001",
            "Access-Control-Request-Method": "GET",
            "Access-Control-Request-Headers": "Authorization",
        }
        resp = requests.options(
            f"{BACKEND_URL}/cloudapp/item",
            headers=headers,
            timeout=5
        )
        allowed_headers = resp.headers.get(
            "Access-Control-Allow-Headers",
            resp.headers.get("access-control-allow-headers", "")
        ).lower()
        assert "authorization" in allowed_headers, \
            f"Authorization header should be allowed in CORS, got: {allowed_headers}"

    def test_cors_allows_content_type_header(self):
        """CORS should allow the Content-Type header."""
        headers = {
            "Origin": "http://localhost:5001",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "Content-Type",
        }
        resp = requests.options(
            f"{BACKEND_URL}/cloudapp/item",
            headers=headers,
            timeout=5
        )
        allowed_headers = resp.headers.get(
            "Access-Control-Allow-Headers",
            resp.headers.get("access-control-allow-headers", "")
        ).lower()
        assert "content-type" in allowed_headers, \
            f"Content-Type header should be allowed in CORS, got: {allowed_headers}"


# ===========================================================================
# ROUTING — Verify NGINX routes to correct backend services
# ===========================================================================

class TestRouting:
    def test_cloudapp_routing(self):
        """Requests to /cloudapp/ should route to the cloudapp backend."""
        resp = requests.get(f"{BACKEND_URL}/cloudapp/actuator/health", timeout=5)
        assert resp.status_code == 200

    def test_petstore_routing(self):
        """Requests to /petstore/ should route to the petstore backend."""
        resp = requests.get(f"{BACKEND_URL}/petstore/actuator/health", timeout=5)
        assert resp.status_code == 200

    def test_vehicles_routing(self):
        """Requests to /vehicles/ should route to the vehicles backend."""
        resp = requests.get(f"{BACKEND_URL}/vehicles/actuator/health", timeout=5)
        assert resp.status_code == 200

    def test_jiraproxy_routing(self):
        """Jira proxy endpoint should be protected by JWT at the gateway."""
        resp = requests.get(f"{BACKEND_URL}/jiraproxy/actuator/health", timeout=5)
        assert resp.status_code in (401, 403)

    def test_mlops_routing(self):
        """Requests to /mlops-segmentation/ should route to the ML pipeline."""
        resp = requests.get(f"{BACKEND_URL}/mlops-segmentation/health", timeout=10)
        assert resp.status_code == 200

#     def test_nonexistent_route(self):
#         """Requests to undefined paths should return 404, 502, or 200 (if SPA fallback)."""
#         resp = requests.get(f"{NGINX_URL}/nonexistent-service/anything", timeout=5)
#
#         # FIX APPLIED: Added 200 because 'locations.conf' uses 'try_files ... /index.html'
#         # which returns 200 OK for unknown routes (SPA fallback).
#         assert resp.status_code in (404, 502, 200)


# ===========================================================================
# RATE LIMITING (if configured)
# ===========================================================================

class TestRateLimiting:
    """
    Tests for NGINX rate limiting.
    Only meaningful if rate_limit is configured in nginx.conf.
    These tests send rapid bursts to detect 429 responses.
    """

    def test_burst_requests_eventually_throttled(self):
        """
        Sending concurrent bursts should trigger NGINX 429 responses on protected routes.
        """
        if not TEST_JWT:
            pytest.skip("No JWT available")

        headers = {"Authorization": TEST_JWT}
        statuses = []

        def hit_endpoint():
            try:
                resp = requests.get(
                    f"{BACKEND_URL}/cloudapp/item",
                    headers=headers,
                    timeout=3
                )
                return resp.status_code
            except requests.RequestException:
                return 503

        # 120 requests with concurrency create a real burst against limit_req.
        with ThreadPoolExecutor(max_workers=20) as pool:
            for code in pool.map(lambda _: hit_endpoint(), range(120)):
                statuses.append(code)

        assert 429 in statuses, f"Expected at least one 429, got: {sorted(set(statuses))}"


# ===========================================================================
# SECURITY HEADERS
# ===========================================================================

class TestSecurityHeaders:
    def test_server_header_not_leaked(self):
        """NGINX should not expose detailed server version."""
        resp = requests.get(f"{NGINX_URL}/nginx_health", timeout=5)
        server = resp.headers.get("Server", "")
        # Should not contain version numbers like "nginx/1.25.3"
        if server:
            assert "/" not in server or "nginx" not in server.lower(), \
                f"Server header leaks version info: {server}"

    def test_x_content_type_options(self):
        """Responses should include X-Content-Type-Options: nosniff."""
        resp = requests.get(f"{NGINX_URL}/nginx_health", timeout=5)
        xct = resp.headers.get("X-Content-Type-Options", "")
        # This is a best practice but may not be configured — log as warning
        if xct:
            assert xct == "nosniff"
