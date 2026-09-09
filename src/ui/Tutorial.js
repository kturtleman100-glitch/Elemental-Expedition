// 조작 안내.
//
// 여태 조작을 알려주는 화면이 게임 안에 없었다. 조작표는 개발 문서에만 있고,
// 그래서 P(파티)를 모르면 원소를 영원히 장착하지 못했다. 게임 시스템의
// 절반이 봉인된 채로 끝나는 셈이다.
//
// 건너뛰기를 반드시 둔다. 저장 슬롯이 셋이라 새 게임을 자주 시작하는데,
// 두 번째부터는 안내가 방해물이 된다.

const KEY = "ee.tutorial.done";

/** 한 장에 한 가지만. 여러 개를 한꺼번에 보여주면 아무것도 안 남는다 */
const STEPS = [
  {
    title: "움직이기",
    body: "<b>W A S D</b> 또는 <b>화살표</b>로 걷습니다.<br>마우스를 움직이면 둘러봅니다. <b>Space</b>로 뜁니다.",
  },
  {
    title: "말 걸기",
    body: "사람 가까이 가면 이름 아래에 안내가 뜹니다.<br><b>Enter</b> · <b>F</b> · <b>우클릭</b> 아무거나 누르면 이야기가 시작됩니다.",
  },
  {
    title: "싸우기",
    body: "머리 위 이름표가 <b style='color:#eb5757'>붉은</b> 쪽이 적입니다.<br><b>좌클릭</b>으로 공격하고, <b>Tab</b>으로 상대를 바꿉니다.",
  },
  {
    title: "원소 장착하기 — 이게 제일 중요합니다",
    body: "<b>P</b>를 눌러 편성 창을 엽니다.<br>여기서 원소를 넣어야 그 힘을 씁니다. <b>1~4</b>로 싸우는 중에도 바꿉니다.",
  },
  {
    title: "그 밖에",
    body: "<b>K</b> 도감 · <b>E</b> 가방 · <b>J</b> 할 일 · <b>M</b> 빠른 이동<br><b>Esc</b>로 메뉴를 열어 저장합니다.",
  },
];

export class Tutorial {
  constructor() {
    this.root = document.getElementById("tut");
    this.titleEl = document.getElementById("tut-title");
    this.bodyEl = document.getElementById("tut-body");
    this.stepEl = document.getElementById("tut-step");
    this.nextEl = document.getElementById("tut-next");
    this.i = 0;
    this.open = false;
    /** @type {(() => void)|null} 닫힐 때 부른다 */
    this.onClose = null;

    document.getElementById("tut-skip")?.addEventListener("click", () => this.close());
    this.nextEl?.addEventListener("click", () => this.next());
  }

  /** 한 번이라도 끝까지 봤는가 */
  static get seen() {
    try { return localStorage.getItem(KEY) === "1"; } catch { return false; }
  }

  static markSeen() {
    try { localStorage.setItem(KEY, "1"); } catch { /* 시크릿 모드 */ }
  }

  /** 처음 하는 사람에게만 자동으로 뜬다 */
  showIfFirstTime() {
    if (Tutorial.seen) return false;
    this.show();
    return true;
  }

  show() {
    if (!this.root) return;
    this.i = 0;
    this.open = true;
    this.root.hidden = false;
    this._render();
  }

  next() {
    if (this.i >= STEPS.length - 1) { this.close(); return; }
    this.i++;
    this._render();
  }

  close() {
    if (!this.root) return;
    this.open = false;
    this.root.hidden = true;
    Tutorial.markSeen();
    this.onClose?.();
  }

  _render() {
    const s = STEPS[this.i];
    this.titleEl.textContent = s.title;
    this.bodyEl.innerHTML = s.body;
    this.stepEl.textContent = `${this.i + 1} / ${STEPS.length}`;
    this.nextEl.textContent = this.i >= STEPS.length - 1 ? "시작하기" : "다음";
  }
}
