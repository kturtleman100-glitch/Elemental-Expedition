import * as THREE from "three";
import { buildCharacter, animateCharacter, BODY } from "../characters/CharacterBuilder.js";
import { PLAYER_ELEMENT } from "../data/elements.js";

// 이동은 매 틱(고정 dt)에 계산되고, position/prevPosition 두 벌을 들고 있다가
// 렌더 시 alpha로 보간한다 — 그래야 논리 틱 레이트와 화면 프레임률이 달라도
// 움직임이 매끄럽다. (계획서: 적응형 고정 틱 루프)

const MOVE_SPEED = 5.2; // m/s
const JUMP_SPEED = 6.0;
const GRAVITY = -18;
const RADIUS = 0.34;
const HEIGHT = BODY.height;
const EYE_HEIGHT = BODY.headY;

export class Player {
  /**
   * @param {THREE.Vector3} spawnPos
   * @param {import('../world/Collision.js').Collision} collision
   * @param {{outlines?: boolean}} [opts]
   */
  constructor(spawnPos, collision, opts = {}) {
    this.collision = collision;

    this.position = spawnPos.clone();
    this.prevPosition = spawnPos.clone();
    this.velocityY = 0;
    this.onGround = true;
    this.moveSpeed01 = 0; // 0=정지, 1=전력. 걷기 애니메이션 강도에 쓴다
    this.animTime = 0;

    this.yaw = 0; // 이동/모델 방향에 쓰는 수평 회전 (카메라 yaw를 따라감)

    // 119번 원소 — 이름도 족도 없는 플레이어.
    // assets/models/uue.glb 가 생기면 CharacterLoader가 이 결과물을 대체한다.
    this.mesh = buildCharacter(PLAYER_ELEMENT, { outlines: opts.outlines !== false });
    this.mesh.position.copy(this.position);
    this.mesh.visible = false; // 기본은 1인칭이므로 숨김 — CameraRig가 모드에 따라 토글

    // 전투 등 다음 단계에서 쓸 자리 (지금은 표시만).
    this.hp = 100;
    this.hpMax = 100;
    this.electrons = 50;
    this.electronsMax = 50;
  }

  get eyeHeight() { return EYE_HEIGHT; }
  get radius() { return RADIUS; }

  /**
   * @param {number} dt 고정 틱 간격(초)
   * @param {import('../core/Input.js').Input} input
   * @param {number} cameraYaw 카메라가 바라보는 수평각 — 이동을 이 기준 상대좌표로 변환
   */
  update(dt, input, cameraYaw) {
    this.prevPosition.copy(this.position);

    const { x: mx, z: mz } = input.moveVector;
    const hasInput = mx !== 0 || mz !== 0;

    if (hasInput) {
      // 카메라가 바라보는 방향 기준으로 입력을 월드 좌표로 변환.
      // CameraRig의 전방 벡터는 (sin(yaw), cos(yaw))이고, three.js 우수 좌표계에서
      // 그 방향을 바라볼 때 화면상의 오른쪽은 월드 -X 쪽이다. 우측 벡터 부호에 주의.
      const sin = Math.sin(cameraYaw), cos = Math.cos(cameraYaw);
      const worldX = -mx * cos + mz * sin;
      const worldZ = mx * sin + mz * cos;
      const len = Math.hypot(worldX, worldZ) || 1;
      const dirX = worldX / len, dirZ = worldZ / len;

      this.position.x += dirX * MOVE_SPEED * dt;
      this.position.z += dirZ * MOVE_SPEED * dt;
      this.yaw = Math.atan2(dirX, dirZ);
    }

    // 점프 / 중력 (지형이 y=0 평지뿐인 1단계 기준)
    if (input.justPressed("jump") && this.onGround) {
      this.velocityY = JUMP_SPEED;
      this.onGround = false;
    }
    this.velocityY += GRAVITY * dt;
    this.position.y += this.velocityY * dt;
    if (this.position.y <= 0) {
      this.position.y = 0;
      this.velocityY = 0;
      this.onGround = true;
    }

    // 충돌 보정 (수평만)
    const resolved = this.collision.resolve(
      this.position.x, this.position.z, RADIUS,
      this.position.y, this.position.y + HEIGHT
    );
    this.position.x = resolved.x;
    this.position.z = resolved.z;

    // 실제 이동한 거리로 걷기 강도를 정한다 — 벽에 막혀 제자리면 걷지 않는다
    const dx = this.position.x - this.prevPosition.x;
    const dz = this.position.z - this.prevPosition.z;
    const travelled = Math.hypot(dx, dz);
    const target = Math.min(1, travelled / (MOVE_SPEED * dt));
    this.moveSpeed01 += (target - this.moveSpeed01) * Math.min(1, dt * 12);

    this.animTime += dt;
    animateCharacter(this.mesh, this.animTime, this.moveSpeed01);

    this.mesh.rotation.y = this.yaw;
  }

  /** 렌더 시점에 보간된 위치로 모델을 배치 (CameraRig와 같은 alpha를 쓴다) */
  syncMesh(alpha) {
    const baseY = this.mesh.userData.hover ? this.mesh.position.y : 0;
    this.mesh.position.set(
      this.prevPosition.x + (this.position.x - this.prevPosition.x) * alpha,
      this.prevPosition.y + (this.position.y - this.prevPosition.y) * alpha + baseY,
      this.prevPosition.z + (this.position.z - this.prevPosition.z) * alpha
    );
  }

  /** 보간된 위치 (렌더용) */
  getRenderPosition(alpha, out = new THREE.Vector3()) {
    return out.lerpVectors(this.prevPosition, this.position, alpha);
  }
}
