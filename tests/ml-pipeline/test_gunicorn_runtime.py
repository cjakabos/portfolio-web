"""Start the real WSGI server; only the external identity response is a fixture."""
import json
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import socket
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.request


def test_gunicorn_serves_health_and_preserves_administrator_boundary():
    class Identity(BaseHTTPRequestHandler):
        def do_GET(self):
            token = self.headers.get("Authorization")
            code = 200 if token == "Bearer fixture-admin" else 403 if token == "Bearer fixture-user" else 401
            self.send_response(code)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"username": "verified-admin", "roles": ["ROLE_ADMIN"]}).encode())

        def log_message(self, *args):
            pass

    identity = ThreadingHTTPServer(("127.0.0.1", 0), Identity)
    thread = threading.Thread(target=identity.serve_forever, daemon=True)
    thread.start()
    with socket.socket() as reservation:
        reservation.bind(("127.0.0.1", 0))
        port = reservation.getsockname()[1]
    env = {**os.environ, "CLOUDAPP_URL": f"http://127.0.0.1:{identity.server_port}", "FLASK_DEBUG": "0"}
    process = subprocess.Popen([sys.executable, "-m", "gunicorn", "--bind", f"127.0.0.1:{port}",
                                "--workers", "1", "--timeout", "30", "wsgi:application"],
                               cwd="/src", env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)

    def get(path, token=None):
        headers = {"Authorization": "Bearer " + token} if token else {}
        try:
            with urllib.request.urlopen(urllib.request.Request(f"http://127.0.0.1:{port}/mlops-segmentation/{path}", headers=headers), timeout=2) as response:
                return response.status, response.read()
        except urllib.error.HTTPError as error:
            return error.code, error.read()

    try:
        deadline = time.monotonic() + 20
        while True:
            assert process.poll() is None, "Gunicorn exited before readiness"
            try:
                status, body = get("health")
                if status == 200:
                    break
            except (urllib.error.URLError, TimeoutError):
                pass
            assert time.monotonic() < deadline, "Gunicorn did not become healthy"
            time.sleep(.1)
        assert json.loads(body)["database"] == "connected"
        assert get("getSegmentationCustomers")[0] == 401
        assert get("getSegmentationCustomers", "fixture-user")[0] == 403
        status, body = get("getSegmentationCustomers", "fixture-admin")
        assert status == 200 and json.loads(body) == []
    finally:
        process.terminate()
        try:
            output = process.communicate(timeout=10)[0]
        except subprocess.TimeoutExpired:
            process.kill()
            output = process.communicate()[0]
        identity.shutdown()
        identity.server_close()
        thread.join(timeout=3)
    assert process.returncode == 0, output.decode(errors="replace")
