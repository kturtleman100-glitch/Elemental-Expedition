// 전투 감지와 타겟 선정.
//
// 적이 감지 범위에 들어오면 전투 상태가 되고, 카메라가 락온 모드로 바뀐다.
// 타겟은 "가장 가까운 적"이 아니라 "화면 중앙에 가까운 적"을 우선한다 —
// 플레이어가 보고 있는 쪽을 노리는 게 직관에 맞다.

const ENGAGE_RANGE = 16;
const DISENGAGE_RANGE = 24;

export class TargetLock {
  constructor() {
    this.target = null;
    this.inCombat = false;
    this.enabled = true; // 설정에서 끌 수 있다 (3D 멀미 대응)
  }

  /**
   * @param {{x:number,z:number}} playerPos
   * @param {number} cameraYaw 카메라가 보는 방향
   * @param {import('./Enemy.js').Enemy[]} enemies
   */
  update(playerPos, cameraYaw, enemies) {
    // 죽었거나 너무 멀어진 타겟은 놓는다
    if (this.target) {
      const d = Math.hypot(this.target.position.x - playerPos.x, this.target.position.z - playerPos.z);
      if (!this.target.alive || d > DISENGAGE_RANGE) this.target = null;
    }

    let best = null;
    let bestScore = -Infinity;
    let anyNear = false;

    for (const e of enemies) {
      if (!e.alive) continue;
      const dx = e.position.x - playerPos.x;
      const dz = e.position.z - playerPos.z;
      const dist = Math.hypot(dx, dz);
      if (dist > ENGAGE_RANGE) continue;
      anyNear = true;

      // 화면 중앙과의 각도 차이 — 작을수록 좋다
      const bearing = Math.atan2(dx, dz);
      let off = Math.abs(((bearing - cameraYaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI);

      // 정면에 가까울수록, 가까울수록 높은 점수
      const score = (1 - off / Math.PI) * 2.2 - dist / ENGAGE_RANGE;
      if (score > bestScore) { bestScore = score; best = e; }
    }

    this.inCombat = anyNear;
    if (!this.target) this.target = best;
    return this.target;
  }

  /** Tab / 휠 — 다음 적으로 */
  cycle(playerPos, enemies) {
    const alive = enemies.filter((e) => {
      if (!e.alive) return false;
      const d = Math.hypot(e.position.x - playerPos.x, e.position.z - playerPos.z);
      return d <= ENGAGE_RANGE;
    });
    if (alive.length === 0) { this.target = null; return null; }

    const i = alive.indexOf(this.target);
    this.target = alive[(i + 1) % alive.length];
    return this.target;
  }

  clear() { this.target = null; this.inCombat = false; }
}
