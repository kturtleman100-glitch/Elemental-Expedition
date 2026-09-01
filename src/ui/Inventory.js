import { getElement } from "../data/elements.js";
import { COMPOUNDS, availableCompounds, missingFor } from "../data/bonds.js";

// 인벤토리 · 화합물 조합 (E 키).
//
// 이 게임에 무기 상점은 없다. 대신 가진 원소를 **조합해 화합물을 만든다**.
// 조합표는 전부 실제 화학이라, 화학을 아는 사람은 표를 보지 않고도 추측할 수 있다.
// 그게 이 게임이 주는 특유의 재미다.

export class Inventory {
  /**
   * @param {import('../player/Player.js').Player} player
   * @param {(msg:string,color?:string)=>void} toast
   */
  constructor(player, toast) {
    this.player = player;
    this.toast = toast;
    this.root = document.getElementById("inventory");
    this.listEl = document.getElementById("inv-compounds");
    this.detailEl = document.getElementById("inv-detail");
    this.countEl = document.getElementById("inv-count");
    this.open = false;
    this.selected = null;

    document.getElementById("inv-close").addEventListener("click", () => this.hide());
    this.root.addEventListener("click", (e) => { if (e.target === this.root) this.hide(); });
  }

  toggle() { this.open ? this.hide() : this.show(); }
  show() { this.open = true; this.root.hidden = false; this._render(); }
  hide() { this.open = false; this.root.hidden = true; }

  _render() {
    const owned = [...this.player.progress.owned];
    const ready = availableCompounds(owned);
    this.countEl.textContent = `만들 수 있는 화합물 ${ready.length} / ${COMPOUNDS.length}`;

    this.listEl.innerHTML = COMPOUNDS.map((c) => {
      const can = ready.includes(c);
      const need = missingFor(c, owned);
      return `<button class="inv-row${can ? " ready" : ""}" type="button" data-id="${c.id}"
                aria-pressed="${this.selected === c.id}">
                <span class="inv-formula">${c.formula}</span>
                <span class="inv-name">${c.name}</span>
                <span class="inv-need">${
                  can ? "제작 가능" : need.map((e) => e.ko).join(" · ") + " 필요"
                }</span>
              </button>`;
    }).join("");

    for (const btn of this.listEl.querySelectorAll(".inv-row")) {
      btn.addEventListener("click", () => {
        this.selected = btn.dataset.id;
        this._render();
      });
    }

    this._renderDetail(owned, ready);
  }

  _renderDetail(owned, ready) {
    if (!this.selected) {
      this.detailEl.innerHTML = `<p class="inv-hint">화합물을 골라 자세히 보세요.<br>
        조합은 전부 실제로 존재하는 물질입니다.</p>`;
      return;
    }

    const c = COMPOUNDS.find((x) => x.id === this.selected);
    if (!c) return;

    const can = ready.includes(c);
    const parts = c.needs.map((n) => {
      const el = getElement(n);
      const have = owned.includes(n);
      // 데이터에 없는 원소(수소·플루오린 등 아직 미등장)도 이름은 보여준다
      const name = el ? el.ko : n.toUpperCase();
      const sym = el ? el.sym : n.toUpperCase();
      return `<span class="inv-part ${have ? "have" : "lack"}">
                <b>${sym}</b> ${name}${have ? "" : " (없음)"}
              </span>`;
    }).join(`<span class="inv-plus">+</span>`);

    this.detailEl.innerHTML = `
      <div class="inv-head">
        <span class="inv-big">${c.formula}</span>
        <div><h3>${c.name}</h3><p class="inv-desc">${c.desc}</p></div>
      </div>
      <p class="inv-sub">필요한 원소</p>
      <div class="inv-parts">${parts}</div>
      <p class="inv-sub">효과</p>
      <p class="inv-effect">${c.effect.note ?? ""}</p>
      <button class="inv-make" type="button" ${can ? "" : "disabled"}>
        ${can ? "제작" : "원소가 부족합니다"}
      </button>`;

    const make = this.detailEl.querySelector(".inv-make");
    make?.addEventListener("click", () => {
      // 6단계에서 실제 소모품으로 이어진다. 지금은 해금과 안내까지.
      this.player.progress.compounds ??= new Set();
      if (this.player.progress.compounds.has(c.id)) {
        this.toast(`${c.name}은(는) 이미 익혔습니다`, "#9a9488");
        return;
      }
      this.player.progress.compounds.add(c.id);
      this.toast(`${c.name} (${c.formula}) 제작법을 익혔다`, "#56ccf2");
      this._render();
    });
  }
}
