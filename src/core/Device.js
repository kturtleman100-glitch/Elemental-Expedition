// 기기 판별과 성능 등급 프리셋.
// 화면 크기가 아니라 "터치 입력 유무 + 하드웨어 힌트"로 판별한다 —
// 창을 좁힌 데스크톱 브라우저를 모바일로 오판하지 않기 위해서다.

const TIERS = {
  high: {
    name: "high",
    pixelRatioCap: 2,
    shadows: true,
    shadowMapSize: 2048,
    particleScale: 1.0,
    drawDistance: 260,
    tickRateHz: 120,
  },
  mid: {
    name: "mid",
    pixelRatioCap: 1,
    shadows: true,
    shadowMapSize: 1024,
    particleScale: 0.6,
    drawDistance: 180,
    tickRateHz: 90,
  },
  low: {
    name: "low",
    pixelRatioCap: 0.75,
    shadows: false,
    shadowMapSize: 512,
    particleScale: 0.3,
    drawDistance: 110,
    tickRateHz: 60,
  },
};

function isTouchPrimary() {
  return window.matchMedia("(pointer: coarse)").matches;
}

function guessTier() {
  const touch = isTouchPrimary();
  const cores = navigator.hardwareConcurrency || 4;
  const mem = navigator.deviceMemory || 4; // 일부 브라우저만 지원, 없으면 중간값 가정

  if (touch) {
    // 모바일/태블릿. 사양이 아주 좋으면 mid까지는 허용.
    if (cores >= 8 && mem >= 6) return "mid";
    return "low";
  }
  // 포인터 정밀 기기(마우스) = 데스크톱/노트북으로 취급.
  if (cores <= 4 || mem <= 4) return "mid"; // 저사양 노트북
  return "high";
}

export class Device {
  constructor() {
    this.isTouch = isTouchPrimary();
    this.tierName = guessTier();
    this.tier = TIERS[this.tierName];
  }

  /** 실측 프레임 예산 초과 시 등급을 한 단계 낮춘다. 반환값: 등급이 바뀌었는지 */
  downgrade() {
    const order = ["high", "mid", "low"];
    const idx = order.indexOf(this.tierName);
    if (idx >= order.length - 1) return false;
    this.tierName = order[idx + 1];
    this.tier = TIERS[this.tierName];
    return true;
  }

  upgrade() {
    const order = ["high", "mid", "low"];
    const idx = order.indexOf(this.tierName);
    if (idx <= 0) return false;
    this.tierName = order[idx - 1];
    this.tier = TIERS[this.tierName];
    return true;
  }

  setTier(name) {
    if (!TIERS[name]) return;
    this.tierName = name;
    this.tier = TIERS[name];
  }
}

export const TIER_ORDER = ["high", "mid", "low"];
export const TIER_PRESETS = TIERS;
