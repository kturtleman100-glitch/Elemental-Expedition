// 지형 생성이 제대로 되는지 검사한다.
//
// 브라우저에서 걸어 다니며 확인하려면 몇 분이 걸리고, 멀리 떨어진 땅은
// 가 볼 수도 없다. 생성 규칙은 순수 함수라 여기서 수만 점을 한 번에 볼 수 있다.
//
// 보는 것
//  1. 결정성 — 같은 좌표는 언제나 같은 결과인가 (청크를 버렸다 다시 만들 때 필수)
//  2. 이음매 — 청크 경계에서 높이가 어긋나지 않는가 (어긋나면 벽처럼 솟는다)
//  3. 분포   — 바이옴이 골고루 나오는가, 시작 지점이 안전한가
//  4. 경사   — 걸어서 못 넘는 절벽이 얼마나 되는가
//
// 사용법: node tools/check-terrain.mjs

import fs from "fs";
import path from "path";
import os from "os";

// src의 .js를 .mjs 사본으로 옮겨 import한다 (프로젝트에 package.json을 두지 않으려고)
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "terr-"));
for (const f of ["Noise.js", "Biome.js", "Terrain.js"]) {
  fs.writeFileSync(path.join(tmp, f.replace(/\.js$/, ".mjs")),
    fs.readFileSync(path.join("src/world", f), "utf8")
      .replace(/(from\s+["']\.\/[^"']+)\.js(["'])/g, "$1.mjs$2"));
}
const { Terrain } = await import("file://" + path.join(tmp, "Terrain.mjs").replace(/\\/g, "/"));
const { BIOMES } = await import("file://" + path.join(tmp, "Biome.mjs").replace(/\\/g, "/"));

const CHUNK = 64;
const terrain = new Terrain();
const problems = [];
const bar = "=".repeat(66);

console.log(bar);
console.log("  1. 결정성 — 같은 좌표는 언제나 같은 결과인가");
console.log(bar);
{
  let bad = 0;
  for (let i = 0; i < 3000; i++) {
    const x = (Math.random() - 0.5) * 4000;
    const z = (Math.random() - 0.5) * 4000;
    if (terrain.heightAt(x, z) !== terrain.heightAt(x, z)) bad++;
    if (terrain.biomeAt(x, z).id !== terrain.biomeAt(x, z).id) bad++;
  }
  // 새 인스턴스도 같은 시드면 같아야 한다 — 청크를 버렸다 다시 만드는 상황
  const other = new Terrain();
  for (let i = 0; i < 1500; i++) {
    const x = (Math.random() - 0.5) * 4000;
    const z = (Math.random() - 0.5) * 4000;
    if (Math.abs(terrain.heightAt(x, z) - other.heightAt(x, z)) > 1e-9) bad++;
  }
  console.log(bad === 0 ? "  통과 — 4500회 모두 일치" : `  실패 ${bad}건`);
  if (bad) problems.push("같은 좌표가 다른 지형을 낸다 — 청크를 다시 만들면 땅이 바뀐다");
}

console.log("\n" + bar);
console.log("  2. 이음매 — 청크 경계에서 높이가 어긋나지 않는가");
console.log(bar);
{
  let maxGap = 0;
  for (let c = -12; c <= 12; c++) {
    const edge = c * CHUNK;
    for (let t = 0; t < 40; t++) {
      const z = (Math.random() - 0.5) * 1600;
      // 경계 양쪽 아주 가까운 두 점은 거의 같은 높이여야 한다
      const gap = Math.abs(terrain.heightAt(edge - 0.001, z) - terrain.heightAt(edge + 0.001, z));
      maxGap = Math.max(maxGap, gap);
    }
  }
  console.log(`  경계에서의 최대 높이차: ${maxGap.toFixed(5)}m`);
  if (maxGap > 0.01) problems.push(`청크 경계에 ${maxGap.toFixed(2)}m 단차가 있다 — 벽처럼 보인다`);
  else console.log("  통과 — 이어진다");
}

console.log("\n" + bar);
console.log("  3. 바이옴 분포 (반경 2300m를 12000점 표본)");
console.log(bar);
{
  const count = {};
  let n = 0;
  for (let i = 0; i < 12000; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random()) * 2300;
    const b = terrain.biomeAt(Math.cos(a) * r, Math.sin(a) * r);
    count[b.id] = (count[b.id] ?? 0) + 1;
    n++;
  }
  const rows = Object.entries(count).sort((a, b) => b[1] - a[1]);
  for (const [id, c] of rows) {
    const pct = (c / n) * 100;
    const b = BIOMES[id];
    console.log(`  ${(b?.name ?? id).padEnd(9, "　")} ${pct.toFixed(1).padStart(5)}%  ` +
      "#".repeat(Math.round(pct / 1.5)));
  }
  for (const id of Object.keys(BIOMES)) {
    if (!count[id]) problems.push(`${BIOMES[id].name}이 한 번도 나오지 않는다 — 갈 수 없는 땅이다`);
  }
}

console.log("\n" + bar);
console.log("  4. 시작 지점 주변은 안전한가");
console.log(bar);
{
  let flat = true, wrong = null;
  for (let i = 0; i < 400; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random()) * 55;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (Math.abs(terrain.heightAt(x, z)) > 0.001) flat = false;
    const b = terrain.biomeAt(x, z);
    if (b.danger > 0) wrong = b.name;
  }
  console.log(flat ? "  마을(55m) 안은 완전한 평지" : "  마을 안에 굴곡이 있다");
  if (!flat) problems.push("마을 안에 굴곡이 생겼다 — 손으로 지은 건물이 땅에 묻힌다");
  console.log(wrong ? `  위험한 바이옴이 마을에 닿았다: ${wrong}` : "  마을 주변은 안전한 바이옴");
  if (wrong) problems.push("시작 지점에 위험 지역이 붙어 있다");

  // 마을 밖으로 나가면 지형이 살아나는가
  const outside = [80, 120, 200, 400].map((d) => terrain.heightAt(d, 0).toFixed(1));
  console.log(`  마을 밖 고도 (80·120·200·400m): ${outside.join(", ")}m`);
}

console.log("\n" + bar);
console.log("  5. 걸어 다닐 수 있는가 (경사)");
console.log(bar);
{
  let steep = 0, n = 0, maxSlope = 0;
  for (let i = 0; i < 4000; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 80 + Math.sqrt(Math.random()) * 1400;
    const s = terrain.slopeAt(Math.cos(a) * r, Math.sin(a) * r);
    maxSlope = Math.max(maxSlope, s);
    if (s > 0.9) steep++;
    n++;
  }
  const pct = (steep / n) * 100;
  console.log(`  급경사(0.9 초과) 비율: ${pct.toFixed(1)}%   최대 경사: ${maxSlope.toFixed(2)}`);
  if (pct > 12) problems.push(`급경사가 ${pct.toFixed(0)}%다 — 길이 자주 막힌다`);
  else console.log("  통과 — 대체로 걸어 다닐 수 있다");
}

console.log("\n" + bar);
console.log("  6. 대륙의 끝 (바다)");
console.log(bar);
{
  const far = [1700, 1900, 2000, 2200].map((d) => ({
    d, h: terrain.heightAt(d, 0), b: terrain.biomeAt(d, 0).name,
  }));
  for (const f of far) console.log(`  ${String(f.d).padStart(5)}m   고도 ${f.h.toFixed(1).padStart(6)}m   ${f.b}`);
  if (far[far.length - 1].h > -5) problems.push("아주 멀리 나가도 바다가 안 나온다 — 끝없이 빈 땅이 이어진다");
}

console.log("\n" + bar);
if (problems.length) {
  console.log(`  문제 ${problems.length}건`);
  console.log("-".repeat(66));
  problems.forEach((p, i) => console.log(`  ${i + 1}. ${p}`));
} else {
  console.log("  지형 검사 통과");
}
console.log(bar);

fs.rmSync(tmp, { recursive: true, force: true });
process.exit(problems.length ? 1 : 0);
