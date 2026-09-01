import { getElement, getCombatType, COMBAT, FAMILY } from "../data/elements.js";

// 상성 계산 — 이 게임 전투의 심장.
//
// 임의의 상성표 대신 실제 폴링 전기음성도를 쓴다. 화학적으로 정확하면서
// 밸런스도 자연스럽게 잡힌다. 플루오린(3.98)이 소듐(0.93)을 때리면 ×2.07이고,
// 이건 실제로 두 원소가 격렬하게 반응한다는 사실과 정확히 일치한다.

const K = 0.35; // 전기음성도 1 차이당 배율 증감

/** 귀족 기체는 전기음성도가 정의되지 않는다 — 반응하지 않으므로 주고받는 피해가 줄어든다 */
const NOBLE_MULT = 0.4;

/** 무기형은 상성의 영향을 절반만 받는다. 안정적이지만 최대 화력이 낮다 */
const STRIKER_AFFINITY_WEIGHT = 0.5;

export const MULT_MIN = 0.25;
export const MULT_MAX = 2.6;

/**
 * 공격자가 방어자에게 주는 상성 배율.
 * @param {object|string} attacker 원소 객체 또는 id
 * @param {object|string} defender
 * @returns {{mult:number, label:string, reason:string}}
 */
export function affinity(attacker, defender) {
  const a = typeof attacker === "string" ? getElement(attacker) : attacker;
  const d = typeof defender === "string" ? getElement(defender) : defender;
  if (!a || !d) return { mult: 1, label: "", reason: "" };

  // 귀족 기체는 어느 쪽이든 반응을 거부한다
  if (a.family === FAMILY.NOBLE || d.family === FAMILY.NOBLE) {
    return {
      mult: NOBLE_MULT,
      label: "반응 없음",
      reason: a.family === FAMILY.NOBLE
        ? `${a.ko}은(는) 이미 전자 여덟을 갖췄다`
        : `${d.ko}은(는) 아무것과도 섞이지 않는다`,
    };
  }

  const ea = a.electroneg;
  const ed = d.electroneg;
  if (ea == null || ed == null) return { mult: 1, label: "", reason: "" };

  let raw = 1 + (ea - ed) * K;

  // 무기형은 화학 반응이 아니라 물리력으로 때린다 — 상성을 덜 탄다
  if (getCombatType(a) === COMBAT.STRIKER) {
    raw = 1 + (raw - 1) * STRIKER_AFFINITY_WEIGHT;
  }

  const mult = Math.max(MULT_MIN, Math.min(MULT_MAX, raw));

  let label = "";
  let reason = "";
  if (mult >= 1.7) {
    label = "격렬 반응!";
    reason = `${a.ko}이(가) ${d.ko}의 전자를 강하게 끌어당긴다`;
  } else if (mult >= 1.25) {
    label = "효과적";
    reason = `전기음성도 차이 ${(ea - ed).toFixed(2)}`;
  } else if (mult <= 0.75) {
    label = "반응이 약하다";
    reason = `${d.ko}이(가) 오히려 전자를 끌어당긴다`;
  }

  return { mult, label, reason };
}

/**
 * 최종 피해량.
 * @param {{element:object, attack:number, level?:number}} atk
 * @param {{element:object, defense:number}} def
 * @param {{power?:number, isCritical?:boolean}} [opts] power = 기술 계수
 */
export function computeDamage(atk, def, opts = {}) {
  const power = opts.power ?? 1;
  const aff = affinity(atk.element, def.element);

  const base = atk.attack * power;
  const reduced = base * (100 / (100 + Math.max(0, def.defense)));
  let dmg = reduced * aff.mult;

  if (opts.isCritical) dmg *= 1.6;

  // 정수로 떨어뜨려야 숫자가 읽힌다. 최소 1은 들어간다
  return {
    amount: Math.max(1, Math.round(dmg)),
    mult: aff.mult,
    label: aff.label,
    reason: aff.reason,
    critical: !!opts.isCritical,
  };
}

/** 배율에 따른 표시 색 — HUD와 피해 숫자가 같은 색을 쓴다 */
export function multColor(mult) {
  if (mult >= 1.7) return "#ff7a5c";
  if (mult >= 1.25) return "#ffb84a";
  if (mult <= 0.75) return "#7fb0d8";
  return "#f0ece0";
}
