import * as Save from "../core/SaveData.js";

// 저장 메뉴 (Esc) — 저장 슬롯 3개, 설정, 타이틀로 나가기.
//
// 슬롯마다 챕터·레벨·플레이 시간·저장 시각을 보여준다. "슬롯 1, 2, 3"만
// 있으면 어느 것이 무엇인지 알 수 없어서 덮어쓰기 사고가 난다.

export class SaveMenu {
  /**
   * @param {object} hooks { getContext, onLoad, onQuit, toast }
   */
  constructor(hooks) {
    this.hooks = hooks;
    this.root = document.getElementById("save-menu");
    this.slotsEl = document.getElementById("sm-slots");
    this.settingsEl = document.getElementById("sm-settings");
    this.warnEl = document.getElementById("sm-warn");
    this.open = false;
    this.mode = "save"; // "save" | "load"

    document.getElementById("sm-close").addEventListener("click", () => this.hide());
    document.getElementById("sm-quit").addEventListener("click", () => {
      this.hide();
      this.hooks.onQuit?.();
    });
    this.root.addEventListener("click", (e) => { if (e.target === this.root) this.hide(); });

    for (const btn of this.root.querySelectorAll("[data-mode]")) {
      btn.addEventListener("click", () => {
        this.mode = btn.dataset.mode;
        this._render();
      });
    }

    this.settings = Save.loadSettings();
    this._buildSettings();
  }

  toggle() { this.open ? this.hide() : this.show(); }
  show() { this.open = true; this.root.hidden = false; this._render(); }
  hide() { this.open = false; this.root.hidden = true; }

  _render() {
    for (const btn of this.root.querySelectorAll("[data-mode]")) {
      btn.setAttribute("aria-pressed", String(btn.dataset.mode === this.mode));
    }

    this.warnEl.hidden = Save.storageAvailable();

    const slots = Save.listSlots();
    // 삭제 버튼은 슬롯 버튼 안에 넣을 수 없다(버튼 중첩은 유효하지 않은 HTML이라
    // 클릭이 엉킨다). 줄을 감싸는 div를 두고 형제로 놓는다.
    this.slotsEl.innerHTML = slots.map((s) => {
      if (s.empty) {
        return `<div class="sm-slot-row">
                  <button class="sm-slot empty" type="button" data-slot="${s.slot}"
                    ${this.mode === "load" ? "disabled" : ""}>
                    <span class="sm-no">${s.slot + 1}</span>
                    <span class="sm-empty">비어 있음</span>
                  </button>
                </div>`;
      }
      return `<div class="sm-slot-row">
                <button class="sm-slot" type="button" data-slot="${s.slot}">
                  <span class="sm-no">${s.slot + 1}</span>
                  <span class="sm-info">
                    <b>${s.chapter}장 · 레벨 ${s.level}</b>
                    <span>원소 ${s.owned} · 도감 ${s.codex}</span>
                    <span class="sm-time">${Save.formatPlaytime(s.playtime)} · ${Save.formatDate(s.savedAt)}</span>
                  </span>
                </button>
                <button class="sm-del" type="button" data-del="${s.slot}"
                  title="슬롯 ${s.slot + 1} 삭제" aria-label="슬롯 ${s.slot + 1} 삭제">✕</button>
              </div>`;
    }).join("");

    for (const btn of this.slotsEl.querySelectorAll(".sm-slot")) {
      btn.addEventListener("click", () => this._onSlot(Number(btn.dataset.slot)));
    }
    for (const btn of this.slotsEl.querySelectorAll(".sm-del")) {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        this._onDelete(Number(btn.dataset.del));
      });
    }
  }

  /** 슬롯 삭제 — 되돌릴 수 없으므로 무엇을 지우는지 보여주고 묻는다 */
  _onDelete(slot) {
    const s = Save.listSlots()[slot];
    if (!s || s.empty) return;
    const what = `슬롯 ${slot + 1} · ${s.chapter}장 · 레벨 ${s.level} · ${Save.formatPlaytime(s.playtime)}`;
    if (!confirm(`${what}\n\n이 저장을 지웁니다. 되돌릴 수 없습니다.`)) return;
    Save.clear(slot);
    this.hooks.toast?.(`슬롯 ${slot + 1}을 지웠습니다`, "#eb5757");
    this.hooks.onDeleted?.();
    this._render();
  }

  _onSlot(slot) {
    if (this.mode === "save") {
      const existing = Save.listSlots()[slot];
      if (!existing.empty && !confirm(`슬롯 ${slot + 1}에 덮어쓸까요?`)) return;
      const ok = Save.save(slot, this.hooks.getContext());
      this.hooks.toast?.(ok ? `슬롯 ${slot + 1}에 저장했습니다` : "저장에 실패했습니다",
                         ok ? "#8fe388" : "#eb5757");
      this._render();
    } else {
      const data = Save.load(slot);
      if (!data) return;
      this.hooks.onLoad?.(data);
      this.hide();
    }
  }

  _buildSettings() {
    const s = this.settings;
    this.settingsEl.innerHTML = `
      <label class="sm-row">
        <span>마우스 감도</span>
        <input type="range" id="set-sens" min="0" max="1" step="0.05" value="${s.sensitivity}">
      </label>
      <label class="sm-row">
        <span>전투 시 카메라 자동 추적</span>
        <input type="checkbox" id="set-lock" ${s.cameraLock ? "checked" : ""}>
      </label>
      <label class="sm-row">
        <span>그림자</span>
        <input type="checkbox" id="set-shadow" ${s.shadows ? "checked" : ""}>
      </label>
      <label class="sm-row">
        <span>파티클</span>
        <input type="checkbox" id="set-particle" ${s.particles ? "checked" : ""}>
      </label>
      <p class="sm-note">카메라 자동 추적은 3D 멀미의 흔한 원인입니다. 어지러우면 꺼주세요.</p>`;

    const bind = (id, key, get) => {
      const el = document.getElementById(id);
      el?.addEventListener("input", () => {
        this.settings[key] = get(el);
        Save.saveSettings(this.settings);
        this.hooks.onSettings?.(this.settings);
      });
    };
    bind("set-sens", "sensitivity", (el) => Number(el.value));
    bind("set-lock", "cameraLock", (el) => el.checked);
    bind("set-shadow", "shadows", (el) => el.checked);
    bind("set-particle", "particles", (el) => el.checked);
  }
}
