import * as THREE from "three";

// 캔버스로 그려내는 절차적 텍스처.
//
// 이미지 파일을 두지 않는 이유는 두 가지다. 첫째, 저장소와 배포 용량이 안 늘어난다.
// 둘째, 색을 인자로 받으므로 원소별·지역별로 같은 무늬를 색만 바꿔 재사용할 수 있다.
//
// 성능 부담은 사실상 없다 — 256~512px 한 장이 VRAM 0.25~1MB이고, 생성은 최초 1회
// 몇 밀리초로 끝난다. 실제 병목은 텍스처가 아니라 드로우콜이다.

const cache = new Map();

function makeCanvas(size) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  return c;
}

function finish(canvas, repeat) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  if (repeat) tex.repeat.set(repeat[0], repeat[1]);
  return tex;
}

function hex(n) {
  return "#" + n.toString(16).padStart(6, "0");
}

/** 두 색을 t(0~1)로 섞는다. 캔버스 색 문자열을 반환. */
function mix(a, b, t) {
  const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
  const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
  return `rgb(${Math.round(ar + (br - ar) * t)},${Math.round(ag + (bg - ag) * t)},${Math.round(ab + (bb - ab) * t)})`;
}

/** 가장자리를 넘어가는 그리기를 반대편에도 한 번 더 그려 이음매를 없앤다 */
function tiled(ctx, size, draw) {
  for (const dx of [-size, 0, size]) {
    for (const dy of [-size, 0, size]) {
      ctx.save();
      ctx.translate(dx, dy);
      draw();
      ctx.restore();
    }
  }
}

// ---------------- 나무결 ----------------

/** 세로로 흐르는 나뭇결. 기둥·기둥재·문에 쓴다. */
export function woodGrain(base = 0x6a4d34, dark = 0x4a3524, key = "wood") {
  const id = `wood|${base}|${dark}|${key}`;
  if (cache.has(id)) return cache.get(id);

  const S = 256;
  const cv = makeCanvas(S);
  const ctx = cv.getContext("2d");

  ctx.fillStyle = hex(base);
  ctx.fillRect(0, 0, S, S);

  // 결 — 굵기와 진하기를 달리한 세로 줄
  for (let i = 0; i < 46; i++) {
    const x = Math.random() * S;
    const w = 0.6 + Math.random() * 3.2;
    const t = 0.15 + Math.random() * 0.5;
    ctx.strokeStyle = mix(base, dark, t);
    ctx.lineWidth = w;
    ctx.globalAlpha = 0.35 + Math.random() * 0.4;
    ctx.beginPath();
    ctx.moveTo(x, -4);
    // 살짝 휘어야 톱질한 판재처럼 보인다
    ctx.bezierCurveTo(x + (Math.random() - 0.5) * 14, S * 0.35,
                      x + (Math.random() - 0.5) * 14, S * 0.7, x, S + 4);
    ctx.stroke();
  }

  // 옹이
  ctx.globalAlpha = 0.5;
  for (let i = 0; i < 2; i++) {
    const kx = Math.random() * S, ky = Math.random() * S;
    for (let r = 12; r > 0; r -= 2.2) {
      ctx.strokeStyle = mix(base, dark, 0.55);
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.ellipse(kx, ky, r, r * 1.7, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  ctx.globalAlpha = 1;
  const tex = finish(cv, [1, 2]);
  cache.set(id, tex);
  return tex;
}

// ---------------- 회벽 ----------------

/** 얼룩진 회벽. 균일한 단색이 플라스틱처럼 보이는 것을 막는다. */
export function plaster(base = 0xe6dcc6, shade = 0xc2b59a, key = "plaster") {
  const id = `plaster|${base}|${shade}|${key}`;
  if (cache.has(id)) return cache.get(id);

  const S = 256;
  const cv = makeCanvas(S);
  const ctx = cv.getContext("2d");

  ctx.fillStyle = hex(base);
  ctx.fillRect(0, 0, S, S);

  // 큰 얼룩 → 작은 얼룩 순으로 덮어 자연스러운 반점을 만든다
  for (const [count, rMin, rMax, alpha] of [[26, 18, 46, 0.10], [70, 5, 16, 0.13], [180, 1, 4, 0.16]]) {
    for (let i = 0; i < count; i++) {
      const x = Math.random() * S, y = Math.random() * S;
      const r = rMin + Math.random() * (rMax - rMin);
      ctx.globalAlpha = alpha * (0.5 + Math.random() * 0.8);
      ctx.fillStyle = mix(base, shade, 0.4 + Math.random() * 0.6);
      tiled(ctx, S, () => {
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      });
    }
  }

  // 아래쪽 물때 — 벽이 오래됐다는 신호
  ctx.globalAlpha = 1;
  const grad = ctx.createLinearGradient(0, S * 0.62, 0, S);
  grad.addColorStop(0, "rgba(0,0,0,0)");
  grad.addColorStop(1, mix(base, shade, 0.75).replace("rgb", "rgba").replace(")", ",0.5)"));
  ctx.fillStyle = grad;
  ctx.fillRect(0, S * 0.62, S, S * 0.38);

  const tex = finish(cv, [1, 1]);
  cache.set(id, tex);
  return tex;
}

// ---------------- 기와 ----------------

/** 가로줄로 겹쳐 쌓인 기와. 지붕이 단색 원뿔로 보이던 문제를 없앤다. */
export function roofTile(base = 0x4a6b6e, dark = 0x2e4a4c, key = "roof") {
  const id = `roof|${base}|${dark}|${key}`;
  if (cache.has(id)) return cache.get(id);

  const S = 256;
  const cv = makeCanvas(S);
  const ctx = cv.getContext("2d");

  ctx.fillStyle = hex(dark);
  ctx.fillRect(0, 0, S, S);

  const rows = 8;
  const rh = S / rows;
  const cols = 8;
  const cw = S / cols;

  for (let r = 0; r < rows; r++) {
    const y = r * rh;
    // 줄마다 반 칸씩 엇갈리게 — 벽돌 쌓기와 같은 원리
    const offset = (r % 2) * cw * 0.5;

    for (let c = -1; c <= cols; c++) {
      const x = c * cw + offset;
      const tone = 0.12 + Math.random() * 0.34;
      ctx.fillStyle = mix(base, dark, tone);

      // 아래가 둥근 기와 한 장
      ctx.beginPath();
      ctx.moveTo(x + 1, y);
      ctx.lineTo(x + cw - 1, y);
      ctx.lineTo(x + cw - 1, y + rh * 0.58);
      ctx.quadraticCurveTo(x + cw / 2, y + rh * 1.08, x + 1, y + rh * 0.58);
      ctx.closePath();
      ctx.fill();

      // 위쪽 밝은 테 — 볼록해 보이게
      ctx.strokeStyle = mix(base, 0xffffff, 0.22);
      ctx.lineWidth = 1.3;
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.moveTo(x + 2.5, y + 1.5);
      ctx.lineTo(x + cw - 2.5, y + 1.5);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // 줄 사이 그림자
    ctx.fillStyle = "rgba(0,0,0,0.26)";
    ctx.fillRect(0, y + rh * 0.86, S, rh * 0.14);
  }

  const tex = finish(cv, [3, 3]);
  cache.set(id, tex);
  return tex;
}

// ---------------- 잔디 ----------------

/** 결이 있는 잔디. 단색 평면이 종이처럼 보이는 것을 막는다. */
export function grassField(a = 0x7d9455, b = 0x5d7342, c = 0x94a865, key = "grass") {
  const id = `grass|${a}|${b}|${c}|${key}`;
  if (cache.has(id)) return cache.get(id);

  const S = 256;
  const cv = makeCanvas(S);
  const ctx = cv.getContext("2d");

  ctx.fillStyle = hex(a);
  ctx.fillRect(0, 0, S, S);

  // 넓은 색 얼룩
  for (let i = 0; i < 40; i++) {
    const x = Math.random() * S, y = Math.random() * S;
    const r = 14 + Math.random() * 40;
    ctx.globalAlpha = 0.16;
    ctx.fillStyle = Math.random() > 0.5 ? hex(b) : hex(c);
    tiled(ctx, S, () => {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  // 잎 결 — 짧은 선을 촘촘히
  ctx.globalAlpha = 0.5;
  ctx.lineWidth = 1;
  for (let i = 0; i < 1100; i++) {
    const x = Math.random() * S, y = Math.random() * S;
    const len = 2 + Math.random() * 5;
    const ang = -Math.PI / 2 + (Math.random() - 0.5) * 1.1;
    ctx.strokeStyle = Math.random() > 0.55 ? hex(c) : hex(b);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len);
    ctx.stroke();
  }

  ctx.globalAlpha = 1;
  const tex = finish(cv, [1, 1]);
  cache.set(id, tex);
  return tex;
}

// ---------------- 흙길 ----------------

/** 자갈이 섞인 흙바닥. 광장과 길에 쓴다. */
export function dirtPath(base = 0xc9bb9c, dark = 0x9c8f76, key = "dirt") {
  const id = `dirt|${base}|${dark}|${key}`;
  if (cache.has(id)) return cache.get(id);

  const S = 256;
  const cv = makeCanvas(S);
  const ctx = cv.getContext("2d");

  ctx.fillStyle = hex(base);
  ctx.fillRect(0, 0, S, S);

  for (let i = 0; i < 60; i++) {
    const x = Math.random() * S, y = Math.random() * S;
    ctx.globalAlpha = 0.12;
    ctx.fillStyle = mix(base, dark, Math.random());
    tiled(ctx, S, () => {
      ctx.beginPath();
      ctx.arc(x, y, 8 + Math.random() * 26, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  // 자갈
  for (let i = 0; i < 260; i++) {
    const x = Math.random() * S, y = Math.random() * S;
    const r = 0.8 + Math.random() * 2.6;
    ctx.globalAlpha = 0.3 + Math.random() * 0.45;
    ctx.fillStyle = mix(base, Math.random() > 0.5 ? dark : 0xffffff, 0.4 + Math.random() * 0.4);
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * (0.6 + Math.random() * 0.6), Math.random() * 3, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.globalAlpha = 1;
  const tex = finish(cv, [1, 1]);
  cache.set(id, tex);
  return tex;
}

// ---------------- 석재 ----------------

/** 금이 간 돌. 기단·경계석·우물에 쓴다. */
export function stoneBlock(base = 0x9a958a, dark = 0x6f6b62, key = "stone") {
  const id = `stone|${base}|${dark}|${key}`;
  if (cache.has(id)) return cache.get(id);

  const S = 256;
  const cv = makeCanvas(S);
  const ctx = cv.getContext("2d");

  ctx.fillStyle = hex(base);
  ctx.fillRect(0, 0, S, S);

  // 돌덩이 구획 — 불규칙한 격자
  const rows = 4;
  for (let r = 0; r < rows; r++) {
    const y = (r * S) / rows;
    const h = S / rows;
    let x = (r % 2) * -20;
    while (x < S) {
      const w = 40 + Math.random() * 42;
      ctx.fillStyle = mix(base, Math.random() > 0.5 ? dark : 0xffffff, Math.random() * 0.26);
      ctx.fillRect(x + 1.5, y + 1.5, w - 3, h - 3);
      x += w;
    }
  }

  // 줄눈
  ctx.strokeStyle = mix(base, dark, 0.85);
  ctx.lineWidth = 2.4;
  ctx.globalAlpha = 0.6;
  for (let r = 0; r <= rows; r++) {
    const y = (r * S) / rows;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(S, y);
    ctx.stroke();
  }

  // 얼룩과 잔금
  ctx.globalAlpha = 0.25;
  for (let i = 0; i < 120; i++) {
    const x = Math.random() * S, y = Math.random() * S;
    ctx.fillStyle = mix(base, dark, Math.random());
    ctx.beginPath();
    ctx.arc(x, y, 1 + Math.random() * 5, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.globalAlpha = 1;
  const tex = finish(cv, [1, 1]);
  cache.set(id, tex);
  return tex;
}

// ---------------- 잎 ----------------

/** 잎 뭉치. 나무 수관이 매끈한 공으로 보이는 것을 막는다. */
export function foliage(base = 0x5f8a4a, dark = 0x3f6634, lit = 0x7fb05e, key = "leaf") {
  const id = `leaf|${base}|${dark}|${lit}|${key}`;
  if (cache.has(id)) return cache.get(id);

  const S = 256;
  const cv = makeCanvas(S);
  const ctx = cv.getContext("2d");

  ctx.fillStyle = hex(base);
  ctx.fillRect(0, 0, S, S);

  // 잎사귀 하나하나를 타원으로. 방향을 흩어야 뭉치로 읽힌다
  for (let i = 0; i < 900; i++) {
    const x = Math.random() * S, y = Math.random() * S;
    const rx = 3 + Math.random() * 7;
    const ry = rx * (0.4 + Math.random() * 0.4);
    const t = Math.random();
    ctx.globalAlpha = 0.4 + Math.random() * 0.5;
    ctx.fillStyle = t > 0.62 ? hex(lit) : t > 0.28 ? hex(base) : hex(dark);
    tiled(ctx, S, () => {
      ctx.beginPath();
      ctx.ellipse(x, y, rx, ry, Math.random() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  ctx.globalAlpha = 1;
  const tex = finish(cv, [2, 2]);
  cache.set(id, tex);
  return tex;
}

/** 전부 비운다 — 지역 전환으로 팔레트가 바뀔 때 쓴다 */
export function disposeTextures() {
  for (const tex of cache.values()) tex.dispose();
  cache.clear();
}
