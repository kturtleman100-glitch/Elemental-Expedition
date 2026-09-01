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
 */
export const COMPOUNDS = [
  {
    id: "nacl", name: "소금", formula: "NaCl", needs: ["na", "cl"],
    desc: "이온 결합 결정. 단단해서 꿰뚫는다.",
    effect: { kind: "pierce", power: 1.4, note: "관통 — 뒤에 선 적까지 맞힌다" },
  },
  {
    id: "h2o", name: "물", formula: "H₂O", needs: ["h", "o"],
    desc: "알칼리 금속에 닿으면 격렬히 반응한다.",
    effect: { kind: "knockback", power: 1.2, vs: "alkali", bonus: 2.0, note: "알칼리 금속에게 연쇄 폭발" },
  },
  {
    id: "rust", name: "녹", formula: "Fe₂O₃", needs: ["fe", "o"],
    desc: "철이 산소를 만나 부식된다.",
    effect: { kind: "debuff", stat: "defense", amount: -0.4, duration: 8, note: "적 방어력 −40%" },
  },
  {
    id: "co2", name: "이산화탄소", formula: "CO₂", needs: ["c", "o"],
    desc: "타는 것을 덮어 끈다.",
    effect: { kind: "aoe", power: 0.9, note: "광역 질식 · 화염 무효화" },
  },
  {
    id: "sio2", name: "수정", formula: "SiO₂", needs: ["si", "o"],
    desc: "이산화규소 결정. 단단한 벽이 된다.",
    effect: { kind: "barrier", hp: 60, duration: 10, note: "방어 장벽 설치" },
  },
  {
    id: "caf2", name: "형석", formula: "CaF₂", needs: ["ca", "f"],
    desc: "자외선을 받으면 빛난다. 형광(fluorescence)의 어원.",
    effect: { kind: "reveal", radius: 20, duration: 12, note: "은신 해제 · 주변 조명" },
  },
  {
    id: "znS", name: "섬아연석", formula: "ZnS", needs: ["zn", "s"],
    desc: "아연과 황. 어둠 속에서 오래 빛난다.",
    effect: { kind: "heal", amount: 0.25, note: "체력 25% 회복" },
  },
  {
    id: "hgS", name: "진사", formula: "HgS", needs: ["hg", "s"],
    desc: "수은과 황이 만든 붉은 안료.",
    effect: { kind: "charm", duration: 5, note: "적 하나를 잠시 아군으로" },
  },
  {
    id: "pbS", name: "방연석", formula: "PbS", needs: ["pb", "s"],
    desc: "납의 주요 광석. 방사선을 막는다.",
    effect: { kind: "shield", reduce: 0.5, duration: 8, note: "받는 피해 절반" },
  },
  {
    id: "agBr", name: "브로민화은", formula: "AgBr", needs: ["ag", "br"],
    desc: "필름의 감광제. 빛을 기억한다.",
    effect: { kind: "record", note: "마지막에 쓴 화합물을 한 번 더" },
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
