#!/bin/bash
# 一键启动/重启 TencentDB 代码分析引擎相关服务：
#   1. code-analysis engine service (127.0.0.1:8443) — 原版引擎 LocalBackend
#   2. KnowledgeServer (0.0.0.0:8421) — /v3/tools/call analysis_* 工具通道
# 用法: ./start-analysis.sh [engine|ks|all]
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENGINE_DIR="$ROOT/src/engines/codeanalysis-engine"
NODE22="$ROOT/../MemoryProxy/.tools/node22/bin/node"

start_engine() {
  if curl -s -m 2 http://127.0.0.1:8443/health >/dev/null 2>&1; then
    echo "[engine] already running on 8443"
    return 0
  fi
  echo "[engine] starting..."
  cd "$ENGINE_DIR"
  GITNEXUS_MEMORY=off nohup /tmp/node-glibc234 --import tsx service.ts > /tmp/engine-service.log 2>&1 &
  echo $! > /tmp/engine-service.pid
  for i in $(seq 1 20); do
    sleep 1
    if curl -s -m 2 http://127.0.0.1:8443/health >/dev/null 2>&1; then
      echo "[engine] up ($(curl -s http://127.0.0.1:8443/health))"
      return 0
    fi
  done
  echo "[engine] FAILED to start; see /tmp/engine-service.log"
  return 1
}

start_ks() {
  if ss -tln 2>/dev/null | grep -q ':8421'; then
    echo "[ks] already listening on 8421"
    return 0
  fi
  echo "[ks] starting..."
  cd "$ROOT"
  nohup "$NODE22" --import tsx src/server.ts > /tmp/ks.log 2>&1 &
  echo $! > /tmp/ks.pid
  for i in $(seq 1 20); do
    sleep 1
    if ss -tln 2>/dev/null | grep -q ':8421'; then
      echo "[ks] up on 8421"
      return 0
    fi
  done
  echo "[ks] FAILED to start; see /tmp/ks.log"
  return 1
}

case "${1:-all}" in
  engine) start_engine ;;
  ks)     start_ks ;;
  all)    start_engine && start_ks ;;
  *) echo "usage: $0 [engine|ks|all]"; exit 1 ;;
esac
