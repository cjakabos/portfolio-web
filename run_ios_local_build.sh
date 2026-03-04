#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WEB_DIR="${ROOT_DIR}/frontend/cloudapp-shell"
IOS_APP_DIR="${WEB_DIR}/ios/App"
DERIVED_DATA="${ROOT_DIR}/tests/e2e/mobile/artifacts/ios-derived-data"
BUNDLE_ID="${IOS_APP_ID:-com.portfolio.cloudapp}"
NODE_MODE="${IOS_NODE_MODE:-docker}"
POD_MODE="${IOS_POD_MODE:-auto}"
POD_DOCKER_IMAGE="${IOS_POD_DOCKER_IMAGE:-cocoapods/cocoapods:1.15.2}"
BUNDLE_BUDGET_KB="${BUNDLE_INITIAL_JS_GZIP_BUDGET_KB:-450}"
CHECK_BUNDLE_BUDGET="${IOS_CHECK_BUNDLE_BUDGET:-1}"
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

command -v xcodebuild >/dev/null 2>&1 || { echo "xcodebuild not found."; exit 1; }
command -v xcrun >/dev/null 2>&1 || { echo "xcrun not found."; exit 1; }

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
      echo "Local CocoaPods not found; running pod install via Docker (${POD_DOCKER_IMAGE})..."
      docker run --rm \
        --user "$(id -u):$(id -g)" \
        -v "${IOS_APP_DIR}:/workspace" \
        -w /workspace \
        "${POD_DOCKER_IMAGE}" \
        sh -lc 'pod install'
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
      npm run build >/tmp/ios-next-build.log 2>&1
      build_status=$?
      set -e
      cat /tmp/ios-next-build.log
      if [ "${build_status}" -ne 0 ]; then
        if grep -q "pages-manifest.json" /tmp/ios-next-build.log; then
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
      if [ ! -d ios ]; then
        npx cap add ios
      fi
      npx cap copy ios
      chown -R "${HOST_UID}:${HOST_GID}" /workspace/frontend/cloudapp-shell/.next /workspace/frontend/cloudapp-shell/out /workspace/frontend/cloudapp-shell/ios 2>/dev/null || true
    '
else
  echo "Building web app..."
  (
    cd "${WEB_DIR}"
    mkdir -p .next/server
    [[ -f .next/server/pages-manifest.json ]] || printf '{}\n' > .next/server/pages-manifest.json
    set +e
    NEXT_PUBLIC_API_URL="${API_BASE_URL}" NEXT_PUBLIC_CHAT_WS_API_URL="${WS_API_BASE_URL}" npm run build >/tmp/ios-next-build.log 2>&1
    build_status=$?
    set -e
    cat /tmp/ios-next-build.log
    if [[ "${build_status}" -ne 0 ]]; then
      if grep -q "pages-manifest.json" /tmp/ios-next-build.log; then
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

  echo "Syncing Capacitor iOS wrapper..."
  (
    cd "${WEB_DIR}"
    if [[ ! -d ios ]]; then
      npx cap add ios
    fi
    CAP_SERVER_URL="${CAP_SERVER_URL}" npx cap copy ios
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
