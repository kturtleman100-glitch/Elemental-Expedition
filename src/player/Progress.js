// 성장 — 레벨업 곡선과 획득한 원소 관리.
//
// 플레이어(119번)는 자기 힘이 없다. 다른 원소를 만나 그 힘을 빌리는 것이
// 성장의 전부다. 그래서 레벨보다 "어떤 원소를 가졌는가"가 더 중요하다.

const MAX_LEVEL = 50;

/** 다음 레벨까지 필요한 경험치 */
export function expToNext(level) {
  return Math.round(48 * Math.pow(level, 1.42));
}

/** 언제나 길이 4인 배열로 맞춘다. 빈 자리는 null */
function normalizeSlots(arr) {
  const out = [null, null, null, null];
  (arr ?? []).slice(0, 4).forEach((id, i) => { out[i] = id || null; });
  return out;
}

export class Progress {
  constructor(initial = {}) {
    this.level = initial.level ?? 1;
    this.exp = initial.exp ?? 0;
    this.chapter = initial.chapter ?? 1;

    /** 획득한 원소 id — 파티 편성과 화합물 조합에 쓰인다 */
    this.owned = new Set(initial.owned ?? []);
    // 장착한 원소 4개. 숫자키 1~4에 대응하며 **자리를 지킨다**.
    // 빈 칸을 걷어내면 3번 슬롯에 둔 것이 1번으로 밀려나, 애써 정한 편성이
    // 원소를 하나 뺄 때마다 뒤죽박죽이 된다.
    this.equipped = normalizeSlots(initial.equipped);
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
  /**
   * 원소를 얻는다.
   *
   * 예전에는 빈 슬롯이 있으면 무조건 자동 장착했다. 그러면 먼저 만난 넷이
   * 그대로 편성이 되어, 무엇을 쓸지 고르는 재미가 사라진다.
   * 이제는 **맨 처음 하나만** 자동으로 쥐어 준다 — 아무것도 못 쓰는 상태로
   * 시작하지 않게 하는 최소한이다. 그 뒤로는 파티 화면(P)에서 직접 고른다.
   *
   * @returns {{isNew:boolean, autoEquipped:boolean}}
   */
  acquire(id) {
    if (this.owned.has(id)) return { isNew: false, autoEquipped: false };
    this.owned.add(id);
    const empty = this.equipped.every((x) => !x);
    if (empty) {
      this.equipped[0] = id;
      return { isNew: true, autoEquipped: true };
    }
    return { isNew: true, autoEquipped: false };
  }

  /**
   * 슬롯에 원소를 넣는다. 같은 원소가 다른 슬롯에 있으면 그 자리와 맞바꾼다.
   * 자리를 유지하는 것이 핵심이다 — 빈 칸을 걷어내면 편성이 밀려난다.
   */
  equip(id, slot) {
    if (!this.owned.has(id) || slot < 0 || slot > 3) return false;
    const at = this.equipped.indexOf(id);
    if (at === slot) return true;
    if (at >= 0) this.equipped[at] = this.equipped[slot] ?? null;  // 맞바꾼다
    this.equipped[slot] = id;
    return true;
  }

  /** 슬롯을 비운다 */
  unequip(slot) {
    if (slot < 0 || slot > 3) return false;
    this.equipped[slot] = null;
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
