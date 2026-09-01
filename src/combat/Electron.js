import { FAMILY } from "../data/elements.js";

// 전자(e⁻) — MP를 대체하는 자원.
//
// 마나를 쓰는 대신 전자를 주고받는다. 금속은 내어주고 비금속은 빼앗는다.
// 이건 장식이 아니라 실제 전투 규칙이다 —
//   금속계: 방출이 곧 공격력. 전자가 남아 있어야 강해진다
//   비금속·할로겐: 때릴 때마다 상대 전자를 흡수해 자기 것으로 만든다
//   귀족 기체: 옥텟이 완성되어 주고받지 않는다. 대신 방어가 최강
//
// 전자를 다 잃으면 행동 불능, 넘치게 흡수하면 불안정 상태가 되어 자해한다.

export const ELECTRON_ROLE = {
  DONOR: "donor",       // 방출형 (금속)
  ACCEPTOR: "acceptor", // 탈취형 (비금속·할로겐)
  INERT: "inert",       // 무반응 (귀족 기체)
};

export function electronRole(el) {
  switch (el.family) {
    case FAMILY.NOBLE:
      return ELECTRON_ROLE.INERT;
    case FAMILY.HALOGEN:
    case FAMILY.NONMETAL:
    case FAMILY.RADIOACTIVE:
      return ELECTRON_ROLE.ACCEPTOR;
    default:
      return ELECTRON_ROLE.DONOR;
  }
}

const REGEN_PER_SEC = 2.4;
const OVERLOAD_RATIO = 1.15;    // 최대치의 이 배를 넘으면 불안정
const OVERLOAD_DPS = 6;         // 불안정 상태의 자해 피해
const DEPLETED_SLOW = 0.45;     // 고갈 시 이동 속도 배율

export class ElectronPool {
  /**
   * @param {object} element 원소 데이터
   * @param {number} max
   */
  constructor(element, max = 50) {
    this.element = element;
    this.role = electronRole(element);
    this.max = max;
    this.value = max;
    this.unstable = false;
    this.depleted = false;
  }

  get ratio() { return this.value / this.max; }

  /** 주문·공격에 소모. 부족하면 false */
  spend(amount) {
    if (this.value < amount) return false;
    this.value -= amount;
    return true;
  }

  /** 상대에게서 빼앗거나 회복 */
  gain(amount) {
    // 무반응형은 애초에 주고받지 않는다
    if (this.role === ELECTRON_ROLE.INERT) return 0;
    const before = this.value;
    this.value = Math.min(this.max * OVERLOAD_RATIO * 1.3, this.value + amount);
    return this.value - before;
  }

  /**
   * @param {number} dt
   * @returns {{selfDamage:number, speedMult:number}}
   */
  update(dt) {
    // 자연 회복 — 최대치까지만. 넘친 분은 저절로 빠지지 않는다
    if (this.value < this.max) {
      this.value = Math.min(this.max, this.value + REGEN_PER_SEC * dt);
    }

    this.unstable = this.value > this.max * OVERLOAD_RATIO;
    this.depleted = this.value <= 0.5;

    let selfDamage = 0;
    if (this.unstable) {
      // 과잉 흡수는 스스로를 망가뜨린다. 흡수형의 위험이 여기 있다
      selfDamage = OVERLOAD_DPS * dt;
      this.value = Math.max(this.max, this.value - 8 * dt);
    }

    return {
      selfDamage,
      speedMult: this.depleted ? DEPLETED_SLOW : 1,
    };
  }

  /**
   * 흡수형이 명중했을 때 상대에게서 가져오는 양.
   *
   * 소모분(마법 7)보다 많아야 "맞히면 계속 싸울 수 있다"가 성립한다.
   * 빗나가면 그대로 손해라, 흡수형은 정확도가 곧 지속력이 된다.
   */
  static stealAmount(attackerRole, damage) {
    if (attackerRole !== ELECTRON_ROLE.ACCEPTOR) return 0;
    return Math.min(18, damage * 0.45);
  }

  toJSON() { return { value: this.value, max: this.max }; }
}
