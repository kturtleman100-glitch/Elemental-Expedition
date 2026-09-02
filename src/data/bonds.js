import { ELEMENTS, getElement, areBonded } from "./elements.js";

// 인연(因緣)과 화합물.
//
// 인연은 참고자료의 "인연이 깊은 원소" 목록을 그대로 쓴다(elements.js의 bonds).
// 그 관계가 게임 안에서 실제 이득이 되어야 자료가 살아난다.
//
// 화합물은 전부 실제로 존재하는 물질이다. 임의로 만들지 않는 것이
// 이 게임의 규칙이고, 그래야 플레이어가 화학 지식으로 조합을 추측할 수 있다.

// ---------------- 인연 보너스 ----------------

/**
 * 특정 조합이 모이면 발동하는 이름 있는 인연.
 * 여기 없는 조합도 areBonded()로 기본 보너스는 받는다.
 */
export const NAMED_BONDS = [
  {
    id: "alloy",
    members: ["fe", "mn"],
    name: "합금 단조",
    desc: "망가니즈가 철을 벼려 특수 합금을 만든다.",
    effect: { attack: 0.18, defense: 0.10 },
    flavor: "안 쓰는 무기는 내게 팔아요. 재활용하게~",
  },
  {
    id: "group11",
    members: ["au", "ag", "cu"],
    name: "11족 삼형제",
    desc: "수천 년 만에 다시 만난 금·은·구리. 전용 합체기가 열린다.",
    effect: { attack: 0.25, electrons: 0.20 },
    unlock: "combo_group11",
    flavor: "금속으로서의 가치 따윈 아무래도 좋아, 저 아이가 웃어준다면….",
  },
  {
    id: "steel_corps",
    members: ["co", "ni"],
    name: "강철부대 진형",
    desc: "공격받을수록 단단해지는 니켈이 코발트를 지킨다.",
    effect: { defense: 0.28 },
    flavor: "코발트는 대식가가 분명해!",
  },
  {
    id: "underworld",
    members: ["nb", "ta"],
    name: "저승의 부자(父子)",
    desc: "나이오븀과 탄탈럼은 서로가 쓰러지면 한 번 일으켜 세운다.",
    effect: { hp: 0.15 },
    unlock: "revive_once",
    flavor: "나이오븀은 정말 착한 아이야.",
  },
  {
    id: "organic",
    members: ["c", "o", "n"],
    name: "생명의 뼈대",
    desc: "탄소·산소·질소. 살아있는 것을 이루는 세 원소.",
    effect: { hp: 0.20, electrons: 0.15 },
    flavor: "세계는 끝없이 순환하지, 생명도 순환해.",
  },
  {
    id: "affinity_team",
    members: ["cl", "br"],
    name: "전자 친화팀",
    desc: "빼앗은 전자를 서로 나눈다.",
    effect: { electrons: 0.25 },
    flavor: "어머나, 또 할로젠의 폭주 사고야?",
  },
  {
    id: "noble_court",
    members: ["ne", "ar"],
    name: "귀족 기체 회의",
    desc: "반응하지 않는 둘이 나란히 서면 아무것도 뚫지 못한다.",
    effect: { defense: 0.35 },
    flavor: "곤란하기도 하지, 아무 일도 안 하는데 모두에게 도움이 되고 있다니~",
  },
  {
    id: "exiled",
    members: ["u", "po"],
    name: "추방된 자들",
    desc: "대륙에서 쫓겨난 둘. 위력은 크지만 스스로를 갉아먹는다.",
    effect: { attack: 0.35, hp: -0.12 },
    flavor: "우리는 혜택받은 존재지?",
  },
];

const BASE_BOND_BONUS = { attack: 0.06, defense: 0.06, hp: 0.06, electrons: 0.06 };

/**
 * 편성된 원소들의 인연 보너스를 합산한다.
 * @param {string[]} party 원소 id 배열
 * @returns {{mult:{attack:number,defense:number,hp:number,electrons:number},
 *            active:object[], pairs:[string,string][], unlocks:string[]}}
 */
export function bondBonuses(party) {
  const set = new Set(party.filter(Boolean));
  const mult = { attack: 1, defense: 1, hp: 1, electrons: 1 };
  const active = [];
  const unlocks = [];

  // 이름 있는 인연 — 구성원이 전부 모여야 발동
  for (const b of NAMED_BONDS) {
    if (!b.members.every((m) => set.has(m))) continue;
    active.push(b);
    for (const [k, v] of Object.entries(b.effect)) mult[k] += v;
    if (b.unlock) unlocks.push(b.unlock);
  }

  // 자료의 bonds 목록에 따른 기본 인연 — 짝마다 조금씩
  const list = [...set];
  const pairs = [];
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      if (!areBonded(list[i], list[j])) continue;
      pairs.push([list[i], list[j]]);
      for (const [k, v] of Object.entries(BASE_BOND_BONUS)) mult[k] += v;
    }
  }

  return { mult, active, pairs, unlocks };
}

/** 이 원소와 인연이 있는 원소들 (도감·파티 UI 표시용) */
export function bondedWith(id) {
  return ELEMENTS.filter((e) => e.id !== id && areBonded(id, e.id));
}

// ---------------- 화합물 ----------------

/**
 * 전부 실제 화합물이다. 효과는 그 물질의 성질에서 끌어냈다.
 *  needs: 필요한 원소 id (순서 무관)
 *  chem : 결합의 종류와, 그 물질이 알려주는 화학.
 *         효과가 왜 그 효과인지까지 설명되면 규칙을 외우는 대신 추측할 수 있다
 */
export const COMPOUNDS = [
  {
    id: "nacl", name: "소금", formula: "NaCl", needs: ["na", "cl"],
    desc: "이온 결합 결정. 단단해서 꿰뚫는다.",
    effect: { kind: "pierce", power: 1.4, note: "관통 — 뒤에 선 적까지 맞힌다" },
    chem: {
      bond: "이온 결합",
      fact: "소듐이 전자 하나를 내주고 염소가 받는다. 서로 +와 −가 되어 강하게 끌어당기므로 결정이 단단하고 녹는점이 800°C를 넘는다. 전기음성도 차가 2.23으로 이 표에서 가장 크다 — 차이가 클수록 이온 결합이다.",
    },
  },
  {
    id: "h2o", name: "물", formula: "H₂O", needs: ["h", "o"],
    desc: "알칼리 금속에 닿으면 격렬히 반응한다.",
    effect: { kind: "knockback", power: 1.2, vs: "alkali", bonus: 2.0, note: "알칼리 금속에게 연쇄 폭발" },
    chem: {
      bond: "극성 공유 결합",
      fact: "산소가 수소보다 전자를 세게 당겨(3.44 대 2.20) 한쪽이 살짝 −, 다른 쪽이 +를 띤다. 게다가 분자가 굽어 있어 그 치우침이 상쇄되지 않는다. 물이 온갖 것을 녹이는 이유가 이 극성이다.",
    },
  },
  {
    id: "ice", name: "얼음", formula: "H₂O", needs: ["h", "o"],
    desc: "물을 얼려 길을 낸다. 마찰이 거의 없어 멀리 미끄러진다.",
    effect: { kind: "glide", speed: 2.1, duration: 9, note: "9초간 이동 속도 2.1배" },
    chem: {
      bond: "극성 공유 결합 + 분자 사이의 수소 결합",
      fact: "분자 안은 물과 똑같은 극성 공유 결합이고, 분자끼리를 붙드는 것이 수소 결합이다. 물과 얼음은 같은 H₂O인데 상태만 다르다. 0도 아래에서 분자들이 수소 결합으로 육각형 격자를 짜는데, 그 격자가 액체보다 성기어서 얼음이 물에 뜬다. 대부분의 물질은 얼면 가라앉으니 물이 유별난 것이다.",
    },
  },
  {
    id: "rust", name: "녹", formula: "Fe₂O₃", needs: ["fe", "o"],
    desc: "철이 산소를 만나 부식된다.",
    effect: { kind: "debuff", stat: "defense", amount: -0.4, duration: 8, note: "적 방어력 −40%" },
    chem: {
      bond: "이온 결합",
      fact: "철이 산소에게 전자를 빼앗긴다. 이것이 산화이고, 산화란 곧 전자를 잃는 일이다. 녹이 방어력을 깎는 것은 금속 결합이 끊어져 구조가 무너지기 때문이다.",
    },
  },
  {
    id: "co2", name: "이산화탄소", formula: "CO₂", needs: ["c", "o"],
    desc: "타는 것을 덮어 끈다.",
    effect: { kind: "aoe", power: 0.9, note: "광역 질식 · 화염 무효화" },
    chem: {
      bond: "극성 공유 결합 · 무극성 분자",
      fact: "C=O 결합 하나하나는 극성인데, 분자가 O=C=O로 반듯한 직선이라 양쪽 치우침이 정확히 상쇄된다. 그래서 결합은 극성인데 분자는 무극성이다. 물에 잘 안 섞이고 공기보다 무거워 아래로 깔리는 것이 여기서 나온다.",
    },
  },
  {
    id: "sio2", name: "수정", formula: "SiO₂", needs: ["si", "o"],
    desc: "이산화규소 결정. 단단한 벽이 된다.",
    effect: { kind: "barrier", hp: 60, duration: 10, note: "방어 장벽 설치" },
    chem: {
      bond: "공유 결합 그물",
      fact: "분자가 아니다. 규소와 산소가 그물처럼 끝없이 이어져 결정 하나가 통째로 거대한 분자다. 끊으려면 공유 결합을 전부 끊어야 하므로 1700°C까지 녹지 않는다. 유리·모래·수정이 모두 이것이다.",
    },
  },
  {
    id: "caf2", name: "형석", formula: "CaF₂", needs: ["ca", "f"],
    desc: "자외선을 받으면 빛난다. 형광(fluorescence)의 어원.",
    effect: { kind: "reveal", radius: 20, duration: 12, note: "은신 해제 · 주변 조명" },
    chem: {
      bond: "이온 결합",
      fact: "칼슘이 전자 두 개를 내주고 플루오린 둘이 하나씩 받는다 — 그래서 Ca 하나에 F 둘이다. 화학식의 아래 숫자는 임의가 아니라 주고받는 전자 수를 맞춘 결과다. 형광(fluorescence)이라는 말이 이 광물 형석(fluorite)에서 나왔다.",
    },
  },
  {
    id: "znS", name: "섬아연석", formula: "ZnS", needs: ["zn", "s"],
    desc: "아연과 황. 어둠 속에서 오래 빛난다.",
    effect: { kind: "heal", amount: 0.25, note: "체력 25% 회복" },
    chem: {
      bond: "이온 결합",
      fact: "빛을 받아 전자를 들뜬 상태로 붙잡아 두었다가 천천히 놓아주며 다시 빛을 낸다. 이것이 인광이다. 야광 별 스티커가 같은 원리다.",
    },
  },
  {
    id: "hgS", name: "진사", formula: "HgS", needs: ["hg", "s"],
    desc: "수은과 황이 만든 붉은 안료.",
    effect: { kind: "charm", duration: 5, note: "적 하나를 잠시 아군으로" },
    chem: {
      bond: "이온 결합",
      fact: "주홍색 안료 버밀리언의 원료이자 수은을 얻는 주된 광석이다. 수은은 금속인데도 상온에서 액체인데, 원자끼리 손을 제대로 잡지 않기 때문이다.",
    },
  },
  {
    id: "pbS", name: "방연석", formula: "PbS", needs: ["pb", "s"],
    desc: "납의 주요 광석. 방사선을 막는다.",
    effect: { kind: "shield", reduce: 0.5, duration: 8, note: "받는 피해 절반" },
    chem: {
      bond: "이온 결합",
      fact: "납의 주요 광석. 납이 방사선을 막는 것은 화학이 아니라 밀도의 문제다. 원자가 무겁고 빽빽할수록 방사선이 뚫고 지나가기 어렵다.",
    },
  },
  {
    id: "agBr", name: "브로민화은", formula: "AgBr", needs: ["ag", "br"],
    desc: "필름의 감광제. 빛을 기억한다.",
    effect: { kind: "record", note: "마지막에 쓴 화합물을 한 번 더" },
    chem: {
      bond: "이온 결합",
      fact: "빛을 받으면 은 이온이 전자를 되받아 금속 은으로 변하고, 그 자리가 검게 남는다. 필름 사진이 상을 기록하는 원리가 이것이다 — 빛이 닿은 만큼 은이 생긴다.",
    },
  },
];

/** 이 원소들로 만들 수 있는 화합물 목록 */
export function availableCompounds(owned) {
  const set = new Set(owned);
  return COMPOUNDS.filter((c) => c.needs.every((n) => set.has(n)));
}

/** 만들려면 무엇이 더 필요한가 (UI에 "○○이 더 필요" 표시용) */
export function missingFor(compound, owned) {
  const set = new Set(owned);
  return compound.needs.filter((n) => !set.has(n)).map((n) => getElement(n)).filter(Boolean);
}

export function getCompound(id) {
  return COMPOUNDS.find((c) => c.id === id) ?? null;
}
