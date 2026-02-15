"""
OpenTelemetry setup for the ML Pipeline Flask application.

Configures tracing with OTLP export to a collector (Jaeger/OTel Collector).
Auto-instruments Flask, psycopg, SQLAlchemy, and requests.

Activation is controlled by the OTEL_ENABLED environment variable.
When OTEL_ENABLED is not "true", this module does nothing — so tracing
is opt-in and the app works normally without a collector running.

Usage in app.py:
    from otel_setup import init_telemetry
    app = Flask(__name__)
    init_telemetry(app)
"""

import os
import logging

logger = logging.getLogger(__name__)


def init_telemetry(flask_app):
    """
    Initialize OpenTelemetry tracing for the Flask application.
    No-op if OTEL_ENABLED != "true".
    """
    if os.getenv("OTEL_ENABLED", "false").lower() != "true":
        logger.info("OpenTelemetry is disabled (OTEL_ENABLED != 'true'). Skipping setup.")
        return

    try:
        from opentelemetry import trace
        from opentelemetry.sdk.trace import TracerProvider
        from opentelemetry.sdk.trace.export import BatchSpanProcessor
        from opentelemetry.sdk.resources import Resource, SERVICE_NAME
        from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter

        # Auto-instrumentation libraries
        from opentelemetry.instrumentation.flask import FlaskInstrumentor
        from opentelemetry.instrumentation.psycopg import PsycopgInstrumentor
        from opentelemetry.instrumentation.sqlalchemy import SQLAlchemyInstrumentor
        from opentelemetry.instrumentation.requests import RequestsInstrumentor

        # Service identity
        service_name = os.getenv("OTEL_SERVICE_NAME", "ml-pipeline")
        otlp_endpoint = os.getenv("OTEL_EXPORTER_OTLP_ENDPOINT", "http://jaeger:4317")

        resource = Resource.create({SERVICE_NAME: service_name})

        # Create and set the global tracer provider
        provider = TracerProvider(resource=resource)
        exporter = OTLPSpanExporter(endpoint=otlp_endpoint, insecure=True)
        provider.add_span_processor(BatchSpanProcessor(exporter))
        trace.set_tracer_provider(provider)

        # Auto-instrument Flask (adds spans for every request)
        FlaskInstrumentor().instrument_app(flask_app)

        # Auto-instrument psycopg (adds spans for every DB query)
        PsycopgInstrumentor().instrument()

        # Auto-instrument SQLAlchemy (adds spans for engine operations)
        SQLAlchemyInstrumentor().instrument()

        # Auto-instrument requests (adds spans for outgoing HTTP calls)
        RequestsInstrumentor().instrument()

        logger.info(
            "OpenTelemetry initialized: service=%s, exporter=%s",
            service_name, otlp_endpoint
        )

    except ImportError as e:
        logger.warning("OpenTelemetry packages not installed. Skipping instrumentation: %s", e)
    except Exception as e:
        logger.error("Failed to initialize OpenTelemetry: %s", e)