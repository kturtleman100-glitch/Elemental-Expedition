import * as THREE from "three";
import { Enemy } from "./Enemy.js";

// 장판·오라 판정 주기(초)와 반경(m).
// 매 틱 판정하면 스치기만 해도 즉사하므로 반드시 간격을 둔다.
const AURA_INTERVAL = 0.5;
const POISON_RADIUS = 6.5;
const RADIATION_RADIUS = 13;
const RUST_RADIUS = 8;
const DRAIN_RADIUS = 11;
const CHARM_SECONDS = 8;
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
    this.onSummon = null;     // (spec[]) => void — 포탑처럼 개체를 부를 때
    this.onCharm = null;      // (seconds) => void — 동료를 잠시 빼앗을 때

    // 장판·오라는 0.5초마다 한 번씩만 판정한다.
    // 매 틱(120Hz) 피해를 주면 장판에 스치기만 해도 즉사한다.
    this._auraTick = 0;
    this._summoned = false;
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

    // 기믹 지속 효과 — 눈에 보이는 것
    if (this.gimmicks.has("radiation_field") && particles) {
      particles.emit({ x: this.position.x, y: 0.6, z: this.position.z }, this.element.family, dt, 26);
    }
    if (this.gimmicks.has("poison_field") && particles) {
      particles.emit({ x: this.position.x, y: 0.4, z: this.position.z }, this.element.family, dt, 14);
    }

    this._auraTick -= dt;
    if (this._auraTick <= 0) {
      this._auraTick = AURA_INTERVAL;
      this._applyAuras(player);
    }
  }

  /**
   * 장판과 오라.
   *
   * 예전에는 이 기믹들이 파티클만 뿌리고 아무 일도 하지 않았다 —
   * 보스가 화려하게 연출만 하고 실제로는 평타만 때린 셈이다.
   */
  _applyAuras(player) {
    if (this.state === "dead") return;
    const dx = player.position.x - this.position.x;
    const dz = player.position.z - this.position.z;
    const dist = Math.hypot(dx, dz);

    // 비소의 독 장판 — 가까이 오면 안 된다
    if (this.gimmicks.has("poison_field") && dist < POISON_RADIUS) {
      player.takeDamage({ amount: Math.round(this.attack * 0.22), mult: 1, label: "독" }, this);
    }

    // 폴로늄의 방사선 — 더 넓고 더 아프다. 붕괴 에너지에는 거리밖에 답이 없다
    if (this.gimmicks.has("radiation_field") && dist < RADIATION_RADIUS) {
      const falloff = 1 - dist / RADIATION_RADIUS;
      player.takeDamage({ amount: Math.round(this.attack * 0.3 * falloff) + 1, mult: 1, label: "방사선" }, this);
    }

    // 철의 산화 오라 — 곁에 있으면 장비가 삭는다
    if (this.gimmicks.has("rust_aura") && dist < RUST_RADIUS) {
      player.rustTimer = 2.0;   // Player가 이 값을 보고 방어를 깎는다
    }

    // 염소의 전자 탈취 — 맞지 않아도 빨려 나간다. 이것이 전자 친화팀의 수법이다
    if (this.gimmicks.has("drain") && dist < DRAIN_RADIUS && player.electrons) {
      const stolen = Math.min(player.electrons.value, 4);
      player.electrons.value -= stolen;
      this.hp = Math.min(this.hpMax, this.hp + stolen * 2);
    }

    // 비소는 독을 너무 많이 깔아 자기가 밟는다. 유도하면 자멸한다
    if (this.gimmicks.has("self_poison")) {
      this.hp = Math.max(1, this.hp - Math.round(this.hpMax * 0.012));
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
    // 액체 변형 — 근접 피해를 흘린다. 형태가 없으니 벨 수가 없다
    if (ph.gimmick === "liquid_form") this.meleeResist = 0.45;
    // 백금은 왕수로만 녹는다 — 받은 피해의 일부를 되돌린다
    if (ph.gimmick === "reflect") this.reflect = 0.25;
    // 촉매 — 반응을 빠르게 한다. 백금의 실제 쓰임이다
    if (ph.gimmick === "haste") {
      this.style = { ...this.style, cooldown: this.style.cooldown * 0.55 };
      this.speed *= 1.35;
    }
    // 정의의 철퇴 — 한 방이 무겁다
    if (ph.gimmick === "heavy_strike") this.attack = Math.round(this.attack * 1.5);
    // 아르곤 흉내 — 전자를 채워 비활성 기체처럼 반응하지 않는다.
    // 실제로는 양성자 수가 그대로라 결코 아르곤이 될 수 없다 — 그래서 완전하지 않다
    if (ph.gimmick === "mimic_argon") this.nobleMimic = 0.45;
    // 매혹 — 편성한 동료 하나를 잠시 빼앗는다.
    // 수은은 사람을 홀리는 나르시시스트이고, 진사(HgS)도 같은 효과를 낸다
    if (ph.gimmick === "charm") this.onCharm?.(CHARM_SECONDS);
    // 발명품 포탑 — 부수며 다가가야 한다
    if (ph.gimmick === "turrets" && !this._summoned) {
      this._summoned = true;
      this.onSummon?.(this._turretSpecs());
    }

    this.onPhase?.(ph, next);
  }

  /** 포탑을 세울 자리 — 보스를 둘러싸는 삼각형 */
  _turretSpecs() {
    const out = [];
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + 0.4;
      out.push({
        elementId: this.def.elementId,
        x: this.position.x + Math.sin(a) * 9,
        z: this.position.z + Math.cos(a) * 9,
        level: Math.max(1, this.level - 8),
      });
    }
    return out;
  }

  /** 피해를 흘리거나 되돌리는 기믹을 여기서 처리한다 */
  takeDamage(result, opts = {}) {
    if (this.meleeResist && !opts.projectile) {
      result = { ...result, amount: Math.max(1, Math.round(result.amount * (1 - this.meleeResist))) };
    }
    // 아르곤 흉내 — 반응하지 않으므로 무엇에게 맞든 덜 아프다
    if (this.nobleMimic) {
      result = { ...result, amount: Math.max(1, Math.round(result.amount * (1 - this.nobleMimic))) };
    }
    // 되돌리기는 실제로 되돌려야 한다. 값만 두고 아무도 안 쓰면 없는 기믹이다
    if (this.reflect && opts.attacker?.takeDamage) {
      const back = Math.max(1, Math.round(result.amount * this.reflect));
      opts.attacker.takeDamage({ amount: back, mult: 1, label: "반사" }, this);
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
    // 포탑은 일반 적으로 세운다 — 락온·피해·사망 처리를 그대로 물려받는다
    boss.onSummon = (specs) => this.hooks.onSummon?.(specs, boss);
    boss.onCharm = (sec) => this.hooks.onCharm?.(sec, boss);

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
