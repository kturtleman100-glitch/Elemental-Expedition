import * as THREE from "three";
import { animateCharacter } from "./CharacterBuilder.js";
import { updateCharacter, animateVRM } from "./CharacterLoader.js";
import { getElement } from "../data/elements.js";
import { makeNameplate, fadeNameplate, setNameplate } from "../fx/Nameplate.js";

// 마을에 서 있는 원소 캐릭터.
//
// 지금은 제자리에서 숨쉬고 플레이어를 바라보는 것까지만 한다.
// 대화·퀘스트는 Dialogue/Quest가 붙으면서 여기에 연결된다.

const LOOK_RANGE = 11; // 이 거리 안에 들어오면 플레이어 쪽으로 몸을 돌린다
// 대화 거리. 3.6m는 너무 좁아 조금만 떨어져도 반응이 없었고,
// 그래서 "말이 안 걸린다"고 느껴졌다. 사람 키의 세 배쯤이면 자연스럽다
const TALK_RANGE = 5.4;
const TURN_SPEED = 3.5;
const SLEEP_RANGE = 30;

export class NPC {
  /**
   * @param {THREE.Object3D} model CharacterLoader.build()의 결과
   * @param {{x:number, z:number, yaw?:number, elementId:string}} spec
   */
  constructor(model, spec) {
    this.model = model;
    this.element = getElement(spec.elementId);
    this.x = spec.x;
    this.z = spec.z;
    this.homeYaw = spec.yaw ?? 0;
    this.yaw = this.homeYaw;
    this.time = Math.random() * 10; // 여럿이 같은 박자로 숨쉬지 않게 흩어놓는다
    this.nearPlayer = false;
    this.inTalkRange = false;
    this.distance = Infinity;

    // 마을은 평지라 대개 0이지만, 밖에 세울 NPC를 위해 지형을 따른다
    model.position.set(this.x, this.y ?? 0, this.z);
    model.rotation.y = this.yaw;

    // 이름표. 적은 붉고 이쪽은 푸르러서 색만으로 먼저 구분된다
    this.plate = makeNameplate(this.element.ko, "NPC");
    model.add(this.plate);
    this.talked = false;
  }

  /**
   * 이야기를 나눈 사람으로 표시한다.
   * 누구와 이미 말했는지 보이지 않으면 마을을 한 바퀴 돌 때마다 처음부터
   * 다시 말을 걸어 보게 된다
   */
  markTalked() {
    if (this.talked) return;
    this.talked = true;
    setNameplate(this.plate, `${this.element.ko} ✓`, "DONE");
  }

  /** @param {THREE.Vector3} playerPos */
  update(dt, playerPos) {
    const dx = playerPos.x - this.x;
    const dz = playerPos.z - this.z;
    const dist = Math.hypot(dx, dz);

    // 멀리 있으면 갱신도 렌더도 멈춘다 — 스프링본 물리가 특히 비싸다
    if (dist > SLEEP_RANGE) {
      if (this.model.visible) this.model.visible = false;
      this.nearPlayer = false;
      this.inTalkRange = false;
      this.distance = dist;
      return;
    }
    if (!this.model.visible) this.model.visible = true;
    this.time += dt;
    this.distance = dist;
    fadeNameplate(this.plate, dist);
    this.nearPlayer = dist < LOOK_RANGE;
    this.inTalkRange = dist < TALK_RANGE;

    // 가까이 오면 플레이어를, 아니면 원래 방향을 본다
    const target = this.nearPlayer ? Math.atan2(dx, dz) : this.homeYaw;
    let diff = ((target - this.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    this.yaw += diff * Math.min(1, TURN_SPEED * dt);
    this.model.rotation.y = this.yaw;

    // 제자리에 서 있으므로 걷기 강도는 0 — 숨쉬는 동작만 나온다
    if (this.model.userData.source === "vrm") {
      animateVRM(this.model, this.time, 0, null);
      updateCharacter(this.model, dt);
    } else {
      animateCharacter(this.model, this.time, 0, null);
    }
  }
  /**
   * 모델을 갈아끼운다. VRM이 뒤늦게 도착했을 때 부른다.
   *
   * 자리와 방향을 그대로 옮겨야 갑자기 다른 데를 보고 서 있지 않는다.
   * 씬에서 옛 모델을 빼는 일은 부르는 쪽이 한다 — 여기서 scene을 알면
   * NPC가 렌더링 구조를 알게 된다.
   */
  swapModel(next) {
    next.position.copy(this.model.position);
    next.rotation.y = this.model.rotation.y;
    next.visible = this.model.visible;
    const old = this.model;
    this.model = next;
    return old;
  }
}

/**
 * 석회 마을 NPC 배치.
 *
 * 구역별로 흩어놓아야 심부름에 거리가 생긴다. 좌표는 World.js의 구역 배치를 따른다.
 * yaw는 그 인물이 평소 바라보는 방향 — 광장 쪽이나 자기 일터 쪽을 향한다.
 */
export const NPC_PLACEMENTS = [
  // 광장 — 처음 마주치는 인물
  { elementId: "mg", x: 4.5, z: 6.0, yaw: Math.PI * 0.9 },

  // 공방 구역 — 불씨 운송 앞. 화로 연합 대장이 마을에 들렀다는 설정
  { elementId: "fe", x: -34, z: 21, yaw: 1.1 },

  // 아래는 아직 .vrm 이 없어 절차적 생성으로 나온다
  { elementId: "ca", x: 0, z: -46, yaw: 0 },          // 촌장 집 앞
  { elementId: "p", x: -38, z: 32, yaw: 0.3 },        // 불씨 운송 하역장
  { elementId: "c", x: -8.0, z: 9.5, yaw: -0.5 },     // 광장 좌판 근처
  { elementId: "si", x: -13, z: 15, yaw: -0.9 },      // 광장 서쪽, 혼자 떨어져

  // ---- 이야기의 갈림길을 맡는 인물 ----
  // 금 — 서쪽 폐허가 그가 스스로를 가둔 신전 터. 수은(-100,28)의 감지 범위 밖에 둔다
  { elementId: "au", x: -120, z: 28, yaw: 1.4 },
  // 오가네손·니호늄 — 남쪽 모래사장. 플레이어가 떠밀려 온 곳에 배를 댔다
  { elementId: "og", x: 14, z: 142, yaw: Math.PI },   // 바닷가 나루 — 배를 대는 곳
  { elementId: "nh", x: -4, z: 141, yaw: Math.PI * 0.9 },

  // ---- 주민 ----
  // 도감 42종을 정식 플레이로 채우려면 만날 수 있는 얼굴이 이만큼은 있어야 한다.
  // 집 안에 서지 않도록 World.js의 가옥 좌표에서 4m 이상 띄웠고,
  // 적의 감지 범위(9.5m)에서도 벗어나게 뒀다 — 대화하러 왔다가 얻어맞으면 안 된다.
  { elementId: "zn", x: 10, z: -8, yaw: 2.6 },        // 광장 북쪽 — 노래하는 자리
  { elementId: "pb", x: -6, z: -6, yaw: 0.6 },        // 광장 — 즉석 무대
  { elementId: "n", x: 3, z: 21, yaw: Math.PI },      // 광장 남쪽, 탄소 근처
  { elementId: "na", x: -20, z: -14, yaw: 0.9 },      // 우물에서 떨어진 곳 — 물가는 안 된다
  { elementId: "o", x: 10, z: -40, yaw: 0.3 },        // 촌장 집 옆 — 윤회를 맡는 대주교
  { elementId: "be", x: -24, z: 34, yaw: -0.8 },      // 공방 구역 — 학자
  { elementId: "mn", x: -40, z: 6, yaw: 0.8 },        // 대장간 앞
  { elementId: "co", x: -24, z: 44, yaw: -1.2 },      // 군단 병사 둘 — 나란히
  { elementId: "ni", x: -27, z: 48, yaw: -1.0 },
  { elementId: "cu", x: 36, z: 26, yaw: -2.2 },       // 농가 사이 — 마을에 섞여 산다
  { elementId: "k", x: 52, z: 44, yaw: -2.4 },        // 농경지 끝 — 밭을 지키는 노인
  { elementId: "ti", x: 50, z: -18, yaw: -1.6 },      // 동쪽 길목 — 청소업체
  { elementId: "sc", x: 40, z: 86, yaw: -0.4 },       // 남 평원 — 야구 연습
  { elementId: "h", x: -4, z: 70, yaw: 0.2 },         // 남쪽 길 — 방랑자
  { elementId: "s", x: -80, z: -8, yaw: 1.2 },        // 서쪽 — 온천 냄새
  { elementId: "bi", x: -90, z: 2, yaw: 0.9 },        // 폐허 입구 — 자기가 지은 것을 본다
  { elementId: "ag", x: 98, z: -8, yaw: -1.4 },       // 강 건너 숲 — 은선 공방 입구
  { elementId: "rn", x: 66, z: -46, yaw: -1.0 },      // 동북 — 온천 리조트
  { elementId: "ne", x: 128, z: -2, yaw: 2.4 },       // 아르곤 마을 — 회의소       // 북쪽 — 순회 재판
  { elementId: "ar", x: 118, z: 14, yaw: Math.PI },   // 아르곤 마을 광장    // 북쪽 길 — 낮잠
  { elementId: "sb", x: -16, z: -88, yaw: 0.4 },      // 고원 초입 — 수도사
  { elementId: "nb", x: -22, z: -130, yaw: 0.5 },     // 쌍광 골짜기 — 갱구 앞     // 고원 깊은 곳 — 저승 부자
  { elementId: "ta", x: -10, z: -128, yaw: 0.3 },     // 쌍광 골짜기 — 늘 함께
];
