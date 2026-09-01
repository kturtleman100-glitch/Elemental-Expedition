import { ELEMENTS, getElement, getCombatType, FAMILY, FAMILY_LABEL, COMBAT_LABEL } from "../data/elements.js";
import { getFaction } from "../data/factions.js";
import { familyInfo } from "../data/families.js";

// 원소 도감 (K 키).
//
// 만난 원소가 여기 쌓인다. 진엔딩 조건이 "도감 90% 이상"이라 단순한 수집물이
// 아니라 진행도 그 자체다. 그래서 만나지 못한 원소도 칸은 보여준다 —
// 몇 개가 남았는지 알아야 모으고 싶어진다.

export class Codex {
  constructor() {
    this.root = document.getElementById("codex");
    this.famOpen = false;   // 족 해설 펼침 여부
    this.gridEl = document.getElementById("codex-grid");
    this.detailEl = document.getElementById("codex-detail");
    this.countEl = document.getElementById("codex-count");
    this.barEl = document.getElementById("codex-bar");

    this.found = new Set();
    this.selected = null;
    this.open = false;

    document.getElementById("codex-close").addEventListener("click", () => this.hide());
    this.root.addEventListener("click", (e) => {
      if (e.target === this.root) this.hide(); // 바깥을 누르면 닫힌다
    });
  }

  /** 원소를 도감에 등록. 새로 등록됐으면 true */
  discover(id) {
    if (!getElement(id) || this.found.has(id)) return false;
    this.found.add(id);
    return true;
  }

  has(id) { return this.found.has(id); }

  get ratio() { return this.found.size / ELEMENTS.length; }

  toggle() { this.open ? this.hide() : this.show(); }

  show() {
    this.open = true;
    this.root.hidden = false;
    this._render();
  }

  hide() {
    this.open = false;
    this.root.hidden = true;
  }

  _render() {
    const pct = Math.round(this.ratio * 100);
    this.countEl.textContent = `${this.found.size} / ${ELEMENTS.length}  (${pct}%)`;
    this.barEl.style.width = `${pct}%`;

    // 원자번호 순으로 — 주기율표를 읽는 순서와 같아야 익숙하다
    const sorted = [...ELEMENTS].sort((a, b) => a.z - b.z);

    this.gridEl.innerHTML = sorted.map((el) => {
      const known = this.found.has(el.id);
      const color = "#" + getFaction(el.faction).color.toString(16).padStart(6, "0");
      return `<button class="cx-cell${known ? "" : " locked"}" type="button" data-id="${el.id}"
                style="--cell:${color}" aria-pressed="${this.selected === el.id}">
                <span class="cx-z">${el.z}</span>
                <span class="cx-sym">${known ? el.sym : "?"}</span>
                <span class="cx-ko">${known ? el.ko : "미발견"}</span>
              </button>`;
    }).join("");

    for (const btn of this.gridEl.querySelectorAll(".cx-cell")) {
      btn.addEventListener("click", () => {
        this.selected = btn.dataset.id;
        this._renderDetail();
        for (const b of this.gridEl.querySelectorAll(".cx-cell")) {
          b.setAttribute("aria-pressed", String(b.dataset.id === this.selected));
        }
      });
    }

    this._renderDetail();
  }

  _renderDetail() {
    if (!this.selected) {
      this.detailEl.innerHTML = `<p class="cx-empty">원소를 골라 자세히 보세요.</p>`;
      return;
    }

    const el = getElement(this.selected);
    const known = this.found.has(el.id);
    const faction = getFaction(el.faction);
    const color = "#" + faction.color.toString(16).padStart(6, "0");

    if (!known) {
      this.detailEl.innerHTML = `
        <div class="cx-head"><span class="cx-big" style="--cell:${color}">?</span>
          <div><h3>미발견</h3><p class="cx-role">원자번호 ${el.z}</p></div></div>
        <p class="cx-empty">아직 만나지 못한 원소입니다.</p>`;
      return;
    }

    const rows = [
      ["족", FAMILY_LABEL[el.family] ?? "—"],
      ["전투 유형", COMBAT_LABEL[getCombatType(el)]],
      ["소속", faction.name],
      ["원자량", el.mass ?? "—"],
      ["전기음성도", el.electroneg ?? "정의되지 않음"],
      ["녹는점", el.melt != null ? `${el.melt}°C` : "—"],
      ["끓는점", el.boil != null ? `${el.boil}°C` : "—"],
    ];

    const bonds = el.bonds
      .map((b) => {
        const o = getElement(b);
        if (!o) return null;
        const seen = this.found.has(b);
        return `<span class="cx-bond${seen ? "" : " dim"}">${seen ? o.ko : "?"} (${b.toUpperCase()})</span>`;
      })
      .filter(Boolean)
      .join("");

    this.detailEl.innerHTML = `
      <div class="cx-head">
        <span class="cx-big" style="--cell:${color}">${el.sym}</span>
        <div>
          <h3>${el.ko} <em>${el.en}</em></h3>
          <p class="cx-role">${el.role}</p>
        </div>
      </div>
      <dl class="cx-stats">
        ${rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join("")}
      </dl>
      <p class="cx-bio">${el.bio}</p>
      <blockquote class="cx-quote">${el.quote}</blockquote>
      ${el.exception ? `<p class="cx-exc"><b>족 규칙의 예외</b>${el.exception}</p>` : ""}
      ${bonds ? `<p class="cx-sub">${this._bondLabel(el)}</p><div class="cx-bonds">${bonds}</div>` : ""}
      ${this._familyBlock(el)}`;

    const toggle = this.detailEl.querySelector(".cx-fam-toggle");
    toggle?.addEventListener("click", () => {
      this.famOpen = !this.famOpen;
      this._renderDetail();
    });
  }

  /**
   * 비활성 기체의 '인연'은 화학 결합이 아니라 사이가 가깝다는 뜻이다.
   * 같은 말로 부르면 "귀족 기체도 결합하는구나"라고 잘못 배운다.
   */
  _bondLabel(el) {
    if (el.family !== FAMILY.NOBLE) return "인연이 깊은 원소";
    return "가까이 지내는 원소 <em>— 결합은 아니다</em>";
  }

  /**
   * 족 해설. 숫자만 보여주면 외울 것만 늘고 남는 게 없다.
   * 왜 같은 족이 비슷하게 행동하는지가 화학이 재미있어지는 지점이다.
   *
   * 기본은 접어 둔다 — 캐릭터를 보러 온 사람에게 설명부터 들이밀면 방해가 된다.
   */
  _familyBlock(el) {
    const info = familyInfo(el.family);
    if (!info) return "";

    if (!this.famOpen) {
      return `<button class="cx-fam-toggle" type="button">
                ${info.label}은 어떤 족인가? <span class="cx-caret">▾</span>
              </button>`;
    }
    return `<button class="cx-fam-toggle open" type="button">
              ${info.label} <span class="cx-caret">▴</span>
            </button>
            <div class="cx-fam">
              <p class="cx-fam-group">${info.group}</p>
              <p class="cx-fam-trait">${info.trait}</p>
              <p class="cx-fam-label">왜 그런가</p>
              <p>${info.why}</p>
              <p class="cx-fam-label">이 게임에서는</p>
              <p>${info.inGame}</p>
              <p class="cx-fam-watch">${info.watch}</p>
            </div>`;
  }

  toJSON() { return [...this.found]; }
  fromJSON(arr) { this.found = new Set(arr || []); }
}
