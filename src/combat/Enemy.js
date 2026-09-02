import * as THREE from "three";
import { getElement } from "../data/elements.js";
import { buildCharacter, animateCharacter } from "../characters/CharacterBuilder.js";
import { animateVRM, updateCharacter } from "../characters/CharacterLoader.js";
import { statsFor, styleOf, canAttack } from "./CombatStyle.js";
import { ElectronPool, electronRole, ELECTRON_ROLE } from "./Electron.js";
import { computeDamage } from "./DamageCalc.js";

// 적 — 원소가 적으로 나온다.
//
// 판정 주체(authority)를 처음부터 인자로 둔다. 싱글에서는 항상 자기 자신이지만
// 9단계 멀티플레이에서는 호스트만 판정해야 상태가 갈라지지 않는다.
// 나중에 끼워 넣으면 전투 코드를 통째로 뜯게 되므로 여기서 잡아둔다.

// ---- 밸런스 조정값 ----
//
// 적은 플레이어와 같은 공식(statsFor)으로 만들어지는데, 그대로 두면
// 1대1도 빠듯하고 여럿이 붙으면 손쓸 수가 없다. 적 쪽에만 곱하는 계수를 둬서
// 원소별 특성은 유지한 채 난이도만 낮춘다.
const TUNING = {
  damage: 0.5,    // 피해 절반
  hp: 0.8,        // 체력도 조금 낮춰 전투가 늘어지지 않게
  cooldown: 1.9,  // 공격 간격을 두 배 가까이
  windup: 2.6,    // 예고 동작을 길게 — 이게 있어야 피할 수 있다
};

const AGGRO_RANGE = 9.5;   // 14는 너무 멀어 지나가기만 해도 끌려온다
const LOSE_RANGE = 17;
const TURN_SPEED = 4;
const SEPARATION = 1.9;    // 적끼리 이 거리보다 가까우면 서로 밀어낸다

export const ENEMY_STATE = {
  IDLE: "idle",
  CHASE: "chase",
  ATTACK: "attack",
  HURT: "hurt",
  DEAD: "dead",
};

export class Enemy {
  /**
   * @param {object} opts
   * @param {string} opts.elementId
   * @param {number} opts.x
   * @param {number} opts.z
   * @param {number} [opts.level]
   * @param {boolean} [opts.authority] 이 개체의 판정을 내가 하는가
   */
  constructor({ elementId, x, z, level = 1, authority = true, outlines = true, terrain = null }) {
    this.element = getElement(elementId);
    this.level = level;
    this.authority = authority;

    const s = statsFor(this.element, level);
    this.hpMax = Math.round(s.hpMax * TUNING.hp);
    this.hp = this.hpMax;
    this.attack = s.attack;
    this.defense = s.defense;
    this.electrons = new ElectronPool(this.element, s.electronsMax);
    this.role = electronRole(this.element);

    // 원본 style은 공유 객체라 직접 고치면 플레이어까지 느려진다. 복사해서 쓴다.
    const base = styleOf(this.element, "striker"); // 적 하이브리드는 근접으로 고정
    this.style = {
      ...base,
      cooldown: base.cooldown * TUNING.cooldown,
      windup: base.windup * TUNING.windup,
    };

    // 지형이 있으면 그 높이에 세운다. 없으면 평지로 친다.
    this.terrain = terrain;
    const y = this.terrain ? this.terrain.heightAt(x, z) : 0;
    this.position = new THREE.Vector3(x, y, z);
    this.home = new THREE.Vector3(x, y, z);
    this.yaw = Math.random() * Math.PI * 2;
    this.state = ENEMY_STATE.IDLE;
    this.cooldown = 0;
    this.windup = 0;
    this.attackAnim = 0;
    this.attackAnimDur = 0.42;
    this.hurtFlash = 0;
    this.deadTimer = 0;
    this.time = Math.random() * 8;

    this.mesh = buildCharacter(this.element, { outlines });
    this.mesh.position.copy(this.position);
    this.speed = 3.4;
  }

  get alive() { return this.state !== ENEMY_STATE.DEAD; }

  /** 절차적 자리표시를 VRM으로 교체한다 (비동기 로드 후 Encounters가 호출) */
  setModel(model, scene) {
    scene.remove(this.mesh);
    this.mesh = model;
    this.mesh.position.copy(this.position);
    this.mesh.rotation.y = this.yaw;
    scene.add(this.mesh);
  }

  /**
   * @param {number} dt
   * @param {{position:THREE.Vector3, takeDamage:Function, element:object, defense:number}} player
   * @param {import('../fx/Particles.js').Particles} particles
   * @param {import('../world/Collision.js').Collision} collision
   */
  update(dt, player, particles, collision, projectiles) {
    this.time += dt;
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.attackAnim = Math.max(0, this.attackAnim - dt);
    this.hurtFlash = Math.max(0, this.hurtFlash - dt);

    if (this.state === ENEMY_STATE.DEAD) {
      this.deadTimer += dt;
      // 쓰러지며 가라앉는다. 기준은 0이 아니라 자기가 선 땅이다 —
      // 언덕 위에서 죽으면 땅속이 아니라 허공으로 꺼지게 된다
      this.mesh.position.y = this.position.y - Math.min(2.2, this.deadTimer * 1.6);
      this.mesh.rotation.z = Math.min(Math.PI / 2, this.deadTimer * 2.2);
      return;
    }

    const pool = this.electrons.update(dt);
    if (pool.selfDamage > 0) this.hp -= pool.selfDamage;

    const dx = player.position.x - this.position.x;
    const dz = player.position.z - this.position.z;
    const dist = Math.hypot(dx, dz);

    // ---- 상태 전이 (판정 주체만) ----
    if (this.authority) {
      if (this.state === ENEMY_STATE.IDLE && dist < AGGRO_RANGE) {
        this.state = ENEMY_STATE.CHASE;
      } else if (this.state !== ENEMY_STATE.IDLE && dist > LOSE_RANGE) {
        this.state = ENEMY_STATE.IDLE;
      }
    }

    let moveSpeed = 0;

    if (this.state === ENEMY_STATE.CHASE || this.state === ENEMY_STATE.ATTACK) {
      // 사거리 안이면 멈춰서 때리고, 밖이면 다가간다
      const inRange = dist <= this.style.range;
      this.state = inRange ? ENEMY_STATE.ATTACK : ENEMY_STATE.CHASE;

      const targetYaw = Math.atan2(dx, dz);
      let diff = ((targetYaw - this.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      this.yaw += diff * Math.min(1, TURN_SPEED * dt);

      if (!inRange && this.windup <= 0) {
        const sp = this.speed * pool.speedMult;
        const nx = this.position.x + (dx / dist) * sp * dt;
        const nz = this.position.z + (dz / dist) * sp * dt;
        const r = collision.resolve(nx, nz, 0.34, 0, 1.8);
        moveSpeed = Math.hypot(r.x - this.position.x, r.z - this.position.z) / (sp * dt || 1);
        this.position.x = r.x;
        this.position.z = r.z;
        // 언덕을 오르내린다. 그대로 대입하면 비탈에서 몸이 튀므로 부드럽게 좇는다
        if (this.terrain) {
          const g = this.terrain.heightAt(r.x, r.z);
          this.position.y += (g - this.position.y) * Math.min(1, dt * 12);
        }
      }

      // ---- 공격 ----
      if (this.windup > 0) {
        this.windup -= dt;
        if (this.windup <= 0 && this.authority) this._strike(player, particles, dist, projectiles);
      } else if (inRange) {
        const c = canAttack(this.element, this.electrons, this.cooldown);
        if (c.ok) {
          this.windup = this.style.windup;
          this.cooldown = this.style.cooldown;
          this.attackAnim = this.attackAnimDur;
        }
      }
    } else {
      // 제자리로 천천히 복귀
      const hx = this.home.x - this.position.x;
      const hz = this.home.z - this.position.z;
      const hd = Math.hypot(hx, hz);
      if (hd > 0.4) {
        const sp = this.speed * 0.5;
        this.position.x += (hx / hd) * sp * dt;
        this.position.z += (hz / hd) * sp * dt;
        this.yaw = Math.atan2(hx, hz);
        moveSpeed = 0.5;
      }
    }

    // y를 0으로 못 박으면 지형이 오르내려도 캐릭터는 그대로 있어 뜨거나 묻힌다
    this.mesh.position.copy(this.position);
    this.mesh.rotation.y = this.yaw;
    const attackT = this.attackAnim > 0 ? 1 - this.attackAnim / this.attackAnimDur : null;
    if (this.mesh.userData.source === "vrm") {
      animateVRM(this.mesh, this.time, moveSpeed, attackT);
      updateCharacter(this.mesh, dt);
    } else {
      animateCharacter(this.mesh, this.time, moveSpeed, attackT);
    }
  }

  _strike(player, particles, dist, projectiles) {
    if (dist > this.style.range * 1.3) return;

    this.electrons.spend(this.style.electronCost);

    const result = computeDamage(
      { element: this.element, attack: this.attack },
      { element: player.element, defense: player.defense },
      { power: this.style.power * TUNING.damage }
    );

    // 마법형은 투사체를 날린다. 날아오는 게 보이면 피할 수 있다.
    if (this.style.projectile && projectiles) {
      const p = projectiles.fire({
        from: { x: this.position.x, y: 1.2, z: this.position.z },
        toward: { x: player.position.x, z: player.position.z },
        speed: this.style.projectileSpeed ?? 18,
        element: this.element,
        damage: result,
        fromPlayer: false,
      });
      if (p) p.owner = this;
      return;
    }

    player.takeDamage(result, this);

    // 흡수형은 때린 만큼 전자를 가져간다
    const stolen = ElectronPool.stealAmount(this.role, result.amount);
    if (stolen > 0) {
      this.electrons.gain(stolen);
      player.loseElectrons?.(stolen);
    }

    if (particles) {
      particles.burst(
        { x: player.position.x, y: 1.0, z: player.position.z },
        this.element.family,
        0.7
      );
    }
  }

  /**
   * 다른 적과 겹치지 않게 밀어낸다. 없으면 셋이 한 점에 뭉쳐서
   * 동시에 때리는 바람에 피해가 세 배가 된다.
   */
  separate(others, dt) {
    if (!this.alive) return;
    for (const o of others) {
      if (o === this || !o.alive) continue;
      const dx = this.position.x - o.position.x;
      const dz = this.position.z - o.position.z;
      const d = Math.hypot(dx, dz);
      if (d > SEPARATION || d < 0.001) continue;
      const push = (SEPARATION - d) * 2.5 * dt;
      this.position.x += (dx / d) * push;
      this.position.z += (dz / d) * push;
    }
  }

  /**
   * @param {{amount:number, mult:number, label:string}} result
   * @returns {boolean} 이번 타격으로 쓰러졌는가
   */
  takeDamage(result) {
    if (!this.alive) return false;
    this.hp -= result.amount;
    this.hurtFlash = 0.18;
    if (this.state === ENEMY_STATE.IDLE) this.state = ENEMY_STATE.CHASE;

    if (this.hp <= 0) {
      this.hp = 0;
      this.state = ENEMY_STATE.DEAD;
      return true;
    }
    return false;
  }

  /** 경험치 — 레벨과 원자량에 비례 */
  get expReward() {
    return Math.round(12 + this.level * 8 + (this.element.mass ?? 20) * 0.12);
  }

  dispose(scene) {
    scene.remove(this.mesh);
  }
}
