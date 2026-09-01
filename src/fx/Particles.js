import * as THREE from "three";
import { FAMILY } from "../data/elements.js";

// 족별 파티클.
//
// 같은 "공격"이라도 알칼리 금속은 폭발 스파크가, 할로겐은 부식 안개가,
// 방사성은 발광 입자가 나와야 원소가 다르다는 게 눈으로 읽힌다.
//
// 전부 하나의 Points로 묶어 드로우콜 1회로 그린다. 죽은 입자는 화면 밖으로
// 치워두고 재사용하므로 실행 중 할당이 없다.

const MAX = 900;

const FAMILY_FX = {
  [FAMILY.ALKALI]:     { color: 0xffd45c, size: 0.22, speed: 7.5, gravity: -6, life: 0.55, burst: 26, spread: 1.0 },
  [FAMILY.ALKALINE]:   { color: 0xfff0c0, size: 0.18, speed: 5.5, gravity: -3, life: 0.7,  burst: 20, spread: 0.8 },
  [FAMILY.TRANSITION]: { color: 0xffa54a, size: 0.15, speed: 6.0, gravity: -9, life: 0.45, burst: 22, spread: 0.7 },
  [FAMILY.PRECIOUS]:   { color: 0xffe08a, size: 0.16, speed: 4.5, gravity: -2, life: 0.9,  burst: 24, spread: 0.9 },
  [FAMILY.NONMETAL]:   { color: 0x8fd4ff, size: 0.19, speed: 5.0, gravity: -1, life: 0.8,  burst: 20, spread: 1.1 },
  [FAMILY.METALLOID]:  { color: 0xc4a8f0, size: 0.17, speed: 5.2, gravity: -2, life: 0.7,  burst: 20, spread: 0.9 },
  [FAMILY.HALOGEN]:    { color: 0xa8e05a, size: 0.28, speed: 2.2, gravity: 0.6, life: 1.4, burst: 30, spread: 1.6 },
  [FAMILY.NOBLE]:      { color: 0xd8c0ff, size: 0.14, speed: 3.0, gravity: 0.4, life: 1.1, burst: 16, spread: 1.2 },
  [FAMILY.RADIOACTIVE]:{ color: 0x7cff6a, size: 0.20, speed: 4.0, gravity: -0.5, life: 1.3, burst: 28, spread: 1.3 },
  [FAMILY.UNKNOWN]:    { color: 0xe8e4dc, size: 0.18, speed: 5.0, gravity: -3, life: 0.7,  burst: 20, spread: 1.0 },
};

export function familyFx(family) {
  return FAMILY_FX[family] ?? FAMILY_FX[FAMILY.UNKNOWN];
}

export class Particles {
  /** @param {THREE.Scene} scene */
  constructor(scene, { max = MAX } = {}) {
    this.max = max;
    this.pos = new Float32Array(max * 3);
    this.vel = new Float32Array(max * 3);
    this.col = new Float32Array(max * 3);
    this.life = new Float32Array(max);
    this.lifeMax = new Float32Array(max);
    this.grav = new Float32Array(max);
    this.size = new Float32Array(max);
    this.cursor = 0;
    this._wasEmpty = true;
    this.enabled = true;

    // 죽은 입자는 카메라 뒤 먼 곳에 세워둔다 (크기 0이면 셰이더에서 나눗셈이 생긴다)
    for (let i = 0; i < max; i++) this.pos[i * 3 + 1] = -9999;

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(this.col, 3));
    geo.setAttribute("psize", new THREE.BufferAttribute(this.size, 1));

    const mat = new THREE.ShaderMaterial({
      uniforms: { uScale: { value: window.innerHeight * 0.5 } },
      vertexShader: `
        attribute float psize;
        varying vec3 vColor;
        uniform float uScale;
        void main() {
          vColor = color;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = psize * uScale / max(0.001, -mv.z);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        varying vec3 vColor;
        void main() {
          vec2 d = gl_PointCoord - vec2(0.5);
          float r = dot(d, d);
          if (r > 0.25) discard;
          // 가장자리를 부드럽게 — 사각형 티가 나면 싸구려로 보인다
          float a = smoothstep(0.25, 0.02, r);
          gl_FragColor = vec4(vColor, a);
        }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexColors: true,
    });

    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    scene.add(this.points);
    this.geo = geo;
    this.mat = mat;
  }

  onResize() {
    this.mat.uniforms.uScale.value = window.innerHeight * 0.5;
  }

  /**
   * 한 지점에서 터뜨린다.
   * @param {THREE.Vector3|{x,y,z}} at
   * @param {string} family 원소 족
   * @param {number} [scale] 세기 배율
   */
  burst(at, family, scale = 1) {
    if (this.enabled === false) return;
    const fx = familyFx(family);
    const c = new THREE.Color(fx.color);
    const n = Math.round(fx.burst * scale);

    for (let k = 0; k < n; k++) {
      const i = this.cursor;
      this.cursor = (this.cursor + 1) % this.max;

      // 구면 위 임의 방향
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const sp = fx.speed * (0.5 + Math.random() * 0.8) * scale;

      this.pos[i * 3] = at.x + (Math.random() - 0.5) * 0.25;
      this.pos[i * 3 + 1] = at.y + (Math.random() - 0.5) * 0.25;
      this.pos[i * 3 + 2] = at.z + (Math.random() - 0.5) * 0.25;

      this.vel[i * 3] = Math.sin(phi) * Math.cos(theta) * sp * fx.spread;
      this.vel[i * 3 + 1] = Math.cos(phi) * sp;
      this.vel[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * sp * fx.spread;

      // 색을 조금씩 흩어 균일하지 않게
      const j = 0.85 + Math.random() * 0.3;
      this.col[i * 3] = c.r * j;
      this.col[i * 3 + 1] = c.g * j;
      this.col[i * 3 + 2] = c.b * j;

      this.lifeMax[i] = fx.life * (0.7 + Math.random() * 0.6);
      this.life[i] = this.lifeMax[i];
      this.grav[i] = fx.gravity;
      this.size[i] = fx.size * (0.6 + Math.random() * 0.8) * scale;
    }
  }

  /** 지속되는 잔잔한 방출 (발광 코어·방사성 지대 등) */
  emit(at, family, dt, rate = 12) {
    if (Math.random() > rate * dt) return;
    this.burst(at, family, 0.12);
  }

  update(dt) {
    const { pos, vel, life, lifeMax, grav, size } = this;
    let active = 0;
    for (let i = 0; i < this.max; i++) {
      if (life[i] <= 0) continue;
      active++;

      life[i] -= dt;
      if (life[i] <= 0) {
        pos[i * 3 + 1] = -9999;
        size[i] = 0;
        continue;
      }

      vel[i * 3 + 1] += grav[i] * dt;
      pos[i * 3] += vel[i * 3] * dt;
      pos[i * 3 + 1] += vel[i * 3 + 1] * dt;
      pos[i * 3 + 2] += vel[i * 3 + 2] * dt;

      // 공기 저항 — 없으면 끝까지 쭉 뻗어 폭죽처럼 보인다
      const drag = 1 - 1.8 * dt;
      vel[i * 3] *= drag;
      vel[i * 3 + 2] *= drag;

      // 수명이 다할수록 작아진다
      const t = life[i] / lifeMax[i];
      size[i] = size[i] * 0.5 + (size[i] * t) * 0.5;
    }

    // 살아있는 입자가 없으면 GPU에 올릴 것도 없다.
    // 900개짜리 버퍼 3개를 매 프레임 올리는 건 그냥 낭비다.
    if (active === 0 && this._wasEmpty) return;
    this._wasEmpty = active === 0;

    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.color.needsUpdate = true;
    this.geo.attributes.psize.needsUpdate = true;
    this.points.visible = active > 0;
  }
}
