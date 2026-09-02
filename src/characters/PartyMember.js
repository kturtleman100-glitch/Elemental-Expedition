import * as THREE from "three";
import { animateCharacter } from "./CharacterBuilder.js";
import { animateVRM, updateCharacter } from "./CharacterLoader.js";
import { styleOf, statsFor } from "../combat/CombatStyle.js";
import { computeDamage } from "../combat/DamageCalc.js";
import { ElectronPool, electronRole } from "../combat/Electron.js";

// 동료 — 편성한 원소가 실제로 따라다니며 함께 싸운다.
//
// 편성 보너스만 있으면 "누구를 데려가는가"가 숫자에 불과하다.
// 눈앞에서 철이 검을 휘두르고 산소가 주문을 쏘아야 인연 시스템이 살아난다.
//
// 다만 플레이어의 시야를 가리면 안 되므로 뒤쪽 옆에 자리를 잡고,
// 전투 중에도 플레이어와 적 사이에 끼지 않게 옆으로 붙는다.

const FOLLOW_DIST = 3.2;      // 평소 플레이어와 유지할 거리
const FOLLOW_SPREAD = 1.5;    // 동료끼리 벌어질 간격
const CATCHUP_DIST = 9;       // 이보다 멀어지면 뛴다
const TELEPORT_DIST = 26;     // 이보다 멀면 순간이동으로 따라붙는다
const SPEED = 4.6;
const RUN_SPEED = 7.0;
const TURN_SPEED = 6;

export class PartyMember {
  /**
   * @param {object} element 원소 데이터
   * @param {THREE.Object3D} model CharacterLoader.build() 결과
   * @param {number} index 편성 순서 (자리 배치에 쓴다)
   * @param {number} level 플레이어 레벨을 따라간다
   */
  constructor(element, model, index, level = 1) {
    this.element = element;
    this.model = model;
    this.index = index;
    this.level = level;

    const s = statsFor(element, level);
    // 동료는 플레이어보다 약하게 — 주인공이 주역이어야 한다
    this.attack = Math.round(s.attack * 0.55);
    this.style = styleOf(element);
    this.electrons = new ElectronPool(element, s.electronsMax);
    this.role = electronRole(element);

    this.position = new THREE.Vector3();
    this.yaw = 0;
    this.cooldown = 1 + index * 0.4;   // 넷이 동시에 때리지 않게 흩어놓는다
    this.attackAnim = 0;
    this.attackAnimDur = 0.42;
    this.time = Math.random() * 8;
    this.moveSpeed01 = 0;
    this.placed = false;
  }

  /** 편성 순서에 따른 대기 위치 — 플레이어 뒤 좌우로 벌린다 */
  _homeOffset(playerYaw) {
    const side = this.index % 2 === 0 ? -1 : 1;
    const row = Math.floor(this.index / 2);
    const lx = side * FOLLOW_SPREAD * (1 + row * 0.5);
    const lz = -FOLLOW_DIST - row * 1.2;
    // 플레이어 기준 로컬 → 월드
    const c = Math.cos(playerYaw), s = Math.sin(playerYaw);
    return { x: lx * c + lz * s, z: -lx * s + lz * c };
  }

  /**
   * @param {number} dt
   * @param {import('../player/Player.js').Player} player
   * @param {import('../combat/Enemy.js').Enemy[]} enemies
   * @param {import('../world/Collision.js').Collision} collision
   * @param {object} deps { particles, projectiles, onHit }
   */
  update(dt, player, enemies, collision, deps = {}) {
    this.time += dt;
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.attackAnim = Math.max(0, this.attackAnim - dt);
    this.electrons.update(dt);

    // 첫 프레임엔 플레이어 옆에 그냥 놓는다
    if (!this.placed) {
      const o = this._homeOffset(player.yaw);
      this.position.set(player.position.x + o.x, 0, player.position.z + o.z);
      this.placed = true;
    }

    const toPlayer = Math.hypot(
      player.position.x - this.position.x,
      player.position.z - this.position.z
    );

    // 너무 멀어지면(벽에 걸렸거나 순간이동한 경우) 바로 따라붙는다
    if (toPlayer > TELEPORT_DIST) {
      const o = this._homeOffset(player.yaw);
      this.position.set(player.position.x + o.x, 0, player.position.z + o.z);
    }

    // ---- 목표 위치 정하기 ----
    const target = this._pickTarget(enemies);
    let goalX, goalZ;

    if (target) {
      // 적 옆으로 붙는다 — 플레이어와 적 사이를 막지 않도록 측면을 잡는다
      const dx = target.position.x - player.position.x;
      const dz = target.position.z - player.position.z;
      const len = Math.hypot(dx, dz) || 1;
      const side = this.index % 2 === 0 ? 1 : -1;
      const range = Math.max(1.6, this.style.range * 0.7);
      goalX = target.position.x - (dx / len) * range + (-dz / len) * side * 1.6;
      goalZ = target.position.z - (dz / len) * range + (dx / len) * side * 1.6;
    } else {
      const o = this._homeOffset(player.yaw);
      goalX = player.position.x + o.x;
      goalZ = player.position.z + o.z;
    }

    // ---- 이동 ----
    const gx = goalX - this.position.x;
    const gz = goalZ - this.position.z;
    const gd = Math.hypot(gx, gz);

    if (gd > 0.5) {
      const sp = toPlayer > CATCHUP_DIST ? RUN_SPEED : SPEED;
      const nx = this.position.x + (gx / gd) * sp * dt;
      const nz = this.position.z + (gz / gd) * sp * dt;
      const r = collision.resolve(nx, nz, 0.3, 0, 1.8);
      const moved = Math.hypot(r.x - this.position.x, r.z - this.position.z);
      this.position.x = r.x;
      this.position.z = r.z;
      this.moveSpeed01 = Math.min(1, moved / (sp * dt || 1));
    } else {
      this.moveSpeed01 += (0 - this.moveSpeed01) * Math.min(1, dt * 8);
    }

    // 지면을 따라간다. 지형에 높이가 생겼으므로 y를 두면 공중에 뜨거나 묻힌다.
    // 계단처럼 툭툭 끊기지 않게 부드럽게 좇는다 — 발밑이 갑자기 솟는 비탈에서
    // 그대로 대입하면 몸이 튀어 보인다.
    if (this.terrain) {
      const g = this.terrain.heightAt(this.position.x, this.position.z);
      this.position.y += (g - this.position.y) * Math.min(1, dt * 12);
    }

    // ---- 시선 ----
    const lookAt = target ?? player;
    const lx = lookAt.position.x - this.position.x;
    const lz = lookAt.position.z - this.position.z;
    if (Math.hypot(lx, lz) > 0.1) {
      const want = Math.atan2(lx, lz);
      let diff = ((want - this.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      this.yaw += diff * Math.min(1, TURN_SPEED * dt);
    }

    // ---- 공격 ----
    if (target && this.cooldown <= 0) {
      const d = Math.hypot(target.position.x - this.position.x, target.position.z - this.position.z);
      if (d <= this.style.range) this._attack(target, deps);
    }

    // ---- 표시 ----
    this.model.position.copy(this.position);
    this.model.rotation.y = this.yaw;
    const attackT = this.attackAnim > 0 ? 1 - this.attackAnim / this.attackAnimDur : null;
    if (this.model.userData.source === "vrm") {
      animateVRM(this.model, this.time, this.moveSpeed01, attackT);
      updateCharacter(this.model, dt);
    } else {
      animateCharacter(this.model, this.time, this.moveSpeed01, attackT);
    }
  }

  /** 플레이어 가까이 있는 적 중 하나 — 동료마다 다른 적을 맡게 흩는다 */
  _pickTarget(enemies) {
    const alive = enemies.filter((e) => e.alive &&
      Math.hypot(e.position.x - this.position.x, e.position.z - this.position.z) < 16);
    if (alive.length === 0) return null;
    return alive[this.index % alive.length];
  }

  _attack(target, deps) {
    this.cooldown = this.style.cooldown * 1.5; // 플레이어보다 느리게
    this.attackAnim = this.attackAnimDur;
    this.electrons.spend(this.style.electronCost);

    const result = computeDamage(
      { element: this.element, attack: this.attack },
      { element: target.element, defense: target.defense },
      { power: this.style.power }
    );

    if (this.style.projectile && deps.projectiles) {
      deps.projectiles.fire({
        from: { x: this.position.x, y: 1.15, z: this.position.z },
        toward: { x: target.position.x, z: target.position.z },
        speed: this.style.projectileSpeed ?? 22,
        element: this.element,
        damage: result,
        fromPlayer: true,   // 적에게 맞는다는 뜻
        target,
      });
      return;
    }

    const died = target.takeDamage(result);
    const stolen = ElectronPool.stealAmount(this.role, result.amount);
    if (stolen > 0) {
      this.electrons.gain(stolen);
      target.electrons.value = Math.max(0, target.electrons.value - stolen);
    }
    deps.onHit?.(target, result, died);
    deps.particles?.burst(
      { x: target.position.x, y: 1.1, z: target.position.z },
      this.element.family, 0.6
    );
  }

  dispose(scene) { scene.remove(this.model); }
}

/**
 * 편성이 바뀌면 동료를 다시 만든다.
 *
 * 매 프레임 확인하지 않고 편성 문자열이 바뀔 때만 부른다 —
 * VRM 로드가 끼어 있어서 자주 부르면 같은 파일을 반복해 붙이게 된다.
 */
export class PartyManager {
  /** @param {import('../world/Terrain.js').Terrain} [terrain] 지면을 따라 걷게 한다 */
  constructor(scene, loader, terrain = null) {
    this.scene = scene;
    this.loader = loader;
    this.terrain = terrain;
    this.members = [];
    this._sig = "";
  }

  /** @param {string[]} equipped 장착된 원소 id (플레이어가 쓰는 것 제외) */
  async sync(equipped, level, getElement, activeId) {
    // 플레이어가 직접 쓰는 원소는 동료로 세우지 않는다 — 둘이 겹쳐 보인다
    const ids = equipped.filter(Boolean).filter((id) => id !== activeId).slice(0, 3);
    const sig = ids.join(",") + "|" + level;
    if (sig === this._sig) return;
    this._sig = sig;

    for (const m of this.members) m.dispose(this.scene);
    this.members = [];

    const built = await Promise.all(ids.map((id) => {
      const el = getElement(id);
      return el ? this.loader.build(el).then((model) => ({ el, model })) : null;
    }));

    built.forEach((b, i) => {
      if (!b) return;
      this.scene.add(b.model);
      const m = new PartyMember(b.el, b.model, i, level);
      m.terrain = this.terrain;
      this.members.push(m);
    });
  }

  update(dt, player, enemies, collision, deps) {
    for (const m of this.members) m.update(dt, player, enemies, collision, deps);
  }

  setVisible(v) {
    for (const m of this.members) m.model.visible = v;
  }
}
