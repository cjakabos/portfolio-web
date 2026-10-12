"""Verify operator identity with CloudApp before accessing ML data or jobs."""
import os

import requests
from flask import jsonify, request


def require_admin():
    headers = {
        name: request.headers[name]
        for name in ("Authorization", "Cookie", "traceparent", "tracestate")
        if request.headers.get(name)
    }
    if not headers.get("Authorization") and not headers.get("Cookie"):
        return jsonify({"error": "Authentication required"}), 401

    cloudapp_url = os.environ.get("CLOUDAPP_URL", "http://cloudapp:8099/cloudapp").rstrip("/")
    try:
        response = requests.get(
            f"{cloudapp_url}/user/admin/auth-check",
            headers=headers, timeout=5, allow_redirects=False,
        )
        if response.status_code == 401:
            return jsonify({"error": "Authentication required"}), 401
        if response.status_code == 403:
            return jsonify({"error": "Administrator access required"}), 403
        if response.status_code != 200:
            return jsonify({"error": "Authentication service unavailable"}), 503
        principal = response.json()
    except (requests.RequestException, ValueError):
        return jsonify({"error": "Authentication service unavailable"}), 503

    if (not isinstance(principal, dict)
            or not isinstance(principal.get("username"), str)
            or not principal["username"].strip()):
        return jsonify({"error": "Authentication verification failed"}), 503
    roles = principal.get("roles")
    if not isinstance(roles, list) or "ROLE_ADMIN" not in roles:
        return jsonify({"error": "Administrator access required"}), 403
    return None
