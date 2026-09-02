import * as THREE from "three";
import { toonMaterial } from "../fx/Style.js";
import { rngAt, hash3 } from "./Noise.js";

// 청크 하나 — 세계를 이루는 정사각형 조각.
//
// 무한한 땅을 한 번에 만들 수는 없으니 조각내어 필요한 것만 만든다.
// 조각 하나는 자기 지형 메시와 소품, 충돌 상자를 모두 들고 있고,
// 버릴 때 그것들을 통째로 돌려준다. 이 자족성이 중요하다 —
// 청크가 서로 얽히면 하나를 버릴 때 다른 청크가 깨진다.
//
// 소품은 청크 안에서 재질별로 병합한다. 청크마다 드로우콜 서너 개면
// 스물다섯 청크를 띄워도 백 개 아래로 유지된다.

export const CHUNK_SIZE = 64;      // 한 변(m)
const GRID = 16;                   // 지형 격자 분할. 16x16이면 4m마다 한 점

export class Chunk {
  /**
   * @param {number} cx 청크 좌표 (월드 좌표가 아니다)
   * @param {number} cz
   * @param {import('./Terrain.js').Terrain} terrain
   * @param {object} ctx { tex, geoCache, density, outlines }
   */
  constructor(cx, cz, terrain, ctx) {
    this.cx = cx;
    this.cz = cz;
    this.key = cx + "," + cz;
    this.terrain = terrain;
    this.ctx = ctx;

    this.group = new THREE.Group();
    this.disposables = [];   // 버릴 때 해제할 지오메트리
    this.built = false;

    // 청크 중심의 바이옴 — 소품과 색을 정한다.
    // 청크 안에서 바이옴이 갈릴 수도 있지만, 조각마다 하나로 잡는 편이
    // 소품을 묶어 그리기 좋고 경계는 지형 색 보간으로 가려진다.
    const wx = cx * CHUNK_SIZE + CHUNK_SIZE / 2;
    const wz = cz * CHUNK_SIZE + CHUNK_SIZE / 2;
    this.biome = terrain.biomeAt(wx, wz);
    this.centerX = wx;
    this.centerZ = wz;
  }

  /** 지형 메시와 소품을 만든다. 프레임 예산 때문에 생성 시점과 분리되어 있다 */
  build(collision) {
    if (this.built) return;
    this.built = true;

    this._ground();
    this._props(collision);

    this.group.position.set(0, 0, 0);
  }

  // ---------------------------------------------------------------- 지형

  _ground() {
    const { terrain, biome } = this;
    const size = CHUNK_SIZE;
    const ox = this.cx * size, oz = this.cz * size;

    // 한 칸 더 넉넉히 만들어 이웃 청크와 겹치게 한다.
    // 딱 맞게 만들면 부동소수 오차로 이음매에 실금이 보인다.
    const geo = new THREE.PlaneGeometry(size, size, GRID, GRID);
    geo.rotateX(-Math.PI / 2);

    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const c1 = new THREE.Color(biome.ground);
    const c2 = new THREE.Color(biome.groundAlt);
    const tmp = new THREE.Color();

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i) + ox + size / 2;
      const z = pos.getZ(i) + oz + size / 2;
      const h = terrain.heightAt(x, z);
      pos.setY(i, h);

      // 높은 곳은 밝게, 낮은 곳은 어둡게 — 굴곡이 눈에 들어온다
      const t = Math.min(1, Math.max(0, (h + 6) / 14));
      tmp.copy(c2).lerp(c1, t);
      colors[i * 3] = tmp.r;
      colors[i * 3 + 1] = tmp.g;
      colors[i * 3 + 2] = tmp.b;
    }
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();

    const mat = toonMaterial(0xffffff, {
      map: this.ctx.tex[biome.tex] ?? this.ctx.tex.grass,
      repeat: [8, 8],
      vertexColors: true,
    });

    const mesh = new THREE.Mesh(geo, mat);
    mesh.name = "chunk-ground:" + this.key;
    mesh.position.set(ox + size / 2, 0, oz + size / 2);
    mesh.receiveShadow = true;
    // 지형은 그림자를 드리우지 않는다 — 넓은 면이 그림자 맵을 다 먹는다
    mesh.castShadow = false;
    this.group.add(mesh);
    this.disposables.push(geo);
  }

  // ---------------------------------------------------------------- 소품

  /**
   * 소품을 놓는다.
   *
   * 종류마다 재질을 따로 두면 청크 하나가 드로우콜 여덟아홉 개를 먹고,
   * 스물다섯 청크면 이백 개가 넘는다. 그래서 색을 재질이 아니라 **정점**에
   * 굽는다. 그러면 나무든 바위든 버섯이든 재질이 하나라 한 번에 그려진다.
   * 반투명한 것(소금·수정·물)만 따로 묶는다 — 투명은 섞을 수 없다.
   *
   * 대가로 소품에서 텍스처가 빠진다. 다만 이 게임은 원래 셀 셰이딩이라
   * 면이 단색으로 떨어지고, 손으로 지은 마을은 텍스처를 그대로 쓰므로
   * 가까이서 보는 것들은 여전히 결이 살아 있다.
   */
  _props(collision) {
    const { terrain, biome, ctx } = this;
    const size = CHUNK_SIZE;
    const ox = this.cx * size, oz = this.cz * size;
    const rand = rngAt(terrain.seed + 4242, this.cx, this.cz);

    const opaque = [];       // {geo, color}
    const transparent = [];
    const add = (matKey, geo, matrix) => {
      const spec = PROP_LOOK[matKey] ?? { color: 0x9a9488 };
      const g = geo.clone().applyMatrix4(matrix);
      (spec.transparent ? transparent : opaque).push({ geo: g, color: spec.color });
    };

    for (const [kind, count] of Object.entries(biome.props ?? {})) {
      const n = Math.round(count * ctx.density);
      for (let i = 0; i < n; i++) {
        const lx = rand() * size, lz = rand() * size;
        const x = ox + lx, z = oz + lz;

        // 마을 안에는 아무것도 놓지 않는다. 손으로 지은 것을 덮으면 안 된다.
        // 지형이 평평한 범위(108m)보다 넓게 잡는다 — 길이 118m까지 뻗어 있다
        if (terrain.isHandBuilt(x, z)) continue;
        // 절벽에는 세우지 않는다 — 비탈에 수직으로 박힌 나무는 금방 눈에 띈다
        if (terrain.slopeAt(x, z) > 0.55) continue;

        const y = terrain.heightAt(x, z);
        const spec = PROP_SPECS[kind];
        if (!spec) continue;
        spec(this, { x, y, z, rand, add, collision });
      }
    }

    for (const [list, mat] of [[opaque, solidMaterial()], [transparent, glassMaterial()]]) {
      if (!list.length) continue;
      const merged = mergeColored(list);
      if (!merged) continue;
      const mesh = new THREE.Mesh(merged, mat);
      mesh.name = "chunk-props:" + this.key;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.group.add(mesh);
      this.disposables.push(merged);
      for (const item of list) item.geo.dispose();
    }
  }

  /** 씬과 충돌에서 완전히 걷어낸다 */
  dispose(scene, collision) {
    scene.remove(this.group);
    collision.removeOwner(this.key);
    for (const g of this.disposables) g.dispose();
    this.disposables.length = 0;
    this.group.clear();
  }
}

// ---------------------------------------------------------------- 지오메트리 병합

/**
 * 색을 정점에 구워 넣으며 여러 지오메트리를 하나로 잇는다.
 *
 * three의 mergeGeometries는 addons에 있지만 이 정도는 직접 붙이는 편이
 * 의존을 줄인다. 게다가 색을 함께 굽는 일은 어차피 직접 해야 한다.
 *
 * @param {{geo:THREE.BufferGeometry, color:number}[]} items
 */
function mergeColored(items) {
  if (!items.length) return null;
  let vCount = 0, iCount = 0;
  for (const { geo } of items) {
    vCount += geo.attributes.position.count;
    iCount += geo.index ? geo.index.count : geo.attributes.position.count;
  }
  const position = new Float32Array(vCount * 3);
  const normal = new Float32Array(vCount * 3);
  const color = new Float32Array(vCount * 3);
  // 정점이 6만 5천을 넘으면 16비트 인덱스로는 모자란다
  const index = vCount > 65535 ? new Uint32Array(iCount) : new Uint16Array(iCount);

  const c = new THREE.Color();
  let vo = 0, io = 0;
  for (const { geo, color: hex } of items) {
    const p = geo.attributes.position, nAttr = geo.attributes.normal;
    position.set(p.array, vo * 3);
    if (nAttr) normal.set(nAttr.array, vo * 3);

    // three가 색을 선형 공간에서 다루므로 여기서 변환해 둔다.
    // 안 하면 sRGB 값이 그대로 들어가 전체가 허옇게 뜬다.
    c.setHex(hex, THREE.SRGBColorSpace);
    for (let i = 0; i < p.count; i++) {
      color[(vo + i) * 3] = c.r;
      color[(vo + i) * 3 + 1] = c.g;
      color[(vo + i) * 3 + 2] = c.b;
    }

    if (geo.index) {
      for (let i = 0; i < geo.index.count; i++) index[io++] = geo.index.array[i] + vo;
    } else {
      for (let i = 0; i < p.count; i++) index[io++] = i + vo;
    }
    vo += p.count;
  }

  const out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.BufferAttribute(position, 3));
  out.setAttribute("normal", new THREE.BufferAttribute(normal, 3));
  out.setAttribute("color", new THREE.BufferAttribute(color, 3));
  out.setIndex(new THREE.BufferAttribute(index, 1));
  out.computeBoundingSphere();
  return out;
}

// ---------------------------------------------------------------- 소품 정의

const M = new THREE.Matrix4();
const Q = new THREE.Quaternion();
const E = new THREE.Euler();
const V = new THREE.Vector3();
const S = new THREE.Vector3();

function place(x, y, z, ry, sx, sy, sz) {
  E.set(0, ry, 0);
  Q.setFromEuler(E);
  V.set(x, y, z);
  S.set(sx, sy, sz);
  return M.compose(V, Q, S);
}

/** 소품 종류마다 어떤 지오메트리를 어디에 놓는지 */
const PROP_SPECS = {
  tree(chunk, { x, y, z, rand, add, collision }) {
    const s = 0.8 + rand() * 0.7;
    const g = chunk.ctx.geoCache;
    add("trunk", g("c-trunk", () => new THREE.CylinderGeometry(0.22, 0.32, 3.4, 6)),
        place(x, y + 1.7 * s, z, rand() * 6.28, s, s, s));
    add("leaf", g("c-leaf", () => new THREE.IcosahedronGeometry(1.5, 0)),
        place(x, y + 3.6 * s, z, rand() * 6.28, s * 1.1, s * 0.95, s * 1.1));
    collision.addBox(x, z, 0.7, 0.7, y, y + 3.2, 0, chunk.key);
  },

  deadtree(chunk, { x, y, z, rand, add, collision }) {
    const s = 0.9 + rand() * 0.5;
    const g = chunk.ctx.geoCache;
    add("deadwood", g("c-dead", () => new THREE.CylinderGeometry(0.14, 0.28, 3.8, 5)),
        place(x, y + 1.9 * s, z, rand() * 6.28, s, s, s));
    collision.addBox(x, z, 0.6, 0.6, y, y + 3.4, 0, chunk.key);
  },

  rock(chunk, { x, y, z, rand, add, collision }) {
    const s = 0.5 + rand() * 1.3;
    add("rock", chunk.ctx.geoCache("c-rock", () => new THREE.DodecahedronGeometry(1, 0)),
        place(x, y + s * 0.45, z, rand() * 6.28, s, s * 0.75, s * 0.9));
    if (s > 0.9) collision.addBox(x, z, s * 1.5, s * 1.5, y, y + s, 0, chunk.key);
  },

  limestone(chunk, { x, y, z, rand, add, collision }) {
    const s = 1.1 + rand() * 2.2;
    add("limestone", chunk.ctx.geoCache("c-lime", () => new THREE.DodecahedronGeometry(1, 0)),
        place(x, y + s * 0.5, z, rand() * 6.28, s * 0.9, s * 1.35, s * 0.9));
    collision.addBox(x, z, s * 1.5, s * 1.5, y, y + s * 1.7, 0, chunk.key);
  },

  // 소금 결정 — 정육면체로 자란다. NaCl 결정이 실제로 입방정계다
  saltcrystal(chunk, { x, y, z, rand, add, collision }) {
    const s = 0.5 + rand() * 1.4;
    add("salt", chunk.ctx.geoCache("c-salt", () => new THREE.BoxGeometry(1, 1, 1)),
        place(x, y + s * 0.5, z, rand() * 1.57, s, s, s));
    if (s > 0.9) collision.addBox(x, z, s, s, y, y + s, 0, chunk.key);
  },

  // 수정 기둥 — SiO2는 육각기둥으로 자란다
  crystal(chunk, { x, y, z, rand, add, collision }) {
    const s = 0.7 + rand() * 1.8;
    add("crystal", chunk.ctx.geoCache("c-crystal", () => new THREE.CylinderGeometry(0, 0.55, 3.2, 6)),
        place(x, y + s * 1.5, z, rand() * 6.28, s, s, s));
    collision.addBox(x, z, s * 1.1, s * 1.1, y, y + s * 3, 0, chunk.key);
  },

  ironspire(chunk, { x, y, z, rand, add, collision }) {
    const s = 0.9 + rand() * 1.6;
    add("iron", chunk.ctx.geoCache("c-spire", () => new THREE.ConeGeometry(0.9, 4.2, 5)),
        place(x, y + s * 2.1, z, rand() * 6.28, s, s, s));
    collision.addBox(x, z, s * 1.6, s * 1.6, y, y + s * 4, 0, chunk.key);
  },

  pillar(chunk, { x, y, z, rand, add, collision }) {
    const s = 1 + rand() * 1.2;
    add("pillar", chunk.ctx.geoCache("c-pillar", () => new THREE.CylinderGeometry(0.7, 0.8, 5.5, 8)),
        place(x, y + s * 2.75, z, rand() * 6.28, s, s, s));
    collision.addBox(x, z, s * 1.6, s * 1.6, y, y + s * 5.5, 0, chunk.key);
  },

  glowrock(chunk, { x, y, z, rand, add }) {
    const s = 0.4 + rand() * 0.9;
    add("glow", chunk.ctx.geoCache("c-glow", () => new THREE.IcosahedronGeometry(1, 0)),
        place(x, y + s * 0.4, z, rand() * 6.28, s, s * 0.8, s));
  },

  sulfurvent(chunk, { x, y, z, rand, add }) {
    const s = 0.5 + rand() * 0.8;
    add("sulfur", chunk.ctx.geoCache("c-vent", () => new THREE.CylinderGeometry(0.5, 0.9, 0.7, 7)),
        place(x, y + s * 0.35, z, rand() * 6.28, s, s, s));
  },

  spring(chunk, { x, y, z, rand, add }) {
    const s = 1.6 + rand() * 2.2;
    add("water", chunk.ctx.geoCache("c-spring", () => new THREE.CylinderGeometry(1, 1, 0.16, 12)),
        place(x, y + 0.09, z, 0, s, 1, s));
  },

  grass(chunk, { x, y, z, rand, add }) {
    const s = 0.6 + rand() * 0.7;
    add("grassblade", chunk.ctx.geoCache("c-blade", () => new THREE.ConeGeometry(0.13, 0.75, 3)),
        place(x, y + 0.36 * s, z, rand() * 6.28, s, s, s));
  },

  flower(chunk, { x, y, z, rand, add }) {
    const s = 0.5 + rand() * 0.5;
    add("flower", chunk.ctx.geoCache("c-flower", () => new THREE.IcosahedronGeometry(0.19, 0)),
        place(x, y + 0.42 * s, z, rand() * 6.28, s, s, s));
  },

  mushroom(chunk, { x, y, z, rand, add }) {
    const s = 0.6 + rand() * 0.8;
    add("mushroom", chunk.ctx.geoCache("c-shroom", () => new THREE.CylinderGeometry(0.34, 0.1, 0.5, 6)),
        place(x, y + 0.26 * s, z, rand() * 6.28, s, s, s));
  },
};

// ---------------------------------------------------------------- 재질

/**
 * 소품의 색. 재질이 아니라 색만 정한다 — 색은 정점에 구워지고
 * 재질은 아래 둘 중 하나를 함께 쓴다.
 */
const PROP_LOOK = {
  trunk: { color: 0x6a4d34 },
  deadwood: { color: 0x6a6055 },
  leaf: { color: 0x5f8a4a },
  rock: { color: 0x8e8a80 },
  limestone: { color: 0xd6ceba },
  iron: { color: 0x8a4a30 },
  pillar: { color: 0xa8a49a },
  // 방사성 바위는 스스로 빛나 보이도록 아주 밝은 색을 준다.
  // 셀 셰이딩이라 밝은 색은 그늘에서도 어둡지 않아 발광처럼 읽힌다
  glow: { color: 0x8affa8 },
  sulfur: { color: 0xe8d24a },
  grassblade: { color: 0x6f8a48 },
  flower: { color: 0xd8a0c0 },
  mushroom: { color: 0xd8785a },

  // 비쳐야 결정으로 보이는 것들
  salt: { color: 0xf2efe6, transparent: true },
  crystal: { color: 0x9fc4e8, transparent: true },
  water: { color: 0x7ab8c4, transparent: true },
};

// 모든 청크가 이 둘만 나눠 쓴다. 그래서 청크당 드로우콜이 지형 1 + 소품 2다.
let _solid = null, _glass = null;

function solidMaterial() {
  return _solid ??= toonMaterial(0xffffff, { vertexColors: true });
}
function glassMaterial() {
  return _glass ??= toonMaterial(0xffffff, { vertexColors: true, opacity: 0.75 });
}
