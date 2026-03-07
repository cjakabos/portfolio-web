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
NEXT_DIST_DIR="${ANDROID_NEXT_DIST_DIR:-.next-mobile-build}"

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
# Additional host ports Android needs to reach via localhost inside the emulator.
# Includes:
# - 5002/5003/5005/5006 (module federation remotes)
# - 5333 (chat API proxy)
# - 11434 (direct Ollama model discovery checks in Jira/ChatLLM UIs)
# Note: adb reverse cannot reliably bind privileged device ports (<1024), so we
# reverse host nginx :80 through device :8080 using API_HTTP_PORT/API_HOST_PORT.
REMOTE_HTTP_PORTS="${ANDROID_REMOTE_HTTP_PORTS:-5002,5003,5005,5006,5333,11434}"
HEALTHCHECK_URL="${ANDROID_HEALTHCHECK_URL:-http://localhost:80/nginx_health}"
REQUIRED_JAVA_MAJOR="${ANDROID_JAVA_MAJOR:-21}"

RUN_MAESTRO_SMOKE="${ANDROID_RUN_MAESTRO_SMOKE:-0}"
MAESTRO_BIN="${MAESTRO_BIN:-maestro}"
BOOTSTRAP_MODE="${ANDROID_BOOTSTRAP_MODE:-auto}" # auto | prompt | manual

case "${BOOTSTRAP_MODE}" in
  auto|prompt|manual) ;;
  *)
    echo "Unknown ANDROID_BOOTSTRAP_MODE='${BOOTSTRAP_MODE}', defaulting to 'auto'."
    BOOTSTRAP_MODE="auto"
    ;;
esac

is_interactive_shell() {
  [[ -t 0 ]] && [[ "${CI:-}" != "true" ]]
}

maybe_install_with_brew() {
  local description="$1"
  shift
  local brew_args=("$@")

  if ! command -v brew >/dev/null 2>&1; then
    echo "Homebrew is not installed."
    echo "Install ${description} manually, then re-run this script."
    echo "Suggested command (macOS): brew ${brew_args[*]}"
    return 1
  fi

  case "${BOOTSTRAP_MODE}" in
    manual)
      echo "Automatic bootstrap is disabled (ANDROID_BOOTSTRAP_MODE=manual)."
      echo "Install ${description} manually:"
      echo "  brew ${brew_args[*]}"
      return 1
      ;;
    prompt)
      if is_interactive_shell; then
        local install_reply
        read -r -p "Install ${description} now? [Y/n] " install_reply
        case "${install_reply}" in
          n|N|no|NO)
            echo "Skipped installation."
            echo "Run this first, then re-run the script:"
            echo "  brew ${brew_args[*]}"
            return 1
            ;;
        esac
      else
        echo "Prompt mode is enabled but shell is non-interactive; skipping auto-install for ${description}."
        echo "Run this first, then re-run the script:"
        echo "  brew ${brew_args[*]}"
        return 1
      fi
      ;;
  esac

  echo "Installing ${description}..."
  brew "${brew_args[@]}"
  hash -r
}

maybe_install_with_sdkmanager() {
  local sdkmanager_bin="$1"
  local sdk_dir="$2"
  local description="$3"
  shift 3
  local packages=("$@")
  local cmd
  cmd="\"${sdkmanager_bin}\" --sdk_root=\"${sdk_dir}\""
  for pkg in "${packages[@]}"; do
    cmd+=" \"${pkg}\""
  done

  case "${BOOTSTRAP_MODE}" in
    manual)
      echo "Automatic bootstrap is disabled (ANDROID_BOOTSTRAP_MODE=manual)."
      echo "Install ${description} manually:"
      echo "  ${cmd}"
      return 1
      ;;
    prompt)
      if is_interactive_shell; then
        local install_reply
        read -r -p "Install ${description} now? [Y/n] " install_reply
        case "${install_reply}" in
          n|N|no|NO)
            echo "Skipped installation."
            echo "Run this first, then re-run the script:"
            echo "  ${cmd}"
            return 1
            ;;
        esac
      else
        echo "Prompt mode is enabled but shell is non-interactive; skipping auto-install for ${description}."
        echo "Run this first, then re-run the script:"
        echo "  ${cmd}"
        return 1
      fi
      ;;
  esac

  echo "Installing ${description}..."
  "${sdkmanager_bin}" --sdk_root="${sdk_dir}" "${packages[@]}"
}

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
echo "Android next dist dir: ${NEXT_DIST_DIR}"
echo "Bootstrap mode: ${BOOTSTRAP_MODE}"

ensure_adb_available() {
  if command -v adb >/dev/null 2>&1; then
    return 0
  fi

  echo "adb not found in PATH."

  if [[ "$(uname -s)" != "Darwin" ]]; then
    echo "Install Android SDK platform-tools and ensure adb is available in PATH."
    exit 1
  fi

  maybe_install_with_brew "Android platform-tools (adb)" install --cask android-platform-tools || exit 1

  if ! command -v adb >/dev/null 2>&1; then
    echo "adb is still not available in PATH after installation."
    echo "Open a new terminal and verify with: adb version"
    exit 1
  fi
}

ensure_adb_available

java_major_from_version() {
  local version_string="$1"
  if [[ -z "${version_string}" ]]; then
    echo ""
    return 0
  fi

  if [[ "${version_string}" == 1.* ]]; then
    echo "${version_string}" | cut -d '.' -f 2
  else
    echo "${version_string}" | cut -d '.' -f 1
  fi
}

setup_java_home_if_available() {
  if [[ "$(uname -s)" != "Darwin" ]]; then
    return 0
  fi

  local java_home_candidate
  if java_home_candidate="$(/usr/libexec/java_home -v "${REQUIRED_JAVA_MAJOR}" 2>/dev/null)"; then
    export JAVA_HOME="${java_home_candidate}"
    export PATH="${JAVA_HOME}/bin:${PATH}"
    return 0
  fi
  if java_home_candidate="$(/usr/libexec/java_home -v "${REQUIRED_JAVA_MAJOR}+" 2>/dev/null)"; then
    export JAVA_HOME="${java_home_candidate}"
    export PATH="${JAVA_HOME}/bin:${PATH}"
    return 0
  fi
}

ensure_java_runtime() {
  setup_java_home_if_available || true

  local java_version
  local java_major
  java_version="$(java -version 2>&1 | awk -F'"' '/version/ {print $2; exit}' || true)"
  java_major="$(java_major_from_version "${java_version}")"

  if command -v java >/dev/null 2>&1 \
    && command -v javac >/dev/null 2>&1 \
    && [[ "${java_major}" =~ ^[0-9]+$ ]] \
    && (( java_major >= REQUIRED_JAVA_MAJOR )); then
    return 0
  fi

  echo "Java ${REQUIRED_JAVA_MAJOR}+ JDK is required for Android builds."
  if [[ -n "${java_version}" ]]; then
    echo "Detected java version: ${java_version}"
  else
    echo "No Java runtime detected."
  fi

  if [[ "$(uname -s)" != "Darwin" ]]; then
    echo "Install JDK ${REQUIRED_JAVA_MAJOR}+ and ensure java/javac are in PATH."
    exit 1
  fi

  maybe_install_with_brew "Java JDK ${REQUIRED_JAVA_MAJOR} (temurin@21)" install --cask temurin@21 || exit 1

  setup_java_home_if_available || true
  java_version="$(java -version 2>&1 | awk -F'"' '/version/ {print $2; exit}' || true)"
  java_major="$(java_major_from_version "${java_version}")"

  if ! command -v java >/dev/null 2>&1 \
    || ! command -v javac >/dev/null 2>&1 \
    || ! [[ "${java_major}" =~ ^[0-9]+$ ]] \
    || (( java_major < REQUIRED_JAVA_MAJOR )); then
    echo "Java ${REQUIRED_JAVA_MAJOR}+ is still not available in PATH."
    echo "Open a new terminal and verify with: java -version && javac -version"
    exit 1
  fi
}

ensure_java_runtime

resolve_compile_sdk_version() {
  local default_sdk="35"
  local vars_file="${ANDROID_APP_DIR}/variables.gradle"
  if [[ -f "${vars_file}" ]]; then
    local parsed
    parsed="$(awk -F'=' '/compileSdkVersion/ {gsub(/[^0-9]/,"",$2); if ($2 != "") { print $2; exit }}' "${vars_file}" || true)"
    if [[ "${parsed}" =~ ^[0-9]+$ ]]; then
      echo "${parsed}"
      return 0
    fi
  fi
  echo "${default_sdk}"
}

find_android_sdk_dir() {
  local local_props="${ANDROID_APP_DIR}/local.properties"
  local prop_dir=""
  if [[ -f "${local_props}" ]]; then
    prop_dir="$(awk -F'=' '/^sdk\.dir=/{print $2; exit}' "${local_props}" | sed 's#\\:#:#g; s#\\\\#\\#g' || true)"
    if [[ -n "${prop_dir}" ]] && [[ -d "${prop_dir}" ]]; then
      echo "${prop_dir}"
      return 0
    fi
  fi

  if [[ -n "${ANDROID_SDK_ROOT:-}" ]] && [[ -d "${ANDROID_SDK_ROOT}" ]]; then
    echo "${ANDROID_SDK_ROOT}"
    return 0
  fi
  if [[ -n "${ANDROID_HOME:-}" ]] && [[ -d "${ANDROID_HOME}" ]]; then
    echo "${ANDROID_HOME}"
    return 0
  fi
  if [[ -d "${HOME}/Library/Android/sdk" ]]; then
    echo "${HOME}/Library/Android/sdk"
    return 0
  fi
  if [[ -d "${HOME}/Android/Sdk" ]]; then
    echo "${HOME}/Android/Sdk"
    return 0
  fi
}

find_sdkmanager_bin() {
  local sdk_dir="${1:-}"
  local candidate=""

  if candidate="$(command -v sdkmanager 2>/dev/null || true)" && [[ -n "${candidate}" ]]; then
    echo "${candidate}"
    return 0
  fi

  if [[ -n "${sdk_dir}" ]]; then
    for candidate in \
      "${sdk_dir}/cmdline-tools/latest/bin/sdkmanager" \
      "${sdk_dir}/cmdline-tools/bin/sdkmanager" \
      "${sdk_dir}/tools/bin/sdkmanager"; do
      if [[ -x "${candidate}" ]]; then
        echo "${candidate}"
        return 0
      fi
    done
  fi

  for candidate in \
    "/opt/homebrew/share/android-commandlinetools/cmdline-tools/latest/bin/sdkmanager" \
    "/opt/homebrew/share/android-commandlinetools/cmdline-tools/bin/sdkmanager" \
    "/usr/local/share/android-commandlinetools/cmdline-tools/latest/bin/sdkmanager" \
    "/usr/local/share/android-commandlinetools/cmdline-tools/bin/sdkmanager"; do
    if [[ -x "${candidate}" ]]; then
      echo "${candidate}"
      return 0
    fi
  done

  if command -v brew >/dev/null 2>&1; then
    local brew_prefix
    brew_prefix="$(brew --prefix 2>/dev/null || true)"
    if [[ -n "${brew_prefix}" ]]; then
      for candidate in \
        "${brew_prefix}/share/android-commandlinetools/cmdline-tools/latest/bin/sdkmanager" \
        "${brew_prefix}/share/android-commandlinetools/cmdline-tools/bin/sdkmanager"; do
        if [[ -x "${candidate}" ]]; then
          echo "${candidate}"
          return 0
        fi
      done
    fi
  fi
}

find_avdmanager_bin() {
  local sdk_dir="${1:-}"
  local candidate=""

  if candidate="$(command -v avdmanager 2>/dev/null || true)" && [[ -n "${candidate}" ]]; then
    echo "${candidate}"
    return 0
  fi

  if [[ -n "${sdk_dir}" ]]; then
    for candidate in \
      "${sdk_dir}/cmdline-tools/latest/bin/avdmanager" \
      "${sdk_dir}/cmdline-tools/bin/avdmanager" \
      "${sdk_dir}/tools/bin/avdmanager"; do
      if [[ -x "${candidate}" ]]; then
        echo "${candidate}"
        return 0
      fi
    done
  fi

  for candidate in \
    "/opt/homebrew/share/android-commandlinetools/cmdline-tools/latest/bin/avdmanager" \
    "/opt/homebrew/share/android-commandlinetools/cmdline-tools/bin/avdmanager" \
    "/usr/local/share/android-commandlinetools/cmdline-tools/latest/bin/avdmanager" \
    "/usr/local/share/android-commandlinetools/cmdline-tools/bin/avdmanager"; do
    if [[ -x "${candidate}" ]]; then
      echo "${candidate}"
      return 0
    fi
  done

  if command -v brew >/dev/null 2>&1; then
    local brew_prefix
    brew_prefix="$(brew --prefix 2>/dev/null || true)"
    if [[ -n "${brew_prefix}" ]]; then
      for candidate in \
        "${brew_prefix}/share/android-commandlinetools/cmdline-tools/latest/bin/avdmanager" \
        "${brew_prefix}/share/android-commandlinetools/cmdline-tools/bin/avdmanager"; do
        if [[ -x "${candidate}" ]]; then
          echo "${candidate}"
          return 0
        fi
      done
    fi
  fi
}

upsert_gradle_property() {
  local file="$1"
  local key="$2"
  local value="$3"
  local tmp
  tmp="$(mktemp "${TMPDIR:-/tmp}/gradle-prop.XXXXXX")"

  awk -v key="$key" -v value="$value" '
    BEGIN { updated = 0 }
    $0 ~ "^" key "=" {
      print key "=" value
      updated = 1
      next
    }
    { print }
    END {
      if (updated == 0) print key "=" value
    }
  ' "$file" > "$tmp"

  mv "$tmp" "$file"
}

ensure_android_sdk() {
  local required_compile_sdk
  local required_build_tools
  local sdk_dir
  local sdkmanager_bin
  local has_platform_tools
  local has_platform_target
  local has_build_tools
  local local_props_file="${ANDROID_APP_DIR}/local.properties"

  required_compile_sdk="$(resolve_compile_sdk_version)"
  required_build_tools="${required_compile_sdk}.0.0"
  sdk_dir="$(find_android_sdk_dir || true)"

  if [[ -z "${sdk_dir}" ]]; then
    if [[ "$(uname -s)" = "Darwin" ]]; then
      maybe_install_with_brew "Android command line tools" install --cask android-commandlinetools || exit 1
    else
      echo "Android SDK not found."
      echo "Install Android SDK and re-run this script."
      if [[ "$(uname -s)" = "Darwin" ]]; then
        echo "Suggested command (macOS): brew install --cask android-commandlinetools"
      fi
      exit 1
    fi
    sdk_dir="${HOME}/Library/Android/sdk"
  fi

  mkdir -p "${sdk_dir}"
  sdkmanager_bin="$(find_sdkmanager_bin "${sdk_dir}" || true)"

  has_platform_tools=0
  has_platform_target=0
  has_build_tools=0
  [[ -d "${sdk_dir}/platform-tools" ]] && has_platform_tools=1
  [[ -d "${sdk_dir}/platforms/android-${required_compile_sdk}" ]] && has_platform_target=1
  if [[ -d "${sdk_dir}/build-tools/${required_build_tools}" ]] \
    || find "${sdk_dir}/build-tools" -mindepth 1 -maxdepth 1 -type d >/dev/null 2>&1; then
    has_build_tools=1
  fi

  if [[ "${has_platform_tools}" -eq 1 ]] && [[ "${has_platform_target}" -eq 1 ]] && [[ "${has_build_tools}" -eq 1 ]]; then
    echo "Using existing Android SDK at ${sdk_dir}."
  else
    if [[ -z "${sdkmanager_bin}" ]] && [[ "$(uname -s)" = "Darwin" ]]; then
      maybe_install_with_brew "Android command line tools" install --cask android-commandlinetools || true
      sdkmanager_bin="$(find_sdkmanager_bin "${sdk_dir}" || true)"
    fi

    if [[ -z "${sdkmanager_bin}" ]]; then
      echo "sdkmanager not found."
      echo "Install Android SDK command line tools (or Android Studio) and ensure sdkmanager is available."
      echo "Required minimum SDK contents:"
      echo "  ${sdk_dir}/platform-tools"
      echo "  ${sdk_dir}/platforms/android-${required_compile_sdk}"
      echo "  ${sdk_dir}/build-tools/${required_build_tools} (or another build-tools version)"
      exit 1
    fi

    if [[ "${BOOTSTRAP_MODE}" != "manual" ]]; then
      echo "Ensuring required Android SDK packages are installed in ${sdk_dir}..."
      yes | "${sdkmanager_bin}" --sdk_root="${sdk_dir}" --licenses >/dev/null 2>&1 || true
    fi
    maybe_install_with_sdkmanager "${sdkmanager_bin}" "${sdk_dir}" "Android SDK packages (platform-tools/platform/build-tools)" \
      "platform-tools" \
      "platforms;android-${required_compile_sdk}" \
      "build-tools;${required_build_tools}" || exit 1

    has_platform_tools=0
    has_platform_target=0
    has_build_tools=0
    [[ -d "${sdk_dir}/platform-tools" ]] && has_platform_tools=1
    [[ -d "${sdk_dir}/platforms/android-${required_compile_sdk}" ]] && has_platform_target=1
    if [[ -d "${sdk_dir}/build-tools/${required_build_tools}" ]] \
      || find "${sdk_dir}/build-tools" -mindepth 1 -maxdepth 1 -type d >/dev/null 2>&1; then
      has_build_tools=1
    fi

    if [[ "${has_platform_tools}" -ne 1 ]] || [[ "${has_platform_target}" -ne 1 ]] || [[ "${has_build_tools}" -ne 1 ]]; then
      echo "Android SDK is still incomplete after bootstrap attempt."
      echo "Required minimum SDK contents:"
      echo "  ${sdk_dir}/platform-tools"
      echo "  ${sdk_dir}/platforms/android-${required_compile_sdk}"
      echo "  ${sdk_dir}/build-tools/${required_build_tools} (or another build-tools version)"
      exit 1
    fi
  fi

  export ANDROID_SDK_ROOT="${sdk_dir}"
  export ANDROID_HOME="${sdk_dir}"
  export PATH="${sdk_dir}/platform-tools:${sdk_dir}/emulator:${PATH}"

  touch "${local_props_file}"
  upsert_gradle_property "${local_props_file}" "sdk.dir" "${sdk_dir}"
}

ensure_android_sdk

ensure_sdk_local_avdmanager() {
  local sdk_dir="$1"
  local sdkmanager_bin="$2"
  local local_avdmanager="${sdk_dir}/cmdline-tools/latest/bin/avdmanager"

  if [[ -x "${local_avdmanager}" ]]; then
    echo "${local_avdmanager}"
    return 0
  fi

  if [[ -n "${sdkmanager_bin}" ]]; then
    # Suppress installer stdout here so command-substitution callers
    # only capture a binary path, never log lines.
    maybe_install_with_sdkmanager "${sdkmanager_bin}" "${sdk_dir}" "Android cmdline-tools;latest" "cmdline-tools;latest" >/dev/null 2>&1 || true
    if [[ -x "${local_avdmanager}" ]]; then
      echo "${local_avdmanager}"
      return 0
    fi
  fi

  return 1
}

select_system_image_package() {
  local sdkmanager_bin="$1"
  local sdk_dir="$2"
  local preferred_compile_sdk="$3"
  local preferred_abi="$4"

  local packages=""
  packages="$("${sdkmanager_bin}" --sdk_root="${sdk_dir}" --list 2>/dev/null \
    | awk '{gsub(/\r/,""); if ($1 ~ /^system-images;android-[0-9]+;/) print $1}' \
    | sort -u)"

  select_preferred_system_image_from_list "${packages}" "${preferred_compile_sdk}" "${preferred_abi}"
}

select_preferred_system_image_from_list() {
  local packages="$1"
  local preferred_compile_sdk="$2"
  local preferred_abi="$3"

  local versions=""
  local ordered_versions=""
  local ver=""
  local ver_list=""
  local fallback_abi=""
  local match=""

  [[ -n "${packages}" ]] || return 1

  versions="$(printf '%s\n' "${packages}" \
    | awk -F';' '{v=$2; sub(/^android-/,"",v); if (v ~ /^[0-9]+$/) print v}' \
    | sort -nr -u)"

  ordered_versions="${preferred_compile_sdk}"$'\n'"$(printf '%s\n' "${versions}" | awk -v pref="${preferred_compile_sdk}" '$1 != pref')"

  if [[ "${preferred_abi}" = "arm64-v8a" ]]; then
    fallback_abi="x86_64"
  else
    fallback_abi="arm64-v8a"
  fi

  while IFS= read -r ver; do
    [[ -n "${ver}" ]] || continue
    ver_list="$(printf '%s\n' "${packages}" | awk -F';' -v ver="${ver}" '$2=="android-" ver {print}')"
    [[ -n "${ver_list}" ]] || continue

    for match in \
      "$(printf '%s\n' "${ver_list}" | grep -E "^system-images;android-${ver};google_apis;${preferred_abi}$" | head -n 1)" \
      "$(printf '%s\n' "${ver_list}" | grep -E "^system-images;android-${ver};google_apis_playstore;${preferred_abi}$" | head -n 1)" \
      "$(printf '%s\n' "${ver_list}" | grep -E ";${preferred_abi}$" | head -n 1)" \
      "$(printf '%s\n' "${ver_list}" | grep -E "^system-images;android-${ver};google_apis;${fallback_abi}$" | head -n 1)" \
      "$(printf '%s\n' "${ver_list}" | grep -E "^system-images;android-${ver};google_apis_playstore;${fallback_abi}$" | head -n 1)" \
      "$(printf '%s\n' "${ver_list}" | grep -E ";${fallback_abi}$" | head -n 1)" \
      "$(printf '%s\n' "${ver_list}" | head -n 1)"; do
      if [[ -n "${match}" ]]; then
        echo "${match}"
        return 0
      fi
    done
  done <<< "${ordered_versions}"

  return 1
}

list_installed_system_image_packages() {
  local sdk_dir="$1"
  local base="${sdk_dir}/system-images"
  [[ -d "${base}" ]] || return 0

  find "${base}" -mindepth 3 -maxdepth 3 -type d 2>/dev/null \
    | while IFS= read -r dir; do
      local rel api tag abi rest
      rel="${dir#${base}/}"
      api="${rel%%/*}"
      rest="${rel#*/}"
      tag="${rest%%/*}"
      abi="${rest#*/}"
      [[ -n "${api}" ]] && [[ -n "${tag}" ]] && [[ -n "${abi}" ]] || continue
      printf 'system-images;%s;%s;%s\n' "${api}" "${tag}" "${abi}"
    done \
    | sort -u
}

ensure_avd_exists() {
  local sdk_dir="${ANDROID_SDK_ROOT:-${ANDROID_HOME:-}}"
  local compile_sdk
  local abi
  local system_image_package=""
  local system_image_abi=""
  local system_image_api=""
  local sdkmanager_bin=""
  local avdmanager_bin=""
  local system_image_hint=""
  local default_avd_name
  local create_avd_name
  local available_avds=""
  local installed_system_images=""
  local avd_create_cmd_ok=0

  compile_sdk="$(resolve_compile_sdk_version)"
  abi="x86_64"
  if [[ "$(uname -m)" = "arm64" ]]; then
    abi="arm64-v8a"
  fi
  default_avd_name="${ANDROID_DEFAULT_AVD_NAME:-cloudapp-api${compile_sdk}-${abi}}"

  available_avds="$(emulator -list-avds 2>/dev/null || true)"

  if [[ -n "${AVD_NAME}" ]]; then
    if printf '%s\n' "${available_avds}" | grep -Fxq "${AVD_NAME}"; then
      return 0
    fi
    echo "Requested AVD '${AVD_NAME}' was not found."
  else
    AVD_NAME="$(printf '%s\n' "${available_avds}" | head -n 1 || true)"
    if [[ -n "${AVD_NAME}" ]]; then
      return 0
    fi
  fi

  sdkmanager_bin="$(find_sdkmanager_bin "${sdk_dir}" || true)"
  avdmanager_bin="$(ensure_sdk_local_avdmanager "${sdk_dir}" "${sdkmanager_bin}" || true)"
  if [[ -z "${avdmanager_bin}" ]] && [[ -n "${sdkmanager_bin}" ]]; then
    local sdk_tools_dir
    sdk_tools_dir="$(cd "$(dirname "${sdkmanager_bin}")" && pwd)"
    if [[ -x "${sdk_tools_dir}/avdmanager" ]]; then
      avdmanager_bin="${sdk_tools_dir}/avdmanager"
    fi
  fi
  if [[ -z "${avdmanager_bin}" ]]; then
    avdmanager_bin="$(find_avdmanager_bin "${sdk_dir}" || true)"
  fi
  if [[ -z "${sdkmanager_bin}" ]] || [[ -z "${avdmanager_bin}" ]]; then
    echo "sdkmanager or avdmanager was not found."
    echo "Install Android command line tools (or Android Studio), then create an AVD."
    exit 1
  fi

  system_image_hint="$(select_system_image_package "${sdkmanager_bin}" "${sdk_dir}" "${compile_sdk}" "${abi}" || true)"
  if [[ -z "${system_image_hint}" ]]; then
    system_image_hint="system-images;android-${compile_sdk};google_apis;${abi}"
  fi

  if [[ "${BOOTSTRAP_MODE}" = "manual" ]]; then
    echo "No Android Virtual Device found."
    echo "Automatic bootstrap is disabled (ANDROID_BOOTSTRAP_MODE=manual)."
    echo "Create one manually with:"
    echo "  \"${sdkmanager_bin}\" --sdk_root=\"${sdk_dir}\" \"${system_image_hint}\""
    echo "  ANDROID_SDK_ROOT=\"${sdk_dir}\" ANDROID_HOME=\"${sdk_dir}\" \"${avdmanager_bin}\" create avd -n \"${default_avd_name}\" -k \"${system_image_hint}\""
    exit 1
  fi

  if [[ "${BOOTSTRAP_MODE}" = "prompt" ]]; then
    if ! is_interactive_shell; then
      echo "Prompt mode is enabled but shell is non-interactive."
      echo "Create an AVD manually with:"
      echo "  \"${sdkmanager_bin}\" --sdk_root=\"${sdk_dir}\" \"${system_image_hint}\""
      echo "  ANDROID_SDK_ROOT=\"${sdk_dir}\" ANDROID_HOME=\"${sdk_dir}\" \"${avdmanager_bin}\" create avd -n \"${default_avd_name}\" -k \"${system_image_hint}\""
      exit 1
    fi

    local create_avd_reply
    read -r -p "No AVD found. Create one automatically now? [Y/n] " create_avd_reply
    case "${create_avd_reply}" in
      n|N|no|NO)
        echo "Skipped AVD creation."
        echo "Create one in Android Studio, then re-run this script."
        exit 1
        ;;
    esac
  fi

  system_image_package="${system_image_hint}"
  system_image_api="$(printf '%s' "${system_image_package}" | awk -F';' '{v=$2; sub(/^android-/,"",v); print v}')"
  system_image_abi="$(printf '%s' "${system_image_package}" | awk -F';' '{print $4}')"

  echo "Installing Android system image ${system_image_package}..."
  maybe_install_with_sdkmanager "${sdkmanager_bin}" "${sdk_dir}" "Android system image ${system_image_package}" "${system_image_package}" || exit 1

  installed_system_images="$(list_installed_system_image_packages "${sdk_dir}")"
  system_image_package="$(select_preferred_system_image_from_list "${installed_system_images}" "${compile_sdk}" "${abi}" || true)"
  if [[ -z "${system_image_package}" ]]; then
    echo "No installed Android system image could be found under ${sdk_dir}/system-images."
    if [[ -n "${installed_system_images}" ]]; then
      echo "Detected entries:"
      printf '%s\n' "${installed_system_images}"
    fi
    exit 1
  fi

  system_image_api="$(printf '%s' "${system_image_package}" | awk -F';' '{v=$2; sub(/^android-/,"",v); print v}')"
  system_image_abi="$(printf '%s' "${system_image_package}" | awk -F';' '{print $4}')"
  create_avd_name="${AVD_NAME:-${ANDROID_DEFAULT_AVD_NAME:-cloudapp-api${system_image_api}-${system_image_abi}}}"

  echo "Creating AVD '${create_avd_name}'..."
  export ANDROID_SDK_ROOT="${sdk_dir}"
  export ANDROID_HOME="${sdk_dir}"
  if echo "no" | "${avdmanager_bin}" create avd -n "${create_avd_name}" -k "${system_image_package}" -b "${system_image_abi}" --force; then
    avd_create_cmd_ok=1
  elif echo "no" | "${avdmanager_bin}" create avd -n "${create_avd_name}" -k "${system_image_package}" --force; then
    avd_create_cmd_ok=1
  fi
  if [[ "${avd_create_cmd_ok}" -ne 1 ]]; then
    echo "AVD creation failed for package: ${system_image_package}"
    echo "Using sdkmanager: ${sdkmanager_bin}"
    echo "Using avdmanager: ${avdmanager_bin}"
    echo "Installed system image packages under ${sdk_dir}:"
    printf '%s\n' "${installed_system_images}"
    exit 1
  fi
  AVD_NAME="${create_avd_name}"

  available_avds="$(emulator -list-avds 2>/dev/null || true)"
  if ! printf '%s\n' "${available_avds}" | grep -Fxq "${AVD_NAME}"; then
    echo "AVD '${AVD_NAME}' was not found after creation."
    exit 1
  fi
}

ensure_emulator_binary() {
  if command -v emulator >/dev/null 2>&1; then
    return 0
  fi

  echo "Android emulator binary not found in PATH (emulator)."
  echo "This script can continue without emulator only if a physical device is already connected."

  local sdk_dir="${ANDROID_SDK_ROOT:-${ANDROID_HOME:-}}"
  local sdkmanager_bin=""
  sdkmanager_bin="$(find_sdkmanager_bin "${sdk_dir}" || true)"

  if [[ -z "${sdkmanager_bin}" ]]; then
    echo "sdkmanager not found, so emulator package cannot be installed automatically."
    echo "Install Android SDK command line tools (or Android Studio), then install package: emulator"
    exit 1
  fi

  maybe_install_with_sdkmanager "${sdkmanager_bin}" "${sdk_dir}" "Android emulator package" "emulator" || exit 1

  export PATH="${sdk_dir}/emulator:${PATH}"
  if ! command -v emulator >/dev/null 2>&1; then
    echo "emulator is still not available in PATH after installation."
    echo "Open a new terminal and verify with: emulator -version"
    exit 1
  fi
}

ensure_capacitor_android_node_module() {
  local capacitor_android_dir="${WEB_DIR}/node_modules/@capacitor/android/capacitor"
  if [[ -d "${capacitor_android_dir}" ]]; then
    return 0
  fi

  echo "Missing Capacitor Android sources at:"
  echo "  ${capacitor_android_dir}"
  echo "Installing frontend dependencies so Gradle can resolve :capacitor-android..."

  if [[ "${NODE_MODE}" = "docker" ]]; then
    command -v docker >/dev/null 2>&1 || {
      echo "docker not found (required to populate node_modules in ANDROID_NODE_MODE=docker)."
      exit 1
    }
    mkdir -p "${WEB_DIR}/node_modules"
    docker run --rm \
      -e CI=true \
      --user "$(id -u):$(id -g)" \
      -v "${WEB_DIR}:/workspace/frontend/cloudapp-shell" \
      -w /workspace/frontend/cloudapp-shell \
      node:22-alpine \
      sh -lc 'npm ci --cache /tmp/npm-cache --no-audit --no-fund'
  else
    command -v npm >/dev/null 2>&1 || {
      echo "npm not found (required to populate node_modules in ANDROID_NODE_MODE=local)."
      exit 1
    }
    (
      cd "${WEB_DIR}"
      npm ci --no-audit --no-fund
    )
  fi

  if [[ ! -d "${capacitor_android_dir}" ]]; then
    echo "Capacitor Android sources are still missing after dependency install."
    echo "Expected directory: ${capacitor_android_dir}"
    exit 1
  fi
}

ensure_gradle_wrapper() {
  local wrapper_script="${ANDROID_APP_DIR}/gradlew"
  local wrapper_jar="${ANDROID_APP_DIR}/gradle/wrapper/gradle-wrapper.jar"
  local wrapper_props="${ANDROID_APP_DIR}/gradle/wrapper/gradle-wrapper.properties"

  if [[ -x "${wrapper_script}" ]] && [[ -f "${wrapper_jar}" ]] && [[ -f "${wrapper_props}" ]]; then
    return 0
  fi

  echo "Gradle wrapper is missing or incomplete."
  echo "Expected files:"
  echo "  ${wrapper_script}"
  echo "  ${wrapper_jar}"
  echo "  ${wrapper_props}"

  if [[ ! -d "${ANDROID_APP_DIR}" ]]; then
    echo "Android app directory does not exist: ${ANDROID_APP_DIR}"
    echo "Run this first from ${WEB_DIR}: npx cap add android"
    exit 1
  fi

  if ! command -v gradle >/dev/null 2>&1; then
    if [[ "$(uname -s)" != "Darwin" ]]; then
      echo "Install Gradle and re-run this script."
      exit 1
    fi

    maybe_install_with_brew "Gradle" install gradle || exit 1
  fi

  if ! command -v gradle >/dev/null 2>&1; then
    echo "Gradle is still not available in PATH."
    echo "Open a new terminal and verify with: gradle --version"
    exit 1
  fi

  echo "Regenerating Gradle wrapper..."
  (
    cd "${ANDROID_APP_DIR}"
    gradle wrapper
  )
  chmod +x "${wrapper_script}" >/dev/null 2>&1 || true

  if [[ ! -x "${wrapper_script}" ]] || [[ ! -f "${wrapper_jar}" ]] || [[ ! -f "${wrapper_props}" ]]; then
    echo "Gradle wrapper regeneration failed."
    exit 1
  fi
}

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

  ensure_emulator_binary

  ensure_avd_exists

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
        NEXT_DIST_DIR="${NEXT_DIST_DIR}" npm run build >/tmp/android-next-build.log 2>&1
        build_status=$?
        set -e
        cat /tmp/android-next-build.log
        if [ "${build_status}" -eq 0 ]; then
          break
        fi

        transient_build_error=0
        if grep -Eq "(ENOENT: no such file or directory|ENOTEMPTY: directory not empty|Failed to collect page data for|Cannot find module .+/(\\.next|${NEXT_DIST_DIR})/)" /tmp/android-next-build.log; then
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
      if [ ! -d android ]; then
        npx cap add android
      fi
      CAP_SERVER_URL="${CAP_SERVER_URL}" CAP_WEB_DIR="${NEXT_DIST_DIR}" npx cap sync android
      chown -R "${HOST_UID}:${HOST_GID}" "/workspace/frontend/cloudapp-shell/${NEXT_DIST_DIR}" /workspace/frontend/cloudapp-shell/out /workspace/frontend/cloudapp-shell/android 2>/dev/null || true
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
      NEXT_PUBLIC_API_URL="${API_BASE_URL}" NEXT_PUBLIC_CHAT_WS_API_URL="${WS_API_BASE_URL}" NEXT_DIST_DIR="${NEXT_DIST_DIR}" npm run build >/tmp/android-next-build.log 2>&1
      build_status=$?
      set -e
      cat /tmp/android-next-build.log
      if [[ "${build_status}" -eq 0 ]]; then
        break
      fi

      transient_build_error=0
      if grep -Eq "(ENOENT: no such file or directory|ENOTEMPTY: directory not empty|Failed to collect page data for|Cannot find module .+/(\\.next|${NEXT_DIST_DIR})/)" /tmp/android-next-build.log; then
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

  echo "Syncing Capacitor Android wrapper..."
  (
    cd "${WEB_DIR}"
    if [[ ! -d android ]]; then
      npx cap add android
    fi
    CAP_SERVER_URL="${CAP_SERVER_URL}" CAP_WEB_DIR="${NEXT_DIST_DIR}" npx cap sync android
  )
fi

ensure_capacitor_android_node_module
ensure_gradle_wrapper

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
  if adb -s "${DEVICE_ID}" reverse "tcp:${APP_HTTP_PORT}" "tcp:${APP_HTTP_PORT}" >/dev/null 2>&1; then
    echo "adb reverse active: tcp:${APP_HTTP_PORT} -> tcp:${APP_HTTP_PORT}"
  else
    echo "Warning: adb reverse failed for tcp:${APP_HTTP_PORT} -> tcp:${APP_HTTP_PORT}"
  fi
fi
if [[ -n "${API_HTTP_PORT}" ]] && [[ "${API_HTTP_PORT}" != "${APP_HTTP_PORT}" ]]; then
  if adb -s "${DEVICE_ID}" reverse "tcp:${API_HTTP_PORT}" "tcp:${API_HOST_PORT}" >/dev/null 2>&1; then
    echo "adb reverse active: tcp:${API_HTTP_PORT} -> tcp:${API_HOST_PORT}"
  else
    echo "Warning: adb reverse failed for tcp:${API_HTTP_PORT} -> tcp:${API_HOST_PORT}"
  fi
fi
if [[ -n "${REMOTE_HTTP_PORTS}" ]]; then
  IFS=',' read -r -a remote_port_list <<< "${REMOTE_HTTP_PORTS}"
  for remote_port in "${remote_port_list[@]}"; do
    remote_port="$(echo "${remote_port}" | tr -d '[:space:]')"
    [[ -z "${remote_port}" ]] && continue
    [[ "${remote_port}" =~ ^[0-9]+$ ]] || continue
    [[ "${remote_port}" = "${APP_HTTP_PORT}" ]] && continue
    [[ "${remote_port}" = "${API_HTTP_PORT}" ]] && continue
    if adb -s "${DEVICE_ID}" reverse "tcp:${remote_port}" "tcp:${remote_port}" >/dev/null 2>&1; then
      echo "adb reverse active: tcp:${remote_port} -> tcp:${remote_port} (module federation)"
    else
      echo "Warning: adb reverse failed for tcp:${remote_port} -> tcp:${remote_port}"
    fi
  done
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
