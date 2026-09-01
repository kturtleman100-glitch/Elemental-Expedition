// 실제 화학 기준값.
//
// 게임 데이터(src/data/elements.js)를 이것과 대조해 틀린 값을 잡는다.
// 출처는 IUPAC 원자량(2021)과 폴링 전기음성도 표준값이다.
//
// null은 "정의되지 않음"이고 undefined는 "이 표에 없음"이다. 둘을 구분해야
// 귀족 기체의 전기음성도(정의 없음)를 오류로 오인하지 않는다.

/**
 * @typedef {object} Ref
 * @property {number} z 원자번호
 * @property {string} ko 한글 이름
 * @property {number|null} mass 원자량 (괄호는 가장 안정한 동위원소)
 * @property {number|null} en 폴링 전기음성도
 * @property {number|null} melt 녹는점 °C
 * @property {number|null} boil 끓는점 °C
 * @property {string} group 실제 분류
 * @property {string} [note] 게임 데이터가 다를 수 있는 이유
 */

export const GROUP = {
  ALKALI: "알칼리 금속",
  ALKALINE: "알칼리 토금속",
  TRANSITION: "전이 금속",
  POST_TRANSITION: "전이후 금속",
  METALLOID: "준금속",
  NONMETAL: "비금속",
  HALOGEN: "할로겐",
  NOBLE: "비활성 기체",
  ACTINIDE: "악티늄족",
  LANTHANIDE: "란타넘족",
  UNKNOWN: "성질 미상",
};

/** 귀금속(noble metal) — 전이 금속의 하위 분류이지 별개 족이 아니다 */
export const NOBLE_METALS = new Set(["ru", "rh", "pd", "ag", "os", "ir", "pt", "au", "cu", "hg", "re"]);

export const REF = {
  h:  { z: 1,   ko: "수소",       mass: 1.008,   en: 2.20, melt: -259.1, boil: -252.9, group: GROUP.NONMETAL },
  he: { z: 2,   ko: "헬륨",       mass: 4.003,   en: null, melt: null,   boil: -268.9, group: GROUP.NOBLE },
  li: { z: 3,   ko: "리튬",       mass: 6.94,    en: 0.98, melt: 180.5,  boil: 1342,   group: GROUP.ALKALI },
  be: { z: 4,   ko: "베릴륨",     mass: 9.012,   en: 1.57, melt: 1287,   boil: 2469,   group: GROUP.ALKALINE },
  b:  { z: 5,   ko: "붕소",       mass: 10.81,   en: 2.04, melt: 2076,   boil: 3927,   group: GROUP.METALLOID },
  c:  { z: 6,   ko: "탄소",       mass: 12.011,  en: 2.55, melt: 3550,   boil: 4827,   group: GROUP.NONMETAL,
        note: "흑연은 승화한다. 3550/4827은 다이아몬드 기준으로 널리 쓰이는 값" },
  n:  { z: 7,   ko: "질소",       mass: 14.007,  en: 3.04, melt: -210.0, boil: -195.8, group: GROUP.NONMETAL },
  o:  { z: 8,   ko: "산소",       mass: 15.999,  en: 3.44, melt: -218.8, boil: -183.0, group: GROUP.NONMETAL },
  f:  { z: 9,   ko: "플루오린",   mass: 18.998,  en: 3.98, melt: -219.7, boil: -188.1, group: GROUP.HALOGEN },
  ne: { z: 10,  ko: "네온",       mass: 20.180,  en: null, melt: -248.6, boil: -246.1, group: GROUP.NOBLE },
  na: { z: 11,  ko: "소듐",       mass: 22.990,  en: 0.93, melt: 97.8,   boil: 883,    group: GROUP.ALKALI },
  mg: { z: 12,  ko: "마그네슘",   mass: 24.305,  en: 1.31, melt: 650,    boil: 1091,   group: GROUP.ALKALINE },
  al: { z: 13,  ko: "알루미늄",   mass: 26.982,  en: 1.61, melt: 660.3,  boil: 2470,   group: GROUP.POST_TRANSITION },
  si: { z: 14,  ko: "규소",       mass: 28.085,  en: 1.90, melt: 1414,   boil: 3265,   group: GROUP.METALLOID },
  p:  { z: 15,  ko: "인",         mass: 30.974,  en: 2.19, melt: 44.15,  boil: 280.5,  group: GROUP.NONMETAL,
        note: "백린 기준. 동소체마다 다르다" },
  s:  { z: 16,  ko: "황",         mass: 32.06,   en: 2.58, melt: 115.2,  boil: 444.6,  group: GROUP.NONMETAL },
  cl: { z: 17,  ko: "염소",       mass: 35.45,   en: 3.16, melt: -101.5, boil: -34.0,  group: GROUP.HALOGEN },
  ar: { z: 18,  ko: "아르곤",     mass: 39.948,  en: null, melt: -189.3, boil: -185.8, group: GROUP.NOBLE },
  k:  { z: 19,  ko: "포타슘",     mass: 39.098,  en: 0.82, melt: 63.5,   boil: 759,    group: GROUP.ALKALI },
  ca: { z: 20,  ko: "칼슘",       mass: 40.078,  en: 1.00, melt: 842,    boil: 1484,   group: GROUP.ALKALINE },
  sc: { z: 21,  ko: "스칸듐",     mass: 44.956,  en: 1.36, melt: 1541,   boil: 2836,   group: GROUP.TRANSITION },
  ti: { z: 22,  ko: "타이타늄",   mass: 47.867,  en: 1.54, melt: 1668,   boil: 3287,   group: GROUP.TRANSITION },
  v:  { z: 23,  ko: "바나듐",     mass: 50.942,  en: 1.63, melt: 1910,   boil: 3407,   group: GROUP.TRANSITION },
  mn: { z: 25,  ko: "망가니즈",   mass: 54.938,  en: 1.55, melt: 1246,   boil: 2061,   group: GROUP.TRANSITION },
  fe: { z: 26,  ko: "철",         mass: 55.845,  en: 1.83, melt: 1538,   boil: 2861,   group: GROUP.TRANSITION },
  co: { z: 27,  ko: "코발트",     mass: 58.933,  en: 1.88, melt: 1495,   boil: 2927,   group: GROUP.TRANSITION },
  ni: { z: 28,  ko: "니켈",       mass: 58.693,  en: 1.91, melt: 1455,   boil: 2913,   group: GROUP.TRANSITION },
  cu: { z: 29,  ko: "구리",       mass: 63.546,  en: 1.90, melt: 1084.6, boil: 2562,   group: GROUP.TRANSITION },
  zn: { z: 30,  ko: "아연",       mass: 65.38,   en: 1.65, melt: 419.5,  boil: 907,    group: GROUP.TRANSITION },
  ga: { z: 31,  ko: "갈륨",       mass: 69.723,  en: 1.81, melt: 29.8,   boil: 2204,   group: GROUP.POST_TRANSITION },
  as: { z: 33,  ko: "비소",       mass: 74.922,  en: 2.18, melt: 817,    boil: 614,    group: GROUP.METALLOID,
        note: "817°C는 28기압 기준. 상압에서는 614°C에 승화하므로 끓는점 < 녹는점" },
  br: { z: 35,  ko: "브로민",     mass: 79.904,  en: 2.96, melt: -7.2,   boil: 58.8,   group: GROUP.HALOGEN },
  nb: { z: 41,  ko: "나이오븀",   mass: 92.906,  en: 1.60, melt: 2477,   boil: 4744,   group: GROUP.TRANSITION },
  mo: { z: 42,  ko: "몰리브데넘", mass: 95.95,   en: 2.16, melt: 2623,   boil: 4639,   group: GROUP.TRANSITION },
  tc: { z: 43,  ko: "테크네튬",   mass: 98,      en: 1.90, melt: 2157,   boil: 4265,   group: GROUP.TRANSITION,
        note: "안정 동위원소가 없어 원자량은 괄호값" },
  ag: { z: 47,  ko: "은",         mass: 107.868, en: 1.93, melt: 961.8,  boil: 2162,   group: GROUP.TRANSITION },
  sn: { z: 50,  ko: "주석",       mass: 118.710, en: 1.96, melt: 231.9,  boil: 2602,   group: GROUP.POST_TRANSITION },
  sb: { z: 51,  ko: "안티모니",   mass: 121.760, en: 2.05, melt: 630.6,  boil: 1587,   group: GROUP.METALLOID },
  i:  { z: 53,  ko: "아이오딘",   mass: 126.904, en: 2.66, melt: 113.7,  boil: 184.3,  group: GROUP.HALOGEN },
  ta: { z: 73,  ko: "탄탈럼",     mass: 180.948, en: 1.50, melt: 3017,   boil: 5458,   group: GROUP.TRANSITION },
  w:  { z: 74,  ko: "텅스텐",     mass: 183.84,  en: 2.36, melt: 3422,   boil: 5555,   group: GROUP.TRANSITION },
  ir: { z: 77,  ko: "이리듐",     mass: 192.217, en: 2.20, melt: 2446,   boil: 4428,   group: GROUP.TRANSITION },
  pt: { z: 78,  ko: "백금",       mass: 195.084, en: 2.28, melt: 1768.3, boil: 3825,   group: GROUP.TRANSITION },
  au: { z: 79,  ko: "금",         mass: 196.967, en: 2.54, melt: 1064.2, boil: 2856,   group: GROUP.TRANSITION },
  hg: { z: 80,  ko: "수은",       mass: 200.592, en: 2.00, melt: -38.8,  boil: 356.7,  group: GROUP.TRANSITION },
  tl: { z: 81,  ko: "탈륨",       mass: 204.38,  en: 1.62, melt: 304,    boil: 1473,   group: GROUP.POST_TRANSITION },
  pb: { z: 82,  ko: "납",         mass: 207.2,   en: 2.33, melt: 327.5,  boil: 1749,   group: GROUP.POST_TRANSITION },
  bi: { z: 83,  ko: "비스무트",   mass: 208.980, en: 2.02, melt: 271.4,  boil: 1564,   group: GROUP.POST_TRANSITION },
  po: { z: 84,  ko: "폴로늄",     mass: 209,     en: 2.00, melt: 254,    boil: 962,    group: GROUP.METALLOID,
        note: "준금속이면서 방사성. 게임은 방사성 쪽을 택했다" },
  rn: { z: 86,  ko: "라돈",       mass: 222,     en: null, melt: -71,    boil: -61.7,  group: GROUP.NOBLE,
        note: "비활성 기체이면서 방사성" },
  ra: { z: 88,  ko: "라듐",       mass: 226,     en: 0.90, melt: 700,    boil: 1737,   group: GROUP.ALKALINE },
  u:  { z: 92,  ko: "우라늄",     mass: 238.029, en: 1.38, melt: 1135,   boil: 4131,   group: GROUP.ACTINIDE },
  cm: { z: 96,  ko: "퀴륨",       mass: 247,     en: 1.28, melt: 1345,   boil: 3110,   group: GROUP.ACTINIDE },
  es: { z: 99,  ko: "아인슈타이늄", mass: 252,   en: 1.30, melt: 860,    boil: null,   group: GROUP.ACTINIDE },
  fm: { z: 100, ko: "페르뮴",     mass: 257,     en: 1.30, melt: 1527,   boil: null,   group: GROUP.ACTINIDE },
  nh: { z: 113, ko: "니호늄",     mass: 286,     en: null, melt: null,   boil: null,   group: GROUP.UNKNOWN,
        note: "전이후 금속으로 예측되나 확인되지 않았다" },
  fl: { z: 114, ko: "플레로븀",   mass: 289,     en: null, melt: null,   boil: null,   group: GROUP.UNKNOWN },
  og: { z: 118, ko: "오가네손",   mass: 294,     en: null, melt: null,   boil: null,   group: GROUP.NOBLE,
        note: "18족은 맞으나 상대론적 효과로 상온에서 고체일 것으로 예측된다" },
};

/**
 * 실제 화합물. formula를 구성 원소로 분해한 결과가 needs와 맞아야 한다.
 * fact는 게임이 플레이어에게 가르치려는 화학 사실이다.
 */
export const REAL_COMPOUNDS = {
  nacl: {
    formula: "NaCl", elements: ["na", "cl"], name: "염화 소듐",
    bond: "이온", fact: "금속(Na)이 전자를 내주고 비금속(Cl)이 받아 이온 결합을 이룬다. 전기음성도 차이 2.23.",
  },
  h2o: {
    formula: "H2O", elements: ["h", "o"], name: "물",
    bond: "극성 공유", fact: "산소가 전자를 더 세게 당겨 굽은 극성 분자가 된다. 그래서 물이 무언가를 잘 녹인다.",
  },
  rust: {
    formula: "Fe2O3", elements: ["fe", "o"], name: "산화 철(III)",
    bond: "이온", fact: "철이 산소에 전자를 빼앗겨 녹이 된다. 산화란 곧 전자를 잃는 일이다.",
  },
  co2: {
    formula: "CO2", elements: ["c", "o"], name: "이산화 탄소",
    bond: "극성 공유(무극성 분자)", fact: "결합은 극성이지만 직선 대칭이라 분자 전체는 무극성이다.",
  },
  sio2: {
    formula: "SiO2", elements: ["si", "o"], name: "이산화 규소",
    bond: "공유 결합 그물", fact: "분자가 아니라 그물처럼 이어진 구조여서 매우 단단하고 녹는점이 높다.",
  },
  caf2: {
    formula: "CaF2", elements: ["ca", "f"], name: "플루오린화 칼슘 (형석)",
    bond: "이온", fact: "형석(fluorite)에서 형광(fluorescence)이라는 말이 나왔다.",
  },
  zns: {
    formula: "ZnS", elements: ["zn", "s"], name: "황화 아연 (섬아연석)",
    bond: "이온성 공유", fact: "빛을 받아 저장했다가 천천히 내놓는 인광 물질이다.",
  },
  hgs: {
    formula: "HgS", elements: ["hg", "s"], name: "황화 수은 (진사)",
    bond: "이온성 공유", fact: "주홍색 안료 버밀리언의 원료. 수은을 얻는 주된 광석이기도 하다.",
  },
  pbs: {
    formula: "PbS", elements: ["pb", "s"], name: "황화 납 (방연석)",
    bond: "이온성 공유", fact: "납의 주요 광석. 납은 밀도가 높아 방사선을 잘 막는다.",
  },
  agbr: {
    formula: "AgBr", elements: ["ag", "br"], name: "브로민화 은",
    bond: "이온", fact: "빛을 받으면 은으로 환원된다. 흑백 필름이 상을 기록하는 원리다.",
  },
};

/** 화학식에서 원소 기호를 뽑아낸다. "Fe2O3" → ["fe","o"] */
export function parseFormula(formula) {
  const out = [];
  for (const m of formula.matchAll(/([A-Z][a-z]?)(\d*)/g)) {
    if (!m[1]) continue;
    const sym = m[1].toLowerCase();
    if (!out.includes(sym)) out.push(sym);
  }
  return out;
}

const METAL_GROUPS = new Set([
  GROUP.ALKALI, GROUP.ALKALINE, GROUP.TRANSITION,
  GROUP.POST_TRANSITION, GROUP.ACTINIDE, GROUP.LANTHANIDE,
]);

/** 이 원소가 금속인가 */
export function isMetal(id) {
  const r = REF[id];
  return r ? METAL_GROUPS.has(r.group) : false;
}

/**
 * 결합 종류를 판정한다.
 *
 * 전기음성도 차 1.7이라는 숫자만 쓰면 Fe2O3(차 1.61)를 공유 결합이라 하게 된다.
 * 교과서가 실제로 쓰는 1차 기준은 "금속 + 비금속 → 이온"이고,
 * 전기음성도 차는 비금속끼리일 때 극성 정도를 가른다.
 *
 * @param {string} idA 원소 id
 * @param {string} idB 원소 id
 */
export function bondType(idA, idB) {
  const a = REF[idA], b = REF[idB];
  if (!a || !b) return "판정 불가";
  if (a.en == null || b.en == null) return "판정 불가";

  const metalA = isMetal(idA), metalB = isMetal(idB);
  // 금속 + 비금속 → 전자를 주고받는다
  if (metalA !== metalB) return "이온";
  // 금속끼리 → 자유 전자를 공유한다
  if (metalA && metalB) return "금속";

  // 비금속끼리 → 전기음성도 차가 극성을 가른다
  const d = Math.abs(a.en - b.en);
  if (d >= 0.4) return "극성 공유";
  return "무극성 공유";
}
