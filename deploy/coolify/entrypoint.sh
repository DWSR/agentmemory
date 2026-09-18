#!/bin/sh
# agentmemory first-boot entrypoint.
#
# Runs as root so it can:
#   1. Overwrite the Bun-bundled iii-config.yaml (which binds 127.0.0.1
#      and uses relative ./data paths) with a deploy-tuned version that
#      binds 0.0.0.0 and uses absolute /data paths.
#   2. chown the platform-mounted /data volume to the runtime user
#      (managed platforms mount volumes root-owned 755 by default).
#   3. Generate the HMAC secret on first boot and persist it to
#      /data/.hmac (chmod 600) so the secret survives restarts.
#
# Then it execs the agentmemory CLI under gosu as the unprivileged
# `bun` user.

set -eu

DATA_DIR="${AGENTMEMORY_DATA_DIR:-/data}"
HMAC_FILE="${AGENTMEMORY_HMAC_FILE:-/data/.hmac}"
RUN_AS="bun:bun"
III_CONFIG="/opt/agentmemory/node_modules/@agentmemory/agentmemory/dist/iii-config.yaml"

mkdir -p "$DATA_DIR"
chown -R "$RUN_AS" "$DATA_DIR"

cat > "$III_CONFIG" <<'EOF'
workers:
  - name: configuration
    config:
      adapter:
        name: fs
        config:
          directory: /data/config
  - name: iii-worker-manager
    config:
      port: 49134
      host: 0.0.0.0
  - name: iii-http-functions
    config: {}
  - name: iii-stream
    config:
      port: 3112
      host: 0.0.0.0
      adapter:
        name: kv
        config:
          store_method: file_based
          file_path: /data/stream_store
EOF
chown "$RUN_AS" "$III_CONFIG"

if [ ! -s "$HMAC_FILE" ]; then
  SECRET="$(openssl rand -hex 32)"
  umask 077
  printf '%s\n' "$SECRET" > "$HMAC_FILE"
  chmod 600 "$HMAC_FILE"
  chown "$RUN_AS" "$HMAC_FILE"
  echo "================================================================"
  echo "agentmemory: generated HMAC secret on first boot"
  echo "AGENTMEMORY_SECRET=$SECRET"
  echo "Copy this value now. It will not be printed again."
  echo "Stored at: $HMAC_FILE (chmod 600)"
  echo "To rotate: delete $HMAC_FILE on the persistent volume and restart."
  echo "================================================================"
fi

AGENTMEMORY_SECRET="$(cat "$HMAC_FILE")"
export AGENTMEMORY_SECRET
export AGENTMEMORY_COMPOSE_HTTP_HOST=0.0.0.0

exec gosu "$RUN_AS" agentmemory "$@"
