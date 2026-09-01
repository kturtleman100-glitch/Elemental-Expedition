import * as THREE from "three";
import { Enemy } from "./Enemy.js";
import { getElement } from "../data/elements.js";
import { getBoss, BOSS_TIER } from "../data/bosses.js";

// 보스.
//
// Enemy를 상속해 이동·공격은 그대로 쓰고, 여기서는 **페이즈와 기믹**만 얹는다.
// 보스가 일반 적과 다른 점은 체력이 많다는 게 아니라 "싸우는 방식이 도중에
// 바뀐다"는 것이다. 그래서 hp 비율에 따라 페이즈를 넘기고 기믹을 켠다.

export class Boss extends Enemy {
  /**
   * @param {object} opts { bossId, authority, outlines }
   */
  constructor({ bossId, authority = true, outlines = true }) {
    const def = getBoss(bossId);
    if (!def) throw new Error(`보스 정의 없음: ${bossId}`);

    super({
      elementId: def.elementId,
      x: def.x, z: def.z,
      level: def.level,
      authority, outlines,
    });

    this.def = def;
    this.isBoss = true;
    this.tier = def.tier;

    // 보스는 체력 배수를 따로 받는다. Enemy의 TUNING.hp가 이미 곱해진 뒤라
    // 여기서 한 번 더 곱해 최종값을 만든다.
    this.hpMax = Math.round(this.hpMax * def.hpMult);
    this.hp = this.hpMax;

    this.phaseIndex = -1;
    this.gimmicks = new Set();
    this.timer = 0;          // 임계 페이즈의 붕괴 타이머
    this.timerRunning = false;
    this.persuadable = false; // 설득 창이 열렸는가
    this.defeated = false;

    // 보스는 뒤로 물러나지 않는다 — 자기 자리를 지킨다
    this.speed = 3.0;

    this.onPhase = null;      // (phase) => void
    this.onTimerEnd = null;   // () => void
  }

  /** 보스는 항상 깨어 있다 (거리 컬링에서 제외) */
  get alwaysAwake() { return true; }

  update(dt, player, particles, collision, projectiles) {
    if (this.state !== "dead") this._checkPhase(player);

    if (this.timerRunning) {
      this.timer -= dt;
      if (this.timer <= 0) {
        this.timerRunning = false;
        this.onTimerEnd?.();
      }
    }

    super.update(dt, player, particles, collision, projectiles);

    // 기믹 지속 효과
    if (this.gimmicks.has("radiation_field") && particles) {
      particles.emit({ x: this.position.x, y: 0.6, z: this.position.z }, this.element.family, dt, 26);
    }
    if (this.gimmicks.has("poison_field") && particles) {
      particles.emit({ x: this.position.x, y: 0.4, z: this.position.z }, this.element.family, dt, 14);
    }
  }

  _checkPhase(player) {
    const ratio = this.hp / this.hpMax;
    const phases = this.def.phases ?? [];

    // 아래로 내려가며 조건을 만족하는 가장 낮은 페이즈를 찾는다
    let next = this.phaseIndex;
    for (let i = 0; i < phases.length; i++) {
      if (ratio <= phases[i].at) next = i;
    }
    if (next === this.phaseIndex) return;

    this.phaseIndex = next;
    const ph = phases[next];
    this.gimmicks.add(ph.gimmick);

    // 페이즈마다 능력이 조금씩 오른다
    this.attack = Math.round(this.attack * 1.12);
    this.style = { ...this.style, cooldown: this.style.cooldown * 0.9 };

    if (ph.gimmick === "critical" && ph.timer) {
      this.timer = ph.timer;
      this.timerRunning = true;
    }
    if (ph.gimmick === "persuade_window") this.persuadable = true;
    // 액체 변형 — 근접 피해를 흘린다
    if (ph.gimmick === "liquid_form") this.meleeResist = 0.45;
    if (ph.gimmick === "reflect") this.reflect = 0.2;

    this.onPhase?.(ph, next);
  }

  /** 무기형 공격을 흘리는 기믹을 여기서 처리한다 */
  takeDamage(result, opts = {}) {
    if (this.meleeResist && !opts.projectile) {
      result = { ...result, amount: Math.max(1, Math.round(result.amount * (1 - this.meleeResist))) };
    }
    const died = super.takeDamage(result);
    if (died) {
      this.defeated = true;
      this.timerRunning = false;
    }
    return died;
  }

  /** 설득 — 염소 전용. 창이 열렸을 때만 성공한다 */
  tryPersuade() {
    if (!this.persuadable || !this.def.persuade) return false;
    this.state = "dead";
    this.defeated = true;
    this.persuaded = true;
    this.timerRunning = false;
    return true;
  }

  get lines() {
    return {
      intro: this.def.intro ?? [],
      defeat: this.persuaded ? (this.def.persuade ?? []) : (this.def.defeat ?? []),
    };
  }

  /** 보스는 경험치를 훨씬 많이 준다 */
  get expReward() {
    const base = super.expReward;
    const mult = this.tier === BOSS_TIER.DOOM ? 12 : this.tier === BOSS_TIER.MID ? 6 : 3;
    return Math.round(base * mult);
  }
}

/**
 * 보스전 진행 관리.
 *
 * 조우 → 등장 대사 → 전투 → 페이즈 대사 → 격파 대사 → 보상.
 * 대사는 Dialogue를 재사용하지 않고 화면 하단 자막으로 띄운다 —
 * 전투 중에 조작을 뺏으면 안 되기 때문이다.
 */
export class BossFight {
  /**
   * @param {THREE.Scene} scene
   * @param {object} hooks { onIntro, onPhase, onDefeat, onTimerEnd, subtitle }
   */
  constructor(scene, hooks = {}) {
    this.scene = scene;
    this.hooks = hooks;
    this.boss = null;
    this.active = false;
    this.introShown = false;
  }

  /** @param {string} bossId */
  start(bossId, loader, outlines = true) {
    if (this.boss) this.clear();

    const boss = new Boss({ bossId, outlines });
    this.scene.add(boss.mesh);

    boss.onPhase = (ph) => {
      this.hooks.subtitle?.(`${boss.def.name} — ${ph.name}`, ph.say, boss.def.color);
      this.hooks.onPhase?.(boss, ph);
    };
    boss.onTimerEnd = () => this.hooks.onTimerEnd?.(boss);

    // VRM이 있으면 갈아끼운다
    if (loader) {
      loader.build(boss.element).then((model) => {
        if (model.userData.source === "vrm" && boss.mesh) boss.setModel(model, this.scene);
      }).catch(() => {});
    }

    this.boss = boss;
    this.active = true;
    this.introShown = false;
    return boss;
  }

  update(dt, player, particles, collision, projectiles) {
    if (!this.boss || !this.active) return;

    const b = this.boss;
    const d = Math.hypot(b.position.x - player.position.x, b.position.z - player.position.z);

    // 조우 — 가까이 가면 등장 대사
    if (!this.introShown && d < 18) {
      this.introShown = true;
      this.hooks.onIntro?.(b);
    }

    b.update(dt, player, particles, collision, projectiles);

    if (b.defeated && !b._rewarded) {
      b._rewarded = true;
      this.hooks.onDefeat?.(b);
    }
  }

  clear() {
    if (this.boss) this.boss.dispose(this.scene);
    this.boss = null;
    this.active = false;
  }
}
