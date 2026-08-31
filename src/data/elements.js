// 아스티온 대륙의 원소 38명 + 플레이어.
// 수치(원자량·전기음성도·녹는점)는 실제 값이고, 성격·직업·인연은 참고자료 설정을 따랐다.
// 전기음성도는 폴링 척도이며 DamageCalc가 상성 배율 계산에 그대로 쓴다.
//
// family  : 상성·전투유형·모델 실루엣을 결정하는 족 분류
// combat  : "striker"(무기형) | "caster"(마법형) | "hybrid"(하이브리드)
// bonds   : 자료의 "인연이 깊은 원소" — 파티 보너스 판정에 쓰인다
// colors  : 절차적 3D 모델 생성에 쓰는 색. main/sub/accent/hair 4색 구성
// model   : assets/models/<id>.glb 가 있으면 그걸 쓰고, 없으면 절차적 생성으로 대체

export const FAMILY = {
  ALKALI: "alkali",
  ALKALINE: "alkaline",
  TRANSITION: "transition",
  PRECIOUS: "precious",
  NONMETAL: "nonmetal",
  METALLOID: "metalloid",
  HALOGEN: "halogen",
  NOBLE: "noble",
  RADIOACTIVE: "radioactive",
  UNKNOWN: "unknown",
};

export const COMBAT = {
  STRIKER: "striker",
  CASTER: "caster",
  HYBRID: "hybrid",
};

// 족 → 기본 전투 유형. 개별 캐릭터가 combat을 명시하면 그쪽이 이긴다.
export const FAMILY_DEFAULT_COMBAT = {
  [FAMILY.ALKALI]: COMBAT.STRIKER,
  [FAMILY.ALKALINE]: COMBAT.STRIKER,
  [FAMILY.TRANSITION]: COMBAT.STRIKER,
  [FAMILY.PRECIOUS]: COMBAT.STRIKER,
  [FAMILY.NONMETAL]: COMBAT.CASTER,
  [FAMILY.METALLOID]: COMBAT.HYBRID,
  [FAMILY.HALOGEN]: COMBAT.CASTER,
  [FAMILY.NOBLE]: COMBAT.CASTER,
  [FAMILY.RADIOACTIVE]: COMBAT.CASTER,
  [FAMILY.UNKNOWN]: COMBAT.HYBRID,
};

export const FAMILY_LABEL = {
  [FAMILY.ALKALI]: "알칼리 금속",
  [FAMILY.ALKALINE]: "알칼리 토금속",
  [FAMILY.TRANSITION]: "전이 금속",
  [FAMILY.PRECIOUS]: "귀금속",
  [FAMILY.NONMETAL]: "비금속",
  [FAMILY.METALLOID]: "준금속",
  [FAMILY.HALOGEN]: "할로겐",
  [FAMILY.NOBLE]: "귀족 기체",
  [FAMILY.RADIOACTIVE]: "방사성 원소",
  [FAMILY.UNKNOWN]: "미분류",
};

export const COMBAT_LABEL = {
  [COMBAT.STRIKER]: "무기형",
  [COMBAT.CASTER]: "마법형",
  [COMBAT.HYBRID]: "하이브리드",
};

/**
 * silhouette — 절차적 모델의 형태 갈래
 *  armored   각진 갑옷 (전이 금속 군단)
 *  noble     장식이 많은 우아한 실루엣 (귀금속)
 *  robed     길게 흐르는 로브 (비금속 학자·성직자)
 *  floating  발이 지면에 닿지 않음 (귀족 기체)
 *  sharp     비대칭에 날카로운 돌기 (할로겐)
 *  glowing   발광 코어 (방사성)
 *  civilian  평상복 (주민·중립)
 */

export const ELEMENTS = [
  // ---------------- 전이 금속 군단 ----------------
  {
    id: "fe", z: 26, sym: "Fe", ko: "철", en: "Iron",
    family: FAMILY.TRANSITION, combat: COMBAT.STRIKER, silhouette: "armored",
    mass: 55.8, electroneg: 1.83, melt: 1536, boil: 2863,
    faction: "legion", role: "전이 금속 군단 대장",
    bio: "흔들리지 않는 굳은 신념과 정의감을 가지고 있어 많은 금속으로부터 지지를 얻고 있다. 정의의 철퇴를 귀금속과 비금속의 평등한 사회를 실현하는 데 쓰고자 한다.",
    quote: "평화… 정말 좋지. 근데 팔이 둔해지고….",
    bonds: ["mn", "s", "c"],
    colors: { main: 0x8e2230, sub: 0x2a1418, accent: 0xc9a227, hair: 0xb8342c },
  },
  {
    id: "co", z: 27, sym: "Co", ko: "코발트", en: "Cobalt",
    family: FAMILY.TRANSITION, combat: COMBAT.STRIKER, silhouette: "armored",
    mass: 58.9, electroneg: 1.88, melt: 1495, boil: 2930,
    faction: "legion", role: "전이 금속 군단 소속 군인",
    bio: "기품 있는 말투로 말하지만 의외로 평민 출신이다. 수입 대부분을 고향 마을로 보낸다. 가난한 환경 속에서 자란 탓인지 마찰에 대단히 강하다.",
    quote: "오호호! 그칠 줄 모르는 나의 식욕… 내 꿈은 탐험가야!",
    bonds: ["ni", "fe", "ag"],
    colors: { main: 0x2b3a6b, sub: 0x1a1f33, accent: 0xc0392b, hair: 0x3d6fc4 },
  },
  {
    id: "ni", z: 28, sym: "Ni", ko: "니켈", en: "Nickel",
    family: FAMILY.TRANSITION, combat: COMBAT.STRIKER, silhouette: "armored",
    mass: 58.7, electroneg: 1.91, melt: 1455, boil: 2913,
    faction: "legion", role: "강철부대 대장",
    bio: "공격받으면 받을수록 더욱 단단히 방어하는 '강철부대'의 대장. 늘 흥분해 있는 코발트를 차분히 달래주는 모습을 자주 볼 수 있다.",
    quote: "코발트는 대식가가 분명해!",
    bonds: ["co", "fe", "cu"],
    colors: { main: 0x2e5c46, sub: 0x1a2b22, accent: 0x9fb8a8, hair: 0x4a9e78 },
  },
  {
    id: "mn", z: 25, sym: "Mn", ko: "망가니즈", en: "Manganese",
    family: FAMILY.TRANSITION, combat: COMBAT.STRIKER, silhouette: "armored",
    mass: 54.9, electroneg: 1.55, melt: 1246, boil: 2062,
    faction: "legion", role: "합금 무기를 만드는 대장장이",
    bio: "무기 개발이 생업인 대장장이 금속. 쇠를 단련하는 데 엄청난 재능이 있다. 넓은 인맥을 이용해 여러 전이 금속과 함께 특수한 합금 무기를 만들어 내는 게 특기다.",
    quote: "에헤헤, 매번 고마워요~ 안 쓰는 무기는 내게 팔아요. 재활용하게~",
    bonds: ["fe", "cu", "mg"],
    colors: { main: 0x8b2f3a, sub: 0x3a1a1e, accent: 0xd9a441, hair: 0x6b2028 },
  },
  {
    id: "ti", z: 22, sym: "Ti", ko: "타이타늄", en: "Titanium",
    family: FAMILY.TRANSITION, combat: COMBAT.STRIKER, silhouette: "armored",
    mass: 47.9, electroneg: 1.54, melt: 1668, boil: 3289,
    faction: "legion", role: "청소업체 점주 (거인족)",
    bio: "자칭 청소업체의 점주로 일하는 거인족의 금속 원소. 본인은 '청소'라고 말하지만, 청소를 전투라 생각하여 고객을 단숨에 깨끗하게 만들어 버리는 활기찬 원소.",
    quote: "야! 다들 청소 시간이야! 타이타늄, 오늘도 파이팅!!!!",
    bonds: ["mo", "cu", "w"],
    colors: { main: 0xd8d2c4, sub: 0x4a4640, accent: 0xe8b84b, hair: 0xf0e6d2 },
  },
  {
    id: "sc", z: 21, sym: "Sc", ko: "스칸듐", en: "Scandium",
    family: FAMILY.TRANSITION, combat: COMBAT.STRIKER, silhouette: "civilian",
    mass: 45.0, electroneg: 1.36, melt: 1539, boil: 2831,
    faction: "legion", role: "거인족 야구 선수",
    bio: "덩치에 비해 소심한 성격으로 귀신을 몹시 무서워한다. 그러나 그의 유별난 유머 감각에 팀원들은 오히려 그를 귀신보다 기묘한 존재로 여긴다.",
    quote: "잠깐, 저 흰 그림자는 뭐야? 귀신!?!? 휴우, 타이타늄이구나….",
    bonds: ["v", "al", "ti"],
    colors: { main: 0xe8e4d8, sub: 0x2c3e50, accent: 0xc9a227, hair: 0x8a9099 },
  },

  // ---------------- 귀금속 귀족 ----------------
  {
    id: "pt", z: 78, sym: "Pt", ko: "백금", en: "Platinum",
    family: FAMILY.PRECIOUS, combat: COMBAT.STRIKER, silhouette: "noble",
    mass: 195.1, electroneg: 2.28, melt: 1769, boil: 3827,
    faction: "noblesse", role: "백금족을 이끄는 지도자",
    bio: "귀금속 중 최고로 손꼽히는 소녀. 세상 물정을 잘 모르는 면도 있지만, 아름다운 이 세상을 지키기 위해 늘 앞장서 싸운다.",
    quote: "햇빛이 닿지 않는 곳에서도 아름다움을 유지하는 건 귀족이 지켜야 할 당연한 의무야.",
    bonds: ["ir", "au", "as"],
    colors: { main: 0xe8e8ec, sub: 0x3c3f4a, accent: 0xb8bcc8, hair: 0xf2f2f5 },
  },
  {
    id: "au", z: 79, sym: "Au", ko: "금", en: "Gold",
    family: FAMILY.PRECIOUS, combat: COMBAT.STRIKER, silhouette: "noble",
    mass: 197.0, electroneg: 2.54, melt: 1064, boil: 2857,
    faction: "noblesse", role: "신전에 스스로를 가둔 황금 용",
    bio: "옛날 옛적 마음씨 착한 황금 용은 가난한 사람들에게 황금을 나눠 줬지만, 오히려 분쟁의 불씨가 되었고 그로 인해 마음의 상처를 입어 신전에 스스로를 가뒀다는 전설이 전해져 오고 있다.",
    quote: "이 정도는 아무것도 아냐! 내가 최고거든!",
    bonds: ["ag", "cu"],
    colors: { main: 0xd9a441, sub: 0x6b4a12, accent: 0xf5d98a, hair: 0xf0d060 },
  },
  {
    id: "ag", z: 47, sym: "Ag", ko: "은", en: "Silver",
    family: FAMILY.PRECIOUS, combat: COMBAT.STRIKER, silhouette: "noble",
    mass: 107.8, electroneg: 1.93, melt: 962, boil: 2162,
    faction: "noblesse", role: "거울 나라의 주인",
    bio: "자신의 힘으로 만들어 낸 아름다운 거울 나라에서 조용히 살아가는 귀금속. 먼 옛날 뿔뿔이 흩어진 형제, 금과 구리를 수천 년 동안 그리워하고 있다.",
    quote: "금속으로서의 가치 따윈 아무래도 좋아, 저 아이가 웃어준다면….",
    bonds: ["au", "cu", "s"],
    colors: { main: 0xdfe3e8, sub: 0x4a5058, accent: 0xa8b2bd, hair: 0xeef1f4 },
  },
  {
    id: "cu", z: 29, sym: "Cu", ko: "구리", en: "Copper",
    family: FAMILY.PRECIOUS, combat: COMBAT.STRIKER, silhouette: "noble",
    mass: 63.5, electroneg: 1.90, melt: 1085, boil: 2562,
    faction: "noblesse", role: "마을에 섞여 사는 금속 드래곤",
    bio: "고대부터 존재하는 금속 드래곤 중 하나. 귀금속 형제와는 아주 오랜 옛날에 헤어져 비금속으로 살아왔다. 현재는 작은 마을 근처에서 사람들과 함께 살아가고 있다.",
    quote: "어라, 혹시 키가 컸나? 얀-텔러(Jahn-Teller effect)인가!",
    bonds: ["sn", "zn", "ni"],
    colors: { main: 0xb87333, sub: 0x5c3a1a, accent: 0x4aa89a, hair: 0xd98c4a },
  },

  // ---------------- 귀족 기체 ----------------
  {
    id: "ne", z: 10, sym: "Ne", ko: "네온", en: "Neon",
    family: FAMILY.NOBLE, combat: COMBAT.CASTER, silhouette: "floating",
    mass: 20.2, electroneg: null, melt: -249, boil: -246,
    faction: "noble_gas", role: "최고재판소 소장",
    bio: "화학적으로 가장 안정된 기체라는 별칭은 그냥 붙여진 것이 아니다. 모든 게 갖춰진 환경에서 자유롭게 살아가며 어두운 지하 세계의 거리를 밝고 시끌벅적하게 비춘다.",
    quote: "시대는 흐르고 흘러 새로운 것이 옛것이 되어간다. 내가 최고재판소 소장으로 너희에게 줄 수 있는 건 첨단 시설이 갖춰진 법정이야.",
    bonds: ["he"],
    colors: { main: 0xe8506b, sub: 0x4a1a28, accent: 0xf5a0b4, hair: 0xc060d0 },
  },
  {
    id: "ar", z: 18, sym: "Ar", ko: "아르곤", en: "Argon",
    family: FAMILY.NOBLE, combat: COMBAT.CASTER, silhouette: "floating",
    mass: 39.9, electroneg: null, melt: -189, boil: -186,
    faction: "noble_gas", role: "아르곤 시티 촌장",
    bio: "잠자는 걸 좋아하고 노동을 싫어하는 태만한 귀족 기체. 성 아랫마을 아르곤 시티의 촌장으로, 일은 부하에게 떠맡기고 자신은 평화로운 마을을 내려다보며 오늘도 게으름을 피우고 있다.",
    quote: "곤란하기도 하지, 아무 일도 안 하는데 모두에게 도움이 되고 있다니~",
    bonds: ["k", "n", "he"],
    colors: { main: 0xa89ad8, sub: 0x3a3358, accent: 0xd8d0f0, hair: 0xc4b8e8 },
  },
  {
    id: "rn", z: 86, sym: "Rn", ko: "라돈", en: "Radon",
    family: FAMILY.NOBLE, combat: COMBAT.CASTER, silhouette: "floating",
    mass: 222, electroneg: null, melt: -71, boil: -62,
    faction: "exiled", role: "온천 리조트 '호르메시스' 운영",
    bio: "방사성 기체. 의심스러워 보이는 건강 상품을 팔기도 하지만 온천은 두말할 나위 없이 최고!",
    quote: "헤헤, 그쯤 해 둬. 이 사탕 줄까?",
    bonds: ["ra", "th", "ac"],
    colors: { main: 0x8a4a6b, sub: 0x2e1a28, accent: 0xd88ab0, hair: 0xb06888 },
  },

  // ---------------- 전자 친화팀 (할로겐) ----------------
  {
    id: "cl", z: 17, sym: "Cl", ko: "염소", en: "Chlorine",
    family: FAMILY.HALOGEN, combat: COMBAT.HYBRID, silhouette: "sharp",
    mass: 35.4, electroneg: 3.16, melt: -101, boil: -34,
    faction: "affinity", role: "전자 친화팀 팀장",
    bio: "위험한 조직 '전자 친화팀'의 팀장. 동경하는 아르곤과 똑같은 전자 배치를 가지기 위해서라면 수단과 방법을 가리지 않는다. 강한 독성 기체를 내뿜어 적은 물론 내 편까지 무차별적으로 공격하는 위험한 원소.",
    quote: "두 눈 크게 뜨고 잘 봐! 아르곤에 대한 사랑으로 가득한 나의 마음을!",
    bonds: ["ar", "na", "f"],
    colors: { main: 0x3a4a2c, sub: 0x1a2014, accent: 0xa8d145, hair: 0x2a2e28 },
  },
  {
    id: "br", z: 35, sym: "Br", ko: "브로민", en: "Bromine",
    family: FAMILY.HALOGEN, combat: COMBAT.STRIKER, silhouette: "sharp",
    mass: 79.9, electroneg: 2.96, melt: -7, boil: 59,
    faction: "affinity", role: "브로민 신문사 기자",
    bio: "화제성 없는 스캔들 기사를 주로 쓴다. 가짜 뉴스가 세상에 퍼져나가는 것을 막으며 꿋꿋이 진실을 보도하는 진정한 저널리스트.",
    quote: "어머나, 또 할로젠의 폭주 사고야? 하긴 자주 있는 일이지.",
    bonds: ["cl", "ag", "k"],
    colors: { main: 0x6b4a2a, sub: 0x2e2014, accent: 0xc48a4a, hair: 0xa8874a },
  },

  // ---------------- 추방된 방사성 원소 ----------------
  {
    id: "u", z: 92, sym: "U", ko: "우라늄", en: "Uranium",
    family: FAMILY.RADIOACTIVE, combat: COMBAT.CASTER, silhouette: "glowing",
    mass: 238.0, electroneg: 1.38, melt: 1132, boil: 4172,
    faction: "exiled", role: "추방된 방사성 원소의 대표",
    bio: "발열 체질로 늘 몸에 냉각수를 순환시켜 체온을 낮춘다. 재능과 자존심 사이에서 오락가락 흔들리기에 정서적으로 불안정하다.",
    quote: "우리는 혜택받은 존재지? 안정이 좀 부럽기는 해도….",
    bonds: ["f", "es"],
    colors: { main: 0x2e5c3a, sub: 0x14261a, accent: 0x6ee85a, hair: 0x1e3326 },
  },
  {
    id: "po", z: 84, sym: "Po", ko: "폴로늄", en: "Polonium",
    family: FAMILY.RADIOACTIVE, combat: COMBAT.HYBRID, silhouette: "glowing",
    mass: 210, electroneg: 2.00, melt: 254, boil: 962,
    faction: "exiled", role: "공학을 연구하는 엔지니어",
    bio: "선천적으로 무언가를 만드는 재주가 남다르고 최대 순간 화력에 집착하는 버릇이 있어 정체를 알 수 없는 무기를 자꾸 발명한다. 천연 우라늄의 100억 배나 되는 강렬한 방사선량을 내뿜는다.",
    quote: "오홋♪ 여전히 성실하네, 나랑 홍차 한잔 할래?",
    bonds: ["be", "u", "cm"],
    colors: { main: 0x3a3a6b, sub: 0x1a1a33, accent: 0x8ab4f0, hair: 0x6a5ac4 },
  },
  {
    id: "tc", z: 43, sym: "Tc", ko: "테크네튬", en: "Technetium",
    family: FAMILY.RADIOACTIVE, combat: COMBAT.CASTER, silhouette: "glowing",
    mass: 99, electroneg: 1.90, melt: 2172, boil: 4877,
    faction: "exiled", role: "방랑 인형술사",
    bio: "우물가 근처에 있는 집에 살며 종종 훌쩍 어디론가 여행을 떠나는 방랑 인형술사. 움직이는 것을 좇는 이상한 인형을 조종한다. 그가 있는 곳이 알고 싶다면 인형에게 물으면 된다.",
    quote: "…에도 생명이 깃드는구나. …에게 잊혀지더라도….",
    bonds: ["mo", "u"],
    colors: { main: 0x3e3648, sub: 0x1c1822, accent: 0xc8b8d8, hair: 0xd8d0e0 },
  },
  {
    id: "es", z: 99, sym: "Es", ko: "아인슈타이늄", en: "Einsteinium",
    family: FAMILY.RADIOACTIVE, combat: COMBAT.CASTER, silhouette: "glowing",
    mass: 252, electroneg: 1.3, melt: 860, boil: null,
    faction: "exiled", role: "혼자 연구하는 괴짜 학자",
    bio: "상상력도 호기심도 많은 학자. 다른 학자들과 의견이 대립되면서 사이가 틀어진 탓에 혼자 연구하는 괴짜 학자이지만, 음악과 아름다운 바다와 평화를 진심으로 사랑한다.",
    quote: "정해진 운명, 던져진 주사위. 두렵지만 분명히 앞날은 있어.",
    bonds: ["fm", "u"],
    colors: { main: 0x2a5a7a, sub: 0x142a3a, accent: 0x6ac8e8, hair: 0x3a5a8a },
  },

  // ---------------- 중립 학자·주민 ----------------
  {
    id: "c", z: 6, sym: "C", ko: "탄소", en: "Carbon",
    family: FAMILY.NONMETAL, combat: COMBAT.CASTER, silhouette: "civilian",
    mass: 12.0, electroneg: 2.55, melt: 3550, boil: 4827,
    faction: "neutral", role: "탄소 학교 교장",
    bio: "최대 4개까지 잡을 수 있는 팔을 가진 유쾌한 천재 학자. 싹싹한 성격에 발도 넓다. 어려 보이는 외모로 도저히 천년의 세월을 살아왔다고는 믿기지 않는다. 놀라운 발상으로 늘 새로운 것을 만들어 낸다.",
    quote: "하하하! 이런 책을 읽고 있다니 열심히 공부하는구나! 너, 우리 학교에 들어와라!",
    bonds: ["si", "o", "pb"],
    colors: { main: 0x2c2c30, sub: 0x16161a, accent: 0x3a5a3a, hair: 0x1a1a1e },
  },
  {
    id: "si", z: 14, sym: "Si", ko: "규소", en: "Silicon",
    family: FAMILY.METALLOID, combat: COMBAT.HYBRID, silhouette: "robed",
    mass: 28.1, electroneg: 1.90, melt: 1412, boil: 3266,
    faction: "neutral", role: "결과를 예측하는 예언가",
    bio: "연산의 천재로 타고난 계산 능력을 발휘해 다양한 현상의 결과를 예측하는 '예언가'. 동족인 탄소와 달리 혼자 있는 것을 즐기며 조용히 생활한다.",
    quote: "이런… 나는 데이터가 없으면 미래를 예언할 수 없다구. 놀릴 생각이라면 이만 돌아가 줄래.",
    bonds: ["c", "o", "h"],
    colors: { main: 0xc4a8d8, sub: 0x4a3a58, accent: 0xe8d8f0, hair: 0xd8b8e8 },
  },
  {
    id: "n", z: 7, sym: "N", ko: "질소", en: "Nitrogen",
    family: FAMILY.NONMETAL, combat: COMBAT.CASTER, silhouette: "robed",
    mass: 14.0, electroneg: 3.04, melt: -210, boil: -196,
    faction: "neutral", role: "예의 바른 학자",
    bio: "예의 바르고 빼어난 외모를 자랑하는 학자. 딱히 결점 같은 건 보이지 않는다. 뛰어난 능력으로 주위 원소들로부터 부탁도 많이 받아서 간혹 어려운 문제를 억지로 떠안기도 한다.",
    quote: "날 미친 폭탄이니, 죽음의 공기니 괴상한 별명으로 부르는데, 제발 그만둬….",
    bonds: ["c", "o", "h"],
    colors: { main: 0x2a3050, sub: 0x14182a, accent: 0x6a78b8, hair: 0x1e2238 },
  },
  {
    id: "o", z: 8, sym: "O", ko: "산소", en: "Oxygen",
    family: FAMILY.NONMETAL, combat: COMBAT.CASTER, silhouette: "robed",
    mass: 16.0, electroneg: 3.44, melt: -218, boil: -183,
    faction: "neutral", role: "윤회를 관장하는 대주교",
    bio: "아스티온 대륙에서 윤회를 관장하는 대주교. 영원한 생명을 가진 원소의 눈에 끊임없이 변화하는 생명은 어떻게 보일까?",
    quote: "세계는 끝없이 순환하지, 생명도 순환해. 물론 모든 것은 자연의 섭리에 따라 돌고 돌아.",
    bonds: ["h", "c", "n"],
    colors: { main: 0xf0e6d2, sub: 0xb0304a, accent: 0xd9a441, hair: 0xe8c86a },
  },
  {
    id: "p", z: 15, sym: "P", ko: "인", en: "Phosphorus",
    family: FAMILY.NONMETAL, combat: COMBAT.CASTER, silhouette: "civilian",
    mass: 31.0, electroneg: 2.19, melt: 44, boil: 281,
    faction: "neutral", role: "대안통운 택배 기사",
    bio: "대륙에서 물류 운송을 책임지고 있는 '대안통운'의 택배 기사. 높은 신체 능력과 초능력을 가진 장난꾸러기로 평소 묘지를 파헤치거나 불을 붙이기도 한다.",
    quote: "고객님, 왜 지정한 배송 시간에 안 계신 거죠?",
    bonds: ["n", "ca", "o"],
    colors: { main: 0x8a2e3a, sub: 0x2e1218, accent: 0xf0d060, hair: 0xc4503a },
  },
  {
    id: "s", z: 16, sym: "S", ko: "황", en: "Sulfur",
    family: FAMILY.NONMETAL, combat: COMBAT.CASTER, silhouette: "robed",
    mass: 32.1, electroneg: 2.58, melt: 113, boil: 445,
    faction: "neutral", role: "전설 속 용의 왕",
    bio: "수많은 용을 거느리고 걸어갈 때 황금빛 다리가 놓인다는 전설 속 용의 왕. 그러나 그 명성에 걸맞지 않게 온천에 몸을 담그고 있는 모습이 자주 목격된다.",
    quote: "날 늘 욕조에 몸을 담그고 있는 노인이라고 말한 게 너냐? 배짱이 두둑하군!",
    bonds: ["fe", "ag", "hg"],
    colors: { main: 0xd9b641, sub: 0x5c4a12, accent: 0x2a6a8a, hair: 0xf0d878 },
  },
  {
    id: "ca", z: 20, sym: "Ca", ko: "칼슘", en: "Calcium",
    family: FAMILY.ALKALINE, combat: COMBAT.STRIKER, silhouette: "civilian",
    mass: 40.1, electroneg: 1.00, melt: 842, boil: 1503,
    faction: "neutral", role: "토룡마을 촌장",
    bio: "대륙의 동쪽 끝에 사람들이 모여서 사는 '토룡마을'의 촌장. 조용한 성격에 외교는 동족의 다른 이에게 떠맡기고 자신은 석회암 동굴 같은 이상한 곳에서 늘 '무언가'에게 기도한다.",
    quote: "매번 고생하시네요. 자유롭게 움직일 수 없는 이 몸을 대신해서….",
    bonds: ["sr", "ba", "p"],
    colors: { main: 0xe8e0cc, sub: 0x6b5a3a, accent: 0xc9a227, hair: 0xf0e8d8 },
  },
  {
    id: "mg", z: 12, sym: "Mg", ko: "마그네슘", en: "Magnesium",
    family: FAMILY.ALKALINE, combat: COMBAT.CASTER, silhouette: "robed",
    mass: 24.3, electroneg: 1.31, melt: 650, boil: 1095,
    faction: "neutral", role: "숲의 주인 (세계수)",
    bio: "자칭 '숲의 주인'. 요정의 모습을 했지만 정체는 대륙에 거대한 그림자를 드리운 세계수. 하지만 본인은 전혀 개의치 않고 늘 나무 안이나 바닷속에서 태양을 향한다.",
    quote: "…음냐… 흠냐….",
    bonds: ["al", "be", "mn"],
    colors: { main: 0xe8e4d0, sub: 0x4a5c3a, accent: 0x8ac46a, hair: 0xd8d4c0 },
  },
  {
    id: "be", z: 4, sym: "Be", ko: "베릴륨", en: "Beryllium",
    family: FAMILY.ALKALINE, combat: COMBAT.CASTER, silhouette: "civilian",
    mass: 9.0, electroneg: 1.57, melt: 1287, boil: 2472,
    faction: "neutral", role: "물리학자",
    bio: "쿠키 만들기와 연애가 취미인 물리학자. 부와 명성에는 조금도 관심이 없다. 가련한 외모와 달리 혹독한 환경에서 일어나는 현상을 관측하는 데 조예가 깊다.",
    quote: "쿨롱 장벽(Coulomb barrier)… 까다롭다니까. 마지막 한 걸음을 어떻게 다가가면 좋을까?",
    bonds: ["mg", "al", "cu"],
    colors: { main: 0x2a4a3e, sub: 0x14261e, accent: 0x6ac4a8, hair: 0x4a9e88 },
  },
  {
    id: "zn", z: 30, sym: "Zn", ko: "아연", en: "Zinc",
    family: FAMILY.TRANSITION, combat: COMBAT.STRIKER, silhouette: "civilian",
    mass: 65.4, electroneg: 1.65, melt: 420, boil: 907,
    faction: "neutral", role: "미식과 꽃을 사랑하는 음악가",
    bio: "'안정'을 제일로 생각하는 전형 원소 중에서 드물게 자기희생 정신을 가져 많은 원소로부터 사랑받는다. 철보다 쉽게 녹는 까닭에 철 주변에 있는 아연이 철을 지키기 위해 대신 자신을 희생한다.",
    quote: "내 입으로 말하기 좀 쑥스러운데….",
    bonds: ["bi", "cu", "fe"],
    colors: { main: 0x2a3448, sub: 0x161c26, accent: 0xd8d4c8, hair: 0xe8e0cc },
  },
  {
    id: "bi", z: 83, sym: "Bi", ko: "비스무트", en: "Bismuth",
    family: FAMILY.METALLOID, combat: COMBAT.HYBRID, silhouette: "noble",
    mass: 209.0, electroneg: 2.02, melt: 271, boil: 1561,
    faction: "neutral", role: "눈 덮인 산속의 건축가",
    bio: "결정이 녹아내린 듯 독특한 외관을 가진 건축가. 대륙 곳곳에 건축물을 남겼다. 사람과의 교류를 피해 눈 덮인 산속에서 생활하는 까닭에 그의 행적에 대하여 알려진 바가 없다.",
    quote: "…저기 …내 얼굴에 뭐가 묻었니…?",
    bonds: ["zn", "pb", "sn"],
    colors: { main: 0xe8e8ec, sub: 0x3a4050, accent: 0x8a6ac4, hair: 0xd8d0c0 },
  },
  {
    id: "hg", z: 80, sym: "Hg", ko: "수은", en: "Mercury",
    family: FAMILY.TRANSITION, combat: COMBAT.CASTER, silhouette: "noble",
    mass: 200.6, electroneg: 2.00, melt: -39, boil: 357,
    faction: "neutral", role: "상온 액체 마법사",
    bio: "대륙에 이름을 널리 알린 상온 액체 마법사. 사람의 마음을 홀릴 때 즐거움을 느끼고, 자신이 마치 슈퍼히어로라도 된 듯 행동하는 나르시시스트.",
    quote: "계략은 은밀한 게 최고!",
    bonds: ["pb", "c", "s"],
    colors: { main: 0x1e1e24, sub: 0x8a1a2a, accent: 0xc8ccd8, hair: 0xe8d878 },
  },
  {
    id: "pb", z: 82, sym: "Pb", ko: "납", en: "Lead",
    family: FAMILY.METALLOID, combat: COMBAT.HYBRID, silhouette: "noble",
    mass: 207.2, electroneg: 2.33, melt: 328, boil: 1750,
    faction: "neutral", role: "대륙에서 가장 유명한 연극 배우",
    bio: "아스티온 대륙에서 모르는 사람이 없을 정도로 유명한 연극 배우. 다양한 역할로 관객을 사로잡지만 늘 의도를 알 수 없는 눈빛을 하고 있다.",
    quote: "극중 역할에 사로잡히지 않아. 나는 자유인~ 그래서 가끔 방황도 해.",
    bonds: ["sn", "bi", "zn"],
    colors: { main: 0x4a4458, sub: 0x22202c, accent: 0xd8d0e0, hair: 0xe8e4d8 },
  },
  {
    id: "as", z: 33, sym: "As", ko: "비소", en: "Arsenic",
    family: FAMILY.METALLOID, combat: COMBAT.CASTER, silhouette: "sharp",
    mass: 74.9, electroneg: 2.18, melt: 817, boil: 603,
    faction: "neutral", role: "어린 암살 마법사",
    bio: "깜찍한 외모에 어울리지 않는 원한과 욕망을 가슴에 품고 있는 어린 마법사. 수많은 암살 계획을 실행에 옮겨왔지만, 허술한 마무리로 대개 암살 계획이 들통났다.",
    quote: "아니야! 나는 유산을 지키고 싶었을 뿐이야! 살인이 아니라구!",
    bonds: ["ga", "hg", "tl"],
    colors: { main: 0x3a4028, sub: 0x1a1e12, accent: 0xd8c84a, hair: 0x2a2a2e },
  },
  {
    id: "sb", z: 51, sym: "Sb", ko: "안티모니", en: "Antimony",
    family: FAMILY.METALLOID, combat: COMBAT.HYBRID, silhouette: "robed",
    mass: 121.8, electroneg: 2.05, melt: 631, boil: 1587,
    faction: "neutral", role: "스티비 대성당의 수도사",
    bio: "대륙에서 오랜 역사를 자랑하는 종교 시설 '스티비 대성당'의 수도사. 낮에는 성당에서 활자 인쇄를 하고 밤에는 아무도 모르게 퇴마사로 활동하며 성당 주변의 평온을 지키고 있다.",
    quote: "참회하기엔 아직 일러. 밤이 깊어질 때까지 같이 수다나 떨자.",
    bonds: ["s", "pb", "sn"],
    colors: { main: 0xf0ece0, sub: 0x2a2438, accent: 0xc9a227, hair: 0x4a3a58 },
  },
  {
    id: "nb", z: 41, sym: "Nb", ko: "나이오븀", en: "Niobium",
    family: FAMILY.TRANSITION, combat: COMBAT.STRIKER, silhouette: "civilian",
    mass: 92.9, electroneg: 1.60, melt: 2468, boil: 4742,
    faction: "neutral", role: "저승에 사는 금속 원소",
    bio: "탄탈럼과 함께 저승에 사는 금속 원소. 오만한 성격에 자기 자랑하기를 무엇보다 좋아한다. 유일하게 이야기를 들어 주는 탄탈럼을 가족으로 생각한다.",
    quote: "이런 것도 못 해? 내가 도와줄까?",
    bonds: ["ta", "sn", "w"],
    colors: { main: 0xe8e0d0, sub: 0x4a4038, accent: 0x8a7a5a, hair: 0xc4a878 },
  },
  {
    id: "ta", z: 73, sym: "Ta", ko: "탄탈럼", en: "Tantalum",
    family: FAMILY.TRANSITION, combat: COMBAT.STRIKER, silhouette: "civilian",
    mass: 180.9, electroneg: 1.50, melt: 2985, boil: 5510,
    faction: "neutral", role: "저주받은 비운의 금속",
    bio: "저승에 사는 비운의 금속 원소. 어떤 죄를 짓고 그 벌로 저주 받아 자유로이 움직일 수 없게 되었다. 그런 자신의 처지에 늘 마음을 써 주는 나이오븀을 자식처럼 여긴다.",
    quote: "나이오븀은 정말 착한 아이야. 성격에 무게가 좀 있기는 하지만….",
    bonds: ["nb", "w"],
    colors: { main: 0x3a3038, sub: 0x1a161c, accent: 0xa89a8a, hair: 0xd8d0c8 },
  },

  // ---------------- 초중원소 ----------------
  {
    id: "og", z: 118, sym: "Og", ko: "오가네손", en: "Oganesson",
    family: FAMILY.NOBLE, combat: COMBAT.CASTER, silhouette: "floating",
    mass: 294, electroneg: null, melt: null, boil: null,
    faction: "superheavy", role: "안정의 섬을 찾는 항해자",
    bio: "불안정한 바다 끄트머리에서 찾아온 원소. 머리도 똑똑한 데다 예술과 설계에도 뛰어나 자신이 직접 설계한 배를 타고 '안정의 섬'을 찾아 여행하고 있다.",
    quote: "안정의 섬에 이르러 그 풍경을 화폭에 담을 거야. 멋진 풍경이지!",
    bonds: ["fl", "cf", "ca"],
    colors: { main: 0x2a3a5c, sub: 0x141c2e, accent: 0xd8c88a, hair: 0x8a9ab8 },
  },
  {
    id: "nh", z: 113, sym: "Nh", ko: "니호늄", en: "Nihonium",
    family: FAMILY.UNKNOWN, combat: COMBAT.HYBRID, silhouette: "civilian",
    mass: 286, electroneg: null, melt: null, boil: null,
    faction: "superheavy", role: "불안정한 바다의 섬에서 발견됨",
    bio: "우직하고 적극적인 성격이지만 어딘가 서두르는 듯 보인다. 아연과 비스무트의 신비한 인연이 느껴진다.",
    quote: "처음 만난 순간 신비로운 인연을 느꼈어. 다시 만날 거야.",
    bonds: ["zn", "bi"],
    colors: { main: 0x8a2a3a, sub: 0x2e1218, accent: 0xf0e0d0, hair: 0x2a2428 },
  },
];

/** 플레이어 캐릭터. 주기율표에 자리가 없어 별도로 둔다. */
export const PLAYER_ELEMENT = {
  id: "uue", z: 119, sym: "119", ko: "이름 없는 자", en: "Unnamed",
  family: FAMILY.UNKNOWN, combat: COMBAT.HYBRID, silhouette: "civilian",
  mass: null, electroneg: null, melt: null, boil: null,
  faction: "none", role: "아직 발견되지 않은 원소",
  bio: "주기율표 어디에도 칸이 없어 이름도 족도 없다. 어느 세력에도 속하지 않기에 모든 세력을 자유로이 오갈 수 있는 유일한 존재.",
  quote: "…나는 누구지?",
  bonds: [],
  // 사용자가 그린 119번 원화를 따랐다 — 은발, 물들이지 않은 아마색 튜닉,
  // 갈색 가죽 벨트와 부츠. 문장(紋章)이 하나도 없는 것이 이 인물의 핵심이다.
  colors: {
    main: 0xe0d6c2,   // 튜닉
    sub: 0xd6cbb2,    // 바지
    accent: 0x8a6a45, // 가죽 벨트
    hair: 0xd6dae0,   // 은발
    boots: 0x8a6440,  // 갈색 부츠
  },
};

// ---------------- 조회 헬퍼 ----------------

const BY_ID = new Map(ELEMENTS.map((e) => [e.id, e]));
BY_ID.set(PLAYER_ELEMENT.id, PLAYER_ELEMENT);

export function getElement(id) {
  return BY_ID.get(id) || null;
}

export function getCombatType(el) {
  return el.combat || FAMILY_DEFAULT_COMBAT[el.family] || COMBAT.HYBRID;
}

export function byFaction(faction) {
  return ELEMENTS.filter((e) => e.faction === faction);
}

/** 인연 관계인지 — 한쪽 목록에만 있어도 인연으로 친다 (자료의 관계가 일방향인 경우가 많다) */
export function areBonded(idA, idB) {
  const a = getElement(idA);
  const b = getElement(idB);
  if (!a || !b) return false;
  return a.bonds.includes(idB) || b.bonds.includes(idA);
}

export const ELEMENT_COUNT = ELEMENTS.length;
