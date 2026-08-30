// 적응형 고정 틱 루프.
// 논리 업데이트는 프레임당 최소 1회 보장하되, 기기 등급이 허용하는 한
// 최대한 자주(120/90/60Hz) 돌린다. 렌더는 남은 비율(alpha)로 보간한다.
//
// 자동 조정: 업데이트가 프레임 예산의 40%를 넘게 잡아먹으면 한 단계 다운,
// 20% 아래로 3초 이상 여유가 지속되면 한 단계 업.
//
// 참고: 이 루프는 "게임 로직" 틱 레이트만 다룬다. 멀티플레이 네트워크
// 동기화는 별도 고정 20Hz로 돌며 net/ 모듈이 자체 타이머로 처리한다
// (틱 레이트가 기기마다 달라 네트워크 주기의 기준이 될 수 없기 때문).

const MAX_TICKS_PER_FRAME = 5;
const MIN_TICK_HZ = 30;
const DOWNGRADE_LOAD_RATIO = 0.4;
const UPGRADE_LOAD_RATIO = 0.2;
const UPGRADE_HOLD_MS = 3000;

export class Loop {
  /**
   * @param {object} opts
   * @param {(dt:number)=>void} opts.update  1틱 = 1회 호출, dt는 초 단위 고정값
   * @param {(alpha:number, frameDt:number)=>void} opts.render  프레임마다 1회
   * @param {import('./Device.js').Device} opts.device
   * @param {(frameDt:number)=>void} [opts.preFrame]  틱 루프 전에 프레임당 정확히 1회 —
   *   마우스 시선처럼 "틱이 아니라 프레임에 묶여야 하는" 입력을 여기서 소비한다.
   */
  constructor({ update, render, device, preFrame }) {
    this.update = update;
    this.render = render;
    this.device = device;
    this.preFrame = preFrame ?? (() => {});

    this.tickHz = device.tier.tickRateHz;
    this.tickDt = 1 / this.tickHz;

    this.accumulator = 0;
    this.lastTime = performance.now();
    this.running = false;
    this._rafId = null;

    // 디버그/자동 조정용 계측치
    this.fps = 0;
    this._fpsFrames = 0;
    this._fpsAccum = 0;
    this._updateLoadRatio = 0;
    this._lowLoadSince = null;

    this._frame = this._frame.bind(this);
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    this.accumulator = 0;
    this._rafId = requestAnimationFrame(this._frame);
  }

  stop() {
    this.running = false;
    if (this._rafId !== null) cancelAnimationFrame(this._rafId);
    this._rafId = null;
  }

  setTickHz(hz) {
    this.tickHz = Math.max(MIN_TICK_HZ, hz);
    this.tickDt = 1 / this.tickHz;
  }

  _frame(now) {
    if (!this.running) return;
    this._rafId = requestAnimationFrame(this._frame);

    let frameDt = (now - this.lastTime) / 1000;
    this.lastTime = now;
    // 탭이 백그라운드에 있다가 돌아온 경우 등 비정상적으로 큰 delta는 잘라낸다.
    frameDt = Math.min(frameDt, 0.25);

    this.accumulator += frameDt;

    this.preFrame(frameDt);

    let ticks = 0;
    const updateStart = performance.now();
    while (this.accumulator >= this.tickDt && ticks < MAX_TICKS_PER_FRAME) {
      this.update(this.tickDt);
      this.accumulator -= this.tickDt;
      ticks++;
    }
    if (ticks === 0) {
      // 최소 1회 보장 — accumulator가 아직 안 찼어도 이번 프레임은 갱신한다.
      this.update(this.tickDt);
      this.accumulator = 0;
      ticks = 1;
    }
    const updateMs = performance.now() - updateStart;

    const alpha = Math.min(1, this.accumulator / this.tickDt);
    this.render(alpha, frameDt);

    this._trackPerf(frameDt, updateMs, ticks);
  }

  _trackPerf(frameDt, updateMs, ticks) {
    // FPS (1초 평균)
    this._fpsFrames++;
    this._fpsAccum += frameDt;
    if (this._fpsAccum >= 1) {
      this.fps = this._fpsFrames / this._fpsAccum;
      this._fpsFrames = 0;
      this._fpsAccum = 0;
    }

    // 프레임 예산 대비 논리 업데이트 부하 비율
    const frameBudgetMs = frameDt > 0 ? frameDt * 1000 : 16.7;
    this._updateLoadRatio = updateMs / frameBudgetMs;

    const now = performance.now();
    if (this._updateLoadRatio > DOWNGRADE_LOAD_RATIO) {
      this._lowLoadSince = null;
      if (this.device.downgrade()) {
        this.setTickHz(this.device.tier.tickRateHz);
      }
    } else if (this._updateLoadRatio < UPGRADE_LOAD_RATIO) {
      if (this._lowLoadSince === null) this._lowLoadSince = now;
      if (now - this._lowLoadSince > UPGRADE_HOLD_MS) {
        this._lowLoadSince = now;
        if (this.device.upgrade()) {
          this.setTickHz(this.device.tier.tickRateHz);
        }
      }
    } else {
      this._lowLoadSince = null;
    }
  }

  getDebugInfo() {
    return {
      fps: this.fps,
      tickHz: this.tickHz,
      tier: this.device.tierName,
      loadRatio: this._updateLoadRatio,
    };
  }
}
