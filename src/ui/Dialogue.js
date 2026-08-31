import { DIALOGUES, startNode } from "../data/dialogue.js";
import { getElement, FAMILY_LABEL } from "../data/elements.js";
import { getFaction } from "../data/factions.js";

// 대화창.
//
// 초상화 이미지를 쓰지 않고 주기율표 칸 모양으로 화자를 표시한다.
// 원자번호와 기호가 그대로 신분증이 되는 게 이 게임에 맞고, 에셋도 필요 없다.
//
// 대화 중에는 이동을 막고 포인터 락을 푼다 — 그래야 선택지를 마우스로 고를 수 있다.

const TYPE_SPEED = 28; // 글자/초. 너무 빠르면 읽는 맛이 없고 느리면 답답하다

export class Dialogue {
  /**
   * @param {{onEffect?: (effect:object)=>void, onClose?: ()=>void}} hooks
   */
  constructor(hooks = {}) {
    this.root = document.getElementById("dialogue");
    this.cell = document.getElementById("dlg-cell");
    this.cellNum = document.getElementById("dlg-cell-num");
    this.cellSym = document.getElementById("dlg-cell-sym");
    this.nameEl = document.getElementById("dlg-name");
    this.roleEl = document.getElementById("dlg-role");
    this.textEl = document.getElementById("dlg-text");
    this.choicesEl = document.getElementById("dlg-choices");
    this.moreEl = document.getElementById("dlg-more");

    this.hooks = hooks;
    this.active = false;
    this.element = null;
    this.node = null;
    this.lineIndex = 0;
    this.typed = 0;
    this.fullText = "";

    this.root.addEventListener("click", (e) => {
      // 선택지 버튼을 눌렀을 때는 진행 처리를 하지 않는다
      if (e.target.closest(".dlg-choice")) return;
      this.advance();
    });
  }

  /**
   * @param {string} elementId
   * @param {Set<string>} flags 진행 플래그 (반복 대화 판정에 쓴다)
   */
  open(elementId, flags) {
    const el = getElement(elementId);
    const script = DIALOGUES[elementId];
    if (!el || !script) return false;

    this.element = el;
    this.script = script;
    this.flags = flags;
    this.active = true;

    // 주기율표 칸 — 족 색을 그대로 쓴다
    const faction = getFaction(el.faction);
    this.cell.style.setProperty("--cell", "#" + faction.color.toString(16).padStart(6, "0"));
    this.cellNum.textContent = el.z;
    this.cellSym.textContent = el.sym;
    this.nameEl.textContent = `${el.ko} (${el.sym})`;
    this.roleEl.textContent = `${FAMILY_LABEL[el.family] ?? ""} · ${el.role}`;

    this.root.hidden = false;
    this._goto(startNode(elementId, flags));
    return true;
  }

  close() {
    this.active = false;
    this.root.hidden = true;
    this.choicesEl.innerHTML = "";
    if (this.element) this.flags.add(`talked_${this.element.id}`);
    this.hooks.onClose?.();
  }

  _goto(key) {
    if (!key) return this.close();
    const node = this.script.nodes[key];
    if (!node) return this.close();

    this.node = node;
    this.lineIndex = 0;
    this.choicesEl.innerHTML = "";
    this._startLine();
  }

  _startLine() {
    this.fullText = this.node.lines[this.lineIndex] ?? "";
    this.typed = 0;
    this.textEl.textContent = "";
    this.moreEl.hidden = true;
    this.choicesEl.hidden = true;
  }

  /** 프레임마다 호출 — 타자기 효과 */
  update(dt) {
    if (!this.active || !this.node) return;
    if (this.typed >= this.fullText.length) return;

    this.typed = Math.min(this.fullText.length, this.typed + TYPE_SPEED * dt);
    this.textEl.textContent = this.fullText.slice(0, Math.floor(this.typed));

    if (this.typed >= this.fullText.length) this._onLineDone();
  }

  _onLineDone() {
    const last = this.lineIndex >= this.node.lines.length - 1;
    if (last) this._showChoices();
    else this.moreEl.hidden = false;
  }

  /** 클릭/스페이스 — 타자 중이면 즉시 완성, 아니면 다음 줄 */
  advance() {
    if (!this.active || !this.node) return;

    if (this.typed < this.fullText.length) {
      this.typed = this.fullText.length;
      this.textEl.textContent = this.fullText;
      this._onLineDone();
      return;
    }

    if (this.lineIndex < this.node.lines.length - 1) {
      this.lineIndex++;
      this._startLine();
    }
    // 마지막 줄이면 선택지가 이미 떠 있으므로 아무것도 하지 않는다
  }

  _showChoices() {
    const choices = this.node.choices ?? [{ text: "…", to: null }];
    this.choicesEl.innerHTML = "";
    this.choicesEl.hidden = false;

    for (const c of choices) {
      const btn = document.createElement("button");
      btn.className = "dlg-choice";
      btn.type = "button";
      btn.textContent = c.text;
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (c.effect) this.hooks.onEffect?.(c.effect);
        this._goto(c.to);
      });
      this.choicesEl.appendChild(btn);
    }
  }
}
