import * as THREE from "three";

// 1인칭 ↔ 3인칭 전환 + (4단계에서 확장될) 탐험/전투 락온 모드의 뼈대.
// 시선 회전(yaw/pitch)은 프레임당 정확히 1회, main.js가 Loop의 preFrame 훅에서
// applyLook()을 호출해 갱신한다 — 마우스 이동은 틱이 아니라 프레임에 묶인 입력이라서.
// 위치 보간은 render(alpha)에서 플레이어의 prevPosition→position을 사용한다.

const THIRD_PERSON_DISTANCE = 4.2;
const THIRD_PERSON_HEIGHT = 1.7;
const MIN_PITCH = -Math.PI / 2 + 0.08;
const MAX_PITCH = Math.PI / 2 - 0.08;
const VIEW_BLEND_SPEED = 6; // 1인칭↔3인칭 전환 보간 속도

export class CameraRig {
  /**
   * @param {THREE.PerspectiveCamera} camera
   * @param {import('./Player.js').Player} player
   */
  constructor(camera, player) {
    this.camera = camera;
    this.player = player;

    this.yaw = player.yaw;
    this.pitch = -0.05;

    this.mode = "third"; // "first" | "third" — 시작은 3인칭이 상황 파악에 유리
    this._viewBlend = 1; // 0=1인칭, 1=3인칭. toggleView 시 목표값으로 서서히 이동
    this._viewBlendTarget = 1;

    this._thirdPersonOffset = new THREE.Vector3();
    this._desiredCamPos = new THREE.Vector3();
    this._tmpPlayerPos = new THREE.Vector3();

    // 벽에 막혔을 때 실제로 적용 중인 거리. 목표 거리와 따로 들고 있어야
    // 벽을 벗어날 때 부드럽게 되돌아간다 (즉시 되돌리면 화면이 튄다).
    this._camDistance = THIRD_PERSON_DISTANCE;

    // 전투 락온 — TargetLock이 정한 대상을 카메라가 따라간다.
    // 급격히 돌리면 멀미가 나므로 항상 감속 보간으로만 접근한다.
    this.lockTarget = null;
    this.lockEnabled = true; // 설정에서 끌 수 있다
    this._lockBlend = 0;

    this._applyModeVisibility();
  }

  get yawRadians() { return this.yaw; }

  /** 플레이어 모델이 교체되면 표시 여부를 다시 적용한다 */
  refreshModel() { this._applyModeVisibility(); }

  toggleView() {
    this.mode = this.mode === "first" ? "third" : "first";
    this._viewBlendTarget = this.mode === "third" ? 1 : 0;
  }

  /** main.js가 Loop.preFrame에서 프레임당 1회 호출 */
  applyLook(lookDelta) {
    this.yaw -= lookDelta.x;
    this.pitch -= lookDelta.y;
    this.pitch = Math.max(MIN_PITCH, Math.min(MAX_PITCH, this.pitch));
  }

  /** 전투 시작/종료 시 TargetLock이 호출한다 */
  setLockTarget(target) {
    this.lockTarget = target;
  }

  /** 틱마다 호출 — 모드 전환 보간 진행 */
  update(dt) {
    const diff = this._viewBlendTarget - this._viewBlend;
    if (Math.abs(diff) > 0.001) {
      this._viewBlend += diff * Math.min(1, VIEW_BLEND_SPEED * dt);
    } else {
      this._viewBlend = this._viewBlendTarget;
    }
    this._applyModeVisibility();
    this._updateLock(dt);
  }

  /**
   * 타겟 쪽으로 시선을 끌어당긴다.
   * 완전히 고정하지 않는 이유는 두 가지다 — 3D 멀미를 줄이고,
   * 플레이어가 직접 시선을 돌리려 할 때 그 입력이 이기게 하려고.
   */
  _updateLock(dt) {
    const want = this.lockEnabled && this.lockTarget && this.lockTarget.alive;
    const target = want ? 1 : 0;
    this._lockBlend += (target - this._lockBlend) * Math.min(1, 3 * dt);
    if (!want || this._lockBlend < 0.01) return;

    const t = this.lockTarget;
    const dx = t.position.x - this.player.position.x;
    const dz = t.position.z - this.player.position.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.2) return;

    const desiredYaw = Math.atan2(dx, dz);
    let diff = ((desiredYaw - this.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI;

    // 속도 상한 — 갑자기 홱 돌아가면 어지럽다
    const maxStep = 2.6 * dt;
    const step = Math.max(-maxStep, Math.min(maxStep, diff * 2.4 * dt)) * this._lockBlend;
    this.yaw += step;

    // 상대를 살짝 내려다보게 — 대상이 화면 중앙에 오도록
    const desiredPitch = -Math.atan2(1.0, Math.max(1, dist)) * 0.5;
    this.pitch += (desiredPitch - this.pitch) * Math.min(1, 1.4 * dt) * this._lockBlend;
  }

  _applyModeVisibility() {
    // 완전히 1인칭에 가까울 때만 모델을 숨긴다 — 전환 도중엔 살짝 보여도 자연스럽다.
    this.player.mesh.visible = this._viewBlend > 0.05;
  }

  /** 프레임마다 호출 — 보간된 플레이어 위치를 기준으로 실제 three.js 카메라를 배치 */
  render(alpha) {
    const p = this.player.getRenderPosition(alpha, this._tmpPlayerPos);

    const eyePos = new THREE.Vector3(p.x, p.y + this.player.eyeHeight, p.z);

    // 3인칭: yaw/pitch로 플레이어 주위를 도는 구면 좌표의 카메라 위치.
    const cosPitch = Math.cos(this.pitch);
    const dirX = Math.sin(this.yaw) * cosPitch;
    const dirZ = Math.cos(this.yaw) * cosPitch;
    const dirY = Math.sin(this.pitch);

    // 카메라가 놓일 방향(플레이어 → 카메라)을 먼저 정규화해두고,
    // 그 방향으로 광선을 쏴 벽에 막히는 거리를 구한다.
    const backX = -dirX;
    const backY = (THIRD_PERSON_HEIGHT - dirY * THIRD_PERSON_DISTANCE * 0.5) / THIRD_PERSON_DISTANCE;
    const backZ = -dirZ;
    const backLen = Math.hypot(backX, backY, backZ) || 1;
    const nx = backX / backLen, ny = backY / backLen, nz = backZ / backLen;

    let allowed = THIRD_PERSON_DISTANCE;
    if (this._viewBlend > 0.01 && this.player.collision) {
      allowed = this.player.collision.rayDistance(
        eyePos.x, eyePos.y, eyePos.z, nx, ny, nz, THIRD_PERSON_DISTANCE * backLen
      ) / backLen;
    }

    // 가까워질 땐 즉시(벽을 뚫지 않으려면 지체하면 안 된다),
    // 멀어질 땐 서서히 — 좁은 골목을 빠져나올 때 화면이 튀지 않게.
    if (allowed < this._camDistance) this._camDistance = allowed;
    else this._camDistance += (allowed - this._camDistance) * 0.12;

    const d = this._camDistance;
    this._thirdPersonOffset.set(
      -dirX * d,
      THIRD_PERSON_HEIGHT * (d / THIRD_PERSON_DISTANCE) - dirY * d * 0.5,
      -dirZ * d
    );
    this._desiredCamPos.copy(eyePos).add(this._thirdPersonOffset);

    // 1인칭 카메라 위치는 눈 위치 그 자체.
    this.camera.position.lerpVectors(eyePos, this._desiredCamPos, this._viewBlend);

    // 시선 방향은 두 모드 모두 yaw/pitch를 그대로 쓰되,
    // 3인칭은 카메라→플레이어 쪽을 바라보게(= yaw를 그대로 카메라 진행각으로 사용).
    const lookDir = new THREE.Vector3(dirX, dirY, dirZ);
    const firstPersonTarget = eyePos.clone().add(lookDir);
    const thirdPersonTarget = eyePos; // 3인칭은 플레이어를 바라봄
    const target = firstPersonTarget.lerp(thirdPersonTarget, this._viewBlend);
    this.camera.lookAt(target);
  }
}
