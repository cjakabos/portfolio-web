#!/usr/bin/env sh
set -eu

ROOT_DIR="$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)"
WEB_DIR="${ROOT_DIR}/frontend/cloudapp-shell"
FLOW_FILE="${ROOT_DIR}/tests/e2e/mobile/maestro/android-smoke.yaml"
ARTIFACT_DIR="${ROOT_DIR}/tests/e2e/mobile/artifacts"
STRICT="${TEST_MOBILE_SMOKE_STRICT:-0}"
APP_ID="${MOBILE_APP_ID:-com.portfolio.cloudapp}"
MAESTRO_BIN="${MAESTRO_BIN:-maestro}"
MODE="${MOBILE_SMOKE_MODE:-all}"
DEVICE_ID="${MOBILE_DEVICE_ID:-}"
RETRIES="${MOBILE_MAESTRO_RETRIES:-2}"
DRIVER_SETUP_RETRIES="${MOBILE_MAESTRO_DRIVER_SETUP_RETRIES:-3}"
USE_DRIVER_SETUP="${MOBILE_MAESTRO_USE_DRIVER_SETUP:-0}"
RETRY_BACKOFF_SEC="${MOBILE_MAESTRO_RETRY_BACKOFF_SEC:-8}"
DRIVER_STARTUP_TIMEOUT="${MAESTRO_DRIVER_STARTUP_TIMEOUT:-120000}"
APP_HTTP_PORT="${MOBILE_APP_HTTP_PORT:-}"
APP_HTTP_HOST_PORT="${MOBILE_APP_HTTP_HOST_PORT:-${APP_HTTP_PORT}}"
EXTRA_HTTP_PORT="${MOBILE_EXTRA_HTTP_PORT:-}"
EXTRA_HTTP_HOST_PORT="${MOBILE_EXTRA_HTTP_HOST_PORT:-${EXTRA_HTTP_PORT}}"
BOOT_TIMEOUT_SEC="${MOBILE_DEVICE_BOOT_TIMEOUT_SEC:-300}"
BOOT_POLL_INTERVAL_SEC="${MOBILE_DEVICE_BOOT_POLL_INTERVAL_SEC:-2}"
RELEASE_APK_PATH="${MOBILE_RELEASE_APK_PATH:-${ROOT_DIR}/frontend/cloudapp-shell/android/app/build/outputs/apk/release/app-release-unsigned.apk}"
DEBUG_APK_PATH="${MOBILE_DEBUG_APK_PATH:-${ROOT_DIR}/frontend/cloudapp-shell/android/app/build/outputs/apk/debug/app-debug.apk}"
RELEASE_MAPPING_PATH="${MOBILE_RELEASE_MAPPING_PATH:-${ROOT_DIR}/frontend/cloudapp-shell/android/app/build/outputs/mapping/release/mapping.txt}"
ANDROID_BUILD_GRADLE_PATH="${MOBILE_ANDROID_BUILD_GRADLE_PATH:-${ROOT_DIR}/frontend/cloudapp-shell/android/app/build.gradle}"
RELEASE_MAX_BYTES="${MOBILE_RELEASE_MAX_BYTES:-0}"

case "${RETRIES}" in ''|*[!0-9]*) RETRIES=2 ;; esac
case "${DRIVER_SETUP_RETRIES}" in ''|*[!0-9]*) DRIVER_SETUP_RETRIES=3 ;; esac
case "${USE_DRIVER_SETUP}" in ''|*[!0-9]*) USE_DRIVER_SETUP=0 ;; esac
case "${RETRY_BACKOFF_SEC}" in ''|*[!0-9]*) RETRY_BACKOFF_SEC=8 ;; esac
case "${BOOT_TIMEOUT_SEC}" in ''|*[!0-9]*) BOOT_TIMEOUT_SEC=300 ;; esac
case "${RELEASE_MAX_BYTES}" in ''|*[!0-9]*) RELEASE_MAX_BYTES=0 ;; esac

run_config_smoke=true
run_maestro_smoke=true
run_release_smoke=false

case "${MODE}" in
  all)
    ;;
  config)
    run_maestro_smoke=false
    run_release_smoke=false
    ;;
  maestro)
    run_config_smoke=false
    run_release_smoke=false
    ;;
  release)
    run_config_smoke=false
    run_maestro_smoke=false
    run_release_smoke=true
    ;;
  *)
    echo "Unknown MOBILE_SMOKE_MODE '${MODE}'. Expected one of: all, config, maestro, release."
    exit 1
    ;;
esac

reset_maestro_driver_state() {
  adb -s "${DEVICE_ID}" forward --remove-all >/dev/null 2>&1 || true
  adb -s "${DEVICE_ID}" reverse --remove-all >/dev/null 2>&1 || true
  adb -s "${DEVICE_ID}" shell am force-stop dev.mobile.maestro >/dev/null 2>&1 || true
  adb -s "${DEVICE_ID}" shell am force-stop dev.mobile.maestro.test >/dev/null 2>&1 || true
  adb -s "${DEVICE_ID}" uninstall dev.mobile.maestro >/dev/null 2>&1 || true
  adb -s "${DEVICE_ID}" uninstall dev.mobile.maestro.test >/dev/null 2>&1 || true
}

write_attempt_diagnostics() {
  out_file="$1"
  {
    echo "=== $(date -u) ==="
    echo "maestro_bin=${MAESTRO_BIN}"
    "${MAESTRO_BIN}" --version || true
    adb devices -l || true
    adb -s "${DEVICE_ID}" get-state || true
    adb -s "${DEVICE_ID}" shell getprop sys.boot_completed || true
    adb -s "${DEVICE_ID}" shell getprop dev.bootcomplete || true
    adb -s "${DEVICE_ID}" shell getprop init.svc.bootanim || true
    adb -s "${DEVICE_ID}" shell getprop ro.build.fingerprint || true
    adb -s "${DEVICE_ID}" reverse --list || true
    adb -s "${DEVICE_ID}" forward --list || true
    adb -s "${DEVICE_ID}" shell pm path "${APP_ID}" || true
    adb -s "${DEVICE_ID}" shell dumpsys package dev.mobile.maestro | head -n 120 || true
    adb -s "${DEVICE_ID}" shell dumpsys package dev.mobile.maestro.test | head -n 120 || true
    adb -s "${DEVICE_ID}" shell dumpsys activity activities | head -n 200 || true
    adb -s "${DEVICE_ID}" shell pm list packages | grep -E 'maestro|cloudapp|portfolio' || true
    adb -s "${DEVICE_ID}" shell ps -A | grep -E 'maestro|cloudapp|portfolio' || true
  } > "${out_file}" 2>&1 || true
}

ensure_app_port_reverse() {
  if [ -n "${APP_HTTP_PORT}" ]; then
    adb -s "${DEVICE_ID}" reverse "tcp:${APP_HTTP_PORT}" "tcp:${APP_HTTP_HOST_PORT}" >/dev/null 2>&1 || true
  fi
  if [ -n "${EXTRA_HTTP_PORT}" ] && [ "${EXTRA_HTTP_PORT}" != "${APP_HTTP_PORT}" ]; then
    adb -s "${DEVICE_ID}" reverse "tcp:${EXTRA_HTTP_PORT}" "tcp:${EXTRA_HTTP_HOST_PORT}" >/dev/null 2>&1 || true
  fi
}

wait_for_device_boot() {
  timeout_sec="$1"
  start_ts="$(date +%s)"

  while :; do
    now_ts="$(date +%s)"
    elapsed="$((now_ts - start_ts))"
    if [ "${elapsed}" -ge "${timeout_sec}" ]; then
      return 1
    fi

    boot_state="$(adb -s "${DEVICE_ID}" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')"
    dev_boot_state="$(adb -s "${DEVICE_ID}" shell getprop dev.bootcomplete 2>/dev/null | tr -d '\r')"
    boot_anim="$(adb -s "${DEVICE_ID}" shell getprop init.svc.bootanim 2>/dev/null | tr -d '\r')"
    device_state="$(adb -s "${DEVICE_ID}" get-state 2>/dev/null | tr -d '\r')"

    if [ "${device_state}" = "device" ] && [ "${boot_state}" = "1" ] && [ "${boot_anim}" = "stopped" ]; then
      if [ "${dev_boot_state}" = "1" ] || [ -z "${dev_boot_state}" ]; then
        if adb -s "${DEVICE_ID}" shell pm path android >/dev/null 2>&1; then
          return 0
        fi
      fi
    fi

    sleep "${BOOT_POLL_INTERVAL_SEC}"
  done
}

prepare_device_runtime() {
  adb -s "${DEVICE_ID}" shell settings put global window_animation_scale 0 >/dev/null 2>&1 || true
  adb -s "${DEVICE_ID}" shell settings put global transition_animation_scale 0 >/dev/null 2>&1 || true
  adb -s "${DEVICE_ID}" shell settings put global animator_duration_scale 0 >/dev/null 2>&1 || true
  adb -s "${DEVICE_ID}" shell input keyevent 82 >/dev/null 2>&1 || true
}

ensure_maestro_driver_setup() {
  if [ "${USE_DRIVER_SETUP}" != "1" ]; then
    return 0
  fi

  setup_attempt=1
  while [ "${setup_attempt}" -le "${DRIVER_SETUP_RETRIES}" ]; do
    setup_log="$(mktemp)"
    reset_maestro_driver_state
    ensure_app_port_reverse

    if "${MAESTRO_BIN}" --device "${DEVICE_ID}" driver-setup >"${setup_log}" 2>&1; then
      rm -f "${setup_log}"
      if adb -s "${DEVICE_ID}" shell pm list packages | grep -q 'package:dev.mobile.maestro'; then
        return 0
      fi
    elif grep -q "Apple account team ID must be specified" "${setup_log}"; then
      echo "Maestro driver-setup requested Apple Team ID; skipping explicit driver setup for Android."
      rm -f "${setup_log}"
      return 0
    fi

    rm -f "${setup_log}"
    setup_attempt=$((setup_attempt + 1))
    sleep 2
  done

  return 1
}

release_block_contains_literal() {
  gradle_file="$1"
  literal="$2"
  awk -v needle="${literal}" '
    function count_char(s, c, i, n) {
      n = 0
      for (i = 1; i <= length(s); i++) {
        if (substr(s, i, 1) == c) {
          n++
        }
      }
      return n
    }

    BEGIN {
      in_release = 0
      depth = 0
      found = 0
    }

    {
      line = $0

      if (!in_release && line ~ /^[[:space:]]*release[[:space:]]*\{/) {
        in_release = 1
        depth = 1
        if (index(line, needle) > 0) {
          found = 1
          exit
        }
        next
      }

      if (in_release) {
        if (index(line, needle) > 0) {
          found = 1
          exit
        }

        depth += count_char(line, "{")
        depth -= count_char(line, "}")
        if (depth <= 0) {
          exit
        }
      }
    }

    END {
      if (found) {
        exit 0
      }
      exit 1
    }
  ' "${gradle_file}" >/dev/null 2>&1
}

verify_release_gradle_config() {
  if [ ! -f "${ANDROID_BUILD_GRADLE_PATH}" ]; then
    echo "Android build.gradle not found for release checks: ${ANDROID_BUILD_GRADLE_PATH}"
    return 1
  fi

  missing=0
  for expected in \
    "minifyEnabled true" \
    "shrinkResources true" \
    "proguard-android-optimize.txt"
  do
    if ! release_block_contains_literal "${ANDROID_BUILD_GRADLE_PATH}" "${expected}"; then
      echo "Missing '${expected}' inside Android release buildType: ${ANDROID_BUILD_GRADLE_PATH}"
      missing=1
    fi
  done

  if [ "${missing}" -ne 0 ]; then
    return 1
  fi

  return 0
}

run_android_release_smoke() {
  mkdir -p "${ARTIFACT_DIR}"
  report_file="${ARTIFACT_DIR}/android-release-size.txt"
  release_apk="${RELEASE_APK_PATH}"
  debug_apk="${DEBUG_APK_PATH}"
  mapping_file="${RELEASE_MAPPING_PATH}"

  if [ ! -f "${release_apk}" ]; then
    echo "Release APK not found: ${release_apk}"
    if [ "${STRICT}" = "1" ]; then
      exit 1
    fi
    echo "Skipping Android release smoke: release APK is missing."
    exit 0
  fi

  if ! verify_release_gradle_config; then
    if [ "${STRICT}" = "1" ]; then
      exit 1
    fi
    echo "Continuing non-strict release smoke despite missing release shrink/minify config."
  fi

  release_bytes="$(wc -c < "${release_apk}" | tr -d '[:space:]')"
  debug_bytes=""
  if [ -f "${debug_apk}" ]; then
    debug_bytes="$(wc -c < "${debug_apk}" | tr -d '[:space:]')"
  fi

  {
    echo "timestamp_utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    echo "release_apk=${release_apk}"
    echo "release_bytes=${release_bytes}"
    echo "release_mb=$(awk -v n="${release_bytes}" 'BEGIN { printf "%.2f", n/1024/1024 }')"
    if [ -n "${debug_bytes}" ]; then
      echo "debug_apk=${debug_apk}"
      echo "debug_bytes=${debug_bytes}"
      echo "debug_mb=$(awk -v n="${debug_bytes}" 'BEGIN { printf "%.2f", n/1024/1024 }')"
      echo "delta_bytes=$((release_bytes - debug_bytes))"
      echo "delta_mb=$(awk -v r="${release_bytes}" -v d="${debug_bytes}" 'BEGIN { printf "%.2f", (r-d)/1024/1024 }')"
    fi
    echo "mapping_file=${mapping_file}"
    if [ -f "${mapping_file}" ]; then
      echo "mapping_file_present=true"
    else
      echo "mapping_file_present=false"
    fi
  } > "${report_file}"

  cat "${report_file}"

  if [ ! -f "${mapping_file}" ] && [ "${STRICT}" = "1" ]; then
    echo "Release mapping file is missing: ${mapping_file}"
    exit 1
  fi

  if [ -n "${debug_bytes}" ] && [ "${release_bytes}" -ge "${debug_bytes}" ] && [ "${STRICT}" = "1" ]; then
    echo "Release APK (${release_bytes} bytes) is not smaller than debug APK (${debug_bytes} bytes)."
    exit 1
  fi

  if [ "${RELEASE_MAX_BYTES}" -gt 0 ] && [ "${release_bytes}" -gt "${RELEASE_MAX_BYTES}" ] && [ "${STRICT}" = "1" ]; then
    echo "Release APK (${release_bytes} bytes) exceeds MOBILE_RELEASE_MAX_BYTES=${RELEASE_MAX_BYTES}."
    exit 1
  fi
}

if ! grep -q '"test:mobile:smoke"' "${WEB_DIR}/package.json"; then
  if [ "${STRICT}" = "1" ]; then
    echo "frontend/cloudapp-shell/package.json has no test:mobile:smoke script."
    exit 1
  fi
  echo "Skipping mobile smoke tests: no test:mobile:smoke script configured yet."
  exit 0
fi

if [ "${run_config_smoke}" = "true" ]; then
  echo "Running Capacitor config smoke tests via docker compose (web-test)..."
  docker compose -f "${ROOT_DIR}/docker-compose.test.yml" run --rm \
    -e CI="${CI:-}" \
    web-test \
    sh -c "npm ci && npm run test:mobile:smoke"
fi

if [ "${run_release_smoke}" = "true" ]; then
  run_android_release_smoke
  exit 0
fi

if [ "${run_maestro_smoke}" = "false" ]; then
  exit 0
fi

if [ ! -f "${FLOW_FILE}" ]; then
  if [ "${STRICT}" = "1" ]; then
    echo "Android Maestro flow not found: ${FLOW_FILE}"
    exit 1
  fi
  echo "Skipping Android Maestro smoke: flow file is missing (${FLOW_FILE})."
  exit 0
fi

if ! command -v adb >/dev/null 2>&1; then
  if [ "${STRICT}" = "1" ]; then
    echo "adb not found. Install Android platform-tools or run this in CI mobile workflow."
    exit 1
  fi
  echo "Skipping Android Maestro smoke: adb not found."
  exit 0
fi

if ! command -v "${MAESTRO_BIN}" >/dev/null 2>&1; then
  if [ "${STRICT}" = "1" ]; then
    echo "Maestro CLI not found (${MAESTRO_BIN}). Install it via https://get.maestro.mobile.dev."
    exit 1
  fi
  echo "Skipping Android Maestro smoke: Maestro CLI not found (${MAESTRO_BIN})."
  exit 0
fi

if ! adb get-state >/dev/null 2>&1; then
  if [ "${STRICT}" = "1" ]; then
    echo "No Android emulator/device detected by adb."
    exit 1
  fi
  echo "Skipping Android Maestro smoke: no Android emulator/device detected."
  exit 0
fi

unready_devices="$(adb devices | awk 'NR>1 && $1 != "" && $2 != "device" {print $1 ":" $2}' | paste -sd',' -)"
if [ -n "${unready_devices}" ]; then
  echo "Detected non-ready adb devices: ${unready_devices}"
fi

if [ -z "${DEVICE_ID}" ]; then
  DEVICE_ID="$(adb devices | awk 'NR>1 && $2=="device" {print $1; exit}')"
fi

if [ -z "${DEVICE_ID}" ]; then
  if [ "${STRICT}" = "1" ]; then
    echo "Could not resolve Android device id from adb devices output."
    exit 1
  fi
  echo "Skipping Android Maestro smoke: no resolved Android device id."
  exit 0
fi

adb -s "${DEVICE_ID}" wait-for-device >/dev/null 2>&1 || true
if ! wait_for_device_boot "${BOOT_TIMEOUT_SEC}"; then
  if [ "${STRICT}" = "1" ]; then
    echo "Android device '${DEVICE_ID}' did not report full boot completion in time (${BOOT_TIMEOUT_SEC}s)."
    exit 1
  fi
  echo "Skipping Android Maestro smoke: Android device '${DEVICE_ID}' not fully booted."
  exit 0
fi

prepare_device_runtime
if ! adb -s "${DEVICE_ID}" shell pm list packages | grep -q "package:${APP_ID}"; then
  if [ "${STRICT}" = "1" ]; then
    echo "Android app package '${APP_ID}' is not installed on device '${DEVICE_ID}'."
    exit 1
  fi
  echo "Skipping Android Maestro smoke: app package '${APP_ID}' not installed on '${DEVICE_ID}'."
  exit 0
fi

suffix="$(date +%s)"
e2e_email="mobile_${suffix}@example.com"
e2e_username="mobile_${suffix}"
item_title="Mobile Smoke ${suffix}"
mkdir -p "${ARTIFACT_DIR}"

export MAESTRO_DRIVER_STARTUP_TIMEOUT="${DRIVER_STARTUP_TIMEOUT}"
echo "Using MAESTRO_DRIVER_STARTUP_TIMEOUT=${MAESTRO_DRIVER_STARTUP_TIMEOUT}ms"

if ! ensure_maestro_driver_setup; then
  mkdir -p "${ARTIFACT_DIR}"
  write_attempt_diagnostics "${ARTIFACT_DIR}/device-state-driver-setup-failed.txt"
  if [ "${STRICT}" = "1" ]; then
    echo "Maestro driver setup failed after ${DRIVER_SETUP_RETRIES} attempts."
    exit 1
  fi
  echo "Skipping Android Maestro smoke: Maestro driver setup failed."
  exit 0
fi
ensure_app_port_reverse

attempt=1
while [ "${attempt}" -le "${RETRIES}" ]; do
  debug_dir="${ARTIFACT_DIR}/maestro-debug-attempt-${attempt}"
  rm -rf "${debug_dir}"
  mkdir -p "${debug_dir}"
  write_attempt_diagnostics "${debug_dir}/device-state-before.txt"
  adb -s "${DEVICE_ID}" logcat -c >/dev/null 2>&1 || true
  ensure_app_port_reverse

  echo "Running Android Maestro smoke flow (${FLOW_FILE}) on ${DEVICE_ID}, attempt ${attempt}/${RETRIES}..."
  if "${MAESTRO_BIN}" --device "${DEVICE_ID}" test "${FLOW_FILE}" \
    --env APP_ID="${APP_ID}" \
    --env E2E_EMAIL="${e2e_email}" \
    --env E2E_USERNAME="${e2e_username}" \
    --env E2E_PASSWORD="password123" \
    --env ITEM_TITLE="${item_title}" \
    --format junit \
    --output "${ARTIFACT_DIR}/android-smoke.junit.xml" \
    --debug-output "${debug_dir}"; then
    adb -s "${DEVICE_ID}" logcat -d -t 200 > "${debug_dir}/logcat-tail.txt" 2>&1 || true
    exit 0
  fi

  adb -s "${DEVICE_ID}" logcat -d -t 400 > "${debug_dir}/logcat-tail.txt" 2>&1 || true
  write_attempt_diagnostics "${debug_dir}/device-state-after.txt"

  attempt=$((attempt + 1))
  if [ "${attempt}" -le "${RETRIES}" ]; then
    echo "Maestro run failed; reinitializing device bridge before retry..."
    adb kill-server >/dev/null 2>&1 || true
    adb start-server >/dev/null 2>&1 || true
    adb -s "${DEVICE_ID}" wait-for-device >/dev/null 2>&1 || true
    wait_for_device_boot "${BOOT_TIMEOUT_SEC}" || true
    prepare_device_runtime
    ensure_maestro_driver_setup || true
    ensure_app_port_reverse
    sleep "${RETRY_BACKOFF_SEC}"
  fi
done

exit 1
