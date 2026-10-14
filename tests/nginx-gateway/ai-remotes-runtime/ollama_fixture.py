"""Disposable Ollama transport fixture; never contacts a live model service."""
import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
class Ollama(BaseHTTPRequestHandler):
    def log_message(self, *args): pass
    def do_GET(self):
        self.send_response(200 if self.path == '/api/tags' else 404)
        self.send_header('Content-Type', 'application/json'); self.end_headers()
        self.wfile.write(json.dumps({'models': [{'name': 'fixture-model', 'model': 'fixture-model', 'size': 1024, 'digest': 'fixture', 'modified_at': '2026-10-14T00:00:00Z', 'details': {'family': 'fixture', 'format': 'gguf'}}]}).encode())
    def do_POST(self):
        data=json.loads(self.rfile.read(int(self.headers.get('Content-Length',0))))
        if data.get('think'):
            self.send_response(400); self.send_header('Content-Type','application/json'); self.end_headers(); self.wfile.write(b'{"error":"thinking unsupported"}'); return
        self.send_response(200); self.send_header('Content-Type','application/x-ndjson'); self.end_headers()
        for chunk in [{'message': {'role':'assistant','content':'fixture '},'done':False}, {'message': {'role':'assistant','content':'answer'},'done':False}, {'message': {'role':'assistant','content':''},'done':True,'done_reason':'stop','prompt_eval_count':1,'eval_count':2}]:
            chunk.update(model='fixture-model', created_at='2026-10-14T00:00:00Z')
            self.wfile.write((json.dumps(chunk)+'\n').encode()); self.wfile.flush()
ThreadingHTTPServer(('0.0.0.0',11434), Ollama).serve_forever()
