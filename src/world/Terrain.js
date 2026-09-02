import { fbm, ridged, valueNoise } from "./Noise.js";
import { BIOME, BIOMES, getBiome } from "./Biome.js";

// 지형의 유일한 근거.
//
// 높이와 바이옴을 묻는 곳이 여럿이다 — 청크가 땅을 만들 때, 플레이어가 발을
// 디딜 때, 적이 걸을 때, 미니맵이 색을 칠할 때. 이들이 제각기 계산하면
// 아주 작은 차이로도 플레이어가 땅에 파묻히거나 공중에 뜬다.
// 그래서 계산은 오직 여기서만 하고 나머지는 물어보기만 한다.

// 손으로 지은 세계의 크기.
//
// 토룡마을만 있는 게 아니다. 마을 밖으로 고원·강·폐허·평야·바깥숲을 직접 배치했고,
// 그것들이 원점에서 220m까지 뻗어 있다. 그 소품은 전부 y=0에 놓여 있으므로,
// 이 범위 안의 지형은 반드시 완전한 평지여야 한다.
//
// 예전에는 이 값이 62였다. 그래서 62m 바깥의 마을 나무는 솟아오른 땅에 밑동이
// 묻히고, 움푹 팬 곳의 풀은 허공에 떴다. 절차적 지형과 손으로 둔 것이
// 같은 좌표를 두고 다투면 언제나 이런 식으로 어긋난다.
const VILLAGE_FLAT = 225;   // 이 반경 안은 완전한 평지
const VILLAGE_BLEND = 120;  // 여기서부터 345m까지 서서히 지형이 살아난다
const VILLAGE_BUILT = 240;  // 절차적 소품을 놓지 않는 범위 (평지보다 조금 넓게)
const SEA_START = 1800;     // 이 거리부터 바다로 내려간다. 사실상 무한이지만 끝은 있다
const SEA_FULL = 2100;

/** 바이옴을 고르는 격자 크기(m). 클수록 한 바이옴이 넓게 이어진다 */
const BIOME_SCALE = 460;
const HEIGHT_SCALE = 260;

export class Terrain {
  /** @param {number} seed 이 하나만 저장하면 세계 전체가 복원된다 */
  constructor(seed = 20260902) {
    this.seed = seed | 0;
  }

  /**
   * 마을 안은 1, 마을 밖은 0. 그 사이는 부드럽게.
   * 지형 높이와 소품 배치 양쪽에서 쓰인다 — 마을에 언덕이 솟거나
   * 광장에 나무가 자라면 손으로 지은 것이 다 망가진다.
   */
  villageMask(x, z) {
    const d = Math.hypot(x, z);
    if (d <= VILLAGE_FLAT) return 1;
    if (d >= VILLAGE_FLAT + VILLAGE_BLEND) return 0;
    const t = (d - VILLAGE_FLAT) / VILLAGE_BLEND;
    return 1 - t * t * (3 - 2 * t);   // 부드럽게 0으로
  }

  /** 손으로 지은 구역인가 — 절차적 소품을 놓지 말아야 할 곳 */
  isHandBuilt(x, z) {
    return x * x + z * z < VILLAGE_BUILT * VILLAGE_BUILT;
  }

  /** 바다까지 남은 정도. 0이면 육지, 1이면 완전한 바다 */
  seaMask(x, z) {
    const d = Math.hypot(x, z);
    if (d <= SEA_START) return 0;
    if (d >= SEA_FULL) return 1;
    const t = (d - SEA_START) / (SEA_FULL - SEA_START);
    return t * t * (3 - 2 * t);
  }

  /**
   * 이 자리의 바이옴. 높이(고도)와 습도 두 축으로 고른다 —
   * 실제 지리학에서 기후를 나누는 방식과 같아서 결과가 자연스럽다.
   * @returns {object} BIOMES의 항목
   */
  biomeAt(x, z) {
    if (this.villageMask(x, z) > 0.5) return BIOMES[BIOME.PLAIN];
    if (this.seaMask(x, z) > 0.5) return BIOMES[BIOME.SEA];

    const nx = x / BIOME_SCALE, nz = z / BIOME_SCALE;
    const elev = fbm(this.seed + 101, nx, nz, 3);
    const moist = fbm(this.seed + 977, nx + 31.7, nz - 12.3, 3);
    // 원점에서 멀수록 험한 땅이 나오게 하는 편향. 처음부터 방사성 황무지에
    // 떨어지면 시작하자마자 죽는다.
    const far = Math.min(1, Math.hypot(x, z) / 1100);

    if (elev > 0.42 + (1 - far) * 0.2) {
      return moist < -0.1 ? BIOMES[BIOME.NOBLE] : BIOMES[BIOME.CRYSTAL];
    }
    if (elev > 0.16) {
      return moist > 0.15 ? BIOMES[BIOME.LIMESTONE] : BIOMES[BIOME.IRONLAND];
    }
    if (elev < -0.38) {
      // 낮고 습한 분지 — 온천이 솟는다. 멀리 있으면 방사성으로 오염됐다
      if (far > 0.72 && moist < 0) return BIOMES[BIOME.RADIANT];
      return moist > 0 ? BIOMES[BIOME.SULFUR] : BIOMES[BIOME.SALTFLAT];
    }
    return moist > 0.06 ? BIOMES[BIOME.FOREST] : BIOMES[BIOME.PLAIN];
  }

  /**
   * 지면 높이(m).
   *
   * 플레이어가 매 틱 호출하므로 싸야 한다. 옥타브를 3으로 묶고
   * 능선 노이즈는 바이옴이 요구할 때만 더한다.
   */
  heightAt(x, z) {
    const village = this.villageMask(x, z);
    if (village >= 1) return 0;

    const b = this.biomeAt(x, z);
    const nx = x / HEIGHT_SCALE, nz = z / HEIGHT_SCALE;

    // 완만한 기복 — 대륙 전체에 걸친 큰 파도
    let h = fbm(this.seed + 33, nx, nz, 3) * 7.0 * b.height;
    // 바위 지대의 날카로운 능선
    if (b.rough > 0.05) {
      h += (ridged(this.seed + 555, nx * 2.1, nz * 2.1, 3) - 0.5) * 14 * b.rough * b.height;
    }
    // 작은 요철 — 완전히 매끈하면 인공적으로 보인다
    h += valueNoise(this.seed + 71, x / 26, z / 26) * 0.55;

    // 마을 가장자리에서는 0으로 끌어내린다
    h *= 1 - village;

    // 바다로 내려간다
    const sea = this.seaMask(x, z);
    if (sea > 0) h = h * (1 - sea) - 9 * sea;

    return h;
  }

  /**
   * 지면의 기울기. 너무 가파른 곳에는 나무를 세우지 않는다 —
   * 비탈에 수직으로 박힌 나무는 금방 눈에 띈다.
   * @returns {number} 0이 평지, 1에 가까울수록 절벽
   */
  slopeAt(x, z, step = 2.5) {
    const h = this.heightAt(x, z);
    const dx = this.heightAt(x + step, z) - h;
    const dz = this.heightAt(x, z + step) - h;
    return Math.min(1, Math.hypot(dx, dz) / step);
  }

  /**
   * 경계에서 분위기가 툭 바뀌지 않도록, 주변 네 점의 바이옴을 함께 본다.
   * @returns {{biome:object, neighbors:object[]}}
   */
  sampleAround(x, z, r = 26) {
    const biome = this.biomeAt(x, z);
    const neighbors = [
      this.biomeAt(x + r, z), this.biomeAt(x - r, z),
      this.biomeAt(x, z + r), this.biomeAt(x, z - r),
    ];
    return { biome, neighbors };
  }
}

export { getBiome, BIOME };
