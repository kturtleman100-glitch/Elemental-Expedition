// 단순 AABB(축 정렬 경계 상자) 충돌.
// three.js Box3를 그대로 쓰지 않고 얇은 래퍼를 두는 이유:
// 플레이어는 "지름 r인 원기둥"에 가깝게 다루는 편이 벽 스침 처리가 자연스럽다.
// 여기서는 원기둥 대 AABB의 축별 분리 판정으로 단순화한다.

export class Collision {
  constructor() {
    /** @type {{minX:number,maxX:number,minZ:number,maxZ:number,minY:number,maxY:number}[]} */
    this.colliders = [];
  }

  addBox(centerX, centerZ, width, depth, minY = 0, maxY = 100) {
    const box = {
      minX: centerX - width / 2,
      maxX: centerX + width / 2,
      minZ: centerZ - depth / 2,
      maxZ: centerZ + depth / 2,
      minY,
      maxY,
    };
    this.colliders.push(box);
    return box;
  }

  /**
   * 반지름 r인 플레이어가 (x,z)로 이동하려 할 때, 충돌하는 축을 취소한 보정 좌표를 반환.
   * y(높이)는 지금 단계에서는 다루지 않는다 — 지형이 평지뿐이라서.
   */
  resolve(x, z, radius, playerMinY, playerMaxY) {
    let rx = x, rz = z;
    for (const c of this.colliders) {
      if (playerMaxY < c.minY || playerMinY > c.maxY) continue; // 높이가 안 겹치면 무시

      const closestX = Math.max(c.minX, Math.min(rx, c.maxX));
      const closestZ = Math.max(c.minZ, Math.min(rz, c.maxZ));
      const dx = rx - closestX;
      const dz = rz - closestZ;
      const distSq = dx * dx + dz * dz;

      if (distSq < radius * radius && distSq > 1e-6) {
        const dist = Math.sqrt(distSq);
        const push = radius - dist;
        rx += (dx / dist) * push;
        rz += (dz / dist) * push;
      } else if (distSq <= 1e-6) {
        // 중심이 상자 안에 들어간 극단적 케이스 — 가장 가까운 면으로 밀어낸다.
        const distToMinX = rx - c.minX, distToMaxX = c.maxX - rx;
        const distToMinZ = rz - c.minZ, distToMaxZ = c.maxZ - rz;
        const min = Math.min(distToMinX, distToMaxX, distToMinZ, distToMaxZ);
        if (min === distToMinX) rx = c.minX - radius;
        else if (min === distToMaxX) rx = c.maxX + radius;
        else if (min === distToMinZ) rz = c.minZ - radius;
        else rz = c.maxZ + radius;
      }
    }
    return { x: rx, z: rz };
  }
}
