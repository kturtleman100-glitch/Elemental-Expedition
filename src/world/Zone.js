// 지역(Zone) 정의와 분위기 전환.
//
// 아직 다른 지역의 지형은 없다. 하지만 토룡마을 안팎이 이미 넓어서,
// 어디에 있느냐에 따라 안개 색과 조명이 달라지면 장소가 다르게 느껴진다.
// 7단계의 지역 시스템을 여기서 시작해, 나중에 실제 지형이 붙으면
// 좌표만 바꿔 끼우면 되도록 만들어 둔다.

import * as THREE from "three";

export const ZONES = [
  {
    id: "village",
    name: "토룡마을",
    sub: "대륙 동쪽 끝",
    center: [0, 0], radius: 70,
    fog: 0xd2e0dc, fogNear: 40, fogFar: 150,
    light: 1.45, ambient: 0x51607a,
    owner: "ca",
  },
  {
    id: "plateau",
    name: "석회암 고원",
    sub: "저승 · 추방지 방면",
    center: [0, -115], radius: 78,
    // 척박한 곳이라 빛이 하얗게 튀고 안개가 가깝다
    fog: 0xdcd8cc, fogNear: 26, fogFar: 110,
    light: 1.6, ambient: 0x6a6a72,
    danger: 2,
  },
  {
    id: "river",
    name: "강 건너 숲",
    sub: "아르곤 시티 방면",
    center: [110, 0], radius: 74,
    // 나무 그늘이라 어둡고 푸르다
    fog: 0xa8c4c0, fogNear: 22, fogFar: 95,
    light: 1.15, ambient: 0x44607a,
    danger: 2,
  },
  {
    id: "ruins",
    name: "옛 폐허",
    sub: "철의 요새 방면",
    center: [-104, 26], radius: 70,
    // 먼지가 낀 누런 공기
    fog: 0xc8bda4, fogNear: 24, fogFar: 100,
    light: 1.3, ambient: 0x6a6250,
    danger: 3,
  },
  {
    id: "shore",
    name: "바닷가 평원",
    sub: "불안정한 바다 방면",
    center: [0, 128], radius: 80,
    // 바다가 가까워 습하고 밝다
    fog: 0xdce8ea, fogNear: 44, fogFar: 165,
    light: 1.5, ambient: 0x5a7086,
    danger: 1,
  },
];

const DEFAULT = ZONES[0];

export function zoneAt(x, z) {
  let best = DEFAULT;
  let bestD = Infinity;
  for (const zn of ZONES) {
    const d = Math.hypot(x - zn.center[0], z - zn.center[1]);
    if (d > zn.radius) continue;
    if (d < bestD) { bestD = d; best = zn; }
  }
  return best;
}

/**
 * 지역이 바뀌면 안개와 조명을 서서히 옮긴다.
 *
 * 즉시 바꾸면 경계를 넘는 순간 화면이 번쩍인다. 늘 보간해야 한다.
 */
export class ZoneManager {
  /**
   * @param {THREE.Scene} scene
   * @param {{key:THREE.DirectionalLight}} lights
   * @param {(zone:object)=>void} onEnter 새 지역에 들어섰을 때
   */
  constructor(scene, lights, onEnter) {
    this.scene = scene;
    this.lights = lights;
    this.onEnter = onEnter;
    this.current = DEFAULT;
    this.visited = new Set([DEFAULT.id]);

    this._fog = new THREE.Color(DEFAULT.fog);
    this._amb = new THREE.Color(DEFAULT.ambient);
    this._near = DEFAULT.fogNear;
    this._far = DEFAULT.fogFar;
    this._light = DEFAULT.light;

    this.ambient = scene.children.find((o) => o.isAmbientLight) ?? null;
  }

  update(dt, x, z) {
    const zn = zoneAt(x, z);
    if (zn.id !== this.current.id) {
      this.current = zn;
      const first = !this.visited.has(zn.id);
      this.visited.add(zn.id);
      this.onEnter?.(zn, first);
    }

    // 지역 값으로 서서히 수렴
    const k = Math.min(1, dt * 0.8);
    this._fog.lerp(new THREE.Color(zn.fog), k);
    this._amb.lerp(new THREE.Color(zn.ambient), k);
    this._near += (zn.fogNear - this._near) * k;
    this._far += (zn.fogFar - this._far) * k;
    this._light += (zn.light - this._light) * k;

    if (this.scene.fog) {
      this.scene.fog.color.copy(this._fog);
      this.scene.fog.near = this._near;
      this.scene.fog.far = this._far;
    }
    if (this.ambient) this.ambient.color.copy(this._amb);
    if (this.lights?.key) this.lights.key.intensity = this._light;
  }
}
