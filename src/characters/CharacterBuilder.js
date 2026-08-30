import * as THREE from "three";
import { toonMaterial, makeOutline } from "../fx/Style.js";
import { getCombatType, COMBAT } from "../data/elements.js";

// 절차적 캐릭터 생성기.
//
// 비율은 애니메이션 게임 기준 7등신으로 잡았다 — 머리가 크고 사지가 짧은
// 저폴리 특유의 뭉툭함이 "유치해 보인다"는 인상의 주된 원인이라서다.
// 폴리곤을 늘리는 대신 비율·실루엣·외곽선으로 인상을 만든다.
//
// 나중에 assets/models/<id>.glb 를 넣으면 CharacterLoader가 이 결과물을
// 대체한다. 그때까지의 자리표시이자, 모델이 없는 캐릭터의 영구 대체본이다.

export const BODY = {
  height: 1.75,
  headRadius: 0.125,
  headY: 1.605,
  neckY: 1.465,
  shoulderY: 1.40,
  shoulderHalf: 0.19,
  chestY: 1.22,
  waistY: 1.02,
  hipY: 0.93,
  legTopY: 0.93,
  armRadius: 0.052,
  legRadius: 0.068,
};

class Rig {
  constructor(outlines) {
    this.root = new THREE.Group();
    this.outlines = outlines;
    this.parts = {};
  }

  /** 위치가 고정된 부위 — 지오메트리 중심이 곧 배치 위치 */
  solid(geo, color, x, y, z, opts = {}) {
    const mesh = new THREE.Mesh(geo, toonMaterial(color, opts));
    mesh.position.set(x, y, z);
    if (opts.rot) mesh.rotation.set(opts.rot[0] || 0, opts.rot[1] || 0, opts.rot[2] || 0);
    if (opts.scale) mesh.scale.set(...opts.scale);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.root.add(mesh);

    if (!opts.noOutline) {
      const o = makeOutline(mesh, opts.outline ?? 0.05, this.outlines);
      if (o) this.root.add(o);
    }
    return mesh;
  }

  /**
   * 관절에서 회전하는 부위(팔·다리). 지오메트리를 아래로 내려 붙여
   * 그룹의 원점이 관절(어깨·엉덩이)에 오게 한다 — 걷기 애니메이션에 필요하다.
   */
  limb(geo, color, jointX, jointY, jointZ, length, opts = {}) {
    const pivot = new THREE.Group();
    pivot.position.set(jointX, jointY, jointZ);

    const mesh = new THREE.Mesh(geo, toonMaterial(color, opts));
    mesh.position.y = -length / 2;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    pivot.add(mesh);

    if (!opts.noOutline) {
      const o = makeOutline(mesh, opts.outline ?? 0.05, this.outlines);
      if (o) pivot.add(o);
    }

    this.root.add(pivot);
    return pivot;
  }
}

// ---------------- 부위별 생성 ----------------

function buildHead(rig, el) {
  const c = el.colors;
  const skin = 0xf0d8bc;

  rig.solid(new THREE.CylinderGeometry(0.045, 0.052, 0.075, 8), skin, 0, BODY.neckY, 0);

  // 머리 — 살짝 세로로 늘려 애니메이션풍 계란형으로
  rig.solid(
    new THREE.SphereGeometry(BODY.headRadius, 16, 12),
    skin, 0, BODY.headY, 0,
    { scale: [0.92, 1.08, 0.95] }
  );

  // 머리카락 — 실루엣이 캐릭터 구분의 절반을 차지한다
  const hairY = BODY.headY + 0.022;
  rig.solid(
    new THREE.SphereGeometry(BODY.headRadius * 1.1, 14, 10),
    c.hair, 0, hairY, -0.006,
    { scale: [1, 0.95, 1] }
  );

  if (el.silhouette === "sharp") {
    // 뾰족한 돌기 — 할로겐의 공격성을 실루엣으로
    const spikes = [
      [0, 0.13, -0.02, -0.35, 0], [-0.09, 0.11, 0.01, -0.2, -0.5],
      [0.10, 0.10, -0.02, -0.3, 0.55], [-0.04, 0.10, -0.11, 0.6, -0.2],
      [0.07, 0.09, 0.09, -0.7, 0.25],
    ];
    for (const [sx, sy, sz, rx, rz] of spikes) {
      rig.solid(new THREE.ConeGeometry(0.042, 0.19, 5), c.hair,
        sx, BODY.headY + sy, sz, { rot: [rx, 0, rz] });
    }
  } else if (el.silhouette === "robed" || el.silhouette === "noble") {
    // 긴 머리 — 뒤로 흐르게
    rig.solid(new THREE.BoxGeometry(0.19, 0.36, 0.09), c.hair, 0, BODY.headY - 0.15, -0.10);
    rig.solid(new THREE.BoxGeometry(0.055, 0.26, 0.06), c.hair, -0.115, BODY.headY - 0.10, 0.03);
    rig.solid(new THREE.BoxGeometry(0.055, 0.26, 0.06), c.hair, 0.115, BODY.headY - 0.10, 0.03);
  } else {
    // 짧은 머리 — 뒷머리와 앞머리
    rig.solid(new THREE.BoxGeometry(0.20, 0.13, 0.07), c.hair, 0, BODY.headY - 0.03, -0.105);
    rig.solid(new THREE.BoxGeometry(0.21, 0.06, 0.05), c.hair, 0, BODY.headY + 0.075, 0.095);
  }
}

function buildTorso(rig, el) {
  const c = el.colors;

  switch (el.silhouette) {
    case "armored": {
      rig.solid(new THREE.BoxGeometry(0.34, 0.44, 0.22), c.main, 0, BODY.chestY - 0.02, 0);
      rig.solid(new THREE.BoxGeometry(0.30, 0.20, 0.20), c.sub, 0, BODY.waistY - 0.03, 0);
      rig.solid(new THREE.BoxGeometry(0.07, 0.40, 0.015), c.accent, 0, BODY.chestY - 0.02, 0.113, { noOutline: true });
      // 어깨 보호구 — 실루엣을 좌우로 넓혀 무게감을 만든다
      for (const s of [-1, 1]) {
        rig.solid(new THREE.BoxGeometry(0.17, 0.14, 0.24), c.sub,
          s * (BODY.shoulderHalf + 0.05), BODY.shoulderY - 0.01, 0, { rot: [0, 0, s * -0.22] });
        rig.solid(new THREE.BoxGeometry(0.18, 0.028, 0.25), c.accent,
          s * (BODY.shoulderHalf + 0.05), BODY.shoulderY - 0.075, 0, { rot: [0, 0, s * -0.22], noOutline: true });
      }
      // 코트 자락
      rig.solid(new THREE.BoxGeometry(0.32, 0.36, 0.04), c.main, 0, BODY.hipY - 0.10, -0.11, { rot: [0.1, 0, 0] });
      break;
    }
    case "noble": {
      rig.solid(new THREE.CylinderGeometry(0.155, 0.175, 0.44, 12), c.main, 0, BODY.chestY - 0.02, 0);
      rig.solid(new THREE.CylinderGeometry(0.18, 0.155, 0.12, 12), c.sub, 0, BODY.shoulderY - 0.04, 0);
      // 목깃
      rig.solid(new THREE.CylinderGeometry(0.10, 0.135, 0.11, 10), c.accent, 0, BODY.shoulderY + 0.05, 0, { noOutline: true });
      rig.solid(new THREE.BoxGeometry(0.30, 0.06, 0.19), c.accent, 0, BODY.waistY - 0.06, 0, { noOutline: true });
      rig.solid(new THREE.CylinderGeometry(0.18, 0.30, 0.42, 12), c.main, 0, BODY.hipY - 0.14, 0);
      break;
    }
    case "robed":
    case "floating": {
      rig.solid(new THREE.CylinderGeometry(0.15, 0.17, 0.40, 12), c.main, 0, BODY.chestY, 0);
      rig.solid(new THREE.BoxGeometry(0.09, 0.38, 0.02), c.sub, 0, BODY.chestY, 0.16, { rot: [0.1, 0, 0], noOutline: true });
      // 어깨 망토
      rig.solid(new THREE.CylinderGeometry(0.23, 0.19, 0.13, 12), c.sub, 0, BODY.shoulderY - 0.02, 0);
      // 아래로 넓어지는 로브 — 다리를 덮는다
      rig.solid(new THREE.CylinderGeometry(0.17, 0.36, 0.72, 14), c.main, 0, BODY.hipY - 0.30, 0);
      rig.solid(new THREE.TorusGeometry(0.185, 0.018, 6, 16), c.accent,
        0, BODY.shoulderY + 0.035, 0, { rot: [Math.PI / 2, 0, 0], noOutline: true });
      break;
    }
    case "glowing": {
      rig.solid(new THREE.BoxGeometry(0.30, 0.42, 0.20), c.main, 0, BODY.chestY - 0.02, 0);
      rig.solid(new THREE.BoxGeometry(0.28, 0.16, 0.19), c.sub, 0, BODY.waistY - 0.02, 0);
      // 발광 코어 — 방사성 원소의 표식
      rig.solid(new THREE.SphereGeometry(0.055, 12, 10), c.accent,
        0, BODY.chestY + 0.02, 0.105, { emissive: c.accent, noOutline: true });
      break;
    }
    case "sharp": {
      rig.solid(new THREE.BoxGeometry(0.31, 0.42, 0.20), c.main, 0, BODY.chestY - 0.02, 0);
      rig.solid(new THREE.BoxGeometry(0.33, 0.15, 0.22), c.sub, 0, BODY.chestY + 0.11, 0);
      rig.solid(new THREE.BoxGeometry(0.34, 0.06, 0.21), c.sub, 0, BODY.waistY - 0.05, 0);
      // 한쪽에만 보호구 — 비대칭이 할로겐의 정체성
      rig.solid(new THREE.BoxGeometry(0.19, 0.17, 0.24), c.sub,
        -(BODY.shoulderHalf + 0.055), BODY.shoulderY, 0, { rot: [0, 0, 0.26] });
      rig.solid(new THREE.BoxGeometry(0.17, 0.026, 0.22), c.accent,
        -(BODY.shoulderHalf + 0.06), BODY.shoulderY - 0.085, 0, { rot: [0, 0, 0.26], noOutline: true });
      rig.solid(new THREE.BoxGeometry(0.09, 0.035, 0.02), c.accent, 0.08, BODY.chestY + 0.08, 0.104, { noOutline: true });
      break;
    }
    default: { // civilian
      rig.solid(new THREE.BoxGeometry(0.30, 0.42, 0.19), c.main, 0, BODY.chestY - 0.02, 0);
      rig.solid(new THREE.BoxGeometry(0.31, 0.055, 0.20), c.sub, 0, BODY.waistY - 0.04, 0);
      rig.solid(new THREE.BoxGeometry(0.055, 0.40, 0.015), c.accent, 0, BODY.chestY - 0.02, 0.098, { noOutline: true });
      break;
    }
  }
}

function buildArms(rig, el) {
  const c = el.colors;
  const skin = 0xf0d8bc;
  const wide = el.silhouette === "robed" || el.silhouette === "floating";
  const armLen = 0.46;

  for (const s of [-1, 1]) {
    const x = s * BODY.shoulderHalf;
    const geo = wide
      ? new THREE.CylinderGeometry(BODY.armRadius * 0.9, BODY.armRadius * 2.1, armLen, 8)
      : new THREE.CylinderGeometry(BODY.armRadius, BODY.armRadius * 0.92, armLen, 8);

    const pivot = rig.limb(geo, c.main, x, BODY.shoulderY, 0, armLen);
    pivot.rotation.z = s * 0.07; // 팔을 살짝 벌려 몸통과 붙지 않게

    // 손
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), toonMaterial(skin));
    hand.position.y = -armLen - 0.02;
    hand.castShadow = true;
    pivot.add(hand);
    const ho = makeOutline(hand, 0.06, rig.outlines);
    if (ho) pivot.add(ho);

    rig.parts[s < 0 ? "leftArm" : "rightArm"] = pivot;
  }
}

function buildLegs(rig, el) {
  const c = el.colors;

  // 로브·부유형은 다리가 옷에 가려지므로 만들지 않는다 (폴리곤 절약)
  if (el.silhouette === "robed" || el.silhouette === "floating") return;

  const legLen = 0.80;
  for (const s of [-1, 1]) {
    const x = s * 0.085;
    const pivot = rig.limb(
      new THREE.CylinderGeometry(BODY.legRadius, BODY.legRadius * 0.85, legLen, 8),
      c.sub, x, BODY.legTopY, 0, legLen
    );

    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.115, 0.11, 0.17), toonMaterial(0x2a2420));
    boot.position.set(0, -legLen - 0.02, 0.018);
    boot.castShadow = true;
    pivot.add(boot);
    const bo = makeOutline(boot, 0.05, rig.outlines);
    if (bo) pivot.add(bo);

    rig.parts[s < 0 ? "leftLeg" : "rightLeg"] = pivot;
  }
}

function buildWeapon(rig, el) {
  const combat = getCombatType(el);
  const c = el.colors;
  const right = rig.parts.rightArm;
  if (!right) return;

  if (combat === COMBAT.STRIKER) {
    // 검 — 오른손에 쥔 채 아래로 늘어뜨린다
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.62, 0.018), toonMaterial(0xc8cdd6));
    blade.position.set(0, -0.80, 0.06);
    blade.castShadow = true;
    right.add(blade);
    const bo = makeOutline(blade, 0.05, rig.outlines);
    if (bo) right.add(bo);

    const guard = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.032, 0.04), toonMaterial(c.accent));
    guard.position.set(0, -0.50, 0.06);
    right.add(guard);
  } else if (combat === COMBAT.CASTER) {
    // 시전용 부유 결정 — 손 옆에 떠 있다
    const orb = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.062, 0),
      toonMaterial(c.accent, { emissive: c.accent })
    );
    orb.position.set(0, -0.60, 0.13);
    right.add(orb);
    rig.parts.orb = orb;
  } else {
    // 하이브리드 — 짧은 총열
    const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.40), toonMaterial(0x2b3138));
    barrel.position.set(0, -0.52, 0.17);
    barrel.castShadow = true;
    right.add(barrel);
    const bo = makeOutline(barrel, 0.06, rig.outlines);
    if (bo) right.add(bo);
  }
}

// ---------------- 공개 API ----------------

/**
 * 원소 데이터로 저폴리 캐릭터를 만든다.
 * @param {object} el elements.js의 원소 객체
 * @param {{outlines?: boolean}} [opts] outlines=false면 외곽선 생략 (저사양)
 * @returns {THREE.Group} userData.parts에 애니메이션용 관절이 담겨 있다
 */
export function buildCharacter(el, opts = {}) {
  const outlines = opts.outlines !== false;
  const rig = new Rig(outlines);

  buildTorso(rig, el);
  buildHead(rig, el);
  buildArms(rig, el);
  buildLegs(rig, el);
  buildWeapon(rig, el);

  // 귀족 기체는 지면에서 떠 있다 — 반응하지 않는 존재라는 설정의 시각화
  if (el.silhouette === "floating") {
    rig.root.position.y = 0.22;
    rig.root.userData.hover = true;
  }

  rig.root.userData.parts = rig.parts;
  rig.root.userData.elementId = el.id;
  rig.root.userData.procedural = true;

  return rig.root;
}

/**
 * 걷기·대기 동작. GLB 모델이 들어오면 그쪽 애니메이션 클립으로 대체된다.
 * @param {THREE.Group} model buildCharacter의 반환값
 * @param {number} time 초 단위 누적 시간
 * @param {number} speed 0=정지, 1=전력 이동
 */
export function animateCharacter(model, time, speed) {
  const p = model.userData.parts;
  if (!p) return;

  if (model.userData.hover) {
    model.position.y = 0.22 + Math.sin(time * 1.6) * 0.035;
  }

  const swing = Math.sin(time * 9) * (0.15 + speed * 0.55);
  const breathe = Math.sin(time * 1.8) * 0.03;

  if (p.leftLeg) p.leftLeg.rotation.x = swing * speed;
  if (p.rightLeg) p.rightLeg.rotation.x = -swing * speed;

  if (p.leftArm) {
    p.leftArm.rotation.x = -swing * speed * 0.7;
    p.leftArm.rotation.z = 0.07 + breathe * (1 - speed);
  }
  if (p.rightArm) {
    p.rightArm.rotation.x = swing * speed * 0.7;
    p.rightArm.rotation.z = -0.07 - breathe * (1 - speed);
  }

  if (p.orb) {
    p.orb.rotation.y = time * 1.4;
    p.orb.rotation.x = time * 0.9;
  }
}
