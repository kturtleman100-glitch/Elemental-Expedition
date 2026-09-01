import * as THREE from "three";
import { animateCharacter } from "./CharacterBuilder.js";
import { updateCharacter, animateVRM } from "./CharacterLoader.js";
import { getElement } from "../data/elements.js";

// 마을에 서 있는 원소 캐릭터.
//
// 지금은 제자리에서 숨쉬고 플레이어를 바라보는 것까지만 한다.
// 대화·퀘스트는 Dialogue/Quest가 붙으면서 여기에 연결된다.

const LOOK_RANGE = 9; // 이 거리 안에 들어오면 플레이어 쪽으로 몸을 돌린다
const TALK_RANGE = 3.6; // 대화가 가능한 거리
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

    model.position.set(this.x, 0, this.z);
    model.rotation.y = this.yaw;
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
}

/**
 * 토룡마을 NPC 배치.
 *
 * 구역별로 흩어놓아야 심부름에 거리가 생긴다. 좌표는 World.js의 구역 배치를 따른다.
 * yaw는 그 인물이 평소 바라보는 방향 — 광장 쪽이나 자기 일터 쪽을 향한다.
 */
export const NPC_PLACEMENTS = [
  // 광장 — 처음 마주치는 인물
  { elementId: "mg", x: 4.5, z: 6.0, yaw: Math.PI * 0.9 },

  // 공방 구역 — 대안통운 앞. 전이 금속 군단 대장이 마을에 들렀다는 설정
  { elementId: "fe", x: -34, z: 21, yaw: 1.1 },

  // 아래는 아직 .vrm 이 없어 절차적 생성으로 나온다
  { elementId: "ca", x: 0, z: -46, yaw: 0 },          // 촌장 집 앞
  { elementId: "p", x: -38, z: 32, yaw: 0.3 },        // 대안통운 하역장
  { elementId: "c", x: -8.0, z: 9.5, yaw: -0.5 },     // 광장 좌판 근처
  { elementId: "si", x: -13, z: 15, yaw: -0.9 },      // 광장 서쪽, 혼자 떨어져
];
