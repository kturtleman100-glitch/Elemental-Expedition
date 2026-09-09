// 정식 플레이로 엔딩에 닿는지 확인한다.
//
// 퀘스트가 다음 퀘스트를 열고, 그 보상이 장(章) 플래그를 세우고, 그 플래그가
// 보스를 열고, 보스를 잡으면 엔딩 조건이 찬다 — 이 사슬 어디 한 곳이라도
// 끊기면 게임을 끝까지 할 수가 없다. 실제로 예전에 2장에서 끊겨 있었다.

import fs from "fs";
import path from "path";
import os from "os";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "story-"));
for (const f of fs.readdirSync("src/data")) {
  if (!f.endsWith(".js")) continue;
  fs.writeFileSync(
    path.join(tmp, f.replace(/\.js$/, ".mjs")),
    fs.readFileSync(path.join("src/data", f), "utf8")
      .replace(/(from\s+["']\.\/[^"']+)\.js(["'])/g, "$1.mjs$2")
  );
}
const u = (n) => "file://" + path.join(tmp, n).split(path.sep).join("/");

const { QUESTS } = await import(u("quests.mjs"));
const { BOSSES } = await import(u("bosses.mjs"));
const { ENDINGS, resolveEnding } = await import(u("endings.mjs"));
const { ELEMENTS } = await import(u("elements.mjs"));
const { COMPOUNDS } = await import(u("bonds.mjs"));

const problems = [];
const bar = "=".repeat(68);

// ---------------------------------------------------------------- 1. 퀘스트 사슬
console.log(bar);
console.log("  1. 퀘스트가 끊기지 않고 이어지는가");
console.log(bar);
{
  const byId = new Map(QUESTS.map((q) => [q.id, q]));
  const roots = QUESTS.filter((q) => !QUESTS.some((o) => [].concat(o.next ?? []).includes(q.id)));
  console.log("  시작점: " + roots.map((q) => q.id).join(", "));

  // 시작점에서 도달 가능한 퀘스트를 모두 훑는다
  const seen = new Set();
  const walk = (id) => {
    if (!id || seen.has(id)) return;
    const q = byId.get(id);
    if (!q) { problems.push(`퀘스트 "${id}" 가 next에 있는데 정의되지 않았다`); return; }
    seen.add(id);
    for (const n of [].concat(q.next ?? [])) walk(n);
  };
  for (const r of roots) walk(r.id);

  const unreachable = QUESTS.filter((q) => !seen.has(q.id));
  console.log(`  도달 가능 ${seen.size} / 전체 ${QUESTS.length}`);
  if (unreachable.length) {
    problems.push("도달할 수 없는 퀘스트: " + unreachable.map((q) => q.id).join(", "));
  }

  // 각 장이 이어지는지
  const chapters = [...new Set(QUESTS.map((q) => q.chapter).filter(Boolean))].sort((a, b) => a - b);
  console.log("  다루는 장: " + chapters.join(", "));
}

// ---------------------------------------------------------------- 2. 보스 조건
console.log("\n" + bar);
console.log("  2. 보스를 여는 플래그를 누가 세우는가");
console.log(bar);
{
  // 퀘스트 보상이 세우는 플래그를 모두 모은다
  const given = new Set();
  for (const q of QUESTS) {
    const rw = q.reward ?? {};
    for (const f of [].concat(rw.flags ?? [])) given.add(f);
    if (rw.flag) given.add(rw.flag);
  }
  // 대화가 세우는 플래그도 센다
  const dlgSrc = fs.readFileSync("src/data/dialogue.js", "utf8") +
    (fs.existsSync("src/data/dialogue_residents.js")
      ? fs.readFileSync("src/data/dialogue_residents.js", "utf8") : "");
  for (const m of dlgSrc.matchAll(/flags:\s*\[([^\]]*)\]/g)) {
    for (const s of m[1].split(",")) {
      const t = s.trim().replace(/^["']|["']$/g, "");
      if (t) given.add(t);
    }
  }
  // 보스 격파가 세우는 플래그
  for (const b of BOSSES) given.add("boss_done_" + b.id);
  given.add("persuaded_chlorine");

  for (const b of BOSSES) {
    const cond = b.condition;
    if (!cond) { console.log(`  ${b.name.padEnd(5, "　")} 조건 없음 (항상 등장)`); continue; }
    const ok = given.has(cond);
    console.log(`  ${b.name.padEnd(5, "　")} 조건 "${cond}" ${ok ? "→ 세워진다" : "→ 아무도 안 세운다!"}`);
    if (!ok) problems.push(`보스 "${b.name}"의 조건 "${cond}"를 세우는 곳이 없다 — 영영 안 나온다`);
  }
}

// ---------------------------------------------------------------- 3. 엔딩 도달
console.log("\n" + bar);
console.log("  3. 세 루트가 각각 엔딩에 닿는가");
console.log(bar);
{
  const allElements = ELEMENTS.map((e) => e.id);
  const routes = [
    { name: "군단(철) 지지", flags: ["sided_legion", "boss_done_boss_po"], rep: { legion: 100 } },
    { name: "귀족(백금) 지지", flags: ["sided_noblesse", "boss_done_boss_po"], rep: { noblesse: 100 } },
    {
      name: "중립 + 진엔딩 조건",
      flags: ["persuaded_chlorine", "oganesson_ally", "boss_done_boss_po"],
      rep: {},
    },
    { name: "붕괴(타이머 초과)", flags: ["polonium_timer_expired"], rep: {} },
  ];

  for (const r of routes) {
    const res = resolveEnding({
      flags: new Set(r.flags),
      reputation: { get: (k) => r.rep[k] ?? 0 },
      codexSize: allElements.length,
    });
    const name = res?.name ?? res?.id ?? "(없음)";
    console.log(`  ${r.name.padEnd(18, "　")} → ${name}`);
    if (!res) problems.push(`"${r.name}" 루트가 엔딩을 못 만든다`);
  }
  console.log(`  정의된 엔딩 ${Array.isArray(ENDINGS) ? ENDINGS.length : Object.keys(ENDINGS).length}종`);
}

// ---------------------------------------------------------------- 4. 도감 90%
console.log("\n" + bar);
console.log("  4. 진엔딩의 도감 90%를 채울 수 있는가");
console.log(bar);
{
  const reachable = new Set();
  // 퀘스트 보상 원소
  for (const q of QUESTS) {
    const rw = q.reward ?? {};
    if (rw.element) reachable.add(rw.element);
    for (const e of [].concat(rw.elements ?? [])) reachable.add(e);
  }
  // 보스
  for (const b of BOSSES) reachable.add(b.elementId);
  // 대화가 주는 원소
  const dlgSrc = fs.readFileSync("src/data/dialogue.js", "utf8") +
    (fs.existsSync("src/data/dialogue_residents.js")
      ? fs.readFileSync("src/data/dialogue_residents.js", "utf8") : "");
  for (const m of dlgSrc.matchAll(/element:\s*["']([a-z]+)["']/g)) reachable.add(m[1]);
  // 야생 적
  const encSrc = fs.readFileSync("src/combat/Encounters.js", "utf8");
  for (const m of encSrc.matchAll(/elementId:\s*["']([a-z]+)["']/g)) reachable.add(m[1]);
  for (const m of encSrc.matchAll(/\[BIOME\.[A-Z_]+\]:\s*\[([^\]]*)\]/g)) {
    for (const s of m[1].split(",")) {
      const t = s.trim().replace(/^["']|["']$/g, "");
      if (t) reachable.add(t);
    }
  }

  const total = ELEMENTS.length;
  const got = ELEMENTS.filter((e) => reachable.has(e.id));
  const pct = (got.length / total) * 100;
  console.log(`  도달 가능 ${got.length} / ${total} = ${pct.toFixed(0)}%  (진엔딩 기준 90%)`);
  if (pct < 90) {
    const missing = ELEMENTS.filter((e) => !reachable.has(e.id));
    problems.push(`도감 ${pct.toFixed(0)}%밖에 못 채운다 — 진엔딩 불가. 빠진 것: ` +
      missing.map((e) => e.ko).join(", "));
  }
}

// ---------------------------------------------------------------- 5. 화합물 재료
console.log("\n" + bar);
console.log("  5. 화합물 재료를 정식 플레이로 다 모을 수 있는가");
console.log(bar);
{
  const reachable = new Set();
  for (const q of QUESTS) {
    const rw = q.reward ?? {};
    if (rw.element) reachable.add(rw.element);
    for (const e of [].concat(rw.elements ?? [])) reachable.add(e);
  }
  for (const b of BOSSES) reachable.add(b.elementId);
  const dlgSrc = fs.readFileSync("src/data/dialogue.js", "utf8") +
    (fs.existsSync("src/data/dialogue_residents.js")
      ? fs.readFileSync("src/data/dialogue_residents.js", "utf8") : "");
  for (const m of dlgSrc.matchAll(/element:\s*["']([a-z]+)["']/g)) reachable.add(m[1]);
  const encSrc = fs.readFileSync("src/combat/Encounters.js", "utf8");
  for (const m of encSrc.matchAll(/elementId:\s*["']([a-z]+)["']/g)) reachable.add(m[1]);
  for (const m of encSrc.matchAll(/\[BIOME\.[A-Z_]+\]:\s*\[([^\]]*)\]/g)) {
    for (const s of m[1].split(",")) {
      const t = s.trim().replace(/^["']|["']$/g, "");
      if (t) reachable.add(t);
    }
  }

  let blocked = 0;
  for (const c of COMPOUNDS) {
    const need = c.needs.filter((n) => !reachable.has(n));
    if (need.length) {
      console.log(`  ${c.formula.padEnd(7)} ${c.name.padEnd(7, "　")} ← ${need.join("·")} 못 얻음`);
      blocked++;
    }
  }
  console.log(`  만들 수 있는 화합물 ${COMPOUNDS.length - blocked} / ${COMPOUNDS.length}`);
  if (blocked) problems.push(`화합물 ${blocked}종의 재료를 정식 플레이로 못 모은다`);
}

// ---------------------------------------------------------------- 결과
console.log("\n" + bar);
if (problems.length) {
  console.log(`  문제 ${problems.length}건`);
  console.log("-".repeat(68));
  problems.forEach((p, i) => console.log(`  ${i + 1}. ${p}`));
} else {
  console.log("  스토리 검사 통과 — 정식 플레이로 엔딩까지 갈 수 있다");
}
console.log(bar);

fs.rmSync(tmp, { recursive: true, force: true });
process.exit(problems.length ? 1 : 0);
