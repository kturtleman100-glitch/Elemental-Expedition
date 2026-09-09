// 빠른 이동.
//
// 대륙이 무한한데 걸어서만 다니면 같은 길을 몇 번씩 되짚게 된다. 그 시간은
// 탐험이 아니라 그냥 이동이다.
//
// 거점을 새로 만들지 않고 **이미 세워 둔 야영지와 마을 광장**을 쓴다.
// 화덕이 있는 자리에서 다음 화덕으로 간다는 것이 설명 없이 이해된다.
//
// 한 번이라도 가 본 곳만 열린다. 처음부터 다 열어 두면 걸어서 발견하는
// 재미가 사라지고, 세계가 넓다는 감각도 없어진다.

const DISCOVER_RANGE = 12;   // 이 안에 들어오면 그 거점을 발견한 것으로 친다
const USE_RANGE = 9;         // 이 안에 있어야 이동을 쓸 수 있다

export class FastTravel {
  /**
   * @param {{x:number,z:number,name:string}[]} points 거점 목록
   */
  constructor(points) {
    this.points = points;
    this.found = new Set();
    this.open = false;
    this.nearest = null;

    this.root = document.getElementById("travel");
    this.listEl = document.getElementById("travel-list");
    this.hintEl = document.getElementById("travel-hint");

    document.getElementById("travel-close")?.addEventListener("click", () => this.hide());
    this.root?.addEventListener("click", (e) => {
      if (e.target === this.root) this.hide();
    });

    /** @type {(p:{x:number,z:number,name:string}) => void} */
    this.onTravel = null;
  }

  /**
   * 매 프레임 부른다. 가까운 거점을 찾고, 처음 온 곳이면 기록한다.
   * @returns {string|null} 새로 발견한 거점 이름
   */
  update(px, pz) {
    let best = null;
    let bestD = Infinity;
    let discovered = null;

    for (const p of this.points) {
      const d = Math.hypot(p.x - px, p.z - pz);
      if (d < bestD) { bestD = d; best = p; }
      if (d <= DISCOVER_RANGE && !this.found.has(p.name)) {
        this.found.add(p.name);
        discovered = p.name;
      }
    }

    this.nearest = bestD <= USE_RANGE ? best : null;
    return discovered;
  }

  /** 지금 자리에서 빠른 이동을 쓸 수 있는가 */
  get available() { return this.nearest !== null; }

  show() {
    if (!this.root) return;
    this.open = true;
    this.root.hidden = false;
    this._render();
  }

  hide() {
    if (!this.root) return;
    this.open = false;
    this.root.hidden = true;
  }

  toggle() { this.open ? this.hide() : this.show(); }

  _render() {
    const here = this.nearest;
    if (this.hintEl) {
      this.hintEl.textContent = here
        ? `지금 있는 곳: ${here.name}`
        : "쉼터나 마을 광장에서만 쓸 수 있어요.";
    }

    const known = this.points.filter((p) => this.found.has(p.name));
    if (!known.length) {
      this.listEl.innerHTML = `<p class="tv-empty">아직 가 본 곳이 없어요. 걸어서 찾아보세요.</p>`;
      return;
    }

    this.listEl.innerHTML = known.map((p) => {
      const isHere = here && p.name === here.name;
      return `<button class="tv-item${isHere ? " here" : ""}" type="button"
                data-name="${p.name}" ${isHere || !here ? "disabled" : ""}>
                <span class="tv-name">${p.name}</span>
                <span class="tv-note">${isHere ? "지금 여기" : `${Math.round(Math.hypot(p.x - (here?.x ?? 0), p.z - (here?.z ?? 0)))}m`}</span>
              </button>`;
    }).join("");

    for (const btn of this.listEl.querySelectorAll(".tv-item:not([disabled])")) {
      btn.addEventListener("click", () => {
        const p = this.points.find((q) => q.name === btn.dataset.name);
        if (!p) return;
        this.hide();
        this.onTravel?.(p);
      });
    }
  }

  toJSON() { return [...this.found]; }
  fromJSON(arr) { this.found = new Set(arr || []); }
}
