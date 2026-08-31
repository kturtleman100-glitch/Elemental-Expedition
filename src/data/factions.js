// 아스티온 대륙의 6개 세력.
//
// 평판(reputation)은 −100~100이다. 3장의 세력 선택과 퀘스트 결과가 여기에 쌓이고,
// 7단계에서 엔딩 분기 판정에 쓰인다. 지금은 대화에서 소속을 표시하는 데만 쓴다.

export const FACTIONS = {
  legion: {
    id: "legion",
    name: "전이 금속 군단",
    leader: "fe",
    color: 0x8e2230,
    creed: "귀금속과 비금속이 같은 자리에 서는 대륙",
    desc: "철(Fe)이 이끄는 군대. 정의의 철퇴로 신분의 벽을 부수려 한다.",
  },
  noblesse: {
    id: "noblesse",
    name: "귀금속 귀족",
    leader: "pt",
    color: 0xd9a441,
    creed: "아름다움은 지켜져야 할 질서다",
    desc: "백금(Pt)이 이끄는 귀족. 11족 삼형제는 수천 년째 흩어져 있다.",
  },
  noble_gas: {
    id: "noble_gas",
    name: "귀족 기체",
    leader: "ne",
    color: 0xa89ad8,
    creed: "반응하지 않는 것이 곧 완성이다",
    desc: "이미 전자 여덟을 갖춰 아무것과도 섞이지 않는다. 최고재판소와 아르곤 시티를 운영한다.",
  },
  affinity: {
    id: "affinity",
    name: "전자 친화팀",
    leader: "cl",
    color: 0xa8d145,
    creed: "전자 하나만 더 있으면 나도 귀족이 된다",
    desc: "염소(Cl)가 이끄는 위험한 조직. 아르곤의 전자 배치를 얻으려 수단을 가리지 않는다.",
    hostile: true,
  },
  exiled: {
    id: "exiled",
    name: "추방된 방사성 원소",
    leader: "u",
    color: 0x6ee85a,
    creed: "우리는 스스로 무너지는 존재다",
    desc: "대륙에서 쫓겨나 방사성 지대에 산다. 적대적이지는 않으나 곁에 있으면 위험하다.",
  },
  neutral: {
    id: "neutral",
    name: "중립 주민",
    leader: null,
    color: 0xc9bb9c,
    creed: "각자의 자리에서 각자의 일을",
    desc: "어느 편도 들지 않는 학자와 마을 사람들. 퀘스트를 주는 이들이다.",
  },
  superheavy: {
    id: "superheavy",
    name: "초중원소",
    leader: "og",
    color: 0x8a9ab8,
    creed: "안정의 섬은 실재한다",
    desc: "불안정한 바다에서 태어나 곧 무너지는 원소들. 오가네손이 안정의 섬을 찾아 항해한다.",
  },
  none: {
    id: "none",
    name: "무소속",
    leader: null,
    color: 0xd8d4cc,
    creed: "이름도 자리도 없다",
    desc: "주기율표에 칸이 없는 자. 그래서 어디든 갈 수 있다.",
  },
};

export function getFaction(id) {
  return FACTIONS[id] || FACTIONS.none;
}

/** 세력 평판을 들고 있는 그릇. 6단계 저장에 그대로 직렬화된다. */
export class Reputation {
  constructor(initial = {}) {
    this.values = {};
    for (const id of Object.keys(FACTIONS)) this.values[id] = initial[id] ?? 0;
  }

  get(id) { return this.values[id] ?? 0; }

  add(id, amount) {
    if (!(id in this.values)) return;
    this.values[id] = Math.max(-100, Math.min(100, this.values[id] + amount));
  }

  /** 엔딩 판정용 — 가장 높은 세력 */
  dominant() {
    let best = null, top = -Infinity;
    for (const [id, v] of Object.entries(this.values)) {
      if (id === "neutral" || id === "none") continue;
      if (v > top) { top = v; best = id; }
    }
    return { id: best, value: top };
  }

  toJSON() { return { ...this.values }; }
}
