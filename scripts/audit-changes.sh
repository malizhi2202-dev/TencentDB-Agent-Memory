#!/usr/bin/env bash
# audit-changes.sh — 全项目实际代码改动核对
#
# 一键生成与「实际源码」一致的改动清单：直接扫 git status + find + wc -l，
# 而不是只看 `git diff` 的增删行数。补齐两类 git 盲区：
#   ① 项目既有、本次未改的文件（git status 不显示）
#   ② 我改过的「既有大文件」主体（git diff 只给增量行数）
#
# 用法：
#   bash scripts/audit-changes.sh             # 全量核对（目录统计 + 明细 + 汇总）
#   bash scripts/audit-changes.sh > report.txt  # 落盘
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# 文本源码扩展名（binary / 运行时 data 文件跳过行数统计）
is_text() {
  case "$1" in
    *.ts|*.tsx|*.js|*.jsx|*.mjs|*.cjs|*.json|*.yaml|*.yml|*.md|*.sh|*.py|*.css|*.html|*.vue|*.toml|*.sql) return 0 ;;
    *) return 1 ;;
  esac
}

# 目录级：文件数 / 行数 / M / ??  （只数 .ts/.tsx 源码）
stat_dir() {
  local dir="$1" label="$2"
  [ -d "$dir" ] || return 0
  local files lines m u
  files=$(find "$dir" -type f \( -name '*.ts' -o -name '*.tsx' \) | wc -l)
  lines=$(find "$dir" -type f \( -name '*.ts' -o -name '*.tsx' \) -exec cat {} + 2>/dev/null | wc -l)
  m=$(git status --porcelain -- "$dir" 2>/dev/null | grep -cE '^(.M|M.|MM)' || true)
  u=$(git status --porcelain -- "$dir" 2>/dev/null | grep -c '^??' || true)
  printf '  %-22s %4s files  %7s 行   M:%-2s  ??:%s\n' "$label" "$files" "$lines" "$m" "$u"
}

echo "# 全项目实际代码改动核对  $(date +%F_%T)"
echo

echo "## MemoryCore/src 目录级（实际源码量 + 改动分布）"
for d in core gateway metadata offload utils offload_server services offload-client model adapters api-trace cli; do
  stat_dir "MemoryCore/src/$d" "$d"
done

echo
echo "## 全项目改动明细（状态 行数 路径；??=新增 M=修改 D=删除，binary 不数行）"
git status --porcelain 2>/dev/null \
  | grep -vE 'node_modules|\.tools/node22' \
  | while IFS= read -r line; do
      st="${line:0:2}"
      f="${line:3}"
      case "$st" in
        '??')
          if [ -d "$f" ]; then
            # untracked 目录 → 展开内部文本文件
            find "$f" -type f 2>/dev/null | grep -vE 'node_modules' | while IFS= read -r sub; do
              is_text "$sub" || continue
              printf '?? %7s  %s\n' "$(wc -l < "$sub" 2>/dev/null)" "$sub"
            done
          elif [ -f "$f" ]; then
            if is_text "$f"; then
              printf '?? %7s  %s\n' "$(wc -l < "$f" 2>/dev/null)" "$f"
            else
              printf '?? %7s  %s  (binary)\n' "-" "$f"
            fi
          fi
          ;;
        D\ |\ D|DD)
          printf 'D  %7s  %s  (deleted)\n' "-" "$f"
          ;;
        *)
          if [ -f "$f" ]; then
            if is_text "$f"; then
              printf '%-2s %7s  %s\n' "${st// /?}" "$(wc -l < "$f" 2>/dev/null)" "$f"
            else
              printf '%-2s %7s  %s  (binary)\n' "${st// /?}" "-" "$f"
            fi
          fi
          ;;
      esac
    done \
  | sort -k3

echo
mtotal=$(git status --porcelain 2>/dev/null | grep -vE 'node_modules|\.tools/node22' | grep -cE '^(.M|M.|MM)' || true)
utotal=$(git status --porcelain 2>/dev/null | grep -vE 'node_modules|\.tools/node22' | grep -c '^??' || true)
dtotal=$(git status --porcelain 2>/dev/null | grep -vE 'node_modules|\.tools/node22' | grep -cE '^(D.|.D|DD)' || true)
echo "## 汇总：修改(M) $mtotal 处、新增(??) $utotal 处、删除(D) $dtotal 处（不含 node_modules/.tools）"
