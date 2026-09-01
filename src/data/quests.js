// 퀘스트.
//
// 이 게임에서 퀘스트의 보상은 돈이 아니라 **원소 그 자체**다.
// 플레이어(119번)는 자기 힘이 없어서, 남을 도와 그 사람의 힘을 빌리는 것이
// 성장의 유일한 방법이다. 그래서 퀘스트를 깨면 그 NPC가 동료가 된다.
//
// 목표 종류(objective.kind):
//   talk    특정 인물과 대화
//   defeat  특정 원소를 n마리 처치
//   collect 특정 원소를 도감에 등록
//   reach   특정 좌표 근처에 도달
//   flag    대화 선택으로 세워지는 플래그

export const QUESTS = [
  // ---------------- 1장: 이름 없는 자 ----------------
  {
    id: "ch1_awake",
    chapter: 1,
    title: "이름 없는 자",
    giver: "ca",
    summary: "토룡마을 촌장 칼슘에게 이야기를 듣는다.",
    objectives: [
      { kind: "flag", flag: "met_calcium", text: "칼슘과 대화한다" },
    ],
    reward: { element: "ca", exp: 40, rep: ["neutral", 10] },
    next: "ch1_villagers",
  },
  {
    id: "ch1_villagers",
    chapter: 1,
    title: "마을을 둘러보다",
    giver: "ca",
    summary: "마을 사람들과 이야기해 전자 도둑의 단서를 모은다.",
    objectives: [
      { kind: "flag", flag: "clue_halogen", text: "인(P)에게 목격담을 듣는다" },
      { kind: "flag", flag: "learned_chlorine", text: "탄소(C)에게 상성을 배운다" },
    ],
    reward: { element: "p", exp: 60, rep: ["neutral", 15] },
    next: "ch1_oracle",
  },
  {
    id: "ch1_oracle",
    chapter: 1,
    title: "데이터가 없는 자",
    giver: "si",
    summary: "규소가 예언하려면 관측 자료가 필요하다. 원소를 만나 도감을 채운다.",
    objectives: [
      { kind: "collect", count: 6, text: "도감에 원소 6종을 등록한다" },
    ],
    reward: { element: "si", exp: 80, rep: ["neutral", 10] },
    next: "ch2_thief",
  },

  // ---------------- 2장: 전자 도둑 ----------------
  {
    id: "ch2_thief",
    chapter: 2,
    title: "전자 도둑",
    giver: "ca",
    summary: "마을 남쪽 길목에 전자 친화팀 하수인이 있다. 쫓아낸다.",
    objectives: [
      { kind: "defeat", elementId: "br", count: 2, text: "브로민을 2마리 물리친다" },
      { kind: "defeat", elementId: "cl", count: 1, text: "염소를 1마리 물리친다" },
    ],
    reward: { element: "cl", exp: 140, rep: ["neutral", 20] },
    next: "ch2_delivery",
  },
  {
    id: "ch2_delivery",
    chapter: 2,
    title: "대안통운 긴급 배송",
    giver: "p",
    summary: "길이 위험해져 배송이 밀렸다. 인 대신 물건을 옮긴다.",
    objectives: [
      { kind: "reach", x: -40, z: 26, radius: 6, text: "대안통운 물류창고로 간다" },
      { kind: "reach", x: 38, z: 38, radius: 6, text: "농경지 헛간에 배달한다" },
      { kind: "reach", x: 0, z: -52, radius: 7, text: "촌장 집에 배달한다" },
    ],
    reward: { element: "mg", exp: 100, rep: ["neutral", 15] },
    next: null,
  },
];

// ---------------- 진행 관리 ----------------

export const QUEST_STATE = {
  LOCKED: "locked",
  ACTIVE: "active",
  DONE: "done",
};

export class QuestLog {
  constructor(initial = {}) {
    this.state = {};        // questId → QUEST_STATE
    this.counters = {};     // "questId:objIndex" → 진행 수치
    for (const q of QUESTS) this.state[q.id] = QUEST_STATE.LOCKED;
    Object.assign(this.state, initial.state ?? {});
    Object.assign(this.counters, initial.counters ?? {});

    // 첫 퀘스트는 처음부터 열려 있다
    if (this.state[QUESTS[0].id] === QUEST_STATE.LOCKED) {
      this.state[QUESTS[0].id] = QUEST_STATE.ACTIVE;
    }
  }

  get active() {
    return QUESTS.filter((q) => this.state[q.id] === QUEST_STATE.ACTIVE);
  }

  isDone(id) { return this.state[id] === QUEST_STATE.DONE; }

  _key(qid, i) { return `${qid}:${i}`; }

  progressOf(quest, i, ctx) {
    const obj = quest.objectives[i];
    switch (obj.kind) {
      case "flag":
        return ctx.flags.has(obj.flag) ? 1 : 0;
      case "collect":
        return Math.min(obj.count, ctx.codexSize);
      case "defeat":
      case "reach":
        return this.counters[this._key(quest.id, i)] ?? 0;
      default:
        return 0;
    }
  }

  targetOf(obj) {
    return obj.count ?? 1;
  }

  /** 적을 쓰러뜨렸을 때 */
  onDefeat(elementId) {
    for (const q of this.active) {
      q.objectives.forEach((o, i) => {
        if (o.kind !== "defeat" || o.elementId !== elementId) return;
        const k = this._key(q.id, i);
        this.counters[k] = Math.min(o.count, (this.counters[k] ?? 0) + 1);
      });
    }
  }

  /** 매 틱 위치 확인 — reach 목표용 */
  onMove(x, z) {
    for (const q of this.active) {
      q.objectives.forEach((o, i) => {
        if (o.kind !== "reach") return;
        const k = this._key(q.id, i);
        if (this.counters[k]) return;
        // 순서대로 밟아야 한다 — 앞 목표가 끝나야 다음이 열린다
        if (i > 0 && !this.counters[this._key(q.id, i - 1)]) return;
        if (Math.hypot(x - o.x, z - o.z) <= (o.radius ?? 5)) this.counters[k] = 1;
      });
    }
  }

  /**
   * 완료된 퀘스트를 찾아 처리한다.
   * @returns {object[]} 이번에 완료된 퀘스트 목록
   */
  checkComplete(ctx) {
    const finished = [];
    for (const q of this.active) {
      const ok = q.objectives.every((o, i) => this.progressOf(q, i, ctx) >= this.targetOf(o));
      if (!ok) continue;
      this.state[q.id] = QUEST_STATE.DONE;
      if (q.next && this.state[q.next] === QUEST_STATE.LOCKED) {
        this.state[q.next] = QUEST_STATE.ACTIVE;
      }
      finished.push(q);
    }
    return finished;
  }

  toJSON() { return { state: { ...this.state }, counters: { ...this.counters } }; }
}

export function getQuest(id) {
  return QUESTS.find((q) => q.id === id) ?? null;
}
