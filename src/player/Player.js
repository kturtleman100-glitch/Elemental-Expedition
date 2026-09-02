import * as THREE from "three";
import { buildCharacter, animateCharacter, BODY } from "../characters/CharacterBuilder.js";
import { animateVRM, updateCharacter } from "../characters/CharacterLoader.js";
import { PLAYER_ELEMENT, getElement } from "../data/elements.js";
import { ElectronPool, electronRole, ELECTRON_ROLE } from "../combat/Electron.js";
import { statsFor, styleOf, canAttack, isHybrid, HYBRID_MODE } from "../combat/CombatStyle.js";
import { computeDamage, affinity } from "../combat/DamageCalc.js";
import { Progress } from "./Progress.js";

// 이동은 매 틱(고정 dt)에 계산되고, position/prevPosition 두 벌을 들고 있다가
// 렌더 시 alpha로 보간한다 — 그래야 논리 틱 레이트와 화면 프레임률이 달라도
// 움직임이 매끄럽다. (계획서: 적응형 고정 틱 루프)

const MOVE_SPEED = 5.2; // m/s
const JUMP_SPEED = 6.0;
const GRAVITY = -18;
const RADIUS = 0.3;
const HEIGHT = BODY.height;
const EYE_HEIGHT = BODY.headY;

// 물 — 이 깊이를 넘으면 발이 닿지 않아 헤엄친다
const SWIM_DEPTH = 1.35;
const SWIM_SUBMERGE = 1.05;   // 수면 아래로 이만큼 잠긴 채 뜬다
const WATER_SURFACE = -1.2;   // Terrain.WATER_LEVEL 과 같아야 한다

export class Player {
  /**
   * @param {THREE.Vector3} spawnPos
   * @param {import('../world/Collision.js').Collision} collision
   * @param {{outlines?: boolean}} [opts]
   */
  constructor(spawnPos, collision, opts = {}) {
    this.collision = collision;
    // 지형이 있으면 그 높이를 따라 걷는다. 없으면 평지로 친다 —
    // 이 인자를 필수로 두면 시험 코드에서 Player만 떼어 쓰기 어려워진다.
    this.terrain = opts.terrain ?? null;

    this.position = spawnPos.clone();
    this.prevPosition = spawnPos.clone();
    this.velocityY = 0;
    this.onGround = true;
    this.moveSpeed01 = 0; // 0=정지, 1=전력. 걷기 애니메이션 강도에 쓴다
    this.animTime = 0;

    this.yaw = 0; // 이동/모델 방향에 쓰는 수평 회전 (카메라 yaw를 따라감)

    // 119번 원소 — 이름도 족도 없는 플레이어.
    // assets/models/uue.glb 가 생기면 CharacterLoader가 이 결과물을 대체한다.
    this.mesh = buildCharacter(PLAYER_ELEMENT, { outlines: opts.outlines !== false });
    this.mesh.position.copy(this.position);
    this.mesh.visible = false; // 기본은 1인칭이므로 숨김 — CameraRig가 모드에 따라 토글

    // ---- 전투 상태 ----
    // 플레이어는 119번이라 자기 원소가 없다. 장착한 원소의 힘을 빌려 싸운다.
    this.progress = new Progress();
    this.element = PLAYER_ELEMENT;   // 기본값. 원소를 장착하면 그쪽으로 바뀐다
    this.activeSlot = 0;

    const st = statsFor(PLAYER_ELEMENT, 1);
    this.hpMax = st.hpMax;
    this.hp = st.hpMax;
    this.attack = st.attack;
    this.defense = st.defense;
    this.electrons = new ElectronPool(PLAYER_ELEMENT, st.electronsMax);

    this.cooldown = 0;
    this.invuln = 0;
    // 공격 모션 — 쿨타임과 별개로 굴린다. 쿨타임이 짧아도 동작은 끝까지 나와야 한다
    this.attackAnim = 0;
    this.attackAnimDur = 0.42;
    this.outOfCombat = 0; // 0이 되면 체력이 회복된다
    this.hybridMode = HYBRID_MODE.STRIKER;
    this.bondMult = { hp: 1, attack: 1, defense: 1, electrons: 1 }; // T 키로 전환. 하이브리드 원소에만 의미가 있다
    this.dead = false;
    this.onDamaged = null;   // (result, source) => void
    this.onDeath = null;
  }

  /** 하이브리드 원소의 무기/마법 자세 전환 (T). @returns {string|null} 바뀐 자세 */
  toggleStance() {
    if (!isHybrid(this.element)) return null;
    this.hybridMode = this.hybridMode === HYBRID_MODE.STRIKER
      ? HYBRID_MODE.CASTER : HYBRID_MODE.STRIKER;
    return this.hybridMode;
  }

  get style() { return styleOf(this.element, this.hybridMode); }

  /** 장착 슬롯 전환 — 숫자키 1~4 */
  setSlot(i) {
    const id = this.progress.equipped[i];
    if (!id) return false;
    this.activeSlot = i;
    this.element = getElement(id) ?? PLAYER_ELEMENT;
    this._recalcStats();
    return true;
  }

  /** 레벨이나 장착 원소가 바뀌면 능력치를 다시 계산한다 */
  _recalcStats() {
    const st = statsFor(this.element, this.progress.level);
    // 인연 보너스는 편성에서 나온다. main이 applyBonds()로 채워준다.
    const m = this.bondMult ?? { hp: 1, attack: 1, defense: 1, electrons: 1 };
    const hpRatio = this.hpMax > 0 ? this.hp / this.hpMax : 1;
    this.hpMax = Math.round(st.hpMax * m.hp);
    this.hp = Math.min(this.hpMax, Math.max(1, this.hpMax * hpRatio));
    this.attack = Math.round(st.attack * m.attack);
    this.defense = Math.round(st.defense * m.defense);
    this.electrons.max = Math.round(st.electronsMax * m.electrons);
    this.electrons.element = this.element;
    this.electrons.role = electronRole(this.element);
  }

  /**
   * 공격. 사거리 안의 적을 때린다.
   * @returns {{hit:import('../combat/Enemy.js').Enemy, result:object}|null}
   */
  /**
   * 공격. 근접이면 즉시 판정하고, 마법이면 투사체를 쏜다.
   * @returns {{kind:"melee"|"cast"|"miss", ...}|null}
   */
  tryAttack(enemies, cameraYaw, lockTarget = null) {
    const check = canAttack(this.element, this.electrons, this.cooldown, this.hybridMode);
    if (!check.ok) return null;

    const style = check.style;
    this.cooldown = style.cooldown;
    this.attackAnim = this.attackAnimDur;
    this.electrons.spend(style.electronCost);

    // 카메라가 보는 방향 기준 부채꼴 안에서 가장 가까운 적
    let best = null, bestDist = Infinity;
    for (const e of enemies) {
      if (!e.alive) continue;
      const dx = e.position.x - this.position.x;
      const dz = e.position.z - this.position.z;
      const dist = Math.hypot(dx, dz);
      if (dist > style.range) continue;

      const bearing = Math.atan2(dx, dz);
      const off = Math.abs(((bearing - cameraYaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
      const arc = style.projectile ? 0.55 : 0.9;
      if (off > arc) continue;

      if (dist < bestDist) { bestDist = dist; best = e; }
    }

    // ---- 마법: 적이 없어도 쏜다. 날아가는 게 보여야 마법을 쓴 느낌이 난다 ----
    if (style.projectile) {
      const aim = best ?? lockTarget;
      const dir = aim
        ? { x: aim.position.x, z: aim.position.z }
        : {
            x: this.position.x + Math.sin(cameraYaw) * style.range,
            z: this.position.z + Math.cos(cameraYaw) * style.range,
          };
      return { kind: "cast", style, aimAt: dir, target: aim, critical: Math.random() < 0.12 };
    }

    // ---- 근접: 즉시 판정 ----
    if (!best) return { kind: "miss", style };

    const critical = Math.random() < 0.12;
    const result = computeDamage(
      { element: this.element, attack: this.attack },
      { element: best.element, defense: best.defense },
      { power: style.power, isCritical: critical }
    );

    const died = best.takeDamage(result);
    this._steal(best, result.amount);

    return { kind: "melee", hit: best, result, died, style };
  }

  /** 투사체가 명중했을 때 호출 — 피해 계산을 여기서 한다 */
  resolveHit(enemy, critical = false) {
    const style = this.style;
    const result = computeDamage(
      { element: this.element, attack: this.attack },
      { element: enemy.element, defense: enemy.defense },
      { power: style.power, isCritical: critical }
    );
    const died = enemy.takeDamage(result);
    this._steal(enemy, result.amount);
    return { result, died };
  }

  /** 흡수형은 때린 만큼 전자를 가져온다 */
  _steal(enemy, damage) {
    const stolen = ElectronPool.stealAmount(electronRole(this.element), damage);
    if (stolen > 0) {
      this.electrons.gain(stolen);
      enemy.electrons.value = Math.max(0, enemy.electrons.value - stolen);
    }
  }

  /** 현재 장착 원소가 이 적에게 갖는 상성 */
  affinityTo(enemy) {
    if (!enemy) return null;
    return affinity(this.element, enemy.element);
  }

  takeDamage(result, source) {
    if (this.dead || this.invuln > 0) return;
    // 화합물의 차폐(방연석 등)가 걸려 있으면 여기서 깎인다.
    // 납이 방사선을 막는 것은 밀도의 문제라 무엇에게 맞든 똑같이 줄어든다.
    let taken = Math.max(1, Math.round(result.amount * (this.damageTakenMult ?? 1)));
    // 수정 장벽이 서 있으면 그것이 먼저 깎인다. 다 깎이면 남은 만큼만 몸으로 받는다.
    if (this.barrier > 0) {
      const absorbed = Math.min(this.barrier, taken);
      this.barrier -= absorbed;
      taken -= absorbed;
      this.onBarrierHit?.(absorbed, this.barrier);
      if (taken <= 0) { this.invuln = 0.5; return; }
    }
    this.hp -= taken;
    this.invuln = 0.5;      // 무적 시간을 늘려 연타에 갈리지 않게
    this.outOfCombat = 4;   // 맞았으니 회복 대기
    this.onDamaged?.(result, source);
    if (this.hp <= 0) {
      this.hp = 0;
      this.dead = true;
      this.onDeath?.();
    }
  }

  loseElectrons(amount) {
    this.electrons.value = Math.max(0, this.electrons.value - amount);
  }

  heal(amount) {
    this.hp = Math.min(this.hpMax, this.hp + amount);
  }

  /** 부활 — 마을 광장으로 돌려보낸다 */
  revive(spawn) {
    this.dead = false;
    this.hp = this.hpMax * 0.5;
    this.electrons.value = this.electrons.max * 0.5;
    this.position.copy(spawn);
    this.prevPosition.copy(spawn);
    this.velocityY = 0;
  }

  get eyeHeight() { return EYE_HEIGHT; }
  get radius() { return RADIUS; }

  /**
   * @param {number} dt 고정 틱 간격(초)
   * @param {import('../core/Input.js').Input} input
   * @param {number} cameraYaw 카메라가 바라보는 수평각 — 이동을 이 기준 상대좌표로 변환
   */
  /**
   * @param {number} dt
   * @param {object} input
   * @param {number} cameraYaw
   * @param {{position:{x:number,z:number}}|null} [faceTarget]
   *   락온한 상대. 있으면 몸이 늘 그쪽을 본다 — 옆으로 걸어도 상대를 마주 본다.
   */
  update(dt, input, cameraYaw, faceTarget = null) {
    this.prevPosition.copy(this.position);

    this.cooldown = Math.max(0, this.cooldown - dt);
    this.invuln = Math.max(0, this.invuln - dt);
    this.attackAnim = Math.max(0, this.attackAnim - dt);

    // 전투를 벗어나면 체력이 서서히 찬다. 회복 수단이 없으면 탐험이
    // 한 번의 실수로 끝나 버린다. 맞은 직후 4초 동안은 차지 않는다.
    this.outOfCombat = Math.max(0, this.outOfCombat - dt);
    if (this.outOfCombat <= 0 && !this.dead && this.hp < this.hpMax) {
      this.hp = Math.min(this.hpMax, this.hp + this.hpMax * 0.06 * dt);
    }

    // 전자 상태 — 과잉이면 자해, 고갈이면 느려진다
    const pool = this.electrons.update(dt);
    if (pool.selfDamage > 0 && !this.dead) {
      this.hp = Math.max(1, this.hp - pool.selfDamage);
    }
    // 전자 상태에 따른 배율 × 화합물(얼음길) 배율.
    // 둘을 곱해야 "전자가 마른 채로 얼음을 타면 여전히 느리다"가 성립한다.
    // 물속에서는 느려진다. 헤엄은 걷기보다도 느리다.
    const waterDrag = this.swimming ? 0.5 : this.inWater ? 0.72 : 1;
    const speedMult = pool.speedMult * (this.compoundSpeed ?? 1) * waterDrag;


    const { x: mx, z: mz } = input.moveVector;
    const hasInput = mx !== 0 || mz !== 0;

    if (hasInput) {
      // 카메라가 바라보는 방향 기준으로 입력을 월드 좌표로 변환.
      // CameraRig의 전방 벡터는 (sin(yaw), cos(yaw))이고, three.js 우수 좌표계에서
      // 그 방향을 바라볼 때 화면상의 오른쪽은 월드 -X 쪽이다. 우측 벡터 부호에 주의.
      const sin = Math.sin(cameraYaw), cos = Math.cos(cameraYaw);
      const worldX = -mx * cos + mz * sin;
      const worldZ = mx * sin + mz * cos;
      const len = Math.hypot(worldX, worldZ) || 1;
      const dirX = worldX / len, dirZ = worldZ / len;

      this.position.x += dirX * MOVE_SPEED * speedMult * dt;
      this.position.z += dirZ * MOVE_SPEED * speedMult * dt;
      this.yaw = Math.atan2(dirX, dirZ);
    }

    // 락온 중에는 이동 방향이 아니라 상대를 본다.
    //
    // 움직이는 쪽을 향하면 옆걸음질할 때 등을 보이게 되어, 분명 조준하고
    // 있는데 엉뚱한 데를 보고 때리는 것처럼 보인다. 각도는 부드럽게 좇는다 —
    // 즉시 돌리면 상대가 옆을 스칠 때 몸이 홱 꺾인다.
    if (faceTarget) {
      const tx = faceTarget.position.x - this.position.x;
      const tz = faceTarget.position.z - this.position.z;
      if (tx * tx + tz * tz > 0.04) {
        const want = Math.atan2(tx, tz);
        // -pi~pi로 감아 최단 방향으로 돈다
        let diff = want - this.yaw;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        this.yaw += diff * Math.min(1, dt * 12);
      }
    }

    // 점프 / 중력
    if (input.justPressed("jump") && this.onGround) {
      this.velocityY = JUMP_SPEED;
      this.onGround = false;
    }
    this.velocityY += GRAVITY * dt;
    this.position.y += this.velocityY * dt;

    // 충돌 보정 (수평만) — 지면 판정보다 먼저 해야 한다.
    // 밀려난 자리의 높이를 봐야 벽에 밀리며 언덕에 파묻히지 않는다.
    const resolved = this.collision.resolve(
      this.position.x, this.position.z, RADIUS,
      this.position.y, this.position.y + HEIGHT
    );
    this.position.x = resolved.x;
    this.position.z = resolved.z;

    const ground = this.terrain ? this.terrain.heightAt(this.position.x, this.position.z) : 0;

    // ---- 물 ----
    //
    // 지형이 수면보다 파여 있으면 그만큼 물이 고여 있다.
    // 얕으면 그냥 걸어 들어가고(첨벙거릴 뿐), 키를 넘게 깊으면 뜬다.
    // 바닥까지 가라앉히면 숨 시스템이 필요해지는데, 그건 이 게임의 이야기가 아니다.
    const depth = this.terrain ? this.terrain.waterDepth(this.position.x, this.position.z) : 0;
    this.inWater = depth > 0.35;
    this.swimming = depth > SWIM_DEPTH;

    if (this.swimming) {
      // 수면에 턱까지 잠긴 채로 뜬다
      const float = WATER_SURFACE - SWIM_SUBMERGE;
      this.position.y += (float - this.position.y) * Math.min(1, dt * 6);
      this.velocityY = 0;
      this.onGround = false;
      return this._finishUpdate(dt);
    }

    if (this.position.y <= ground) {
      // 비탈을 뛰어 내려갈 때 매번 착지 처리를 하면 걸음이 끊긴다.
      // 조금 파고든 정도는 그냥 지면에 붙여 준다.
      this.position.y = ground;
      this.velocityY = 0;
      this.onGround = true;
    } else if (this.position.y - ground > 0.05) {
      this.onGround = false;
    }

    this._finishUpdate(dt);
  }

  /**
   * 걷기 강도와 애니메이션.
   *
   * 헤엄칠 때는 위쪽에서 일찍 빠져나가므로, 두 경로가 함께 지나가도록
   * 따로 떼어 뒀다. 안 그러면 물에서 팔다리가 멈춘 채 떠 있게 된다.
   */
  _finishUpdate(dt) {
    // 실제 이동한 거리로 걷기 강도를 정한다 — 벽에 막혀 제자리면 걷지 않는다
    const dx = this.position.x - this.prevPosition.x;
    const dz = this.position.z - this.prevPosition.z;
    const travelled = Math.hypot(dx, dz);
    const target = Math.min(1, travelled / (MOVE_SPEED * dt));
    this.moveSpeed01 += (target - this.moveSpeed01) * Math.min(1, dt * 12);

    this.animTime += dt;
    // 타이머는 줄어드는 값이므로 0→1 진행도로 뒤집어 넘긴다
    const attackT = this.attackAnim > 0 ? 1 - this.attackAnim / this.attackAnimDur : null;
    if (this.mesh.userData.source === "vrm") {
      animateVRM(this.mesh, this.animTime, this.moveSpeed01, attackT);
      updateCharacter(this.mesh, dt);
    } else {
      animateCharacter(this.mesh, this.animTime, this.moveSpeed01, attackT);
    }

    this.mesh.rotation.y = this.yaw;
  }

  /**
   * 절차적 자리표시를 실제 모델(VRM)로 교체한다.
   * 비동기 로드가 끝난 뒤 main이 호출한다.
   * @param {THREE.Object3D} model
   * @param {THREE.Scene} scene
   */
  setModel(model, scene) {
    const wasVisible = this.mesh.visible;
    scene.remove(this.mesh);
    this.mesh = model;
    this.mesh.visible = wasVisible;
    this.mesh.position.copy(this.position);
    this.mesh.rotation.y = this.yaw;
    scene.add(this.mesh);
  }

  /** 렌더 시점에 보간된 위치로 모델을 배치 (CameraRig와 같은 alpha를 쓴다) */
  syncMesh(alpha) {
    const baseY = this.mesh.userData.hover ? this.mesh.position.y : 0;
    this.mesh.position.set(
      this.prevPosition.x + (this.position.x - this.prevPosition.x) * alpha,
      this.prevPosition.y + (this.position.y - this.prevPosition.y) * alpha + baseY,
      this.prevPosition.z + (this.position.z - this.prevPosition.z) * alpha
    );
  }

  /** 보간된 위치 (렌더용) */
  getRenderPosition(alpha, out = new THREE.Vector3()) {
    return out.lerpVectors(this.prevPosition, this.position, alpha);
  }
}
