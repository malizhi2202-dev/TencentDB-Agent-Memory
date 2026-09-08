#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NODE_BIN="${NODE_BIN:-}"
LOG_DIR="${LOG_DIR:-/tmp}"

if [[ -z "$NODE_BIN" ]]; then
  if [[ -x /tmp/node-v22.19.0-linux-x64/bin/node ]]; then
    NODE_BIN=/tmp/node-v22.19.0-linux-x64/bin/node
  else
    NODE_BIN=$(command -v node)
  fi
fi

export TDAI_GATEWAY_CONFIG="${TDAI_GATEWAY_CONFIG:-$ROOT/MemoryCore/tdai-gateway.standalone.yaml}"
export TDAI_LLM_BASE_URL="${TDAI_LLM_BASE_URL:-https://api.360.cn/v1}"
export TDAI_LLM_MODEL="${TDAI_LLM_MODEL:-deepseek/deepseek-v4-flash-internal}"
export HOST="${HOST:-127.0.0.1}"
export KNOWLEDGE_SERVICE_URL="${KNOWLEDGE_SERVICE_URL:-http://127.0.0.1:8421}"
export KNOWLEDGE_LLM_PROXY_BASE_URL="${KNOWLEDGE_LLM_PROXY_BASE_URL:-http://127.0.0.1:8096}"

services=(gateway knowledge panel panel-web proxy)
ports=(8420 8421 8123 5174 8096)

require_file() {
  local file=$1
  if [[ ! -e "$file" ]]; then
    echo "missing required file: $file" >&2
    echo "This script uses existing node_modules only; run dependency install manually if this is a fresh checkout." >&2
    exit 1
  fi
}

stop_pidfile() {
  local name=$1
  local pidfile="$LOG_DIR/tdai-$name.pid"
  if [[ ! -f "$pidfile" ]]; then
    return
  fi
  local pid
  pid=$(cat "$pidfile" 2>/dev/null || true)
  if [[ -z "$pid" ]]; then
    rm -f "$pidfile"
    return
  fi
  if kill -0 "$pid" 2>/dev/null; then
    local args
    args=$(ps -p "$pid" -o args= 2>/dev/null || true)
    if [[ "$args" == *"$ROOT"* || "$args" == *"tsx"* || "$args" == *"vite"* ]]; then
      kill "$pid" 2>/dev/null || true
      for _ in {1..30}; do
        kill -0 "$pid" 2>/dev/null || break
        sleep 0.1
      done
      kill -9 "$pid" 2>/dev/null || true
    fi
  fi
  rm -f "$pidfile"
}

stop_port_owner() {
  local port=$1
  local pids
  pids=$(ss -ltnp "sport = :$port" 2>/dev/null | sed -n 's/.*pid=\([0-9][0-9]*\).*/\1/p' | sort -u)
  for pid in $pids; do
    local args
    args=$(ps -p "$pid" -o args= 2>/dev/null || true)
    if [[ "$args" == *"$ROOT"* ]]; then
      kill "$pid" 2>/dev/null || true
      for _ in {1..30}; do
        kill -0 "$pid" 2>/dev/null || break
        sleep 0.1
      done
      kill -9 "$pid" 2>/dev/null || true
    fi
  done
}

port_busy() {
  local port=$1
  ss -ltn "sport = :$port" | tail -n +2 | grep -q .
}

start_service() {
  local name=$1
  local dir=$2
  local log="$LOG_DIR/tdai-$name.log"
  shift 2
  (
    cd "$dir"
    setsid "$NODE_BIN" "$@" > "$log" 2>&1 < /dev/null &
    echo $! > "$LOG_DIR/tdai-$name.pid"
  )
}

wait_port() {
  local name=$1
  local port=$2
  for _ in {1..80}; do
    if port_busy "$port"; then
      return 0
    fi
    sleep 0.25
  done
  echo "$name did not listen on :$port; log: $LOG_DIR/tdai-$name.log" >&2
  tail -n 80 "$LOG_DIR/tdai-$name.log" >&2 || true
  return 1
}

require_file "$NODE_BIN"
require_file "$ROOT/MemoryCore/node_modules/tsx/dist/cli.mjs"
require_file "$ROOT/MemoryKnowledge/node_modules/tsx/dist/cli.mjs"
require_file "$ROOT/MemoryPanel/node_modules/tsx/dist/cli.mjs"
require_file "$ROOT/MemoryPanel/web/node_modules/vite/bin/vite.js"
require_file "$ROOT/MemoryProxy/node_modules/tsx/dist/cli.mjs"

for service in "${services[@]}"; do
  stop_pidfile "$service"
done
for port in "${ports[@]}"; do
  stop_port_owner "$port"
done

start_service gateway "$ROOT/MemoryCore" "$ROOT/MemoryCore/node_modules/tsx/dist/cli.mjs" src/gateway/server.ts
start_service knowledge "$ROOT/MemoryKnowledge" "$ROOT/MemoryKnowledge/node_modules/tsx/dist/cli.mjs" src/server.ts
start_service panel "$ROOT/MemoryPanel" "$ROOT/MemoryPanel/node_modules/tsx/dist/cli.mjs" src/index.ts
start_service panel-web "$ROOT/MemoryPanel/web" "$ROOT/MemoryPanel/web/node_modules/vite/bin/vite.js" --host 127.0.0.1 --port 5174 --strictPort
start_service proxy "$ROOT/MemoryProxy" "$ROOT/MemoryProxy/node_modules/tsx/dist/cli.mjs" src/index.ts --config config.yaml --host 127.0.0.1

for i in "${!services[@]}"; do
  wait_port "${services[$i]}" "${ports[$i]}"
done

echo "TencentDB Agent Memory is running:"
echo "  MemoryCore gateway: http://127.0.0.1:8420"
echo "  MemoryKnowledge:     http://127.0.0.1:8421"
echo "  MemoryPanel API/UI:  http://127.0.0.1:8123"
echo "  MemoryPanel web:     http://127.0.0.1:5174"
echo "  MemoryProxy:         http://127.0.0.1:8096"
echo "Logs: $LOG_DIR/tdai-{gateway,knowledge,panel,panel-web,proxy}.log"