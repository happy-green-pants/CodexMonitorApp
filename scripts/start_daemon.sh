#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DAEMON_BINARY="${SCRIPT_DIR}/codex_monitor_daemon"
DATA_DIR="${DATA_DIR:-${SCRIPT_DIR}/data}"
LISTEN_ADDR="${LISTEN_ADDR:-127.0.0.1:4732}"
HTTP_LISTEN_ADDR="${HTTP_LISTEN_ADDR:-}"
TOKEN="${CODEX_MONITOR_DAEMON_TOKEN:-}"

if [ ! -f "${DAEMON_BINARY}" ]; then
    echo "Error: Daemon binary not found at ${DAEMON_BINARY}"
    echo "Please download the appropriate binary for your platform from GitHub Releases"
    exit 1
fi

if [ -z "${TOKEN}" ]; then
    echo "Error: CODEX_MONITOR_DAEMON_TOKEN environment variable is not set"
    echo "Usage: CODEX_MONITOR_DAEMON_TOKEN=your-secret-token ./start_daemon.sh"
    exit 1
fi

mkdir -p "${DATA_DIR}"

echo "Starting Codex Monitor Daemon..."
echo "  Binary: ${DAEMON_BINARY}"
echo "  Data directory: ${DATA_DIR}"
echo "  Listen address: ${LISTEN_ADDR}"
if [ -n "${HTTP_LISTEN_ADDR}" ]; then
    echo "  HTTP listen address: ${HTTP_LISTEN_ADDR}"
fi

ARGS=(
    "--token" "${TOKEN}"
    "--data-dir" "${DATA_DIR}"
    "--listen" "${LISTEN_ADDR}"
)

if [ -n "${HTTP_LISTEN_ADDR}" ]; then
    ARGS+=("--http-listen" "${HTTP_LISTEN_ADDR}")
fi

exec "${DAEMON_BINARY}" "${ARGS[@]}"
