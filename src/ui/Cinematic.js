// 자막과 엔딩 연출.
//
// 보스전 대사는 대화창을 쓰지 않는다. 전투 중에 조작을 뺏으면 안 되기 때문이다.
// 대신 화면 하단에 자막으로 흘리고, 플레이어는 계속 움직일 수 있다.
//
// 엔딩만 예외로 조작을 멈추고 전체 화면을 쓴다.

export class Cinematic {
  constructor() {
    this.subEl = document.getElementById("subtitle");
    this.subName = document.getElementById("sub-name");
    this.subText = document.getElementById("sub-text");
    this.bossBar = document.getElementById("boss-bar");
    this.bossName = document.getElementById("boss-name");
    this.bossFill = document.getElementById("boss-hp-fill");
    this.bossPhase = document.getElementById("boss-phase");
    this.timerEl = document.getElementById("doom-timer");

    this.endEl = document.getElementById("ending");
    this.endTitle = document.getElementById("ending-title");
    this.endName = document.getElementById("ending-name");
    this.endLines = document.getElementById("ending-lines");
    this.endMeta = document.getElementById("ending-meta");

    this._queue = [];
    this._timer = 0;
    this.endingOpen = false;

    document.getElementById("ending-close")?.addEventListener("click", () => {
      this.endEl.hidden = true;
      this.endingOpen = false;
      this.onEndingClose?.();
    });
  }

  /** 자막 한 줄. 여러 번 부르면 줄줄이 이어서 나온다 */
  say(name, text, color) {
    this._queue.push({ name, text, color });
    if (this._timer <= 0) this._next();
  }

  /** 여러 줄을 한꺼번에 */
  sayAll(name, lines, color) {
    for (const t of lines) this.say(name, t, color);
  }

  _next() {
    const item = this._queue.shift();
    if (!item) {
      this.subEl.hidden = true;
      return;
    }
    this.subEl.hidden = false;
    this.subName.textContent = item.name ?? "";
    this.subText.textContent = item.text ?? "";
    if (item.color) {
      this.subName.style.color = "#" + item.color.toString(16).padStart(6, "0");
    }
    // 글자 수에 비례한 표시 시간 — 짧은 대사가 오래 남아 있으면 답답하다
    this._timer = 1.6 + (item.text?.length ?? 0) * 0.055;
  }

  /** 보스 체력 바 */
  showBoss(boss) {
    this.bossBar.hidden = false;
    this.bossName.textContent = `${boss.def.name} — ${boss.def.epithet}`;
    this.bossBar.dataset.tier = boss.tier;
  }

  updateBoss(boss) {
    if (!boss || boss.defeated) { this.hideBoss(); return; }
    this.bossFill.style.width = `${Math.max(0, (boss.hp / boss.hpMax) * 100)}%`;
    const ph = boss.def.phases?.[boss.phaseIndex];
    this.bossPhase.textContent = ph ? `${boss.phaseIndex + 1}페이즈 · ${ph.name}` : "";

    if (boss.timerRunning) {
      this.timerEl.hidden = false;
      const t = Math.max(0, boss.timer);
      this.timerEl.textContent = `대륙 붕괴까지  ${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;
      this.timerEl.classList.toggle("urgent", t < 20);
    } else {
      this.timerEl.hidden = true;
    }
  }

  hideBoss() {
    this.bossBar.hidden = true;
    this.timerEl.hidden = true;
  }

  /**
   * 엔딩 — 조작을 멈추고 전체 화면으로.
   * @param {object} ending resolveEnding()의 반환값
   * @param {object} stats { level, playtime, codex, owned }
   */
  showEnding(ending, stats) {
    const d = ending.data;
    this.endingOpen = true;
    this.endEl.hidden = false;
    this.endEl.dataset.kind = d.isBad ? "bad" : d.isTrue ? "true" : "normal";

    this.endTitle.textContent = d.title ?? "";
    this.endName.textContent = d.name;
    this.endName.style.color = "#" + d.color.toString(16).padStart(6, "0");

    // 한 줄씩 나타나게 — 한꺼번에 뜨면 읽지 않는다
    this.endLines.innerHTML = d.lines
      .map((t, i) => `<p style="animation-delay:${i * 0.9}s">${t}</p>`)
      .join("");

    this.endMeta.textContent = [
      `레벨 ${stats.level}`,
      `원소 ${stats.owned}`,
      `도감 ${stats.codex}`,
      stats.playtime,
    ].filter(Boolean).join("  ·  ");
  }

  update(dt) {
    if (this._timer > 0) {
      this._timer -= dt;
      if (this._timer <= 0) this._next();
    }
  }
}
