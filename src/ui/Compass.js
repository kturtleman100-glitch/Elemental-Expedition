// 화면 상단의 띠 나침반.
//
// 마을이 지름 130m에 구역이 5개라 "지금 어느 쪽을 보고 있는가"와
// "가려는 곳이 어느 방향인가"를 알 수 없으면 길을 잃는다.
// 미니맵(5단계)보다 먼저 이걸 넣는 이유는, 띠 나침반이 화면을 덜 가리면서
// 방향 감각만 정확히 주기 때문이다.
//
// 방위 기준: 월드 -Z 를 북쪽으로 삼는다. 컨셉 배치도에서 주거 구역이 위쪽(-Z)이라
// 그쪽을 북으로 두는 편이 지도와 게임 화면이 어긋나지 않는다.

const CARDINALS = [
  { deg: 0, label: "북", major: true },
  { deg: 45, label: "북동", major: false },
  { deg: 90, label: "동", major: true },
  { deg: 135, label: "남동", major: false },
  { deg: 180, label: "남", major: true },
  { deg: 225, label: "남서", major: false },
  { deg: 270, label: "서", major: true },
  { deg: 315, label: "북서", major: false },
];

// 마을의 주요 지점. 플레이어 위치에서의 방위를 계산해 표식으로 띄운다.
const LANDMARKS = [
  { x: 0, z: 0, label: "광장", color: "#e8c07a" },
  { x: 0, z: -50, label: "촌장 집", color: "#8fd1d4" },
  { x: -40, z: 26, label: "대안통운", color: "#d9a441" },
  { x: 40, z: 30, label: "농경지", color: "#9fd17a" },
  { x: -43, z: -34, label: "석회암 동굴", color: "#d8cfb8" },
];

const VIEW_SPAN = 110; // 나침반에 한 번에 담는 각도 범위
const NEAR_HIDE = 9; // 이 거리 안에 들어오면 표식을 숨긴다 (도착한 셈)

export class Compass {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {import('../player/Player.js').Player} player
   * @param {import('../player/CameraRig.js').CameraRig} cameraRig
   */
  constructor(canvas, player, cameraRig) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.player = player;
    this.cameraRig = cameraRig;
    this.dpr = 1;
    // 캔버스 2D의 fillText는 비싸다. 방위가 거의 그대로면 다시 그리지 않는다.
    this._lastBearing = -999;
    this._lastX = -9999;
    this._lastZ = -9999;
    this.resize();
  }

  resize() {
    this._lastBearing = -999;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = this.canvas.clientWidth || 340;
    const h = this.canvas.clientHeight || 34;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.dpr = dpr;
    this.w = w;
    this.h = h;
  }

  /**
   * 카메라 yaw를 나침반 방위각으로 바꾼다.
   * CameraRig의 전방 벡터는 (sin(yaw), cos(yaw)) 이므로
   *   yaw=0   → +Z (남),  yaw=π/2 → +X (동),  yaw=π → −Z (북)
   * 이고, 북을 0도로 두면 bearing = 180 − yaw 가 된다.
   */
  _bearing() {
    const deg = (this.cameraRig.yawRadians * 180) / Math.PI;
    return ((180 - deg) % 360 + 360) % 360;
  }

  /** 두 방위각의 차이를 −180~180 범위로 (화면 중앙 기준 좌우 오프셋) */
  _delta(target, current) {
    return ((target - current + 540) % 360) - 180;
  }

  render(force = false) {
    const bearing = this._bearing();
    const px = this.player.position.x;
    const pz = this.player.position.z;

    // 0.4도 미만으로 돌았고 1m 미만으로 움직였으면 화면이 사실상 같다.
    // 60fps에서 이 검사만으로 대부분의 프레임을 건너뛴다.
    if (!force
        && Math.abs(this._delta(bearing, this._lastBearing)) < 0.4
        && Math.abs(px - this._lastX) < 1
        && Math.abs(pz - this._lastZ) < 1) return;

    this._lastBearing = bearing;
    this._lastX = px;
    this._lastZ = pz;

    const ctx = this.ctx;
    const { w, h, dpr } = this;
    const pxPerDeg = w / VIEW_SPAN;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    // 배경 띠 — 가장자리를 투명하게 흘려 화면에 눌러 붙지 않게 한다
    const bg = ctx.createLinearGradient(0, 0, w, 0);
    bg.addColorStop(0, "rgba(12,16,20,0)");
    bg.addColorStop(0.18, "rgba(12,16,20,0.55)");
    bg.addColorStop(0.82, "rgba(12,16,20,0.55)");
    bg.addColorStop(1, "rgba(12,16,20,0)");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    const baseY = h - 9;

    // 5도 간격 눈금
    ctx.strokeStyle = "rgba(232,228,220,0.3)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let d = 0; d < 360; d += 5) {
      const off = this._delta(d, bearing);
      if (Math.abs(off) > VIEW_SPAN / 2) continue;
      const x = w / 2 + off * pxPerDeg;
      const tall = d % 45 === 0;
      ctx.moveTo(x, baseY);
      ctx.lineTo(x, baseY - (tall ? 7 : 4));
    }
    ctx.stroke();

    // 방위 글자
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    for (const c of CARDINALS) {
      const off = this._delta(c.deg, bearing);
      if (Math.abs(off) > VIEW_SPAN / 2) continue;
      const x = w / 2 + off * pxPerDeg;
      // 중앙에서 멀수록 흐려지게 — 시선이 가운데로 모인다
      const fade = 1 - Math.min(1, Math.abs(off) / (VIEW_SPAN / 2)) * 0.65;

      if (c.major) {
        ctx.font = "700 13px 'Noto Sans KR', system-ui, sans-serif";
        ctx.fillStyle = c.deg === 0
          ? `rgba(232,160,90,${fade})`   // 북쪽만 다른 색 — 기준점을 즉시 찾게
          : `rgba(240,236,228,${fade})`;
      } else {
        ctx.font = "400 10px 'Noto Sans KR', system-ui, sans-serif";
        ctx.fillStyle = `rgba(200,195,185,${fade * 0.75})`;
      }
      ctx.fillText(c.label, x, baseY - 11);
    }

    // 지점 표식 — 플레이어 위치 기준 방위
    for (const m of LANDMARKS) {
      const dx = m.x - px;
      const dz = m.z - pz;
      const dist = Math.hypot(dx, dz);
      if (dist < NEAR_HIDE) continue;

      // 북(−Z)을 0도로 하는 방위각
      const deg = ((Math.atan2(dx, -dz) * 180) / Math.PI + 360) % 360;
      const off = this._delta(deg, bearing);
      if (Math.abs(off) > VIEW_SPAN / 2) continue;

      const x = w / 2 + off * pxPerDeg;
      const fade = 1 - Math.min(1, Math.abs(off) / (VIEW_SPAN / 2)) * 0.6;

      ctx.globalAlpha = fade;
      ctx.fillStyle = m.color;

      // 아래를 가리키는 작은 삼각형
      ctx.beginPath();
      ctx.moveTo(x, baseY + 5);
      ctx.lineTo(x - 4, baseY - 1);
      ctx.lineTo(x + 4, baseY - 1);
      ctx.closePath();
      ctx.fill();

      // 화면 중앙에 가까운 표식에만 이름과 거리를 붙인다 — 안 그러면 글자가 겹친다
      if (Math.abs(off) < 16) {
        ctx.font = "500 10px 'Noto Sans KR', system-ui, sans-serif";
        ctx.fillStyle = `rgba(240,236,228,${fade})`;
        ctx.fillText(`${m.label} ${Math.round(dist)}m`, x, h - 0.5);
      }
      ctx.globalAlpha = 1;
    }

    // 중앙 지시선
    ctx.strokeStyle = "rgba(232,160,90,0.95)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(w / 2, baseY + 3);
    ctx.lineTo(w / 2, baseY - 15);
    ctx.stroke();
  }
}
