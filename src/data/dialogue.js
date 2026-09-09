import { RESIDENT_DIALOGUES } from "./dialogue_residents.js";

// 캐릭터별 대사.
//
// 대사는 그 원소의 성질에서 나온 직업과 성격을 따른다. 이 게임의 재미는 화학이
// 인물의 성격으로 번역되는 데 있으므로, 대사가 설정에서 벗어나면 안 된다.
//   칼슘 — 조용하고, 자유롭게 움직이지 못하며, 늘 무언가에 기도한다
//   인   — 택배 기사. 장난꾸러기에 묘지를 파헤치고 불을 붙인다
//   탄소 — 천년을 산 천재 학자. 싹싹하고 발이 넓다. 팔이 넷
//   규소 — 예언가. 혼자를 즐기고, 데이터가 없으면 예언하지 못한다
//   마그네슘 — 자칭 숲의 주인. 정체는 세계수. 늘 졸고 있다
//   철   — 군단 대장. 굳은 신념. 귀금속과 비금속의 평등
//
// 구조: nodes[키] = { lines: [...], choices: [{ text, to, effect, when, unless }] }
//   to: 다음 노드 키. null이면 대화 종료
//   effect: { rep: [세력, 증감], flag: "플래그", flags: [...], codex: "원소id", element: "원소id" }
//     element — 그 원소가 동료가 된다. 퀘스트 보상과 같은 경로를 탄다
//   when / unless: 그 플래그가 있어야(없어야) 보이는 선택지
// starts: [{ when, unless, node }] — 진행 상황에 따라 다른 첫 노드로 들어간다.
//   위에서부터 처음 맞는 것을 쓴다. 없으면 talked_ 여부로 start/repeat을 고른다.
//   이게 없으면 3장에서 편을 고르는 대화를 1장 인물에게 붙일 방법이 없다

export const DIALOGUES = {
  // ---------------- 칼슘 (Ca) — 석회 마을 촌장 ----------------
  ca: {
    start: "intro",
    nodes: {
      intro: {
        lines: [
          "…아아, 깨어났군요.",
          "사흘 전 불안정한 바다 쪽에서 떠밀려 왔습니다. 마을 사람들이 건져 올렸지요.",
          "이름을 여쭤도 될까요. 아니… 표정을 보니 그것도 모르시는 모양이군요.",
        ],
        choices: [
          { text: "여긴 어디죠?", to: "where" },
          { text: "저는… 제가 뭔지 모르겠어요", to: "who" },
        ],
      },
      where: {
        lines: [
          "엘레멘타 대륙의 동쪽 끝, 석회 마을입니다.",
          "석회암 절벽 아래 자리잡은 작은 곳이지요. 저는 여기 촌장을 맡고 있는 칼슘이라 합니다.",
          "보시다시피 몸이 자유롭지 못해서, 바깥일은 대개 다른 이에게 떠맡기고 있습니다만.",
        ],
        choices: [
          { text: "저는… 제가 뭔지 모르겠어요", to: "who" },
          { text: "몸이 불편하신가요?", to: "body" },
        ],
      },
      body: {
        lines: [
          "뼈를 이루는 원소가 정작 제 몸 하나 제대로 가누지 못한다니, 우습지요.",
          "그래서 석회암 동굴에 자주 갑니다. 거기서… 무언가에게 기도합니다.",
          "무엇에게냐고는 묻지 말아 주세요. 저도 모릅니다.",
        ],
        choices: [
          { text: "저는… 제가 뭔지 모르겠어요", to: "who" },
        ],
      },
      who: {
        lines: [
          "당신에게선 어떤 족(族)의 냄새도 나지 않습니다. 이런 건 처음 봅니다.",
          "주기율표에 자리가 없다는 뜻이지요. 이름도, 소속도, 정해진 성질도 없다는.",
          "…하지만 그건 어느 세력에도 매이지 않는다는 뜻이기도 합니다.",
          "우선 전자를 다루는 법부터 익히셔야겠군요. 그게 이 대륙에서 살아가는 첫걸음입니다.",
        ],
        choices: [
          { text: "전자요?", to: "electron", effect: { flag: "met_calcium", codex: "ca" } },
        ],
      },
      electron: {
        lines: [
          "모든 원소는 전자를 주고받으며 살아갑니다. 금속은 내어주고, 비금속은 빼앗지요.",
          "그 주고받음이 곧 이 대륙의 싸움이고, 관계이고, 정치입니다.",
          "…다만 요즘 마을 사람들의 전자가 자꾸 사라지고 있습니다. 누군가 훔쳐가는 겁니다.",
          "몸이 성치 않은 제가 할 수 있는 일이 없어서요. 부탁드려도 되겠습니까?",
        ],
        choices: [
          { text: "돕겠습니다", to: "accept", effect: { flag: "quest_electron_thief", rep: ["neutral", 10] } },
          { text: "생각해볼게요", to: null },
        ],
      },
      accept: {
        lines: [
          "감사합니다. 매번 고생하시네요. 자유롭게 움직일 수 없는 이 몸을 대신해서….",
          "마을을 돌아보시고, 사람들과 이야기를 나눠 보세요. 무언가 알게 되실 겁니다.",
          "광장에는 탄소 선생이, 공방 쪽에는 인이 있습니다. 둘 다 눈이 밝은 이들이지요.",
        ],
        choices: [{ text: "다녀오겠습니다", to: null }],
      },
      repeat: {
        lines: [
          "…아아, 오셨군요.",
          "마을을 둘러보고 계신가요. 천천히 하셔도 됩니다.",
        ],
        choices: [{ text: "네", to: null }],
      },
    },
  },

  // ---------------- 인 (P) — 불씨 운송 택배 기사 ----------------
  p: {
    start: "intro",
    nodes: {
      intro: {
        lines: [
          "고객님! 왜 지정한 배송 시간에 안 계신 거죠?!",
          "…어, 아니네. 처음 보는 얼굴이다. 미안, 미안. 요즘 부재중이 하도 많아서.",
          "나는 인. 불씨 운송 소속이야. 이 대륙 물류는 내가 다 책임지고 있지.",
        ],
        choices: [
          { text: "불씨 운송?", to: "job", effect: { codex: "p" } },
          { text: "혼자서 대륙 전체를?", to: "power", effect: { codex: "p" } },
        ],
      },
      job: {
        lines: [
          "저 창고 보이지? 저기가 우리 지점이야. 물건이 저기 모였다가 대륙 곳곳으로 나가.",
          "발이 빠른 게 내 재산이거든. 비료의 3요소 중 하나라 그런가, 어디든 잘 스며들어.",
        ],
        choices: [
          { text: "혼자서 대륙 전체를?", to: "power" },
          { text: "요즘 이상한 일 없었어?", to: "rumor" },
        ],
      },
      power: {
        lines: [
          "체력만 좋은 게 아니라 초능력도 좀 쓰지. 어두운 데서 혼자 빛나기도 하고.",
          "…아, 그리고 심심하면 묘지를 파헤치거나 불을 붙이기도 해. 재밌잖아?",
          "왜 그런 표정이야. 나쁜 짓은 아니라니까.",
        ],
        choices: [
          { text: "요즘 이상한 일 없었어?", to: "rumor" },
          { text: "…그만 가볼게", to: null },
        ],
      },
      rumor: {
        lines: [
          "이상한 일? 있지. 요 며칠 배송 나갔다 오면 몸이 이상하게 가벼워.",
          "처음엔 살 빠진 줄 알았는데, 그게 아니라 전자가 줄어든 거더라고.",
          "누가 길목에서 빼가는 것 같은데… 잡으려고 해도 그림자도 안 보여.",
          "초록빛이 언뜻 스치기는 했어. 할로겐 쪽 색이지.",
        ],
        choices: [
          { text: "고마워, 단서가 됐어", to: null, effect: { flag: "clue_halogen", rep: ["neutral", 5] } },
        ],
      },
      repeat: {
        lines: [
          "배송 중이야! 말 걸려면 빨리 해!",
          "…농담이야. 뭐 필요한 거 있어?",
        ],
        choices: [{ text: "아니, 지나가는 길이야", to: null }],
      },
    },
  },

  // ---------------- 탄소 (C) — 탄소 학교 교장 ----------------
  c: {
    start: "intro",
    nodes: {
      intro: {
        lines: [
          "하하하! 이런 곳에서 처음 보는 얼굴을 만나다니!",
          "나는 탄소. 저 너머 탄소 학교의 교장을 맡고 있지.",
          "어려 보인다고? 천 년쯤 살았단다. 놀랐나?",
        ],
        choices: [
          { text: "천 년이요?", to: "age", effect: { codex: "c" } },
          { text: "팔이… 넷인가요?", to: "arms", effect: { codex: "c" } },
        ],
      },
      age: {
        lines: [
          "생명이란 건 전부 나로 만들어져 있거든. 오래 살 수밖에.",
          "덕분에 발이 넓어. 이 대륙에 내가 모르는 원소는 거의 없단다.",
          "그러니 궁금한 게 있으면 언제든 물어보렴. 답을 알거나, 아는 사람을 알거나 둘 중 하나야.",
        ],
        choices: [
          { text: "팔이… 넷인가요?", to: "arms" },
          { text: "전자를 훔치는 자가 있다던데요", to: "thief" },
        ],
      },
      arms: {
        lines: [
          "맞아! 최대 넷까지 손을 잡을 수 있지. 그래서 온갖 걸 만들어낼 수 있는 거고.",
          "다이아몬드도 흑연도 다 나야. 같은 원소인데 배열이 다를 뿐이란다.",
          "하나는 세상에서 가장 단단하고 하나는 연필심으로 쓰이지. 재밌지 않니?",
        ],
        choices: [
          { text: "전자를 훔치는 자가 있다던데요", to: "thief" },
          { text: "학교에 대해 더 알려주세요", to: "school" },
        ],
      },
      school: {
        lines: [
          "네 방향으로 뻗은 건물이 넷. 내 결합팔을 본떠 지었지.",
          "규소도 거기 있는데… 그 친구는 혼자 있는 걸 좋아해서 탑에만 틀어박혀 있어.",
          "너, 우리 학교에 들어와라! 자리가 없다고? 그럼 만들면 되지!",
        ],
        choices: [
          { text: "생각해볼게요", to: "thief" },
        ],
      },
      thief: {
        lines: [
          "아, 그 이야기. 나도 들었단다.",
          "전자를 빼앗는 건 전기음성도가 높은 쪽이야. 할로겐이지. 특히 염소.",
          "그 아이는… 아르곤이 되고 싶어 해. 전자 하나만 더 있으면 귀족 기체와 같은 배치가 되거든.",
          "가엾은 일이야. 자기 자신으로는 만족하지 못한다는 건.",
        ],
        choices: [
          { text: "막을 방법이 있나요?", to: "counter", effect: { flag: "learned_chlorine" } },
        ],
      },
      counter: {
        lines: [
          "전기음성도 차이가 곧 힘의 차이란다. 차이가 클수록 격렬하게 반응하지.",
          "염소는 3.16이야. 그보다 낮은 원소는 전자를 빼앗기고, 높은 원소는 오히려 빼앗을 수 있어.",
          "…플루오린이 3.98로 가장 높지. 다만 그 아이를 건드리는 건 권하지 않는단다.",
          "규소에게 가 보렴. 그 아이라면 앞일을 계산해 줄 게다. 데이터만 있다면 말이지.",
          "…아, 그리고 이건 입학 선물. 내 힘이란다. 생명은 전부 나로 만들어져 있으니, 어디서든 쓸모가 있을 게다.",
        ],
        choices: [
          // 탄소는 CO₂와 「생명의 뼈대」 인연의 재료다. 여기서 안 주면 정식 플레이로 영영 못 얻는다
          { text: "감사합니다", to: null, effect: { rep: ["neutral", 10], element: "c" } },
        ],
      },
      repeat: {
        lines: [
          "하하, 또 왔구나! 공부는 잘 되어 가니?",
          "모르는 게 있으면 언제든 물어보렴.",
        ],
        choices: [{ text: "네, 감사합니다", to: null }],
      },
    },
  },

  // ---------------- 규소 (Si) — 예언가 ----------------
  si: {
    start: "intro",
    // 4장 — 도감이 차면 계산 결과를 들려준다. 염소를 "설득"할 수 있다는 사실을
    // 여기서 처음 알려준다. 안 알려주면 설득 창이 열려도 그냥 때려 죽인다
    starts: [
      { when: "data_enough", unless: "heard_prophecy", node: "prophecy" },
      { when: "heard_prophecy", node: "after_prophecy" },
    ],
    nodes: {
      prophecy: {
        lines: [
          "…왔군. 데이터는 충분해. 계산이 끝났다.",
          "염소는 석회암 고원 깊은 곳에 있다. 서북쪽, 마른 웅덩이를 지나서.",
          "그는 전자를 빨아들일수록 아르곤을 닮아가지만, 양성자 수는 그대로다. 결코 아르곤이 될 수 없어.",
          "그래서 마지막에 반드시 무너진다. 그 순간 — 무너지기 직전에 — 공격을 멈추고 다가가라.",
          "그때 네 말이 들릴 거다. 이름도 족도 없는 네 말이라면.",
        ],
        choices: [
          { text: "설득할 수 있다는 건가요?", to: "prophecy2" },
        ],
      },
      prophecy2: {
        lines: [
          "확률은 낮다. 하지만 0은 아니지. 0이 아니면 계산할 가치가 있다.",
          "…그리고 하나 더. 남쪽 해변에 배가 한 척 와 있다. 이 대륙 것이 아니야.",
          "네가 어디서 떠밀려 왔는지 알고 싶다면, 그 배의 주인을 만나 봐.",
        ],
        choices: [
          { text: "고마워요, 규소", to: null, effect: { flag: "heard_prophecy", rep: ["neutral", 10] } },
        ],
      },
      after_prophecy: {
        lines: [
          "…계산은 끝났다. 나머지는 네 몫이야.",
          "무너지기 직전에 멈춘다. 잊지 마라.",
        ],
        choices: [{ text: "네", to: null }],
      },
      intro: {
        lines: [
          "…….",
          "무슨 일이지. 나는 지금 계산 중인데.",
        ],
        choices: [
          { text: "예언가라고 들었어요", to: "oracle", effect: { codex: "si" } },
          { text: "방해했다면 미안해요", to: "polite", effect: { codex: "si" } },
        ],
      },
      polite: {
        lines: [
          "…아니. 사과할 것까진 없어.",
          "다들 나를 이상한 사람 취급하는데, 예의를 차리는 건 오랜만이군.",
          "탄소가 보냈나. 그 사람은 늘 남을 나한테 떠넘겨.",
        ],
        choices: [{ text: "예언을 부탁드리고 싶어요", to: "oracle" }],
      },
      oracle: {
        lines: [
          "예언이라고들 부르지만 정확히는 계산이야. 나는 마법을 쓰지 않아.",
          "조건을 넣으면 결과가 나온다. 그뿐이지.",
          "…그런데 너. 데이터가 없어.",
        ],
        choices: [
          { text: "데이터가 없다니요?", to: "nodata" },
        ],
      },
      nodata: {
        lines: [
          "원자번호도, 족도, 전기음성도도 읽히지 않아. 계산할 입력값이 없다는 뜻이야.",
          "이런 건 처음이군. …흥미롭기는 해.",
          "이런… 나는 데이터가 없으면 미래를 예언할 수 없다구. 놀릴 생각이라면 이만 돌아가 줄래.",
        ],
        choices: [
          { text: "데이터를 모아 오면 되나요?", to: "quest" },
          { text: "…미안해요", to: null },
        ],
      },
      quest: {
        lines: [
          "…호오.",
          "그래. 네가 무엇인지 알아내려면 관측이 필요해. 네가 다른 원소와 어떻게 반응하는지.",
          "마을 사람들을 만나고, 싸우고, 원소를 얻어 와. 그 기록이 곧 데이터다.",
          "도감이 채워지면 다시 오도록. 그때는 계산해 주지.",
        ],
        choices: [
          { text: "알겠습니다", to: null, effect: { flag: "quest_silicon_data", rep: ["neutral", 5] } },
        ],
      },
      repeat: {
        lines: [
          "…아직 데이터가 부족해.",
          "더 많은 원소를 만나고 오도록.",
        ],
        choices: [{ text: "네", to: null }],
      },
    },
  },

  // ---------------- 마그네슘 (Mg) — 자칭 숲의 주인 ----------------
  mg: {
    start: "intro",
    nodes: {
      intro: {
        lines: [
          "…음냐… 흠냐….",
          "……. (요정처럼 생긴 무언가가 졸고 있다)",
          "…응? 아, 손님이구나. 나는 마그네슘. 이 숲의 주인이란다.",
        ],
        choices: [
          { text: "숲의 주인이요?", to: "forest", effect: { codex: "mg" } },
          { text: "계속 주무시던데요", to: "sleep", effect: { codex: "mg" } },
        ],
      },
      sleep: {
        lines: [
          "햇빛을 받고 있었을 뿐이야. 자는 게 아니라구.",
          "…음냐. 어디까지 얘기했더라.",
        ],
        choices: [{ text: "숲의 주인이라고 하셨어요", to: "forest" }],
      },
      forest: {
        lines: [
          "그래. 이 근방의 나무는 전부 내 것이지. 아니, 내 일부라고 해야 하나.",
          "…사실은 말이야. 다들 나를 요정이라고 부르는데,",
          "내 진짜 몸은 이 대륙에 그림자를 드리울 만큼 큰 나무란다.",
          "세계수라고 하던가. 뭐, 나는 별로 신경 안 써.",
        ],
        choices: [
          { text: "그렇게 대단한 존재가 왜 여기서 졸고 있어요?", to: "why" },
        ],
      },
      why: {
        lines: [
          "대단하다는 게 뭔데? 나는 그냥 햇빛을 받고 있으면 좋아.",
          "…아, 그러고 보니. 너한테서 이상한 냄새가 나.",
          "어느 족의 것도 아닌 냄새. 신기하네. 그런 건 처음이야.",
        ],
        choices: [
          { text: "저도 제가 뭔지 몰라요", to: "advice" },
        ],
      },
      advice: {
        lines: [
          "그럼 급할 거 없잖아. 정해지지 않았다는 건 뭐든 될 수 있다는 거니까.",
          "…나는 태어날 때부터 세계수였어. 다른 게 될 기회가 없었지.",
          "네가 좀 부럽구나. …음냐.",
        ],
        choices: [
          { text: "고마워요", to: null, effect: { rep: ["neutral", 5], flag: "met_magnesium" } },
        ],
      },
      repeat: {
        lines: [
          "…음냐… 흠냐….",
          "아, 또 왔구나. 햇빛 좋지?",
        ],
        choices: [{ text: "네", to: null }],
      },
    },
  },

  // ---------------- 철 (Fe) — 화로 연합 대장 ----------------
  fe: {
    start: "intro",
    // 3장 — 편을 고르는 대화. 1장에서 "언젠가 선택해야 할 날이 온다"고 말한 것을
    // 여기서 거둔다. 한 번 고르면 되돌릴 수 없다 (faction_chosen)
    starts: [
      { when: "boss_done_boss_fe", node: "fallen" },
      { when: "sided_noblesse", node: "betrayed" },
      { when: "sided_legion", node: "ally" },
      { when: "stayed_neutral", node: "neutral" },
      { when: "chapter3", unless: "faction_chosen", node: "crossroads" },
    ],
    nodes: {
      crossroads: {
        lines: [
          "…왔군. 그날이 왔다.",
          "백금이 대성당에 귀족들을 모았다. 우리도 요새에서 병력을 정비했다.",
          "네가 어느 쪽에 설지, 지금 듣고 싶다. 어느 족에도 속하지 않는 네 선택이라면 양쪽 다 무게를 둘 테니.",
          "…서쪽 폐허의 황금 용도 만나 봤나? 저쪽 말도 듣고 정해라. 나는 강요하지 않는다.",
        ],
        choices: [
          {
            text: "군단과 함께 서겠습니다",
            to: "chosen_legion",
            when: "heard_noblesse",
            // 엔딩 판정이 평판 50을 본다. 편을 든 것 자체가 그 문턱을 넘어야지,
            // 주민 다섯을 더 만나야 넘는다면 "평판이 부족했다"가 기본 결말이 된다
            effect: { flags: ["sided_legion", "faction_chosen"], rep: ["legion", 50], element: "fe" },
          },
          {
            text: "어느 편에도 서지 않겠습니다",
            to: "chosen_neutral",
            when: "heard_noblesse",
            effect: { flags: ["stayed_neutral", "faction_chosen"], reps: [["legion", 10], ["noblesse", 10]] },
          },
          { text: "금의 말을 먼저 듣고 오겠습니다", to: null, unless: "heard_noblesse" },
          { text: "조금 더 생각해 보겠습니다", to: null, when: "heard_noblesse" },
        ],
      },
      chosen_legion: {
        lines: [
          "…고맙다. 후회하게 하진 않겠다.",
          "백금은 절대 스스로 내려오지 않는다. 그를 꺾어야 벽이 무너진다. 동쪽 숲 너머에 있다.",
          "내 힘을 빌려주지. 녹슬어도 부러지지는 않는 힘이다.",
        ],
        choices: [{ text: "함께 가겠습니다", to: null }],
      },
      chosen_neutral: {
        lines: [
          "…그런가. 그것도 하나의 답이다.",
          "어느 쪽에도 서지 않는다는 건, 양쪽을 다 본다는 뜻이기도 하니까.",
          "네가 보는 것을 언젠가 나에게도 말해 다오. 나는 한쪽밖에 볼 수 없으니.",
        ],
        choices: [{ text: "그러겠습니다", to: null }],
      },
      ally: {
        lines: [
          "…동지여. 백금은 동쪽 숲 너머에 있다.",
          "몸조심해라. 그 아이는 왕수로만 녹는다.",
        ],
        choices: [{ text: "네", to: null }],
      },
      neutral: {
        lines: [
          "…아직도 어느 쪽에도 서지 않았군.",
          "그 눈으로 본 것을 잊지 마라. 그게 네 무기다.",
        ],
        choices: [{ text: "네", to: null }],
      },
      betrayed: {
        lines: [
          "…네가 저쪽에 섰다는 말을 들었다.",
          "원망하지 않는다. 다만 다음에 만나는 곳은 여기가 아닐 거다. 서북쪽 요새 앞에서 기다리겠다.",
        ],
        choices: [{ text: "…", to: null }],
      },
      fallen: {
        lines: [
          "…졌다. 그래도 군단은 남는다.",
          "내 신념이 옳다고 믿었지만, 정답이라고는 말하지 않았지. …그 말을 지킬 수 있어 다행이다.",
        ],
        choices: [{ text: "…", to: null }],
      },
      intro: {
        lines: [
          "…처음 보는 얼굴이군.",
          "나는 철. 화로 연합을 이끌고 있다.",
          "이런 변두리 마을까지 온 건 물자를 확인하러 온 것뿐이야. 신경 쓰지 마라.",
        ],
        choices: [
          { text: "군단이 뭘 하는 곳이죠?", to: "legion", effect: { codex: "fe" } },
          { text: "무섭게 생기셨네요", to: "look", effect: { codex: "fe" } },
        ],
      },
      look: {
        lines: [
          "…자주 듣는 소리다.",
          "평화… 정말 좋지. 근데 팔이 둔해지고….",
          "아니, 아무것도 아니다. 잊어라.",
        ],
        choices: [{ text: "군단이 뭘 하는 곳이죠?", to: "legion" }],
      },
      legion: {
        lines: [
          "이 대륙은 귀금속과 비금속으로 갈라져 있다.",
          "금이니 백금이니 하는 자들은 태어날 때부터 귀하다는 이유로 위에 서고,",
          "우리 같은 것들은 녹슬고 부서지며 아래에서 떠받친다.",
          "나는 그 벽을 부수려 한다. 그것이 군단의 존재 이유다.",
        ],
        choices: [
          { text: "그럼 귀금속과 싸우는 건가요?", to: "war" },
          { text: "훌륭한 뜻이네요", to: "praise" },
        ],
      },
      praise: {
        lines: [
          "…훌륭하다니. 나는 그런 말을 들을 자격이 없다.",
          "정의를 말하면서 결국 힘으로 밀어붙이려는 것뿐이니까.",
          "그래도 누군가는 해야 한다. 백금은 절대 스스로 내려오지 않을 테니.",
        ],
        choices: [{ text: "그럼 귀금속과 싸우는 건가요?", to: "war" }],
      },
      war: {
        lines: [
          "…아직은 아니다. 하지만 곧 그렇게 되겠지.",
          "언젠가 너도 선택해야 할 날이 온다. 어느 쪽에 설 것인지.",
          "그때 잘 생각해라. 나는 내 신념이 옳다고 믿지만, 그것이 정답이라고는 말하지 않겠다.",
        ],
        choices: [
          { text: "기억해두겠습니다", to: "farewell", effect: { rep: ["legion", 10], flag: "met_iron" } },
        ],
      },
      farewell: {
        lines: [
          "…이름 없는 자여.",
          "어느 족에도 속하지 않는다는 건 외로운 일이겠지. 하지만 부럽기도 하다.",
          "나는 태어날 때부터 철이었고, 죽을 때까지 철일 테니까.",
        ],
        choices: [{ text: "다시 뵙겠습니다", to: null }],
      },
      repeat: {
        lines: [
          "…또 만났군.",
          "몸조심해라. 이 대륙은 생각보다 험하다.",
        ],
        choices: [{ text: "네", to: null }],
      },
    },
  },

  // ---------------- 금 (Au) — 신전에 스스로를 가둔 황금 용 ----------------
  // 서쪽 폐허가 그 신전 터다. 3장에서 귀족 쪽의 목소리를 맡는다.
  // 백금은 보스로만 나오므로, 귀족의 말을 들려줄 사람이 따로 필요했다
  au: {
    start: "intro",
    starts: [
      { when: "boss_done_boss_pt", node: "mourning" },
      { when: "sided_legion", node: "enemy" },
      { when: "sided_noblesse", node: "ally" },
      { when: "stayed_neutral", node: "neutral" },
      { when: "chapter3", unless: "faction_chosen", node: "crossroads" },
    ],
    nodes: {
      intro: {
        lines: [
          "…누구냐. 여기는 내가 스스로를 가둔 곳이다.",
          "황금이 필요해서 왔다면 돌아가라. 나눠 준 황금이 어떻게 됐는지 아나? 전부 싸움의 씨앗이 됐다.",
          "…흥. 이 정도는 아무것도 아냐. 내가 최고거든. 그러니 아무도 필요 없어.",
        ],
        choices: [
          { text: "황금이 아니라 당신을 보러 왔어요", to: "lonely", effect: { codex: "au" } },
          { text: "…돌아갈게요", to: null, effect: { codex: "au" } },
        ],
      },
      lonely: {
        lines: [
          "…나를? 웃기는 소리.",
          "…은과 구리. 내 형제들이다. 수천 년 전에 흩어졌지. 은은 은선 공방에, 구리는 어느 마을에.",
          "가끔 생각한다. 우리 셋이 다시 한 자리에 서면 어떤 빛이 날까 하고.",
          "…됐다. 이런 얘기 처음 해 봤군. 너, 냄새가 없구나. 어느 족도 아닌 냄새.",
        ],
        choices: [{ text: "형제분들을 만나 볼게요", to: null, effect: { rep: ["noblesse", 5] } }],
      },
      crossroads: {
        lines: [
          "…철이 병력을 모았다지. 백금은 대성당에 귀족들을 불렀고.",
          "아름다운 것을 지키는 게 귀족의 의무다. 백금은 그렇게 믿는다. 나도… 한때는 그랬다.",
          "하지만 아름다움을 나눠 주려다 싸움만 일으킨 나로서는, 어느 쪽이 옳은지 말할 자격이 없다.",
          "그래도 묻겠다. 너는 어느 쪽에 서지?",
        ],
        choices: [
          {
            text: "귀족과 함께 서겠습니다",
            to: "chosen_noblesse",
            effect: { flags: ["sided_noblesse", "faction_chosen", "heard_noblesse"], rep: ["noblesse", 50], element: "au" },
          },
          {
            text: "어느 편에도 서지 않겠습니다",
            to: "chosen_neutral",
            effect: { flags: ["stayed_neutral", "faction_chosen", "heard_noblesse"], reps: [["legion", 10], ["noblesse", 10]] },
          },
          { text: "철의 말을 다시 듣고 오겠습니다", to: null, effect: { flag: "heard_noblesse" } },
        ],
      },
      chosen_noblesse: {
        lines: [
          "…그런가. 그럼 철이 막아설 거다. 서북쪽 요새 앞에서.",
          "그는 녹슬어도 부러지지 않아. 각오해라.",
          "…내 힘을 가져가라. 신전에 갇힌 황금이 밖에서 무슨 소용이겠나.",
        ],
        choices: [{ text: "감사합니다", to: null }],
      },
      chosen_neutral: {
        lines: [
          "…어느 쪽도 아니라. 나처럼 말인가.",
          "아니, 나와는 다르군. 나는 도망친 거고, 너는 서 있는 거니까.",
        ],
        choices: [{ text: "…", to: null }],
      },
      ally: {
        lines: ["…철은 서북쪽 요새 앞에 있다.", "가라. 나는 여기서 기다리지."],
        choices: [{ text: "네", to: null }],
      },
      enemy: {
        lines: [
          "…철 쪽에 섰다고 들었다.",
          "원망은 않는다. 다만 백금이 동쪽 숲 너머에서 널 기다린다. 그 아이는 물러서지 않아.",
        ],
        choices: [{ text: "…", to: null }],
      },
      neutral: {
        lines: ["…아직 어느 쪽도 아니군.", "그 눈으로 끝까지 봐라. 나는 못 했던 일이다."],
        choices: [{ text: "네", to: null }],
      },
      mourning: {
        lines: [
          "…백금이 졌다고.",
          "그 아이가 지킨 게 아름다움이었는지 자기 자신이었는지, 나도 모르겠다. 나도 같았으니까.",
        ],
        choices: [{ text: "…", to: null }],
      },
      repeat: {
        lines: ["…또 왔나.", "형제들은 만났나? …아니, 됐다. 묻지 않은 걸로 해라."],
        choices: [{ text: "네", to: null }],
      },
    },
  },

  // ---------------- 오가네손 (Og) — 안정의 섬을 찾는 항해자 ----------------
  // 남쪽 해변에 배를 대고 있다. 진엔딩 「안정의 섬」의 동행자.
  // 염소를 죽인 사람과는 함께 가지 않는다 — 안정을 찾는 자가 붕괴를 고른 자와
  // 같은 배를 탈 수는 없다
  og: {
    start: "intro",
    starts: [
      { when: "og_decided", node: "after" },
      { when: "boss_done_boss_cl", node: "voyage" },
    ],
    nodes: {
      intro: {
        lines: [
          "어이, 거기! 이 배 어때? 내가 직접 설계했어. 불안정한 바다를 건너온 유일한 배지.",
          "나는 오가네손. 118번. 안정의 섬을 찾고 있어. 이르면 그 풍경을 화폭에 담을 거야.",
          "…음? 너, 나랑 같은 냄새가 나는데. 바다 냄새. 저 너머에서 온 거지?",
        ],
        choices: [
          { text: "안정의 섬이 뭔가요?", to: "island", effect: { codex: "og" } },
          { text: "저도 제가 어디서 왔는지 몰라요", to: "same", effect: { codex: "og" } },
        ],
      },
      island: {
        lines: [
          "우리 초중원소는 태어나자마자 무너져. 1초도 못 버티는 애들이 대부분이지.",
          "그런데 계산상으로는 — 어딘가에 붕괴하지 않는 자리가 있어. 양성자와 중성자 수가 딱 맞는 곳.",
          "그게 안정의 섬이야. 아직 아무도 못 갔어. 그래서 내가 가려는 거고.",
        ],
        choices: [{ text: "저도 제가 어디서 왔는지 몰라요", to: "same" }],
      },
      same: {
        lines: [
          "그럼 너도 우리 쪽이네. 119번 — 아직 아무도 못 본 자리.",
          "…네가 어떻게 사는지 보고 싶어. 이 대륙이 무너지려는 걸 어떻게 대하는지.",
          "염소라고 있지? 아르곤이 되려고 무너지는 애. 그 애를 어떻게 하는지 보고 나서 다시 얘기하자.",
        ],
        choices: [{ text: "알겠어요", to: null, effect: { flag: "met_oganesson" } }],
      },
      voyage: {
        lines: [
          "…돌아왔네. 염소 얘기 들었어.",
        ],
        choices: [
          {
            text: "염소를 설득했어요",
            to: "offer",
            when: "persuaded_chlorine",
          },
          {
            text: "염소를… 쓰러뜨렸어요",
            to: "refuse",
            unless: "persuaded_chlorine",
          },
        ],
      },
      offer: {
        lines: [
          "죽이지 않고 멈추게 했다고? …그런 게 가능하구나.",
          "그게 내가 찾던 거야. 무너지지 않는 자리. 부수지 않고 멈추는 방법.",
          "결정했어. 안정의 섬에 갈 때 너랑 같이 가겠어. 이름 없는 자, 내 배에 타 줄래?",
        ],
        choices: [
          { text: "함께 가요", to: "joined", effect: { flags: ["oganesson_ally", "og_decided"], element: "og", rep: ["superheavy", 40] } },
          { text: "…아직은 여기 남을게요", to: "declined", effect: { flag: "og_decided" } },
        ],
      },
      joined: {
        lines: [
          "좋아! 그럼 마지막 일을 끝내고 와. 폴로늄이라는 애가 뭘 만들고 있대. 대륙이 무너지면 섬도 없으니까.",
          "고원 끝에서 기다린대. 다녀와. 배는 여기 있을 테니.",
        ],
        choices: [{ text: "다녀올게요", to: null }],
      },
      declined: {
        lines: ["…그래. 마음이 바뀌면 와. 배는 여기 있을 테니까.", "폴로늄 조심해. 고원 끝이야."],
        choices: [{ text: "네", to: null }],
      },
      refuse: {
        lines: [
          "…그랬구나.",
          "탓하진 않을게. 그 애는 위험했으니까. 하지만 나는 무너뜨리는 방법을 찾는 게 아니야.",
          "같이 갈 순 없겠다. 미안. …폴로늄 조심해. 고원 끝에서 뭔가 만들고 있어.",
        ],
        choices: [{ text: "…알겠어요", to: null, effect: { flags: ["og_decided", "og_refused"] } }],
      },
      after: {
        lines: ["폴로늄은 고원 끝이야. 대륙이 무너지면 섬도 없어.", "…조심해."],
        choices: [{ text: "네", to: null }],
      },
      repeat: {
        lines: ["염소를 어떻게 하는지 보고 나서 다시 얘기하자.", "석회암 고원 깊은 곳이래."],
        choices: [{ text: "네", to: null }],
      },
    },
  },

  // ---------------- 니호늄 (Nh) — 오가네손과 함께 온 초중원소 ----------------
  nh: {
    start: "intro",
    nodes: {
      intro: {
        lines: [
          "어, 어! 너! 처음 만난 순간 신비로운 인연을 느꼈어!",
          "나는 니호늄. 113번. 오가네손 배 타고 왔어. 서두르지 않으면 안 돼. 우리는 오래 못 버티거든.",
          "아연이랑 비스무트라는 애들이 이 대륙에 있대. 나랑 인연이 있는 것 같아. 만나 보고 싶어!",
        ],
        choices: [
          { text: "둘 다 만났어요", to: "met", effect: { codex: "nh" } },
          { text: "찾아볼게요", to: null, effect: { codex: "nh" } },
        ],
      },
      met: {
        lines: [
          "정말!? 어땠어? 아니, 말하지 마. 내가 직접 만날 거야.",
          "…고마워. 내 힘 조금 가져가. 얼마 못 버티는 힘이지만, 그래서 더 세게 빛나.",
        ],
        choices: [{ text: "고마워요", to: null, effect: { element: "nh" } }],
      },
      repeat: {
        lines: ["아연이랑 비스무트! 다시 만날 거야!"],
        choices: [{ text: "그래요", to: null }],
      },
    },
  },
};

// 주민 NPC의 짧은 대사. 파일이 너무 길어져 따로 뒀다
Object.assign(DIALOGUES, RESIDENT_DIALOGUES);

/** 이 원소와 대화할 수 있는가 */
export function hasDialogue(id) {
  return id in DIALOGUES;
}

/** 플래그 조건 — 문자열 하나 또는 배열(전부 만족) */
export function flagsMatch(cond, flags) {
  if (!cond) return true;
  return (Array.isArray(cond) ? cond : [cond]).every((f) => flags.has(f));
}

/**
 * 시작 노드를 고른다.
 * starts의 조건부 시작이 먼저, 그다음 이미 만났으면 repeat, 아니면 start.
 * @param {string} id 원소 id
 * @param {Set<string>} flags 진행 플래그
 */
export function startNode(id, flags) {
  const d = DIALOGUES[id];
  if (!d) return null;
  for (const s of d.starts ?? []) {
    if (!flagsMatch(s.when, flags)) continue;
    if (s.unless && (Array.isArray(s.unless) ? s.unless : [s.unless]).some((f) => flags.has(f))) continue;
    return s.node;
  }
  const metFlag = `talked_${id}`;
  if (flags.has(metFlag) && d.nodes.repeat) return "repeat";
  return d.start;
}
