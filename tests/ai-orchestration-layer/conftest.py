"""Import-time configuration uses inert endpoints; tests supply transports explicitly."""
import os

for key in ("OLLAMA_URL", "CLOUDAPP_URL", "PETSTORE_URL", "VEHICLES_URL", "ML_URL"):
    os.environ.setdefault(key, f"http://{key.lower()}.test.invalid")
os.environ.setdefault("POSTGRES_URL", "postgresql://test:test@postgres.test.invalid/test")
