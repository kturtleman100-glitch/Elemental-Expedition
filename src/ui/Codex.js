import { ELEMENTS, getElement, getCombatType, FAMILY, FAMILY_LABEL, COMBAT_LABEL } from "../data/elements.js";
import { getFaction } from "../data/factions.js";
import { familyInfo, familyReward } from "../data/families.js";

// 원소 도감 (K 키).
//
// 만난 원소가 여기 쌓인다. 진엔딩 조건이 "도감 90% 이상"이라 단순한 수집물이
// 아니라 진행도 그 자체다. 그래서 만나지 못한 원소도 칸은 보여준다 —
// 몇 개가 남았는지 알아야 모으고 싶어진다.

/**
 * 원자번호로 주기율표의 자리(주기·족)를 구한다.
 *
 * 원소 데이터에 period/group을 넣는 것이 정석이지만, 그건 43개를 손으로
 * 채워야 하는 일이라 재작성 단계에서 한다. 그때까지는 원자번호만으로
 * 자리를 구한다 — 주기율표는 원자번호 순으로 채워지므로 계산이 된다.
 *
 * 란타넘·악티늄족(57~71, 89~103)은 표 아래 두 줄로 빼는 것이 실제 모양인데,
 * 지금 게임에 그 구간 원소가 우라늄·아인슈타이늄뿐이라 8·9주기 자리에 둔다.
 */
function tableSlot(z) {
  // 각 주기의 시작 원자번호와, 그 주기가 몇 족부터 시작하는가
  const ROWS = [
    { start: 1, end: 2, period: 1 },
    { start: 3, end: 10, period: 2 },
    { start: 11, end: 18, period: 3 },
    { start: 19, end: 36, period: 4 },
    { start: 37, end: 54, period: 5 },
    { start: 55, end: 86, period: 6 },
    { start: 87, end: 118, period: 7 },
  ];
  const row = ROWS.find((r) => z >= r.start && z <= r.end);
  if (!row) return { period: 7, group: 18 };

  // 란타넘족·악티늄족은 아래 두 줄로
  if ((z >= 57 && z <= 71) || (z >= 89 && z <= 103)) {
    return { period: z <= 71 ? 8 : 9, group: 3 + ((z - (z <= 71 ? 57 : 89)) % 15) };
  }

  const period = row.period;
  let offset = z - row.start;

  if (period === 1) return { period, group: z === 1 ? 1 : 18 };
  if (period === 2 || period === 3) {
    // 8칸짜리 줄 — 1,2족 다음 13~18족으로 건너뛴다
    return { period, group: offset < 2 ? offset + 1 : offset + 11 };
  }
  // 4주기 이후는 18칸이 이어지되, 6·7주기는 f블록 15개를 건너뛴다
  if (period === 6 && z > 71) offset -= 14;
  if (period === 7 && z > 103) offset -= 14;
  return { period, group: Math.min(18, offset + 1) };
}

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

    // 진짜 주기율표 자리에 놓는다.
    //
    // 예전에는 원자번호 순으로 흘려보냈는데, 그러면 창 너비에 따라 한 줄에
    // 다섯이 되기도 아홉이 되기도 해서 표가 아니라 목록이었다. 주기율표에서
    // 배울 것은 대부분 '자리'에 있다 — 세로로 같은 족, 오른쪽 위로 갈수록
    // 전자를 세게 당김. 자리를 흩뜨리면 그게 통째로 사라진다.
    const sorted = [...ELEMENTS].sort((a, b) => a.z - b.z);

    this.gridEl.innerHTML = sorted.map((el) => {
      const known = this.found.has(el.id);
      const color = "#" + getFaction(el.faction).color.toString(16).padStart(6, "0");
      const { period, group } = tableSlot(el.z);
      const sel = this.selected === el.id;
      return `<button class="cx-cell${known ? "" : " locked"}${sel ? " sel" : ""}" type="button"
                data-id="${el.id}" style="--cell:${color}; --p:${period}; --g:${group}"
                aria-pressed="${sel}">
                <span class="cx-z">${el.z}</span>
                <span class="cx-sym">${known ? el.sym : "?"}</span>
                <span class="cx-ko">${known ? el.ko : ""}</span>
              </button>`;
    }).join("");

    for (const btn of this.gridEl.querySelectorAll(".cx-cell")) {
      btn.addEventListener("click", () => {
        this.selected = btn.dataset.id;
        this._renderDetail();
        for (const b of this.gridEl.querySelectorAll(".cx-cell")) {
          const on = b.dataset.id === this.selected;
          b.setAttribute("aria-pressed", String(on));
          b.classList.toggle("sel", on);   // 어느 칸을 눌렀는지 한눈에 보여야 한다
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
  /**
   * 그 족을 몇 개나 모았는가.
   *
   * 아이가 "다 읽으면 뭐 줘?"라고 물어서 만든 것이다. 다만 조건을 '읽기'가
   * 아니라 '만나기'로 두었다 — 글은 훑고 넘어가도 읽은 게 되어 버리지만,
   * 만나려면 그 땅까지 가야 하고 그러면 어디에 무엇이 사는지가 몸에 남는다.
   */
  _familyProgress(family) {
    const all = ELEMENTS.filter((e) => e.family === family);
    const got = all.filter((e) => this.found.has(e.id));
    return { got: got.length, total: all.length, done: got.length === all.length };
  }

  _familyBlock(el) {
    const info = familyInfo(el.family);
    if (!info) return "";

    const prog = this._familyProgress(el.family);
    const reward = familyReward(el.family);
    // 몇 개 남았는지는 접혀 있을 때도 보여야 모으고 싶어진다
    const badge = reward
      ? `<span class="cx-prog${prog.done ? " done" : ""}">${prog.got}/${prog.total}${prog.done ? " ✓" : ""}</span>`
      : "";

    if (!this.famOpen) {
      return `<button class="cx-fam-toggle" type="button">
                ${info.label}은 어떤 족인가? ${badge} <span class="cx-caret">▾</span>
              </button>`;
    }
    // 다 모으면 무엇을 주는지 미리 보여 준다. 받고 나서 알면 목표가 되지 않는다
    const rewardBlock = reward
      ? `<div class="cx-reward${prog.done ? " done" : ""}">
           <p class="cx-reward-head">${prog.done ? "얻었다" : "다 모으면"} · ${reward.name}</p>
           <p class="cx-reward-desc">${reward.desc}</p>
           <p class="cx-reward-why">${reward.why}</p>
           <p class="cx-reward-prog">${prog.got} / ${prog.total} 만남</p>
         </div>`
      : "";

    return `<button class="cx-fam-toggle open" type="button">
              ${info.label} ${badge} <span class="cx-caret">▴</span>
            </button>
            <div class="cx-fam">
              <p class="cx-fam-group">${info.group}</p>
              <p class="cx-fam-trait">${info.trait}</p>
              <p class="cx-fam-label">왜 그런가</p>
              <p>${info.why}</p>
              <p class="cx-fam-label">이 게임에서는</p>
              <p>${info.inGame}</p>
              <p class="cx-fam-watch">${info.watch}</p>
              ${rewardBlock}
            </div>`;
  }

  toJSON() { return [...this.found]; }
  fromJSON(arr) { this.found = new Set(arr || []); }
}
