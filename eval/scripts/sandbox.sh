#!/usr/bin/env bash
# Boot a sandboxed agentmemory + iii-engine on alt ports with a clean data dir,
# so eval runs aren't polluted by (and don't pollute) your real ~/.agentmemory.
# Source it: `source eval/scripts/sandbox.sh` then run eval scripts;
# the sandbox is torn down on EXIT.

set -euo pipefail

SANDBOX_ROOT="${SANDBOX_ROOT:-/tmp/agentmemory-eval-sandbox}"
SANDBOX_PORT="${SANDBOX_PORT:-3411}"
SANDBOX_STREAM_PORT="${SANDBOX_STREAM_PORT:-3412}"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

if ! command -v iii >/dev/null 2>&1; then
  echo "iii binary not on PATH. Install pinned version:"
  echo "  curl -fsSL https://github.com/iii-hq/iii/releases/download/iii/v0.24.0/iii-aarch64-apple-darwin.tar.gz | tar -xz -C ~/.local/bin"
  exit 1
fi

iii_ver=$(iii --version 2>&1 | head -1)
if [[ "$iii_ver" != "0.24.0" ]]; then
  echo "warning: iii version on PATH is $iii_ver; agentmemory pins 0.24.0"
fi

if [[ ! -f "$REPO_ROOT/dist/index.mjs" ]]; then
  echo "dist/ missing. Run: npm run build" >&2
  exit 1
fi

if [[ -z "${SANDBOX_ROOT:-}" || "$SANDBOX_ROOT" == "/" || "$SANDBOX_ROOT" != /tmp/* ]]; then
  echo "refusing to wipe SANDBOX_ROOT='$SANDBOX_ROOT' — must be non-empty and under /tmp/" >&2
  exit 1
fi
rm -rf "$SANDBOX_ROOT"
mkdir -p "$SANDBOX_ROOT/data" "$SANDBOX_ROOT/config" "$SANDBOX_ROOT/.agentmemory"

cat > "$SANDBOX_ROOT/iii-config.yaml" <<EOF
workers:
  - name: configuration
    config:
      adapter:
        name: fs
        config:
          directory: $SANDBOX_ROOT/config
  - name: iii-worker-manager
    config:
      port: 49134
      host: 127.0.0.1
  - name: iii-http-functions
    config: {}
  - name: iii-stream
    config:
      port: $SANDBOX_STREAM_PORT
      host: 127.0.0.1
      adapter:
        name: kv
        config:
          store_method: file_based
          file_path: $SANDBOX_ROOT/data/stream_store
EOF

cat > "$SANDBOX_ROOT/worker-compose.yaml" <<EOF
namespace: default
required_default: true
containers:
  state:
    worker: package://api.workers.iii.dev/state
    version: "0.22.2"
    config_name: state
    config_override:
      adapter:
        name: kv
        config:
          store_method: file_based
          file_path: $SANDBOX_ROOT/data/state_store.db
  http:
    worker: package://api.workers.iii.dev/http
    version: "0.21.3"
    config_name: http
    config_override:
      host: 127.0.0.1
      port: $SANDBOX_PORT
      default_timeout: 180000
      cors:
        allowed_origins: ["http://localhost:$SANDBOX_PORT", "http://127.0.0.1:$SANDBOX_PORT"]
        allowed_methods: [GET, POST, PUT, DELETE, OPTIONS]
  queue:
    worker: package://api.workers.iii.dev/queue
    version: "0.21.11"
    config_name: queue
  pubsub:
    worker: package://api.workers.iii.dev/pubsub
    version: "0.21.2"
    config_name: pubsub
  cron:
    worker: package://api.workers.iii.dev/cron
    version: "0.21.9"
    config_name: cron
EOF

cd "$SANDBOX_ROOT"
HOME="$SANDBOX_ROOT" iii compose build --file "$SANDBOX_ROOT/worker-compose.yaml" > "$SANDBOX_ROOT/compose-build.log" 2>&1
HOME="$SANDBOX_ROOT" iii --config "$SANDBOX_ROOT/iii-config.yaml" > "$SANDBOX_ROOT/iii.log" 2>&1 &
SANDBOX_PID=$!
HOME="$SANDBOX_ROOT" iii compose --engine ws://127.0.0.1:49134 --namespace default --up --frozen --file "$SANDBOX_ROOT/worker-compose.yaml" > "$SANDBOX_ROOT/compose.log" 2>&1 &
COMPOSE_PID=$!
HOME="$SANDBOX_ROOT" AGENTMEMORY_DATA_DIR="$SANDBOX_ROOT/data" III_ENGINE_URL=ws://127.0.0.1:49134 bun "$REPO_ROOT/dist/index.mjs" > "$SANDBOX_ROOT/agentmemory.log" 2>&1 &
WORKER_PID=$!

cleanup() {
  echo "tearing down sandbox (worker $WORKER_PID, compose $COMPOSE_PID, engine $SANDBOX_PID)"
  kill "$WORKER_PID" 2>/dev/null || true
  kill "$COMPOSE_PID" 2>/dev/null || true
  kill "$SANDBOX_PID" 2>/dev/null || true
  sleep 1
  kill -9 "$WORKER_PID" 2>/dev/null || true
  kill -9 "$COMPOSE_PID" 2>/dev/null || true
  kill -9 "$SANDBOX_PID" 2>/dev/null || true
}
trap cleanup EXIT

# wait for livez
for i in $(seq 1 30); do
  if curl -sS --max-time 1 "http://localhost:$SANDBOX_PORT/agentmemory/livez" 2>/dev/null | grep -q '"status":"ok"'; then
    export AGENTMEMORY_BASE_URL="http://localhost:$SANDBOX_PORT"
    echo "sandbox ready: $AGENTMEMORY_BASE_URL"
    echo "  state: $SANDBOX_ROOT/data/"
    echo "  logs:  $SANDBOX_ROOT/iii.log"
    return 0 2>/dev/null || exit 0
  fi
  sleep 1
done

echo "sandbox failed to come up within 30s. last engine log lines:" >&2
tail -10 "$SANDBOX_ROOT/iii.log" >&2
echo "last compose log lines:" >&2
tail -10 "$SANDBOX_ROOT/compose.log" >&2
exit 1
