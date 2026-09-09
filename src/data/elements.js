// 엘레멘타 대륙의 원소 38명 + 플레이어.
// 수치(원자량·전기음성도·녹는점)는 실제 값이고, 직업·성격·대사는 그 원소의
// 화학적 성질에서 도출했다 — 절차는 CLAUDE.md 「캐릭터를 짓는 법」에 있다.
// 전기음성도는 폴링 척도이며 DamageCalc가 상성 배율 계산에 그대로 쓴다.
//
// family  : 상성·전투유형·모델 실루엣을 결정하는 족 분류
// combat  : "striker"(무기형) | "caster"(마법형) | "hybrid"(하이브리드)
// bonds   : 함께 두면 힘이 붙는 원소 — 파티 보너스 판정에 쓰인다
// colors  : 절차적 3D 모델 생성에 쓰는 색. main/sub/accent/hair 4색 구성
// model   : assets/models/<id>.glb 가 있으면 그걸 쓰고, 없으면 절차적 생성으로 대체
// exception: 족 규칙(금속=무기형, 비금속=마법형)을 어길 때 그 이유.
//            안 적으면 플레이어가 "마그네슘은 비금속인가 보다"라고 잘못 배운다.
//            예외를 드러내는 것이 규칙을 가르치는 방법이다

export const FAMILY = {
  ALKALI: "alkali",
  ALKALINE: "alkaline",
  TRANSITION: "transition",
  PRECIOUS: "precious",
  NONMETAL: "nonmetal",
  METALLOID: "metalloid",
  POST_TRANSITION: "post_transition",
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
  [FAMILY.POST_TRANSITION]: COMBAT.STRIKER,
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
  [FAMILY.POST_TRANSITION]: "전이후 금속",
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
 *  armored   각진 갑옷 (화로 연합)
 *  noble     장식이 많은 우아한 실루엣 (귀금속)
 *  robed     길게 흐르는 로브 (비금속 학자·성직자)
 *  floating  발이 지면에 닿지 않음 (귀족 기체)
 *  sharp     비대칭에 날카로운 돌기 (할로겐)
 *  glowing   발광 코어 (방사성)
 *  civilian  평상복 (주민·중립)
 */

export const ELEMENTS = [
  // ---------------- 화로 연합 ----------------
  {
    id: "fe", z: 26, sym: "Fe", ko: "철", en: "Iron",
    family: FAMILY.TRANSITION, combat: COMBAT.STRIKER, silhouette: "armored",
    mass: 55.8, electroneg: 1.83, melt: 1536, boil: 2863,
    faction: "legion", role: "쇠를 벼리는 늙은 대장장이",
    // 근거 A — 순수한 철은 무르다. 탄소를 조금 섞어야 강철이 된다.
    //   '혼자서는 약하다'는 것이 이 원소의 핵심이고, 그것이 곧 성격이 됐다.
    bio: "쇠를 두들겨 연장을 만든다. 혼자 있을 때는 오히려 물러서, 다른 것을 조금 섞어야 단단해진다. 그 사실을 부끄러워하지 않고 늘 먼저 말한다.",
    quote: "나 혼자서는 별거 아니야. 너를 섞으면 달라지지.",
    bonds: ["mn", "s", "c"],
    colors: { main: 0x8e2230, sub: 0x2a1418, accent: 0xc9a227, hair: 0xb8342c },
  },
  {
    id: "co", z: 27, sym: "Co", ko: "코발트", en: "Cobalt",
    family: FAMILY.TRANSITION, combat: COMBAT.STRIKER, silhouette: "armored",
    mass: 58.9, electroneg: 1.88, melt: 1495, boil: 2930,
    faction: "legion", role: "파란 물감을 파는 떠돌이 장수",
    // 근거 A — 코발트블루. 유리와 도자기를 파랗게 물들이는 데 천 년 넘게 쓰였다.
    //   아주 조금만 넣어도 색이 진하게 난다.
    bio: "유리를 파랗게 물들이는 가루를 지고 다닌다. 아주 조금만 넣어도 온통 새파래져서, 늘 손끝이 물들어 있다. 값을 깎아 달라는 말에는 절대 넘어가지 않는다.",
    quote: "이만큼이면 항아리 하나가 통째로 파래져. 더 달라고 하지 마.",
    bonds: ["ni", "fe", "ag"],
    colors: { main: 0x2b3a6b, sub: 0x1a1f33, accent: 0xc0392b, hair: 0x3d6fc4 },
  },
  {
    id: "ni", z: 28, sym: "Ni", ko: "니켈", en: "Nickel",
    family: FAMILY.TRANSITION, combat: COMBAT.STRIKER, silhouette: "armored",
    mass: 58.7, electroneg: 1.91, melt: 1455, boil: 2913,
    faction: "legion", role: "겉을 씌워 주는 도금장이",
    // 근거 A — 니켈 도금. 얇게 씌우면 안쪽 쇠가 녹슬지 않는다.
    //   자기가 대신 앞에 선다는 뜻이라 방패꾼 같은 성격이 나온다.
    bio: "남의 겉에 얇은 옷을 입혀 준다. 그 옷 한 겹이면 안쪽이 오래도록 녹슬지 않는다. 정작 자기 몸은 늘 긁혀 있는데 개의치 않는다.",
    quote: "긁히는 건 내 쪽이면 돼. 너는 안에서 멀쩡하면 되고.",
    bonds: ["co", "fe", "cu"],
    colors: { main: 0x2e5c46, sub: 0x1a2b22, accent: 0x9fb8a8, hair: 0x4a9e78 },
  },
  {
    id: "mn", z: 25, sym: "Mn", ko: "망가니즈", en: "Manganese",
    family: FAMILY.TRANSITION, combat: COMBAT.STRIKER, silhouette: "armored",
    mass: 54.9, electroneg: 1.55, melt: 1246, boil: 2062,
    faction: "legion", role: "부러지지 않는 무기를 만드는 무기장이",
    // 근거 A — 망가니즈강. 철에 넣으면 충격을 받아도 부러지지 않고 버틴다.
    //   철길과 굴착기 이빨에 쓰인다.
    bio: "때려도 깨지지 않는 연장을 만든다. 쇳물에 한 줌 넣으면 그때부터 아무리 두들겨도 부러지지 않는다. 자기가 만든 것이 부러졌다는 말을 제일 싫어한다.",
    quote: "부러졌다고? 그건 내가 만든 게 아니야.",
    bonds: ["fe", "cu", "mg"],
    colors: { main: 0x8b2f3a, sub: 0x3a1a1e, accent: 0xd9a441, hair: 0x6b2028 },
  },
  {
    id: "ti", z: 22, sym: "Ti", ko: "타이타늄", en: "Titanium",
    family: FAMILY.TRANSITION, combat: COMBAT.STRIKER, silhouette: "armored",
    mass: 47.9, electroneg: 1.54, melt: 1668, boil: 3289,
    faction: "legion", role: "부러진 뼈를 잇는 접골사",
    // 근거 A — 몸이 이물질로 여기지 않아 인공 관절과 임플란트에 쓴다.
    //   '거부당하지 않음'을 직업으로 옮겼다.
    bio: "부러진 것을 이어 붙인다. 몸속에 들어가도 탈이 나지 않는 드문 금속이라, 사람 뼈에 박혀 평생 함께 지내기도 한다. 말수가 적고 한번 맡은 것은 끝까지 놓지 않는다.",
    quote: "붙였으면 끝까지 붙어 있어야지.",
    bonds: ["mo", "cu", "w"],
    colors: { main: 0xd8d2c4, sub: 0x4a4640, accent: 0xe8b84b, hair: 0xf0e6d2 },
  },
  {
    id: "sc", z: 21, sym: "Sc", ko: "스칸듐", en: "Scandium",
    family: FAMILY.TRANSITION, combat: COMBAT.STRIKER, silhouette: "civilian",
    mass: 45.0, electroneg: 1.36, melt: 1539, boil: 2831,
    faction: "legion", role: "빈자리를 지키는 문지기",
    // 근거 D — 멘델레예프가 주기율표에 빈칸을 남기며 성질까지 예언했고,
    //   한참 뒤 실제로 발견됐다. 119번인 플레이어와 곧장 이어지는 서사다.
    bio: "아직 오지 않은 이의 자리를 대신 지킨다. 옛날 어떤 학자가 표에 빈칸을 남기며 '여기 이런 것이 올 것이다'라고 적었는데, 한참 뒤에 정말 나타난 것이 자신이다.",
    quote: "네 자리도 어딘가에 비어 있을 거야. 아직 아무도 안 채웠을 뿐이지.",
    bonds: ["v", "al", "ti"],
    colors: { main: 0xe8e4d8, sub: 0x2c3e50, accent: 0xc9a227, hair: 0x8a9099 },
  },

  // ---------------- 귀금속 귀족 ----------------
  {
    id: "pt", z: 78, sym: "Pt", ko: "백금", en: "Platinum",
    family: FAMILY.PRECIOUS, combat: COMBAT.STRIKER, silhouette: "noble",
    mass: 195.1, electroneg: 2.28, melt: 1769, boil: 3827,
    faction: "noblesse", role: "왕수로만 열리는 금고를 지키는 문지기",
    // 근거 C — 백금은 웬만한 산에 녹지 않고 왕수(질산+염산)에만 녹는다.
    bio: "아무나 못 여는 금고를 지킨다. 어떤 산을 부어도 꿈쩍 않고, 딱 한 가지 물약에만 문이 열린다. 그 조합을 아는 사람은 자기뿐이라고 믿는다.",
    quote: "그걸로는 안 열려. 다른 걸 가져와도 마찬가지고.",
    bonds: ["ir", "au", "as"],
    colors: { main: 0xe8e8ec, sub: 0x3c3f4a, accent: 0xb8bcc8, hair: 0xf2f2f5 },
  },
  {
    id: "au", z: 79, sym: "Au", ko: "금", en: "Gold",
    family: FAMILY.PRECIOUS, combat: COMBAT.STRIKER, silhouette: "noble",
    mass: 197.0, electroneg: 2.54, melt: 1064, boil: 2857,
    faction: "noblesse", role: "녹슬지 않는 갑주를 두른 늙은 기사",
    // 근거 C — 금은 산소와 반응하지 않아 수천 년이 지나도 그대로 반짝인다.
    //   무덤에서 나온 금붙이가 아직 빛나는 것이 그래서다.
    bio: "수천 년째 같은 갑옷을 입고 서 있다. 비를 맞아도 흙에 묻혀도 색이 변하지 않아, 옛 임금의 무덤에서 나올 때도 그대로 빛났다. 변하는 것들을 조금 딱하게 여긴다.",
    quote: "천 년쯤 지나 봐. 그때도 나는 이 색이야.",
    bonds: ["ag", "cu"],
    colors: { main: 0xd9a441, sub: 0x6b4a12, accent: 0xf5d98a, hair: 0xf0d060 },
  },
  {
    id: "ag", z: 47, sym: "Ag", ko: "은", en: "Silver",
    family: FAMILY.PRECIOUS, combat: COMBAT.STRIKER, silhouette: "noble",
    mass: 107.8, electroneg: 1.93, melt: 962, boil: 2162,
    faction: "noblesse", role: "가장 빠른 길을 놓는 전선공",
    // 근거 A — 은의 전기전도도는 모든 원소 중 1위이고 구리가 2위다.
    //   너무 비싸 실제 배선은 대개 구리를 쓴다.
    bio: "전기가 지나갈 길을 놓는다. 세상 무엇보다 빠르게 흘려보낼 수 있는데, 값이 비싸 사람들은 대개 구리에게 맡긴다. 그 사실을 알면서 아무 말 하지 않는다.",
    quote: "제일 빠른 길을 알아. 다들 안 쓸 뿐이지.",
    bonds: ["au", "cu", "s"],
    colors: { main: 0xdfe3e8, sub: 0x4a5058, accent: 0xa8b2bd, hair: 0xeef1f4 },
  },
  {
    id: "cu", z: 29, sym: "Cu", ko: "구리", en: "Copper",
    family: FAMILY.PRECIOUS, combat: COMBAT.STRIKER, silhouette: "noble",
    mass: 63.5, electroneg: 1.90, melt: 1085, boil: 2562,
    faction: "noblesse", role: "마을 구석구석에 선을 까는 배선공",
    // 근거 A — 전도도 2위지만 값이 싸서 세상 거의 모든 전선이 구리다.
    bio: "집집마다 전깃줄을 잇는다. 은보다 아주 조금 느리지만 값이 눅어서, 세상 전선은 거의 다 이 사람 손을 거쳤다. 일등이 아닌 것을 서운해하지 않는다.",
    quote: "일등은 은이야. 근데 네 집 전선은 내가 깔았지.",
    bonds: ["sn", "zn", "ni"],
    colors: { main: 0xb87333, sub: 0x5c3a1a, accent: 0x4aa89a, hair: 0xd98c4a },
  },

  // ---------------- 귀족 기체 ----------------
  {
    id: "ne", z: 10, sym: "Ne", ko: "네온", en: "Neon",
    family: FAMILY.NOBLE, combat: COMBAT.CASTER, silhouette: "floating",
    mass: 20.2, electroneg: null, melt: -249, boil: -246,
    faction: "noble_gas", role: "밤에만 문 여는 간판집 주인",
    // 근거 A — 네온사인. 유리관에 넣고 전기를 흘리면 붉은 주황빛이 난다.
    bio: "밤거리를 밝히는 간판을 만든다. 유리관에 갇혀 전기를 맞으면 붉은빛을 내는데, 그 일 말고는 아무것과도 어울리지 않는다. 낮에는 가게 문을 닫는다.",
    quote: "밤에 와. 낮엔 나 아무것도 아니야.",
    bonds: ["he"],
    colors: { main: 0xe8506b, sub: 0x4a1a28, accent: 0xf5a0b4, hair: 0xc060d0 },
  },
  {
    id: "ar", z: 18, sym: "Ar", ko: "아르곤", en: "Argon",
    family: FAMILY.NOBLE, combat: COMBAT.CASTER, silhouette: "floating",
    mass: 39.9, electroneg: null, melt: -189, boil: -186,
    faction: "noble_gas", role: "쇳물이 상하지 않게 지키는 파수꾼",
    // 근거 A — 용접할 때 아르곤을 불어넣어 산소를 밀어낸다.
    //   자기가 아무 일도 안 하는 것이 곧 하는 일이다.
    bio: "대장간에서 쇳물 위를 덮고 서 있다. 아무 일도 하지 않는 것이 이 사람의 일이라, 그가 서 있으면 공기가 쇠를 갉아먹지 못한다. 하루 종일 가만히 있는 것을 지루해하지 않는다.",
    quote: "내가 뭘 하냐고? 아무것도 안 해. 그게 일이야.",
    bonds: ["k", "n", "he"],
    colors: { main: 0xa89ad8, sub: 0x3a3358, accent: 0xd8d0f0, hair: 0xc4b8e8 },
  },
  {
    id: "rn", z: 86, sym: "Rn", ko: "라돈", en: "Radon",
    family: FAMILY.NOBLE, combat: COMBAT.CASTER, silhouette: "floating",
    mass: 222, electroneg: null, melt: -71, boil: -62,
    faction: "exiled", role: "땅에서 새는 것을 재고 다니는 측량꾼",
    // 근거 E — 우라늄이 무너지며 나오는 기체라 화강암 지대 지하실에 고인다.
    bio: "바위 틈에서 소리 없이 올라오는 것을 재고 다닌다. 눈에 보이지도 냄새가 나지도 않아 재지 않으면 거기 있는 줄 아무도 모른다. 오래 곁에 두면 안 된다고 늘 먼저 말한다.",
    quote: "창문 좀 열어 둘래? …나 때문이야. 미안.",
    bonds: ["ra", "th", "ac"],
    colors: { main: 0x8a4a6b, sub: 0x2e1a28, accent: 0xd88ab0, hair: 0xb06888 },
  },

  // ---------------- 결원단 (할로겐) ----------------
  {
    id: "cl", z: 17, sym: "Cl", ko: "염소", en: "Chlorine",
    family: FAMILY.HALOGEN, combat: COMBAT.HYBRID, silhouette: "sharp",
    mass: 35.4, electroneg: 3.16, melt: -101, boil: -34,
    faction: "affinity", role: "물을 갈아엎는 소독꾼",
    // 근거 A — 수돗물 소독. 아주 적은 양으로 물속 것들을 죽인다.
    //   한 자리가 모자라 뭐든 빼앗으려 드는 성질이 그대로 쓰인다.
    bio: "우물과 물길에 약을 풀어 물을 깨끗하게 만든다. 한 방울이면 물속 것들이 남김없이 사라져서, 사람들은 고마워하면서도 가까이 서지는 않는다. 자기한테 딱 하나가 모자란다는 생각을 늘 한다.",
    quote: "하나만 더 있으면 되는데. 딱 하나만.",
    bonds: ["ar", "na", "f"],
    colors: { main: 0x3a4a2c, sub: 0x1a2014, accent: 0xa8d145, hair: 0x2a2e28 },
  },
  {
    id: "br", z: 35, sym: "Br", ko: "브로민", en: "Bromine",
    family: FAMILY.HALOGEN, combat: COMBAT.STRIKER, silhouette: "sharp",
    mass: 79.9, electroneg: 2.96, melt: -7, boil: 59,
    faction: "affinity", role: "빛을 붙잡아 두는 사진사",
    // 근거 A — 브로민화은. 빛이 닿은 자리만 검게 변해 필름과 인화지에 쓴다.
    exception: "브로민은 비금속인데 무기형으로 두었다. 사진사라 약을 바른 판을 직접 들이대기 때문이다. 실제 브로민은 액체 비금속이라 전자를 빼앗는 쪽이 본래 성질이다.",
    bio: "지나가는 순간을 종이에 붙잡아 둔다. 빛이 닿은 자리만 검게 남는 약을 발라, 한 번 찍힌 것은 되돌릴 수 없다. 남의 사정을 봐주지 않고 다 찍는다.",
    quote: "이미 찍혔어. 지워 달라고 해도 소용없고.",
    bonds: ["cl", "ag", "k"],
    colors: { main: 0x6b4a2a, sub: 0x2e2014, accent: 0xc48a4a, hair: 0xa8874a },
  },

  // ---------------- 추방된 방사성 원소 ----------------
  {
    id: "u", z: 92, sym: "U", ko: "우라늄", en: "Uranium",
    family: FAMILY.RADIOACTIVE, combat: COMBAT.CASTER, silhouette: "glowing",
    mass: 238.0, electroneg: 1.38, melt: 1132, boil: 4172,
    faction: "exiled", role: "제 몸을 태워 물을 끓이는 화부",
    // 근거 A — 원자로 연료. 스스로 무너지며 내는 열로 물을 끓여 전기를 만든다.
    bio: "가만히 있어도 몸에서 열이 난다. 그 열로 물을 끓여 마을에 불을 밝히는데, 그러는 동안 자기 몸은 조금씩 줄어든다. 언제까지 버틸지 세어 본 적이 있다.",
    quote: "이 정도 열이면 마을 전체가 밝아져. 내가 좀 줄어들 뿐이고.",
    bonds: ["f", "es"],
    colors: { main: 0x2e5c3a, sub: 0x14261a, accent: 0x6ee85a, hair: 0x1e3326 },
  },
  {
    id: "po", z: 84, sym: "Po", ko: "폴로늄", en: "Polonium",
    family: FAMILY.RADIOACTIVE, combat: COMBAT.HYBRID, silhouette: "glowing",
    mass: 209, electroneg: 2.00, melt: 254, boil: 962,
    faction: "exiled", role: "한순간에 다 태우는 폭파공",
    // 근거 C — 폴로늄은 아주 짧은 동안 엄청난 열을 낸다. 반감기가 짧아
    //   금세 사그라든다. 최종 보스의 조급함이 여기서 나온다.
    bio: "한 번에 모든 것을 태워 버리는 일을 한다. 오래 못 가는 몸이라 늘 서두르고, 아껴 쓰는 법을 모른다. 천천히 하라는 말을 제일 싫어한다.",
    quote: "천천히? 나한테 그럴 시간이 어디 있어.",
    bonds: ["be", "u", "cm"],
    colors: { main: 0x3a3a6b, sub: 0x1a1a33, accent: 0x8ab4f0, hair: 0x6a5ac4 },
  },
  {
    id: "tc", z: 43, sym: "Tc", ko: "테크네튬", en: "Technetium",
    family: FAMILY.RADIOACTIVE, combat: COMBAT.CASTER, silhouette: "glowing",
    mass: 98, electroneg: 1.90, melt: 2157, boil: 4265,
    faction: "exiled", role: "몸속을 비춰 보는 떠돌이 의원",
    // 근거 A — 테크네튬은 뼈와 장기를 찍는 진단에 쓰인다.
    //   안정한 동위원소가 없어 자연에는 사실상 없고 사람이 만든다.
    bio: "몸 안을 들여다보는 약을 지어 다닌다. 그 약을 삼키면 뼈 속까지 훤히 보이는데, 정작 자기 자신은 이 세상에 자연히 있는 몸이 아니다.",
    quote: "나는 원래 없던 사람이야. 누가 만들어 낸 거지.",
    bonds: ["mo", "u"],
    colors: { main: 0x3e3648, sub: 0x1c1822, accent: 0xc8b8d8, hair: 0xd8d0e0 },
  },
  {
    id: "es", z: 99, sym: "Es", ko: "아인슈타이늄", en: "Einsteinium",
    family: FAMILY.RADIOACTIVE, combat: COMBAT.CASTER, silhouette: "glowing",
    mass: 252, electroneg: 1.3, melt: 860, boil: null,
    faction: "exiled", role: "잿더미에서 찾아낸 이름 없는 학자",
    // 근거 D — 수소폭탄 실험 잔해에서 발견됐다. 만들자마자 무너져
    //   덩어리로 모아 본 사람이 거의 없다.
    bio: "폭발이 지나간 잿더미에서 처음 발견됐다. 만들어지자마자 무너지기 시작해서, 한 줌으로 모아 본 사람이 손에 꼽는다. 자기 이야기를 할 때 늘 남 일처럼 말한다.",
    quote: "나를 봤다는 사람이 몇 없어. 오래 못 있거든.",
    bonds: ["fm", "u"],
    colors: { main: 0x2a5a7a, sub: 0x142a3a, accent: 0x6ac8e8, hair: 0x3a5a8a },
  },

  // ---------------- 중립 학자·주민 ----------------
  {
    id: "c", z: 6, sym: "C", ko: "탄소", en: "Carbon",
    family: FAMILY.NONMETAL, combat: COMBAT.CASTER, silhouette: "civilian",
    mass: 12.0, electroneg: 2.55, melt: 3550, boil: 4827,
    faction: "neutral", role: "천 갈래 실을 엮는 늙은 직조공",
    // 근거 B — 탄소는 손이 넷이라 자기들끼리 사슬로 이어진다.
    //   생물의 몸이 전부 이 뼈대 위에 세워진다.
    bio: "손이 넷이라 이쪽저쪽을 한꺼번에 붙든다. 그 손으로 엮은 사슬 위에 풀도 짐승도 사람도 세워졌다. 자기가 없으면 아무것도 못 산다는 말을 굳이 하지 않는다.",
    quote: "손이 넷이면 할 수 있는 게 많아. 그것뿐이야.",
    bonds: ["si", "o", "pb"],
    colors: { main: 0x2c2c30, sub: 0x16161a, accent: 0x3a5a3a, hair: 0x1a1a1e },
  },
  {
    id: "si", z: 14, sym: "Si", ko: "규소", en: "Silicon",
    family: FAMILY.METALLOID, combat: COMBAT.HYBRID, silhouette: "robed",
    mass: 28.1, electroneg: 1.90, melt: 1412, boil: 3266,
    faction: "neutral", role: "신호를 열었다 닫는 문지기",
    // 근거 A — 반도체. 평소엔 막고 필요할 때만 통하게 할 수 있다.
    //   이 게임이 도는 컴퓨터도 규소로 만들었다.
    bio: "길목에 서서 신호를 통과시킬지 막을지 정한다. 아주 잘 통하지도, 아주 잘 막지도 않는 어중간함 덕에 그 일을 할 수 있다. 묻는 말에 늘 조건을 붙여 대답한다.",
    quote: "통과시킬 수도 있지. 조건이 맞으면.",
    bonds: ["c", "o", "h"],
    colors: { main: 0xc4a8d8, sub: 0x4a3a58, accent: 0xe8d8f0, hair: 0xd8b8e8 },
  },
  {
    id: "n", z: 7, sym: "N", ko: "질소", en: "Nitrogen",
    family: FAMILY.NONMETAL, combat: COMBAT.CASTER, silhouette: "robed",
    mass: 14.0, electroneg: 3.04, melt: -210, boil: -196,
    faction: "neutral", role: "공기의 대부분을 차지한 게으른 지주",
    // 근거 E — 공기의 78%가 질소인데 좀처럼 반응하지 않는다.
    //   붙잡아 쓰려면 큰 힘이 든다(암모니아 합성).
    bio: "하늘의 대부분이 이 사람 땅이다. 그렇게 넓게 깔려 있으면서 좀처럼 움직이지 않아, 끌어다 쓰려면 어마어마한 열과 힘이 든다. 서두르는 법이 없다.",
    quote: "급할 거 없잖아. 나는 어디 안 가.",
    bonds: ["c", "o", "h"],
    colors: { main: 0x2a3050, sub: 0x14182a, accent: 0x6a78b8, hair: 0x1e2238 },
  },
  {
    id: "o", z: 8, sym: "O", ko: "산소", en: "Oxygen",
    family: FAMILY.NONMETAL, combat: COMBAT.CASTER, silhouette: "robed",
    mass: 16.0, electroneg: 3.44, melt: -218, boil: -183,
    faction: "neutral", role: "숨을 나눠 주는 물장수",
    // 근거 E — 공기의 5분의 1, 물의 무게 대부분, 지각에서 가장 흔한 원소.
    bio: "가는 곳마다 숨을 나눠 준다. 공기에도 물에도 땅에도 들어 있어서 어디에나 있는데, 정작 눈에는 안 보인다. 없어져 봐야 안다며 가끔 서운해한다.",
    quote: "내가 없어지면 그때 알겠지. 그전엔 아무도 몰라.",
    bonds: ["h", "c", "n"],
    colors: { main: 0xf0e6d2, sub: 0xb0304a, accent: 0xd9a441, hair: 0xe8c86a },
  },
  {
    id: "p", z: 15, sym: "P", ko: "인", en: "Phosphorus",
    family: FAMILY.NONMETAL, combat: COMBAT.CASTER, silhouette: "civilian",
    mass: 31.0, electroneg: 2.19, melt: 44, boil: 281,
    faction: "neutral", role: "밤새 불을 지키는 등지기",
    // 근거 E — 백린은 공기에 닿으면 저절로 탄다. 동시에 인은 뼈와
    //   DNA의 뼈대이기도 하다. 불과 뼈라는 정반대 두 얼굴이 핵심이다.
    bio: "밤새 꺼지지 않게 불을 지킨다. 손끝이 저절로 달아올라 마른 데 오래 두면 스스로 붙어 버린다. 그러면서 정작 자기 몸의 대부분은 남들 뼈 속에 조용히 들어가 있다.",
    quote: "불은 내가 볼게. 너는 자.",
    bonds: ["n", "ca", "o"],
    colors: { main: 0x8a2e3a, sub: 0x2e1218, accent: 0xf0d060, hair: 0xc4503a },
  },
  {
    id: "s", z: 16, sym: "S", ko: "황", en: "Sulfur",
    family: FAMILY.NONMETAL, combat: COMBAT.CASTER, silhouette: "robed",
    mass: 32.1, electroneg: 2.58, melt: 113, boil: 445,
    faction: "neutral", role: "땅 밑에서 김을 뿜는 늙은 용",
    // 근거 E — 화산과 온천에서 나온다. 노란 결정과 썩은 냄새.
    bio: "화산 아래 굴에 산다. 숨을 쉴 때마다 노란 김이 올라오고 고약한 냄새가 나서, 사람들이 굴 근처에는 얼씬도 하지 않는다. 그 조용함을 마음에 들어 한다.",
    quote: "냄새난다고? 덕분에 조용하잖아.",
    bonds: ["fe", "ag", "hg"],
    colors: { main: 0xd9b641, sub: 0x5c4a12, accent: 0x2a6a8a, hair: 0xf0d878 },
  },
  {
    id: "ca", z: 20, sym: "Ca", ko: "칼슘", en: "Calcium",
    family: FAMILY.ALKALINE, combat: COMBAT.STRIKER, silhouette: "civilian",
    mass: 40.1, electroneg: 1.00, melt: 842, boil: 1503,
    faction: "neutral", role: "마을의 뼈대를 세운 촌장",
    // 근거 E — 뼈와 조개껍데기, 석회암을 이룬다. 대륙의 뼈대라는 말이 실제다.
    bio: "이 마을의 뼈대를 세운 사람이다. 사람 뼈도 조개껍데기도 이 마을 절벽도 다 같은 것으로 되어 있어서, 어디를 딛든 자기 몸을 밟는 기분이라고 한다. 몸이 자유롭지 못해 늘 앉아 있다.",
    quote: "이 땅도 내 뼈고 네 뼈도 내 것이지. 그러니 조심해서 걷게.",
    bonds: ["sr", "ba", "p"],
    colors: { main: 0xe8e0cc, sub: 0x6b5a3a, accent: 0xc9a227, hair: 0xf0e8d8 },
  },
  {
    id: "mg", z: 12, sym: "Mg", ko: "마그네슘", en: "Magnesium",
    family: FAMILY.ALKALINE, combat: COMBAT.CASTER, silhouette: "robed",
    mass: 24.3, electroneg: 1.31, melt: 650, boil: 1095,
    faction: "neutral", role: "잎을 푸르게 하는 숲의 주인",
    // 근거 E — 엽록소 한가운데 마그네슘이 앉아 있다. 잎이 푸른 것이 그래서다.
    exception: "마그네슘은 금속이지만 마법형으로 두었다. 실제로 이 원소는 잎 한가운데 앉아 빛을 받아들이는 일을 한다 — 때리는 것보다 그쪽이 이 원소답다.",
    bio: "숲의 모든 잎 한가운데 앉아 있다. 그 자리에서 볕을 받아들이면 잎이 푸르러지고, 그 덕에 숲이 숨을 쉰다. 늘 졸고 있어서 말을 걸어도 대답이 늦다.",
    quote: "…음냐… 잎이 푸르지? 내가 앉아 있어서 그래….",
    bonds: ["al", "be", "mn"],
    colors: { main: 0xe8e4d0, sub: 0x4a5c3a, accent: 0x8ac46a, hair: 0xd8d4c0 },
  },
  {
    id: "be", z: 4, sym: "Be", ko: "베릴륨", en: "Beryllium",
    family: FAMILY.ALKALINE, combat: COMBAT.CASTER, silhouette: "civilian",
    mass: 9.0, electroneg: 1.57, melt: 1287, boil: 2472,
    faction: "neutral", role: "속이 비쳐 보이는 창을 만드는 유리장이",
    // 근거 A — 베릴륨은 X선을 그대로 통과시켜 관측 장비의 창에 쓴다.
    exception: "베릴륨도 금속이지만 마법형으로 두었다. 실제로 이 원소는 빛을 막지 않고 그대로 통과시킨다. 그 '지나가게 하는' 성질을 주문으로 옮겼다.",
    bio: "안이 훤히 비치는 창을 만든다. 다른 것들은 다 가로막는 빛도 이 창만은 그냥 지나가서, 속을 들여다봐야 하는 기계마다 이 창이 달려 있다.",
    quote: "막으라고 만든 게 아니야. 지나가라고 만든 거지.",
    bonds: ["mg", "al", "cu"],
    colors: { main: 0x2a4a3e, sub: 0x14261e, accent: 0x6ac4a8, hair: 0x4a9e88 },
  },
  {
    id: "zn", z: 30, sym: "Zn", ko: "아연", en: "Zinc",
    family: FAMILY.TRANSITION, combat: COMBAT.STRIKER, silhouette: "civilian",
    mass: 65.4, electroneg: 1.65, melt: 420, boil: 907,
    faction: "neutral", role: "남 대신 녹슬어 주는 도장공",
    // 근거 A — 아연 도금. 철 대신 자기가 먼저 녹슬어 철을 지킨다.
    bio: "쇠에 덧칠을 해 주는 일을 한다. 그 덧칠은 쇠를 덮는 것이 아니라, 쇠 대신 자기가 먼저 삭아 없어지는 것이다. 그걸 손해라고 생각하지 않는다.",
    quote: "내가 먼저 삭아야 저게 안 삭아. 그러라고 칠하는 거고.",
    bonds: ["bi", "cu", "fe"],
    colors: { main: 0x2a3448, sub: 0x161c26, accent: 0xd8d4c8, hair: 0xe8e0cc },
  },
  {
    id: "bi", z: 83, sym: "Bi", ko: "비스무트", en: "Bismuth",
    family: FAMILY.POST_TRANSITION, combat: COMBAT.HYBRID, silhouette: "noble",
    mass: 209.0, electroneg: 2.02, melt: 271, boil: 1561,
    faction: "neutral", role: "무지개 계단을 쌓는 석공",
    // 근거 B — 비스무트 결정은 네모난 계단 모양으로 자라고
    //   표면 산화막이 무지개빛으로 빛난다.
    bio: "네모난 계단이 저절로 자라는 돌을 다룬다. 굳을 때 안쪽부터 층층이 쌓여 계단이 되고, 겉면에 무지개가 뜬다. 부끄러움이 많아 남이 쳐다보면 말을 잃는다.",
    quote: "…저기, 내 얼굴에 뭐 묻었니…?",
    bonds: ["zn", "pb", "sn"],
    colors: { main: 0xe8e8ec, sub: 0x3a4050, accent: 0x8a6ac4, hair: 0xd8d0c0 },
  },
  {
    id: "hg", z: 80, sym: "Hg", ko: "수은", en: "Mercury",
    family: FAMILY.TRANSITION, combat: COMBAT.CASTER, silhouette: "noble",
    mass: 200.6, electroneg: 2.00, melt: -39, boil: 357,
    faction: "neutral", role: "형태가 없어 붙잡히지 않는 도둑",
    // 근거 B — 상온에서 액체인 유일한 금속. 영하 38.8도에야 굳는다.
    exception: "수은은 금속인데 마법형으로 두었다. 상온에서 액체인 유일한 금속이라 형태가 고정되지 않고, 그래서 무기를 벼려 쥘 수가 없다.",
    bio: "손에 쥐면 손가락 사이로 흘러 달아난다. 한겨울 바깥보다 더 추워야 굳는 몸이라 늘 흐물거리는데, 그래서 아직 한 번도 잡힌 적이 없다.",
    quote: "잡아 봐. 손가락 사이로 새어 나갈 테니까.",
    bonds: ["pb", "c", "s"],
    colors: { main: 0x1e1e24, sub: 0x8a1a2a, accent: 0xc8ccd8, hair: 0xe8d878 },
  },
  {
    id: "pb", z: 82, sym: "Pb", ko: "납", en: "Lead",
    family: FAMILY.POST_TRANSITION, combat: COMBAT.HYBRID, silhouette: "noble",
    mass: 207.2, electroneg: 2.33, melt: 328, boil: 1750,
    faction: "neutral", role: "보이지 않는 것을 막는 벽 짓는 이",
    // 근거 B — 밀도가 커서 방사선을 막는다. 그 자체는 몸에 해롭다.
    bio: "지나가면 안 되는 것을 막는 벽을 세운다. 무겁고 촘촘해서 눈에 보이지 않는 것까지 걸러낸다. 제 몸이 남에게 해롭다는 걸 알아 늘 혼자 일한다.",
    quote: "가까이 오지 마. 나는 여기 서 있는 걸로 충분해.",
    bonds: ["sn", "bi", "zn"],
    colors: { main: 0x4a4458, sub: 0x22202c, accent: 0xd8d0e0, hair: 0xe8e4d8 },
  },
  {
    id: "as", z: 33, sym: "As", ko: "비소", en: "Arsenic",
    family: FAMILY.METALLOID, combat: COMBAT.CASTER, silhouette: "sharp",
    mass: 74.9, electroneg: 2.18, melt: 817, boil: 603,
    faction: "neutral", role: "연기로 사라지는 도망꾼",
    // 근거 B — 비소는 끓는점이 녹는점보다 낮다. 물렁해지기 전에
    //   곧장 연기가 되어 날아간다.
    exception: "비소는 준금속인데 하이브리드가 아니다. 붙잡으려 하면 연기가 되어 흩어지는 쪽으로 밀었기 때문이다. 실제로 비소는 녹기 전에 곧장 기체가 된다.",
    bio: "붙잡으려 하면 연기가 되어 사라진다. 다른 것들은 뜨거워지면 물렁해지는데 이 사람만은 곧장 김으로 흩어져서, 아직 아무도 손에 쥐어 본 적이 없다.",
    quote: "잡았다고? 손 펴 봐. 아무것도 없을걸.",
    bonds: ["ga", "hg", "tl"],
    colors: { main: 0x3a4028, sub: 0x1a1e12, accent: 0xd8c84a, hair: 0x2a2a2e },
  },
  {
    id: "sb", z: 51, sym: "Sb", ko: "안티모니", en: "Antimony",
    family: FAMILY.METALLOID, combat: COMBAT.HYBRID, silhouette: "robed",
    mass: 121.8, electroneg: 2.05, melt: 631, boil: 1587,
    faction: "neutral", role: "글자를 부어 만드는 활자장이",
    // 근거 A — 안티모니는 굳을 때 부피가 늘어나는 드문 금속이라
    //   활자 합금에 넣는다. 그래서 획이 뭉개지지 않는다.
    bio: "쇳물을 틀에 부어 글자를 만든다. 남들 쇳물은 식으면서 쪼그라드는데 이 사람 것은 오히려 부풀어서, 틀 구석까지 획이 꽉 찬다. 그 차이를 아주 자랑스러워한다.",
    quote: "식으면서 줄어들면 글자가 안 돼. 나는 반대로 하거든.",
    bonds: ["s", "pb", "sn"],
    colors: { main: 0xf0ece0, sub: 0x2a2438, accent: 0xc9a227, hair: 0x4a3a58 },
  },
  {
    id: "nb", z: 41, sym: "Nb", ko: "나이오븀", en: "Niobium",
    family: FAMILY.TRANSITION, combat: COMBAT.STRIKER, silhouette: "civilian",
    mass: 92.9, electroneg: 1.60, melt: 2468, boil: 4742,
    faction: "neutral", role: "아주 차게 식히면 저항이 사라지는 냉각공",
    // 근거 B — 나이오븀-타이타늄 합금은 초전도 자석 재료다.
    //   탄탈럼과 같은 광석에서 함께 나와 분리가 극히 어렵다.
    bio: "쇠를 아주 차갑게 식히는 일을 한다. 어느 선을 넘어가면 전기가 지나가며 걸리는 것이 통째로 사라진다. 탄탈럼과 같은 돌에서 나와 늘 붙어 다닌다.",
    quote: "충분히 식으면 걸리는 게 하나도 없어져. 믿기지 않지?",
    bonds: ["ta", "sn", "w"],
    colors: { main: 0xe8e0d0, sub: 0x4a4038, accent: 0x8a7a5a, hair: 0xc4a878 },
  },
  {
    id: "ta", z: 73, sym: "Ta", ko: "탄탈럼", en: "Tantalum",
    family: FAMILY.TRANSITION, combat: COMBAT.STRIKER, silhouette: "civilian",
    mass: 180.9, electroneg: 1.50, melt: 2985, boil: 5510,
    faction: "neutral", role: "어떤 산에도 녹지 않는 그릇장이",
    // 근거 C — 탄탈럼은 웬만한 산에 녹지 않아 화학 장비와 몸속 이식물에 쓴다.
    bio: "무엇을 담아도 삭지 않는 그릇을 만든다. 쇠를 녹이는 물을 부어도 멀쩡해서, 위험한 것을 다루는 사람들이 이 그릇만 찾는다. 나이오븀과 늘 함께 나온다.",
    quote: "부어 봐. 아무렇지도 않을 테니까.",
    bonds: ["nb", "w"],
    colors: { main: 0x3a3038, sub: 0x1a161c, accent: 0xa89a8a, hair: 0xd8d0c8 },
  },

  // ---------------- 초중원소 ----------------
  {
    id: "og", z: 118, sym: "Og", ko: "오가네손", en: "Oganesson",
    family: FAMILY.NOBLE, combat: COMBAT.CASTER, silhouette: "floating",
    mass: 294, electroneg: null, melt: null, boil: null,
    faction: "superheavy", role: "안정의 섬을 찾아 떠나는 항해사",
    // 근거 D — 118번. 더 무거운 원소 중에 오래 버티는 것이 있으리라는
    //   '안정의 섬' 예측은 실제 핵물리학 가설이다.
    bio: "아무도 가 본 적 없는 바다로 배를 몬다. 자기보다 무거운 것들은 만들자마자 부서지는데, 그 너머 어딘가에 부서지지 않는 섬이 있다고 믿는다. 그 풍경을 그려 오겠다고 했다.",
    quote: "섬에 닿으면 그 풍경을 그려 올게. 멋질 거야.",
    bonds: ["fl", "cf", "ca"],
    colors: { main: 0x2a3a5c, sub: 0x141c2e, accent: 0xd8c88a, hair: 0x8a9ab8 },
  },
  {
    id: "nh", z: 113, sym: "Nh", ko: "니호늄", en: "Nihonium",
    family: FAMILY.UNKNOWN, combat: COMBAT.HYBRID, silhouette: "civilian",
    mass: 286, electroneg: null, melt: null, boil: null,
    faction: "superheavy", role: "눈 깜빡할 새에 사라지는 나그네",
    // 근거 D — 113번. 만들어진 개수가 손에 꼽고 순식간에 무너진다.
    bio: "잠깐 나타났다가 곧 사라진다. 여태 만들어진 것이 몇 개 되지 않고 그마저 눈 깜빡할 새에 무너져서, 만나 본 사람이 거의 없다. 짧게 있다 가는 것을 슬퍼하지 않는다.",
    quote: "처음 만난 순간 인연을 느꼈어. 다시 만날 거야.",
    bonds: ["zn", "bi"],
    colors: { main: 0x8a2a3a, sub: 0x2e1218, accent: 0xf0e0d0, hair: 0x2a2428 },
  },
  {
    id: "k", z: 19, sym: "K", ko: "포타슘", en: "Potassium",
    family: FAMILY.ALKALI, combat: COMBAT.STRIKER, silhouette: "bulky",
    mass: 39.1, electroneg: 0.82, melt: 63.5, boil: 759,
    faction: "neutral", role: "밭에 거름을 주는 늙은 농부",
    // 근거 A — 칼륨은 비료 3대 요소의 하나다. 동시에 물에 넣으면
    //   녹아 퍼지며 격렬하게 타올라 보라색 불꽃을 낸다.
    bio: "밭에 거름을 뿌려 곡식을 살찌운다. 그런데 물가에는 절대 가지 않는다 — 물에 닿으면 몸이 녹아 퍼지면서 보라색 불꽃을 내며 타오르기 때문이다.",
    quote: "밭에는 내가 필요해. 근데 물가엔 데려가지 마.",
    bonds: ["na", "ar", "cl"],
    colors: { main: 0xc8c4b4, sub: 0x9a9686, accent: 0xb87ad4, hair: 0xd8d4c4 },
  },
  {
    id: "h", z: 1, sym: "H", ko: "수소", en: "Hydrogen",
    family: FAMILY.NONMETAL, combat: COMBAT.CASTER, silhouette: "light",
    mass: 1.008, electroneg: 2.2, melt: -259, boil: -253,
    faction: "neutral", role: "가장 먼저 태어난 떠돌이",
    // 근거 D — 우주에서 가장 처음 생긴 원소이고 지금도 가장 흔하다.
    //   그러면서 주기율표에서 제 자리가 애매한 원소이기도 하다.
    bio: "세상에서 가장 먼저 생긴 사람이다. 별도 물도 다 이 사람에게서 시작됐는데, 정작 표 위에서 자기 자리가 어디인지는 아직도 말이 갈린다.",
    quote: "나도 내 자리가 어딘지 몰라. 그래도 여태 잘 살았는걸.",
    bonds: ["o", "c", "uue"],
    colors: { main: 0xe8eef2, sub: 0xc4d2dc, accent: 0x7fb2d9, hair: 0xdce6ee },
  },
  {
    id: "na", z: 11, sym: "Na", ko: "소듐", en: "Sodium",
    family: FAMILY.ALKALI, combat: COMBAT.STRIKER, silhouette: "bulky",
    mass: 22.99, electroneg: 0.93, melt: 97.8, boil: 883,
    faction: "neutral", role: "소금을 만드는 요리사",
    // 근거 A — 염소와 만나 소금이 된다. 혼자서는 물에 닿기만 해도
    //   불이 붙지만, 짝을 만나면 밥상에 오른다.
    bio: "염소와 손을 잡고 소금을 만든다. 혼자 있을 때는 물만 닿아도 불이 붙는 위험한 사람인데, 짝을 만나면 얌전해져서 밥상에 오른다. 물가에는 여전히 못 간다.",
    quote: "물은 안 돼. 절대. …맛은 보장할게.",
    bonds: ["cl", "k", "o"],
    colors: { main: 0xd8d2c0, sub: 0xb0a892, accent: 0xe2b34a, hair: 0xc8c2b0 },
  },
  {
    id: "f", z: 9, sym: "F", ko: "플루오린", en: "Fluorine",
    family: FAMILY.HALOGEN, combat: COMBAT.CASTER, silhouette: "sharp",
    mass: 19.0, electroneg: 3.98, melt: -220, boil: -188,
    faction: "affinity", role: "무엇에게서든 빼앗는 노상강도",
    // 근거 C — 전기음성도 3.98로 모든 원소 중 1위. 닿는 것에서 전자를 앗아간다.
    bio: "지나는 것마다 가진 것을 빼앗는다. 당기는 힘이 세상에서 가장 세서, 어지간한 것은 손도 못 쓰고 내준다. 이유를 묻는 사람에게는 늘 같은 대답을 한다.",
    quote: "빼앗는 데 이유가 필요해? 나는 그렇게 생겨먹었어.",
    bonds: ["cl", "ca", "br"],
    colors: { main: 0xc9e86a, sub: 0x8fae3a, accent: 0xf0ff9a, hair: 0xb8dc58 },
  },

  // ---------------- 1~20번을 채우는 넷 ----------------
  // 학교에서 실제로 외우는 구간인데 비어 있었다. 표에 구멍이 나 있으면
  // "주기율표를 익힌다"는 목표에 정면으로 걸린다.
  //
  // 넷 다 CLAUDE.md 「캐릭터를 짓는 법」을 따랐다 — 판타지 직업에서 고르고,
  // 화학 근거로 검증하고, 과장했다.

  {
    id: "he", z: 2, sym: "He", ko: "헬륨", en: "Helium",
    family: FAMILY.NOBLE, combat: COMBAT.CASTER, silhouette: "floating",
    mass: 4.0, electroneg: null, melt: null, boil: -268.9,
    faction: "noble_gas", role: "하늘에 먼저 이름을 올린 점성술사",
    // 근거 D — 지구가 아니라 태양빛을 뜯어보다 먼저 찾아낸 유일한 원소다.
    // 이름도 그리스어로 해를 뜻하는 헬리오스에서 왔다.
    bio: "별을 보고 앞일을 점치는 일을 한다. 땅에서 찾기 전에 해에서 먼저 발견된 사람이라, 늘 하늘을 제 고향처럼 말한다. 아무하고도 안 붙어서 친구는 없다.",
    quote: "나? 여기서 찾은 게 아니야. 저 위에서 먼저 봤지.",
    bonds: ["ne", "ar"],
    colors: { main: 0xf5d76e, sub: 0x8a7530, accent: 0xfff3c4, hair: 0xe8c85a },
  },
  {
    id: "li", z: 3, sym: "Li", ko: "리튬", en: "Lithium",
    family: FAMILY.ALKALI, combat: COMBAT.STRIKER, silhouette: "civilian",
    mass: 6.9, electroneg: 0.98, melt: 180.5, boil: 1342,
    faction: "neutral", role: "짐을 옮기는 심부름꾼",
    // 근거 A — 배터리. 금속 중에 가장 가벼워서 전기를 담아 나르는 데 쓴다.
    bio: "힘을 담아 이 끝에서 저 끝으로 나른다. 금속 가운데 가장 가벼워서 하루 종일 뛰어다녀도 지치지 않는다. 물가에는 절대 가지 않는다.",
    quote: "가볍다고 얕보지 마. 그만큼 멀리 간다고.",
    bonds: ["na", "k"],
    colors: { main: 0xc45a7a, sub: 0x6b2838, accent: 0xf2a0b8, hair: 0xd4708c },
  },
  {
    id: "b", z: 5, sym: "B", ko: "붕소", en: "Boron",
    family: FAMILY.METALLOID, combat: COMBAT.HYBRID, silhouette: "civilian",
    mass: 10.8, electroneg: 2.04, melt: 2076, boil: 3927,
    faction: "neutral", role: "깨지지 않는 그릇을 굽는 도공",
    // 근거 A — 붕규산 유리. 갑자기 뜨거워지거나 식어도 깨지지 않아
    // 실험실 유리와 오븐 그릇에 쓴다.
    bio: "불에 넣었다 찬물에 담가도 멀쩡한 그릇을 굽는다. 남들 그릇은 그러면 쩍 갈라진다. 무뚝뚝하지만 제 물건에는 자부심이 대단하다.",
    quote: "뜨겁든 차갑든 내 그릇은 안 깨져. 한번 해 봐.",
    bonds: ["si", "o"],
    colors: { main: 0x5a6b7a, sub: 0x2a333d, accent: 0x9fb8c9, hair: 0x6e8296 },
  },
  {
    id: "al", z: 13, sym: "Al", ko: "알루미늄", en: "Aluminium",
    family: FAMILY.POST_TRANSITION, combat: COMBAT.STRIKER, silhouette: "armored",
    mass: 27.0, electroneg: 1.61, melt: 660.3, boil: 2470,
    faction: "neutral", role: "제 갑옷을 스스로 짓는 방패병",
    // 근거 B — 겉에 산화막이 저절로 생겨 속을 지킨다. 그래서 철처럼
    // 벌겋게 녹슬어 무너지지 않는다.
    bio: "다치면 그 자리에 얇은 껍질이 저절로 돋아 상처를 덮는다. 그래서 오래 서 있어도 무너지지 않는다. 가벼워서 하루 종일 방패를 들고 있어도 팔이 안 아프다.",
    quote: "긁혀도 괜찮아. 금방 새 살이 돋거든.",
    bonds: ["o", "si", "cu"],
    colors: { main: 0xa8b4bd, sub: 0x59636b, accent: 0xdce4ea, hair: 0x8e9aa3 },
  },

];

/** 플레이어 캐릭터. 주기율표에 자리가 없어 별도로 둔다. */
export const PLAYER_ELEMENT = {
  id: "uue", z: 119, sym: "119", ko: "이름 없는 자", en: "Unnamed",
  family: FAMILY.UNKNOWN, combat: COMBAT.HYBRID, silhouette: "civilian",
  mass: null, electroneg: null, melt: null, boil: null,
    faction: "none", role: "아직 이름이 없는 자",
    // 근거 D — 119번. 아직 아무도 만들지 못했고, 그래서 이름도 없다.
    //   임시로 '우누넨늄'이라 부르는데 그건 그냥 숫자를 라틴어로 읽은 것이다.
    bio: "표 어디에도 자리가 없다. 아직 아무도 만들어 낸 적이 없어서 이름조차 없고, 사람들은 그냥 번호로 부른다. 그래서 어느 편에도 속하지 않고 어디든 갈 수 있다.",
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

/** 인연 관계인지 — 한쪽 목록에만 있어도 인연으로 친다 (관계를 한 방향만 적어 둔 것이 많다) */
export function areBonded(idA, idB) {
  const a = getElement(idA);
  const b = getElement(idB);
  if (!a || !b) return false;
  return a.bonds.includes(idB) || b.bonds.includes(idA);
}

export const ELEMENT_COUNT = ELEMENTS.length;
