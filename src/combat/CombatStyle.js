import { getCombatType, COMBAT } from "../data/elements.js";
import { ELECTRON_ROLE, electronRole } from "./Electron.js";

// 전투 유형별 행동 정의.
//
// 무기형은 근접·짧은 쿨타임·낮은 전자 소모, 마법형은 원거리 투사체·높은 소모.
// 하이브리드는 둘을 전환한다. 이 차이가 "어떤 원소를 데려갈까"의 근거가 된다.

export const STYLE = {
  [COMBAT.STRIKER]: {
    range: 2.6,
    cooldown: 0.42,
    electronCost: 2,
    power: 1.0,
    projectile: false,
    windup: 0.12,
    label: "무기형",
  },
  [COMBAT.CASTER]: {
    range: 18,
    cooldown: 0.75,
    electronCost: 7,
    power: 1.35,
    projectile: true,
    projectileSpeed: 22,
    windup: 0.22,
    label: "마법형",
  },
  [COMBAT.HYBRID]: {
    range: 9,
    cooldown: 0.55,
    electronCost: 4,
    power: 1.15,
    projectile: true,
    projectileSpeed: 30,
    windup: 0.16,
    label: "하이브리드",
  },
};

/**
 * 하이브리드는 무기형/마법형 두 자세를 오간다 (T 키).
 * 준금속이 금속과 비금속의 경계에 있다는 성질을 조작으로 옮긴 것이다.
 * 전환한 쪽의 성능을 그대로 쓰되 조금 깎아, 전문가보다는 못하게 둔다.
 */
export const HYBRID_MODE = { STRIKER: "striker", CASTER: "caster" };

export function styleOf(element, hybridMode = HYBRID_MODE.STRIKER) {
  const type = getCombatType(element);
  if (type !== COMBAT.HYBRID) return STYLE[type] ?? STYLE[COMBAT.HYBRID];

  const base = STYLE[hybridMode === HYBRID_MODE.CASTER ? COMBAT.CASTER : COMBAT.STRIKER];
  return {
    ...base,
    power: base.power * 0.88,        // 전문가보다 한 수 아래
    cooldown: base.cooldown * 0.92,  // 대신 조금 더 빠르다
    label: hybridMode === HYBRID_MODE.CASTER ? "하이브리드 · 마법" : "하이브리드 · 무기",
    hybrid: true,
  };
}

export function isHybrid(element) {
  return getCombatType(element) === COMBAT.HYBRID;
}

/**
 * 능력치 산출. 무기형은 HP·방어가 높고 마법형은 공격이 높다.
 * @param {object} element
 * @param {number} level
 */
export function statsFor(element, level = 1) {
  const type = getCombatType(element);
  const g = level - 1;

  const base = {
    [COMBAT.STRIKER]: { hp: 130, atk: 12, def: 14, electrons: 40 },
    [COMBAT.CASTER]: { hp: 88, atk: 18, def: 7, electrons: 70 },
    [COMBAT.HYBRID]: { hp: 108, atk: 15, def: 10, electrons: 55 },
  }[type];

  const grow = {
    [COMBAT.STRIKER]: { hp: 14, atk: 1.6, def: 2.0, electrons: 3 },
    [COMBAT.CASTER]: { hp: 8, atk: 2.6, def: 0.9, electrons: 6 },
    [COMBAT.HYBRID]: { hp: 11, atk: 2.1, def: 1.4, electrons: 4.5 },
  }[type];

  // 원자량이 큰 원소는 더 단단하다 — 무거움이 곧 방어라는 직관을 수치로 옮겼다
  const massBonus = element.mass ? Math.min(1.25, 0.9 + element.mass / 600) : 1;

  return {
    hpMax: Math.round((base.hp + grow.hp * g) * massBonus),
    attack: Math.round(base.atk + grow.atk * g),
    defense: Math.round((base.def + grow.def * g) * massBonus),
    electronsMax: Math.round(base.electrons + grow.electrons * g),
  };
}

/**
 * 공격 한 번의 서술. Enemy와 Player가 같은 함수를 쓴다.
 * @param {object} element
 * @param {ElectronPool} pool
 */
/**
 * 공격할 수 있는가.
 *
 * 흡수형(할로겐 등)도 전자를 소모한다. 예전에는 면제해줬는데 그러면
 * 무한 마법이 되어 자원이 의미를 잃었다. 대신 명중하면 소모분보다 많이
 * 되찾도록 했다 — 맞히면 이득, 빗나가면 굶는 구조가 흡수형의 정체성이다.
 */
export function canAttack(element, pool, cooldownLeft, hybridMode) {
  if (cooldownLeft > 0) return { ok: false, why: "cooldown" };
  const s = styleOf(element, hybridMode);
  if (pool.value < s.electronCost) return { ok: false, why: "electrons" };
  return { ok: true, style: s };
}
