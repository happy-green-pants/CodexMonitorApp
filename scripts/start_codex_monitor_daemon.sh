#!/usr/bin/env bash
set -euo pipefail

BIN="/www/wwwroot/CodexMonitor/src-tauri/target/release/codex_monitor_daemon"

exec "$BIN" --http-listen 127.0.0.1:9010 --token 123456 --data-dir /home/www/.local/share/codex-monitor-daemon
