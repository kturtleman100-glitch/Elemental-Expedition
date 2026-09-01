import * as THREE from "three";
import { toonMaterial } from "../fx/Style.js";
import { familyFx } from "../fx/Particles.js";

// 마법 투사체.
//
// 마법형이 즉시 명중하면 "마법을 쓴다"는 느낌이 안 난다. 날아가는 것이 보이고,
// 그게 닿았을 때 터져야 한다. 대신 날아가는 시간만큼 빗나갈 수 있으니
// 마법형의 높은 위력에 대한 대가가 생긴다.
//
// 모든 투사체는 미리 만들어 둔 풀에서 꺼내 쓴다. 실행 중에 지오메트리를
// 새로 만들면 그때마다 프레임이 튄다.

const POOL_SIZE = 24;
const MAX_LIFE = 2.2;
const HIT_RADIUS = 1.1;

export class Projectiles {
  /**
   * @param {THREE.Scene} scene
   * @param {import('../fx/Particles.js').Particles} particles
   */
  constructor(scene, particles) {
    this.scene = scene;
    this.particles = particles;
    this.items = [];

    // 팔면체는 결정처럼 보여서 원소 마법에 어울리고, 면이 적어 가볍다
    this.geo = new THREE.OctahedronGeometry(0.22, 0);
    this.trailGeo = new THREE.OctahedronGeometry(0.11, 0);

    for (let i = 0; i < POOL_SIZE; i++) {
      const mesh = new THREE.Mesh(this.geo, toonMaterial(0xffffff));
      mesh.visible = false;
      mesh.frustumCulled = false;
      scene.add(mesh);
      this.items.push({
        mesh,
        active: false,
        vel: new THREE.Vector3(),
        life: 0,
        damage: null,
        owner: null,
        fromPlayer: false,
        family: null,
      });
    }
  }

  /**
   * @param {object} opts
   * @param {THREE.Vector3|{x,y,z}} opts.from
   * @param {{x:number,z:number}} opts.toward 목표 지점 (수평만 본다)
   * @param {number} opts.speed
   * @param {object} opts.element 발사한 원소 — 색과 파티클을 정한다
   * @param {object} opts.damage computeDamage 결과 (명중 시 그대로 적용)
   * @param {boolean} opts.fromPlayer 플레이어가 쐈는가
   * @param {object} [opts.target] 락온 대상이 있으면 살짝 유도한다
   */
  fire(opts) {
    const p = this.items.find((x) => !x.active);
    if (!p) return null; // 풀이 가득 차면 이번 발은 버린다

    const fx = familyFx(opts.element.family);
    p.mesh.material = toonMaterial(fx.color, { emissive: fx.color });

    const dx = opts.toward.x - opts.from.x;
    const dz = opts.toward.z - opts.from.z;
    const len = Math.hypot(dx, dz) || 1;

    p.mesh.position.set(opts.from.x, opts.from.y, opts.from.z);
    p.mesh.visible = true;
    p.mesh.scale.setScalar(1);
    p.vel.set((dx / len) * opts.speed, 0, (dz / len) * opts.speed);
    p.life = MAX_LIFE;
    p.active = true;
    p.damage = opts.damage;
    p.fromPlayer = !!opts.fromPlayer;
    p.family = opts.element.family;
    p.target = opts.target ?? null;
    p.speed = opts.speed;

    return p;
  }

  /**
   * @param {number} dt
   * @param {import('./Enemy.js').Enemy[]} enemies
   * @param {import('../player/Player.js').Player} player
   * @param {(hit:object, result:object)=>void} onHit
   */
  update(dt, enemies, player, onHit) {
    for (const p of this.items) {
      if (!p.active) continue;

      p.life -= dt;
      if (p.life <= 0) { this._retire(p); continue; }

      // 락온 대상이 있으면 아주 약하게 유도한다. 완전히 따라가면 피할 수 없고,
      // 전혀 안 따라가면 움직이는 적을 맞힐 수 없다.
      if (p.target && p.target.alive) {
        const tx = p.target.position.x - p.mesh.position.x;
        const tz = p.target.position.z - p.mesh.position.z;
        const tl = Math.hypot(tx, tz) || 1;
        p.vel.x += ((tx / tl) * p.speed - p.vel.x) * Math.min(1, 2.2 * dt);
        p.vel.z += ((tz / tl) * p.speed - p.vel.z) * Math.min(1, 2.2 * dt);
      }

      p.mesh.position.addScaledVector(p.vel, dt);
      p.mesh.rotation.x += dt * 6;
      p.mesh.rotation.y += dt * 8;

      // 꼬리 — 지나간 자리에 입자를 조금씩 흘린다
      this.particles.emit(p.mesh.position, p.family, dt, 40);

      // ---- 명중 판정 ----
      if (p.fromPlayer) {
        for (const e of enemies) {
          if (!e.alive) continue;
          const dx = e.position.x - p.mesh.position.x;
          const dz = e.position.z - p.mesh.position.z;
          if (dx * dx + dz * dz > HIT_RADIUS * HIT_RADIUS) continue;
          onHit?.(e, p.damage);
          this._burst(p);
          this._retire(p);
          break;
        }
      } else {
        const dx = player.position.x - p.mesh.position.x;
        const dz = player.position.z - p.mesh.position.z;
        if (dx * dx + dz * dz <= HIT_RADIUS * HIT_RADIUS) {
          player.takeDamage(p.damage, p.owner);
          this._burst(p);
          this._retire(p);
        }
      }
    }
  }

  _burst(p) {
    this.particles.burst(p.mesh.position, p.family, 1.1);
  }

  _retire(p) {
    p.active = false;
    p.mesh.visible = false;
    p.target = null;
    p.damage = null;
  }

  get activeCount() { return this.items.filter((p) => p.active).length; }
}
