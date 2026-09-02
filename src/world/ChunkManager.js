import { Chunk, CHUNK_SIZE } from "./Chunk.js";

// 청크 스트리밍 — 가까운 땅만 만들고 멀어진 땅은 버린다.
//
// 무한한 세계를 다루는 방법은 하나뿐이다. 전부 만들지 않는 것.
// 플레이어 주변 몇 칸만 실재하고, 나머지는 시드에서 언제든 다시 계산된다.
//
// 두 가지를 신경 써야 한다.
//  1. 한 프레임에 여러 청크를 만들면 화면이 뚝 끊긴다. 그래서 예산을 둔다
//  2. 버리는 기준을 만드는 기준보다 넉넉히 잡아야 한다. 같으면 경계에서
//     왔다 갔다 할 때마다 만들고 버리기를 반복한다 (히스테리시스)

export class ChunkManager {
  /**
   * @param {THREE.Scene} scene
   * @param {import('./Terrain.js').Terrain} terrain
   * @param {import('./Collision.js').Collision} collision
   * @param {object} ctx { tex, geoCache, density, outlines, tier }
   */
  constructor(scene, terrain, collision, ctx) {
    this.scene = scene;
    this.terrain = terrain;
    this.collision = collision;
    this.ctx = ctx;

    // 기기 등급에 따라 보이는 범위를 정한다. 청크 하나가 48m이므로
    // 반경 4면 사방 432m가 살아 있다.
    const tier = ctx.tier ?? "high";
    this.viewRadius = tier === "low" ? 2 : 3;
    this.dropRadius = this.viewRadius + 1.5;   // 버리는 기준은 더 넉넉히
    this.budget = tier === "low" ? 1 : 2;      // 프레임당 새로 만들 청크 수

    /** @type {Map<string, Chunk>} */
    this.loaded = new Map();
    /** @type {Chunk[]} 만들기를 기다리는 청크 (가까운 것부터) */
    this.queue = [];

    // 청크가 나고 질 때 바깥에 알린다 (적 배치 등)
    this.onLoad = ctx.onLoad ?? null;
    this.onUnload = ctx.onUnload ?? null;

    this.lastCx = null;
    this.lastCz = null;
    this.stats = { loaded: 0, queued: 0, built: 0 };
  }

  /** 월드 좌표 → 청크 좌표 */
  static toChunk(x, z) {
    return [Math.floor(x / CHUNK_SIZE), Math.floor(z / CHUNK_SIZE)];
  }

  /**
   * 매 프레임 호출한다. 필요한 청크를 큐에 넣고, 예산만큼 만들고,
   * 멀어진 것을 버린다.
   */
  update(px, pz) {
    const [cx, cz] = ChunkManager.toChunk(px, pz);

    // 청크 경계를 넘었을 때만 목록을 다시 계산한다.
    // 매 프레임 반경 전체를 훑을 필요가 없다.
    if (cx !== this.lastCx || cz !== this.lastCz) {
      this.lastCx = cx;
      this.lastCz = cz;
      this._refresh(cx, cz);
    }

    this._buildSome();
    this.stats.loaded = this.loaded.size;
    this.stats.queued = this.queue.length;
  }

  /** 있어야 할 청크를 큐에 넣고, 없어도 될 청크를 버린다 */
  _refresh(cx, cz) {
    const R = this.viewRadius;

    // 필요한 것 채우기
    const wanted = [];
    for (let dz = -R; dz <= R; dz++) {
      for (let dx = -R; dx <= R; dx++) {
        // 사각형이 아니라 원으로 — 모서리까지 만들면 헛일이 25% 늘어난다
        if (dx * dx + dz * dz > R * R + R) continue;
        const key = (cx + dx) + "," + (cz + dz);
        if (this.loaded.has(key)) continue;
        wanted.push({ x: cx + dx, z: cz + dz, d: dx * dx + dz * dz, key });
      }
    }
    // 가까운 것부터 만든다 — 발밑이 먼저 생겨야 한다
    wanted.sort((a, b) => a.d - b.d);

    const queued = new Set(this.queue.map((c) => c.key));
    for (const w of wanted) {
      if (queued.has(w.key)) continue;
      this.queue.push(new Chunk(w.x, w.z, this.terrain, this.ctx));
    }

    // 멀어진 것 버리기
    const D = this.dropRadius;
    for (const [key, chunk] of this.loaded) {
      const dx = chunk.cx - cx, dz = chunk.cz - cz;
      if (dx * dx + dz * dz <= D * D) continue;
      chunk.dispose(this.scene, this.collision);
      this.loaded.delete(key);
      this.onUnload?.(chunk);
    }
    // 큐에 남아 있던 것도 이미 멀어졌으면 버린다
    this.queue = this.queue.filter((c) => {
      const dx = c.cx - cx, dz = c.cz - cz;
      return dx * dx + dz * dz <= D * D;
    });
  }

  /** 예산만큼만 만든다. 여기서 아끼는 것이 곧 프레임 안정성이다 */
  _buildSome() {
    let n = 0;
    while (this.queue.length && n < this.budget) {
      const chunk = this.queue.shift();
      if (this.loaded.has(chunk.key)) continue;
      chunk.build(this.collision);
      this.scene.add(chunk.group);
      this.loaded.set(chunk.key, chunk);
      this.onLoad?.(chunk);
      this.stats.built++;
      n++;
    }
  }

  /**
   * 게임을 시작하기 전에 발밑 몇 청크를 미리 만든다.
   * 안 그러면 시작하자마자 허공에 떠 있다가 땅이 생긴다.
   */
  preload(px, pz, radius = 2) {
    const [cx, cz] = ChunkManager.toChunk(px, pz);
    for (let dz = -radius; dz <= radius; dz++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const key = (cx + dx) + "," + (cz + dz);
        if (this.loaded.has(key)) continue;
        const chunk = new Chunk(cx + dx, cz + dz, this.terrain, this.ctx);
        chunk.build(this.collision);
        this.scene.add(chunk.group);
        this.loaded.set(key, chunk);
        this.onLoad?.(chunk);
      }
    }
    this.lastCx = cx;
    this.lastCz = cz;
  }

  /** 전부 버린다 (새 게임 등) */
  clear() {
    for (const chunk of this.loaded.values()) chunk.dispose(this.scene, this.collision);
    this.loaded.clear();
    this.queue.length = 0;
    this.lastCx = this.lastCz = null;
  }
}

export { CHUNK_SIZE };
