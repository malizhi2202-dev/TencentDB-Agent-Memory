#!/usr/bin/env bash
# 装配单文件 PRODUCT-DESIGN.html
set -euo pipefail

B="$(cd "$(dirname "$0")" && pwd)"
OUT="$(dirname "$B")/PRODUCT-DESIGN.html"

need=(00-head-open.html template.css override.css 00-head-close.html template-sprite.html
      01-topbar-nav.html sec0.html sec1.html sec2.html sec3.html sec4.html sec5.html
      sec6-open.html protoA.html protoB.html protoC.html
      sec7.html sec8.html sec9.html sec10.html
      99-foot-open.html template-script.js 99-foot-close.html)

missing=0
for f in "${need[@]}"; do
  if [ ! -f "$B/$f" ]; then echo "MISSING: $f" >&2; missing=1; fi
done
[ "$missing" -eq 0 ] || { echo "装配中止：片段缺失" >&2; exit 1; }

cat \
  "$B/00-head-open.html" \
  "$B/template.css" \
  "$B/override.css" \
  "$B/00-head-close.html" \
  "$B/template-sprite.html" \
  "$B/01-topbar-nav.html" \
  "$B/sec0.html" \
  "$B/sec1.html" \
  "$B/sec2.html" \
  "$B/sec3.html" \
  "$B/sec4.html" \
  "$B/sec5.html" \
  "$B/sec6-open.html" \
  "$B/protoA.html" \
  "$B/protoB.html" \
  "$B/protoC.html" \
  "$B/sec7.html" \
  "$B/sec8.html" \
  "$B/sec9.html" \
  "$B/sec10.html" \
  "$B/99-foot-open.html" \
  "$B/template-script.js" \
  "$B/99-foot-close.html" \
  > "$OUT"

echo "built: $OUT"
wc -c -l "$OUT"
