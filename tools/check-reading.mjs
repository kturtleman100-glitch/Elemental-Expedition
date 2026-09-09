// 읽기 난이도 검사 — 초등 4~6학년이 읽을 수 있는가.
//
// 이 게임은 화학을 가르치려고 만든다. 그런데 글이 어려우면 아이가 안 읽고,
// 안 읽으면 아무것도 못 가르친다. 정확한데 안 읽히는 글은 이 프로젝트에서
// 틀린 글과 같다.
//
// 규칙은 CLAUDE.md 「글은 초등학교 4~6학년이 읽는다」에 있고, 이 파일이 그걸 강제한다.
// 사람이 눈으로 보면 39명을 쓰는 동안 반드시 새어나간다.

import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");

/**
 * 쓰지 않는 말.
 *
 * 괄호로 풀어 써도 안 된다 — "d 오비탈(전자가 앉는 방)"은 여전히 어렵다.
 * 아이는 괄호를 읽지 않고 어려운 단어를 만난 순간 눈을 뗀다.
 */
const BANNED = [
  "오비탈", "산화수", "이온화", "전자 배치", "원자가", "옥텟", "쿨롱",
  "공유 결합", "이온 결합", "부동태", "승화", "동소체", "촉매", "환원",
  "자유 전자", "배위", "극성", "환원 전위", "전자껍질", "전자 껍질",
];

/**
 * 전기음성도만 예외다. 전투 배율의 근거라 화면에 계속 나오므로 피할 수 없다.
 * 대신 처음 나올 때 반드시 풀어 줘야 한다.
 */
const ALLOWED_WITH_GLOSS = "전기음성도";
const GLOSS_HINT = "당기는 힘";

/** 한 문장이 이보다 길면 아이가 중간에 길을 잃는다 */
const MAX_SENTENCE = 45;

/** 검사할 곳 — 게임 화면에 실제로 나오는 텍스트만 */
const TARGETS = [
  { file: "src/data/families.js", fields: ["trait", "why", "inGame", "watch"] },
  { file: "src/data/elements.js", fields: ["bio", "quote", "role", "exception"] },
  { file: "src/data/bonds.js", fields: ["desc", "flavor"] },
  { file: "src/data/factions.js", fields: ["creed", "desc"] },
];

let errors = 0;
let warns = 0;

function err(msg) { console.log("  \x1b[31m✗\x1b[0m " + msg); errors++; }
function warn(msg) { console.log("  \x1b[33m!\x1b[0m " + msg); warns++; }

/** 큰따옴표 문자열 필드를 뽑는다. CRLF가 섞여 있어 \r을 먼저 없앤다 */
function extract(src, field) {
  const re = new RegExp(`${field}:\\s*"((?:[^"\\\\]|\\\\.)*)"`, "g");
  const out = [];
  let m;
  while ((m = re.exec(src)) !== null) {
    const line = src.slice(0, m.index).split("\n").length;
    out.push({ text: m[1], line });
  }
  return out;
}

/** 문장을 나눈다. 한국어는 마침표만으로는 부족해 "다." "요." 도 본다 */
function sentences(text) {
  return text
    .split(/(?<=[.!?…])\s+|(?<=다\.)\s*|(?<=요\.)\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
}

console.log("\n=== 읽기 난이도 검사 (초등 4~6학년) ===\n");

for (const { file, fields } of TARGETS) {
  const full = path.join(ROOT, file);
  if (!fs.existsSync(full)) continue;
  const src = fs.readFileSync(full, "utf8").replace(/\r/g, "");

  let checked = 0;
  let glossed = false;

  for (const field of fields) {
    for (const { text, line } of extract(src, field)) {
      checked++;

      for (const word of BANNED) {
        if (text.includes(word)) {
          err(`${file}:${line} ${field} — 「${word}」는 쓰지 않는다`);
        }
      }

      // 전기음성도는 어딘가에서 한 번은 풀어 줘야 한다
      if (text.includes(ALLOWED_WITH_GLOSS)) {
        if (text.includes(GLOSS_HINT)) glossed = true;
      }

      for (const s of sentences(text)) {
        if (s.length > MAX_SENTENCE) {
          warn(`${file}:${line} ${field} — ${s.length}자 문장 (${MAX_SENTENCE}자 넘음)\n      「${s.slice(0, 40)}…」`);
        }
      }

      // 숫자만 덩그러니 있는가. 단위가 붙은 수치는 옆에 비유가 있어야 한다
      const bare = text.match(/\d+(?:\.\d+)?\s*(?:°C|도|kJ|g\/cm)/g);
      if (bare && !/[—–-]|같|만큼|보다|정도|쯤/.test(text)) {
        warn(`${file}:${line} ${field} — 숫자 ${bare[0]}에 비유가 없다`);
      }
    }
  }

  if (checked > 0) {
    console.log(`  ${file} — ${checked}개 확인`);
  }
  if (src.includes(ALLOWED_WITH_GLOSS) && !glossed && file.includes("families")) {
    warn(`${file} — 전기음성도를 「${GLOSS_HINT}」으로 풀어 준 곳이 없다`);
  }
}

console.log("\n" + "=".repeat(66));
if (errors === 0 && warns === 0) {
  console.log("  읽기 검사 통과 — 초등 4~6학년이 읽을 수 있다");
} else {
  console.log(`  오류 ${errors} · 주의 ${warns}`);
}
console.log("=".repeat(66) + "\n");

process.exit(errors > 0 ? 1 : 0);
