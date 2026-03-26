#!/usr/bin/env bash
set -euo pipefail

BIN="/www/wwwroot/CodexMonitor/src-tauri/target/release/codex_monitor_daemon"

export PATH="/root/.local/bin:/bin:/sbin:/usr/bin:/usr/sbin:/usr/local/bin:/usr/local/sbin:/root/bin:/opt/homebrew/bin"

exec "$BIN" --http-listen 127.0.0.1:9010 --token 123456 --data-dir /home/www/.local/share/codex-monitor-daemon
