#!/bin/sh
# Retry transient dependency transfers without retrying compilation or test failures.
set -eu

build_log=$(mktemp)
trap 'rm -f "$build_log"' EXIT
attempt=1

while :; do
    # -U rechecks missing artifacts instead of reusing a cached transfer failure.
    if mvn --batch-mode --no-transfer-progress --update-snapshots \
        -Dstyle.color=never "$@" >"$build_log" 2>&1; then
        cat "$build_log"
        exit 0
    else
        status=$?
    fi
    cat "$build_log"

    # Match the transfer error itself, not unrelated network messages in the log.
    # Authentication, missing artifacts, certificate errors, and code failures stop here.
    if [ "$attempt" -ge 3 ] || ! grep -Ei \
        'Could not transfer artifact.*(Connection reset|Connection refused|timed out|timeout|Unexpected end of file from server|Temporary failure in name resolution|status( code)?:[[:space:]]*(429|500|502|503|504))' \
        "$build_log" >/dev/null; then
        exit "$status"
    fi

    delay=$((attempt * 5))
    echo "Transient Maven artifact transfer failure; retrying in ${delay}s (attempt $((attempt + 1))/3)." >&2
    sleep "$delay"
    attempt=$((attempt + 1))
done
