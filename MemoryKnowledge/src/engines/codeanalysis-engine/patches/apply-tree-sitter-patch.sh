#!/usr/bin/env bash
# apply-tree-sitter-patch.sh — 重装依赖后重新应用 tree-sitter 0.21.1 的
# SyntaxNode TDZ 补丁（见 patches/tree-sitter-0.21.1-syntaxnode-tdz.patch）。
#
# 背景：vendored tree-sitter-proto 语法有名为 "syntax_node" 的节点类型，
# camelCase 后生成类名 SyntaxNode，`class SyntaxNode extends SyntaxNode`
# 自引用触发 TDZ ReferenceError。补丁跳过同名子类的生成。
#
# 用法：在 codeanalysis-engine 目录下执行  ./patches/apply-tree-sitter-patch.sh
set -euo pipefail
cd "$(dirname "$0")/.."

TARGET="node_modules/.pnpm/tree-sitter@0.21.1/node_modules/tree-sitter/index.js"
if [ ! -f "$TARGET" ]; then
  echo "ERROR: $TARGET 不存在（依赖未安装或版本变了）" >&2
  exit 1
fi

if grep -q "TDAI local patch" "$TARGET"; then
  echo "already patched: $TARGET"
  exit 0
fi

python3 - "$TARGET" <<'EOF'
import sys
path = sys.argv[1]
src = open(path).read()
anchor = "    const className = camelCase(typeName, true) + 'Node';\n"
patch = """    // [TDAI local patch] A node type literally named "syntax_node" (e.g. the
    // vendored tree-sitter-proto grammar) camel-cases to the class name
    // `SyntaxNode`, and `class SyntaxNode extends SyntaxNode` inside the eval
    // hits the TDZ (self-shadowing) => "Cannot access 'SyntaxNode' before
    // initialization". Skip generating the colliding subclass and keep the
    // base SyntaxNode for this node id instead. Same fallback as a frozen
    // language object: unmarshalNode already falls back to SyntaxNode.
"""
guard = "    if (className === 'SyntaxNode') continue;\n"
i = src.index(anchor)  # 唯一出现于 initializeLanguageNodeClasses
src = src[:i] + patch + anchor + guard + src[i + len(anchor):]
open(path, "w").write(src)
print("patched:", path)
EOF
