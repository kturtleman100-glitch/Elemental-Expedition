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
//   anyflag 여러 플래그 중 하나 — 갈림길(편을 들거나 들지 않거나)을 한 목표로 적는다
//
// reward.flag / reward.flags — 완료 시 세우는 플래그. 장(章) 플래그(chapter3…)가
// 여기서 나오고, 보스 등장 조건이 그 플래그를 본다. 퀘스트가 보스를 열어 주는 셈이라
// "퀘스트는 2장인데 5장 보스가 서 있는" 어긋남이 생기지 않는다.

export const QUESTS = [
  // ---------------- 1장: 이름 없는 자 ----------------
  {
    id: "ch1_awake",
    chapter: 1,
    title: "이름 없는 자",
    giver: "ca",
    summary: "석회 마을 촌장 칼슘에게 이야기를 듣는다.",
    objectives: [
      { kind: "flag", flag: "met_calcium", who: "ca", text: "칼슘과 대화한다" },
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
      { kind: "flag", flag: "clue_halogen", who: "p", text: "인(P)에게 목격담을 듣는다" },
      { kind: "flag", flag: "learned_chlorine", who: "c", text: "탄소(C)에게 상성을 배운다" },
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
    summary: "마을 남쪽 길목에 결원단 하수인이 있다. 쫓아낸다.",
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
    title: "불씨 운송 긴급 배송",
    giver: "p",
    summary: "길이 위험해져 배송이 밀렸다. 인 대신 물건을 옮긴다.",
    objectives: [
      { kind: "reach", x: -40, z: 26, radius: 6, text: "불씨 운송 물류창고로 간다" },
      { kind: "reach", x: 38, z: 38, radius: 6, text: "농경지 헛간에 배달한다" },
      { kind: "reach", x: 0, z: -52, radius: 7, text: "촌장 집에 배달한다" },
    ],
    reward: { element: "mg", exp: 100, rep: ["neutral", 15] },
    next: "ch2_press",
  },
  {
    id: "ch2_press",
    chapter: 2,
    title: "1면 기사",
    giver: "ca",
    summary: "결원단의 기자 브로민과 유산을 지키는 비소가 마을 밖 길목을 막고 있다.",
    objectives: [
      { kind: "flag", flag: "boss_done_boss_br", at: [26, 74], text: "남동쪽 길의 기자 브로민을 물리친다" },
      { kind: "flag", flag: "boss_done_boss_as", at: [-70, 62], text: "서남쪽 언덕의 암살자 비소를 물리친다" },
    ],
    reward: { exp: 200, rep: ["neutral", 15], flag: "chapter3" },
    next: "ch3_mercury",
  },

  // ---------------- 3장: 갈라진 대륙 ----------------
  {
    id: "ch3_mercury",
    chapter: 3,
    title: "무대 위의 액체",
    giver: "c",
    summary: "강 건너 숲에 상온 액체 마법사 수은이 무대를 차렸다. 근접으로는 벨 수 없다.",
    objectives: [
      { kind: "flag", flag: "boss_done_boss_hg", at: [96, -84], text: "동북쪽 숲의 수은을 물리친다 (마법으로)" },
    ],
    reward: { exp: 250, rep: ["neutral", 10] },
    next: "ch3_crossroads",
  },
  {
    id: "ch3_crossroads",
    chapter: 3,
    title: "갈림길",
    giver: "fe",
    summary: "군단과 귀족이 충돌 직전이다. 양쪽 말을 듣고 어디에 설지 정한다. 되돌릴 수 없다.",
    objectives: [
      { kind: "flag", flag: "heard_noblesse", who: "au", text: "서쪽 폐허의 황금 용(Au)에게 귀족의 말을 듣는다" },
      {
        kind: "anyflag",
        flags: ["sided_legion", "sided_noblesse", "stayed_neutral"],
        text: "어느 편에 설지 정한다 — 철(Fe) 또는 금(Au)에게",
      },
    ],
    reward: { exp: 150 },
    next: "ch3_war",
  },
  {
    id: "ch3_war",
    chapter: 3,
    title: "대륙의 전쟁",
    giver: "fe",
    summary: "편을 들었다면 상대편 대장이 막아선다. 어느 편도 아니라면 전쟁은 당신을 비켜 간다.",
    objectives: [
      {
        kind: "anyflag",
        flags: ["boss_done_boss_fe", "boss_done_boss_pt", "stayed_neutral"],
        text: "충돌을 매듭짓는다 (군단 편이면 백금이, 귀족 편이면 철이 나선다)",
      },
    ],
    reward: { exp: 300, flag: "chapter4" },
    next: "ch4_data",
  },

  // ---------------- 4장: 관측 자료 ----------------
  {
    id: "ch4_data",
    chapter: 4,
    title: "관측 자료",
    giver: "si",
    summary: "규소가 염소의 앞날을 계산하려면 더 많은 관측이 필요하다. 대륙의 원소들을 만난다.",
    objectives: [
      { kind: "collect", count: 20, text: "도감에 원소 20종을 등록한다" },
    ],
    reward: { exp: 200, rep: ["neutral", 10], flag: "data_enough" },
    next: "ch4_prophecy",
  },
  {
    id: "ch4_prophecy",
    chapter: 4,
    title: "규소의 계산",
    giver: "si",
    summary: "데이터가 모였다. 규소에게 돌아가 계산 결과를 듣는다.",
    objectives: [
      { kind: "flag", flag: "heard_prophecy", who: "si", text: "규소(Si)에게 예언을 듣는다" },
    ],
    reward: { exp: 120, flag: "chapter5" },
    next: "ch5_chlorine",
  },

  // ---------------- 5장: 아르곤이 되고 싶은 자 ----------------
  {
    id: "ch5_chlorine",
    chapter: 5,
    title: "아르곤이 되고 싶은 자",
    giver: "si",
    summary: "염소가 석회암 고원 깊은 곳에 있다. 무너지기 직전에 공격을 멈추고 다가가면 설득할 수 있다.",
    objectives: [
      { kind: "flag", flag: "boss_done_boss_cl", at: [-84, -112], text: "서북쪽 고원의 염소를 멈춘다 — 쓰러뜨리거나, 설득하거나" },
    ],
    reward: { exp: 400, rep: ["neutral", 20], flag: "chapter6" },
    next: "ch6_island",
  },

  // ---------------- 6장: 안정의 섬 ----------------
  {
    id: "ch6_island",
    chapter: 6,
    title: "안정의 섬",
    giver: "og",
    summary: "남쪽 해변의 항해자 오가네손이 염소의 결말을 듣고 싶어 한다. 그의 배에 탈지 답한다.",
    objectives: [
      { kind: "flag", flag: "og_decided", who: "og", text: "남쪽 모래사장의 오가네손(Og)에게 답한다" },
    ],
    reward: { exp: 250, flag: "chapter7" },
    next: "ch7_doom",
  },

  // ---------------- 7장: 종말의 엔지니어 ----------------
  {
    id: "ch7_doom",
    chapter: 7,
    title: "종말의 엔지니어",
    giver: "og",
    summary: "폴로늄이 고원 끝에서 자신을 무기로 만들고 있다. 임계에 이르기 전에 멈춘다.",
    objectives: [
      { kind: "flag", flag: "boss_done_boss_po", at: [18, -142], text: "북쪽 고원 끝의 폴로늄을 멈춘다 — 90초 안에" },
    ],
    reward: { exp: 800 },
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
    this.repair();
  }

  /**
   * 끊긴 사슬을 잇는다 — 끝난 퀘스트의 next가 아직 잠겨 있으면 연다.
   * 옛 저장은 2장에서 사슬이 끝났다(next: null). 그 뒤에 3장을 붙였으니,
   * 이게 없으면 그 저장은 영원히 3장에 못 들어간다.
   */
  repair() {
    for (const q of QUESTS) {
      if (this.state[q.id] !== QUEST_STATE.DONE || !q.next) continue;
      if (this.state[q.next] === QUEST_STATE.LOCKED) this.state[q.next] = QUEST_STATE.ACTIVE;
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
      case "anyflag":
        return obj.flags.some((f) => ctx.flags.has(f)) ? 1 : 0;
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
