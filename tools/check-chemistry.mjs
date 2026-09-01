// 게임 데이터의 화학이 실제와 맞는지 검사한다.
//
// 이 게임은 "놀다 보면 화학이 남는" 것을 노린다. 그러니 틀린 값이 하나라도
// 들어가면 재미가 아니라 오개념을 가르치게 된다. 문법 검사만큼 중요하다.
//
// 사용법: node tools/check-chemistry.mjs

import fs from "fs";
import path from "path";
import os from "os";
import { REF, GROUP, NOBLE_METALS, REAL_COMPOUNDS, parseFormula, bondType } from "./chem-reference.mjs";

// src의 .js를 .mjs 사본으로 옮겨 import한다.
// 프로젝트에 package.json을 두면 npx serve 동작이 바뀔 수 있어 건드리지 않는다.
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "chem-"));
for (const f of fs.readdirSync("src/data")) {
  if (!f.endsWith(".js")) continue;
  const body = fs.readFileSync(path.join("src/data", f), "utf8")
    .replace(/(from\s+["']\.\/[^"']+)\.js(["'])/g, "$1.mjs$2");
  fs.writeFileSync(path.join(tmp, f.replace(/\.js$/, ".mjs")), body);
}
const url = (n) => "file://" + path.join(tmp, n).replace(/\\/g, "/");
const { ELEMENTS, PLAYER_ELEMENT, FAMILY, COMBAT, FAMILY_LABEL } = await import(url("elements.mjs"));
const { COMPOUNDS } = await import(url("bonds.mjs"));

const errors = [];   // 사실이 틀림 — 반드시 고쳐야 한다
const warns = [];    // 게임적 각색 — 의도했다면 둬도 된다
const gaps = [];     // 화학은 맞지만 플레이로 도달할 수 없음

const err = (m) => errors.push(m);
const warn = (m) => warns.push(m);
const gap = (m) => gaps.push(m);

const owned = new Set([...ELEMENTS.map((e) => e.id), PLAYER_ELEMENT.id]);

// 게임의 족 분류 → 실제 분류. PRECIOUS·RADIOACTIVE는 게임이 만든 서사적 묶음이다.
const FAMILY_TO_GROUP = {
  [FAMILY.ALKALI]: [GROUP.ALKALI],
  [FAMILY.ALKALINE]: [GROUP.ALKALINE],
  [FAMILY.TRANSITION]: [GROUP.TRANSITION],
  [FAMILY.PRECIOUS]: [GROUP.TRANSITION],
  [FAMILY.NONMETAL]: [GROUP.NONMETAL],
  [FAMILY.METALLOID]: [GROUP.METALLOID],
  [FAMILY.POST_TRANSITION]: [GROUP.POST_TRANSITION],
  [FAMILY.HALOGEN]: [GROUP.HALOGEN],
  [FAMILY.NOBLE]: [GROUP.NOBLE],
  [FAMILY.RADIOACTIVE]: [GROUP.ACTINIDE, GROUP.METALLOID, GROUP.TRANSITION, GROUP.NOBLE],
  [FAMILY.UNKNOWN]: [GROUP.UNKNOWN],
};

const near = (a, b, tol) => a != null && b != null && Math.abs(a - b) <= tol;
const bar = "=".repeat(66);

// ---------------------------------------------------------------- 1. 원소 수치
console.log(bar);
console.log("  1. 원소 수치 대조 (IUPAC 원자량 · 폴링 전기음성도)");
console.log(bar);

let checked = 0;
for (const el of ELEMENTS) {
  const r = REF[el.id];
  if (!r) { warn(el.ko + "(" + el.sym + "): 기준표에 없어 대조하지 못함"); continue; }
  checked++;

  if (el.z !== r.z) err(el.ko + ": 원자번호 " + el.z + " != 실제 " + r.z);

  // 원자량 — 표기 자릿수 차이는 허용
  if (el.mass != null && r.mass != null && !near(el.mass, r.mass, Math.max(0.05, r.mass * 0.002)))
    err(el.ko + ": 원자량 " + el.mass + " != 실제 " + r.mass);

  // 전기음성도 — 상성 배율에 직결되므로 가장 엄격하게 본다
  if (r.en == null && el.electroneg != null)
    err(el.ko + ": 전기음성도 " + el.electroneg + " — 실제로는 정의되지 않는다 (비활성 기체)");
  else if (r.en != null && el.electroneg == null && el.id !== "uue")
    warn(el.ko + ": 전기음성도가 비어 있다 (실제 " + r.en + ") — 상성 계산에서 제외된다");
  else if (el.electroneg != null && r.en != null && !near(el.electroneg, r.en, 0.03))
    err(el.ko + ": 전기음성도 " + el.electroneg + " != 폴링 " + r.en);

  // 녹는점·끓는점 — 5% 또는 15도 오차 허용 (동소체·측정 조건 차이)
  for (const [k, label] of [["melt", "녹는점"], ["boil", "끓는점"]]) {
    if (el[k] == null || r[k] == null) continue;
    const tol = Math.max(15, Math.abs(r[k]) * 0.05);
    if (!near(el[k], r[k], tol))
      err(el.ko + ": " + label + " " + el[k] + "C != 실제 " + r[k] + "C" + (r.note ? " (" + r.note + ")" : ""));
  }

  // 족 분류
  const allowed = FAMILY_TO_GROUP[el.family] ?? [];
  if (allowed.length && !allowed.includes(r.group)) {
    const narrative = el.family === FAMILY.PRECIOUS || el.family === FAMILY.RADIOACTIVE;
    const msg = el.ko + ': 게임 분류 "' + FAMILY_LABEL[el.family] + '" != 실제 "' + r.group + '"'
      + (r.note ? " — " + r.note : "");
    narrative ? warn(msg) : err(msg);
  }
  if (el.family === FAMILY.PRECIOUS && !NOBLE_METALS.has(el.id))
    err(el.ko + ": 귀금속으로 분류됐지만 실제 귀금속이 아니다");

  // 녹는점 > 끓는점 — 비소만 정상 (승화)
  if (el.melt != null && el.boil != null && el.melt > el.boil && el.id !== "as")
    err(el.ko + ": 녹는점(" + el.melt + ") > 끓는점(" + el.boil + ")");
}
console.log("  " + checked + "/" + ELEMENTS.length + "종 대조 완료\n");

// ---------------------------------------------------------------- 2. 전투 유형
console.log(bar);
console.log("  2. 전투 유형이 금속성과 맞는가");
console.log(bar);

const METAL_FAMILIES = new Set([FAMILY.ALKALI, FAMILY.ALKALINE, FAMILY.TRANSITION,
  FAMILY.PRECIOUS, FAMILY.POST_TRANSITION]);
const NONMETAL_FAMILIES = new Set([FAMILY.NONMETAL, FAMILY.HALOGEN, FAMILY.NOBLE]);

for (const el of ELEMENTS) {
  if (METAL_FAMILIES.has(el.family) && el.combat === COMBAT.CASTER)
    warn(el.ko + ": 금속인데 마법형 — 설정상 의도라면 도감에 이유를 적어야 한다");
  if (NONMETAL_FAMILIES.has(el.family) && el.combat === COMBAT.STRIKER)
    warn(el.ko + ": 비금속인데 무기형 — 설정상 의도라면 도감에 이유를 적어야 한다");
  if (el.family === FAMILY.METALLOID && el.combat !== COMBAT.HYBRID)
    warn(el.ko + ": 준금속인데 하이브리드가 아니다");
}
console.log("  검사 완료\n");

// ---------------------------------------------------------------- 3. 화합물
console.log(bar);
console.log("  3. 화합물 — 실제 존재하는가, 만들 수 있는가");
console.log(bar);

const SUB = "₀₁₂₃₄₅₆₇₈₉";
const strip = (f) => f.replace(/[₀-₉]/g, (c) => String(SUB.indexOf(c)));

for (const c of COMPOUNDS) {
  const plain = strip(c.formula);
  const real = REAL_COMPOUNDS[c.id] ?? Object.values(REAL_COMPOUNDS).find((r) => r.formula === plain);

  if (!real) { err(c.name + "(" + c.formula + "): 기준표에 없는 화합물 — 실재 확인 필요"); continue; }

  // 화학식이 needs와 맞는가
  const fromFormula = parseFormula(plain).sort().join(",");
  const fromNeeds = [...c.needs].sort().join(",");
  if (fromFormula !== fromNeeds)
    err(c.name + ": 화학식 " + c.formula + "는 [" + fromFormula + "]인데 needs는 [" + fromNeeds + "]");

  // 필요한 원소가 게임에 존재하는가 — 없으면 영원히 못 만든다
  const missing = c.needs.filter((n) => !owned.has(n));
  if (missing.length)
    gap(c.name + "(" + c.formula + "): " + missing.join("·") + "가 원소 목록에 없어 제작 불가");

  // 결합 종류가 전기음성도 차이와 맞는가
  if (c.needs.length === 2 && real.bond) {
    const [x, y] = c.needs;
    const calc = bondType(x, y);
    if (calc !== "판정 불가" && !real.bond.includes(calc.slice(0, 2)))
      warn(c.name + ': 규칙상 "' + calc + '" 결합인데 설명은 "' + real.bond + '"');
  }
}
console.log("  " + COMPOUNDS.length + "종 검사 완료\n");

// ---------------------------------------------------------------- 4. 인연
console.log(bar);
console.log("  4. 인연 관계 — 실제로 결합하는 조합인가");
console.log(bar);

// 끊긴 인연을 한 줄씩 늘어놓으면 30줄이 넘어 다른 문제를 덮는다.
// 참고자료 설정에는 있지만 아직 안 만든 원소일 뿐이므로 하나로 묶는다.
const dangling = new Map();   // 없는 원소 id -> 그를 가리키는 원소 기호들
for (const el of ELEMENTS) {
  for (const b of el.bonds ?? []) {
    if (owned.has(b)) continue;
    if (!dangling.has(b)) dangling.set(b, []);
    dangling.get(b).push(el.sym);
  }
  const r = REF[el.id];
  if (r?.group === GROUP.NOBLE && (el.bonds ?? []).length > 2)
    warn(el.ko + ": 비활성 기체인데 인연이 " + el.bonds.length + "개 — 반응하지 않는 설정과 어긋나 보인다");
}
if (dangling.size) {
  // 여럿이 가리키는 원소일수록 먼저 만들 가치가 있다
  const sorted = [...dangling].sort((a, b) => b[1].length - a[1].length);
  gap("인연이 가리키지만 아직 없는 원소 " + dangling.size + "종 — 그만큼 인연 보너스가 죽어 있다\n      "
    + sorted.map(([id, from]) => (REF[id]?.ko ?? id) + "←" + from.join(",")).join("  "));
}
console.log("  검사 완료 (끊긴 인연 " + dangling.size + "종)\n");

// ---------------------------------------------------------------- 5. 학습 커버리지
console.log(bar);
console.log("  5. 학습 커버리지 — 플레이하면 무엇을 알게 되는가");
console.log(bar);

const byFamily = {};
for (const el of ELEMENTS) (byFamily[el.family] ??= []).push(el);
for (const [fam, list] of Object.entries(byFamily)) {
  const label = FAMILY_LABEL[fam] ?? fam;
  const mark = list.length >= 3 ? "충분" : list.length === 2 ? "빈약" : "부족";
  console.log("  " + label.padEnd(9, "　") + " " + String(list.length).padStart(2)
    + "종  [" + mark + "]  " + list.map((e) => e.sym).join(" "));
  if (list.length < 2 && fam !== FAMILY.UNKNOWN)
    gap(label + "이 " + list.length + "종뿐 — 족의 공통 성질을 체감하기 어렵다");
}

const bondKinds = new Set();
for (const c of COMPOUNDS) {
  const real = REAL_COMPOUNDS[c.id];
  if (real?.bond) bondKinds.add(real.bond.split("(")[0].trim());
}
console.log("\n  다루는 결합 종류: " + [...bondKinds].join(" · "));
for (const need of ["이온", "극성 공유", "공유 결합 그물"]) {
  if (![...bondKinds].some((k) => k.includes(need.slice(0, 2))))
    gap('"' + need + '" 결합을 보여주는 화합물이 없다');
}

// ---------------------------------------------------------------- 결과
const section = (arr, title, sym) => {
  if (!arr.length) return;
  console.log("\n" + sym + " " + title + " (" + arr.length + "건)");
  console.log("-".repeat(66));
  arr.forEach((m, i) => console.log("  " + String(i + 1).padStart(2) + ". " + m));
};

console.log("\n" + bar);
section(errors, "화학적 오류 — 고쳐야 한다", "X");
section(gaps, "학습 공백 — 플레이로 도달할 수 없다", "!");
section(warns, "게임적 각색 — 의도라면 괜찮다", ".");

console.log("\n" + bar);
console.log("  오류 " + errors.length + " · 공백 " + gaps.length + " · 각색 " + warns.length);
console.log(bar);

fs.rmSync(tmp, { recursive: true, force: true });
process.exit(errors.length ? 1 : 0);
