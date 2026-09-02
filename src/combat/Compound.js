import { getCompound } from "../data/bonds.js";
import { computeDamage } from "./DamageCalc.js";

// 화합물 사용.
//
// 인벤토리에서 조합법을 익히는 것까지는 되어 있었는데 정작 쓸 방법이 없었다.
// 만들기만 하고 못 쓰면 조합표는 그냥 읽을거리가 된다.
//
// 규칙 하나를 지킨다 — **효과가 그 물질의 실제 성질에서 나와야 한다.**
// 소금 결정이 단단하니 꿰뚫고, 녹은 금속을 삭히니 방어를 깎고,
// 이산화탄소는 무거워 아래로 깔리니 광역이다. 그래야 화합물을 외우지 않아도
// 무슨 일이 일어날지 짐작할 수 있다.

/** 화합물 하나를 쓰는 데 드는 전자 (효과 종류별) */
const COST = {
  pierce: 18, aoe: 22, knockback: 16, debuff: 14,
  barrier: 20, shield: 18, heal: 16, reveal: 10,
  charm: 26, record: 12,
};

const COOLDOWN = 6;   // 초. 평타보다 훨씬 길어야 특별하게 느껴진다

export class CompoundCaster {
  constructor() {
    /** 지금 손에 든 화합물 id */
    this.active = null;
    this.cooldown = 0;
    /** 지속 효과 — { kind, timer, ... } */
    this.buffs = [];
  }

  update(dt) {
    this.cooldown = Math.max(0, this.cooldown - dt);
    for (let i = this.buffs.length - 1; i >= 0; i--) {
      this.buffs[i].timer -= dt;
      if (this.buffs[i].timer <= 0) this.buffs.splice(i, 1);
    }
  }

  /** 받는 피해 배율 — 방연석의 차폐가 여기 반영된다 */
  get damageTaken() {
    let m = 1;
    for (const b of this.buffs) if (b.kind === "shield") m *= 1 - b.reduce;
    return m;
  }

  has(kind) { return this.buffs.some((b) => b.kind === kind); }

  /**
   * @returns {{ok:boolean, reason?:string, compound?:object}}
   */
  canUse(id, player) {
    const c = getCompound(id);
    if (!c) return { ok: false, reason: "화합물을 고르지 않았다" };
    if (!player.progress.compounds?.has(id)) return { ok: false, reason: `${c.name} 제작법을 아직 모른다` };
    if (this.cooldown > 0) return { ok: false, reason: `${this.cooldown.toFixed(1)}초 남았다` };
    const cost = COST[c.effect.kind] ?? 16;
    if (player.electrons.value < cost) return { ok: false, reason: "전자가 모자란다" };
    return { ok: true, compound: c };
  }

  /**
   * 화합물을 쓴다.
   *
   * @param {string} id
   * @param {object} ctx { player, enemies, particles, projectiles, hud, aimYaw }
   * @returns {{ok:boolean, reason?:string, compound?:object, text?:string}}
   */
  use(id, ctx) {
    const check = this.canUse(id, ctx.player);
    if (!check.ok) return check;

    const c = check.compound;
    const { player } = ctx;
    player.electrons.spend(COST[c.effect.kind] ?? 16);
    this.cooldown = COOLDOWN;

    const text = this._apply(c, ctx);
    return { ok: true, compound: c, text };
  }

  /** 한 대상에 피해를 준다. 상성 계산과 사망 통보를 한곳에서 처리한다 */
  _hit(enemy, power, ctx) {
    // computeDamage는 공격자/방어자 객체를 받고 power를 계수로 쓴다.
    // 화합물은 전기음성도 상성을 그대로 타므로 평타와 같은 규칙이다 —
    // 물이 알칼리 금속에게 강한 것도 결국 상성으로 설명된다.
    const result = computeDamage(ctx.player, enemy, { power });
    const died = enemy.takeDamage(result);
    ctx.onHit?.(enemy, result, died);
    return result;
  }

  _apply(c, ctx) {
    const { player, enemies, particles, projectiles } = ctx;
    const e = c.effect;
    const eye = { x: player.position.x, y: player.position.y + player.eyeHeight, z: player.position.z };

    switch (e.kind) {
      // 소금 결정은 단단하다 — 한 줄로 꿰뚫는다
      case "pierce": {
        // 조준 방향으로 뻗은 좁은 복도 안의 적을 모두 맞힌다.
        // 투사체에 관통 기능을 넣으면 일반 마법까지 영향을 받으므로 여기서 판정한다.
        const dirX = Math.sin(ctx.aimYaw), dirZ = Math.cos(ctx.aimYaw);
        let hit = 0;
        for (const en of enemies) {
          if (!en.alive) continue;
          const rx = en.position.x - player.position.x;
          const rz = en.position.z - player.position.z;
          const along = rx * dirX + rz * dirZ;          // 앞으로 얼마나
          if (along < 0 || along > 16) continue;
          const side = Math.abs(rx * dirZ - rz * dirX); // 중심선에서 옆으로 얼마나
          if (side > 1.6) continue;
          this._hit(en, e.power ?? 1.4, ctx);
          hit++;
        }
        particles?.burst(eye, player.element.family, 1.4);
        return `${c.name}(${c.formula}) — ${hit}체 관통`;
      }

      // 이산화탄소는 공기보다 무거워 낮게 깔린다 — 주변을 덮는다
      case "aoe": {
        let hit = 0;
        for (const en of enemies) {
          if (!en.alive) continue;
          const d = Math.hypot(en.position.x - player.position.x, en.position.z - player.position.z);
          if (d > 9) continue;
          this._hit(en, e.power ?? 0.9, ctx);
          hit++;
        }
        particles?.burst(eye, player.element.family, 2.2);
        return `${c.name}(${c.formula}) — ${hit}체 질식`;
      }

      // 물은 알칼리 금속과 격렬히 반응한다 — 밀어내고, 상대가 알칼리면 폭발한다
      case "knockback": {
        let hit = 0, boom = 0;
        for (const en of enemies) {
          if (!en.alive) continue;
          const dx = en.position.x - player.position.x;
          const dz = en.position.z - player.position.z;
          const d = Math.hypot(dx, dz);
          if (d > 8 || d < 0.001) continue;
          const alkali = en.element?.family === "alkali";
          const mult = (e.power ?? 1.2) * (alkali ? (e.bonus ?? 2) : 1);
          this._hit(en, mult, ctx);
          en.position.x += (dx / d) * 3.2;
          en.position.z += (dz / d) * 3.2;
          hit++;
          if (alkali) boom++;
        }
        particles?.burst(eye, player.element.family, 1.6);
        return boom
          ? `${c.name}(${c.formula}) — 알칼리 금속 ${boom}체 연쇄 폭발!`
          : `${c.name}(${c.formula}) — ${hit}체 밀어냄`;
      }

      // 녹은 금속을 삭힌다 — 방어를 깎는다
      case "debuff": {
        const target = nearest(enemies, player, 14);
        if (!target) return `${c.name} — 닿을 상대가 없다`;
        target.debuff = { stat: e.stat, amount: e.amount, timer: e.duration ?? 8 };
        return `${c.name}(${c.formula}) — ${target.element.ko} 방어 ${Math.round((e.amount ?? -0.4) * 100)}%`;
      }

      // 섬아연석은 빛을 저장했다 내놓는다 — 회복
      case "heal": {
        const amount = Math.round(player.hpMax * (e.amount ?? 0.25));
        player.hp = Math.min(player.hpMax, player.hp + amount);
        particles?.burst(eye, player.element.family, 1.2);
        return `${c.name}(${c.formula}) — 체력 +${amount}`;
      }

      // 납은 밀도가 높아 방사선을 막는다 — 받는 피해를 줄인다
      case "shield": {
        this.buffs.push({ kind: "shield", reduce: e.reduce ?? 0.5, timer: e.duration ?? 8 });
        return `${c.name}(${c.formula}) — ${e.duration ?? 8}초간 피해 ${Math.round((e.reduce ?? 0.5) * 100)}% 감소`;
      }

      // 수정은 그물 구조라 단단하다 — 앞을 막는 벽
      case "barrier": {
        this.buffs.push({ kind: "barrier", hp: e.hp ?? 60, timer: e.duration ?? 10 });
        return `${c.name}(${c.formula}) — ${e.duration ?? 10}초간 장벽`;
      }

      // 형석은 자외선에 빛난다 — 주변을 드러낸다
      case "reveal": {
        this.buffs.push({ kind: "reveal", radius: e.radius ?? 20, timer: e.duration ?? 12 });
        return `${c.name}(${c.formula}) — 주변을 밝힌다`;
      }

      // 진사는 사람을 홀린다 — 적 하나를 잠시 아군으로
      case "charm": {
        const target = nearest(enemies, player, 12);
        if (!target) return `${c.name} — 홀릴 상대가 없다`;
        target.charmed = e.duration ?? 5;
        return `${c.name}(${c.formula}) — ${target.element.ko}이(가) 홀렸다`;
      }

      // 브로민화은은 빛을 기억한다 — 방금 쓴 것을 한 번 더
      case "record": {
        if (!this.lastUsed || this.lastUsed === c.id) return `${c.name} — 기억할 것이 없다`;
        const again = getCompound(this.lastUsed);
        if (!again) return `${c.name} — 기억할 것이 없다`;
        const t = this._apply(again, ctx);
        return `${c.name}(${c.formula}) — 다시: ${t}`;
      }

      default:
        return `${c.name}(${c.formula})`;
    }
  }
}

/** 반경 안에서 가장 가까운 살아 있는 적 */
function nearest(enemies, player, range) {
  let best = null, bestD = range * range;
  for (const e of enemies) {
    if (!e.alive) continue;
    const dx = e.position.x - player.position.x;
    const dz = e.position.z - player.position.z;
    const d = dx * dx + dz * dz;
    if (d < bestD) { bestD = d; best = e; }
  }
  return best;
}
