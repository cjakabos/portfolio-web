#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WEB_DIR="${ROOT_DIR}/frontend/cloudapp-shell"
ANDROID_APP_DIR="${WEB_DIR}/android"
ARTIFACT_DIR="${ROOT_DIR}/tests/e2e/mobile/artifacts"
EMULATOR_LOG="${ARTIFACT_DIR}/android-emulator.log"

APP_ID="${ANDROID_APP_ID:-com.portfolio.cloudapp}"
APK_PATH="${ANDROID_APK_PATH:-${ANDROID_APP_DIR}/app/build/outputs/apk/debug/app-debug.apk}"
NODE_MODE="${ANDROID_NODE_MODE:-docker}"
BUNDLE_BUDGET_KB="${BUNDLE_INITIAL_JS_GZIP_BUDGET_KB:-450}"
CHECK_BUNDLE_BUDGET="${ANDROID_CHECK_BUNDLE_BUDGET:-1}"

LOCAL_BASE_URL="${ANDROID_LOCAL_BASE_URL:-http://localhost:5001}"
if [[ "${ANDROID_CAP_SERVER_URL+x}" == "x" ]]; then
  CAP_SERVER_URL="${ANDROID_CAP_SERVER_URL}"
else
  CAP_SERVER_URL="${LOCAL_BASE_URL}"
fi
API_BASE_URL="${ANDROID_NEXT_PUBLIC_API_URL:-http://localhost:8080/cloudapp}"
WS_API_BASE_URL="${ANDROID_NEXT_PUBLIC_CHAT_WS_API_URL:-http://localhost:8080/cloudapp}"

DEVICE_ID="${ANDROID_DEVICE_ID:-}"
AVD_NAME="${ANDROID_AVD_NAME:-}"
LAUNCH_EMULATOR="${ANDROID_LAUNCH_EMULATOR:-1}"
EMULATOR_NO_WINDOW="${ANDROID_EMULATOR_NO_WINDOW:-0}"
BOOT_TIMEOUT_SEC="${ANDROID_BOOT_TIMEOUT_SEC:-300}"
APP_HTTP_PORT="${ANDROID_APP_HTTP_PORT:-5001}"
API_HTTP_PORT="${ANDROID_API_HTTP_PORT:-8080}"
API_HOST_PORT="${ANDROID_API_HOST_PORT:-80}"
HEALTHCHECK_URL="${ANDROID_HEALTHCHECK_URL:-http://localhost:80/nginx_health}"

RUN_MAESTRO_SMOKE="${ANDROID_RUN_MAESTRO_SMOKE:-0}"
MAESTRO_BIN="${MAESTRO_BIN:-maestro}"

if [[ "${EUID}" -eq 0 ]]; then
  echo "Do not run this script with sudo."
  exit 1
fi

case "${BOOT_TIMEOUT_SEC}" in
  ''|*[!0-9]*) BOOT_TIMEOUT_SEC=300 ;;
esac

if [[ -n "${CAP_SERVER_URL}" ]]; then
  echo "Using hosted mode: ANDROID_CAP_SERVER_URL=${CAP_SERVER_URL}"
  echo "Hosted mode note: the server at ${CAP_SERVER_URL} must be built with NEXT_PUBLIC_API_URL=${API_BASE_URL}."
else
  echo "Using bundled mode (ANDROID_CAP_SERVER_URL is empty)."
fi

echo "Build API base: ${API_BASE_URL:-<relative>}"
echo "Build chat websocket base: ${WS_API_BASE_URL:-<relative>}"

command -v adb >/dev/null 2>&1 || { echo "adb not found."; exit 1; }

case "${NODE_MODE}" in
  docker)
    command -v docker >/dev/null 2>&1 || { echo "docker not found (required for ANDROID_NODE_MODE=docker)."; exit 1; }
    ;;
  local)
    command -v npm >/dev/null 2>&1 || { echo "npm not found (required for ANDROID_NODE_MODE=local)."; exit 1; }
    command -v npx >/dev/null 2>&1 || { echo "npx not found (required for ANDROID_NODE_MODE=local)."; exit 1; }
    ;;
  *)
    echo "Unknown ANDROID_NODE_MODE='${NODE_MODE}'. Expected: docker or local."
    exit 1
    ;;
esac

resolve_connected_device() {
  if [[ -n "${DEVICE_ID}" ]]; then
    return 0
  fi

  DEVICE_ID="$(adb devices | awk 'NR>1 && $2=="device" && $1 ~ /^emulator-/ {print $1; exit}')"
  if [[ -z "${DEVICE_ID}" ]]; then
    DEVICE_ID="$(adb devices | awk 'NR>1 && $2=="device" {print $1; exit}')"
  fi
}

wait_for_device_boot() {
  local start_ts now_ts elapsed boot_state boot_anim dev_boot_state device_state
  local next_status_ts=0
  start_ts="$(date +%s)"

  while :; do
    now_ts="$(date +%s)"
    elapsed="$((now_ts - start_ts))"
    if [[ "${elapsed}" -ge "${BOOT_TIMEOUT_SEC}" ]]; then
      return 1
    fi

    device_state="$(adb -s "${DEVICE_ID}" get-state 2>/dev/null | tr -d '\r' || true)"
    boot_state="$(adb -s "${DEVICE_ID}" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r' || true)"
    boot_anim="$(adb -s "${DEVICE_ID}" shell getprop init.svc.bootanim 2>/dev/null | tr -d '\r' || true)"
    dev_boot_state="$(adb -s "${DEVICE_ID}" shell getprop dev.bootcomplete 2>/dev/null | tr -d '\r' || true)"

    if [[ "${now_ts}" -ge "${next_status_ts}" ]]; then
      echo "Waiting for boot (${elapsed}s/${BOOT_TIMEOUT_SEC}s): state=${device_state:-unknown} boot=${boot_state:-?} dev_boot=${dev_boot_state:-?} anim=${boot_anim:-?}"
      next_status_ts="$((now_ts + 10))"
    fi

    # Some modern images do not expose init.svc.bootanim; accept boot-complete in that case.
    if [[ "${device_state}" = "device" ]] \
      && [[ "${boot_state}" = "1" ]] \
      && { [[ "${boot_anim}" = "stopped" ]] || [[ -z "${boot_anim}" ]] || [[ "${dev_boot_state}" = "1" ]]; }; then
      if adb -s "${DEVICE_ID}" shell pm path android >/dev/null 2>&1; then
        echo "Device '${DEVICE_ID}' is boot-ready."
        return 0
      fi
    fi

    sleep 2
  done
}

resolve_launch_component() {
  adb -s "${DEVICE_ID}" shell cmd package resolve-activity --brief "${APP_ID}" 2>/dev/null \
    | tr -d '\r' \
    | tail -n 1
}

check_hosted_bundle_api_base() {
  local hosted_url="$1"
  local expected_api="$2"
  local html script_paths script_path script_url script_body
  local saw_expected=0
  local saw_port80=0

  html="$(curl -fsS "${hosted_url}" 2>/dev/null || true)"
  [[ -z "${html}" ]] && return 0

  script_paths="$(
    printf '%s' "${html}" \
      | grep -oE '/_next/static/[^"]+\.js' \
      | sort -u \
      | head -n 12
  )"
  [[ -z "${script_paths}" ]] && return 0

  while IFS= read -r script_path; do
    [[ -z "${script_path}" ]] && continue
    script_url="${hosted_url%/}${script_path}"
    script_body="$(curl -fsS "${script_url}" 2>/dev/null || true)"
    [[ -z "${script_body}" ]] && continue

    if [[ "${script_body}" == *"${expected_api}"* ]]; then
      saw_expected=1
    fi
    if [[ "${script_body}" == *"http://localhost:80/cloudapp"* ]]; then
      saw_port80=1
    fi

    if [[ "${saw_expected}" -eq 1 ]] && [[ "${saw_port80}" -eq 1 ]]; then
      break
    fi
  done <<< "${script_paths}"

  if [[ "${saw_port80}" -eq 1 ]] && [[ "${saw_expected}" -eq 0 ]]; then
    echo "Warning: Hosted bundle at ${hosted_url} still contains http://localhost:80/cloudapp."
    echo "Rebuild your hosted shell with NEXT_PUBLIC_API_URL=${expected_api}."
  fi
}

launch_emulator_if_needed() {
  resolve_connected_device
  if [[ -n "${DEVICE_ID}" ]]; then
    echo "Using existing device: ${DEVICE_ID}"
    return 0
  fi

  if [[ "${LAUNCH_EMULATOR}" != "1" ]]; then
    echo "No connected Android device found and ANDROID_LAUNCH_EMULATOR=${LAUNCH_EMULATOR}."
    exit 1
  fi

  command -v emulator >/dev/null 2>&1 || {
    echo "Android emulator binary not found in PATH (emulator)."
    exit 1
  }

  if [[ -z "${AVD_NAME}" ]]; then
    AVD_NAME="$(emulator -list-avds | head -n 1)"
  fi
  if [[ -z "${AVD_NAME}" ]]; then
    echo "No Android Virtual Device found. Create one in Android Studio first."
    exit 1
  fi

  mkdir -p "${ARTIFACT_DIR}"
  echo "Launching AVD '${AVD_NAME}' (log: ${EMULATOR_LOG})..."

  local emulator_args=(
    -avd "${AVD_NAME}"
    -no-boot-anim
    -no-snapshot
    -wipe-data
    -netdelay none
    -netspeed full
  )

  if [[ "${EMULATOR_NO_WINDOW}" = "1" ]]; then
    emulator_args+=(-no-window -gpu swiftshader_indirect)
  else
    echo "Emulator window mode: visible"
  fi

  nohup emulator "${emulator_args[@]}" >"${EMULATOR_LOG}" 2>&1 &
  sleep 5

  if [[ "$(uname -s)" = "Darwin" ]] && [[ "${EMULATOR_NO_WINDOW}" != "1" ]]; then
    open -a "Android Emulator" >/dev/null 2>&1 || true
  fi

  adb wait-for-device
  resolve_connected_device
  if [[ -z "${DEVICE_ID}" ]]; then
    echo "Emulator started but no adb device was resolved."
    exit 1
  fi
}

if command -v curl >/dev/null 2>&1; then
  if ! curl -fsS "${HEALTHCHECK_URL}" >/dev/null 2>&1; then
    echo "Warning: ${HEALTHCHECK_URL} is unreachable."
    echo "Run your local stack before mobile smoke (for example docker compose app+infra)."
  fi
  if [[ -n "${CAP_SERVER_URL}" ]]; then
    check_hosted_bundle_api_base "${CAP_SERVER_URL}" "${API_BASE_URL}"
  fi
fi

if [[ "${NODE_MODE}" = "docker" ]]; then
  echo "Building web + syncing Capacitor Android via docker compose (web-test)..."
  docker compose -f "${ROOT_DIR}/docker-compose.test.yml" run --rm \
    -e CI=true \
    -e NEXT_PUBLIC_API_URL="${API_BASE_URL}" \
    -e NEXT_PUBLIC_CHAT_WS_API_URL="${WS_API_BASE_URL}" \
    -e BUNDLE_INITIAL_JS_GZIP_BUDGET_KB="${BUNDLE_BUDGET_KB}" \
    -e CAP_SERVER_URL="${CAP_SERVER_URL}" \
    -e CHECK_BUNDLE_BUDGET="${CHECK_BUNDLE_BUDGET}" \
    -e HOST_UID="$(id -u)" \
    -e HOST_GID="$(id -g)" \
    web-test sh -lc '
      set -e
      npm ci --cache /tmp/npm-cache --no-audit --no-fund
      mkdir -p .next/server
      [ -f .next/server/pages-manifest.json ] || printf "{}\n" > .next/server/pages-manifest.json
      set +e
      npm run build >/tmp/android-next-build.log 2>&1
      build_status=$?
      set -e
      cat /tmp/android-next-build.log
      if [ "${build_status}" -ne 0 ]; then
        if grep -q "pages-manifest.json" /tmp/android-next-build.log; then
          echo "Detected transient pages-manifest ENOENT. Retrying once with a clean .next..."
          rm -rf .next
          mkdir -p .next/server
          printf "{}\n" > .next/server/pages-manifest.json
          npm run build
        else
          exit "${build_status}"
        fi
      fi
      if [ "${CHECK_BUNDLE_BUDGET}" = "1" ]; then
        npm run check:bundle-budget
      fi
      if [ ! -d android ]; then
        npx cap add android
      fi
      npx cap sync android
      chown -R "${HOST_UID}:${HOST_GID}" /workspace/frontend/cloudapp-shell/.next /workspace/frontend/cloudapp-shell/out /workspace/frontend/cloudapp-shell/android 2>/dev/null || true
    '
else
  echo "Building web app..."
  (
    cd "${WEB_DIR}"
    mkdir -p .next/server
    [[ -f .next/server/pages-manifest.json ]] || printf '{}\n' > .next/server/pages-manifest.json
    set +e
    NEXT_PUBLIC_API_URL="${API_BASE_URL}" NEXT_PUBLIC_CHAT_WS_API_URL="${WS_API_BASE_URL}" npm run build >/tmp/android-next-build.log 2>&1
    build_status=$?
    set -e
    cat /tmp/android-next-build.log
    if [[ "${build_status}" -ne 0 ]]; then
      if grep -q "pages-manifest.json" /tmp/android-next-build.log; then
        echo "Detected transient pages-manifest ENOENT. Retrying once with a clean .next..."
        rm -rf .next
        mkdir -p .next/server
        printf '{}\n' > .next/server/pages-manifest.json
        NEXT_PUBLIC_API_URL="${API_BASE_URL}" NEXT_PUBLIC_CHAT_WS_API_URL="${WS_API_BASE_URL}" npm run build
      else
        exit "${build_status}"
      fi
    fi
    if [[ "${CHECK_BUNDLE_BUDGET}" = "1" ]]; then
      BUNDLE_INITIAL_JS_GZIP_BUDGET_KB="${BUNDLE_BUDGET_KB}" npm run check:bundle-budget
    fi
  )

  echo "Syncing Capacitor Android wrapper..."
  (
    cd "${WEB_DIR}"
    if [[ ! -d android ]]; then
      npx cap add android
    fi
    CAP_SERVER_URL="${CAP_SERVER_URL}" npx cap sync android
  )
fi

echo "Building Android debug APK..."
(
  cd "${ANDROID_APP_DIR}"
  ./gradlew --no-daemon assembleDebug
)

if [[ ! -f "${APK_PATH}" ]]; then
  echo "Debug APK not found at ${APK_PATH}"
  exit 1
fi

launch_emulator_if_needed
adb -s "${DEVICE_ID}" wait-for-device >/dev/null 2>&1 || true
echo "Waiting for Android device '${DEVICE_ID}' to finish boot..."

if ! wait_for_device_boot; then
  echo "Device '${DEVICE_ID}' did not become fully booted in ${BOOT_TIMEOUT_SEC}s."
  exit 1
fi

adb -s "${DEVICE_ID}" shell input keyevent 224 >/dev/null 2>&1 || true
adb -s "${DEVICE_ID}" shell settings put global window_animation_scale 0 >/dev/null 2>&1 || true
adb -s "${DEVICE_ID}" shell settings put global transition_animation_scale 0 >/dev/null 2>&1 || true
adb -s "${DEVICE_ID}" shell settings put global animator_duration_scale 0 >/dev/null 2>&1 || true
adb -s "${DEVICE_ID}" shell input keyevent 82 >/dev/null 2>&1 || true

if [[ -n "${APP_HTTP_PORT}" ]]; then
  adb -s "${DEVICE_ID}" reverse "tcp:${APP_HTTP_PORT}" "tcp:${APP_HTTP_PORT}" >/dev/null 2>&1 || true
  echo "adb reverse active: tcp:${APP_HTTP_PORT} -> tcp:${APP_HTTP_PORT}"
fi
if [[ -n "${API_HTTP_PORT}" ]] && [[ "${API_HTTP_PORT}" != "${APP_HTTP_PORT}" ]]; then
  adb -s "${DEVICE_ID}" reverse "tcp:${API_HTTP_PORT}" "tcp:${API_HOST_PORT}" >/dev/null 2>&1 || true
  echo "adb reverse active: tcp:${API_HTTP_PORT} -> tcp:${API_HOST_PORT}"
fi

echo "Installing APK on ${DEVICE_ID}: ${APK_PATH}"
adb -s "${DEVICE_ID}" install -r "${APK_PATH}"

echo "Launching ${APP_ID}..."
LAUNCH_COMPONENT="$(resolve_launch_component || true)"
if [[ -n "${LAUNCH_COMPONENT}" ]] && [[ "${LAUNCH_COMPONENT}" == */* ]]; then
  echo "Resolved launch component: ${LAUNCH_COMPONENT}"
  adb -s "${DEVICE_ID}" shell am start -W -n "${LAUNCH_COMPONENT}" >/dev/null \
    || adb -s "${DEVICE_ID}" shell monkey -p "${APP_ID}" -c android.intent.category.LAUNCHER 1 >/dev/null
else
  adb -s "${DEVICE_ID}" shell monkey -p "${APP_ID}" -c android.intent.category.LAUNCHER 1 >/dev/null
fi
adb -s "${DEVICE_ID}" shell pidof "${APP_ID}" >/dev/null 2>&1 && echo "App process is running."

if [[ "${RUN_MAESTRO_SMOKE}" = "1" ]]; then
  command -v "${MAESTRO_BIN}" >/dev/null 2>&1 || { echo "Maestro CLI not found (${MAESTRO_BIN})."; exit 1; }
  echo "Running Maestro Android smoke..."
  TEST_MOBILE_SMOKE_STRICT=1 \
  MOBILE_SMOKE_MODE=maestro \
  MOBILE_DEVICE_ID="${DEVICE_ID}" \
  MOBILE_MAESTRO_RETRIES=4 \
  MOBILE_MAESTRO_RETRY_BACKOFF_SEC=10 \
  MOBILE_DEVICE_BOOT_TIMEOUT_SEC="${BOOT_TIMEOUT_SEC}" \
  MAESTRO_DRIVER_STARTUP_TIMEOUT=180000 \
  MOBILE_APP_HTTP_PORT="${APP_HTTP_PORT}" \
  MOBILE_APP_HTTP_HOST_PORT="${APP_HTTP_PORT}" \
  MOBILE_EXTRA_HTTP_PORT="${API_HTTP_PORT}" \
  MOBILE_EXTRA_HTTP_HOST_PORT="${API_HOST_PORT}" \
  MAESTRO_BIN="${MAESTRO_BIN}" \
  MOBILE_APP_ID="${APP_ID}" \
  make test-mobile-smoke
fi

echo "Done."
echo "Device: ${DEVICE_ID}"
echo "App: ${APP_ID}"
