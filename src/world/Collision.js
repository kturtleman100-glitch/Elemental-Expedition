// 회전을 지원하는 상자 충돌 + 공간 해시.
//
// three.js Box3를 그대로 쓰지 않는 이유는 두 가지다.
//  1. 플레이어는 "반지름 r인 원기둥"으로 다루는 편이 벽 스침 처리가 자연스럽다
//  2. 마을의 집은 제각기 다른 각도로 돌아가 있다. 축 정렬 상자로 근사하면
//     실제 벽과 어긋나 벽을 뚫거나 허공에서 막히는 일이 생긴다
//
// 그래서 상자마다 y축 회전을 들고, 판정은 상자의 지역 좌표에서 수행한다.
// 지역 좌표에서는 어차피 축 정렬이므로 계산은 여전히 단순하다.
//
// 무한 지형이 들어오면서 격자 분할을 얹었다. 예전에는 상자가 수백 개뿐이라
// 매 틱 전부 훑어도 됐지만, 청크가 계속 붙으면 수천 개가 되고 그걸 120Hz로
// 훑으면 이동만으로 프레임이 죽는다. 이제는 플레이어 주변 칸만 본다.

const CELL = 16;   // 격자 한 칸(m). 집 하나가 대체로 한두 칸에 걸친다

export class Collision {
  constructor() {
    this.colliders = [];
    /** @type {Map<string, object[]>} 격자 칸 -> 그 칸에 걸친 상자들 */
    this.cells = new Map();
    /** @type {Map<string, object[]>} 소유자(청크) -> 그가 넣은 상자들 */
    this.owners = new Map();
  }

  _key(cx, cz) { return cx + "," + cz; }

  /** 상자가 걸치는 모든 칸에 등록한다. 큰 상자는 여러 칸에 들어간다 */
  _index(box) {
    // 회전을 고려한 넉넉한 반경 — 정확히 구하는 것보다 조금 크게 잡는 편이 안전하다
    const r = Math.hypot(box.hx, box.hz);
    const x0 = Math.floor((box.cx - r) / CELL), x1 = Math.floor((box.cx + r) / CELL);
    const z0 = Math.floor((box.cz - r) / CELL), z1 = Math.floor((box.cz + r) / CELL);
    box._cells = [];
    for (let cx = x0; cx <= x1; cx++) {
      for (let cz = z0; cz <= z1; cz++) {
        const k = this._key(cx, cz);
        let list = this.cells.get(k);
        if (!list) { list = []; this.cells.set(k, list); }
        list.push(box);
        box._cells.push(k);
      }
    }
  }

  /**
   * @param {number} centerX
   * @param {number} centerZ
   * @param {number} width  회전 전 x축 크기
   * @param {number} depth  회전 전 z축 크기
   * @param {number} [minY]
   * @param {number} [maxY]
   * @param {number} [rotY] y축 회전(라디안). 0이면 축 정렬
   * @param {string} [owner] 나중에 통째로 걷어내기 위한 꼬리표 (청크 좌표 등)
   */
  addBox(centerX, centerZ, width, depth, minY = 0, maxY = 100, rotY = 0, owner = null) {
    const box = {
      cx: centerX, cz: centerZ,
      hx: width / 2, hz: depth / 2,
      minY, maxY,
      rot: rotY,
      cos: Math.cos(rotY),
      sin: Math.sin(rotY),
      owner,
    };
    this.colliders.push(box);
    this._index(box);
    if (owner) {
      let list = this.owners.get(owner);
      if (!list) { list = []; this.owners.set(owner, list); }
      list.push(box);
    }
    return box;
  }

  /**
   * 한 소유자가 넣은 상자를 전부 걷어낸다.
   * 청크가 시야에서 벗어나 버려질 때 쓴다 — 안 걷어내면 가보지도 않을 땅의
   * 담장에 계속 부딪히게 된다.
   */
  removeOwner(owner) {
    const list = this.owners.get(owner);
    if (!list) return 0;
    const dead = new Set(list);
    for (const box of list) {
      for (const k of box._cells ?? []) {
        const cell = this.cells.get(k);
        if (!cell) continue;
        const i = cell.indexOf(box);
        if (i >= 0) cell.splice(i, 1);
        if (!cell.length) this.cells.delete(k);
      }
    }
    this.colliders = this.colliders.filter((b) => !dead.has(b));
    this.owners.delete(owner);
    return list.length;
  }

  /**
   * 지정한 사각형에 걸친 상자만 모은다. 중복은 걸러낸다 —
   * 큰 상자는 여러 칸에 등록되어 있어 그냥 모으면 같은 상자를 두 번 민다.
   */
  _near(x, z, reach, out) {
    out.length = 0;
    const x0 = Math.floor((x - reach) / CELL), x1 = Math.floor((x + reach) / CELL);
    const z0 = Math.floor((z - reach) / CELL), z1 = Math.floor((z + reach) / CELL);
    for (let cx = x0; cx <= x1; cx++) {
      for (let cz = z0; cz <= z1; cz++) {
        const cell = this.cells.get(this._key(cx, cz));
        if (!cell) continue;
        for (const b of cell) if (!out.includes(b)) out.push(b);
      }
    }
    return out;
  }

  /** 월드 좌표를 상자 지역 좌표로 (회전만 되돌린다) */
  _toLocal(box, x, z) {
    const dx = x - box.cx, dz = z - box.cz;
    return [dx * box.cos - dz * box.sin, dx * box.sin + dz * box.cos];
  }

  /** 지역 좌표 방향 벡터를 월드로 되돌린다 */
  _toWorldDir(box, lx, lz) {
    return [lx * box.cos + lz * box.sin, -lx * box.sin + lz * box.cos];
  }

  /**
   * 반지름 r인 플레이어가 (x,z)로 이동하려 할 때 충돌을 밀어낸 좌표를 반환.
   * y는 겹침 여부만 본다.
   */
  resolve(x, z, radius, playerMinY, playerMaxY) {
    let rx = x, rz = z;
    // 밀려나면서 옆 상자에 닿을 수 있으니 반경보다 조금 넓게 본다
    const candidates = this._near(x, z, radius + CELL, this._buf ??= []);

    for (const c of candidates) {
      if (playerMaxY < c.minY || playerMinY > c.maxY) continue;

      const [lx, lz] = this._toLocal(c, rx, rz);

      // 지역 좌표에서 상자 표면의 가장 가까운 점
      const closestX = Math.max(-c.hx, Math.min(lx, c.hx));
      const closestZ = Math.max(-c.hz, Math.min(lz, c.hz));
      const dx = lx - closestX;
      const dz = lz - closestZ;
      const distSq = dx * dx + dz * dz;

      if (distSq > 1e-8) {
        if (distSq >= radius * radius) continue; // 충분히 떨어져 있다
        const dist = Math.sqrt(distSq);
        const push = radius - dist;
        const [wx, wz] = this._toWorldDir(c, (dx / dist) * push, (dz / dist) * push);
        rx += wx;
        rz += wz;
      } else {
        // 중심이 상자 안에 들어갔다 — 가장 가까운 면으로 빼낸다
        const toMinX = lx + c.hx, toMaxX = c.hx - lx;
        const toMinZ = lz + c.hz, toMaxZ = c.hz - lz;
        const min = Math.min(toMinX, toMaxX, toMinZ, toMaxZ);

        let nx = 0, nz = 0;
        if (min === toMinX) nx = -(toMinX + radius);
        else if (min === toMaxX) nx = toMaxX + radius;
        else if (min === toMinZ) nz = -(toMinZ + radius);
        else nz = toMaxZ + radius;

        const [wx, wz] = this._toWorldDir(c, nx, nz);
        rx += wx;
        rz += wz;
      }
    }

    return { x: rx, z: rz };
  }

  /**
   * 광선이 처음 부딪히는 거리를 구한다. 3인칭 카메라가 벽을 통과하지 않도록
   * 플레이어 → 카메라 방향으로 쏴서, 막히면 그 앞까지만 카메라를 물린다.
   *
   * @param {number} ox 시작점 x
   * @param {number} oy 시작점 y
   * @param {number} oz 시작점 z
   * @param {number} dx 정규화된 방향
   * @param {number} dy
   * @param {number} dz
   * @param {number} maxDist 이 거리까지만 본다
   * @param {number} [padding] 벽에서 이만큼 앞에서 멈춘다
   * @returns {number} 부딪히기까지의 거리. 아무것도 없으면 maxDist
   */
  rayDistance(ox, oy, oz, dx, dy, dz, maxDist, padding = 0.28) {
    let nearest = maxDist;
    // 광선이 지나는 구간을 통째로 감싸는 범위만 훑는다
    const midX = ox + dx * maxDist * 0.5;
    const midZ = oz + dz * maxDist * 0.5;
    const candidates = this._near(midX, midZ, maxDist * 0.5 + CELL, this._rayBuf ??= []);

    for (const c of candidates) {
      // 광선을 상자 지역 좌표로 옮긴다
      const [lox, loz] = this._toLocal(c, ox, oz);
      const ldx = dx * c.cos - dz * c.sin;
      const ldz = dx * c.sin + dz * c.cos;

      // 슬래브 판정 — 축마다 진입/이탈 구간을 구해 교집합을 찾는다
      let tMin = 0, tMax = maxDist;

      // x축
      if (Math.abs(ldx) < 1e-8) {
        if (lox < -c.hx || lox > c.hx) continue;
      } else {
        let t1 = (-c.hx - lox) / ldx;
        let t2 = (c.hx - lox) / ldx;
        if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
        tMin = Math.max(tMin, t1);
        tMax = Math.min(tMax, t2);
        if (tMin > tMax) continue;
      }

      // z축
      if (Math.abs(ldz) < 1e-8) {
        if (loz < -c.hz || loz > c.hz) continue;
      } else {
        let t1 = (-c.hz - loz) / ldz;
        let t2 = (c.hz - loz) / ldz;
        if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
        tMin = Math.max(tMin, t1);
        tMax = Math.min(tMax, t2);
        if (tMin > tMax) continue;
      }

      // y축 (회전과 무관)
      if (Math.abs(dy) < 1e-8) {
        if (oy < c.minY || oy > c.maxY) continue;
      } else {
        let t1 = (c.minY - oy) / dy;
        let t2 = (c.maxY - oy) / dy;
        if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
        tMin = Math.max(tMin, t1);
        tMax = Math.min(tMax, t2);
        if (tMin > tMax) continue;
      }

      if (tMin >= 0 && tMin < nearest) nearest = tMin;
    }

    return nearest === maxDist ? maxDist : Math.max(0.35, nearest - padding);
  }
}
