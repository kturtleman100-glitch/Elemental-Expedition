import * as THREE from "three";
import { blendAmbience } from "./Biome.js";

// 지역의 분위기 전환.
//
// 예전에는 좌표에 원을 다섯 개 그려 두고 그 안에 들어가면 안개를 바꿨다.
// 대륙이 무한해지면서 그 방식은 못 쓴다 — 원을 무한히 그릴 수는 없다.
// 이제는 지형이 알려주는 바이옴을 그대로 따른다. 바이옴이 곧 지역이다.
//
// 여전히 중요한 원칙 하나는 그대로다. 경계에서 즉시 바꾸면 화면이 번쩍이므로
// 언제나 보간한다. 게다가 이제는 경계 자체가 노이즈라 들쭉날쭉해서,
// 주변 네 점을 함께 보고 섞어야 경계를 오갈 때 깜빡이지 않는다.

export class ZoneManager {
  /**
   * @param {THREE.Scene} scene
   * @param {{key:THREE.DirectionalLight}} lights
   * @param {import('./Terrain.js').Terrain} terrain
   * @param {(biome:object, first:boolean)=>void} onEnter 새 바이옴에 들어섰을 때
   */
  constructor(scene, lights, terrain, onEnter) {
    this.scene = scene;
    this.lights = lights;
    this.terrain = terrain;
    this.onEnter = onEnter;

    this.current = terrain.biomeAt(0, 0);
    this.visited = new Set([this.current.id]);

    const a = this.current.ambience;
    this._fog = new THREE.Color(a.fog);
    this._near = a.near;
    this._far = a.far;
    this._ambient = a.ambient;
    this._sun = a.sun;

    this.ambientLight = scene.children.find((o) => o.isAmbientLight) ?? null;
    // 기준 밝기를 기억해 둔다. 바이옴 값은 이것에 곱하는 배율이다 —
    // 절댓값으로 두면 나중에 조명을 손볼 때 바이옴을 전부 다시 맞춰야 한다.
    this._baseSun = lights?.key?.intensity ?? 1.45;
    this._baseAmbient = this.ambientLight?.intensity ?? 0.6;

    this._tick = 0;
  }

  update(dt, x, z) {
    // 바이옴 판정은 노이즈 계산이라 매 틱 돌릴 만큼 싸지 않다.
    // 0.2초에 한 번이면 걸어서는 경계를 눈치채지 못한다.
    this._tick -= dt;
    if (this._tick <= 0) {
      this._tick = 0.2;
      this._sample(x, z);
    }

    // 목표값으로 서서히 수렴
    const k = Math.min(1, dt * 0.7);
    const t = this._target ?? this.current.ambience;
    this._fog.lerp(new THREE.Color(t.fog), k);
    this._near += (t.near - this._near) * k;
    this._far += (t.far - this._far) * k;
    this._ambient += (t.ambient - this._ambient) * k;
    this._sun += (t.sun - this._sun) * k;

    if (this.scene.fog) {
      this.scene.fog.color.copy(this._fog);
      this.scene.fog.near = this._near;
      this.scene.fog.far = this._far;
    }
    if (this.ambientLight) this.ambientLight.intensity = this._baseAmbient * this._ambient;
    if (this.lights?.key) this.lights.key.intensity = this._baseSun * this._sun;
  }

  /** 주변을 둘러보고 목표 분위기를 정한다 */
  _sample(x, z) {
    const { biome, neighbors } = this.terrain.sampleAround(x, z);

    // 이웃 중 다른 바이옴이 얼마나 되는지로 섞는 정도를 정한다.
    // 경계 한복판이면 절반씩 섞여 부드럽게 넘어간다.
    const other = neighbors.find((n) => n.id !== biome.id);
    if (other) {
      const share = neighbors.filter((n) => n.id !== biome.id).length / neighbors.length;
      this._target = blendAmbience(biome, other, share * 0.5);
    } else {
      this._target = biome.ambience;
    }

    if (biome.id !== this.current.id) {
      this.current = biome;
      const first = !this.visited.has(biome.id);
      this.visited.add(biome.id);
      this.onEnter?.(biome, first);
    }
  }

  /** 저장에 남길 것 — 어떤 땅을 봤는지 */
  toJSON() { return [...this.visited]; }
  fromJSON(arr) { this.visited = new Set(arr || []); }
}
