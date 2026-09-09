#!/usr/bin/env bash
# 커밋 전 검사 — 문법 + import 무결성
# 사용법: bash tools/check.sh
set -e
cd "$(dirname "$0")/.."

echo "=== 문법 검사 ==="
tmp=$(mktemp -d)
fail=0
for f in $(find src tools -name '*.js' -o -name '*.mjs' | grep -v node_modules); do
  cp "$f" "$tmp/$(echo "$f" | tr '/' '_' | sed 's/\.js$/.mjs/')"
done
for f in "$tmp"/*.mjs; do
  if ! node --check "$f" 2>/dev/null; then
    echo "  FAIL: $f"
    node --check "$f" 2>&1 | head -3
    fail=1
  fi
done
rm -rf "$tmp"
[ $fail -eq 0 ] && echo "  통과"

echo ""
echo "=== import 검사 ==="
node tools/check-imports.mjs || fail=1

echo ""
echo "=== 화학 검사 ==="
node tools/check-chemistry.mjs | tail -4
[ ${PIPESTATUS[0]} -eq 0 ] || fail=1

echo ""
echo "=== 지형 검사 ==="
node tools/check-terrain.mjs | tail -3
[ ${PIPESTATUS[0]} -eq 0 ] || fail=1

echo ""
echo "=== 스토리 검사 ==="
node tools/check-story.mjs | tail -3
[ ${PIPESTATUS[0]} -eq 0 ] || fail=1

# 읽기 난이도 — 정확한데 안 읽히는 글은 이 프로젝트에서 틀린 글과 같다
echo ""
echo "=== 읽기 검사 ==="
node tools/check-reading.mjs | tail -3
[ ${PIPESTATUS[0]} -eq 0 ] || fail=1

echo ""
if [ $fail -eq 0 ]; then
  echo "=== 전부 통과 ==="
else
  echo "=== 실패한 검사가 있다 — 위를 확인할 것 ==="
fi
exit $fail
