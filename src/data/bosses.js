// 보스 6인.
//
// 등급은 사용자 요청대로 조무래기 2 · 중급 3 · 파멸급 1.
// 각자 고유 기믹이 있고, 그 기믹이 그 원소의 성질에서 나온다.
//   브로민 — 신문 기자라 가짜 정보를 뿌린다 → 상성 배율이 거짓으로 표시된다
//   비소   — 암살이 늘 허술하다 → 자기 독에 걸린다
//   수은   — 사람 마음을 홀린다 → 아군을 조종한다
//   염소   — 아르곤이 되고 싶어한다 → 전자를 흡수할수록 아르곤을 닮아간다
//   폴로늄 — 최대 순간 화력에 집착한다 → 끝내 자신을 무기로 만든다

export const BOSS_TIER = {
  MINOR: "minor",   // 조무래기
  MID: "mid",       // 중급
  DOOM: "doom",     // 세계 파멸급
};

export const BOSSES = [
  {
    id: "boss_br",
    elementId: "br",
    tier: BOSS_TIER.MINOR,
    chapter: 2,
    name: "브로민",
    epithet: "브로민 신문사 기자",
    level: 6,
    hpMult: 3.2,
    x: 26, z: 74,
    intro: ["또 특종이네! 이름 없는 원소라니, 1면감이야.", "잠깐만 서 있어 줄래? 사진 좀 찍게."],
    defeat: ["…좋은 기사가 되겠는데.", "염소 선배 얘기 말이야. 그 사람, 정말로 아르곤이 되려고 해."],
    phases: [
      {
        at: 1.0,
        name: "가짜 뉴스",
        // 상성 표시를 뒤집는다. 숫자를 믿지 말고 실제 피해량을 보라는 기믹
        gimmick: "fake_affinity",
        say: "우리 신문은 언제나 진실만 보도하지!",
      },
    ],
  },
  {
    id: "boss_as",
    elementId: "as",
    tier: BOSS_TIER.MINOR,
    chapter: 2,
    name: "비소",
    epithet: "어린 암살 마법사",
    level: 7,
    hpMult: 3.0,
    x: -70, z: 62,
    intro: ["너… 유산을 노리고 온 거지?", "아니야! 나는 지키려는 것뿐이야!"],
    defeat: ["아니야… 나는 살인이 아니라구…", "…미안해. 정말은 그냥 무서웠어."],
    phases: [
      {
        at: 1.0,
        name: "독 장판",
        gimmick: "poison_field",
        say: "가까이 오면 안 돼!",
      },
      {
        at: 0.45,
        name: "허술한 마무리",
        // 독을 너무 많이 깔아 자기가 밟는다. 유도하면 자멸
        gimmick: "self_poison",
        say: "어… 어라? 이거 내 독인데…",
      },
    ],
  },
  {
    id: "boss_hg",
    elementId: "hg",
    tier: BOSS_TIER.MID,
    chapter: 3,
    name: "수은",
    epithet: "상온 액체 마법사",
    level: 12,
    hpMult: 4.2,
    x: 96, z: -84,
    intro: ["오, 이런 곳에 관객이?", "계략은 은밀한 게 최고! …라고 하지만, 오늘은 화려하게 가지."],
    defeat: ["훌륭해. 내 무대를 망친 건 네가 처음이야.", "…이 힘, 가져가도 좋아. 재밌었으니까."],
    phases: [
      {
        at: 1.0,
        name: "매혹",
        // 파티에 편성된 원소 하나가 잠시 적이 된다
        gimmick: "charm",
        say: "이리 오렴. 내 편이 되어 줄래?",
      },
      {
        at: 0.5,
        name: "액체 변형",
        // 형태를 바꿔 근접 공격을 흘린다 — 마법형으로 상대해야 한다
        gimmick: "liquid_form",
        say: "상온에서 흐르는 유일한 금속이란다.",
      },
    ],
  },
  {
    id: "boss_fe",
    elementId: "fe",
    tier: BOSS_TIER.MID,
    chapter: 3,
    name: "철",
    epithet: "전이 금속 군단 대장",
    level: 14,
    hpMult: 4.6,
    x: -120, z: -70,
    // 세력 선택의 결과 — 백금을 지지하면 철과 싸운다
    condition: "sided_noblesse",
    intro: ["…네가 저쪽에 섰다는 말을 들었다.", "원망하지 않는다. 다만 물러설 수도 없다."],
    defeat: ["…이걸로 됐다.", "내 신념이 옳다고 믿었지만, 정답이라고는 말하지 않았지."],
    phases: [
      { at: 1.0, name: "정의의 철퇴", gimmick: "heavy_strike", say: "간다." },
      { at: 0.4, name: "산화", gimmick: "rust_aura", say: "녹슬어도 부러지지는 않는다." },
    ],
  },
  {
    id: "boss_pt",
    elementId: "pt",
    tier: BOSS_TIER.MID,
    chapter: 3,
    name: "백금",
    epithet: "백금족을 이끄는 지도자",
    level: 14,
    hpMult: 4.6,
    x: 120, z: -70,
    // 철을 지지하면 백금과 싸운다
    condition: "sided_legion",
    intro: ["아름다움을 지키는 것이 귀족의 의무야.", "네가 그것을 부수겠다면, 나도 물러설 수 없어."],
    defeat: ["…내가 지킨 것은 아름다움이었을까, 나 자신이었을까.", "가져가. 나보다 잘 쓸 것 같으니."],
    phases: [
      { at: 1.0, name: "불변의 광휘", gimmick: "reflect", say: "백금은 왕수로만 녹는단다." },
      { at: 0.4, name: "촉매", gimmick: "haste", say: "이 정도는 견뎌야지." },
    ],
  },
  {
    id: "boss_cl",
    elementId: "cl",
    tier: BOSS_TIER.MID,
    chapter: 5,
    name: "염소",
    epithet: "전자 친화팀 팀장",
    level: 18,
    hpMult: 5.4,
    x: -84, z: -112,   // 석회암 고원 깊은 곳
    intro: [
      "두 눈 크게 뜨고 잘 봐! 아르곤에 대한 사랑으로 가득한 나의 마음을!",
      "전자 하나만 더 있으면 돼. 하나만 더 있으면 나도 귀족이 될 수 있어.",
    ],
    // 처치 / 설득 두 갈래 — 설득이 진엔딩 조건
    defeat: ["…또 실패야.", "몇 번을 해도 나는 염소일 뿐이구나."],
    persuade: [
      "…나더러 나 자신으로 있으라고?",
      "너는 이름조차 없으면서, 그런 말을 하는구나.",
      "…그래. 어쩌면 그래서 네 말이 들리는지도 모르겠다.",
    ],
    phases: [
      { at: 1.0, name: "전자 탈취", gimmick: "drain", say: "네 전자, 조금만 빌릴게." },
      { at: 0.6, name: "아르곤 흉내", gimmick: "mimic_argon", say: "봐, 나도 이렇게 안정될 수 있어!" },
      {
        at: 0.25,
        name: "붕괴 직전",
        // 여기서 공격을 멈추면 설득 분기가 열린다
        gimmick: "persuade_window",
        say: "…어째서 안정되지 않는 거야!",
      },
    ],
  },
  {
    id: "boss_po",
    elementId: "po",
    tier: BOSS_TIER.DOOM,
    chapter: 7,
    name: "폴로늄",
    epithet: "종말의 엔지니어",
    level: 25,
    hpMult: 8.0,
    x: 18, z: -142,    // 고원 끝, 붕괴가 시작되는 자리
    intro: [
      "오홋♪ 손님이네. 나랑 홍차 한잔 할래?",
      "…아, 그럴 시간은 없겠구나. 마침 완성했거든.",
      "천연 우라늄의 100억 배. 그게 내 방사선량이야.",
    ],
    defeat: [
      "…이렇게 될 줄 알았어.",
      "최대 순간 화력이란 건, 결국 한 번뿐이라는 뜻이니까.",
      "가져가. 다음엔 더 좋은 걸 만들 테니까… 다음이 있다면.",
    ],
    phases: [
      {
        at: 1.0,
        name: "발명가",
        // 포탑을 소환해 원거리 견제. 포탑을 부수며 접근한다
        gimmick: "turrets",
        say: "내 발명품들, 인사하렴.",
      },
      {
        at: 0.66,
        name: "시작(試作)",
        // 화면 절반을 덮는 방사선 장판. 안전 지대가 계속 이동한다
        gimmick: "radiation_field",
        say: "미완성이지만… 뭐, 시험 삼아?",
      },
      {
        at: 0.3,
        name: "임계",
        // 대륙 붕괴 타이머. 제한 시간 내에 못 잡으면 붕괴 엔딩
        gimmick: "critical",
        timer: 90,
        say: "이제 내가 무기야. 90초면 충분하지?",
      },
    ],
  },
];

export function getBoss(id) {
  return BOSSES.find((b) => b.id === id) ?? null;
}

export function bossOfElement(elementId) {
  return BOSSES.find((b) => b.elementId === elementId) ?? null;
}

/** 지금 조건에서 등장하는 보스만 (세력 선택으로 갈리는 철/백금 처리) */
export function availableBosses(flags) {
  return BOSSES.filter((b) => !b.condition || flags.has(b.condition));
}
