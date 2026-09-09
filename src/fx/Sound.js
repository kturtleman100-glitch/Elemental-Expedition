// 소리.
//
// 이 게임은 여태 완전한 무음이었다. 이 나이대 아이에게 소리는 옵션이 아니다 —
// 때린 것이 맞았는지, 뭔가 얻었는지가 귀로 먼저 온다.
//
// 음원 파일을 쓰지 않고 그 자리에서 합성한다. 이유는 셋이다.
//   - 이미 VRM 125MB를 받고 있어서 더 받게 하고 싶지 않다
//   - 빌드 도구가 없어 에셋 관리가 번거롭다
//   - 이 게임의 소리는 짧은 효과음뿐이라 합성으로 충분하다
//
// 브라우저는 사용자가 한 번 눌러 주기 전에는 소리를 못 낸다. 그래서 첫
// 입력에서 unlock()을 부른다.

const MASTER = 0.22;   // 전체 음량. 아이가 놀라지 않을 만큼

export class Sound {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.master = null;
    this._last = new Map();   // 같은 소리가 한꺼번에 겹치는 것을 막는다
  }

  /** 첫 사용자 입력에서 부른다. 그전에는 브라우저가 소리를 막는다 */
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === "suspended") this.ctx.resume();
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = MASTER;
      this.master.connect(this.ctx.destination);
    } catch {
      this.ctx = null;   // 소리가 안 나도 게임은 돌아야 한다
    }
  }

  setEnabled(on) {
    this.enabled = !!on;
    if (this.master) this.master.gain.value = this.enabled ? MASTER : 0;
  }

  /** 같은 소리를 너무 자주 내지 않는다 — 겹치면 소음이 된다 */
  _throttle(key, ms) {
    const now = performance.now();
    if (now - (this._last.get(key) ?? -1e9) < ms) return false;
    this._last.set(key, now);
    return true;
  }

  /**
   * 짧은 음 하나.
   * @param {object} o
   * @param {number} o.freq 시작 주파수
   * @param {number} [o.to] 끝 주파수 (미끄러진다)
   * @param {number} [o.dur] 길이(초)
   * @param {OscillatorType} [o.type]
   * @param {number} [o.gain]
   * @param {number} [o.delay] 이만큼 뒤에 낸다
   */
  tone({ freq, to, dur = 0.12, type = "sine", gain = 1, delay = 0 }) {
    if (!this.ctx || !this.enabled) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (to) osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), t0 + dur);

    // 뚝 끊으면 '틱' 소리가 나므로 짧게 올리고 부드럽게 내린다
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

    osc.connect(g);
    g.connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  /** 잡음 — 발소리나 타격음의 '퍽' 하는 부분 */
  noise({ dur = 0.09, gain = 0.5, freq = 900, delay = 0 }) {
    if (!this.ctx || !this.enabled) return;
    const t0 = this.ctx.currentTime + delay;
    const n = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.value = gain;
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t0);
  }

  // ---------------- 게임이 부르는 소리들 ----------------

  /** 때렸다 */
  hit(mult = 1) {
    if (!this._throttle("hit", 60)) return;
    // 상성이 좋으면 높고 밝게 — 숫자를 안 봐도 귀로 먼저 안다
    const base = 180 + Math.min(2.6, mult) * 70;
    this.noise({ dur: 0.07, gain: 0.45, freq: 1400 });
    this.tone({ freq: base, to: base * 0.55, dur: 0.1, type: "square", gain: 0.28 });
  }

  /** 맞았다 */
  hurt() {
    if (!this._throttle("hurt", 120)) return;
    this.tone({ freq: 220, to: 90, dur: 0.22, type: "sawtooth", gain: 0.3 });
  }

  /** 뛰었다 */
  jump() {
    this.tone({ freq: 330, to: 560, dur: 0.11, type: "triangle", gain: 0.22 });
  }

  /** 무언가 얻었다 — 원소, 화합물, 퀘스트 보상 */
  gain() {
    this.tone({ freq: 660, dur: 0.09, type: "sine", gain: 0.3 });
    this.tone({ freq: 880, dur: 0.11, type: "sine", gain: 0.28, delay: 0.08 });
    this.tone({ freq: 1180, dur: 0.16, type: "sine", gain: 0.24, delay: 0.17 });
  }

  /** 퀘스트를 마쳤다 — 얻었을 때보다 한 단계 크게 */
  complete() {
    this.tone({ freq: 523, dur: 0.13, type: "triangle", gain: 0.3 });
    this.tone({ freq: 659, dur: 0.13, type: "triangle", gain: 0.3, delay: 0.12 });
    this.tone({ freq: 784, dur: 0.13, type: "triangle", gain: 0.3, delay: 0.24 });
    this.tone({ freq: 1047, dur: 0.3, type: "triangle", gain: 0.26, delay: 0.36 });
  }

  /** 말을 걸었다 */
  talk() {
    this.tone({ freq: 520, to: 640, dur: 0.07, type: "sine", gain: 0.18 });
  }

  /** 창을 열고 닫는다 */
  ui(open = true) {
    this.tone({
      freq: open ? 440 : 380, to: open ? 620 : 300,
      dur: 0.08, type: "sine", gain: 0.16,
    });
  }

  /** 적을 쓰러뜨렸다 */
  defeat() {
    this.tone({ freq: 300, to: 120, dur: 0.28, type: "sawtooth", gain: 0.26 });
    this.noise({ dur: 0.2, gain: 0.3, freq: 600, delay: 0.02 });
  }
}
