#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
port="${1:-8560}"
unit="four-symbol-image-decoder.service"

if [[ "$port" == "8560" ]] && systemctl --user is-active --quiet "$unit" 2>/dev/null; then
  echo "Already running via systemd at http://127.0.0.1:${port}/"
  echo "Stop with: systemctl --user stop ${unit}"
  exit 0
fi
if [[ "$port" == "8560" ]] && systemctl --user list-unit-files "$unit" --no-legend 2>/dev/null | grep -q four-symbol-image-decoder; then
  echo "Starting systemd unit ${unit}"
  systemctl --user start "$unit"
  echo "Four-symbol image decoder at http://127.0.0.1:${port}/"
  exit 0
fi

port_in_use() {
  ss -H -tln "sport = :$1" 2>/dev/null | grep -q .
}

if port_in_use "$port"; then
  echo "Already running at http://127.0.0.1:${port}/"
  exit 0
fi

echo "Four-symbol image decoder at http://127.0.0.1:${port}/"
exec python3 -m http.server "$port" --bind 127.0.0.1
