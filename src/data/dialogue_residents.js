// 주민 NPC 23명의 짧은 대사.
//
// 이들이 없으면 도감 42종 중 정식 플레이로 만날 수 있는 원소가 17종뿐이라
// 진엔딩 조건(도감 90%)에 영영 닿지 못한다. 화합물 재료(Na·H·O·Zn·Pb·Ag)도
// 전부 여기서 나온다 — 조합표를 익혀도 재료가 없으면 읽을거리일 뿐이다.
//
// 원칙
//   · elements.js의 role과 어긋나지 않게 쓴다. 화학이 성격으로 번역되는 게 이 게임이다
//   · 마지막 선택지에서 힘(element)을 빌려준다. 다만 귀족 기체(Ne·Ar)는 반응하지
//     않는 것이 정체성이라 빌려주지 않는다 — 규칙이 곧 화학이다
//   · 대사 안에 실제 화학을 한 줄씩 심되, 초등 4~6학년이 읽을 수 있는 말로 쓴다
//
// 구조는 dialogue.js와 같다.

export const RESIDENT_DIALOGUES = {
  // ---------------- 광장 ----------------
  zn: {
    start: "intro",
    nodes: {
      intro: {
        lines: [
          "♪~ 아, 손님? 내 입으로 말하기 좀 쑥스러운데… 방금 건 내 신곡이야.",
          "나는 아연. 음악이랑 꽃이랑 맛있는 거 좋아해. 그리고 안정이 제일이지.",
        ],
        choices: [
          { text: "철 옆에 자주 계시던데요", to: "sacrifice", effect: { codex: "zn" } },
          { text: "좋은 곡이네요", to: "sacrifice", effect: { codex: "zn" } },
        ],
      },
      sacrifice: {
        lines: [
          "…들켰네. 철은 나보다 귀한데 나보다 쉽게 녹슬거든.",
          "그래서 내가 옆에 있으면 산소가 철 대신 나를 먹어. 희생 양극이라고 하더라.",
          "쑥스러우니까 비밀이야. …너한테도 조금 빌려줄게. 누군가를 대신 지키는 힘.",
        ],
        choices: [{ text: "고마워요", to: null, effect: { element: "zn", rep: ["neutral", 5] } }],
      },
      repeat: { lines: ["♪~ 새 곡 들어볼래? …아, 아직 안 됐다."], choices: [{ text: "다음에요", to: null }] },
    },
  },

  pb: {
    start: "intro",
    nodes: {
      intro: {
        lines: [
          "「이름 없는 자여, 그대는 어디서 왔는가!」 …어때, 지금 거 내 신작 1막 대사야.",
          "나는 납. 이 대륙에서 날 모르는 사람은 없지. 극중 역할에 사로잡히진 않아. 나는 자유인~",
        ],
        choices: [
          { text: "눈빛이… 알 수 없네요", to: "eyes", effect: { codex: "pb" } },
          { text: "무슨 역을 하세요?", to: "eyes", effect: { codex: "pb" } },
        ],
      },
      eyes: {
        lines: [
          "다들 그러더라. 의도를 모르겠다고. 그게 배우의 얼굴이야.",
          "무겁고 무르고, 뭐든 막아 주지. 방사선도 나를 못 뚫어. 대신 오래 곁에 두면 안 돼 — 그게 내 역할의 대가.",
          "가져가. 막아 주는 힘. 대신 너무 오래 붙들지는 말고.",
        ],
        choices: [{ text: "명심할게요", to: null, effect: { element: "pb", rep: ["neutral", 5] } }],
      },
      repeat: { lines: ["「2막은 아직이야.」 …라고 하면 멋있지?"], choices: [{ text: "네", to: null }] },
    },
  },

  n: {
    start: "intro",
    nodes: {
      intro: {
        lines: [
          "아, 안녕하세요. 질소라고 합니다. 탄소 선생님 밑에서 공부하고 있어요.",
          "…또 부탁이신가요? 아니, 죄송해요. 요즘 다들 어려운 문제를 저한테 떠넘겨서.",
        ],
        choices: [
          { text: "별명이 많다고 들었어요", to: "nick", effect: { codex: "n" } },
          { text: "부탁은 아니에요", to: "nick", effect: { codex: "n" } },
        ],
      },
      nick: {
        lines: [
          "미친 폭탄이니, 죽음의 공기니… 제발 그만 불러 줬으면 해요.",
          "저는 그냥 셋이서 손을 꼭 잡고 있을 뿐이에요. 삼중 결합이요. 풀기 어려운 만큼, 풀리면 크게 터지는 거지만.",
          "…공기의 8할이 저예요. 여러분이 숨 쉬는 동안 늘 옆에 있죠. 조금 빌려 드릴게요.",
        ],
        choices: [{ text: "감사합니다", to: null, effect: { element: "n", rep: ["neutral", 5] } }],
      },
      repeat: { lines: ["…또 부탁이신가요? 아, 아니시구나. 다행이에요."], choices: [{ text: "네", to: null }] },
    },
  },

  na: {
    start: "intro",
    nodes: {
      intro: {
        lines: [
          "어서 와! 소듐 식당… 아니, 식당은 아니고. 주방에 못 들어가거든. 물이 있어서.",
          "물은 안 돼. 절대. 전자 하나가 너무 헐렁해서, 물만 닿으면 펑이야.",
        ],
        choices: [
          { text: "그럼 요리는 어떻게…", to: "salt", effect: { codex: "na" } },
          { text: "우물 옆인데 괜찮으세요?", to: "salt", effect: { codex: "na" } },
        ],
      },
      salt: {
        lines: [
          "염소랑 손을 잡으면 돼. 내 전자 하나를 걔가 가져가면 소금이 되거든. 그때만 마음껏 음식에 들어가.",
          "…걔가 요즘 이상해졌지만. 아르곤이 되겠다나. 나랑 손잡을 때는 그런 소리 안 했는데.",
          "자, 내 힘 가져가. 물가에서만 조심하고. 맛은 보장할게.",
        ],
        choices: [{ text: "고마워요", to: null, effect: { element: "na", rep: ["neutral", 5] } }],
      },
      repeat: { lines: ["물 근처 아니지? …그래, 그럼 됐어."], choices: [{ text: "네", to: null }] },
    },
  },

  // ---------------- 마을 북쪽 ----------------
  o: {
    start: "intro",
    nodes: {
      intro: {
        lines: [
          "…오셨군요. 산소라 합니다. 이 대륙의 윤회를 맡고 있지요.",
          "세계는 끝없이 순환합니다. 생명도, 쇠도, 불도. 전부 저를 거쳐 돌고 돌지요.",
        ],
        choices: [
          { text: "윤회라니요?", to: "cycle", effect: { codex: "o" } },
          { text: "철이 녹스는 것도요?", to: "cycle", effect: { codex: "o" } },
        ],
      },
      cycle: {
        lines: [
          "숨을 쉬면 제가 몸에 들어가고, 태우면 제가 재를 남기고, 쇠에 붙으면 녹이 됩니다.",
          "전기음성도 3.44. 플루오린 다음으로 전자를 세게 당기지요. 그래서 무엇이든 저와 섞이면 형태를 바꿉니다.",
          "영원히 사는 눈에 변하는 것들은… 아름답습니다. 당신도 변하시겠지요. 힘을 드리겠습니다.",
        ],
        choices: [{ text: "감사합니다", to: null, effect: { element: "o", rep: ["neutral", 5] } }],
      },
      repeat: { lines: ["돌고 돌아, 다시 오셨군요."], choices: [{ text: "네", to: null }] },
    },
  },

  ar: {
    start: "intro",
    // 염소 문제가 끝난 뒤에는 고마워서 한 번 반응한다 — 「귀족 기체 회의」 인연이
    // 살아나려면 아르곤을 얻을 길이 하나는 있어야 한다
    starts: [{ when: "boss_done_boss_cl", unless: "ar_lent", node: "thanks" }],
    nodes: {
      thanks: {
        lines: [
          "…zzz. 응? 아, 너구나. 염소 얘기 들었어~ 걔가 이제 나를 안 쫓아온대.",
          "고마워서 말인데… 나 원래 아무하고도 반응 안 하거든? 근데 한 번쯤은 괜찮겠지.",
          "자, 가져가. 아무것도 안 하는 힘이야. 그게 제일 세~ zzz.",
        ],
        choices: [{ text: "…고마워요", to: null, effect: { flag: "ar_lent", element: "ar", rep: ["noble_gas", 10] } }],
      },
      intro: {
        lines: [
          "…zzz. …응? 아, 손님이야? 아르곤이야~ 아르곤 고원 마을 촌장. 지금은 출장 중… 이랄까, 낮잠 중.",
          "곤란하기도 하지, 아무 일도 안 하는데 모두에게 도움이 되고 있다니~",
        ],
        choices: [
          { text: "염소가 당신이 되고 싶어 해요", to: "chlorine", effect: { codex: "ar" } },
          { text: "정말 아무것도 안 하세요?", to: "chlorine", effect: { codex: "ar" } },
        ],
      },
      chlorine: {
        lines: [
          "염소? 아~ 걔. 내 옆 칸이지. 전자 하나만 더 있으면 나랑 배치가 같아진대.",
          "근데 말이야, 배치가 같아져도 양성자는 17개 그대로잖아. 나는 18개고. 그러니까 걔는 영원히 염소야.",
          "…그렇게 말해 주고 싶은데, 귀찮아서. 네가 대신 말해 줘. 힘은 못 빌려줘. 나는 반응 안 하거든~ zzz.",
        ],
        choices: [{ text: "…알겠어요", to: null, effect: { rep: ["noble_gas", 5] } }],
      },
      repeat: { lines: ["…zzz. 아무것도 안 하는 중~"], choices: [{ text: "주무세요", to: null }] },
    },
  },

  ne: {
    start: "intro",
    // 어느 편도 들지 않은 자에게만 — 반응하지 않는 것이 법인 재판관이
    // 유일하게 인정하는 것은 같은 중립이다. 중립 루트의 보상 역할도 한다
    starts: [{ when: "stayed_neutral", unless: "ne_lent", node: "verdict" }],
    nodes: {
      verdict: {
        lines: [
          "…어느 편에도 서지 않았다고 들었다. 군단도, 귀족도.",
          "판결하지. 공정하다. 나와 같은 방식으로 서 있군.",
          "반응하지 않는 게 내 법이지만 — 법에는 판례가 있다. 가져가라. 이건 선례로 남긴다.",
        ],
        choices: [{ text: "감사합니다", to: null, effect: { flag: "ne_lent", element: "ne", rep: ["noble_gas", 10] } }],
      },
      intro: {
        lines: [
          "불간섭 회의소 소장 네온이다. 여기서 뭘 하냐고? 순회 재판. 변두리도 법정은 필요하지.",
          "시대는 흐르고 흘러 새로운 것이 옛것이 되어간다. 너는… 새로운 것 쪽이군.",
        ],
        choices: [
          { text: "귀족 기체는 왜 재판을 맡죠?", to: "court", effect: { codex: "ne" } },
          { text: "빛나시네요", to: "court", effect: { codex: "ne" } },
        ],
      },
      court: {
        lines: [
          "우리는 누구와도 반응하지 않는다. 전자 여덟이 꽉 차 있으니 빼앗을 것도 줄 것도 없지.",
          "그래서 판결이 공정하다. 어느 쪽에서도 전자를 받은 적이 없으니까.",
          "…너도 그렇더군. 어느 족도 아니라서 어느 편도 아니다. 힘은 못 준다. 반응하지 않는 게 내 법이다. 대신 기억해 두지.",
        ],
        choices: [{ text: "감사합니다", to: null, effect: { rep: ["noble_gas", 5] } }],
      },
      repeat: { lines: ["판결은 공정하다. 언제나."], choices: [{ text: "네", to: null }] },
    },
  },

  sb: {
    start: "intro",
    nodes: {
      intro: {
        lines: [
          "밤길에 혼자라니, 위험하지 않니? …아, 나는 안티모니. 활자 주조소 수도사야.",
          "낮에는 활자를 찍고 밤에는… 뭐, 성당 주변 평온을 지키지. 참회하기엔 아직 일러. 수다나 떨자.",
        ],
        choices: [
          { text: "밤에 뭘 하시는데요?", to: "night", effect: { codex: "sb" } },
          { text: "활자요?", to: "night", effect: { codex: "sb" } },
        ],
      },
      night: {
        lines: [
          "활자는 납에 나를 섞어 만들어. 나는 굳을 때 살짝 부풀거든. 그래서 글자 모서리가 또렷해지지.",
          "밤 일은… 퇴마사. 비밀이야. 준금속이라 금속도 비금속도 아니니까 어느 쪽 귀신이든 상대할 수 있어.",
          "너도 어느 쪽도 아니지? 그럼 잘 맞겠다. 가져가.",
        ],
        choices: [{ text: "고마워요", to: null, effect: { element: "sb", rep: ["neutral", 5] } }],
      },
      repeat: { lines: ["밤이 깊어질 때까지 수다나 떨자."], choices: [{ text: "다음에요", to: null }] },
    },
  },

  nb: {
    start: "intro",
    nodes: {
      intro: {
        lines: [
          "이런 것도 못 해? 내가 도와줄까? …아, 아직 아무것도 안 했구나. 그래도 도와줄까?",
          "나이오븀이다. 저승에서 왔지. 저기 계신 분이 탄탈럼. 내 아버지 같은 분이야.",
        ],
        choices: [
          { text: "저승이요?", to: "under", effect: { codex: "nb" } },
          { text: "탄탈럼 씨는 왜 안 움직이세요?", to: "under", effect: { codex: "nb" } },
        ],
      },
      under: {
        lines: [
          "우리 둘은 늘 같은 광석에 붙어 나와. 갈라내기가 지독하게 어렵지. 그래서 저승 부자(父子)라고들 해.",
          "탄탈럼 님은 저주로 못 움직여. 그래서 내가 대신 돌아다니지. 자랑은 아니지만 내가 좀 뛰어나거든.",
          "…힘 필요해? 줄게. 내가 최고니까.",
        ],
        choices: [{ text: "고마워요", to: null, effect: { element: "nb", rep: ["neutral", 5] } }],
      },
      repeat: { lines: ["이런 것도 못 해? 내가 도와줄까?"], choices: [{ text: "괜찮아요", to: null }] },
    },
  },

  ta: {
    start: "intro",
    nodes: {
      intro: {
        lines: [
          "…움직일 수 없어 미안하네. 탄탈럼이야. 저주를 받아서.",
          "나이오븀은 정말 착한 아이야. 성격에 무게가 좀 있기는 하지만….",
        ],
        choices: [
          { text: "무슨 저주인가요?", to: "curse", effect: { codex: "ta" } },
          { text: "나이오븀 씨가 걱정하던데요", to: "curse", effect: { codex: "ta" } },
        ],
      },
      curse: {
        lines: [
          "물에 잠겨도 마실 수 없고, 손을 뻗어도 닿지 않는다. 그런 벌이지. 나는 산에도 녹지 않아 — 무엇과도 반응하지 않는다는 뜻이야.",
          "그래서 몸속에 넣어도 거부되지 않아. 의사들이 나를 뼈에 쓴다더군. 저주가 누군가에겐 쓸모가 되는 거지.",
          "…힘을 빌려주지. 무엇에도 삭지 않는 힘. 그 아이 곁에 있어 줘서 고맙네.",
        ],
        choices: [{ text: "감사합니다", to: null, effect: { element: "ta", rep: ["neutral", 5] } }],
      },
      repeat: { lines: ["…나이오븀은 잘 있나. 그럼 됐네."], choices: [{ text: "네", to: null }] },
    },
  },

  // ---------------- 공방 · 군단 ----------------
  mn: {
    start: "intro",
    nodes: {
      intro: {
        lines: [
          "에헤헤, 어서 와요~ 망가니즈예요. 안 쓰는 무기 있으면 나한테 팔아요. 재활용하게~",
          "철 대장님이랑은 오래된 사이예요. 대장님 칼은 전부 내가 두드린 거거든요.",
        ],
        choices: [
          { text: "합금이 뭔가요?", to: "alloy", effect: { codex: "mn" } },
          { text: "무기 만드는 게 생업이시군요", to: "alloy", effect: { codex: "mn" } },
        ],
      },
      alloy: {
        lines: [
          "철만 있으면 물러요. 거기에 나를 조금 섞으면 단단해지고 잘 안 부서져요. 그게 강철이죠.",
          "혼자보다 둘이 낫다는 거예요. 인연이라는 게 그런 거고~",
          "자, 이건 서비스. 내 힘 조금. 철이랑 같이 편성하면 더 세질 거예요.",
        ],
        choices: [{ text: "감사합니다", to: null, effect: { element: "mn", rep: ["legion", 5] } }],
      },
      repeat: { lines: ["안 쓰는 무기 있어요? 없어요? 아쉽다~"], choices: [{ text: "다음에요", to: null }] },
    },
  },

  co: {
    start: "intro",
    nodes: {
      intro: {
        lines: [
          "오호호! 그칠 줄 모르는 나의 식욕… 아, 실례. 코발트라 하옵니다. 군단 소속이지요.",
          "말투가 기품 있다고요? 오호호, 사실은 평민 출신이랍니다. 봉급은 대부분 고향에 보내고요.",
        ],
        choices: [
          { text: "꿈이 뭐예요?", to: "dream", effect: { codex: "co" } },
          { text: "니켈 씨랑 같이 계시네요", to: "dream", effect: { codex: "co" } },
        ],
      },
      dream: {
        lines: [
          "탐험가! 가난하게 자라서 그런지 마찰에는 강하답니다. 어디든 갈 수 있어요.",
          "니켈이 늘 저를 말리지만요. 오호호. 그래도 둘이 나란히 서면 어떤 방패보다 든든하답니다.",
          "힘이 필요하시면 가져가세요. 닳지 않는 힘이랍니다.",
        ],
        choices: [{ text: "고마워요", to: null, effect: { element: "co", rep: ["legion", 5] } }],
      },
      repeat: { lines: ["오호호! 오늘도 배가 고프군요!"], choices: [{ text: "…네", to: null }] },
    },
  },

  ni: {
    start: "intro",
    nodes: {
      intro: {
        lines: [
          "덧씌움 진형 대장 니켈이다. …코발트는 대식가가 분명해. 방금 또 뭘 먹더군.",
          "우리 부대는 공격받을수록 단단해진다. 두들길수록 조직이 촘촘해지거든.",
        ],
        choices: [
          { text: "두들길수록 단단해진다고요?", to: "harden", effect: { codex: "ni" } },
          { text: "코발트 씨를 잘 챙기시네요", to: "harden", effect: { codex: "ni" } },
        ],
      },
      harden: {
        lines: [
          "가공 경화라고 한다. 우리 전이 금속의 성질이지. 맞을수록 무뎌지는 게 아니라 여물어진다.",
          "코발트는 늘 흥분해 있어서 누군가 달래야 해. 그게 내 일이다. …싫지는 않아.",
          "힘을 빌려주지. 버티는 힘이다.",
        ],
        choices: [{ text: "감사합니다", to: null, effect: { element: "ni", rep: ["legion", 5] } }],
      },
      repeat: { lines: ["코발트는… 또 먹고 있군."], choices: [{ text: "네", to: null }] },
    },
  },

  be: {
    start: "intro",
    nodes: {
      intro: {
        lines: [
          "이 창은 빛을 그냥 통과시켜. 막으라고 만든 게 아니라 지나가라고 만든 거야.",
          "…어머, 손님? 베릴륨이에요. 물리학자. 쿠키도 굽고요. 하나 드실래요?",
        ],
        choices: [
          { text: "그게 왜 신기해요?", to: "barrier", effect: { codex: "be" } },
          { text: "쿠키 주세요", to: "barrier", effect: { codex: "be" } },
        ],
      },
      barrier: {
        lines: [
          "보통 것들은 빛을 가로막아. 그런데 내가 만든 창은 그냥 지나가게 둬.",
          "…연애도 비슷하답니다. 마지막 한 걸음이 제일 어려워요. 후후.",
          "나는 가볍고 단단해요. 우주선 창에 쓰죠. 조금 빌려 드릴게요. 쿠키도요.",
        ],
        choices: [{ text: "고마워요", to: null, effect: { element: "be", rep: ["neutral", 5] } }],
      },
      repeat: { lines: ["쿠키 더 드실래요? 연구는… 아직이에요."], choices: [{ text: "괜찮아요", to: null }] },
    },
  },

  // ---------------- 농경지 · 동쪽 ----------------
  cu: {
    start: "intro",
    nodes: {
      intro: {
        lines: [
          "어라, 못 보던 얼굴인데? 아, 반가워. 구리야. 이 근처 전선은 다 내가 깔았어.",
          "옛날엔 귀금속 형제였는데, 아주 오래전에 헤어졌어. 지금은 그냥 마을 사람. 전깃줄도 해 주고 냄비도 해 주고.",
        ],
        choices: [
          { text: "금과 은이 형제라고요?", to: "brothers", effect: { codex: "cu" } },
          { text: "전선이요?", to: "brothers", effect: { codex: "cu" } },
        ],
      },
      brothers: {
        lines: [
          "금·은·나. 셋이 성질이 닮았어. 잘 늘어나고 전기를 잘 통하고.",
          "제일 빠른 건 은이야. 근데 비싸서 다들 나를 써. 서운하진 않아, 하하.",
          "셋이 다시 모이면 좋겠다. 내 힘 가져가. 그 둘 만나면 안부 전해 줘.",
        ],
        choices: [{ text: "전할게요", to: null, effect: { element: "cu", rep: ["noblesse", 5] } }],
      },
      repeat: { lines: ["형제들은… 아직이지? 그래, 천천히."], choices: [{ text: "네", to: null }] },
    },
  },

  k: {
    start: "intro",
    nodes: {
      intro: {
        lines: [
          "허허, 밭에 뭐 볼 게 있다고. 포타슘일세. 이 밭은 내가 먹여 살리지.",
          "아래로 갈수록 더 쉽게 내주게 되지. 그게 1족의 숙명이야. 소듐보다 내가 한 칸 아래거든.",
        ],
        choices: [
          { text: "더 쉽게 내준다는 게 무슨 뜻이죠?", to: "give", effect: { codex: "k" } },
          { text: "밭이 넓네요", to: "give", effect: { codex: "k" } },
        ],
      },
      give: {
        lines: [
          "전자 말일세. 바깥 껍질이 멀수록 핵이 못 붙들어. 그래서 물에 닿으면 소듐보다 세게 터지지. 보라색 불꽃으로.",
          "식물은 나 없이 못 자라. 나는 어디에도 오래 못 머무는데, 그 덕에 어디든 스며드는 게지.",
          "가져가게. 아낌없이 내주는 힘이야. 물만 조심하고.",
        ],
        choices: [{ text: "감사합니다", to: null, effect: { element: "k", rep: ["neutral", 5] } }],
      },
      repeat: { lines: ["허허, 밭은 잘 크고 있네."], choices: [{ text: "네", to: null }] },
    },
  },

  ti: {
    start: "intro",
    nodes: {
      intro: {
        lines: [
          "야! 다들 청소 시간이야! 타이타늄, 오늘도 파이팅!!!!",
          "…어? 고객님? 타이타늄 청소업체입니다! 뭐든 단숨에 깨끗하게 만들어 드려요!",
        ],
        choices: [
          { text: "청소가… 전투 같은데요", to: "clean", effect: { codex: "ti" } },
          { text: "거인이시네요", to: "clean", effect: { codex: "ti" } },
        ],
      },
      clean: {
        lines: [
          "청소가 곧 전투죠! 저는 가볍고 튼튼하고 녹슬지 않아요. 비행기도 저로 만들어요!",
          "표면에 산화막이 딱 덮여서 그 안은 절대 안 녹슬어요. 그래서 바닷물도 문제없죠!",
          "고객님도 파이팅! 힘 드릴게요! 깨끗하게!",
        ],
        choices: [{ text: "고, 고마워요", to: null, effect: { element: "ti", rep: ["legion", 5] } }],
      },
      repeat: { lines: ["청소 시간이야!!!! 파이팅!!!!"], choices: [{ text: "…파이팅", to: null }] },
    },
  },

  sc: {
    start: "intro",
    nodes: {
      intro: {
        lines: [
          "잠깐, 저 흰 그림자는 뭐야? 귀신!?!? …휴우, 사람이구나. 스칸듐이야. 야구 선수.",
          "덩치만 크지 겁이 많아서. 특히 귀신. 밤에는 밖에 안 나가.",
        ],
        choices: [
          { text: "야구요?", to: "bat", effect: { codex: "sc" } },
          { text: "귀신은 없어요", to: "bat", effect: { codex: "sc" } },
        ],
      },
      bat: {
        lines: [
          "알루미늄 방망이에 나를 조금 섞으면 가볍고 단단해져. 홈런이 더 잘 나와!",
          "나는 희토류 취급받는데 사실 별로 희귀하진 않아. 그냥 모아 두기가 어려울 뿐이야. …나처럼.",
          "힘 줄게. 대신 귀신 나오면 나 대신 좀 봐 줘.",
        ],
        choices: [{ text: "알겠어요", to: null, effect: { element: "sc", rep: ["legion", 5] } }],
      },
      repeat: { lines: ["…귀신 없지? 없지? 좋아."], choices: [{ text: "없어요", to: null }] },
    },
  },

  ag: {
    start: "intro",
    nodes: {
      intro: {
        lines: [
          "…이 숲까지 오는 사람은 드문데. 은이야. 저 너머에 내가 만든 은선 공방가 있어.",
          "금속으로서의 가치 따윈 아무래도 좋아. 저 아이가 웃어준다면….",
        ],
        choices: [
          { text: "저 아이라니요?", to: "mirror", effect: { codex: "ag" } },
          { text: "구리 씨가 안부를 전하래요", to: "mirror", effect: { codex: "ag" } },
        ],
      },
      mirror: {
        lines: [
          "금. 그리고 구리. 수천 년 전에 흩어진 형제들이야. 거울은 그들이 어디 있든 비추라고 만든 거고.",
          "나는 모든 금속 중에 빛을 가장 잘 되돌려. 그래서 거울이 되지. …되돌리기만 하고, 다가가지는 못하지만.",
          "구리가… 안부를? …고마워. 내 힘을 가져가. 빛을 되돌리는 힘이야.",
        ],
        choices: [{ text: "고마워요", to: null, effect: { element: "ag", rep: ["noblesse", 5] } }],
      },
      repeat: { lines: ["…거울은 오늘도 비어 있어."], choices: [{ text: "…", to: null }] },
    },
  },

  rn: {
    start: "intro",
    nodes: {
      intro: {
        lines: [
          "헤헤, 온천 리조트 '김 오르는 골'에 오신 걸 환영합니다~ 라돈이에요. 이 사탕 줄까?",
          "…건강 상품은 좀 의심스럽지만 온천은 두말할 나위 없이 최고!",
        ],
        choices: [
          { text: "방사성 기체 아니에요?", to: "spa", effect: { codex: "rn" } },
          { text: "사탕은 됐어요", to: "spa", effect: { codex: "rn" } },
        ],
      },
      spa: {
        lines: [
          "맞아~ 귀족 기체 중에 유일하게 방사성이야. 우라늄이 무너지면 내가 나오거든. 그래서 온천물에 섞여 있지.",
          "조금은 몸에 좋다고 하고, 많이는 안 좋고. 그게 김 오르는 골야. 뭐든 양이 문제라니까.",
          "힘 줄게. 조금만 쓰면 좋고 많이 쓰면… 헤헤.",
        ],
        choices: [{ text: "…조금만 쓸게요", to: null, effect: { element: "rn", rep: ["exiled", 5] } }],
      },
      repeat: { lines: ["온천은 최고! 사탕도 최고!"], choices: [{ text: "네…", to: null }] },
    },
  },

  // ---------------- 남쪽 길 · 서쪽 ----------------
  h: {
    start: "intro",
    nodes: {
      intro: {
        lines: [
          "…어, 너. 나랑 같은 냄새가 나네. 자리가 없는 냄새.",
          "수소야. 1번. 제일 먼저 태어났고 제일 많은데, 주기율표에서는 꼭대기에 혼자 있어. 1족도 아니고 17족도 아니고.",
        ],
        choices: [
          { text: "외롭지 않아요?", to: "alone", effect: { codex: "h" } },
          { text: "저도 자리가 없어요", to: "alone", effect: { codex: "h" } },
        ],
      },
      alone: {
        lines: [
          "나도 내 자리가 어딘지 몰라. 그래도 여태 잘 살아왔는걸.",
          "전자 하나를 주면 1족 같고, 하나를 받으면 17족 같아. 어느 쪽도 아니니까 어느 쪽이든 될 수 있는 거지.",
          "산소랑 손잡으면 물이 돼. 너도 누군가랑 손잡아 봐. 자, 내 힘. 제일 가벼운 힘이야.",
        ],
        choices: [{ text: "고마워요", to: null, effect: { element: "h", rep: ["neutral", 5] } }],
      },
      repeat: { lines: ["어디로 가는 길이야? …나도 몰라. 그냥 걷는 중."], choices: [{ text: "같이 걸어요", to: null }] },
    },
  },

  s: {
    start: "intro",
    nodes: {
      intro: {
        lines: [
          "날 늘 욕조에 몸을 담그고 있는 노인이라고 말한 게 너냐? 배짱이 두둑하군!",
          "…아니라고? 흠. 황이다. 용의 왕. 이래 봬도 내가 걸으면 황금빛 다리가 놓인다는 전설이 있지.",
        ],
        choices: [
          { text: "용의 왕이시라고요?", to: "king", effect: { codex: "s" } },
          { text: "온천 냄새가 나요", to: "king", effect: { codex: "s" } },
        ],
      },
      king: {
        lines: [
          "온천 냄새는 나다. 화산 근처에 내가 노랗게 굳어 있지. 115도면 녹아서 땅속을 흐르고.",
          "금속들이 나랑 손잡으면 광석이 돼. 아연은 섬아연석, 납은 방연석, 수은은 진사. 다들 내 신하지.",
          "…배짱이 마음에 든다. 가져가라. 용의 왕의 힘이다.",
        ],
        choices: [{ text: "감사합니다", to: null, effect: { element: "s", rep: ["neutral", 5] } }],
      },
      repeat: { lines: ["온천에 들어갈 시간이군. 물러가라."], choices: [{ text: "네", to: null }] },
    },
  },

  bi: {
    start: "intro",
    nodes: {
      intro: {
        lines: [
          "…저기 …내 얼굴에 뭐가 묻었니…?",
          "…아. 비스무트야. 이 폐허… 내가 지은 거야. 오래전에. 사람을 피해서 눈 덮인 산에 살다가, 가끔 보러 와.",
        ],
        choices: [
          { text: "얼굴이 결정 같아요", to: "crystal", effect: { codex: "bi" } },
          { text: "훌륭한 건축이에요", to: "crystal", effect: { codex: "bi" } },
        ],
      },
      crystal: {
        lines: [
          "…녹았다 굳으면 계단 모양으로 자라. 무지개색 산화막이 덮이고. 다들 그걸 보고 이상하다고 해서… 숨었어.",
          "나는 안정한 원소 중에 제일 무거워. 그 아래는 전부 무너지는 애들이야. 폴로늄, 라돈….",
          "…이 폐허 예쁘다고 해 준 건 네가 처음이야. …가져가. 무거운 힘이지만.",
        ],
        choices: [{ text: "고마워요", to: null, effect: { element: "bi", rep: ["neutral", 5] } }],
      },
      repeat: { lines: ["…또 왔구나. …고마워."], choices: [{ text: "네", to: null }] },
    },
  },
};
