import { getElement } from "../data/elements.js";

// 퀘스트 추적.
//
// 화면 우측에 진행 중인 목표를 상시로 띄운다 (J로 접었다 폈다).
// RPG에서 "지금 뭘 해야 하지"를 잊는 순간 흥미가 끊기므로, 창을 열지 않아도
// 목표가 보여야 한다. 대신 좁으니 활성 퀘스트 하나만 자세히 보여준다.

export class QuestUI {
  /**
   * @param {import('../data/quests.js').QuestLog} log
   */
  constructor(log) {
    this.log = log;
    this.panel = document.getElementById("quest-panel");
    this.titleEl = document.getElementById("quest-title");
    this.listEl = document.getElementById("quest-objectives");
    this.rewardEl = document.getElementById("quest-reward");
    this.collapsed = false;
    this._sig = "";
  }

  toggle() {
    this.collapsed = !this.collapsed;
    this.panel.classList.toggle("collapsed", this.collapsed);
  }

  /**
   * @param {{flags:Set<string>, codexSize:number}} ctx
   */
  render(ctx) {
    const active = this.log.active;
    if (active.length === 0) {
      if (this._sig !== "none") { this.panel.hidden = true; this._sig = "none"; }
      return;
    }

    // 여러 개가 열려 있으면 가장 앞 장(章)의 것을 보여준다
    const q = active.slice().sort((a, b) => a.chapter - b.chapter)[0];

    const rows = q.objectives.map((o, i) => {
      const cur = this.log.progressOf(q, i, ctx);
      const need = this.log.targetOf(o);
      return { text: o.text, cur, need, done: cur >= need };
    });

    // 값이 바뀌지 않았으면 DOM을 건드리지 않는다
    const sig = q.id + "|" + rows.map((r) => `${r.cur}/${r.need}`).join(",");
    if (sig === this._sig) return;
    this._sig = sig;

    this.panel.hidden = false;
    this.titleEl.textContent = q.title;

    this.listEl.innerHTML = rows.map((r) =>
      `<li class="${r.done ? "done" : ""}">
         <span class="q-mark">${r.done ? "✓" : "•"}</span>
         <span class="q-text">${r.text}</span>
         ${r.need > 1 ? `<span class="q-count">${r.cur}/${r.need}</span>` : ""}
       </li>`
    ).join("");

    const rw = q.reward ?? {};
    const el = rw.element ? getElement(rw.element) : null;
    this.rewardEl.textContent = [
      el ? `${el.ko}(${el.sym}) 영입` : null,
      rw.exp ? `${rw.exp} EXP` : null,
    ].filter(Boolean).join(" · ");
  }
}
