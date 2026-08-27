#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
ECOSYSTEM_ROOT="$(cd "${PROJECT_DIR}/.." && pwd)"
COMPOSE_FILE="${PROJECT_DIR}/deploy/docker-compose.yml"
ENV_FILE="${PROJECT_DIR}/deploy/.env"
LOG_DIR="${PROJECT_DIR}/.codex-logs"
PID_DIR="${LOG_DIR}/pids"

read_env_value() {
  local key="$1"
  local fallback="$2"
  local current="${!key:-}"
  if [ -n "${current}" ]; then
    printf '%s\n' "${current}"
    return
  fi
  if [ -f "${ENV_FILE}" ]; then
    local raw
    raw="$(grep -E "^${key}=" "${ENV_FILE}" | tail -n 1 | cut -d '=' -f 2- || true)"
    if [ -n "${raw}" ]; then
      raw="${raw%\"}"
      raw="${raw#\"}"
      printf '%s\n' "${raw}"
      return
    fi
  fi
  printf '%s\n' "${fallback}"
}

API_PORT="$(read_env_value PORT 3000)"
POSTGRES_PORT="$(read_env_value POSTGRES_HOST_PORT 5432)"
MINIO_PORT="$(read_env_value MINIO_HOST_PORT 9000)"
WEB_PORT="${WEB_PORT:-5173}"


API_HEALTH_URL="http://127.0.0.1:${API_PORT}/api/v1/health"
WEB_URL="http://127.0.0.1:${WEB_PORT}/"

log() {
  printf '[cps] %s\n' "$*"
}

die() {
  printf '[cps] ERROR: %s\n' "$*" >&2
  exit 1
}

usage() {
  cat <<EOF
Usage:
  bash scripts/start-local-dev.sh [start|restart|stop|stop:all|status|logs|help] [component]

Commands:
  start      Start Docker infra, API, and web. This is the default.
  restart    Same as start.
  stop       Stop local Node/Vite community dev processes. Docker infra is kept running.
  stop:all   Stop local Node/Vite processes and Docker infra services.
  status     Print process, HTTP, and Docker infra status.
  logs       Follow logs. Optional component: server, web.
  help       Show this help.

Examples:
  pnpm --dir Chips-PersonalServer start:local
  pnpm --dir Chips-PersonalServer stop:local
  pnpm --dir Chips-PersonalServer status:local
  pnpm --dir Chips-PersonalServer logs:local server
EOF
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || die "Missing required command: $1"
}

compose() {
  docker compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" "$@"
}

component_log_file() {
  case "$1" in
    api|server) printf '%s/server-dev.log\n' "${LOG_DIR}" ;;
    web) printf '%s/web-dev.log\n' "${LOG_DIR}" ;;
    *) die "Unknown log component: $1" ;;
  esac
}

component_pid_file() {
  case "$1" in
    api|server) printf '%s/server-dev.pid\n' "${PID_DIR}" ;;
    web) printf '%s/web-dev.pid\n' "${PID_DIR}" ;;
    *) die "Unknown pid component: $1" ;;
  esac
}

is_alive() {
  local pid="$1"
  [ -n "${pid}" ] && kill -0 "${pid}" >/dev/null 2>&1
}

kill_tree() {
  local pid="$1"
  if [ -z "${pid}" ] || [ "${pid}" = "$$" ] || [ "${pid}" = "${PPID}" ]; then
    return
  fi

  local children=""
  if command -v pgrep >/dev/null 2>&1; then
    children="$(pgrep -P "${pid}" 2>/dev/null || true)"
  fi
  for child in ${children}; do
    kill_tree "${child}"
  done
  kill "${pid}" >/dev/null 2>&1 || true
}

force_kill_tree() {
  local pid="$1"
  if [ -z "${pid}" ] || [ "${pid}" = "$$" ] || [ "${pid}" = "${PPID}" ]; then
    return
  fi

  local children=""
  if command -v pgrep >/dev/null 2>&1; then
    children="$(pgrep -P "${pid}" 2>/dev/null || true)"
  fi
  for child in ${children}; do
    force_kill_tree "${child}"
  done
  kill -9 "${pid}" >/dev/null 2>&1 || true
}

project_runtime_ancestor() {
  local pid="$1"
  local candidate="${pid}"
  while :; do
    local parent
    parent="$(ps -p "${candidate}" -o ppid= 2>/dev/null | tr -d '[:space:]' || true)"
    if [ -z "${parent}" ] || [ "${parent}" = "0" ] || [ "${parent}" = "1" ]; then
      break
    fi

    local command_line
    command_line="$(ps -p "${parent}" -o command= 2>/dev/null || true)"
    if [[ "${command_line}" == *"${PROJECT_DIR}"* ]] || [[ "${command_line}" == *"Chips-PersonalServer"* ]]; then
      candidate="${parent}"
      continue
    fi
    break
  done
  printf '%s\n' "${candidate}"
}

stop_pid_files() {
  mkdir -p "${PID_DIR}"
  local pid_file
  for pid_file in "${PID_DIR}"/*.pid; do
    [ -e "${pid_file}" ] || continue
    local pid
    pid="$(cat "${pid_file}" 2>/dev/null || true)"
    if is_alive "${pid}"; then
      log "Stopping recorded process ${pid} from ${pid_file}"
      kill_tree "${pid}"
    fi
    rm -f "${pid_file}"
  done
}

stop_project_patterns() {
  local patterns=(
    "${PROJECT_DIR}.*src/server.ts"
    "pnpm --dir ${PROJECT_DIR} dev"
    "pnpm --dir ${PROJECT_DIR}/packages/web exec vite"
    "pnpm --dir Chips-PersonalServer dev"
    "pnpm --dir Chips-PersonalServer/packages/web exec vite"
  )

  local pattern
  for pattern in "${patterns[@]}"; do
    local pids
    pids="$(pgrep -f "${pattern}" 2>/dev/null || true)"
    local pid
    for pid in ${pids}; do
      if [ "${pid}" = "$$" ] || [ "${pid}" = "${PPID}" ]; then
        continue
      fi
      kill_tree "${pid}"
    done
  done
}

stop_port_project_processes() {
  local port
  for port in "${API_PORT}" "${WEB_PORT}"; do
    local pids
    pids="$(lsof -tiTCP:"${port}" -sTCP:LISTEN 2>/dev/null || true)"
    local pid
    for pid in ${pids}; do
      local root_pid
      root_pid="$(project_runtime_ancestor "${pid}")"
      local root_command_line
      root_command_line="$(ps -p "${root_pid}" -o command= 2>/dev/null || true)"
      if [[ "${root_command_line}" == *"${PROJECT_DIR}"* ]] || [[ "${root_command_line}" == *"Chips-PersonalServer"* ]]; then
        log "Stopping project process on port ${port}: ${root_pid}"
        kill_tree "${root_pid}"
      fi
    done
  done
}

stop_local_processes() {
  stop_pid_files
  stop_port_project_processes
  stop_project_patterns
  sleep 1
  stop_port_project_processes
}

assert_port_available() {
  local port="$1"
  local label="$2"
  local pids
  pids="$(lsof -tiTCP:"${port}" -sTCP:LISTEN 2>/dev/null || true)"
  if [ -n "${pids}" ]; then
    lsof -nP -iTCP:"${port}" -sTCP:LISTEN >&2 || true
    die "${label} port ${port} is occupied by a non-community process."
  fi
}

wait_port() {
  local port="$1"
  local label="$2"
  local timeout_seconds="$3"
  local elapsed=0
  while [ "${elapsed}" -lt "${timeout_seconds}" ]; do
    if nc -z 127.0.0.1 "${port}" >/dev/null 2>&1; then
      log "${label} port ${port} is ready."
      return
    fi
    sleep 2
    elapsed=$((elapsed + 2))
  done
  die "${label} port ${port} did not become ready within ${timeout_seconds}s."
}

wait_http() {
  local url="$1"
  local label="$2"
  local timeout_seconds="$3"
  local log_file="$4"
  local elapsed=0
  while [ "${elapsed}" -lt "${timeout_seconds}" ]; do
    if curl -fsS "${url}" >/dev/null 2>&1; then
      log "${label} is ready: ${url}"
      return
    fi
    sleep 2
    elapsed=$((elapsed + 2))
  done
  printf '\n--- %s log tail ---\n' "${label}" >&2
  tail -120 "${log_file}" >&2 || true
  die "${label} did not become ready within ${timeout_seconds}s: ${url}"
}

start_background() {
  local component="$1"
  shift
  local log_file
  log_file="$(component_log_file "${component}")"
  local pid_file
  pid_file="$(component_pid_file "${component}")"

  mkdir -p "${LOG_DIR}" "${PID_DIR}"
  : > "${log_file}"
  log "Starting ${component}; log: ${log_file}"
  (
    cd "${ECOSYSTEM_ROOT}"
    nohup "$@" > "${log_file}" 2>&1 &
    printf '%s\n' "$!" > "${pid_file}"
  )

  local pid
  pid="$(cat "${pid_file}")"
  sleep 1
  if ! is_alive "${pid}"; then
    tail -80 "${log_file}" >&2 || true
    die "${component} exited immediately."
  fi
}

ensure_prerequisites() {
  require_command docker
  require_command pnpm
  require_command curl
  require_command lsof
  require_command nc
  [ -f "${ENV_FILE}" ] || die "Missing env file: ${ENV_FILE}"
  [ -f "${COMPOSE_FILE}" ] || die "Missing compose file: ${COMPOSE_FILE}"
  docker info >/dev/null 2>&1 || die "Docker daemon is not running."
}

start_infra() {
  log "Starting Docker infra: postgres, minio"
  compose up -d postgres minio
  wait_port "${POSTGRES_PORT}" "PostgreSQL" 90
  wait_port "${MINIO_PORT}" "MinIO" 90
}

start_all() {
  ensure_prerequisites
  start_infra

  log "Cleaning existing local personal server dev processes."
  stop_local_processes
  assert_port_available "${API_PORT}" "API"
  assert_port_available "${WEB_PORT}" "Web"

  start_background server pnpm --dir "${PROJECT_DIR}" dev
  wait_http "${API_HEALTH_URL}" "API" 240 "$(component_log_file server)"

  start_background web pnpm --dir "${PROJECT_DIR}/packages/web" exec vite --host 0.0.0.0 --port "${WEB_PORT}" --strictPort
  wait_http "${WEB_URL}" "Personal server web" 90 "$(component_log_file web)"

  print_summary
}

stop_all_local() {
  log "Stopping local personal server dev processes."
  stop_local_processes
}

stop_all_with_docker() {
  stop_all_local
  log "Stopping Docker infra services."
  compose stop postgres minio
}

http_code() {
  local url="$1"
  curl -fsS -o /dev/null -w '%{http_code}' "${url}" 2>/dev/null || printf 'down'
}

print_pid_status() {
  local component="$1"
  local pid_file
  pid_file="$(component_pid_file "${component}")"
  local pid=""
  if [ -f "${pid_file}" ]; then
    pid="$(cat "${pid_file}" 2>/dev/null || true)"
  fi
  if is_alive "${pid}"; then
    printf '  %-8s running pid=%s\n' "${component}" "${pid}"
  else
    printf '  %-8s not recorded/running\n' "${component}"
  fi
}

print_status() {
  printf 'Local HTTP:\n'
  printf '  API     %s %s\n' "$(http_code "${API_HEALTH_URL}")" "${API_HEALTH_URL}"
  printf '  Web     %s %s\n' "$(http_code "${WEB_URL}")" "${WEB_URL}"
  printf '\nRecorded processes:\n'
  print_pid_status server
  print_pid_status web
  printf '\nDocker infra:\n'
  compose ps postgres minio
}

follow_logs() {
  local component="${1:-server}"
  local log_file
  log_file="$(component_log_file "${component}")"
  [ -f "${log_file}" ] || die "Log file does not exist yet: ${log_file}"
  tail -f "${log_file}"
}

print_summary() {
  cat <<EOF

[cps] Local personal server is ready.

  Web:     ${WEB_URL}
  API:     ${API_HEALTH_URL}
  MinIO:   http://127.0.0.1:$(read_env_value MINIO_CONSOLE_HOST_PORT 9001)/

  Logs:
    server: $(component_log_file server)
    web:    $(component_log_file web)

  Stop:
    pnpm --dir Chips-PersonalServer stop:local

EOF
}

main() {
  local command_name="${1:-start}"
  shift || true

  if [ "${command_name}" = "start" ] && { [ "${1:-}" = "--help" ] || [ "${1:-}" = "-h" ] || [ "${1:-}" = "help" ]; }; then
    usage
    exit 0
  fi

  case "${command_name}" in
    start|restart)
      start_all
      ;;
    stop)
      stop_all_local
      ;;
    stop:all)
      ensure_prerequisites
      stop_all_with_docker
      ;;
    status)
      ensure_prerequisites
      print_status
      ;;
    logs)
      follow_logs "${1:-server}"
      ;;
    help|-h|--help)
      usage
      ;;
    *)
      usage >&2
      die "Unknown command: ${command_name}"
      ;;
  esac
}

main "$@"
