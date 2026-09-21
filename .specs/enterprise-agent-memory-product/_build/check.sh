#!/usr/bin/env bash
# 自检：单文件 HTML 原型的硬性约束
set -uo pipefail
B="$(cd "$(dirname "$0")" && pwd)"
F="$(dirname "$B")/PRODUCT-DESIGN.html"
fail=0
say(){ printf '%-42s %s\n' "$1" "$2"; }

[ -f "$F" ] || { echo "missing $F"; exit 1; }

# 1. 零外部依赖
ext=$(grep -oiE '(src|href)="(https?:)?//[^"]*"' "$F" | wc -l)
if [ "$ext" -eq 0 ]; then say "外部资源引用 (src/href //)" "OK 0"; else say "外部资源引用" "FAIL $ext"; grep -oiE '(src|href)="(https?:)?//[^"]*"' "$F" | head; fail=1; fi

# 2. 无 @import / url(http
imp=$(grep -cE '@import|url\(["'\'']?https?:' "$F")
if [ "$imp" -eq 0 ]; then say "CSS @import / 远程 url()" "OK 0"; else say "CSS 远程引用" "FAIL $imp"; fail=1; fi

# 3. 无图片 / 无 emoji 常用区
img=$(grep -cE '<img |\.png|\.jpg|\.jpeg|\.svg"|\.webp|\.gif' "$F")
if [ "$img" -eq 0 ]; then say "图片引用" "OK 0"; else say "图片引用" "FAIL $img"; fail=1; fi

emoji=$(grep -cP '[\x{1F300}-\x{1FAFF}\x{2600}-\x{27BF}\x{FE0F}]' "$F" 2>/dev/null || true)
if [ "$emoji" -eq 0 ]; then say "emoji" "OK 0"; else say "emoji" "FAIL $emoji"; fail=1; fi

# 4. 章节齐全
for s in s0 s1 s2 s3 s4 s5 s6 s7 s8 s9 s10; do
  c=$(grep -c "id=\"$s\"" "$F")
  if [ "$c" -ge 1 ]; then say "章节 #$s" "OK"; else say "章节 #$s" "FAIL 缺失"; fail=1; fi
done

# 5. 九段小节锚点：2.1-2.6 / 5.x / p1-p13
for s in s2-1 s2-2 s2-3 s2-4 s2-5 s2-6; do
  grep -q "id=\"$s\"" "$F" || { say "锚点 #$s" "FAIL 缺失"; fail=1; }
done
for i in $(seq 1 19); do
  grep -q "id=\"s5-$i\"" "$F" || { say "锚点 #s5-$i" "FAIL 缺失"; fail=1; }
done
for i in $(seq 1 13); do
  grep -q "id=\"p$i\"" "$F" || { say "锚点 #p$i" "FAIL 缺失"; fail=1; }
done
say "小节锚点 s2-*/s5-1..19/p1..13" "checked"

# 6. 目录锚点全部有落点
miss=0
while read -r a; do
  grep -q "id=\"$a\"" "$F" || { echo "  断链: #$a"; miss=$((miss+1)); }
done < <(grep -o 'class="doc-nav"' -A 200 "$F" | grep -o 'href="#[^"]*"' | sed 's/href="#//; s/"//' | sort -u)
if [ "$miss" -eq 0 ]; then say "目录锚点完整性" "OK"; else say "目录锚点完整性" "FAIL $miss 处断链"; fail=1; fi

# 7. 内联 JS 语法检查
tmp=$(mktemp -d)
awk '/<script>/{f=1;next} /<\/script>/{f=0} f' "$F" > "$tmp/inline.js"
if command -v node >/dev/null 2>&1; then
  if node --check "$tmp/inline.js" 2>"$tmp/err"; then say "内联 JS (node --check)" "OK"; else say "内联 JS" "FAIL"; cat "$tmp/err"; fail=1; fi
else
  say "内联 JS" "SKIP (no node)"
fi
rm -rf "$tmp"

# 8. 无 TODO / lorem 占位（只匹配真正的占位标记，不匹配 §10 自检表里对规则的复述）
todo=$(grep -cE 'lorem ipsum|>待补充<|>TODO<|>TODO:|占位符待|<!-- *TODO' "$F")
if [ "$todo" -eq 0 ]; then say "占位文本" "OK 0"; else say "占位文本" "FAIL $todo"; fail=1; fi

# 9. 结构统计
say "文件大小" "$(wc -c < "$F") bytes / $(wc -l < "$F") lines"
say "原型屏 (.proto)" "$(grep -c 'class="proto"' "$F")"
say "应用骨架 (.app)" "$(grep -c 'class="app[ "]' "$F")"
say "演示数据标识" "$(grep -c '演示数据' "$F")"
say "待确认/暂缓标记" "$(grep -cE '待确认|暂缓' "$F")"

# 10. 原型侧栏：12 屏逐字一致（仅 active 不同）+ 条目数 20 + 未被固定高度裁切
if command -v python3 >/dev/null 2>&1; then
  python3 - "$F" <<'PY'
import sys,re,hashlib
s=open(sys.argv[1],encoding='utf-8').read()
blocks=re.findall(r'<aside class="app-side">(.*?)</aside>', s, re.S)
norm=lambda b: re.sub(r'\s+',' ',re.sub(r'\s*class="active"','',b)).strip()
hashes={hashlib.sha256(norm(b).encode()).hexdigest() for b in blocks}
anchors=[len(re.findall(r'<a\b', b)) for b in blocks]
ok = len(blocks)==12 and len(hashes)==1 and set(anchors)=={20}
print(f'{"原型侧栏一致性":<36} ' + ('OK 12 屏同一侧栏 / 20 条目' if ok else
      f'FAIL blocks={len(blocks)} distinct={len(hashes)} anchors={sorted(set(anchors))}'))
sys.exit(0 if ok else 1)
PY
  [ $? -eq 0 ] || fail=1
  if grep -q 'min-width:1001px' "$B/override.css"; then
    say "侧栏裁切回归 (override.css)" "OK 已解除固定高度"
  else
    say "侧栏裁切回归" "FAIL .app 固定高度会裁掉侧栏底部"
    fail=1
  fi
else
  say "原型侧栏一致性" "SKIP (no python3)"
fi

# 11. 目录高亮与锚点跳转：nav 顺序必须等于文档顺序（滚动监听按此假设取「最后一个越过参考线」的锚点），
#     且 override.css 必须为 sticky 顶栏留出 scroll-margin-top
if command -v python3 >/dev/null 2>&1; then
  python3 - "$F" <<'PY'
import sys,re
from html.parser import HTMLParser
VOID={'area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr','path','circle','rect','line','polyline','polygon','use','stop','ellipse'}
class P(HTMLParser):
    def __init__(s):
        super().__init__(convert_charrefs=True); s.seq=[]; s.nav=[]; s.nav_on=False
    def handle_starttag(s,t,a):
        d=dict(a)
        if d.get('class')=='doc-nav': s.nav_on=True
        if 'id' in d: s.seq.append(d['id'])
        if s.nav_on and t=='a' and d.get('href','').startswith('#'): s.nav.append(d['href'][1:])
    def handle_endtag(s,t):
        if t=='nav': s.nav_on=False
p=P(); p.feed(open(sys.argv[1],encoding='utf-8').read())
pos={}
for i,x in enumerate(p.seq): pos.setdefault(x,i)
missing=[a for a in p.nav if a not in pos]
idx=[pos[a] for a in p.nav if a in pos]
ok = bool(p.nav) and not missing and idx==sorted(idx)
print(f'{"目录锚点顺序 = 文档顺序":<36} ' + (f'OK {len(p.nav)} 条递增' if ok else
      f'FAIL 缺失={missing} 乱序={idx!=sorted(idx)}'))
sys.exit(0 if ok else 1)
PY
  [ $? -eq 0 ] || fail=1
  if grep -q 'scroll-margin-top' "$B/override.css"; then
    say "锚点跳转偏移 (override.css)" "OK 已为 sticky 顶栏留白"
  else
    say "锚点跳转偏移" "FAIL 目标标题会被 sticky 顶栏遮挡"
    fail=1
  fi
fi

echo
if [ "$fail" -eq 0 ]; then echo "== 自检通过 =="; else echo "== 自检未通过 =="; exit 1; fi
