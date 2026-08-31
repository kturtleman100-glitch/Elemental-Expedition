// 회전을 지원하는 상자 충돌.
//
// three.js Box3를 그대로 쓰지 않는 이유는 두 가지다.
//  1. 플레이어는 "반지름 r인 원기둥"으로 다루는 편이 벽 스침 처리가 자연스럽다
//  2. 마을의 집은 제각기 다른 각도로 돌아가 있다. 축 정렬 상자로 근사하면
//     실제 벽과 어긋나 벽을 뚫거나 허공에서 막히는 일이 생긴다
//
// 그래서 상자마다 y축 회전을 들고, 판정은 상자의 지역 좌표에서 수행한다.
// 지역 좌표에서는 어차피 축 정렬이므로 계산은 여전히 단순하다.

export class Collision {
  constructor() {
    this.colliders = [];
  }

  /**
   * @param {number} centerX
   * @param {number} centerZ
   * @param {number} width  회전 전 x축 크기
   * @param {number} depth  회전 전 z축 크기
   * @param {number} [minY]
   * @param {number} [maxY]
   * @param {number} [rotY] y축 회전(라디안). 0이면 축 정렬
   */
  addBox(centerX, centerZ, width, depth, minY = 0, maxY = 100, rotY = 0) {
    const box = {
      cx: centerX, cz: centerZ,
      hx: width / 2, hz: depth / 2,
      minY, maxY,
      rot: rotY,
      cos: Math.cos(rotY),
      sin: Math.sin(rotY),
    };
    this.colliders.push(box);
    return box;
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
   * y(높이)는 겹침 여부만 본다 — 지형이 아직 평지뿐이라서.
   */
  resolve(x, z, radius, playerMinY, playerMaxY) {
    let rx = x, rz = z;

    for (const c of this.colliders) {
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

    for (const c of this.colliders) {
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
