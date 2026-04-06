#!/usr/bin/env bash
set -euo pipefail

PUBLIC_URL="${CLAUDE_REMOTE_PUBLIC_URL:-https://claude-remote.pklm.cloud/}"
LOCAL_URL="${CLAUDE_REMOTE_LOCAL_URL:-http://127.0.0.1:3100/}"
PUBLIC_HOST="${CLAUDE_REMOTE_PUBLIC_HOST:-claude-remote.pklm.cloud}"
PUBLIC_IP="${CLAUDE_REMOTE_PUBLIC_IP:-}"
SAMPLES="${CLAUDE_REMOTE_SAMPLES:-5}"
SITE_LOG="${CLAUDE_REMOTE_SITE_LOG:-/www/wwwlogs/118.89.49.212_4096.timing.log}"
ERROR_LOG="${CLAUDE_REMOTE_ERROR_LOG:-/www/wwwlogs/118.89.49.212_4096.error.log}"

sample_url() {
  local label="$1"
  local url="$2"
  local insecure_flag=()

  if [[ "$url" == https://* ]]; then
    insecure_flag=(-k)
  fi

  echo "=== ${label}: ${url} ==="
  for ((i = 1; i <= SAMPLES; i++)); do
    curl "${insecure_flag[@]}" -o /dev/null -sS \
      -w "sample=${i} code=%{http_code} dns=%{time_namelookup} connect=%{time_connect} tls=%{time_appconnect} ttfb=%{time_starttransfer} total=%{time_total}\\n" \
      "$url" || echo "sample=${i} CURL_FAIL"
  done
  echo
}

sample_resolved_url() {
  local label="$1"
  local host="$2"
  local ip="$3"
  local url="$4"

  if [[ -z "$ip" ]]; then
    return 0
  fi

  echo "=== ${label}: ${url} (forced ${host} -> ${ip}) ==="
  for ((i = 1; i <= SAMPLES; i++)); do
    curl -k --resolve "${host}:443:${ip}" -o /dev/null -sS \
      -w "sample=${i} code=%{http_code} dns=%{time_namelookup} connect=%{time_connect} tls=%{time_appconnect} ttfb=%{time_starttransfer} total=%{time_total}\\n" \
      "$url" || echo "sample=${i} CURL_FAIL"
  done
  echo
}

echo "=== timestamp ==="
date -Is

if [[ -z "$PUBLIC_IP" ]] && command -v dig >/dev/null 2>&1; then
  PUBLIC_IP="$(dig +short A "$PUBLIC_HOST" | head -n 1)"
fi

echo
sample_url "localhost" "$LOCAL_URL"
sample_url "public" "$PUBLIC_URL"
sample_resolved_url "public (dns bypass)" "$PUBLIC_HOST" "$PUBLIC_IP" "$PUBLIC_URL"

echo "=== listeners ==="
ss -ltnp '( sport = :3100 or sport = :443 )' || true

echo
printf '=== tcp summary ===\n'
ss -s || true

echo
printf '=== retransmit summary ===\n'
netstat -s 2>/dev/null | grep -E 'segments retransmitted|failed connection attempts|connection resets received|TCPSynRetrans|TCPLostRetransmit' || true

echo
if [[ -f "$SITE_LOG" ]]; then
  echo "=== site timing log tail ==="
  tail -n 10 "$SITE_LOG"
  echo
fi

if [[ -f "$ERROR_LOG" ]]; then
  echo "=== nginx error log tail ==="
  tail -n 10 "$ERROR_LOG"
fi

echo
if [[ -f /root/.claude/bridge.log ]]; then
  echo "=== claude-remote bridge log tail ==="
  tail -n 10 /root/.claude/bridge.log
fi

echo
if systemctl list-unit-files claude-remote-bridge.service >/dev/null 2>&1; then
  echo "=== claude-remote-bridge.service ==="
  systemctl --no-pager --full status claude-remote-bridge.service || true
fi
