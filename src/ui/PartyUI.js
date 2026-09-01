import { getElement, getCombatType, COMBAT_LABEL, FAMILY_LABEL } from "../data/elements.js";
import { getFaction } from "../data/factions.js";
import { bondBonuses, NAMED_BONDS } from "../data/bonds.js";
import { statsFor } from "../combat/CombatStyle.js";

// 파티 편성 (P 키).
//
// 슬롯 4칸에 원소를 넣는다. 핵심은 **인연이 눈에 보여야 한다**는 것 —
// 어떤 조합이 왜 유리한지 알 수 없으면 자료의 관계망이 그냥 장식이 된다.
// 그래서 편성 중에 인연 선을 그리고 보너스를 실시간으로 계산해 보여준다.

export class PartyUI {
  /**
   * @param {import('../player/Player.js').Player} player
   * @param {(msg:string,color?:string)=>void} toast
   */
  constructor(player, toast) {
    this.player = player;
    this.toast = toast;
    this.root = document.getElementById("party");
    this.slotsEl = document.getElementById("party-slots");
    this.poolEl = document.getElementById("party-pool");
    this.bondEl = document.getElementById("party-bonds");
    this.statEl = document.getElementById("party-stats");
    this.open = false;
    this.pickedSlot = 0;

    document.getElementById("party-close").addEventListener("click", () => this.hide());
    this.root.addEventListener("click", (e) => { if (e.target === this.root) this.hide(); });
  }

  toggle() { this.open ? this.hide() : this.show(); }
  show() { this.open = true; this.root.hidden = false; this._render(); }
  hide() { this.open = false; this.root.hidden = true; }

  _render() {
    const prog = this.player.progress;
    const equipped = prog.equipped;

    // ---- 슬롯 4칸 ----
    this.slotsEl.innerHTML = [0, 1, 2, 3].map((i) => {
      const id = equipped[i];
      const el = id ? getElement(id) : null;
      const color = el ? "#" + getFaction(el.faction).color.toString(16).padStart(6, "0") : "#555";
      const active = i === this.pickedSlot;
      return `<button class="pt-slot${el ? "" : " empty"}${active ? " picked" : ""}" type="button"
                data-slot="${i}" style="--cell:${color}">
                <span class="pt-key">${i + 1}</span>
                ${el
                  ? `<span class="pt-sym">${el.sym}</span><span class="pt-ko">${el.ko}</span>
                     <span class="pt-type">${COMBAT_LABEL[getCombatType(el)]}</span>`
                  : `<span class="pt-empty">비어 있음</span>`}
              </button>`;
    }).join("");

    for (const btn of this.slotsEl.querySelectorAll(".pt-slot")) {
      btn.addEventListener("click", () => {
        const i = Number(btn.dataset.slot);
        // 같은 칸을 다시 누르면 비운다
        if (i === this.pickedSlot && equipped[i]) {
          prog.equipped[i] = null;
          prog.equipped = prog.equipped.filter(Boolean);
          this.player._recalcStats();
        }
        this.pickedSlot = i;
        this._render();
      });
    }

    // ---- 보유 원소 ----
    const owned = [...prog.owned];
    if (owned.length === 0) {
      this.poolEl.innerHTML = `<p class="pt-hint">아직 얻은 원소가 없습니다.
        NPC의 부탁을 들어주거나 적을 쓰러뜨리면 그 원소의 힘을 얻습니다.</p>`;
    } else {
      this.poolEl.innerHTML = owned.map((id) => {
        const el = getElement(id);
        if (!el) return "";
        const color = "#" + getFaction(el.faction).color.toString(16).padStart(6, "0");
        const inParty = equipped.includes(id);
        return `<button class="pt-card${inParty ? " in" : ""}" type="button"
                  data-id="${id}" style="--cell:${color}">
                  <span class="pt-sym">${el.sym}</span>
                  <span class="pt-ko">${el.ko}</span>
                  <span class="pt-sub">${FAMILY_LABEL[el.family]} · ${COMBAT_LABEL[getCombatType(el)]}</span>
                </button>`;
      }).join("");

      for (const btn of this.poolEl.querySelectorAll(".pt-card")) {
        btn.addEventListener("click", () => {
          prog.equip(btn.dataset.id, this.pickedSlot);
          this.player.setSlot(this.pickedSlot);
          this._render();
        });
      }
    }

    this._renderBonds(equipped);
  }

  _renderBonds(equipped) {
    const { mult, active, pairs } = bondBonuses(equipped);

    // 발동한 이름 있는 인연
    const activeHtml = active.map((b) => {
      const names = b.members.map((m) => getElement(m)?.ko ?? m).join(" + ");
      const fx = Object.entries(b.effect)
        .map(([k, v]) => `${STAT_LABEL[k] ?? k} ${v > 0 ? "+" : ""}${Math.round(v * 100)}%`)
        .join(" · ");
      return `<div class="pt-bond on">
                <div class="pt-bond-top"><b>${b.name}</b><span>${names}</span></div>
                <div class="pt-bond-fx">${fx}</div>
                <p class="pt-bond-desc">${b.desc}</p>
                ${b.flavor ? `<p class="pt-bond-quote">${b.flavor}</p>` : ""}
              </div>`;
    }).join("");

    // 아직 못 채운 인연 — 무엇이 더 필요한지 보여준다
    const ownedSet = new Set(this.player.progress.owned);
    const nearHtml = NAMED_BONDS
      .filter((b) => !active.includes(b) && b.members.some((m) => equipped.includes(m)))
      .map((b) => {
        const missing = b.members.filter((m) => !equipped.includes(m));
        const names = missing.map((m) => {
          const el = getElement(m);
          const have = ownedSet.has(m);
          return `<span class="${have ? "have" : "lack"}">${el?.ko ?? m}</span>`;
        }).join(", ");
        return `<div class="pt-bond off">
                  <div class="pt-bond-top"><b>${b.name}</b></div>
                  <div class="pt-bond-need">${names} 필요</div>
                </div>`;
      }).join("");

    const pairHtml = pairs.length
      ? `<p class="pt-pairs">인연 관계 ${pairs.length}쌍 — 각 능력치 +${pairs.length * 6}%</p>`
      : "";

    this.bondEl.innerHTML = (activeHtml + nearHtml + pairHtml) ||
      `<p class="pt-hint">인연이 있는 원소를 함께 편성하면 보너스를 받습니다.</p>`;

    // 최종 능력치 미리보기
    const base = statsFor(this.player.element, this.player.progress.level);
    this.statEl.innerHTML = [
      ["체력", base.hpMax, mult.hp],
      ["공격", base.attack, mult.attack],
      ["방어", base.defense, mult.defense],
      ["전자", base.electronsMax, mult.electrons],
    ].map(([label, v, m]) => {
      const final = Math.round(v * m);
      const diff = final - v;
      return `<div><dt>${label}</dt><dd>${final}
                ${diff !== 0 ? `<em class="${diff > 0 ? "up" : "down"}">${diff > 0 ? "+" : ""}${diff}</em>` : ""}
              </dd></div>`;
    }).join("");
  }
}

const STAT_LABEL = { attack: "공격", defense: "방어", hp: "체력", electrons: "전자" };
