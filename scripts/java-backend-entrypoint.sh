#!/bin/sh
set -eu

JAVA_CMD="java"

if [ "${OTEL_ENABLED:-false}" = "true" ]; then
    set -- "$JAVA_CMD" "-javaagent:/opt/opentelemetry-javaagent.jar"
else
    export OTEL_TRACES_EXPORTER=none
    export OTEL_METRICS_EXPORTER=none
    export OTEL_LOGS_EXPORTER=none
    set -- "$JAVA_CMD"
fi

exec "$@" -jar /home/run/app.jar
