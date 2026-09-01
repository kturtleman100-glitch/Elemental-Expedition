// 성장 — 레벨업 곡선과 획득한 원소 관리.
//
// 플레이어(119번)는 자기 힘이 없다. 다른 원소를 만나 그 힘을 빌리는 것이
// 성장의 전부다. 그래서 레벨보다 "어떤 원소를 가졌는가"가 더 중요하다.

const MAX_LEVEL = 50;

/** 다음 레벨까지 필요한 경험치 */
export function expToNext(level) {
  return Math.round(48 * Math.pow(level, 1.42));
}

export class Progress {
  constructor(initial = {}) {
    this.level = initial.level ?? 1;
    this.exp = initial.exp ?? 0;
    this.chapter = initial.chapter ?? 1;

    /** 획득한 원소 id — 파티 편성과 화합물 조합에 쓰인다 */
    this.owned = new Set(initial.owned ?? []);
    /** 현재 장착한 원소 4개. 숫자키 1~4에 대응 */
    this.equipped = initial.equipped ?? [];
  }

  get expToNext() { return expToNext(this.level); }

  /**
   * @returns {{leveled:boolean, levels:number}}
   */
  addExp(amount) {
    if (this.level >= MAX_LEVEL) return { leveled: false, levels: 0 };
    this.exp += amount;
    let levels = 0;
    while (this.level < MAX_LEVEL && this.exp >= this.expToNext) {
      this.exp -= this.expToNext;
      this.level++;
      levels++;
    }
    return { leveled: levels > 0, levels };
  }

  /** @returns {boolean} 새로 얻었으면 true */
  acquire(id) {
    if (this.owned.has(id)) return false;
    this.owned.add(id);
    // 빈 슬롯이 있으면 자동 장착 — 얻자마자 써볼 수 있어야 한다
    if (this.equipped.length < 4) this.equipped.push(id);
    return true;
  }

  equip(id, slot) {
    if (!this.owned.has(id)) return false;
    const at = this.equipped.indexOf(id);
    if (at >= 0) this.equipped.splice(at, 1);
    this.equipped[slot] = id;
    this.equipped = this.equipped.filter(Boolean).slice(0, 4);
    return true;
  }

  get activeElement() { return this.equipped[this.activeSlot ?? 0] ?? null; }

  toJSON() {
    return {
      level: this.level,
      exp: this.exp,
      chapter: this.chapter,
      owned: [...this.owned],
      equipped: [...this.equipped],
    };
  }
}
