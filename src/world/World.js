import * as THREE from "three";
import { Collision } from "./Collision.js";
import { toonMaterial, makeOutline, setupLighting, makeSky } from "../fx/Style.js";

// 토룡마을 — 대륙 동쪽 끝, 칼슘 촌장이 다스리는 시작 지역.
// 자료 설정에 "석회암 동굴"이 나오므로 석회암 지형을 지역 정체성으로 삼았다.
//
// 단색 평면 + 원색 도형이던 1단계 지형을, 색조를 통일하고 높낮이를 준
// 셀셰이딩 지형으로 다시 만들었다.

const PALETTE = {
  skyTop: 0x3f6ea8,
  skyHorizon: 0xbcd4e0,
  skyBottom: 0x6b7a6a,
  fog: 0xbcd4e0,

  grass: 0x6e8f52,
  grassDark: 0x59754a,
  soil: 0xa08a63,
  plaza: 0xc4b391,
  limestone: 0xd8cfb8,
  limestoneDark: 0xa89c82,

  wallPlaster: 0xd9cdb4,
  wallWood: 0x7a5a3c,
  roof: 0x8c4a3a,
  roofDark: 0x6e3a2e,

  trunk: 0x5a3f2c,
  leaf: 0x4b7a42,
  leafDark: 0x3d6437,
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
    this.spawnPoint = new THREE.Vector3(0, 0, 9);

    makeSky(scene, device, PALETTE);
    setupLighting(scene, device);

    this._buildGround();
    this._buildVillage();
    this._buildNature();
    this._buildBoundary();
  }

  // ---------------- 지형 ----------------

  _buildGround() {
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(280, 280),
      toonMaterial(PALETTE.grass)
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);

    // 마을 광장 — 흙길. 시선을 중앙으로 모은다.
    const plaza = new THREE.Mesh(new THREE.CircleGeometry(11, 40), toonMaterial(PALETTE.plaza));
    plaza.rotation.x = -Math.PI / 2;
    plaza.position.y = 0.012;
    plaza.receiveShadow = true;
    this.scene.add(plaza);

    // 광장에서 뻗어나가는 길 — 나중에 다른 지역으로 이어질 방향을 암시한다
    for (const [angle, len] of [[0, 30], [Math.PI * 0.66, 26], [Math.PI * 1.34, 26]]) {
      const road = new THREE.Mesh(new THREE.PlaneGeometry(4.4, len), toonMaterial(PALETTE.soil));
      road.rotation.x = -Math.PI / 2;
      road.rotation.z = -angle;
      road.position.set(Math.sin(angle) * (len / 2 + 8), 0.014, Math.cos(angle) * (len / 2 + 8));
      road.receiveShadow = true;
      this.scene.add(road);
    }

    // 완만한 언덕 — 완전한 평지는 화면을 비어 보이게 만든다
    const hills = [
      [-34, -30, 13, 3.2], [30, -38, 16, 4.0], [-42, 26, 15, 3.6],
      [40, 30, 12, 2.8], [0, -52, 22, 5.2],
    ];
    for (const [x, z, r, h] of hills) {
      const hill = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 8), toonMaterial(PALETTE.grassDark));
      hill.position.set(x, -r + h, z);
      hill.receiveShadow = true;
      this.scene.add(hill);
    }
  }

  // ---------------- 마을 ----------------

  _buildVillage() {
    // 칼슘 촌장의 집 — 광장 북쪽, 가장 크다
    this._house(0, -17, 6.4, 4.2, 5.2, 0);

    // 주민 가옥
    this._house(-13, -7, 4.2, 3.2, 4.0, 0.35);
    this._house(12, -9, 4.4, 3.4, 4.2, -0.3);
    this._house(-15, 8, 4.0, 3.0, 3.8, -0.5);
    this._house(14, 7, 4.2, 3.2, 4.0, 0.45);

    this._well(0, 0);

    // 석회암 노두 — 칼슘이 기도하러 가는 동굴이 있다는 설정의 시각적 단서
    this._limestone(-22, -20, 3.4);
    this._limestone(-19, -24, 2.2);
    this._limestone(-25, -16, 2.6);
  }

  _house(x, z, w, h, d, rotY) {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    group.rotation.y = rotY;

    const wall = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), toonMaterial(PALETTE.wallPlaster));
    wall.position.y = h / 2;
    wall.castShadow = true;
    wall.receiveShadow = true;
    group.add(wall);
    this._outline(group, wall, 0.02);

    // 목재 골조 — 판판한 벽에 결을 준다
    for (const s of [-1, 1]) {
      const beam = new THREE.Mesh(new THREE.BoxGeometry(0.16, h, 0.16), toonMaterial(PALETTE.wallWood));
      beam.position.set(s * (w / 2 - 0.08), h / 2, d / 2 - 0.08);
      group.add(beam);
    }
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(w, 0.16, 0.16), toonMaterial(PALETTE.wallWood));
    lintel.position.set(0, h * 0.62, d / 2 - 0.08);
    group.add(lintel);

    // 지붕 — 사각뿔. 4면이라 저폴리에서도 형태가 또렷하다
    const roof = new THREE.Mesh(
      new THREE.ConeGeometry(Math.max(w, d) * 0.82, h * 0.55, 4),
      toonMaterial(PALETTE.roof)
    );
    roof.position.y = h + h * 0.275;
    roof.rotation.y = Math.PI / 4;
    roof.castShadow = true;
    group.add(roof);
    this._outline(group, roof, 0.03);

    // 문과 창
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.5, 0.06), toonMaterial(PALETTE.roofDark));
    door.position.set(0, 0.75, d / 2 + 0.01);
    group.add(door);

    const win = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.06), toonMaterial(0x6a8fa8));
    win.position.set(w * 0.28, h * 0.6, d / 2 + 0.01);
    group.add(win);

    this.scene.add(group);

    // 충돌 상자는 회전을 반영해 대략적인 크기로 잡는다 (AABB라 회전 표현 불가)
    const span = Math.max(w, d) * (1 - Math.abs(Math.sin(rotY * 2)) * 0.1);
    this.collision.addBox(x, z, span, span, 0, h);
  }

  _well(x, z) {
    const group = new THREE.Group();
    group.position.set(x, 0, z);

    const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 1.05, 0.7, 12), toonMaterial(PALETTE.limestone));
    ring.position.y = 0.35;
    ring.castShadow = true;
    ring.receiveShadow = true;
    group.add(ring);
    this._outline(group, ring, 0.03);

    const water = new THREE.Mesh(new THREE.CircleGeometry(0.8, 14), toonMaterial(0x2f5f78));
    water.rotation.x = -Math.PI / 2;
    water.position.y = 0.5;
    group.add(water);

    for (const s of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.5, 0.14), toonMaterial(PALETTE.wallWood));
      post.position.set(s * 0.8, 1.05, 0);
      post.castShadow = true;
      group.add(post);
    }
    const beam = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.14, 0.14), toonMaterial(PALETTE.wallWood));
    beam.position.y = 1.8;
    group.add(beam);

    const roof = new THREE.Mesh(new THREE.ConeGeometry(1.5, 0.7, 4), toonMaterial(PALETTE.roofDark));
    roof.position.y = 2.15;
    roof.rotation.y = Math.PI / 4;
    roof.castShadow = true;
    group.add(roof);
    this._outline(group, roof, 0.03);

    this.scene.add(group);
    this.collision.addBox(x, z, 2.1, 2.1, 0, 2.4);
  }

  _limestone(x, z, scale) {
    const group = new THREE.Group();
    group.position.set(x, 0, z);

    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(scale, 0), toonMaterial(PALETTE.limestone));
    rock.position.y = scale * 0.55;
    rock.rotation.set(Math.random() * 0.4, Math.random() * Math.PI, Math.random() * 0.3);
    rock.castShadow = true;
    rock.receiveShadow = true;
    group.add(rock);
    this._outline(group, rock, 0.025);

    const base = new THREE.Mesh(new THREE.DodecahedronGeometry(scale * 0.55, 0), toonMaterial(PALETTE.limestoneDark));
    base.position.set(scale * 0.5, scale * 0.25, scale * 0.4);
    base.castShadow = true;
    group.add(base);

    this.scene.add(group);
    this.collision.addBox(x, z, scale * 1.5, scale * 1.5, 0, scale * 1.4);
  }

  // ---------------- 자연 ----------------

  _buildNature() {
    const trees = [
      [-20, 3], [-18, -12], [19, 4], [21, -13], [-6, 24], [7, 26],
      [-26, -30], [26, 24], [-30, 12], [31, -22], [-9, -30], [11, -32],
      [-34, -6], [33, 9],
    ];
    for (const [x, z] of trees) this._tree(x, z);

    // 풀 덤불 — 충돌 없이 바닥을 채운다
    for (let i = 0; i < 46; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 14 + Math.random() * 34;
      const x = Math.sin(a) * r;
      const z = Math.cos(a) * r;
      const bush = new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.35 + Math.random() * 0.3, 0),
        toonMaterial(Math.random() > 0.5 ? PALETTE.leafDark : PALETTE.leaf)
      );
      bush.position.set(x, 0.22, z);
      bush.rotation.y = Math.random() * Math.PI;
      bush.castShadow = true;
      this.scene.add(bush);
    }
  }

  _tree(x, z) {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    const h = 2.4 + Math.random() * 0.9;

    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.28, h, 7), toonMaterial(PALETTE.trunk));
    trunk.position.y = h / 2;
    trunk.castShadow = true;
    group.add(trunk);
    this._outline(group, trunk, 0.04);

    // 잎을 두 덩이로 겹쳐 실루엣에 굴곡을 준다
    const r1 = 1.25 + Math.random() * 0.3;
    const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(r1, 0), toonMaterial(PALETTE.leaf));
    crown.position.y = h + r1 * 0.45;
    crown.rotation.set(Math.random(), Math.random(), Math.random());
    crown.castShadow = true;
    group.add(crown);
    this._outline(group, crown, 0.035);

    const crown2 = new THREE.Mesh(new THREE.IcosahedronGeometry(r1 * 0.68, 0), toonMaterial(PALETTE.leafDark));
    crown2.position.set(r1 * 0.42, h + r1 * 0.95, -r1 * 0.28);
    crown2.rotation.set(Math.random(), Math.random(), Math.random());
    crown2.castShadow = true;
    group.add(crown2);

    this.scene.add(group);
    this.collision.addBox(x, z, 0.66, 0.66, 0, h);
  }

  // ---------------- 경계 ----------------

  _buildBoundary() {
    // 지금은 토룡마을만 있으므로 플레이어가 빈 평야로 나가지 않게 막는다.
    // 7단계에서 지역이 이어지면 해당 방향의 벽을 연다.
    const R = 56;
    const seg = 16;
    for (let i = 0; i < seg; i++) {
      const a = (i / seg) * Math.PI * 2;
      const x = Math.sin(a) * R;
      const z = Math.cos(a) * R;
      this.collision.addBox(x, z, 26, 26, 0, 12);
    }
  }

  _outline(parent, mesh, thickness) {
    const o = makeOutline(mesh, thickness, this.outlines);
    if (o) parent.add(o);
  }
}
