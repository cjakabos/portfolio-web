"""Real production remotes, real CloudApp identity, deterministic model transport."""
import os
import pytest
import requests

GATEWAY = os.getenv("NGINX_URL", "http://test-nginx:80")


@pytest.fixture(scope="module")
def identities():
    cookies = {}
    for user, password in (("remotetest", "secureRemotePass123"), ("integrationadmin", "secureAdminPass123")):
        credentials = {"username": user, "password": password}
        requests.post(GATEWAY + "/cloudapp/user/user-register",
                      json={**credentials, "confirmPassword": password}, timeout=10)
        response = requests.post(GATEWAY + "/cloudapp/user/user-login", json=credentials, timeout=10)
        assert response.status_code == 200, response.text
        cookies[user] = {"CLOUDAPP_AUTH": response.cookies["CLOUDAPP_AUTH"]}
    return cookies


@pytest.mark.parametrize("module,host,port,user", [
    ("chatllm", "test-chatllm-frontend", 5333, "remotetest"),
    ("jira", "test-jira-frontend", 5003, "integrationadmin"),
])
def test_production_pages_federation_and_authenticated_streams(module, host, port, user, identities):
    direct = f"http://{host}:{port}"
    assert requests.get(direct + "/", timeout=10).status_code == 200
    entry = requests.get(direct + "/_next/static/chunks/remoteEntry.js", timeout=10)
    assert entry.status_code == 200 and len(entry.content) > 100
    body = {"model": "fixture-model", "messages": [
        {"id": "u1", "role": "user", "parts": [{"type": "text", "text": "private-runtime-prompt"}]}
    ]}
    for base in (direct + "/api", GATEWAY + "/ai-remotes/" + module):
        spoofed = {"X-Auth-Roles": "ROLE_ADMIN", "X-Internal-Service-Token": "forged"}
        assert requests.get(base + "/models", headers=spoofed, timeout=10).status_code in (401, 403)
        assert requests.post(base + "/chat", headers=spoofed, json=body, timeout=10).status_code in (401, 403)
        models = requests.get(base + "/models", cookies=identities[user], timeout=10)
        assert models.status_code == 200, models.text
        assert models.json()["models"][0]["name"] == "fixture-model"
        if module == "jira":
            assert requests.get(base + "/models", cookies=identities["remotetest"], timeout=10).status_code == 403
        reply = requests.post(base + "/chat", cookies=identities[user], json=body, timeout=20)
        assert reply.status_code == 200, reply.text
        assert reply.headers["Content-Type"].startswith("text/event-stream")
        assert "fixture " in reply.text and "answer" in reply.text
        missing = requests.post(base + "/chat", cookies=identities[user],
                                json={**body, "model": "missing-model"}, timeout=10)
        assert missing.status_code == 400
    blocked = requests.get(direct + "/api/models", cookies=identities[user],
                           headers={"Origin": "http://untrusted.invalid"}, timeout=10)
    assert blocked.status_code == 403
