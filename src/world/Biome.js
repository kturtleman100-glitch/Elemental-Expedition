// 바이옴 — 대륙을 이루는 열 가지 땅.
//
// 임의로 정하지 않았다. 각 바이옴은 실제 원소의 성질에서 나온다.
//   소금 사막  — 소듐이 전자를 내주고 염소가 받아 만든 NaCl 결정 평야
//   붉은 대지  — 철이 산소에 전자를 빼앗긴 Fe2O3, 즉 녹슨 땅
//   수정 지대  — 규소와 산소가 그물처럼 이어진 SiO2. 그물 구조라 기둥으로 선다
//   석회암 고원 — 칼슘의 CaCO3. 물에 녹아 동굴이 뚫린다
//   유황 온천  — 황이 물에 녹아 끓는다. 라돈이 함께 나와 호르메시스 온천이 된다
//   방사성 황무지 — 우라늄·폴로늄이 붕괴하며 스스로 빛난다
//
// 그래서 돌아다니는 것만으로 화합물과 원소의 성질을 보게 된다.
// 어느 땅에 무엇이 자라는지가 곧 화학이다.

export const BIOME = {
  PLAIN: "plain",
  FOREST: "forest",
  LIMESTONE: "limestone",
  SALTFLAT: "saltflat",
  IRONLAND: "ironland",
  CRYSTAL: "crystal",
  SULFUR: "sulfur",
  RADIANT: "radiant",
  NOBLE: "noble",
  SEA: "sea",
};

/**
 * height  : 지형 높낮이 배율 (1이 기본)
 * rough   : 능선 노이즈 비중. 높을수록 바위산처럼 날카롭다
 * danger  : 적 레벨 보정. 원점에서 멀수록 험한 바이옴이 나오므로 자연히 난이도가 오른다
 * props   : 무엇이 얼마나 흩어지는가 (개수는 청크당 기대값)
 * ambience: 안개·조명. Zone이 이 값들 사이를 보간한다
 * teaches : 이 땅이 알려주는 화학. 처음 들어설 때 한 번 자막으로 뜬다
 */
export const BIOMES = {
  [BIOME.PLAIN]: {
    id: BIOME.PLAIN, name: "초원", sub: "아스티온 대륙",
    ground: 0x7d9455, groundAlt: 0x94a865, tex: "grass",
    height: 1, rough: 0.15, danger: 0,
    props: { tree: 2.5, rock: 1.5, grass: 30, flower: 10 },
    ambience: { fog: 0xd2e0dc, near: 40, far: 175, ambient: 0.62, sun: 1.0 },
    teaches: null,
  },

  [BIOME.FOREST]: {
    id: BIOME.FOREST, name: "마그네슘 숲", sub: "세계수가 자라는 곳",
    ground: 0x5d7342, groundAlt: 0x46592f, tex: "grass",
    height: 1.2, rough: 0.2, danger: 1,
    props: { tree: 16, rock: 1, grass: 34, flower: 6, mushroom: 4 },
    ambience: { fog: 0xa8c0a0, near: 22, far: 130, ambient: 0.46, sun: 0.72 },
    element: "mg",
    teaches: "마그네슘은 엽록소 한가운데에 박혀 식물이 빛을 붙잡게 한다. 이 숲이 푸른 이유다.",
  },

  [BIOME.LIMESTONE]: {
    id: BIOME.LIMESTONE, name: "석회암 고원", sub: "칼슘의 땅",
    ground: 0xd6ceba, groundAlt: 0xbdb49c, tex: "limestone",
    height: 1.9, rough: 0.65, danger: 2,
    props: { limestone: 9, rock: 3, grass: 8, tree: 0.4 },
    ambience: { fog: 0xe0d8c4, near: 42, far: 175, ambient: 0.7, sun: 1.06 },
    element: "ca",
    teaches: "석회암은 탄산 칼슘이다. 빗물에 조금씩 녹아 동굴이 뚫린다 — 뼈를 이루는 원소가 땅도 이룬다.",
  },

  [BIOME.SALTFLAT]: {
    id: BIOME.SALTFLAT, name: "소금 평원", sub: "소듐과 염소가 만난 자리",
    ground: 0xe8e4d8, groundAlt: 0xcfc9b8, tex: "limestone",
    height: 0.25, rough: 0.05, danger: 2,
    props: { saltcrystal: 7, rock: 0.6, grass: 1 },
    ambience: { fog: 0xf0ece0, near: 55, far: 175, ambient: 0.82, sun: 1.16 },
    element: "na",
    teaches: "소듐이 전자 하나를 내주고 염소가 받는다. 서로 +와 −가 되어 붙든 것이 이 소금 결정이다.",
  },

  [BIOME.IRONLAND]: {
    id: BIOME.IRONLAND, name: "붉은 대지", sub: "산화철의 황야",
    ground: 0x9c5638, groundAlt: 0x7a4028, tex: "dirt",
    height: 1.6, rough: 0.5, danger: 3,
    props: { rock: 7, ironspire: 3, grass: 4, tree: 0.3 },
    ambience: { fog: 0xd8a880, near: 34, far: 175, ambient: 0.6, sun: 0.98 },
    element: "fe",
    teaches: "철이 산소에게 전자를 빼앗기면 붉은 녹이 된다. 산화란 곧 전자를 잃는 일이다.",
  },

  [BIOME.CRYSTAL]: {
    id: BIOME.CRYSTAL, name: "수정 지대", sub: "규소의 그물",
    ground: 0x8a92a8, groundAlt: 0x6e7690, tex: "stone",
    height: 1.7, rough: 0.7, danger: 3,
    props: { crystal: 8, rock: 3, grass: 3 },
    ambience: { fog: 0xc0c8e0, near: 38, far: 175, ambient: 0.66, sun: 1.04 },
    element: "si",
    teaches: "규소와 산소가 그물처럼 끝없이 이어져 결정 하나가 통째로 거대한 분자다. 그래서 1700도까지 녹지 않는다.",
  },

  [BIOME.SULFUR]: {
    id: BIOME.SULFUR, name: "유황 온천", sub: "호르메시스 지대",
    ground: 0xc4a94a, groundAlt: 0x9c8430, tex: "dirt",
    height: 0.9, rough: 0.3, danger: 2,
    props: { spring: 3, rock: 4, grass: 6, sulfurvent: 5 },
    ambience: { fog: 0xe0d090, near: 20, far: 120, ambient: 0.6, sun: 0.86 },
    element: "s",
    teaches: "황은 녹는점이 115도로 낮아 땅속에서 녹아 흐른다. 온천이 노랗고 냄새가 나는 까닭이다.",
  },

  [BIOME.RADIANT]: {
    id: BIOME.RADIANT, name: "방사성 황무지", sub: "추방된 자들의 땅",
    ground: 0x4a5240, groundAlt: 0x353c2e, tex: "dirt",
    // 능선 노이즈를 줄였다. 0.55에서는 뾰족한 이빨 같은 봉우리가 솟아
    // 자연 지형이라기보다 오려 붙인 것처럼 보였다. 여긴 버려진 황무지이지
    // 바위산이 아니다 — 완만한 구릉이 어울린다.
    height: 1.2, rough: 0.22, danger: 5,
    props: { rock: 5, glowrock: 6, deadtree: 3 },
    ambience: { fog: 0x7a8c60, near: 18, far: 110, ambient: 0.5, sun: 0.7 },
    element: "u",
    teaches: "방사성 원소는 원자핵이 불안정해 스스로 조각을 뱉으며 다른 원소로 변해간다. 이 땅이 빛나는 것은 그 붕괴 때문이다.",
  },

  [BIOME.NOBLE]: {
    id: BIOME.NOBLE, name: "아르곤 고원", sub: "반응하지 않는 자들의 자리",
    ground: 0xb0b8c8, groundAlt: 0x929ab0, tex: "stone",
    height: 2.2, rough: 0.45, danger: 4,
    props: { rock: 4, pillar: 5, grass: 2 },
    ambience: { fog: 0xd8dcf0, near: 50, far: 175, ambient: 0.78, sun: 1.1 },
    element: "ar",
    teaches: "비활성 기체는 바깥 껍질이 전자로 가득 차 있다. 더 얻을 것도 내줄 것도 없어 아무것과도 반응하지 않는다.",
  },

  [BIOME.SEA]: {
    id: BIOME.SEA, name: "불안정한 바다", sub: "대륙의 끝",
    ground: 0x3a5a70, groundAlt: 0x2a4256, tex: "stone",
    height: 0.1, rough: 0.05, danger: 4,
    props: {},
    ambience: { fog: 0x9ab4c8, near: 26, far: 150, ambient: 0.58, sun: 0.9 },
    teaches: "여기서부터는 걸어 건널 수 없다. 안정의 섬으로 가려면 배가 필요하다.",
  },
};

/** @returns {object} 없는 id면 초원으로 대체한다 */
export function getBiome(id) {
  return BIOMES[id] ?? BIOMES[BIOME.PLAIN];
}

/**
 * 두 바이옴의 분위기 값을 섞는다. 경계에서 안개색이 툭 바뀌면
 * 눈에 확 띄므로, 경계 부근은 항상 섞어서 넘긴다.
 */
export function blendAmbience(a, b, t) {
  const A = a.ambience, B = b.ambience;
  const lerp = (x, y) => x + (y - x) * t;
  // 색은 채널별로 섞어야 한다. 정수끼리 보간하면 엉뚱한 색이 나온다.
  const mixColor = (c1, c2) => {
    const r = lerp((c1 >> 16) & 255, (c2 >> 16) & 255);
    const g = lerp((c1 >> 8) & 255, (c2 >> 8) & 255);
    const bl = lerp(c1 & 255, c2 & 255);
    return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(bl);
  };
  return {
    fog: mixColor(A.fog, B.fog),
    near: lerp(A.near, B.near),
    far: lerp(A.far, B.far),
    ambient: lerp(A.ambient, B.ambient),
    sun: lerp(A.sun, B.sun),
  };
}
