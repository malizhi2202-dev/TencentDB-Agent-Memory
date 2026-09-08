#!/usr/bin/env bash
# 便捷启动 MemoryCore Standalone Gateway（源码运行）
# 用法:
#   ./start-standalone.sh            # 前台启动
#   ./start-standalone.sh --daemon   # 后台启动, 日志写 /tmp/tdai-gateway.log
#
# LLM 配置优先级: 已有环境变量 > ~/.dsh/.credentials.yaml 的 DEEPSEEK_API_KEY
set -euo pipefail
cd "$(dirname "$0")"

export TDAI_GATEWAY_CONFIG="${TDAI_GATEWAY_CONFIG:-$PWD/tdai-gateway.standalone.yaml}"

# 1) LLM base URL / model
export TDAI_LLM_BASE_URL="${TDAI_LLM_BASE_URL:-https://api.deepseek.com/v1}"
export TDAI_LLM_MODEL="${TDAI_LLM_MODEL:-deepseek-v4-flash}"

# 2) LLM API key —— 未显式设置时从 ~/.dsh/.credentials.yaml 读取
if [ -z "${TDAI_LLM_API_KEY:-}" ] && [ -f "$HOME/.dsh/.credentials.yaml" ]; then
  export TDAI_LLM_API_KEY="$(sed -n 's/^DEEPSEEK_API_KEY:[[:space:]]*//p' "$HOME/.dsh/.credentials.yaml" | head -1)"
fi
if [ -z "${TDAI_LLM_API_KEY:-}" ]; then
  echo "[error] TDAI_LLM_API_KEY 未设置, 且 ~/.dsh/.credentials.yaml 中无 DEEPSEEK_API_KEY" >&2
  exit 1
fi

echo "==> TDAI_GATEWAY_CONFIG=$TDAI_GATEWAY_CONFIG"
echo "==> TDAI_LLM_BASE_URL=$TDAI_LLM_BASE_URL  TDAI_LLM_MODEL=$TDAI_LLM_MODEL"

if [ "${1:-}" = "--daemon" ]; then
  nohup node --import tsx src/gateway/server.ts > /tmp/tdai-gateway.log 2>&1 &
  echo "==> 已后台启动 PID=$! , 日志: /tmp/tdai-gateway.log"
  sleep 3
  curl -s http://127.0.0.1:8420/health | head -c 300; echo
else
  exec node --import tsx src/gateway/server.ts
fi
