import * as THREE from "three";
import { multColor } from "../combat/DamageCalc.js";

// HUD — 체력·전자·경험치 막대와 떠오르는 피해 숫자.
//
// 피해 숫자에 상성 배율을 함께 띄우는 게 핵심이다. "×2.07 격렬 반응!"이 보여야
// 플레이어가 전기음성도 규칙을 몸으로 익힌다. 숫자만 뜨면 그냥 숫자다.

const FLOAT_LIFE = 1.1;

export class HUD {
  constructor(camera) {
    this.camera = camera;
    this.hpFill = document.getElementById("hp-fill");
    this.hpText = document.getElementById("hp-text");
    this.eFill = document.getElementById("electron-fill");
    this.eText = document.getElementById("electron-text");
    this.expFill = document.getElementById("exp-fill");
    this.stanceEl = document.getElementById("stance-label");
    this.layer = document.getElementById("float-layer");
    this.targetBox = document.getElementById("target-info");
    this.targetName = document.getElementById("target-name");
    this.targetHpFill = document.getElementById("target-hp-fill");
    this.affinityEl = document.getElementById("affinity-hint");

    this.floats = [];
    this._v = new THREE.Vector3();
  }

  /**
   * @param {{hp:number,hpMax:number,electrons:object,exp:number,expToNext:number,level:number}} p
   */
  updateBars(p) {
    const hpPct = Math.max(0, (p.hp / p.hpMax) * 100);
    this.hpFill.style.width = `${hpPct}%`;
    this.hpText.textContent = `${Math.ceil(p.hp)} / ${p.hpMax}`;

    const ePct = Math.max(0, Math.min(120, p.electrons.ratio * 100));
    this.eFill.style.width = `${Math.min(100, ePct)}%`;
    // 과잉 흡수는 색으로 경고한다 — 자해가 시작되는 상태다
    this.eFill.style.filter = p.electrons.unstable ? "hue-rotate(-45deg) saturate(1.6)" : "";
    // 소모량을 같이 보여줘야 "왜 줄었지"를 알 수 있다
    const cost = p.style ? ` · 소모 ${p.style.electronCost}` : "";
    this.eText.textContent = `e⁻ ${Math.floor(p.electrons.value)} / ${p.electrons.max}${cost}`;

    this.expFill.style.width = `${(p.exp / p.expToNext) * 100}%`;

    if (this.stanceEl) {
      this.stanceEl.textContent = p.style?.label ?? "";
      this.stanceEl.hidden = !p.style;
    }
  }

  /** 락온 타겟 정보 */
  updateTarget(target, affinityInfo) {
    if (!target || !target.alive) {
      this.targetBox.hidden = true;
      this.affinityEl.hidden = true;
      return;
    }
    this.targetBox.hidden = false;
    this.targetName.textContent = `${target.element.ko} (${target.element.sym}) Lv.${target.level}`;
    this.targetHpFill.style.width = `${Math.max(0, (target.hp / target.hpMax) * 100)}%`;

    if (affinityInfo && affinityInfo.label) {
      this.affinityEl.hidden = false;
      this.affinityEl.textContent = `×${affinityInfo.mult.toFixed(2)} ${affinityInfo.label}`;
      this.affinityEl.style.color = multColor(affinityInfo.mult);
    } else {
      this.affinityEl.hidden = true;
    }
  }

  /**
   * 월드 좌표에 피해 숫자를 띄운다.
   * @param {THREE.Vector3|{x,y,z}} worldPos
   * @param {{amount:number, mult:number, label:string, critical:boolean}} result
   */
  popDamage(worldPos, result) {
    const el = document.createElement("div");
    el.className = "float-dmg";
    el.style.color = multColor(result.mult);

    const num = document.createElement("span");
    num.className = "fd-num";
    num.textContent = Math.round(result.amount);
    el.appendChild(num);

    if (result.label) {
      const tag = document.createElement("span");
      tag.className = "fd-tag";
      tag.textContent = `×${result.mult.toFixed(2)} ${result.label}`;
      el.appendChild(tag);
    }
    if (result.critical) el.classList.add("crit");

    this.layer.appendChild(el);
    this.floats.push({
      el,
      pos: new THREE.Vector3(worldPos.x, worldPos.y, worldPos.z),
      life: FLOAT_LIFE,
      drift: (Math.random() - 0.5) * 28,
    });
  }

  /** 화면 중앙 상단에 짧은 알림 (레벨업·원소 획득 등) */
  toast(text, color = "#f2c94c") {
    const el = document.createElement("div");
    el.className = "hud-toast";
    el.textContent = text;
    el.style.color = color;
    this.layer.appendChild(el);
    setTimeout(() => el.remove(), 2600);
  }

  /** 프레임마다 — 떠오르는 숫자를 화면 좌표로 옮긴다 */
  render(dt) {
    for (let i = this.floats.length - 1; i >= 0; i--) {
      const f = this.floats[i];
      f.life -= dt;
      if (f.life <= 0) {
        f.el.remove();
        this.floats.splice(i, 1);
        continue;
      }

      const t = 1 - f.life / FLOAT_LIFE;
      this._v.copy(f.pos);
      this._v.y += t * 1.1; // 위로 떠오른다
      this._v.project(this.camera);

      // 카메라 뒤에 있으면 숨긴다
      if (this._v.z > 1) { f.el.style.opacity = "0"; continue; }

      const x = (this._v.x * 0.5 + 0.5) * window.innerWidth + f.drift * t;
      const y = (-this._v.y * 0.5 + 0.5) * window.innerHeight;
      f.el.style.transform = `translate(-50%, -50%) translate(${x}px, ${y}px) scale(${1 + (1 - t) * 0.35})`;
      f.el.style.opacity = String(Math.min(1, f.life * 2.5));
    }
  }
}
