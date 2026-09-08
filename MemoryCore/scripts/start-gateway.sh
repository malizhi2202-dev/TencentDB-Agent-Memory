#!/usr/bin/env bash
# 启动 TDAI Gateway（内存内核，端口 8420），供 MemoryPanel(8123) / MemoryProxy(8096) 使用。
#
# 用法：
#   bash scripts/start-gateway.sh            # 前台运行（Ctrl-C 退出）
#   nohup bash scripts/start-gateway.sh > /tmp/tdai-gateway.log 2>&1 &   # 后台常驻
#
# 环境变量（均可覆盖默认值）：
#   TDAI_LLM_API_KEY       LLM key；缺省从 ../MemoryKnowledge/.env 的 LLM_API_KEY 读取
#   TDAI_GATEWAY_CONFIG    配置文件路径；缺省 ./tdai-gateway.standalone.yaml
set -euo pipefail

# 切到 MemoryCore 目录（脚本位于 MemoryCore/scripts/ 下）
cd "$(dirname "$0")/.."

# Node 22（node:sqlite 依赖）
export PATH="/tmp/node-v22.19.0-linux-x64/bin:$PATH"

export TDAI_GATEWAY_CONFIG="${TDAI_GATEWAY_CONFIG:-./tdai-gateway.standalone.yaml}"

# LLM key：优先 env，其次读 MemoryKnowledge/.env 的 LLM_API_KEY
if [[ -z "${TDAI_LLM_API_KEY:-}" ]]; then
  env_file="../MemoryKnowledge/.env"
  if [[ -f "$env_file" ]]; then
    key="$(grep -E '^LLM_API_KEY=' "$env_file" | head -1 | cut -d= -f2- | tr -d '"'"'"' \r')"
    export TDAI_LLM_API_KEY="$key"
  fi
fi

if [[ -z "${TDAI_LLM_API_KEY:-}" ]]; then
  echo "错误：未找到 LLM key。请设置 TDAI_LLM_API_KEY，或确认 ../MemoryKnowledge/.env 含 LLM_API_KEY。" >&2
  exit 1
fi

echo "[start-gateway] config=${TDAI_GATEWAY_CONFIG} 端口=8420"
exec node --import tsx src/gateway/server.ts