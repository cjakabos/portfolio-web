#!/usr/bin/env sh
set -eu

ROOT_DIR="$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)"
WEB_DIR="${ROOT_DIR}/frontend/cloudapp-shell"
ARTIFACT_DIR="${ROOT_DIR}/tests/e2e/mobile/artifacts"

STRICT="${TEST_IOS_SMOKE_STRICT:-0}"
MODE="${IOS_SMOKE_MODE:-config}"

WEB_BUILD_MODE="${IOS_WEB_BUILD_MODE:-docker}"
BUNDLE_BUDGET_KB="${BUNDLE_INITIAL_JS_GZIP_BUDGET_KB:-450}"
NEXT_PUBLIC_API_URL="${IOS_NEXT_PUBLIC_API_URL:-http://localhost:80/cloudapp}"
NEXT_PUBLIC_CHAT_WS_API_URL="${IOS_NEXT_PUBLIC_CHAT_WS_API_URL:-http://localhost:80/cloudapp}"
CAP_SERVER_URL="${IOS_CAP_SERVER_URL:-http://localhost:5001}"
IOS_POD_MODE="${IOS_POD_MODE:-auto}"
IOS_POD_DOCKER_IMAGE="${IOS_POD_DOCKER_IMAGE:-cocoapods/cocoapods:1.15.2}"

IOS_APP_DIR="${IOS_APP_DIR:-${WEB_DIR}/ios/App}"
IOS_WORKSPACE="${IOS_WORKSPACE:-App.xcworkspace}"
IOS_PROJECT="${IOS_PROJECT:-App.xcodeproj}"
IOS_SCHEME="${IOS_SCHEME:-App}"
IOS_CONFIGURATION="${IOS_CONFIGURATION:-Debug}"
IOS_DESTINATION="${IOS_DESTINATION:-generic/platform=iOS Simulator}"
IOS_DERIVED_DATA_PATH="${IOS_DERIVED_DATA_PATH:-${ARTIFACT_DIR}/ios-derived-data}"
IOS_APP_BUNDLE_PATH="${IOS_APP_BUNDLE_PATH:-}"
IOS_APP_ID="${IOS_APP_ID:-com.portfolio.cloudapp}"
IOS_SIMULATOR_NAME="${IOS_SIMULATOR_NAME:-iPhone 15}"
IOS_SIMULATOR_UDID="${IOS_SIMULATOR_UDID:-}"
IOS_SIM_BOOT_TIMEOUT_SEC="${IOS_SIM_BOOT_TIMEOUT_SEC:-180}"
IOS_SHUTDOWN_SIM_AFTER_SMOKE="${IOS_SHUTDOWN_SIM_AFTER_SMOKE:-1}"
IOS_CLEAN_DERIVED_DATA="${IOS_CLEAN_DERIVED_DATA:-1}"

case "${IOS_SIM_BOOT_TIMEOUT_SEC}" in ''|*[!0-9]*) IOS_SIM_BOOT_TIMEOUT_SEC=180 ;; esac

run_config_smoke=false
run_xcode_smoke=false
run_simulator_smoke=false

case "${MODE}" in
  config)
    run_config_smoke=true
    ;;
  xcode)
    run_xcode_smoke=true
    ;;
  simulator)
    run_xcode_smoke=true
    run_simulator_smoke=true
    ;;
  all)
    run_config_smoke=true
    run_xcode_smoke=true
    run_simulator_smoke=true
    ;;
  *)
    echo "Unknown IOS_SMOKE_MODE '${MODE}'. Expected one of: config, xcode, simulator, all."
    exit 1
    ;;
esac

IOS_RESOLVED_APP_BUNDLE_PATH=""
IOS_XCODE_TARGET_FLAG=""
IOS_XCODE_TARGET_PATH=""

skip_or_fail() {
  message="$1"
  if [ "${STRICT}" = "1" ]; then
    echo "${message}"
    return 1
  fi
  echo "Skipping iOS smoke: ${message}"
  return 2
}

run_ios_config_smoke() {
  if ! grep -q '"test:ios:smoke"' "${WEB_DIR}/package.json"; then
    skip_or_fail "frontend/cloudapp-shell/package.json has no test:ios:smoke script."
    return $?
  fi

  if command -v docker >/dev/null 2>&1; then
    echo "Running iOS packaging smoke tests via docker compose (web-test)..."
    docker compose -f "${ROOT_DIR}/docker-compose.test.yml" run --rm \
      -e CI="${CI:-}" \
      web-test \
      sh -c "npm ci && npm run test:ios:smoke"
    return 0
  fi

  if ! command -v npm >/dev/null 2>&1; then
    skip_or_fail "Neither Docker nor npm is available for iOS packaging smoke tests."
    return $?
  fi

  echo "Docker CLI not found; running iOS packaging smoke tests locally via npm."
  (
    cd "${WEB_DIR}"
    npm ci
    npm run test:ios:smoke
  )
}

run_ios_web_build() {
  case "${WEB_BUILD_MODE}" in
    skip)
      echo "Skipping web bundle build (IOS_WEB_BUILD_MODE=skip)."
      return
      ;;
    docker)
      if ! command -v docker >/dev/null 2>&1; then
        skip_or_fail "Docker CLI not found (docker)."
        return $?
      fi
      echo "Building web bundle and checking budget via docker compose (web-test)..."
      docker compose -f "${ROOT_DIR}/docker-compose.test.yml" run --rm \
        -e CI="${CI:-}" \
        -e NEXT_PUBLIC_API_URL="${NEXT_PUBLIC_API_URL}" \
        -e NEXT_PUBLIC_CHAT_WS_API_URL="${NEXT_PUBLIC_CHAT_WS_API_URL}" \
        -e BUNDLE_INITIAL_JS_GZIP_BUDGET_KB="${BUNDLE_BUDGET_KB}" \
        web-test \
        sh -c "npm ci && npm run build && npm run check:bundle-budget"
      ;;
    local)
      if ! command -v npm >/dev/null 2>&1; then
        skip_or_fail "npm not found (npm)."
        return $?
      fi
      echo "Building web bundle and checking budget locally..."
      (
        cd "${WEB_DIR}"
        npm ci
        NEXT_PUBLIC_API_URL="${NEXT_PUBLIC_API_URL}" NEXT_PUBLIC_CHAT_WS_API_URL="${NEXT_PUBLIC_CHAT_WS_API_URL}" npm run build
        BUNDLE_INITIAL_JS_GZIP_BUDGET_KB="${BUNDLE_BUDGET_KB}" npm run check:bundle-budget
      )
      ;;
    *)
      echo "Unknown IOS_WEB_BUILD_MODE '${WEB_BUILD_MODE}'. Expected one of: docker, local, skip."
      exit 1
      ;;
  esac
}

resolve_ios_pod_mode() {
  case "${IOS_POD_MODE}" in
    auto)
      if command -v pod >/dev/null 2>&1; then
        echo "local"
      elif command -v docker >/dev/null 2>&1; then
        echo "docker"
      else
        echo "none"
      fi
      ;;
    local|docker|skip)
      echo "${IOS_POD_MODE}"
      ;;
    *)
      echo "Unknown IOS_POD_MODE '${IOS_POD_MODE}'. Expected one of: auto, local, docker, skip."
      exit 1
      ;;
  esac
}

install_ios_pods() {
  if [ ! -f "${IOS_APP_DIR}/Podfile" ]; then
    skip_or_fail "Podfile not found at ${IOS_APP_DIR}/Podfile."
    return $?
  fi

  resolved_mode="$(resolve_ios_pod_mode)"
  case "${resolved_mode}" in
    skip)
      echo "Skipping pod install (IOS_POD_MODE=skip)."
      return 0
      ;;
    none)
      skip_or_fail "CocoaPods unavailable (no 'pod' and no Docker)."
      return $?
      ;;
    local)
      echo "Running pod install with local CocoaPods..."
      (
        cd "${IOS_APP_DIR}"
        pod install
      )
      ;;
    docker)
      echo "Local CocoaPods not found; running pod install via Docker (${IOS_POD_DOCKER_IMAGE})..."
      uid="$(id -u 2>/dev/null || echo 0)"
      gid="$(id -g 2>/dev/null || echo 0)"
      docker run --rm \
        --user "${uid}:${gid}" \
        -v "${IOS_APP_DIR}:/workspace" \
        -w /workspace \
        "${IOS_POD_DOCKER_IMAGE}" \
        sh -lc "pod install"
      ;;
  esac
}

prepare_ios_wrapper() {
  if ! command -v npx >/dev/null 2>&1; then
    skip_or_fail "Node.js npx not found (npx)."
    return $?
  fi

  echo "Preparing Capacitor iOS wrapper (cap add/copy)..."
  (
    cd "${WEB_DIR}"
    if [ ! -d ios ]; then
      npx cap add ios
    fi
    CAP_SERVER_URL="${CAP_SERVER_URL}" npx cap copy ios
  )
  install_ios_pods

  workspace_path="${IOS_APP_DIR}/${IOS_WORKSPACE}"
  project_path="${IOS_APP_DIR}/${IOS_PROJECT}"
  if [ ! -e "${workspace_path}" ] && [ ! -e "${project_path}" ]; then
    skip_or_fail "Neither iOS workspace nor project found after cap sync: ${workspace_path}, ${project_path}"
    return $?
  fi
}

run_ios_xcode_build() {
  if ! command -v xcodebuild >/dev/null 2>&1; then
    skip_or_fail "Xcode CLI not found (xcodebuild)."
    return $?
  fi

  mkdir -p "${ARTIFACT_DIR}"
  log_file="${ARTIFACT_DIR}/ios-xcodebuild.log"
  summary_file="${ARTIFACT_DIR}/ios-xcodebuild-summary.txt"

  if [ "${IOS_CLEAN_DERIVED_DATA}" = "1" ] && [ -d "${IOS_DERIVED_DATA_PATH}" ]; then
    rm -rf "${IOS_DERIVED_DATA_PATH}"
  fi
  mkdir -p "${IOS_DERIVED_DATA_PATH}"

  workspace_path="${IOS_APP_DIR}/${IOS_WORKSPACE}"
  project_path="${IOS_APP_DIR}/${IOS_PROJECT}"

  if [ -e "${workspace_path}" ]; then
    IOS_XCODE_TARGET_FLAG="-workspace"
    IOS_XCODE_TARGET_PATH="${IOS_WORKSPACE}"
  elif [ -e "${project_path}" ]; then
    IOS_XCODE_TARGET_FLAG="-project"
    IOS_XCODE_TARGET_PATH="${IOS_PROJECT}"
  else
    echo "Missing iOS workspace/project in ${IOS_APP_DIR}."
    return 1
  fi

  run_xcodebuild_with_target() {
    target_flag="$1"
    target_path="$2"
    (
      cd "${IOS_APP_DIR}"
      xcodebuild \
        "${target_flag}" "${target_path}" \
        -scheme "${IOS_SCHEME}" \
        -configuration "${IOS_CONFIGURATION}" \
        -sdk iphonesimulator \
        -destination "${IOS_DESTINATION}" \
        -derivedDataPath "${IOS_DERIVED_DATA_PATH}" \
        CODE_SIGNING_ALLOWED=NO \
        build
    ) > "${log_file}" 2>&1
  }

  echo "Running iOS Xcode build smoke (${IOS_SCHEME}, ${IOS_CONFIGURATION}, ${IOS_DESTINATION}) with ${IOS_XCODE_TARGET_FLAG} ${IOS_XCODE_TARGET_PATH}..."
  if ! run_xcodebuild_with_target "${IOS_XCODE_TARGET_FLAG}" "${IOS_XCODE_TARGET_PATH}"; then
    if [ "${IOS_XCODE_TARGET_FLAG}" = "-workspace" ] && [ -e "${project_path}" ] && grep -q "is not a workspace file" "${log_file}"; then
      echo "Workspace build path failed as non-workspace; retrying with project ${IOS_PROJECT}..."
      IOS_XCODE_TARGET_FLAG="-project"
      IOS_XCODE_TARGET_PATH="${IOS_PROJECT}"
      if ! run_xcodebuild_with_target "${IOS_XCODE_TARGET_FLAG}" "${IOS_XCODE_TARGET_PATH}"; then
        echo "xcodebuild failed. Last 200 log lines:"
        tail -n 200 "${log_file}" || true
        return 1
      fi
    else
      echo "xcodebuild failed. Last 200 log lines:"
      tail -n 200 "${log_file}" || true
      return 1
    fi
  fi

  resolved_app_bundle="${IOS_APP_BUNDLE_PATH}"
  if [ -z "${resolved_app_bundle}" ]; then
    resolved_app_bundle="$(find "${IOS_DERIVED_DATA_PATH}/Build/Products" -maxdepth 3 -type d -name '*.app' | head -n 1)"
  fi

  if [ -z "${resolved_app_bundle}" ] || [ ! -d "${resolved_app_bundle}" ]; then
    echo "Built .app bundle not found under ${IOS_DERIVED_DATA_PATH}/Build/Products."
    return 1
  fi

  IOS_RESOLVED_APP_BUNDLE_PATH="${resolved_app_bundle}"

  {
    echo "timestamp_utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    echo "xcode_target_flag=${IOS_XCODE_TARGET_FLAG}"
    echo "xcode_target_path=${IOS_APP_DIR}/${IOS_XCODE_TARGET_PATH}"
    echo "scheme=${IOS_SCHEME}"
    echo "configuration=${IOS_CONFIGURATION}"
    echo "destination=${IOS_DESTINATION}"
    echo "derived_data_path=${IOS_DERIVED_DATA_PATH}"
    echo "app_bundle_path=${IOS_RESOLVED_APP_BUNDLE_PATH}"
    echo "log_file=${log_file}"
  } > "${summary_file}"

  cat "${summary_file}"
}

resolve_simulator_udid() {
  if [ -n "${IOS_SIMULATOR_UDID}" ]; then
    printf '%s\n' "${IOS_SIMULATOR_UDID}"
    return 0
  fi

  selected_line="$(xcrun simctl list devices available | awk -v preferred="${IOS_SIMULATOR_NAME}" '
    index($0, preferred) > 0 && $0 ~ /\([0-9A-Fa-f-]+\)/ { print; exit }
  ')"
  if [ -z "${selected_line}" ]; then
    selected_line="$(xcrun simctl list devices available | awk '
      /iPhone/ && $0 ~ /\([0-9A-Fa-f-]+\)/ { print; exit }
    ')"
  fi

  udid="$(printf '%s\n' "${selected_line}" | sed -n 's/.*(\([0-9A-Fa-f-][0-9A-Fa-f-]*\)).*/\1/p' | head -n 1)"
  if [ -z "${udid}" ]; then
    return 1
  fi

  printf '%s\n' "${udid}"
}

wait_for_simulator_boot() {
  sim_udid="$1"
  timeout_sec="$2"
  start_ts="$(date +%s)"

  while :; do
    state_line="$(xcrun simctl list devices | awk -v udid="${sim_udid}" 'index($0, udid) > 0 { print; exit }')"
    if printf '%s\n' "${state_line}" | grep -q "Booted"; then
      return 0
    fi

    now_ts="$(date +%s)"
    if [ $((now_ts - start_ts)) -ge "${timeout_sec}" ]; then
      return 1
    fi
    sleep 2
  done
}

run_ios_simulator_smoke() {
  if ! command -v xcrun >/dev/null 2>&1; then
    skip_or_fail "Xcode CLI not found (xcrun)."
    return $?
  fi

  if [ -z "${IOS_RESOLVED_APP_BUNDLE_PATH}" ]; then
    fallback_bundle="${IOS_APP_BUNDLE_PATH}"
    if [ -z "${fallback_bundle}" ]; then
      fallback_bundle="$(find "${IOS_DERIVED_DATA_PATH}/Build/Products" -maxdepth 3 -type d -name '*.app' | head -n 1)"
    fi
    IOS_RESOLVED_APP_BUNDLE_PATH="${fallback_bundle}"
  fi

  if [ -z "${IOS_RESOLVED_APP_BUNDLE_PATH}" ] || [ ! -d "${IOS_RESOLVED_APP_BUNDLE_PATH}" ]; then
    echo "Cannot run iOS simulator smoke: built .app bundle not found."
    return 1
  fi

  sim_udid="$(resolve_simulator_udid)" || {
    echo "No available iOS simulator device found."
    return 1
  }

  mkdir -p "${ARTIFACT_DIR}"
  install_log="${ARTIFACT_DIR}/ios-simulator-install.log"
  launch_log="${ARTIFACT_DIR}/ios-simulator-launch.log"
  device_log="${ARTIFACT_DIR}/ios-simulator-device.txt"
  screenshot_file="${ARTIFACT_DIR}/ios-simulator-smoke.png"

  {
    echo "timestamp_utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    echo "simulator_udid=${sim_udid}"
    echo "simulator_name_preference=${IOS_SIMULATOR_NAME}"
    echo "app_bundle_path=${IOS_RESOLVED_APP_BUNDLE_PATH}"
    echo "app_id=${IOS_APP_ID}"
  } > "${device_log}"

  xcrun simctl boot "${sim_udid}" >/dev/null 2>&1 || true
  if ! xcrun simctl bootstatus "${sim_udid}" -b >/dev/null 2>&1; then
    if ! wait_for_simulator_boot "${sim_udid}" "${IOS_SIM_BOOT_TIMEOUT_SEC}"; then
      echo "Simulator ${sim_udid} did not boot within ${IOS_SIM_BOOT_TIMEOUT_SEC}s."
      return 1
    fi
  fi

  xcrun simctl uninstall "${sim_udid}" "${IOS_APP_ID}" >/dev/null 2>&1 || true

  if xcrun simctl install "${sim_udid}" "${IOS_RESOLVED_APP_BUNDLE_PATH}" > "${install_log}" 2>&1; then
    :
  else
    echo "Simulator install failed. Install log:"
    cat "${install_log}" || true
    return 1
  fi

  launch_output="$(xcrun simctl launch "${sim_udid}" "${IOS_APP_ID}" 2>&1)" || {
    printf '%s\n' "${launch_output}" > "${launch_log}"
    echo "Simulator launch failed:"
    cat "${launch_log}" || true
    return 1
  }
  printf '%s\n' "${launch_output}" > "${launch_log}"

  xcrun simctl get_app_container "${sim_udid}" "${IOS_APP_ID}" >> "${device_log}" 2>&1 || true
  xcrun simctl io "${sim_udid}" screenshot "${screenshot_file}" >/dev/null 2>&1 || true

  if [ "${IOS_SHUTDOWN_SIM_AFTER_SMOKE}" = "1" ]; then
    xcrun simctl shutdown "${sim_udid}" >/dev/null 2>&1 || true
  fi
}

mkdir -p "${ARTIFACT_DIR}"
xcode_pipeline_ready=true

if [ "${run_config_smoke}" = "true" ]; then
  if run_ios_config_smoke; then
    :
  else
    rc=$?
    if [ "${rc}" -ne 2 ]; then
      exit "${rc}"
    fi
  fi
fi

if [ "${run_xcode_smoke}" = "true" ] || [ "${run_simulator_smoke}" = "true" ]; then
  if run_ios_web_build; then
    :
  else
    rc=$?
    if [ "${rc}" -eq 2 ]; then
      xcode_pipeline_ready=false
    else
      exit "${rc}"
    fi
  fi

  if [ "${xcode_pipeline_ready}" = "true" ]; then
    if prepare_ios_wrapper; then
      :
    else
      rc=$?
      if [ "${rc}" -eq 2 ]; then
        xcode_pipeline_ready=false
      else
        exit "${rc}"
      fi
    fi
  fi

  if [ "${xcode_pipeline_ready}" = "true" ]; then
    if run_ios_xcode_build; then
      :
    else
      rc=$?
      if [ "${rc}" -eq 2 ]; then
        xcode_pipeline_ready=false
      else
        exit "${rc}"
      fi
    fi
  fi
fi

if [ "${run_simulator_smoke}" = "true" ] && [ "${xcode_pipeline_ready}" = "true" ]; then
  if run_ios_simulator_smoke; then
    :
  else
    rc=$?
    if [ "${rc}" -ne 2 ]; then
      exit "${rc}"
    fi
  fi
fi
