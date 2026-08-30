import * as THREE from "three";
import { Collision } from "./Collision.js";
import { toonMaterial, makeOutline, setupLighting, makeSky, InstancedBatch } from "../fx/Style.js";
import { woodGrain, plaster, roofTile, grassField, dirtPath, stoneBlock, foliage } from "../fx/Textures.js";

// 토룡마을 — 대륙 동쪽 끝, 칼슘 촌장이 다스리는 시작 지역.
// 자료에 "석회암 동굴"이 나오므로 석회암 노두를 지역 정체성으로 삼았다.
//
// 이전 판이 "장난감 같다"는 지적을 받아 세 가지를 바꿨다.
//  1. 모든 면에 절차적 텍스처를 입혔다 — 단색 판이 플라스틱처럼 보이던 원인
//  2. 잔풀·꽃·자갈 등 수가 많은 것은 InstancedMesh로 묶었다 — 밀도를 3배 올리면서
//     드로우콜은 오히려 줄였다
//  3. 담장·좌판·빨래줄·등불 같은 생활의 흔적을 넣었다 — 건물만 있으면 마을로 안 읽힌다

const PALETTE = {
  skyTop: 0x4a7db0,
  skyHorizon: 0xd2e0dc,
  skyBottom: 0x6b7a6a,
  fog: 0xd2e0dc,

  grass: 0x7d9455, grassLit: 0x94a865, grassDark: 0x5d7342,
  path: 0xc9bb9c, pathEdge: 0x9c8f76,
  stone: 0x9a958a, stoneDark: 0x6f6b62,
  limestone: 0xd6ceba, limestoneDark: 0xa89e86,

  plaster: 0xe6dcc6, plasterShade: 0xc2b59a,
  timber: 0x6a4d34, timberDark: 0x4a3524,
  roof: 0x4a6b6e, roofDark: 0x2e4a4c, roofRidge: 0x24393a,
  roofAlt: 0x7a5a4a, roofAltDark: 0x503A30,

  trunk: 0x6a4d34, trunkDark: 0x4a3524,
  leafA: 0x5f8a4a, leafB: 0x3f6634, leafC: 0x7fb05e,

  accent: 0xc98a3a,
  cloth: 0xd8b878, clothAlt: 0xb85c4a,
};

export class World {
  /**
   * @param {THREE.Scene} scene
   * @param {import('../core/Device.js').Device} device
   */
  constructor(scene, device) {
    this.scene = scene;
    this.device = device;
    this.outlines = device.tierName !== "low";
    this.collision = new Collision();
    this.spawnPoint = new THREE.Vector3(0, 0, 11);

    // 저사양에서는 소품 수를 줄인다. 인스턴싱 덕에 드로우콜은 그대로지만
    // 정점 수와 그림자 계산은 여전히 개수에 비례한다.
    this.density = device.tierName === "low" ? 0.45 : device.tierName === "mid" ? 0.75 : 1;

    this.tex = {
      wood: woodGrain(PALETTE.timber, PALETTE.timberDark),
      plaster: plaster(PALETTE.plaster, PALETTE.plasterShade),
      roof: roofTile(PALETTE.roof, PALETTE.roofDark),
      roofAlt: roofTile(PALETTE.roofAlt, PALETTE.roofAltDark, "alt"),
      grass: grassField(PALETTE.grass, PALETTE.grassDark, PALETTE.grassLit),
      dirt: dirtPath(PALETTE.path, PALETTE.pathEdge),
      stone: stoneBlock(PALETTE.stone, PALETTE.stoneDark),
      limestone: stoneBlock(PALETTE.limestone, PALETTE.limestoneDark, "lime"),
      leaf: foliage(PALETTE.leafA, PALETTE.leafB, PALETTE.leafC),
    };

    // 인스턴싱 대상은 여기 모았다가 마지막에 한 번에 만든다
    this.batch = new InstancedBatch();

    makeSky(scene, device, PALETTE);
    setupLighting(scene, device);

    this._buildGround();
    this._buildVillage();
    this._buildNature();
    this._buildScatter();
    this._buildBoundary();

    this.stats = this.batch.build(scene);
  }

  // ================= 지형 =================

  _buildGround() {
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(300, 300),
      toonMaterial(0xffffff, { map: this.tex.grass, repeat: [46, 46] })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);

    // 광장 — 흙바닥
    const plaza = new THREE.Mesh(
      new THREE.CircleGeometry(12, 44),
      toonMaterial(0xffffff, { map: this.tex.dirt, repeat: [7, 7] })
    );
    plaza.rotation.x = -Math.PI / 2;
    plaza.position.y = 0.02;
    plaza.receiveShadow = true;
    this.scene.add(plaza);

    // 길 — 광장에서 세 방향. 나중에 다른 지역으로 이어질 자리를 암시한다
    for (const [angle, len] of [[0, 34], [Math.PI * 0.66, 30], [Math.PI * 1.34, 30]]) {
      const road = new THREE.Mesh(
        new THREE.PlaneGeometry(5, len),
        toonMaterial(0xffffff, { map: this.tex.dirt, repeat: [2, len / 4] })
      );
      road.rotation.x = -Math.PI / 2;
      road.rotation.z = -angle;
      road.position.set(Math.sin(angle) * (len / 2 + 9), 0.03, Math.cos(angle) * (len / 2 + 9));
      road.receiveShadow = true;
      this.scene.add(road);
    }

    // 언덕 — 완전한 평지는 화면을 비어 보이게 만든다
    const hillMat = toonMaterial(0xffffff, { map: this.tex.grass, repeat: [8, 8] });
    for (const [x, z, r, h] of [
      [-38, -34, 15, 3.6], [34, -42, 18, 4.4], [-46, 28, 17, 4.0],
      [44, 34, 14, 3.0], [0, -58, 24, 5.6], [-20, 46, 16, 3.4],
    ]) {
      const hill = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 10), hillMat);
      hill.position.set(x, -r + h, z);
      hill.receiveShadow = true;
      this.scene.add(hill);
    }
  }

  // ================= 마을 =================

  _buildVillage() {
    // 촌장의 집 — 광장 북쪽, 가장 크고 지붕 색이 다르다
    this._house(0, -20, 7.0, 3.8, 5.6, 0, { chief: true });

    this._house(-15, -9, 4.6, 3.0, 4.2, 0.34);
    this._house(14, -11, 4.8, 3.1, 4.4, -0.28);
    this._house(-17, 9, 4.4, 2.9, 4.0, -0.52);
    this._house(16, 8, 4.6, 3.0, 4.2, 0.44);
    this._house(-8, 22, 4.2, 2.8, 3.8, 0.16);
    this._house(9, 24, 4.4, 2.9, 4.0, -0.2);
    this._house(24, -2, 4.0, 2.7, 3.6, 1.3);
    this._house(-25, -1, 4.0, 2.7, 3.6, -1.25);

    this._well(0, 0);
    this._stall(-6.5, 6.5, 0.4, PALETTE.cloth);
    this._stall(6.8, 5.8, -0.35, PALETTE.clothAlt);
    this._noticeBoard(3.5, -8.5, -0.25);

    // 담장 — 집들 사이를 이어 마을의 윤곽을 만든다
    this._fence([-19, -4], [-19, 4], 0);
    this._fence([19, -5], [19, 4], 0);
    this._fence([-12, 16], [-3, 16], 0);
    this._fence([4, 17], [13, 17], 0);
    this._fence([-11, -15], [-4, -15], 0);
    this._fence([4, -15], [11, -15], 0);

    this._laundry(-15, 3.5, 0.2);
    this._laundry(15.5, 2.6, -0.3);

    // 석회암 노두 — 칼슘이 기도하러 가는 동굴이 있다는 설정의 단서
    this._limestone(-27, -24, 3.6);
    this._limestone(-23, -29, 2.4);
    this._limestone(-31, -19, 2.8);
    this._limestone(-25, -20, 1.7);
  }

  /**
   * 가옥. 실루엣을 만드는 것은 셋이다 —
   * 석재 기단이 건물을 땅에 앉히고, 목재 골조가 벽면을 분할하고,
   * 처마 깊은 2단 지붕이 위를 덮는다.
   */
  _house(x, z, w, h, d, ry, opts = {}) {
    const p = new THREE.Group();
    p.position.set(x, 0, z);
    p.rotation.y = ry;

    const stoneM = toonMaterial(0xffffff, { map: this.tex.stone, repeat: [w / 2, 0.5] });
    const plasterM = toonMaterial(0xffffff, { map: this.tex.plaster, repeat: [w / 2.6, h / 2.6] });
    const woodM = toonMaterial(0xffffff, { map: this.tex.wood, repeat: [1, 2] });
    const woodDarkM = toonMaterial(0xa88a6a, { map: this.tex.wood, repeat: [1, 2] });
    const roofM = toonMaterial(0xffffff, { map: opts.chief ? this.tex.roofAlt : this.tex.roof, repeat: [4, 3] });
    const roofDarkM = toonMaterial(0x9aa8a8, { map: opts.chief ? this.tex.roofAlt : this.tex.roof, repeat: [3, 2] });

    // 기단
    this._put(p, new THREE.BoxGeometry(w + 0.55, 0.34, d + 0.55), stoneM, [0, 0.17, 0], { outline: 0.02 });
    this._put(p, new THREE.BoxGeometry(w + 0.28, 0.44, d + 0.28), stoneM, [0, 0.52, 0], { outline: 0.02 });

    // 벽 — 아래를 어둡게 해서 층을 만든다
    const wallBase = 0.74;
    this._put(p, new THREE.BoxGeometry(w, h * 0.4, d), toonMaterial(0xd8cdb6, { map: this.tex.plaster, repeat: [w / 2.6, 0.7] }),
      [0, wallBase + h * 0.2, 0], { outline: 0.016 });
    this._put(p, new THREE.BoxGeometry(w - 0.05, h * 0.62, d - 0.05), plasterM,
      [0, wallBase + h * 0.71, 0], { outline: 0.016 });

    // 목재 골조 — 기둥·인방·가새
    const wy = wallBase + h * 0.5;
    for (const sx of [-1, 1]) for (const sz of [-1, 1])
      this._put(p, new THREE.BoxGeometry(0.16, h, 0.16), woodM,
        [sx * (w / 2 - 0.06), wy, sz * (d / 2 - 0.06)], { noOutline: true });

    for (const sz of [-1, 1]) {
      this._put(p, new THREE.BoxGeometry(w, 0.15, 0.13), woodM, [0, wallBase + h * 0.42, sz * (d / 2 - 0.02)], { noOutline: true });
      this._put(p, new THREE.BoxGeometry(w, 0.17, 0.13), woodDarkM, [0, wallBase + h - 0.07, sz * (d / 2 - 0.02)], { noOutline: true });
    }
    for (const sx of [-1, 1]) {
      this._put(p, new THREE.BoxGeometry(0.13, 0.15, d), woodM, [sx * (w / 2 - 0.02), wallBase + h * 0.42, 0], { noOutline: true });
      this._put(p, new THREE.BoxGeometry(0.13, 0.17, d), woodDarkM, [sx * (w / 2 - 0.02), wallBase + h - 0.07, 0], { noOutline: true });
    }
    for (const sx of [-1, 1])
      this._put(p, new THREE.BoxGeometry(0.12, h * 0.6, 0.1), woodM,
        [sx * w * 0.27, wallBase + h * 0.62, d / 2 - 0.02], { rot: [0, 0, sx * 0.42], noOutline: true });

    // 지붕 — 2단, 깊은 처마
    const roofY = wallBase + h;
    const eave = Math.max(w, d) * 0.5 + 0.95;
    this._put(p, new THREE.BoxGeometry(w + 0.6, 0.16, d + 0.6), woodDarkM, [0, roofY + 0.05, 0], { outline: 0.02 });
    this._put(p, new THREE.ConeGeometry(eave, h * 0.36, 4), roofM,
      [0, roofY + h * 0.18 + 0.11, 0], { rot: [0, Math.PI / 4, 0], outline: 0.02 });
    this._put(p, new THREE.ConeGeometry(eave * 0.66, h * 0.34, 4), roofDarkM,
      [0, roofY + h * 0.46 + 0.11, 0], { rot: [0, Math.PI / 4, 0], outline: 0.024 });
    this._put(p, new THREE.BoxGeometry(0.22, 0.22, eave * 0.85), toonMaterial(PALETTE.roofRidge),
      [0, roofY + h * 0.62 + 0.11, 0], { rot: [0, Math.PI / 4, 0], noOutline: true });
    this._put(p, new THREE.SphereGeometry(0.17, 8, 6), toonMaterial(PALETTE.accent),
      [0, roofY + h * 0.68 + 0.11, 0], { outline: 0.05 });

    // 문
    this._put(p, new THREE.BoxGeometry(1.2, 1.9, 0.1), woodDarkM, [0, 1.66, d / 2 + 0.03], { noOutline: true });
    this._put(p, new THREE.BoxGeometry(0.94, 1.66, 0.06), woodM, [0, 1.58, d / 2 + 0.07], { noOutline: true });
    this._put(p, new THREE.SphereGeometry(0.06, 8, 6), toonMaterial(PALETTE.accent), [0.31, 1.52, d / 2 + 0.11], { noOutline: true });

    // 창 — 틀·유리·십자 창살 3겹이라야 창으로 읽힌다
    for (const sx of opts.chief ? [-1, 1] : [1]) {
      const cx = sx * w * 0.3, cy = wallBase + h * 0.73;
      this._put(p, new THREE.BoxGeometry(0.96, 0.9, 0.09), woodDarkM, [cx, cy, d / 2 + 0.03], { noOutline: true });
      this._put(p, new THREE.BoxGeometry(0.8, 0.74, 0.05), toonMaterial(0x8fb2c2), [cx, cy, d / 2 + 0.07], { noOutline: true, cast: false });
      this._put(p, new THREE.BoxGeometry(0.08, 0.74, 0.03), woodM, [cx, cy, d / 2 + 0.1], { noOutline: true });
      this._put(p, new THREE.BoxGeometry(0.8, 0.08, 0.03), woodM, [cx, cy, d / 2 + 0.1], { noOutline: true });
    }

    // 처마 밑 등불
    this._put(p, new THREE.BoxGeometry(0.06, 0.42, 0.06), woodDarkM, [-w * 0.35, roofY - 0.12, d / 2 + 0.55], { noOutline: true });
    this._put(p, new THREE.CylinderGeometry(0.17, 0.14, 0.32, 8), toonMaterial(PALETTE.accent, { emissive: 0x6a3f08 }),
      [-w * 0.35, roofY - 0.46, d / 2 + 0.55], { outline: 0.05 });

    this.scene.add(p);

    // 소품은 인스턴싱으로 — 집마다 반복되므로 묶으면 효과가 크다
    const c = Math.cos(ry), s = Math.sin(ry);
    const world = (lx, lz) => [x + lx * c + lz * s, 0, z - lx * s + lz * c];
    this._barrel(...world(w / 2 + 0.55, d / 2 - 0.6));
    this._crate(...world(-w / 2 - 0.5, d / 2 - 1.0));
    if (opts.chief) this._crate(...world(-w / 2 - 0.5, d / 2 - 1.9));

    const span = Math.max(w, d);
    this.collision.addBox(x, z, span, span, 0, roofY);
  }

  _well(x, z) {
    const p = new THREE.Group();
    p.position.set(x, 0, z);
    const stoneM = toonMaterial(0xffffff, { map: this.tex.stone, repeat: [3, 1] });
    const woodM = toonMaterial(0xffffff, { map: this.tex.wood, repeat: [1, 2] });
    const roofM = toonMaterial(0xffffff, { map: this.tex.roof, repeat: [3, 2] });

    this._put(p, new THREE.CylinderGeometry(1.3, 1.4, 0.22, 16), toonMaterial(0x8a857c, { map: this.tex.stone, repeat: [3, 1] }), [0, 0.11, 0], { outline: 0.022 });
    this._put(p, new THREE.CylinderGeometry(1.05, 1.12, 0.8, 16), stoneM, [0, 0.6, 0], { outline: 0.022 });
    this._put(p, new THREE.TorusGeometry(1.05, 0.09, 6, 18), toonMaterial(PALETTE.stoneDark), [0, 1.0, 0], { rot: [Math.PI / 2, 0, 0], noOutline: true });

    const water = new THREE.Mesh(new THREE.CircleGeometry(0.94, 18), toonMaterial(0x2f6a86));
    water.rotation.x = -Math.PI / 2;
    water.position.y = 0.8;
    p.add(water);

    for (const s of [-1, 1]) {
      this._put(p, new THREE.BoxGeometry(0.17, 1.8, 0.17), woodM, [s * 0.88, 1.85, 0], { outline: 0.04 });
      this._put(p, new THREE.BoxGeometry(0.1, 0.8, 0.1), woodM, [s * 0.62, 2.32, 0], { rot: [0, 0, s * 0.62], noOutline: true });
    }
    this._put(p, new THREE.CylinderGeometry(0.13, 0.13, 2.0, 8), woodM, [0, 2.72, 0], { rot: [0, 0, Math.PI / 2], outline: 0.05 });
    this._put(p, new THREE.ConeGeometry(1.95, 0.6, 4), roofM, [0, 3.08, 0], { rot: [0, Math.PI / 4, 0], outline: 0.022 });
    this._put(p, new THREE.ConeGeometry(1.3, 0.52, 4), toonMaterial(0x9aa8a8, { map: this.tex.roof, repeat: [2, 2] }), [0, 3.46, 0], { rot: [0, Math.PI / 4, 0], outline: 0.028 });
    this._put(p, new THREE.SphereGeometry(0.15, 8, 6), toonMaterial(PALETTE.accent), [0, 3.78, 0], { outline: 0.06 });
    this._put(p, new THREE.CylinderGeometry(0.23, 0.21, 0.34, 8), woodM, [0, 1.62, 0], { outline: 0.05 });

    this.scene.add(p);
    this.collision.addBox(x, z, 2.5, 2.5, 0, 2.8);
  }

  /** 좌판 — 천막이 있으면 광장이 장터로 읽힌다 */
  _stall(x, z, ry, clothColor) {
    const p = new THREE.Group();
    p.position.set(x, 0, z);
    p.rotation.y = ry;
    const woodM = toonMaterial(0xffffff, { map: this.tex.wood, repeat: [1, 2] });

    for (const sx of [-1, 1]) for (const sz of [-1, 1])
      this._put(p, new THREE.BoxGeometry(0.12, 2.0, 0.12), woodM, [sx * 1.3, 1.0, sz * 0.75], { noOutline: true });

    this._put(p, new THREE.BoxGeometry(2.9, 0.12, 1.7), woodM, [0, 1.0, 0], { outline: 0.03 });
    // 천막 — 살짝 기울여 늘어진 느낌
    this._put(p, new THREE.BoxGeometry(3.3, 0.09, 2.1), toonMaterial(clothColor), [0, 2.06, 0], { rot: [0.1, 0, 0], outline: 0.025 });
    this._put(p, new THREE.BoxGeometry(3.3, 0.4, 0.07), toonMaterial(clothColor), [0, 1.92, 1.05], { noOutline: true });

    // 좌판 위 물건
    for (let i = 0; i < 4; i++) {
      const bx = -1.0 + i * 0.66;
      this._put(p, new THREE.SphereGeometry(0.17, 8, 6),
        toonMaterial([0xc0392b, 0xd9a441, 0x6a9a4a, 0xb8703a][i]), [bx, 1.22, -0.2], { noOutline: true });
    }
    this._put(p, new THREE.BoxGeometry(0.6, 0.3, 0.5), woodM, [0.9, 1.21, 0.35], { noOutline: true });

    this.scene.add(p);
    this.collision.addBox(x, z, 3.0, 1.9, 0, 2.2);
  }

  _noticeBoard(x, z, ry) {
    const p = new THREE.Group();
    p.position.set(x, 0, z);
    p.rotation.y = ry;
    const woodM = toonMaterial(0xffffff, { map: this.tex.wood, repeat: [1, 2] });

    for (const sx of [-1, 1])
      this._put(p, new THREE.BoxGeometry(0.13, 2.0, 0.13), woodM, [sx * 0.7, 1.0, 0], { noOutline: true });
    this._put(p, new THREE.BoxGeometry(1.8, 1.1, 0.1), toonMaterial(0xc8b896, { map: this.tex.wood, repeat: [2, 1] }), [0, 1.55, 0.04], { outline: 0.03 });
    this._put(p, new THREE.BoxGeometry(2.0, 0.14, 0.16), woodM, [0, 2.18, 0], { noOutline: true });
    for (const [px, py] of [[-0.4, 1.7], [0.35, 1.5], [0.1, 1.9]])
      this._put(p, new THREE.BoxGeometry(0.42, 0.34, 0.02), toonMaterial(0xf0e8d4), [px, py, 0.1], { noOutline: true, cast: false });

    this.scene.add(p);
    this.collision.addBox(x, z, 1.9, 0.5, 0, 2.2);
  }

  /** 담장 — 두 점을 잇는 말뚝 울타리 */
  _fence([x1, z1], [x2, z2]) {
    const dx = x2 - x1, dz = z2 - z1;
    const len = Math.hypot(dx, dz);
    const ang = Math.atan2(dx, dz);
    const n = Math.max(2, Math.round(len / 1.5));
    const woodM = toonMaterial(0xffffff, { map: this.tex.wood, repeat: [1, 1] });
    const postGeo = new THREE.BoxGeometry(0.13, 1.15, 0.13);
    const railGeo = new THREE.BoxGeometry(0.08, 0.09, 1.5);

    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const px = x1 + dx * t, pz = z1 + dz * t;
      this.batch.add(postGeo, woodM, [px, 0.57, pz], [0, ang + (Math.random() - 0.5) * 0.1, 0]);
      if (i < n) {
        const mx = x1 + dx * (t + 0.5 / n), mz = z1 + dz * (t + 0.5 / n);
        for (const hy of [0.42, 0.86])
          this.batch.add(railGeo, woodM, [mx, hy, mz], [0, ang, 0], [1, 1, len / n / 1.5]);
      }
    }
    this.collision.addBox((x1 + x2) / 2, (z1 + z2) / 2, Math.abs(dx) + 0.4, Math.abs(dz) + 0.4, 0, 1.2);
  }

  /** 빨래줄 — 사람이 산다는 가장 값싼 신호 */
  _laundry(x, z, ry) {
    const p = new THREE.Group();
    p.position.set(x, 0, z);
    p.rotation.y = ry;
    const woodM = toonMaterial(0xffffff, { map: this.tex.wood, repeat: [1, 2] });

    for (const sx of [-1, 1])
      this._put(p, new THREE.BoxGeometry(0.1, 2.2, 0.1), woodM, [sx * 2.2, 1.1, 0], { noOutline: true });
    this._put(p, new THREE.BoxGeometry(4.4, 0.035, 0.035), toonMaterial(0x8a7a5a), [0, 2.14, 0], { noOutline: true, cast: false });

    const colors = [0xd8d0c0, 0x8aa8c4, 0xd8b878, 0xb85c4a];
    for (let i = 0; i < 4; i++)
      this._put(p, new THREE.BoxGeometry(0.6, 0.75, 0.03), toonMaterial(colors[i]),
        [-1.6 + i * 1.05, 1.72, 0], { rot: [0, 0, (Math.random() - 0.5) * 0.12], noOutline: true });

    this.scene.add(p);
  }

  _barrel(x, y, z) {
    const woodM = toonMaterial(0xffffff, { map: this.tex.wood, repeat: [1, 1] });
    this.batch.add(new THREE.CylinderGeometry(0.32, 0.29, 0.66, 10), woodM, [x, 0.33, z], [0, Math.random() * 3, 0]);
  }

  _crate(x, y, z) {
    const woodM = toonMaterial(0xc0a884, { map: this.tex.wood, repeat: [1, 1] });
    this.batch.add(new THREE.BoxGeometry(0.55, 0.55, 0.55), woodM, [x, 0.28, z], [0, Math.random() * 3, 0]);
  }

  _limestone(x, z, scale) {
    const p = new THREE.Group();
    p.position.set(x, 0, z);
    const m = toonMaterial(0xffffff, { map: this.tex.limestone, repeat: [2, 2] });

    this._put(p, new THREE.DodecahedronGeometry(scale, 0), m, [0, scale * 0.55, 0],
      { rot: [Math.random() * 0.4, Math.random() * Math.PI, Math.random() * 0.3], outline: 0.022 });
    this._put(p, new THREE.DodecahedronGeometry(scale * 0.55, 0), toonMaterial(0xbdb49c, { map: this.tex.limestone, repeat: [1, 1] }),
      [scale * 0.5, scale * 0.25, scale * 0.4], { rot: [Math.random(), Math.random(), Math.random()], noOutline: true });

    this.scene.add(p);
    this.collision.addBox(x, z, scale * 1.5, scale * 1.5, 0, scale * 1.4);
  }

  // ================= 자연 =================

  _buildNature() {
    const spots = [
      [-22, 4, 1.15], [21, 5, 1.0], [-20, -15, 1.08], [22, -16, 1.2],
      [-9, 30, 1.25], [10, 32, 0.95], [-30, -34, 1.05], [30, 28, 1.12],
      [-34, 14, 1.0], [35, -26, 1.18], [-12, -34, 0.95], [13, -36, 1.06],
      [-38, -8, 1.1], [37, 12, 0.98], [-5, 38, 1.14], [26, 20, 0.92],
      [-28, 24, 1.02], [18, -30, 1.08],
    ];
    for (const [x, z, s] of spots) this._tree(x, z, s);
  }

  /**
   * 나무. 잎을 공 하나로 두면 "막대에 꽂힌 구슬"이 된다.
   * 뿌리 → 줄기 → 가지 → 크기와 높이가 다른 잎 덩어리 5개로 실루엣을 만든다.
   */
  _tree(x, z, scale) {
    const p = new THREE.Group();
    p.position.set(x, 0, z);
    p.rotation.y = Math.random() * Math.PI * 2;
    p.scale.setScalar(scale);

    const h = 3.1 + Math.random() * 0.8;
    const trunkM = toonMaterial(0xffffff, { map: this.tex.wood, repeat: [2, 3] });
    const leafM = toonMaterial(0xffffff, { map: this.tex.leaf, repeat: [2, 2] });
    const leafDarkM = toonMaterial(0xa8c898, { map: this.tex.leaf, repeat: [2, 2] });
    const leafLitM = toonMaterial(0xd8e8c0, { map: this.tex.leaf, repeat: [2, 2] });

    // 뿌리 — 밑동을 벌려 땅을 붙잡게
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + Math.random() * 0.4;
      this._put(p, new THREE.ConeGeometry(0.18, 0.6, 5), trunkM,
        [Math.sin(a) * 0.3, 0.22, Math.cos(a) * 0.3],
        { rot: [Math.cos(a) * 0.5, 0, -Math.sin(a) * 0.5], noOutline: true });
    }

    this._put(p, new THREE.CylinderGeometry(0.18, 0.36, h, 8), trunkM, [0, h / 2, 0], { outline: 0.032 });

    const tips = [];
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + Math.random() * 0.7;
      const by = h * (0.55 + i * 0.13);
      const bl = 0.8 + Math.random() * 0.4;
      const bx = Math.sin(a) * bl * 0.6, bz = Math.cos(a) * bl * 0.6;
      this._put(p, new THREE.CylinderGeometry(0.07, 0.13, bl, 6), trunkM,
        [bx, by + bl * 0.22, bz], { rot: [Math.cos(a) * 0.72, 0, -Math.sin(a) * 0.72], outline: 0.05 });
      tips.push([bx * 1.5, by + bl * 0.6, bz * 1.5]);
    }

    const cy = h + 0.6;
    for (const [cx, ccy, cz, r, mat] of [
      [0, cy, 0, 1.5, leafM],
      [0.9, cy + 0.44, -0.38, 1.0, leafLitM],
      [-0.76, cy + 0.22, 0.58, 1.06, leafDarkM],
      [0.28, cy + 0.9, 0.48, 0.82, leafLitM],
      [-0.48, cy - 0.34, -0.76, 0.9, leafDarkM],
    ]) {
      this._put(p, new THREE.IcosahedronGeometry(r, 1), mat, [cx, ccy, cz],
        { rot: [Math.random(), Math.random(), Math.random()], scale: [1, 0.82, 1], outline: 0.026 });
    }

    for (const [bx, by, bz] of tips)
      this._put(p, new THREE.IcosahedronGeometry(0.52, 0), leafDarkM, [bx, by, bz],
        { rot: [Math.random(), Math.random(), Math.random()], noOutline: true });

    this.scene.add(p);
    this.collision.addBox(x, z, 0.72 * scale, 0.72 * scale, 0, h * scale);
  }

  // ================= 잔물건 (전부 인스턴싱) =================

  /**
   * 풀·꽃·자갈. 개별 메시로 두면 수백 드로우콜이지만 인스턴싱하면 3~4회다.
   * 물체와 땅이 만나는 자리를 메워야 장난감처럼 안 보인다.
   */
  _buildScatter() {
    const bladeGeo = new THREE.ConeGeometry(0.06, 0.4, 3);
    const grassA = toonMaterial(PALETTE.leafC);
    const grassB = toonMaterial(PALETTE.leafA);
    const pebbleGeo = new THREE.DodecahedronGeometry(0.14, 0);
    const pebbleM = toonMaterial(0xffffff, { map: this.tex.stone, repeat: [1, 1] });
    const flowerGeo = new THREE.SphereGeometry(0.09, 6, 5);
    const flowerM = [toonMaterial(0xe8d0e0), toonMaterial(0xf0e0a0), toonMaterial(0xd8a0b0)];
    const bushGeo = new THREE.IcosahedronGeometry(0.42, 0);
    const bushM = toonMaterial(0xffffff, { map: this.tex.leaf, repeat: [1, 1] });

    const n = (base) => Math.round(base * this.density);

    // 풀 포기 — 한 포기에 잎 3장
    for (let i = 0; i < n(560); i++) {
      const [x, z] = this._scatterPoint(13, 48);
      for (let b = 0; b < 3; b++)
        this.batch.add(bladeGeo, Math.random() > 0.5 ? grassA : grassB,
          [x + (Math.random() - 0.5) * 0.3, 0.2, z + (Math.random() - 0.5) * 0.3],
          [0, Math.random() * 3, (Math.random() - 0.5) * 0.5],
          0.8 + Math.random() * 0.6);
    }

    for (let i = 0; i < n(240); i++) {
      const [x, z] = this._scatterPoint(11, 50);
      this.batch.add(pebbleGeo, pebbleM, [x, 0.06, z],
        [Math.random() * 3, Math.random() * 3, Math.random() * 3], 0.5 + Math.random() * 0.9);
    }

    for (let i = 0; i < n(150); i++) {
      const [x, z] = this._scatterPoint(14, 44);
      this.batch.add(flowerGeo, flowerM[i % 3], [x, 0.22, z], [0, 0, 0], 0.7 + Math.random() * 0.6);
      this.batch.add(bladeGeo, grassB, [x, 0.12, z], [0, 0, 0], [0.5, 0.6, 0.5]);
    }

    for (let i = 0; i < n(90); i++) {
      const [x, z] = this._scatterPoint(15, 50);
      this.batch.add(bushGeo, bushM, [x, 0.3, z],
        [Math.random(), Math.random() * 3, Math.random()], 0.7 + Math.random() * 0.9);
    }

    // 광장 포석 — 흙바닥 위에 박힌 돌
    const slabGeo = new THREE.CylinderGeometry(0.32, 0.34, 0.06, 6);
    for (let i = 0; i < n(70); i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * 11;
      this.batch.add(slabGeo, pebbleM, [Math.sin(a) * r, 0.05, Math.cos(a) * r], [0, Math.random() * 3, 0],
        0.8 + Math.random() * 0.7);
    }

    // 광장 경계석
    for (let i = 0; i < 34; i++) {
      const a = (i / 34) * Math.PI * 2;
      this.batch.add(pebbleGeo, pebbleM, [Math.sin(a) * 12.2, 0.14, Math.cos(a) * 12.2],
        [Math.random(), Math.random() * 3, Math.random()], 1.6 + Math.random() * 0.7);
    }
  }

  /** 마을 안쪽(광장)을 피해 도넛 모양으로 흩뿌린다 */
  _scatterPoint(rMin, rMax) {
    const a = Math.random() * Math.PI * 2;
    const r = rMin + Math.sqrt(Math.random()) * (rMax - rMin);
    return [Math.sin(a) * r, Math.cos(a) * r];
  }

  // ================= 경계 =================

  _buildBoundary() {
    // 지금은 토룡마을만 있으므로 빈 평야로 나가지 않게 막는다.
    // 7단계에서 지역이 이어지면 해당 방향의 벽을 연다.
    const R = 62, seg = 18;
    for (let i = 0; i < seg; i++) {
      const a = (i / seg) * Math.PI * 2;
      this.collision.addBox(Math.sin(a) * R, Math.cos(a) * R, 28, 28, 0, 14);
    }
  }

  // ================= 공용 =================

  /** 메시 + 외곽선을 부모에 붙인다 */
  _put(parent, geo, mat, pos, opts = {}) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(pos[0], pos[1], pos[2]);
    if (opts.rot) m.rotation.set(opts.rot[0] || 0, opts.rot[1] || 0, opts.rot[2] || 0);
    if (opts.scale) m.scale.set(opts.scale[0], opts.scale[1], opts.scale[2]);
    m.castShadow = opts.cast !== false;
    m.receiveShadow = true;
    parent.add(m);
    if (!opts.noOutline) {
      const o = makeOutline(m, opts.outline ?? 0.03, this.outlines);
      if (o) parent.add(o);
    }
    return m;
  }
}
