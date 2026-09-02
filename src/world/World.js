import * as THREE from "three";
import { Collision } from "./Collision.js";
import { Terrain } from "./Terrain.js";
import { ChunkManager } from "./ChunkManager.js";
import { toonMaterial, makeOutline, setupLighting, makeSky, InstancedBatch, MergedBatch } from "../fx/Style.js";
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
    this.spawnPoint = new THREE.Vector3(0, 0, 13);

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

    // 인스턴싱(같은 모양 반복)과 병합(모양은 다르나 재질이 같음)을 각각 모았다가
    // 마지막에 한 번에 만든다. 둘 다 드로우콜을 줄이는 장치다.
    this.batch = new InstancedBatch();
    this.merged = new MergedBatch();
    // 인스턴싱은 (지오메트리, 재질)이 같은 것만 묶는다. 호출할 때마다 새 지오메트리를
    // 만들면 모양이 같아도 따로 그려지므로, 반복되는 소품은 여기서 공유한다.
    this._geoCache = new Map();

    this.sky = makeSky(scene, device, PALETTE);
    this.lights = setupLighting(scene, device);

    // 지형은 시드 하나에서 나온다. 이것만 저장하면 세계 전체가 복원된다.
    this.terrain = new Terrain();
    this.chunks = new ChunkManager(scene, this.terrain, this.collision, {
      tex: this.tex,
      geoCache: (k, f) => this._geo(k, f),
      density: this.density,
      outlines: this.outlines,
      tier: device.tierName,
    });

    this._buildGround();
    this._buildVillage();
    this._buildWilderness();
    this._buildNature();
    this._buildScatter();
    this._buildBoundary();

    const inst = this.batch.build(scene);
    const merge = this.merged.build(scene);
    this.stats = {
      drawCalls: inst.drawCalls + merge.drawCalls,
      instances: inst.instances,
      mergedFrom: merge.source,
      chunks: this.chunks.stats,
    };

    // 시작 지점 주변은 미리 만들어 둔다. 안 그러면 시작하자마자
    // 허공에 떠 있다가 땅이 생긴다.
    this.chunks.preload(this.spawnPoint.x, this.spawnPoint.z, 2);
  }

  /** 그림자 카메라와 하늘을 플레이어 근처로 옮긴다 (프레임당 1회) */
  followLight(x, z, y = 0) {
    this.lights?.key?.userData?.follow?.(x, z);
    this.sky?.userData?.follow?.(x, y, z);
  }

  /** 플레이어를 따라 청크를 만들고 버린다 (프레임당 1회) */
  streamAround(x, z) {
    this.chunks.update(x, z);
  }

  /** 이 자리의 지면 높이 — 플레이어·적이 발을 디딜 곳 */
  heightAt(x, z) { return this.terrain.heightAt(x, z); }

  /** 이 자리의 바이옴 */
  biomeAt(x, z) { return this.terrain.biomeAt(x, z); }

  // ================= 지형 =================

  _buildGround() {
    // 풀밭 판을 따로 깔지 않는다.
    //
    // 예전에는 560m 판 하나로 온 땅을 덮었지만, 청크가 자기 지형을 만들면서
    // 마을 안(높이 0으로 고정된 구역)에서 두 면이 정확히 같은 높이에 겹쳤다.
    // 깊이값이 똑같으니 어느 쪽을 그릴지 매 픽셀 갈팡질팡해서 땅이
    // 얼룩덜룩하게 깜빡였다(z-파이팅). 판을 줄여도 경계선만 옮길 뿐이다.
    //
    // 그래서 풀밭은 청크에게 온전히 맡기고, 마을은 그 위에 얹는 것만 그린다.
    // 광장·길은 y=0.02 이상에 있어 청크 지형 위에 정상적으로 덮인다.

    // 광장 — 흙바닥
    const plaza = new THREE.Mesh(
      new THREE.CircleGeometry(16, 48),
      toonMaterial(0xffffff, { map: this.tex.dirt, repeat: [9, 9] })
    );
    plaza.rotation.x = -Math.PI / 2;
    plaza.position.y = 0.02;
    plaza.receiveShadow = true;
    this.scene.add(plaza);

    // 길 — 광장에서 세 방향. 나중에 다른 지역으로 이어질 자리를 암시한다
    for (const [angle, len] of [[0, 118], [Math.PI * 0.5, 96], [Math.PI, 88], [Math.PI * 1.5, 96]]) {
      const road = new THREE.Mesh(
        new THREE.PlaneGeometry(5, len),
        toonMaterial(0xffffff, { map: this.tex.dirt, repeat: [2, len / 4] })
      );
      road.rotation.x = -Math.PI / 2;
      road.rotation.z = -angle;
      road.position.set(Math.sin(angle) * (len / 2 + 13), 0.03, Math.cos(angle) * (len / 2 + 13));
      road.updateMatrixWorld(true);
      this.merged.add(road.geometry, road.material, road.matrixWorld);
      road.geometry.dispose();
    }

    // 언덕 — 완전한 평지는 화면을 비어 보이게 만든다
    const hillMat = toonMaterial(0xffffff, { map: this.tex.grass, repeat: [8, 8] });
    for (const [x, z, r, h] of [
      [-118, -92, 30, 6.0], [104, -112, 34, 7.2], [-128, 84, 32, 6.6],
      [116, 96, 28, 5.4], [-44, -150, 38, 8.0], [-52, 132, 30, 5.6], [78, 138, 26, 5.0],
      [150, -40, 34, 7.0], [-152, -30, 32, 6.4], [60, -150, 30, 6.2],
    ]) {
      const hill = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 10), hillMat);
      hill.position.set(x, -r + h, z);
      hill.updateMatrixWorld(true);
      this.merged.add(hill.geometry, hillMat, hill.matrixWorld);
      hill.geometry.dispose();
    }
  }

  // ================= 마을 =================

  /**
   * 토룡마을 — 지름 130m, 22채, 5개 구역.
   *
   * 구역을 나누는 이유는 심부름에 거리와 목적지를 주기 위해서다.
   * 광장 하나에 NPC가 몰려 서 있으면 인(P)의 택배 배송 퀘스트가 성립하지 않는다.
   *
   *        [석회암 동굴]           [주거 구역]
   *         칼슘의 기도처            촌장 집·주민 집
   *                  ╲             ╱
   *                   ╲  [광장]   ╱
   *                   ╱          ╲
   *          [공방 구역]        [농경지]
   *          대안통운·대장간      밭·헛간
   */
  _buildVillage() {
    this._plazaDistrict();
    this._residentialDistrict();
    this._workshopDistrict();
    this._farmDistrict();
    this._limestoneDistrict();
  }

  // ---- 중앙 광장 (반경 0~16) ----
  _plazaDistrict() {
    this._well(0, 0);

    this._stall(-8.5, 7.5, 0.42, PALETTE.cloth);
    this._stall(8.8, 6.6, -0.36, PALETTE.clothAlt);
    this._stall(-7.5, 12.5, Math.PI - 0.3, PALETTE.cloth);
    this._noticeBoard(5.0, -9.5, -0.26);

    // 광장을 둘러싼 가게 3채 — 등지고 서서 광장의 벽이 된다
    this._house(-15, 12, 4.6, 3.0, 4.2, -0.62);
    this._house(15, 11, 4.4, 2.9, 4.0, 0.58);
    this._house(-10, 20, 4.8, 3.1, 4.4, Math.PI - 0.4);

    this._laundry(-11, 6.5, 0.22);
  }

  // ---- 주거 구역 (북, z −24 ~ −52) ----
  _residentialDistrict() {
    // 촌장의 집 — 가장 크고 지붕 색이 다르다
    this._house(0, -52, 7.6, 4.1, 6.0, 0, { chief: true });

    this._house(-16, -30, 4.8, 3.1, 4.4, 0.36);
    this._house(15, -31, 4.6, 3.0, 4.2, -0.3);
    this._house(-21, -45, 4.4, 2.9, 4.0, 0.72);
    this._house(20, -46, 4.6, 3.0, 4.2, -0.66);
    this._house(-15, -58, 4.2, 2.8, 3.8, 0.42);
    this._house(15, -59, 4.4, 2.9, 4.0, -0.46);

    this._fence([-11, -26], [-4, -26]);
    this._fence([4, -26], [11, -26]);
    this._fence([-27, -38], [-27, -30]);
    this._fence([27, -39], [27, -31]);

    this._laundry(-16, -37, 0.2);
    this._laundry(16.5, -38, -0.28);
  }

  // ---- 공방 구역 (서남, x −26 ~ −52) ----
  _workshopDistrict() {
    // 대안통운 물류창고 — 인(P)의 일터. 배송 퀘스트의 출발점이다
    this._warehouse(-40, 26, 0.3);

    this._house(-30, 14, 5.0, 3.2, 4.6, 0.4);   // 대장간
    this._house(-46, 14, 4.4, 2.9, 4.0, 0.9);
    this._house(-33, 36, 4.6, 3.0, 4.2, -0.5);
    this._house(-50, 30, 4.2, 2.8, 3.8, 1.15);

    this._fence([-26, 20], [-26, 30]);
    this._fence([-36, 8], [-28, 8]);

    // 대장간 앞 자재 더미
    for (const [bx, bz] of [[-26.5, 17], [-25.5, 18.6], [-27.5, 18.2]])
      this._crate(bx, 0, bz);
  }

  // ---- 농경지 (동남, x 26 ~ 54) ----
  _farmDistrict() {
    this._house(30, 16, 4.6, 3.0, 4.2, -0.42);  // 농가
    this._house(47, 24, 4.4, 2.9, 4.0, -0.95);
    this._barn(38, 38, -0.24);

    // 밭 — 이랑을 그어 농지로 읽히게 한다
    this._field(34, 27, 12, 9, -0.24);
    this._field(50, 38, 10, 8, -0.24);

    this._fence([26, 20], [26, 32]);
    this._fence([30, 46], [42, 46]);
  }

  // ---- 석회암 동굴 (서북, x −30 ~ −56 / z −20 ~ −44) ----
  _limestoneDistrict() {
    this._limestone(-40, -30, 4.4);
    this._limestone(-34, -36, 2.8);
    this._limestone(-47, -24, 3.2);
    this._limestone(-36, -23, 2.0);
    this._limestone(-52, -34, 3.6);
    this._limestone(-44, -41, 2.4);

    // 동굴 입구 — 지금은 막혀 있고, 후반 던전에서 열린다
    this._caveMouth(-43, -34, 0.6);

    // 칼슘이 기도하러 오는 곳이라는 단서
    this._shrine(-37, -28, -0.4);
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

    const stoneM = toonMaterial(0xffffff, { map: this.tex.stone, repeat: [2.5, 0.5] });
    const plasterM = toonMaterial(0xffffff, { map: this.tex.plaster, repeat: [1.8, 1.2] });
    const woodM = toonMaterial(0xffffff, { map: this.tex.wood, repeat: [1, 2] });
    const woodDarkM = toonMaterial(0xa88a6a, { map: this.tex.wood, repeat: [1, 2] });
    const roofM = toonMaterial(0xffffff, { map: opts.chief ? this.tex.roofAlt : this.tex.roof, repeat: [4, 3] });
    const roofDarkM = toonMaterial(0x9aa8a8, { map: opts.chief ? this.tex.roofAlt : this.tex.roof, repeat: [3, 2] });

    // 기단
    this._put(p, new THREE.BoxGeometry(w + 0.55, 0.34, d + 0.55), stoneM, [0, 0.17, 0], { outline: 0.02 });
    this._put(p, new THREE.BoxGeometry(w + 0.28, 0.44, d + 0.28), stoneM, [0, 0.52, 0], { outline: 0.02 });

    // 벽 — 아래를 어둡게 해서 층을 만든다
    const wallBase = 0.74;
    this._put(p, new THREE.BoxGeometry(w, h * 0.4, d), toonMaterial(0xd8cdb6, { map: this.tex.plaster, repeat: [1.8, 0.7] }),
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

    this._mergeGroup(p);

    // 소품은 인스턴싱으로 — 집마다 반복되므로 묶으면 효과가 크다
    const c = Math.cos(ry), s = Math.sin(ry);
    const world = (lx, lz) => [x + lx * c + lz * s, 0, z - lx * s + lz * c];
    this._barrel(...world(w / 2 + 0.55, d / 2 - 0.6));
    this._crate(...world(-w / 2 - 0.5, d / 2 - 1.0));
    if (opts.chief) this._crate(...world(-w / 2 - 0.5, d / 2 - 1.9));

    // 충돌은 벽면(w × d)에 바짝 맞춘다. 석재 기단까지 감싸면 벽에서 0.6m나
    // 떨어진 곳에서 막혀 답답하다. 기단에 발끝이 살짝 겹치는 편이 자연스럽다.
    // 회전을 그대로 넘겨야 비스듬히 놓인 집의 벽과 어긋나지 않는다.
    this.collision.addBox(x, z, w + 0.2, d + 0.2, 0, roofY, ry);
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

    this._mergeGroup(p);
    this.collision.addBox(x, z, 2.2, 2.2, 0, 2.8);
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

    this._mergeGroup(p);
    this.collision.addBox(x, z, 2.9, 1.7, 0, 2.2, ry);
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

    this._mergeGroup(p);
    this.collision.addBox(x, z, 1.8, 0.4, 0, 2.2, ry);
  }

  /** 담장 — 두 점을 잇는 말뚝 울타리 */
  _fence([x1, z1], [x2, z2]) {
    const dx = x2 - x1, dz = z2 - z1;
    const len = Math.hypot(dx, dz);
    const ang = Math.atan2(dx, dz);
    const n = Math.max(2, Math.round(len / 1.5));
    const woodM = toonMaterial(0xffffff, { map: this.tex.wood, repeat: [1, 1] });
    const postGeo = this._geo("fencePost", () => new THREE.BoxGeometry(0.13, 1.15, 0.13));
    const railGeo = this._geo("fenceRail", () => new THREE.BoxGeometry(0.08, 0.09, 1.5));

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
    this.collision.addBox((x1 + x2) / 2, (z1 + z2) / 2, 0.3, len, 0, 1.15, ang);
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

    this._mergeGroup(p);
  }

  _barrel(x, y, z) {
    const woodM = toonMaterial(0xffffff, { map: this.tex.wood, repeat: [1, 1] });
    const geo = this._geo("barrel", () => new THREE.CylinderGeometry(0.32, 0.29, 0.66, 10));
    this.batch.add(geo, woodM, [x, 0.33, z], [0, Math.random() * 3, 0]);
  }

  _crate(x, y, z) {
    const woodM = toonMaterial(0xc0a884, { map: this.tex.wood, repeat: [1, 1] });
    const geo = this._geo("crate", () => new THREE.BoxGeometry(0.55, 0.55, 0.55));
    this.batch.add(geo, woodM, [x, 0.28, z], [0, Math.random() * 3, 0]);
  }

  /** 대안통운 물류창고 — 인(P)의 일터. 배송 퀘스트가 여기서 시작된다 */
  _warehouse(x, z, ry) {
    const p = new THREE.Group();
    p.position.set(x, 0, z);
    p.rotation.y = ry;

    const w = 11, h = 4.4, d = 7;
    const stoneM = toonMaterial(0xffffff, { map: this.tex.stone, repeat: [4, 0.5] });
    const woodM = toonMaterial(0xffffff, { map: this.tex.wood, repeat: [1, 2] });
    const woodDarkM = toonMaterial(0xa88a6a, { map: this.tex.wood, repeat: [1, 2] });
    const wallM = toonMaterial(0xc9b89a, { map: this.tex.wood, repeat: [5, 2] });
    const roofM = toonMaterial(0x8a9a9a, { map: this.tex.roof, repeat: [6, 3] });

    this._put(p, new THREE.BoxGeometry(w + 0.5, 0.36, d + 0.5), stoneM, [0, 0.18, 0], { outline: 0.02 });
    this._put(p, new THREE.BoxGeometry(w, h, d), wallM, [0, 0.36 + h / 2, 0], { outline: 0.016 });

    // 창고는 가로로 길어서 기둥을 촘촘히 세워야 벽이 늘어져 보이지 않는다
    for (let i = -2; i <= 2; i++)
      for (const sz of [-1, 1])
        this._put(p, new THREE.BoxGeometry(0.2, h, 0.16), woodM,
          [i * (w / 5), 0.36 + h / 2, sz * (d / 2 - 0.05)], { noOutline: true });
    for (const sz of [-1, 1])
      this._put(p, new THREE.BoxGeometry(w, 0.2, 0.14), woodDarkM, [0, 0.36 + h - 0.12, sz * (d / 2 - 0.02)], { noOutline: true });

    // 박공 지붕 — 살림집의 사각뿔과 달리 길게 뻗은 형태로 용도를 구분한다
    for (const s of [-1, 1])
      this._put(p, new THREE.BoxGeometry(w + 1.2, 0.22, d * 0.62), roofM,
        [0, 0.36 + h + 0.62, s * d * 0.26], { rot: [s * 0.62, 0, 0], outline: 0.02 });
    this._put(p, new THREE.BoxGeometry(w + 1.4, 0.26, 0.34), toonMaterial(PALETTE.roofRidge),
      [0, 0.36 + h + 1.22, 0], { noOutline: true });

    // 큰 짐문
    this._put(p, new THREE.BoxGeometry(3.4, 3.0, 0.12), woodDarkM, [0, 1.86, d / 2 + 0.03], { noOutline: true });
    this._put(p, new THREE.BoxGeometry(1.5, 2.7, 0.08), woodM, [-0.82, 1.76, d / 2 + 0.08], { noOutline: true });
    this._put(p, new THREE.BoxGeometry(1.5, 2.7, 0.08), woodM, [0.82, 1.76, d / 2 + 0.08], { noOutline: true });

    // 간판
    this._put(p, new THREE.BoxGeometry(3.2, 0.8, 0.1), toonMaterial(0x8a5a2a, { map: this.tex.wood, repeat: [3, 1] }),
      [0, 4.0, d / 2 + 0.1], { outline: 0.03 });
    this._put(p, new THREE.BoxGeometry(2.4, 0.16, 0.04), toonMaterial(PALETTE.accent), [0, 4.12, d / 2 + 0.17], { noOutline: true });
    this._put(p, new THREE.BoxGeometry(1.8, 0.14, 0.04), toonMaterial(PALETTE.accent), [0, 3.88, d / 2 + 0.17], { noOutline: true });

    this._mergeGroup(p);

    // 하역장 짐더미
    const c = Math.cos(ry), s = Math.sin(ry);
    const world = (lx, lz) => [x + lx * c + lz * s, 0, z - lx * s + lz * c];
    for (const [lx, lz] of [[-3.2, 4.8], [-2.4, 5.6], [-3.4, 6.2], [3.0, 5.0], [3.8, 5.9]])
      this._crate(...world(lx, lz));
    this._barrel(...world(4.6, 4.4));

    this.collision.addBox(x, z, w + 0.2, d + 0.2, 0, 0.36 + h, ry);
  }

  /** 헛간 — 농경지의 중심. 창고보다 작고 지붕이 붉다 */
  _barn(x, z, ry) {
    const p = new THREE.Group();
    p.position.set(x, 0, z);
    p.rotation.y = ry;

    const w = 7, h = 3.8, d = 5.4;
    const wallM = toonMaterial(0xb85c4a, { map: this.tex.wood, repeat: [4, 2] });
    const woodM = toonMaterial(0xffffff, { map: this.tex.wood, repeat: [1, 2] });
    const roofM = toonMaterial(0x7a6a58, { map: this.tex.roof, repeat: [5, 3] });

    this._put(p, new THREE.BoxGeometry(w + 0.4, 0.3, d + 0.4),
      toonMaterial(0xffffff, { map: this.tex.stone, repeat: [3, 0.5] }), [0, 0.15, 0], { outline: 0.02 });
    this._put(p, new THREE.BoxGeometry(w, h, d), wallM, [0, 0.3 + h / 2, 0], { outline: 0.016 });

    // 흰 목재 X자 — 헛간의 상징
    for (const sx of [-1, 1])
      this._put(p, new THREE.BoxGeometry(0.16, h * 0.9, 0.12), toonMaterial(0xe8e0d0),
        [0, 0.3 + h / 2, d / 2 + 0.02], { rot: [0, 0, sx * 0.62], noOutline: true });
    for (const sx of [-1, 1]) for (const sz of [-1, 1])
      this._put(p, new THREE.BoxGeometry(0.18, h, 0.14), woodM,
        [sx * (w / 2 - 0.06), 0.3 + h / 2, sz * (d / 2 - 0.05)], { noOutline: true });

    for (const s of [-1, 1])
      this._put(p, new THREE.BoxGeometry(w + 0.9, 0.2, d * 0.66), roofM,
        [0, 0.3 + h + 0.56, s * d * 0.28], { rot: [s * 0.6, 0, 0], outline: 0.02 });
    this._put(p, new THREE.BoxGeometry(w + 1.1, 0.24, 0.3), toonMaterial(PALETTE.roofRidge),
      [0, 0.3 + h + 1.1, 0], { noOutline: true });

    this._put(p, new THREE.BoxGeometry(2.2, 2.4, 0.1), toonMaterial(0x5a3a2a, { map: this.tex.wood, repeat: [2, 2] }),
      [0, 1.5, d / 2 + 0.03], { noOutline: true });

    this._mergeGroup(p);

    // 건초더미
    const c = Math.cos(ry), s = Math.sin(ry);
    const hayM = toonMaterial(0xc8a850);
    for (const [lx, lz] of [[-4.4, 3.2], [-3.4, 4.2], [4.2, 3.4]])
      this.batch.add(this._geo("hay", () => new THREE.CylinderGeometry(0.62, 0.62, 0.9, 10)), hayM,
        [x + lx * c + lz * s, 0.45, z - lx * s + lz * c], [Math.PI / 2, Math.random() * 3, 0]);

    this.collision.addBox(x, z, w + 0.2, d + 0.2, 0, 0.3 + h, ry);
  }

  /** 밭 — 이랑을 그어야 농지로 읽힌다. 충돌은 걸지 않는다 (밟고 지나갈 수 있게) */
  _field(x, z, w, d, ry) {
    const p = new THREE.Group();
    p.position.set(x, 0, z);
    p.rotation.y = ry;

    const soil = new THREE.Mesh(
      new THREE.PlaneGeometry(w, d),
      toonMaterial(0x6b5535, { map: this.tex.dirt, repeat: [w / 2, d / 2] })
    );
    soil.rotation.x = -Math.PI / 2;
    soil.position.y = 0.04;
    soil.receiveShadow = true;
    p.add(soil);
    this._mergeGroup(p);

    // 이랑과 작물 — 인스턴싱이라 개수를 늘려도 드로우콜은 그대로
    const c = Math.cos(ry), s = Math.sin(ry);
    const ridgeGeo = this._geo("fieldRidge", () => new THREE.BoxGeometry(0.5, 0.16, 1));
    const ridgeM = toonMaterial(0x7d6540, { map: this.tex.dirt, repeat: [1, 1] });
    const cropGeo = this._geo("crop", () => new THREE.ConeGeometry(0.14, 0.42, 4));
    const cropM = toonMaterial(0x6a9a4a);

    const rows = Math.floor(w / 1.1);
    for (let i = 0; i < rows; i++) {
      const lx = -w / 2 + 0.7 + i * 1.1;
      this.batch.add(ridgeGeo, ridgeM, [x + lx * c, 0.09, z - lx * s], [0, ry, 0], [1, 1, d - 0.6]);
      const n = Math.round((d - 1) / 0.7);
      for (let j = 0; j < n; j++) {
        const lz = -d / 2 + 0.6 + j * 0.7;
        this.batch.add(cropGeo, cropM,
          [x + lx * c + lz * s, 0.28, z - lx * s + lz * c],
          [0, Math.random() * 3, 0], 0.8 + Math.random() * 0.5);
      }
    }
  }

  /** 동굴 입구 — 지금은 막혀 있다. 후반 던전에서 열린다 */
  _caveMouth(x, z, ry) {
    const p = new THREE.Group();
    p.position.set(x, 0, z);
    p.rotation.y = ry;

    const rockM = toonMaterial(0xb8ae96, { map: this.tex.limestone, repeat: [2, 2] });
    this._put(p, new THREE.DodecahedronGeometry(4.6, 0), rockM, [0, 2.2, -1.2],
      { rot: [0.2, 0.6, 0.1], outline: 0.02 });

    // 어두운 입구 — 안이 안 보이는 것이 중요하다
    this._put(p, new THREE.CylinderGeometry(1.5, 1.7, 2.8, 10, 1, false, 0, Math.PI),
      toonMaterial(0x0d1014), [0, 1.4, 1.9], { rot: [0, Math.PI, 0], noOutline: true, cast: false });
    this._put(p, new THREE.BoxGeometry(3.6, 0.5, 0.7), rockM, [0, 2.9, 1.9], { outline: 0.03 });

    for (const sx of [-1, 1])
      this._put(p, new THREE.BoxGeometry(0.7, 3.0, 0.7), rockM, [sx * 1.9, 1.5, 1.9],
        { rot: [0, 0, sx * 0.06], outline: 0.03 });

    this._mergeGroup(p);
    this.collision.addBox(x, z, 7.2, 6.0, 0, 5.0, ry);
  }

  /** 작은 제단 — 칼슘이 기도하러 오는 곳 */
  _shrine(x, z, ry) {
    const p = new THREE.Group();
    p.position.set(x, 0, z);
    p.rotation.y = ry;

    const stoneM = toonMaterial(0xffffff, { map: this.tex.limestone, repeat: [1, 1] });
    this._put(p, new THREE.CylinderGeometry(1.1, 1.3, 0.24, 8), stoneM, [0, 0.12, 0], { outline: 0.025 });
    this._put(p, new THREE.BoxGeometry(0.9, 1.0, 0.5), stoneM, [0, 0.74, 0], { outline: 0.03 });
    this._put(p, new THREE.BoxGeometry(1.2, 0.18, 0.7), stoneM, [0, 1.32, 0], { outline: 0.03 });

    // 촛불 — 누군가 다녀갔다는 표시
    for (const sx of [-1, 1]) {
      this._put(p, new THREE.CylinderGeometry(0.07, 0.07, 0.22, 6), toonMaterial(0xe8e0d0),
        [sx * 0.42, 1.52, 0.1], { noOutline: true });
      this._put(p, new THREE.SphereGeometry(0.055, 6, 5), toonMaterial(PALETTE.accent, { emissive: 0x8a5010 }),
        [sx * 0.42, 1.68, 0.1], { noOutline: true });
    }

    this._mergeGroup(p);
    this.collision.addBox(x, z, 1.6, 1.0, 0, 1.6, ry);
  }

  _limestone(x, z, scale) {
    const p = new THREE.Group();
    p.position.set(x, 0, z);
    const m = toonMaterial(0xffffff, { map: this.tex.limestone, repeat: [2, 2] });

    this._put(p, new THREE.DodecahedronGeometry(scale, 0), m, [0, scale * 0.55, 0],
      { rot: [Math.random() * 0.4, Math.random() * Math.PI, Math.random() * 0.3], outline: 0.022 });
    this._put(p, new THREE.DodecahedronGeometry(scale * 0.55, 0), toonMaterial(0xbdb49c, { map: this.tex.limestone, repeat: [1, 1] }),
      [scale * 0.5, scale * 0.25, scale * 0.4], { rot: [Math.random(), Math.random(), Math.random()], noOutline: true });

    this._mergeGroup(p);
    this.collision.addBox(x, z, scale * 1.5, scale * 1.5, 0, scale * 1.4);
  }

  // ================= 자연 =================

  _buildNature() {
    // 구역 경계와 길가에 심어 공간을 나눈다. 건물 사이를 그냥 비워두면
    // 마을이 아니라 흩어진 모형처럼 보인다.
    const spots = [
      // 광장 둘레
      [-21, 5, 1.15], [20, 4, 1.0], [-19, -16, 1.08], [21, -17, 1.2],
      [-8, 24, 1.05], [9, 25, 0.95], [22, 2, 1.1], [-23, -6, 1.02],
      // 주거 구역
      [-26, -34, 1.12], [25, -35, 1.05], [-12, -64, 1.18], [13, -65, 1.08],
      [-30, -52, 1.0], [29, -53, 1.14], [-6, -30, 0.92], [7, -31, 0.98],
      [-34, -60, 1.2], [33, -62, 1.1],
      // 공방 구역
      [-24, 34, 1.06], [-56, 20, 1.15], [-44, 44, 1.1], [-58, 38, 1.0],
      [-30, 4, 0.95], [-52, 6, 1.08],
      // 농경지
      [24, 40, 1.12], [56, 16, 1.05], [46, 48, 1.18], [58, 34, 0.98],
      [30, 6, 1.0], [52, 6, 1.1],
      // 석회암 지대 — 척박해서 드물게
      [-58, -20, 0.88], [-30, -46, 0.82], [-56, -46, 0.9],
      // 마을 외곽 숲
      [-68, 0, 1.25], [66, -8, 1.2], [-14, 70, 1.3], [16, 72, 1.15],
      [-70, 62, 1.1], [70, 50, 1.22], [-46, 70, 1.05], [48, 70, 1.12],
      [0, 78, 1.2], [-76, -40, 1.15], [74, -44, 1.1], [-64, 78, 1.0],
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

    this._mergeGroup(p);
    this.collision.addBox(x, z, 0.72 * scale, 0.72 * scale, 0, h * scale);
  }

  // ================= 마을 밖 =================

  /**
   * 토룡마을을 둘러싼 야외.
   *
   * 마을만 있으면 나갈 이유가 없다. 밖에도 갈 곳이 있어야 탐험이 성립한다.
   * 다만 아직 다른 지역(7단계)은 없으므로, 사방의 길 끝에 이정표를 세워
   * "저쪽에 무엇이 있다"는 것만 알려주고 실제 이동은 막아둔다.
   *
   *            [석회암 고원 · 북]
   *                   │
   *   [폐허 언덕]───[마을]───[강과 숲]
   *        서          │          동
   *              [남쪽 평원]
   *          플레이어가 떠밀려 온 곳
   */
  _buildWilderness() {
    this._northPlateau();
    this._eastRiver();
    this._westRuins();
    this._southPlain();
    this._outerForest();
    this._signposts();
    this._campsites();
  }

  /** 북 — 석회암이 솟은 척박한 고원. 나중에 저승·추방지로 이어진다 */
  _northPlateau() {
    const spots = [
      [-70, -96, 6.0], [-52, -104, 4.4], [-88, -84, 5.2], [-34, -112, 4.0],
      [12, -108, 5.6], [40, -96, 4.8], [64, -110, 6.2], [-14, -128, 5.0],
      [30, -132, 4.4], [-60, -130, 5.8], [80, -84, 4.2], [-96, -110, 4.6],
    ];
    for (const [x, z, s] of spots) this._limestone(x, z, s);

    // 말라붙은 웅덩이 — 석회암 지대라 물이 고이지 않는다는 표시
    for (const [x, z, r] of [[-40, -118, 7], [24, -120, 5.5], [-76, -106, 6]]) {
      const p = new THREE.Mesh(
        new THREE.CircleGeometry(r, 18),
        toonMaterial(0xa89880, { map: this.tex.dirt, repeat: [r / 2, r / 2] })
      );
      p.rotation.x = -Math.PI / 2;
      p.position.set(x, 0.03, z);
      p.receiveShadow = true;
      this.scene.add(p);
    }
  }

  /** 동 — 강이 흐르고 그 너머는 숲. 다리를 건너야 한다 */
  _eastRiver() {
    // 강 — 남북으로 흐른다
    const river = new THREE.Mesh(
      new THREE.PlaneGeometry(14, 220),
      toonMaterial(0x2f6a86, { map: this.tex.dirt, repeat: [2, 30] })
    );
    river.rotation.x = -Math.PI / 2;
    river.rotation.z = 0.06;
    river.position.set(84, 0.05, -10);
    river.receiveShadow = true;
    this.scene.add(river);

    // 강가 자갈
    const pebbleGeo = this._geo("pebble", () => new THREE.DodecahedronGeometry(0.14, 0));
    const pebbleM = toonMaterial(0xffffff, { map: this.tex.stone, repeat: [1, 1] });
    for (let i = 0; i < Math.round(220 * this.density); i++) {
      const z = -120 + Math.random() * 220;
      const side = Math.random() > 0.5 ? 1 : -1;
      const x = 84 + side * (7 + Math.random() * 3.5) + z * 0.06;
      this.batch.add(pebbleGeo, pebbleM, [x, 0.07, z],
        [Math.random() * 3, Math.random() * 3, Math.random() * 3], 0.6 + Math.random() * 1.1);
    }

    // 다리 — 동쪽 길이 강을 건넌다
    this._bridge(84, 0, 0.06);

    // 강 건너 숲
    const forest = [
      [102, -30, 1.2], [112, -14, 1.35], [98, 6, 1.15], [116, 20, 1.3],
      [104, 40, 1.25], [120, -46, 1.4], [96, -58, 1.1], [126, 4, 1.2],
      [108, 62, 1.3], [130, 40, 1.15], [94, 74, 1.25], [122, -70, 1.35],
    ];
    for (const [x, z, s] of forest) this._tree(x, z, s);
  }

  /** 서 — 무너진 옛 건축물. 비스무트가 남긴 것이라는 설정 */
  _westRuins() {
    const ruinM = toonMaterial(0xb8b0a0, { map: this.tex.stone, repeat: [2, 3] });
    const brokenM = toonMaterial(0x9a9284, { map: this.tex.stone, repeat: [1, 1] });

    // 무너진 기둥들 — 높이를 제각각으로 해야 폐허로 읽힌다
    const pillars = [
      [-96, 18, 5.5], [-88, 30, 3.2], [-104, 34, 6.2], [-92, 46, 2.4],
      [-110, 20, 4.0], [-100, 6, 3.6], [-118, 40, 5.0], [-84, 12, 2.0],
    ];
    for (const [x, z, h] of pillars) {
      const g = new THREE.Group();
      g.position.set(x, 0, z);
      g.rotation.y = Math.random() * Math.PI;
      // 기단
      this._put(g, new THREE.BoxGeometry(1.9, 0.4, 1.9), brokenM, [0, 0.2, 0], { outline: 0.025 });
      // 기둥 — 위로 갈수록 가늘고, 꼭대기는 부서져 있다
      this._put(g, new THREE.CylinderGeometry(0.6, 0.72, h, 10), ruinM, [0, 0.4 + h / 2, 0],
        { rot: [(Math.random() - 0.5) * 0.06, 0, (Math.random() - 0.5) * 0.06], outline: 0.025 });
      this._put(g, new THREE.DodecahedronGeometry(0.66, 0), brokenM, [0, 0.4 + h + 0.2, 0],
        { rot: [Math.random(), Math.random(), Math.random()], outline: 0.03 });
      this._mergeGroup(g);
      this.collision.addBox(x, z, 1.9, 1.9, 0, 0.4 + h);
    }

    // 쓰러진 기둥 조각
    const chunkGeo = this._geo("ruinChunk", () => new THREE.CylinderGeometry(0.55, 0.6, 2.6, 8));
    for (const [x, z, ry] of [[-98, 26, 0.4], [-106, 44, 1.2], [-90, 38, 2.1],
                              [-114, 28, 0.8], [-86, 24, 1.7], [-112, 12, 2.6]]) {
      this.batch.add(chunkGeo, ruinM, [x, 0.6, z], [Math.PI / 2, ry, 0]);
    }

    // 깨진 바닥 타일 — 여기가 건물이었다는 흔적
    const tileGeo = this._geo("ruinTile", () => new THREE.BoxGeometry(2.2, 0.12, 2.2));
    for (let i = 0; i < Math.round(40 * this.density); i++) {
      const x = -104 + (Math.random() - 0.5) * 40;
      const z = 28 + (Math.random() - 0.5) * 44;
      this.batch.add(tileGeo, brokenM, [x, 0.06, z], [0, Math.random() * 0.5, 0], 0.7 + Math.random() * 0.6);
    }
  }

  /** 남 — 플레이어가 떠밀려 온 평원. 바다 냄새가 나기 시작한다 */
  _southPlain() {
    // 연못 — 바다로 이어지는 물길의 시작
    const pond = new THREE.Mesh(new THREE.CircleGeometry(16, 28), toonMaterial(0x2f6a86));
    pond.rotation.x = -Math.PI / 2;
    pond.position.set(-24, 0.04, 104);
    pond.receiveShadow = true;
    this.scene.add(pond);

    const rim = new THREE.Mesh(new THREE.RingGeometry(15.5, 18.5, 28),
      toonMaterial(0xb0a084, { map: this.tex.dirt, repeat: [6, 6] }));
    rim.rotation.x = -Math.PI / 2;
    rim.position.set(-24, 0.045, 104);
    rim.receiveShadow = true;
    this.scene.add(rim);

    // 갈대 — 연못가
    const reedGeo = this._geo("reed", () => new THREE.ConeGeometry(0.05, 1.5, 3));
    const reedM = toonMaterial(0x8a9a5a);
    for (let i = 0; i < Math.round(120 * this.density); i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 15 + Math.random() * 4;
      this.batch.add(reedGeo, reedM,
        [-24 + Math.sin(a) * r, 0.75, 104 + Math.cos(a) * r],
        [0, Math.random() * 3, (Math.random() - 0.5) * 0.3], 0.7 + Math.random() * 0.7);
    }

    // 표류물 — 플레이어가 떠밀려 왔다는 설정의 흔적
    const driftM = toonMaterial(0x8a7a60, { map: this.tex.wood, repeat: [1, 2] });
    const plankGeo = this._geo("plank", () => new THREE.BoxGeometry(0.4, 0.18, 3.2));
    for (const [x, z, ry] of [[6, 118, 0.4], [14, 124, 1.9], [-2, 126, 2.7],
                              [20, 112, 0.9], [-10, 132, 1.4]]) {
      this.batch.add(plankGeo, driftM, [x, 0.1, z], [0, ry, (Math.random() - 0.5) * 0.2]);
    }

    // 모래 — 남쪽 끝은 바닷가에 가까워진다
    const sand = new THREE.Mesh(new THREE.PlaneGeometry(200, 70),
      toonMaterial(0xd8c8a4, { map: this.tex.dirt, repeat: [30, 10] }));
    sand.rotation.x = -Math.PI / 2;
    sand.position.set(0, 0.02, 146);
    sand.receiveShadow = true;
    this.scene.add(sand);
  }

  /** 외곽 숲 — 경계를 자연스럽게 막는다 */
  _outerForest() {
    const ring = [];
    const R = 150;
    for (let i = 0; i < 46; i++) {
      const a = (i / 46) * Math.PI * 2;
      // 길이 나가는 네 방향은 비워둔다
      const deg = (a * 180) / Math.PI;
      const onRoad = [0, 90, 180, 270].some((d) => Math.abs(((deg - d + 540) % 360) - 180) > 172);
      if (onRoad) continue;
      const r = R + (Math.random() - 0.5) * 24;
      ring.push([Math.sin(a) * r, Math.cos(a) * r, 1.1 + Math.random() * 0.5]);
    }
    for (const [x, z, s] of ring) this._tree(x, z, s);

    // 중간 지대의 성긴 나무
    for (let i = 0; i < Math.round(34 * this.density); i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 95 + Math.random() * 40;
      this._tree(Math.sin(a) * r, Math.cos(a) * r, 0.9 + Math.random() * 0.5);
    }
  }

  /** 다리 */
  _bridge(x, z, ry) {
    const p = new THREE.Group();
    p.position.set(x, 0, z);
    p.rotation.y = ry;

    const woodM = toonMaterial(0xffffff, { map: this.tex.wood, repeat: [1, 4] });
    const darkM = toonMaterial(0xa88a6a, { map: this.tex.wood, repeat: [1, 2] });

    this._put(p, new THREE.BoxGeometry(22, 0.35, 5.4), woodM, [0, 0.5, 0], { outline: 0.02 });
    for (const s of [-1, 1]) {
      this._put(p, new THREE.BoxGeometry(22, 0.16, 0.16), darkM, [0, 1.35, s * 2.6], { noOutline: true });
      for (let i = -4; i <= 4; i++) {
        this._put(p, new THREE.BoxGeometry(0.18, 1.0, 0.18), darkM, [i * 2.5, 0.95, s * 2.6], { noOutline: true });
      }
    }
    // 교각
    for (const i of [-7, 0, 7]) {
      this._put(p, new THREE.CylinderGeometry(0.4, 0.45, 1.6, 8), darkM, [i, -0.3, 0], { noOutline: true });
    }

    this._mergeGroup(p);
    // 다리 위는 지나갈 수 있어야 하므로 난간만 막는다
    for (const s of [-1, 1]) {
      this.collision.addBox(x + Math.sin(ry) * 0, z + s * 2.7, 22, 0.4, 0.5, 1.5, ry);
    }
  }

  /** 이정표 — 길 끝에서 다음 지역을 알려준다 */
  _signposts() {
    const posts = [
      { x: 0, z: -96, ry: 0, lines: ["북 — 석회암 고원", "저승 · 추방지 방면"] },
      { x: 96, z: 0, ry: Math.PI / 2, lines: ["동 — 강 건너 숲", "아르곤 시티 방면"] },
      { x: 0, z: 118, ry: Math.PI, lines: ["남 — 바닷가 평원", "불안정한 바다 방면"] },
      { x: -96, z: 0, ry: -Math.PI / 2, lines: ["서 — 옛 폐허", "철의 요새 방면"] },
    ];

    const woodM = toonMaterial(0xffffff, { map: this.tex.wood, repeat: [1, 3] });
    const boardM = toonMaterial(0xc8b896, { map: this.tex.wood, repeat: [2, 1] });

    for (const s of posts) {
      const p = new THREE.Group();
      p.position.set(s.x, 0, s.z);
      p.rotation.y = s.ry;

      this._put(p, new THREE.BoxGeometry(0.2, 3.0, 0.2), woodM, [0, 1.5, 0], { outline: 0.04 });
      this._put(p, new THREE.BoxGeometry(2.6, 0.5, 0.12), boardM, [0.5, 2.5, 0], { rot: [0, 0, -0.04], outline: 0.03 });
      this._put(p, new THREE.BoxGeometry(2.2, 0.42, 0.12), boardM, [-0.4, 1.9, 0], { rot: [0, 0, 0.05], outline: 0.03 });
      // 돌무더기 받침
      this._put(p, new THREE.DodecahedronGeometry(0.7, 0), toonMaterial(0xffffff, { map: this.tex.stone, repeat: [1, 1] }),
        [0, 0.25, 0], { rot: [0.2, Math.random(), 0.1], outline: 0.03 });

      this._mergeGroup(p);
      this.collision.addBox(s.x, s.z, 0.6, 0.6, 0, 3.0);
      this.signposts ??= [];
      this.signposts.push(s);
    }
  }

  /** 야영지 — 먼 길의 쉼터 */
  _campsites() {
    const sites = [[-58, 78, 0.4], [72, -62, 1.2], [-72, -58, 2.0], [46, 92, 0.8]];
    const logGeo = this._geo("campLog", () => new THREE.CylinderGeometry(0.16, 0.18, 1.8, 6));
    const stoneGeo = this._geo("campStone", () => new THREE.DodecahedronGeometry(0.3, 0));
    const woodM = toonMaterial(0x6a4d34, { map: this.tex.wood, repeat: [1, 1] });
    const stoneM = toonMaterial(0xffffff, { map: this.tex.stone, repeat: [1, 1] });
    const emberM = toonMaterial(0xe8863a, { emissive: 0x8a3a08 });

    for (const [x, z, ry] of sites) {
      // 돌 화덕
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        this.batch.add(stoneGeo, stoneM, [x + Math.sin(a) * 0.9, 0.14, z + Math.cos(a) * 0.9],
          [Math.random(), Math.random() * 3, Math.random()], 0.8 + Math.random() * 0.5);
      }
      // 장작
      for (let i = 0; i < 3; i++) {
        const a = ry + (i / 3) * Math.PI;
        this.batch.add(logGeo, woodM, [x, 0.3, z], [Math.PI / 2.4, a, 0]);
      }
      // 잉걸불
      this.batch.add(this._geo("ember", () => new THREE.IcosahedronGeometry(0.3, 0)),
        emberM, [x, 0.18, z], [0, 0, 0], 1);

      // 통나무 의자
      this.batch.add(logGeo, woodM, [x + Math.sin(ry) * 2.2, 0.2, z + Math.cos(ry) * 2.2],
        [0, ry + Math.PI / 2, Math.PI / 2], [1.4, 1.4, 1.4]);

      this.campsites ??= [];
      this.campsites.push({ x, z });
    }
  }

  // ================= 잔물건 (전부 인스턴싱) =================

  /**
   * 풀·꽃·자갈. 개별 메시로 두면 수백 드로우콜이지만 인스턴싱하면 3~4회다.
   * 물체와 땅이 만나는 자리를 메워야 장난감처럼 안 보인다.
   */
  _buildScatter() {
    const bladeGeo = this._geo("blade", () => new THREE.ConeGeometry(0.06, 0.4, 3));
    const grassA = toonMaterial(PALETTE.leafC);
    const grassB = toonMaterial(PALETTE.leafA);
    const pebbleGeo = this._geo("pebble", () => new THREE.DodecahedronGeometry(0.14, 0));
    const pebbleM = toonMaterial(0xffffff, { map: this.tex.stone, repeat: [1, 1] });
    const flowerGeo = this._geo("flower", () => new THREE.SphereGeometry(0.09, 6, 5));
    const flowerM = [toonMaterial(0xe8d0e0), toonMaterial(0xf0e0a0), toonMaterial(0xd8a0b0)];
    const bushGeo = this._geo("bush", () => new THREE.IcosahedronGeometry(0.42, 0));
    const bushM = toonMaterial(0xffffff, { map: this.tex.leaf, repeat: [1, 1] });

    const n = (base) => Math.round(base * this.density);

    // 풀 포기 — 한 포기에 잎 3장
    for (let i = 0; i < n(3200); i++) {
      const [x, z] = this._scatterPoint(17, 150);
      for (let b = 0; b < 3; b++)
        this.batch.add(bladeGeo, Math.random() > 0.5 ? grassA : grassB,
          [x + (Math.random() - 0.5) * 0.3, 0.2, z + (Math.random() - 0.5) * 0.3],
          [0, Math.random() * 3, (Math.random() - 0.5) * 0.5],
          0.8 + Math.random() * 0.6);
    }

    for (let i = 0; i < n(1300); i++) {
      const [x, z] = this._scatterPoint(15, 152);
      this.batch.add(pebbleGeo, pebbleM, [x, 0.06, z],
        [Math.random() * 3, Math.random() * 3, Math.random() * 3], 0.5 + Math.random() * 0.9);
    }

    for (let i = 0; i < n(850); i++) {
      const [x, z] = this._scatterPoint(18, 140);
      this.batch.add(flowerGeo, flowerM[i % 3], [x, 0.22, z], [0, 0, 0], 0.7 + Math.random() * 0.6);
      this.batch.add(bladeGeo, grassB, [x, 0.12, z], [0, 0, 0], [0.5, 0.6, 0.5]);
    }

    for (let i = 0; i < n(560); i++) {
      const [x, z] = this._scatterPoint(19, 152);
      this.batch.add(bushGeo, bushM, [x, 0.3, z],
        [Math.random(), Math.random() * 3, Math.random()], 0.7 + Math.random() * 0.9);
    }

    // 광장 포석 — 흙바닥 위에 박힌 돌
    const slabGeo = this._geo("slab", () => new THREE.CylinderGeometry(0.32, 0.34, 0.06, 6));
    for (let i = 0; i < n(120); i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * 15;
      this.batch.add(slabGeo, pebbleM, [Math.sin(a) * r, 0.05, Math.cos(a) * r], [0, Math.random() * 3, 0],
        0.8 + Math.random() * 0.7);
    }

    // 광장 경계석
    for (let i = 0; i < 46; i++) {
      const a = (i / 46) * Math.PI * 2;
      this.batch.add(pebbleGeo, pebbleM, [Math.sin(a) * 16.2, 0.14, Math.cos(a) * 16.2],
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
    // 벽이 없다. 대륙은 청크로 끝없이 이어지고, 아주 멀리 나가면
    // 지형이 바다로 내려앉아 스스로 발길을 돌리게 된다.
    // (예전에는 반경 178m에 보이지 않는 벽을 둘렀다)
  }

  // ================= 공용 =================

  /** 반복되는 소품의 지오메트리를 공유한다 — 인스턴싱이 묶이려면 같은 객체여야 한다 */
  _geo(key, factory) {
    let g = this._geoCache.get(key);
    if (!g) { g = factory(); this._geoCache.set(key, g); }
    return g;
  }

  /**
   * 그룹의 모든 메시를 월드 좌표로 구워 병합 배치에 넘긴다.
   * 그룹 자체는 씬에 붙이지 않는다 — 지오메트리만 가져가고 버린다.
   */
  _mergeGroup(group) {
    group.updateMatrixWorld(true);
    group.traverse((o) => {
      if (o.isMesh) this.merged.add(o.geometry, o.material, o.matrixWorld);
    });
  }

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
