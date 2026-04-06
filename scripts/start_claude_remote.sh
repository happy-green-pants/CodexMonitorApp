#!/usr/bin/env bash
set -euo pipefail

CLAUDE_REMOTE_BIN="${CLAUDE_REMOTE_BIN:-/usr/local/node/bin/claude-remote}"
CLAUDE_REMOTE_PORT="${CLAUDE_REMOTE_PORT:-3100}"
CLAUDE_REMOTE_WORKDIR="${CLAUDE_REMOTE_WORKDIR:-/root/.claude}"
CLAUDE_REMOTE_ENABLE_WEB="${CLAUDE_REMOTE_ENABLE_WEB:-0}"
CLAUDE_REMOTE_PERMISSION_MODE="${CLAUDE_REMOTE_PERMISSION_MODE:-default}"
CLAUDE_REMOTE_EXTRA_ARGS="${CLAUDE_REMOTE_EXTRA_ARGS:-}"

export PATH="/root/.local/bin:/usr/local/node/bin:/www/server/nodejs/v22.22.1/bin:/usr/local/bin:/usr/local/sbin:/usr/bin:/usr/sbin:/bin:/sbin:${PATH:-}"
export PORT="${CLAUDE_REMOTE_PORT}"
export ENABLE_WEB="${CLAUDE_REMOTE_ENABLE_WEB}"

existing_listener=""
if command -v ss >/dev/null 2>&1; then
  existing_listener="$(ss -ltnp "( sport = :${CLAUDE_REMOTE_PORT} )" 2>/dev/null | sed -n 's/.*users:(("\([^"]*\)",pid=\([0-9]\+\).*/\1 pid=\2/p' | head -n 1)"
fi

if [[ -n "${existing_listener}" ]]; then
  echo "Port ${CLAUDE_REMOTE_PORT} is already in use by ${existing_listener}" >&2
  echo "Stop the existing bridge before switching this instance under systemd." >&2
  exit 1
fi

if [[ ! -x "${CLAUDE_REMOTE_BIN}" ]]; then
  echo "claude-remote binary not found: ${CLAUDE_REMOTE_BIN}" >&2
  exit 1
fi

mkdir -p "${CLAUDE_REMOTE_WORKDIR}"
cd "${CLAUDE_REMOTE_WORKDIR}"

args=(--permission-mode "${CLAUDE_REMOTE_PERMISSION_MODE}")
if [[ -n "${CLAUDE_REMOTE_EXTRA_ARGS}" ]]; then
  read -r -a extra_args <<< "${CLAUDE_REMOTE_EXTRA_ARGS}"
  args+=("${extra_args[@]}")
fi

printf 'Starting claude-remote in %s on port %s (web=%s, permission=%s)\n' \
  "${CLAUDE_REMOTE_WORKDIR}" \
  "${CLAUDE_REMOTE_PORT}" \
  "${CLAUDE_REMOTE_ENABLE_WEB}" \
  "${CLAUDE_REMOTE_PERMISSION_MODE}"

exec "${CLAUDE_REMOTE_BIN}" "${args[@]}"
