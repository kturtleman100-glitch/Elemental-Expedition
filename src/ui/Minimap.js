// 미니맵 (Canvas 2D).
//
// 마을이 지름 130m에 구역이 5개라 나침반만으로는 부족하다.
// 다만 지도를 그리려고 3D 씬을 다시 훑으면 비싸므로, 정적인 것(건물·길)은
// 처음 한 번만 오프스크린 캔버스에 그려두고 매 프레임은 그걸 회전시켜 붙인다.
// 움직이는 것(적·NPC·퀘스트 표식)만 위에 덧그린다.

const WORLD_R = 190;   // 지도가 담는 월드 반경 (마을 밖 야외까지)
const VIEW_R = 60;     // 화면에 보이는 월드 반경 (확대 정도)

const COLORS = {
  ground: "#2c3a26",
  road: "#7d6f52",
  plaza: "#8a7a5c",
  building: "#4a6b6e",
  chief: "#7a5a4a",
  work: "#6b4a3a",
  farm: "#4c452a",
  rock: "#9a927e",
  tree: "#3a5c32",
  water: "#2f6a86",
};

// World.js의 배치를 그대로 옮긴 축약본. 3D 씬을 훑는 대신 이 표로 그린다.
const STATIC = {
  roads: [
    [0, 13, 0, 131], [0, -13, 0, -101], [13, 0, 109, 0], [-13, 0, -109, 0],
  ],
  plaza: { x: 0, z: 0, r: 16 },
  buildings: [
    // 광장
    [-15, 12, 4.6, 4.2], [15, 11, 4.4, 4.0], [-10, 20, 4.8, 4.4],
    // 주거 (북)
    [0, -52, 7.6, 6.0, "chief"], [-16, -30, 4.8, 4.4], [15, -31, 4.6, 4.2],
    [-21, -45, 4.4, 4.0], [20, -46, 4.6, 4.2], [-15, -58, 4.2, 3.8], [15, -59, 4.4, 4.0],
    // 공방 (서남)
    [-40, 26, 11, 7, "work"], [-30, 14, 5.0, 4.6, "work"], [-46, 14, 4.4, 4.0, "work"],
    [-33, 36, 4.6, 4.2, "work"], [-50, 30, 4.2, 3.8, "work"],
    // 농경 (동남)
    [30, 16, 4.6, 4.2], [47, 24, 4.4, 4.0], [38, 38, 7, 5.4, "chief"],
  ],
  fields: [[34, 27, 12, 9], [50, 38, 10, 8]],
  rocks: [[-40, -30, 4.4], [-34, -36, 2.8], [-47, -24, 3.2], [-36, -23, 2.0],
          [-52, -34, 3.6], [-44, -41, 2.4], [-43, -34, 3.6]],
  trees: [
    [-21, 5], [20, 4], [-19, -16], [21, -17], [-8, 24], [9, 25], [22, 2], [-23, -6],
    [-26, -34], [25, -35], [-12, -64], [13, -65], [-30, -52], [29, -53],
    [-24, 34], [-56, 20], [-44, 44], [-58, 38], [24, 40], [56, 16], [46, 48], [58, 34],
    [-58, -20], [-30, -46], [-56, -46],
  ],
  well: { x: 0, z: 0 },

  // ---- 마을 밖 ----
  outerRocks: [
    [-70, -96, 6.0], [-52, -104, 4.4], [-88, -84, 5.2], [-34, -112, 4.0],
    [12, -108, 5.6], [40, -96, 4.8], [64, -110, 6.2], [-14, -128, 5.0],
    [30, -132, 4.4], [-60, -130, 5.8], [80, -84, 4.2], [-96, -110, 4.6],
  ],
  outerTrees: [
    [102, -30], [112, -14], [98, 6], [116, 20], [104, 40], [120, -46],
    [96, -58], [126, 4], [108, 62], [130, 40], [94, 74], [122, -70],
  ],
  river: { x: 84, z: -10, w: 14, len: 220, tilt: 0.06 },
  bridge: { x: 84, z: 0, w: 22, d: 5.4 },
  pond: { x: -24, z: 104, r: 16 },
  sand: { x: 0, z: 146, w: 200, d: 70 },
  ruins: [
    [-96, 18], [-88, 30], [-104, 34], [-92, 46],
    [-110, 20], [-100, 6], [-118, 40], [-84, 12],
  ],
  signposts: [[0, -96], [96, 0], [0, 118], [-96, 0]],
  camps: [[-58, 78], [72, -62], [-72, -58], [46, 92]],
};

export class Minimap {
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
    this.enemies = [];
    /** 형석(CaF2)이 비추는 반경. 0이면 꺼져 있다 */
    this.revealRadius = 0;
    this.npcs = [];
    this.markers = [];   // 퀘스트 목표 등 {x,z,color}
    this._built = false;
    this.resize();
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const s = this.canvas.clientWidth || 150;
    this.canvas.width = this.canvas.height = Math.round(s * dpr);
    this.dpr = dpr;
    this.size = s;
    this._built = false;
  }

  /** 정적 지형을 오프스크린에 한 번만 그린다 */
  _buildStatic() {
    const px = 3; // 월드 1m당 픽셀 (반경 190이라 3이면 1140px)
    const S = WORLD_R * 2 * px;
    const c = document.createElement("canvas");
    c.width = c.height = S;
    const g = c.getContext("2d");

    const toX = (x) => (x + WORLD_R) * px;
    const toY = (z) => (z + WORLD_R) * px;

    g.fillStyle = COLORS.ground;
    g.fillRect(0, 0, S, S);

    // 광장
    g.fillStyle = COLORS.plaza;
    g.beginPath();
    g.arc(toX(STATIC.plaza.x), toY(STATIC.plaza.z), STATIC.plaza.r * px, 0, Math.PI * 2);
    g.fill();

    // 길
    g.strokeStyle = COLORS.road;
    g.lineWidth = 5 * px;
    g.lineCap = "round";
    for (const [x1, z1, x2, z2] of STATIC.roads) {
      g.beginPath();
      g.moveTo(toX(x1), toY(z1));
      g.lineTo(toX(x2), toY(z2));
      g.stroke();
    }

    // 강 — 길보다 먼저 그려야 다리가 위로 온다
    g.save();
    g.translate(toX(STATIC.river.x), toY(STATIC.river.z));
    g.rotate(-STATIC.river.tilt);
    g.fillStyle = COLORS.water;
    g.fillRect(-STATIC.river.w / 2 * px, -STATIC.river.len / 2 * px,
               STATIC.river.w * px, STATIC.river.len * px);
    g.restore();

    // 모래밭
    g.fillStyle = "#8a7a58";
    g.fillRect(toX(STATIC.sand.x - STATIC.sand.w / 2), toY(STATIC.sand.z - STATIC.sand.d / 2),
               STATIC.sand.w * px, STATIC.sand.d * px);

    // 연못
    g.fillStyle = COLORS.water;
    g.beginPath();
    g.arc(toX(STATIC.pond.x), toY(STATIC.pond.z), STATIC.pond.r * px, 0, Math.PI * 2);
    g.fill();

    // 밭
    g.fillStyle = COLORS.farm;
    for (const [x, z, w, d] of STATIC.fields) {
      g.fillRect(toX(x - w / 2), toY(z - d / 2), w * px, d * px);
    }

    // 나무
    g.fillStyle = COLORS.tree;
    for (const [x, z] of STATIC.trees) {
      g.beginPath();
      g.arc(toX(x), toY(z), 1.6 * px, 0, Math.PI * 2);
      g.fill();
    }

    // 석회암
    g.fillStyle = COLORS.rock;
    for (const [x, z, r] of STATIC.rocks) {
      g.beginPath();
      g.arc(toX(x), toY(z), r * px * 0.8, 0, Math.PI * 2);
      g.fill();
    }

    // 건물
    for (const [x, z, w, d, kind] of STATIC.buildings) {
      g.fillStyle = kind === "chief" ? COLORS.chief : kind === "work" ? COLORS.work : COLORS.building;
      g.fillRect(toX(x - w / 2), toY(z - d / 2), w * px, d * px);
    }

    // 다리
    g.fillStyle = COLORS.road;
    g.fillRect(toX(STATIC.bridge.x - STATIC.bridge.w / 2), toY(STATIC.bridge.z - STATIC.bridge.d / 2),
               STATIC.bridge.w * px, STATIC.bridge.d * px);

    // 야외 바위·나무·폐허
    g.fillStyle = COLORS.rock;
    for (const [x, z, r] of STATIC.outerRocks) {
      g.beginPath(); g.arc(toX(x), toY(z), r * px * 0.8, 0, Math.PI * 2); g.fill();
    }
    g.fillStyle = COLORS.tree;
    for (const [x, z] of STATIC.outerTrees) {
      g.beginPath(); g.arc(toX(x), toY(z), 1.8 * px, 0, Math.PI * 2); g.fill();
    }
    g.fillStyle = "#b8b0a0";
    for (const [x, z] of STATIC.ruins) g.fillRect(toX(x) - 1.2 * px, toY(z) - 1.2 * px, 2.4 * px, 2.4 * px);

    // 이정표와 야영지 — 눈에 띄게
    g.fillStyle = "#f2c94c";
    for (const [x, z] of STATIC.signposts) {
      g.beginPath(); g.arc(toX(x), toY(z), 2.2 * px, 0, Math.PI * 2); g.fill();
    }
    g.fillStyle = "#e8863a";
    for (const [x, z] of STATIC.camps) {
      g.beginPath(); g.arc(toX(x), toY(z), 1.8 * px, 0, Math.PI * 2); g.fill();
    }

    // 우물
    g.fillStyle = COLORS.water;
    g.beginPath();
    g.arc(toX(STATIC.well.x), toY(STATIC.well.z), 1.4 * px, 0, Math.PI * 2);
    g.fill();

    this.staticMap = c;
    this.staticPx = px;
    this._built = true;
  }

  render() {
    if (!this._built) this._buildStatic();

    const ctx = this.ctx;
    const S = this.size;
    const dpr = this.dpr;
    const px = this.player.position.x;
    const pz = this.player.position.z;
    // 위쪽이 항상 진행 방향이 되게 회전한다 — 지도를 머릿속에서 돌리지 않아도 된다
    const yaw = this.cameraRig.yawRadians;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, S, S);

    // 원형으로 자른다
    ctx.save();
    ctx.beginPath();
    ctx.arc(S / 2, S / 2, S / 2 - 1, 0, Math.PI * 2);
    ctx.clip();

    // 정적 지도 — 플레이어를 중심에 두고 yaw만큼 돌려 붙인다
    const scale = (S / 2) / (VIEW_R * this.staticPx);
    ctx.translate(S / 2, S / 2);
    ctx.rotate(yaw);          // +Z가 위로 오도록
    ctx.scale(scale, scale);
    ctx.translate(
      -(px + WORLD_R) * this.staticPx,
      -(pz + WORLD_R) * this.staticPx
    );
    ctx.drawImage(this.staticMap, 0, 0);
    ctx.restore();

    // ---- 움직이는 것들 ----
    ctx.save();
    ctx.beginPath();
    ctx.arc(S / 2, S / 2, S / 2 - 1, 0, Math.PI * 2);
    ctx.clip();
    ctx.translate(S / 2, S / 2);
    ctx.rotate(yaw);

    const k = (S / 2) / VIEW_R; // 월드 → 화면 배율
    const dot = (x, z, r, color) => {
      const dx = (x - px) * k;
      const dz = (z - pz) * k;
      if (Math.hypot(dx, dz) > S / 2) return;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(dx, dz, r, 0, Math.PI * 2);
      ctx.fill();
    };

    for (const m of this.markers) dot(m.x, m.z, 3.5, m.color ?? "#f2c94c");
    for (const n of this.npcs) dot(n.x, n.z, 2.6, "#8fd1d4");
    for (const e of this.enemies) {
      if (!e.alive) continue;
      dot(e.position.x, e.position.z, 2.6, "#eb5757");
      // 형석이 비추는 동안에는 더 크고 밝게 — 은신 해제가 눈에 보여야 한다
      if (this.revealRadius > 0) {
        const dx = e.position.x - this.player.position.x;
        const dz = e.position.z - this.player.position.z;
        if (dx * dx + dz * dz <= this.revealRadius * this.revealRadius) {
          dot(e.position.x, e.position.z, 5, "rgba(226,179,74,0.5)");
        }
      }
    }

    ctx.restore();

    // 플레이어 — 항상 중앙, 위를 향하는 삼각형
    ctx.save();
    ctx.translate(S / 2, S / 2);
    ctx.fillStyle = "#f2c94c";
    ctx.beginPath();
    ctx.moveTo(0, -5.5);
    ctx.lineTo(-4, 4);
    ctx.lineTo(4, 4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // 테두리와 북쪽 표시
    ctx.strokeStyle = "rgba(255,255,255,0.28)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(S / 2, S / 2, S / 2 - 1, 0, Math.PI * 2);
    ctx.stroke();

    const nAngle = yaw + Math.PI; // 북(−Z)의 화면상 방향
    ctx.fillStyle = "#e8a05a";
    ctx.font = "700 9px 'Noto Sans KR', system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("북", S / 2 + Math.sin(nAngle) * (S / 2 - 9), S / 2 - Math.cos(nAngle) * (S / 2 - 9));
  }
}
