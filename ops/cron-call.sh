#!/usr/bin/env bash
set -euo pipefail

ROUTE="${1:-}"
if [[ -z "$ROUTE" ]]; then
  echo "$(date -Is) ERROR missing route argument" >&2
  echo "usage: $0 /api/cron/route[?query]" >&2
  exit 64
fi

case "$ROUTE" in
  /api/cron/*|/api/health/*) ;;
  *)
    echo "$(date -Is) ERROR refusing non-cron/non-health route: $ROUTE" >&2
    exit 64
    ;;
esac

APP_DIR="${GPP_APP_DIR:-/opt/golf-pool-pro-staging}"
ENV_FILE="${GPP_ENV_FILE:-$APP_DIR/.env.production}"
BASE_URL="${GPP_CRON_BASE_URL:-http://127.0.0.1:3400}"
TIMEOUT_SECONDS="${GPP_CRON_TIMEOUT_SECONDS:-55}"
RESPONSE_MAX_CHARS="${GPP_CRON_RESPONSE_MAX_CHARS:-4000}"

cd "$APP_DIR"
if [[ ! -r "$ENV_FILE" ]]; then
  echo "$(date -Is) ERROR cannot read env file: $ENV_FILE" >&2
  exit 78
fi

CRON_SECRET="$({
  python3 - "$ENV_FILE" <<'PYENV'
from pathlib import Path
import sys
path = Path(sys.argv[1])
for raw in path.read_text(errors='ignore').splitlines():
    line = raw.strip()
    if not line or line.startswith('#') or '=' not in line:
        continue
    key, value = line.split('=', 1)
    if key.strip() == 'CRON_SECRET':
        value = value.strip()
        if (value.startswith('"') and value.endswith('"')) or (value.startswith("'") and value.endswith("'")):
            value = value[1:-1]
        print(value, end='')
        break
PYENV
})"

if [[ -z "${CRON_SECRET:-}" ]]; then
  echo "$(date -Is) ERROR CRON_SECRET is not set in $ENV_FILE" >&2
  exit 78
fi

mkdir -p "$APP_DIR/ops/logs" "$APP_DIR/ops/locks"
safe_name=$(printf "%s" "$ROUTE" | tr -c 'A-Za-z0-9_.-' '_')
lock_file="$APP_DIR/ops/locks/gpp-cron-${safe_name}.lock"
body_file=$(mktemp)
cleanup() { rm -f "$body_file"; }
trap cleanup EXIT

emit_body() {
  python3 - "$body_file" "$RESPONSE_MAX_CHARS" <<'PYBODY'
from pathlib import Path
import sys
path = Path(sys.argv[1])
limit = int(sys.argv[2])
text = path.read_text(errors='replace') if path.exists() else ''
text = ''.join(ch for ch in text if ch == '\n' or ch == '\t' or ord(ch) >= 32).replace('\n', '')
if len(text) > limit:
    print(text[:limit] + f'...<truncated chars={len(text)-limit}>', end='')
else:
    print(text, end='')
PYBODY
}

(
  if ! flock -n 9; then
    echo "$(date -Is) route=$ROUTE skipped=lock_held"
    exit 0
  fi

  started_epoch=$(date +%s)
  echo "$(date -Is) route=$ROUTE status=start target=$BASE_URL"
  http_code="000"
  curl_rc=0
  http_code=$(timeout "${TIMEOUT_SECONDS}s" curl -sS \
    --retry 1 \
    --max-time "$TIMEOUT_SECONDS" \
    -o "$body_file" \
    -w "%{http_code}" \
    -H "Authorization: Bearer ${CRON_SECRET}" \
    "${BASE_URL}${ROUTE}") || curl_rc=$?

  duration=$(( $(date +%s) - started_epoch ))
  if [[ "$curl_rc" -ne 0 ]]; then
    echo "$(date -Is) route=$ROUTE status=transport_error rc=$curl_rc http=$http_code duration_s=$duration response=$(emit_body)" >&2
    exit "$curl_rc"
  fi

  if [[ ! "$http_code" =~ ^2 ]]; then
    echo "$(date -Is) route=$ROUTE status=http_error http=$http_code duration_s=$duration response=$(emit_body)" >&2
    exit 1
  fi

  printf '%s route=%s status=ok http=%s duration_s=%s response=' "$(date -Is)" "$ROUTE" "$http_code" "$duration"
  emit_body
  printf '\n'
) 9>"$lock_file"
