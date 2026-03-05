#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WEB_DIR="${ROOT_DIR}/frontend/cloudapp-shell"
IOS_APP_DIR="${WEB_DIR}/ios/App"
DERIVED_DATA="${ROOT_DIR}/tests/e2e/mobile/artifacts/ios-derived-data"
BUNDLE_ID="${IOS_APP_ID:-com.portfolio.cloudapp}"
NODE_MODE="${IOS_NODE_MODE:-docker}"
POD_MODE="${IOS_POD_MODE:-docker}"
POD_DOCKER_IMAGE="${IOS_POD_DOCKER_IMAGE:-ruby:3.3}"
POD_VERSION="${IOS_POD_VERSION:-1.16.2}"
BUNDLE_BUDGET_KB="${BUNDLE_INITIAL_JS_GZIP_BUDGET_KB:-450}"
CHECK_BUNDLE_BUDGET="${IOS_CHECK_BUNDLE_BUDGET:-1}"
NEXT_DIST_DIR="${IOS_NEXT_DIST_DIR:-.next-mobile-build}"
SIM_NAME="${IOS_SIMULATOR_NAME:-iPhone 16 Pro}"
SCHEME="${IOS_SCHEME:-App}"
CONFIGURATION="${IOS_CONFIGURATION:-Debug}"
WORKSPACE="${IOS_WORKSPACE:-App.xcworkspace}"
PROJECT="${IOS_PROJECT:-App.xcodeproj}"
DESTINATION="${IOS_DESTINATION:-generic/platform=iOS Simulator}"
LOCAL_BASE_URL="${IOS_LOCAL_BASE_URL:-http://localhost:5001}"
if [[ "${IOS_CAP_SERVER_URL+x}" == "x" ]]; then
  CAP_SERVER_URL="${IOS_CAP_SERVER_URL}"
else
  CAP_SERVER_URL="${LOCAL_BASE_URL}"
fi
API_BASE_URL="${IOS_NEXT_PUBLIC_API_URL:-http://localhost:80/cloudapp}"
WS_API_BASE_URL="${IOS_NEXT_PUBLIC_CHAT_WS_API_URL:-http://localhost:80/cloudapp}"
HEALTHCHECK_URL="${IOS_HEALTHCHECK_URL:-http://localhost:80/nginx_health}"
XCODE_DEVELOPER_DIR="${IOS_XCODE_DEVELOPER_DIR:-/Applications/Xcode.app/Contents/Developer}"
XCODE_AUTO_SETUP="${IOS_XCODE_AUTO_SETUP:-1}"

# Prefer the full Xcode toolchain for this run, even if global xcode-select points to CLT.
if [[ -d "${XCODE_DEVELOPER_DIR}" ]]; then
  export DEVELOPER_DIR="${XCODE_DEVELOPER_DIR}"
fi

if [[ "${EUID}" -eq 0 ]]; then
  echo "Do not run this script with sudo."
  exit 1
fi

if [[ -n "${CAP_SERVER_URL}" ]]; then
  echo "Using hosted mode: IOS_CAP_SERVER_URL=${CAP_SERVER_URL}"
else
  echo "Using bundled mode (IOS_CAP_SERVER_URL is empty)."
fi

echo "Build API base: ${API_BASE_URL:-<relative>}"
echo "Build chat websocket base: ${WS_API_BASE_URL:-<relative>}"
echo "iOS node mode: ${NODE_MODE}"
echo "iOS next dist dir: ${NEXT_DIST_DIR}"

command -v xcodebuild >/dev/null 2>&1 || { echo "xcodebuild not found."; exit 1; }
command -v xcrun >/dev/null 2>&1 || { echo "xcrun not found."; exit 1; }
command -v xcode-select >/dev/null 2>&1 || { echo "xcode-select not found."; exit 1; }

xcode_tools_ready() {
  xcodebuild -version >/dev/null 2>&1 && xcrun simctl list devices available >/dev/null 2>&1
}

ensure_xcode_setup() {
  local current_dev_dir first_launch_log health_log attempt first_launch_status
  current_dev_dir="$(xcode-select -p 2>/dev/null || true)"

  if xcode_tools_ready; then
    return 0
  fi

  if [[ "${XCODE_AUTO_SETUP}" != "1" ]]; then
    echo "Xcode tools are not fully usable for iOS builds/simulator."
    echo "Current developer dir: ${current_dev_dir:-<unknown>}"
    echo "Set IOS_XCODE_AUTO_SETUP=1 or run:"
    echo "  sudo xcode-select -s \"${XCODE_DEVELOPER_DIR}\""
    echo "  sudo xcodebuild -runFirstLaunch"
    echo "  sudo xcodebuild -license accept"
    echo "  sudo xcodebuild -downloadPlatform iOS"
    exit 1
  fi

  if [[ ! -d "${XCODE_DEVELOPER_DIR}" ]]; then
    echo "Full Xcode developer directory not found: ${XCODE_DEVELOPER_DIR}"
    echo "Install Xcode from the App Store (or set IOS_XCODE_DEVELOPER_DIR), then re-run."
    exit 1
  fi

  if ! command -v sudo >/dev/null 2>&1 || [[ ! -t 0 ]]; then
    echo "xcodebuild is not usable and automatic setup cannot run (sudo/interactive shell required)."
    echo "Run manually:"
    echo "  sudo xcode-select -s \"${XCODE_DEVELOPER_DIR}\""
    echo "  sudo xcodebuild -runFirstLaunch"
    echo "  sudo xcodebuild -license accept"
    exit 1
  fi

  echo "Configuring full Xcode developer tools..."
  first_launch_log="$(mktemp "${TMPDIR:-/tmp}/xcode-first-launch.XXXXXX.log")"
  health_log="$(mktemp "${TMPDIR:-/tmp}/xcode-health.XXXXXX.log")"

  sudo -v
  sudo xcode-select -s "${XCODE_DEVELOPER_DIR}"

  for attempt in 1 2; do
    echo "Running Xcode first-launch initialization (attempt ${attempt}/2)..."
    set +e
    sudo xcodebuild -runFirstLaunch >"${first_launch_log}" 2>&1
    first_launch_status=$?
    set -e
    sudo xcodebuild -license accept >/dev/null 2>&1 || true
    sudo xcodebuild -downloadPlatform iOS >/dev/null 2>&1 || true
    killall -9 com.apple.CoreSimulator.CoreSimulatorService >/dev/null 2>&1 || true

    if xcode_tools_ready; then
      rm -f "${first_launch_log}" "${health_log}"
      return 0
    fi

    if [[ "${first_launch_status}" -ne 0 ]] && grep -qi "CoreSimulator.framework" "${first_launch_log}"; then
      echo "Detected CoreSimulator initialization issue; retrying setup..."
      sudo xcode-select -s "${XCODE_DEVELOPER_DIR}"
      continue
    fi

    break
  done

  current_dev_dir="$(xcode-select -p 2>/dev/null || true)"
  set +e
  {
    echo "[xcodebuild -version]"
    xcodebuild -version
    echo
    echo "[xcrun simctl list devices available]"
    xcrun simctl list devices available
  } >"${health_log}" 2>&1
  set -e

  echo "Xcode tools are still not usable after setup."
  echo "Current developer dir: ${current_dev_dir:-<unknown>}"
  if grep -qi "CoreSimulator.framework" "${first_launch_log}" || grep -qi "CoreSimulator.framework" "${health_log}"; then
    echo "Detected CoreSimulator framework load failure."
  fi
  echo "First-launch output (first 60 lines):"
  sed -n '1,60p' "${first_launch_log}"
  echo "Health-check output (first 60 lines):"
  sed -n '1,60p' "${health_log}"
  rm -f "${first_launch_log}" "${health_log}"
  echo "If this persists, your Xcode installation is incomplete. Reinstall Xcode, then re-run this script."
  exit 1
}

ensure_xcode_setup

case "${NODE_MODE}" in
  docker)
    command -v docker >/dev/null 2>&1 || { echo "docker not found (required for IOS_NODE_MODE=docker)."; exit 1; }
    ;;
  local)
    command -v npm >/dev/null 2>&1 || { echo "npm not found (required for IOS_NODE_MODE=local)."; exit 1; }
    command -v npx >/dev/null 2>&1 || { echo "npx not found (required for IOS_NODE_MODE=local)."; exit 1; }
    ;;
  *)
    echo "Unknown IOS_NODE_MODE='${NODE_MODE}'. Expected: docker or local."
    exit 1
    ;;
esac

resolve_pod_mode() {
  case "${POD_MODE}" in
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
      echo "${POD_MODE}"
      ;;
    *)
      echo "Unknown IOS_POD_MODE='${POD_MODE}'. Expected: auto, local, docker, skip."
      exit 1
      ;;
  esac
}

ensure_ios_pods_installed() {
  local resolved_mode

  if [[ ! -f "${IOS_APP_DIR}/Podfile" ]]; then
    echo "No Podfile found at ${IOS_APP_DIR}/Podfile; skipping pod install."
    return
  fi

  resolved_mode="$(resolve_pod_mode)"
  echo "iOS pod mode: ${resolved_mode}"
  case "${resolved_mode}" in
    skip)
      echo "Skipping pod install (IOS_POD_MODE=skip)."
      return
      ;;
    none)
      echo "CocoaPods is required but unavailable (no 'pod' and no Docker)."
      echo "Install CocoaPods locally or run with Docker available."
      exit 1
      ;;
    local)
      echo "Running pod install with local CocoaPods..."
      (
        cd "${IOS_APP_DIR}"
        pod install
      )
      ;;
    docker)
      echo "Local CocoaPods not found; running pod install via docker compose (ios-pods)..."
      if ! docker compose -f "${ROOT_DIR}/docker-compose.test.yml" run --rm \
        --user "$(id -u):$(id -g)" \
        -e POD_VERSION="${POD_VERSION}" \
        ios-pods; then
        echo "docker compose ios-pods failed; falling back to docker run (${POD_DOCKER_IMAGE})..."
        docker run --rm \
          --user "$(id -u):$(id -g)" \
          -e GEM_HOME=/tmp/gems \
          -e GEM_PATH=/tmp/gems \
          -e HOME=/tmp/cocoapods-home \
          -e COCOAPODS_DISABLE_STATS=true \
          -e POD_VERSION="${POD_VERSION}" \
          -v "${WEB_DIR}:/workspace/frontend/cloudapp-shell" \
          -w /workspace/frontend/cloudapp-shell/ios/App \
          "${POD_DOCKER_IMAGE}" \
          sh -lc 'set -e; mkdir -p "$HOME"; export PATH="$GEM_HOME/bin:$PATH"; gem install --no-document cocoapods -v "$POD_VERSION" >/tmp/gem-install.log 2>&1 || { cat /tmp/gem-install.log; exit 1; }; pod install --repo-update'
      fi
      ;;
  esac
}

if command -v curl >/dev/null 2>&1; then
  if ! curl -fsS "${HEALTHCHECK_URL}" >/dev/null 2>&1; then
    echo "Warning: ${HEALTHCHECK_URL} is unreachable."
    echo "Run your local stack before iOS smoke."
  fi
fi

if [[ "${NODE_MODE}" = "docker" ]]; then
  echo "Building web + syncing Capacitor iOS via docker compose (web-test)..."
  docker compose -f "${ROOT_DIR}/docker-compose.test.yml" run --rm \
    -e CI=true \
    -e NEXT_PUBLIC_API_URL="${API_BASE_URL}" \
    -e NEXT_PUBLIC_CHAT_WS_API_URL="${WS_API_BASE_URL}" \
    -e NEXT_DIST_DIR="${NEXT_DIST_DIR}" \
    -e BUNDLE_INITIAL_JS_GZIP_BUDGET_KB="${BUNDLE_BUDGET_KB}" \
    -e CAP_SERVER_URL="${CAP_SERVER_URL}" \
    -e CAP_WEB_DIR="${NEXT_DIST_DIR}" \
    -e CHECK_BUNDLE_BUDGET="${CHECK_BUNDLE_BUDGET}" \
    -e HOST_UID="$(id -u)" \
    -e HOST_GID="$(id -g)" \
    web-test sh -lc '
      set -e
      npm ci --cache /tmp/npm-cache --no-audit --no-fund
      max_build_attempts=3
      build_attempt=1
      while :; do
        rm -rf "${NEXT_DIST_DIR}" .next
        set +e
        NEXT_DIST_DIR="${NEXT_DIST_DIR}" npm run build >/tmp/ios-next-build.log 2>&1
        build_status=$?
        set -e
        cat /tmp/ios-next-build.log
        if [ "${build_status}" -eq 0 ]; then
          break
        fi

        transient_build_error=0
        if grep -Eq "(ENOENT: no such file or directory|ENOTEMPTY: directory not empty|Failed to collect page data for|Cannot find module .+/(\\.next|${NEXT_DIST_DIR})/)" /tmp/ios-next-build.log; then
          transient_build_error=1
        fi

        if [ "${transient_build_error}" -eq 1 ] && [ "${build_attempt}" -lt "${max_build_attempts}" ]; then
          echo "Detected transient Next.js build failure (attempt ${build_attempt}/${max_build_attempts}). Retrying with a clean build directory..."
          build_attempt=$((build_attempt + 1))
          sleep 1
          continue
        fi

        if [ "${transient_build_error}" -eq 1 ]; then
          echo "Next.js build failed after ${build_attempt} attempts due to transient filesystem/module errors."
        fi
        exit "${build_status}"
      done
      if [ "${CHECK_BUNDLE_BUDGET}" = "1" ]; then
        NEXT_DIST_DIR="${NEXT_DIST_DIR}" npm run check:bundle-budget
      fi
      if [ ! -d ios ]; then
        npx cap add ios
      fi
      CAP_SERVER_URL="${CAP_SERVER_URL}" CAP_WEB_DIR="${NEXT_DIST_DIR}" npx cap copy ios
      chown -R "${HOST_UID}:${HOST_GID}" "/workspace/frontend/cloudapp-shell/${NEXT_DIST_DIR}" /workspace/frontend/cloudapp-shell/out /workspace/frontend/cloudapp-shell/ios 2>/dev/null || true
    '
else
  echo "Building web app..."
  (
    cd "${WEB_DIR}"
    max_build_attempts=3
    build_attempt=1
    while :; do
      rm -rf "${NEXT_DIST_DIR}" .next
      set +e
      NEXT_PUBLIC_API_URL="${API_BASE_URL}" NEXT_PUBLIC_CHAT_WS_API_URL="${WS_API_BASE_URL}" NEXT_DIST_DIR="${NEXT_DIST_DIR}" npm run build >/tmp/ios-next-build.log 2>&1
      build_status=$?
      set -e
      cat /tmp/ios-next-build.log
      if [[ "${build_status}" -eq 0 ]]; then
        break
      fi

      transient_build_error=0
      if grep -Eq "(ENOENT: no such file or directory|ENOTEMPTY: directory not empty|Failed to collect page data for|Cannot find module .+/(\\.next|${NEXT_DIST_DIR})/)" /tmp/ios-next-build.log; then
        transient_build_error=1
      fi

      if [[ "${transient_build_error}" -eq 1 ]] && [[ "${build_attempt}" -lt "${max_build_attempts}" ]]; then
        echo "Detected transient Next.js build failure (attempt ${build_attempt}/${max_build_attempts}). Retrying with a clean build directory..."
        build_attempt=$((build_attempt + 1))
        sleep 1
        continue
      fi

      if [[ "${transient_build_error}" -eq 1 ]]; then
        echo "Next.js build failed after ${build_attempt} attempts due to transient filesystem/module errors."
      fi
      exit "${build_status}"
    done
    if [[ "${CHECK_BUNDLE_BUDGET}" = "1" ]]; then
      NEXT_DIST_DIR="${NEXT_DIST_DIR}" BUNDLE_INITIAL_JS_GZIP_BUDGET_KB="${BUNDLE_BUDGET_KB}" npm run check:bundle-budget
    fi
  )

  echo "Syncing Capacitor iOS wrapper..."
  (
    cd "${WEB_DIR}"
    if [[ ! -d ios ]]; then
      npx cap add ios
    fi
    CAP_SERVER_URL="${CAP_SERVER_URL}" CAP_WEB_DIR="${NEXT_DIST_DIR}" npx cap copy ios
  )
fi

ensure_ios_pods_installed

mkdir -p "${DERIVED_DATA}"

XCODE_TARGET_FLAG="-workspace"
XCODE_TARGET_PATH="${WORKSPACE}"
if [[ ! -e "${IOS_APP_DIR}/${WORKSPACE}" ]]; then
  XCODE_TARGET_FLAG="-project"
  XCODE_TARGET_PATH="${PROJECT}"
fi

echo "Running xcodebuild (${XCODE_TARGET_FLAG} ${XCODE_TARGET_PATH})..."
(
  cd "${IOS_APP_DIR}"
  xcodebuild \
    "${XCODE_TARGET_FLAG}" "${XCODE_TARGET_PATH}" \
    -scheme "${SCHEME}" \
    -configuration "${CONFIGURATION}" \
    -sdk iphonesimulator \
    -destination "${DESTINATION}" \
    -derivedDataPath "${DERIVED_DATA}" \
    CODE_SIGNING_ALLOWED=NO \
    build
)

APP_PATH="$(find "${DERIVED_DATA}/Build/Products" -maxdepth 3 -type d -name '*.app' | head -n 1)"
if [[ -z "${APP_PATH}" || ! -d "${APP_PATH}" ]]; then
  echo "Built .app bundle not found under ${DERIVED_DATA}/Build/Products."
  exit 1
fi

open -a Simulator

UDID="$(xcrun simctl list devices available | awk -F '[()]' -v name="${SIM_NAME}" '$0 ~ name {print $2; exit}')"
if [[ -z "${UDID}" ]]; then
  UDID="$(xcrun simctl list devices available | awk -F '[()]' '/iPhone/{print $2; exit}')"
fi
if [[ -z "${UDID}" ]]; then
  echo "No available iPhone simulator found."
  exit 1
fi

echo "Using simulator UDID: ${UDID}"
xcrun simctl boot "${UDID}" >/dev/null 2>&1 || true
xcrun simctl bootstatus "${UDID}" -b

echo "Installing app: ${APP_PATH}"
xcrun simctl uninstall "${UDID}" "${BUNDLE_ID}" >/dev/null 2>&1 || true
xcrun simctl install "${UDID}" "${APP_PATH}"
xcrun simctl listapps "${UDID}" | grep "${BUNDLE_ID}"

echo "Launching ${BUNDLE_ID}..."
xcrun simctl launch "${UDID}" "${BUNDLE_ID}"

echo "Done."
