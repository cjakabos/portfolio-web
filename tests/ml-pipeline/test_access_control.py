"""Authorization is exercised through the Flask HTTP boundary before domain work."""
import json

import pytest
import requests

import app as app_module
import access_control


OPERATIONS = (
    ("GET", "/mlops-segmentation/getSegmentationCustomers", None),
    ("POST", "/mlops-segmentation/getMLInfo", {"sampleSize": 10}),
    ("POST", "/mlops-segmentation/addCustomer", {"fields": {"age": 42}}),
)


def test_ml_operations_reject_unauthenticated_and_regular_users(app, monkeypatch, cloudapp_auth):
    def forbidden_work(*args, **kwargs):
        pytest.fail("Rejected caller reached ML data or job execution")

    for name in ("get_db_connection", "get_sqlalchemy_connection", "run_script"):
        monkeypatch.setattr(app_module, name, forbidden_work)
    anonymous = app.test_client()
    spoofed = {"X-Auth-User": "admin", "X-Auth-Roles": "ROLE_ADMIN",
               "X-Internal-Service-Name": "ai-orchestration",
               "X-Internal-Service-Token": "test-ai-orchestration-token"}
    for method, path, payload in OPERATIONS:
        for headers in ({}, spoofed, {**spoofed, "Authorization": "Bearer fixture-user"},
                        {"Authorization": "Bearer invalid"}):
            response = anonymous.open(path, method=method, json=payload, headers=headers)
            expected = 403 if headers.get("Authorization") == "Bearer fixture-user" else 401
            assert response.status_code == expected
    assert all(url == "http://cloudapp.test/cloudapp/user/admin/auth-check" for url, *_ in cloudapp_auth)
    assert all(timeout == 5 and redirects is False for _, _, timeout, redirects in cloudapp_auth)


def test_admin_cookie_can_read_customer_results_and_health_stays_public(app, seed_customers):
    client = app.test_client()
    assert client.get("/mlops-segmentation/health").status_code == 200
    client.set_cookie("CLOUDAPP_AUTH", "fixture-admin")
    response = client.get("/mlops-segmentation/getSegmentationCustomers")
    assert response.status_code == 200
    assert len(json.loads(response.data)) == len(seed_customers)


@pytest.mark.parametrize("status,payload,expected", [
    (200, {"username": "regular", "roles": ["ROLE_USER"]}, 403),
    (200, {"roles": ["ROLE_ADMIN"]}, 503),
    (200, {"username": "admin", "roles": "ROLE_ADMIN"}, 403),
    (302, {}, 503), (500, {}, 503),
])
def test_unverified_admin_responses_fail_closed(client, monkeypatch, status, payload, expected):
    response = requests.Response()
    response.status_code = status
    response._content = json.dumps(payload).encode()
    monkeypatch.setattr(access_control.requests, "get", lambda *args, **kwargs: response)
    assert client.get("/mlops-segmentation/getSegmentationCustomers").status_code == expected


def test_identity_timeout_fails_closed(client, monkeypatch):
    def unavailable(*args, **kwargs):
        raise requests.Timeout("fixture timeout")
    monkeypatch.setattr(access_control.requests, "get", unavailable)
    assert client.get("/mlops-segmentation/getSegmentationCustomers").status_code == 503
