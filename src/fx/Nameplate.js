import * as THREE from "three";

// 머리 위 이름표.
//
// 적과 마을 사람이 겉보기로 구분되지 않았다. 둘 다 같은 절차적 캐릭터로
// 서 있으니 다가가 맞아 봐야 적인 줄 알았다. 색과 이름을 머리 위에 띄워
// 멀리서도 알아보게 한다.
//
// 스프라이트를 쓰는 이유: 항상 카메라를 향해야 글자가 읽힌다. 3D 텍스트는
// 옆에서 보면 납작해진다.
//
// 텍스처는 원소마다 한 번만 만들어 돌려 쓴다. 같은 원소가 여럿 나오는데
// 개체마다 캔버스를 만들면 메모리가 금방 는다.

const cache = new Map();

/** 적은 붉게, 중립은 푸르게 — 색만으로 먼저 구분된다 */
export const PLATE = {
  ENEMY: { bg: "rgba(120, 26, 32, 0.86)", line: "#eb5757", text: "#ffe8e8" },
  NPC: { bg: "rgba(22, 52, 60, 0.82)", line: "#8fd1d4", text: "#e6f6f8" },
  BOSS: { bg: "rgba(88, 20, 96, 0.9)", line: "#c77dff", text: "#f6e8ff" },
};

const PAD = 14;
const FONT = 34;

function makeTexture(text, kind) {
  const key = `${kind}|${text}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const c = PLATE[kind] ?? PLATE.ENEMY;
  const cv = document.createElement("canvas");
  const ctx = cv.getContext("2d");

  ctx.font = `700 ${FONT}px 'Noto Sans KR', system-ui, sans-serif`;
  const w = Math.ceil(ctx.measureText(text).width) + PAD * 2;
  const h = FONT + PAD * 2;
  cv.width = w;
  cv.height = h;

  // 캔버스 크기를 바꾸면 상태가 초기화되므로 폰트를 다시 잡는다
  ctx.font = `700 ${FONT}px 'Noto Sans KR', system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const r = 10;
  ctx.beginPath();
  ctx.moveTo(r, 0);
  ctx.arcTo(w, 0, w, h, r);
  ctx.arcTo(w, h, 0, h, r);
  ctx.arcTo(0, h, 0, 0, r);
  ctx.arcTo(0, 0, w, 0, r);
  ctx.closePath();
  ctx.fillStyle = c.bg;
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = c.line;
  ctx.stroke();

  ctx.fillStyle = c.text;
  ctx.fillText(text, w / 2, h / 2 + 1);

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  cache.set(key, { tex, w, h });
  return cache.get(key);
}

/**
 * 머리 위에 뜨는 이름표를 만든다.
 *
 * @param {string} text 표시할 글자 (예: "염소 Lv.4")
 * @param {"ENEMY"|"NPC"|"BOSS"} kind 색 갈래
 * @param {number} y 발밑에서 이 높이에 띄운다
 */
export function makeNameplate(text, kind = "ENEMY", y = 2.05) {
  const { tex, w, h } = makeTexture(text, kind);
  const mat = new THREE.SpriteMaterial({
    map: tex,
    transparent: true,
    depthTest: false,   // 지형에 가려 안 보이면 표식 구실을 못 한다
    depthWrite: false,
  });
  const sp = new THREE.Sprite(mat);
  const scale = 0.0125;
  sp.scale.set(w * scale, h * scale, 1);
  sp.position.y = y;
  sp.renderOrder = 900;
  sp.frustumCulled = false;
  return sp;
}

/**
 * 이름표를 버린다.
 *
 * 텍스처는 원소마다 하나를 돌려 쓰므로 건드리지 않는다 — 여기서 dispose하면
 * 같은 원소의 다른 개체 이름표가 통째로 사라진다.
 * 개체마다 새로 만드는 것은 material뿐이라 그것만 정리한다.
 */
export function disposeNameplate(sprite) {
  if (!sprite) return;
  sprite.parent?.remove(sprite);
  sprite.material?.dispose();
}

/** 글자나 색을 바꿔 단다. 텍스처는 캐시에서 나오므로 매번 만들지 않는다 */
export function setNameplate(sprite, text, kind = "ENEMY") {
  if (!sprite) return;
  const { tex, w, h } = makeTexture(text, kind);
  sprite.material.map = tex;
  sprite.material.needsUpdate = true;
  const scale = 0.0125;
  sprite.scale.set(w * scale, h * scale, 1);
}

/** 이미 이야기를 나눈 사람 — 눈에 덜 띄게 */
PLATE.DONE = { bg: "rgba(30, 36, 42, 0.72)", line: "#5f6b73", text: "#aab4bb" };

/**
 * 멀면 흐려지고 아주 멀면 숨긴다.
 * 표식이 화면을 뒤덮으면 오히려 아무것도 안 보인다.
 */
export function fadeNameplate(sprite, distance, near = 26, far = 46) {
  if (!sprite) return;
  if (distance > far) { sprite.visible = false; return; }
  sprite.visible = true;
  sprite.material.opacity = distance <= near ? 1 : 1 - (distance - near) / (far - near);
}
