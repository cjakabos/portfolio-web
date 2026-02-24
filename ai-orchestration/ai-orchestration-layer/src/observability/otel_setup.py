"""
OpenTelemetry setup for the AI Orchestration Layer (FastAPI).

Configures tracing and log export with OTLP to a collector (Jaeger/OTel Collector).
Auto-instruments FastAPI, httpx, and Python logging.

Activation is controlled by the OTEL_ENABLED environment variable.
When OTEL_ENABLED is not "true", this module does nothing -- so tracing
is opt-in and the app works normally without a collector running.

Usage in main.py:
    from observability.otel_setup import init_telemetry
    init_telemetry(app)
"""

import os
import logging

logger = logging.getLogger(__name__)


def init_telemetry(fastapi_app):
    """
    Initialize OpenTelemetry tracing and log export for FastAPI.
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

        # Log export
        from opentelemetry.sdk._logs import LoggerProvider, LoggingHandler
        from opentelemetry.sdk._logs.export import BatchLogRecordProcessor
        from opentelemetry.exporter.otlp.proto.grpc._log_exporter import OTLPLogExporter
        from opentelemetry._logs import set_logger_provider

        # Auto-instrumentation libraries
        from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
        from opentelemetry.instrumentation.httpx import HTTPXClientInstrumentor
        from opentelemetry.instrumentation.logging import LoggingInstrumentor

        # Service identity
        service_name = os.getenv("OTEL_SERVICE_NAME", "ai-orchestration")
        otlp_endpoint = os.getenv("OTEL_EXPORTER_OTLP_ENDPOINT", "http://jaeger:4317")

        resource = Resource.create({SERVICE_NAME: service_name})

        # --- Traces ---
        provider = TracerProvider(resource=resource)
        span_exporter = OTLPSpanExporter(endpoint=otlp_endpoint, insecure=True)
        provider.add_span_processor(BatchSpanProcessor(span_exporter))
        trace.set_tracer_provider(provider)

        # --- Logs ---
        logger_provider = LoggerProvider(resource=resource)
        log_exporter = OTLPLogExporter(endpoint=otlp_endpoint, insecure=True)
        logger_provider.add_log_record_processor(BatchLogRecordProcessor(log_exporter))
        set_logger_provider(logger_provider)

        # Bridge Python logging -> OTEL log signals
        handler = LoggingHandler(level=logging.INFO, logger_provider=logger_provider)
        logging.getLogger().addHandler(handler)

        # --- Auto-instrument FastAPI (adds spans for every request) ---
        FastAPIInstrumentor.instrument_app(
            fastapi_app,
            excluded_urls="health"
        )

        # --- Auto-instrument httpx (adds spans for outgoing HTTP calls) ---
        HTTPXClientInstrumentor().instrument()

        # --- Auto-instrument logging (adds trace context to log records) ---
        LoggingInstrumentor().instrument(set_logging_format=True)

        logger.info(
            "OpenTelemetry initialized: service=%s, exporter=%s",
            service_name, otlp_endpoint
        )

    except ImportError as e:
        logger.warning("OpenTelemetry packages not installed. Skipping instrumentation: %s", e)
    except Exception as e:
        logger.error("Failed to initialize OpenTelemetry: %s", e)
