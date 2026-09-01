import { ELEMENTS } from "./elements.js";

// 엔딩 분기.
//
// 3장의 세력 선택과 이후 행동이 플래그로 쌓여 4개로 갈린다.
// 진엔딩(안정의 섬)만 조건이 여럿인데, 그건 "어느 편도 들지 않고 모두를 만나는"
// 가장 어려운 길이 가장 좋은 결말이어야 이야기가 성립하기 때문이다.

export const ENDINGS = {
  EQUALITY: "equality",
  ORDER: "order",
  ISLAND: "island",
  COLLAPSE: "collapse",
};

export const ENDING_DATA = {
  [ENDINGS.EQUALITY]: {
    id: ENDINGS.EQUALITY,
    name: "평등의 대륙",
    color: 0x8e2230,
    title: "강철의 형제",
    lines: [
      "귀금속의 특권이 해체되었다.",
      "금도 은도 백금도, 이제 광장에서 철과 같은 자리에 선다.",
      "철은 당신에게 이름을 주었다 — 「강철의 형제」.",
      "대륙은 평등해졌다. 다만 백금이 지키려던 옛 아름다움은 함께 사라졌다.",
      "당신은 여전히 119번이지만, 이제 불릴 이름이 있다.",
    ],
  },
  [ENDINGS.ORDER]: {
    id: ENDINGS.ORDER,
    name: "불변의 질서",
    color: 0xd9a441,
    title: "제119의 귀족",
    lines: [
      "귀족 체제는 유지되었다.",
      "백금은 당신을 백금족에 받아들이고 「제119의 귀족」이라 불렀다.",
      "대륙은 흔들림 없이 안정되었다. 아름다움은 지켜졌다.",
      "그리고 아무것도 변하지 않았다.",
      "철은 요새로 돌아갔고, 다시는 광장에 나오지 않았다.",
    ],
  },
  [ENDINGS.ISLAND]: {
    id: ENDINGS.ISLAND,
    name: "안정의 섬",
    color: 0xf0f4f8,
    title: "119번 — 우누넨늄",
    isTrue: true,
    lines: [
      "오가네손의 배가 불안정한 바다를 건넜다.",
      "형태가 무너지는 파도 끝에, 정말로 섬이 있었다.",
      "주기율표 모양의 섬. 그 118번 칸 옆에 빈자리가 하나.",
      "당신이 그 자리에 서자, 대륙 전체의 원소가 당신의 이름을 알게 되었다.",
      "119번. 이제 추방된 방사성 원소들에게도 돌아올 자리가 생겼다.",
      "염소는 아르곤이 되기를 그만두고, 처음으로 자기 자신이 되었다.",
    ],
  },
  [ENDINGS.COLLAPSE]: {
    id: ENDINGS.COLLAPSE,
    name: "붕괴",
    color: 0x6ee85a,
    isBad: true,
    lines: [
      "임계에 도달한 폴로늄이 연쇄 반응을 일으켰다.",
      "전자가 원자에서 떨어져 나가고, 원자핵이 흩어졌다.",
      "집도 나무도 사람도 형태를 잃었다.",
      "아스티온 대륙은 아무것도 아닌 것 — 균질한 플라스마로 되돌아갔다.",
      "이름을 얻기 전에, 이름 붙일 세계가 사라졌다.",
    ],
  },
};

export const CODEX_TRUE_RATIO = 0.9;

/**
 * 지금 조건으로 어느 엔딩에 도달하는가.
 *
 * @param {object} ctx { flags:Set, reputation:Reputation, codexSize:number }
 * @returns {{id:string, data:object, reasons:string[]}}
 */
export function resolveEnding(ctx) {
  const f = ctx.flags;
  const rep = ctx.reputation;
  const ratio = ctx.codexSize / ELEMENTS.length;
  const reasons = [];

  // 붕괴가 최우선 — 다른 조건을 아무리 갖춰도 세계가 없으면 끝이다
  if (f.has("gave_electrons_to_chlorine") || f.has("polonium_timer_expired")) {
    return { id: ENDINGS.COLLAPSE, data: ENDING_DATA[ENDINGS.COLLAPSE], reasons: ["세계가 붕괴했다"] };
  }

  const sidedLegion = f.has("sided_legion");
  const sidedNoble = f.has("sided_noblesse");
  const neutral = !sidedLegion && !sidedNoble;

  // 진엔딩 — 어느 편도 들지 않고, 도감을 채우고, 염소를 설득하고, 오가네손과 동행
  const trueConds = [
    [neutral, "어느 세력에도 서지 않았다"],
    [ratio >= CODEX_TRUE_RATIO, `도감 ${Math.round(ratio * 100)}% (90% 필요)`],
    [f.has("persuaded_chlorine"), "염소를 처치하지 않고 설득했다"],
    [f.has("oganesson_ally"), "오가네손과 동행한다"],
  ];
  if (trueConds.every(([ok]) => ok)) {
    return { id: ENDINGS.ISLAND, data: ENDING_DATA[ENDINGS.ISLAND], reasons: trueConds.map((c) => c[1]) };
  }

  if (sidedLegion && rep.get("legion") >= 50) {
    return { id: ENDINGS.EQUALITY, data: ENDING_DATA[ENDINGS.EQUALITY], reasons: ["전이 금속 군단을 지지했다"] };
  }
  if (sidedNoble && rep.get("noblesse") >= 50) {
    return { id: ENDINGS.ORDER, data: ENDING_DATA[ENDINGS.ORDER], reasons: ["귀금속 귀족을 지지했다"] };
  }

  // 편을 들었지만 평판이 모자라면 그쪽 결말로 가되, 못 채운 조건을 알려준다
  if (sidedLegion) return { id: ENDINGS.EQUALITY, data: ENDING_DATA[ENDINGS.EQUALITY], reasons: ["군단 평판이 부족했다"] };
  if (sidedNoble) return { id: ENDINGS.ORDER, data: ENDING_DATA[ENDINGS.ORDER], reasons: ["귀족 평판이 부족했다"] };

  // 중립이지만 진엔딩 조건을 못 채운 경우 — 못 채운 것을 돌려준다
  return {
    id: ENDINGS.ISLAND,
    data: ENDING_DATA[ENDINGS.ISLAND],
    partial: true,
    reasons: trueConds.filter(([ok]) => !ok).map((c) => c[1]),
  };
}

/** 회차 이월 — 도감·설정·해금 화합물은 남기고 나머지를 비운다 */
export function carryOver(ctx) {
  return {
    codex: ctx.codex.toJSON(),
    compounds: [...(ctx.player.progress.compounds ?? [])],
    clears: (ctx.clears ?? 0) + 1,
  };
}
