import { ELEMENTS, getElement, getCombatType, FAMILY, FAMILY_LABEL, COMBAT_LABEL } from "../data/elements.js";
import { getFaction } from "../data/factions.js";
import { familyInfo, familyReward } from "../data/families.js";
import { PERIODIC, tableSlot } from "../data/periodic.js";

// 원소 도감 (K 키).
//
// 만난 원소가 여기 쌓인다. 진엔딩 조건이 "도감 90% 이상"이라 단순한 수집물이
// 아니라 진행도 그 자체다. 그래서 만나지 못한 원소도 칸은 보여준다 —
// 몇 개가 남았는지 알아야 모으고 싶어진다.

export class Codex {
  constructor() {
    this.root = document.getElementById("codex");
    this.gridEl = document.getElementById("codex-grid");
    this.detailEl = document.getElementById("codex-detail");
    this.countEl = document.getElementById("codex-count");
    this.barEl = document.getElementById("codex-bar");

    this.found = new Set();
    this.readFamilies = new Set();   // 해설을 펼쳐 본 족
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

    // 118칸을 전부 그린다.
    //
    // 게임에 나오는 원소는 47종뿐이라 그것만 그리면 표가 듬성듬성해져
    // 주기율표로 보이지 않는다. 세로로 같은 족, 오른쪽 위로 갈수록 전자를
    // 세게 당김 — 그 모양은 칸이 다 있어야 눈에 들어온다.
    // 없는 칸은 회색으로 자리만 채우고, 비어 보이는 것 자체가
    // "여기 뭔가 더 있구나"를 알려 준다.
    const byZ = new Map(ELEMENTS.map((e) => [e.z, e]));
    const cells = [];

    for (let z = 1; z <= 118; z++) {
      const { period, group } = tableSlot(z);
      const el = byZ.get(z);
      const [sym, ko] = PERIODIC[z];
      const pos = `grid-column:${group}; grid-row:${period}`;

      if (!el) {
        // 게임에 없는 원소 — 자리만 지킨다
        cells.push(`<div class="cx-cell ghost" style="${pos}" title="${ko}">
                      <span class="cx-z">${z}</span>
                      <span class="cx-sym">${sym}</span>
                      <span class="cx-ko">${ko}</span>
                    </div>`);
        continue;
      }

      const known = this.found.has(el.id);
      const color = "#" + getFaction(el.faction).color.toString(16).padStart(6, "0");
      const sel = this.selected === el.id;
      cells.push(`<button class="cx-cell${known ? "" : " locked"}${sel ? " sel" : ""}" type="button"
                    data-id="${el.id}" style="--cell:${color}; ${pos}"
                    aria-pressed="${sel}">
                    <span class="cx-z">${z}</span>
                    <span class="cx-sym">${known ? sym : "?"}</span>
                    <span class="cx-ko">${known ? ko : ""}</span>
                  </button>`);
    }

    this.gridEl.innerHTML = cells.join("");

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
      // 아이가 읽는 이름을 앞에 두고 진짜 이름을 괄호로 붙인다.
      // 이 한 줄이 해설의 「당기는 힘」과 화면의 숫자를 잇는다 —
      // 나중에 학교에서 '전기음성도'를 만났을 때 되살아나야 하는 다리다
      ["당기는 힘 <em>(전기음성도)</em>", el.electroneg ?? "잴 수 없음"],
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

    // 왼쪽 칸은 인물, 오른쪽 칸은 족 이야기. 위아래로 길게 늘어놓으면
    // 스크롤해야 다 보이는데, 두 칸으로 나누면 한눈에 들어온다
    this.detailEl.innerHTML = `
      <div class="cx-col-a">
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
      </div>
      <div class="cx-col-b">${this._familyBlock(el)}</div>`;

    // 해설을 열어 본 것을 기록한다. 아이가 "읽으면 뭐 줘?"라고 물어서 만든 것이다
    this._markRead(el.family);
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
  /**
   * 그 족 해설을 봤다고 기록한다.
   *
   * 아이가 "다 읽으면 보상이 있으면 좋겠다"고 해서 만들었다. 다만 읽었는지는
   * 코드가 알 수 없으니 '펼쳐 봤다'까지만 센다. 그래서 이쪽 보상은 작게 두고,
   * 큰 보상은 '그 족을 다 만나기'에 걸었다 — 만나려면 실제로 돌아다녀야 한다.
   */
  _markRead(family) {
    if (!family || this.readFamilies.has(family)) return;
    this.readFamilies.add(family);
    this.onRead?.(family);
  }

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
    const badge = reward
      ? `<span class="cx-prog${prog.done ? " done" : ""}">${prog.got}/${prog.total}${prog.done ? " ✓" : ""}</span>`
      : "";
    // 보상은 두 단계다.
    //   읽기 — 여기까지 펼쳐 본 것만으로 작은 것을 준다 (아이가 바란 것)
    //   모으기 — 그 족을 다 만나면 족의 힘을 준다 (진짜 목표)
    // 읽기만으로 큰 것을 주면 훑고 넘어가도 다 받게 되고, 모으기만 있으면
    // "읽으면 뭐 줘?"라는 물음에 답이 없다. 그래서 둘 다 둔다.
    const read = this.readFamilies.has(el.family);
    const rewardBlock = reward
      ? `<div class="cx-reward${prog.done ? " done" : ""}">
           <p class="cx-reward-step${read ? " got" : ""}">
             ${read ? "✓ 읽었다" : "읽으면"} · 전자 조금 회복
           </p>
           <p class="cx-reward-head">${prog.done ? "✓ 얻었다" : "다 모으면"} · ${reward.name}</p>
           <p class="cx-reward-desc">${reward.desc}</p>
           <p class="cx-reward-why">${reward.why}</p>
           <p class="cx-reward-prog">${prog.got} / ${prog.total} 만남</p>
         </div>`
      : "";

    return `<div class="cx-fam-head">${info.label} ${badge}</div>
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

  // 옛 저장은 배열이었다. 배열이면 그대로 읽고, 새 저장은 객체로 쓴다
  toJSON() { return { found: [...this.found], read: [...this.readFamilies] }; }
  fromJSON(data) {
    if (Array.isArray(data)) { this.found = new Set(data); this.readFamilies = new Set(); return; }
    this.found = new Set(data?.found || []);
    this.readFamilies = new Set(data?.read || []);
  }
}
