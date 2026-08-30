import * as THREE from "three";

// 이동은 매 틱(고정 dt)에 계산되고, position/prevPosition 두 벌을 들고 있다가
// 렌더 시 alpha로 보간한다 — 그래야 논리 틱 레이트와 화면 프레임률이 달라도
// 움직임이 매끄럽다. (계획서: 적응형 고정 틱 루프)

const MOVE_SPEED = 5.2; // m/s
const JUMP_SPEED = 6.0;
const GRAVITY = -18;
const RADIUS = 0.4;
const HEIGHT = 1.7;
const EYE_HEIGHT = 1.55;

export class Player {
  /**
   * @param {THREE.Vector3} spawnPos
   * @param {import('../world/Collision.js').Collision} collision
   */
  constructor(spawnPos, collision) {
    this.collision = collision;

    this.position = spawnPos.clone();
    this.prevPosition = spawnPos.clone();
    this.velocityY = 0;
    this.onGround = true;

    this.yaw = 0; // 이동/모델 방향에 쓰는 수평 회전 (카메라 yaw를 따라감)

    // 3인칭에서만 보이는 자리표시 메시. 3단계에서 CharacterBuilder 산출물로 교체된다.
    const geo = new THREE.CapsuleGeometry(RADIUS, HEIGHT - RADIUS * 2, 4, 8);
    const mat = new THREE.MeshStandardMaterial({ color: 0x9fb8c9, roughness: 0.5, metalness: 0.1 });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.castShadow = true;
    this.mesh.position.copy(this.position);
    this.mesh.position.y += HEIGHT / 2;
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
      const sin = Math.sin(cameraYaw), cos = Math.cos(cameraYaw);
      const worldX = mx * cos + mz * sin;
      const worldZ = -mx * sin + mz * cos;
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

    this.mesh.position.set(this.position.x, this.position.y + HEIGHT / 2, this.position.z);
    this.mesh.rotation.y = this.yaw;
  }

  /** 보간된 위치 (렌더용) */
  getRenderPosition(alpha, out = new THREE.Vector3()) {
    return out.lerpVectors(this.prevPosition, this.position, alpha);
  }
}
