import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { VRMLoaderPlugin, VRMUtils } from "@pixiv/three-vrm";
import { buildCharacter } from "./CharacterBuilder.js";
import { BODY } from "./CharacterBuilder.js";

// VRoid Studio로 만든 .vrm 을 불러와 절차적 캐릭터를 대체한다.
//
// 원칙: 모델이 없어도 게임은 완전히 돌아가야 한다. 38명을 다 만들 때까지
// 기다릴 수 없으므로, 파일이 있으면 쓰고 없으면 CharacterBuilder로 대체한다.
// 그래야 한 명씩 늘려가며 개발할 수 있다.

const MODEL_DIR = "assets/models/";

/** 어떤 원소에 .vrm 파일이 있는지. 없는 원소를 매번 404로 찔러보지 않으려고 명시한다. */
const AVAILABLE = new Set(["mg", "fe", "uue", "si", "ca", "p", "c", "hg", "au"]);

/**
 * 원소 하나가 동시에 가질 수 있는 VRM 개체 수.
 *
 * VRM은 개체마다 따로 파싱해야 한다(아래 참조). 15MB짜리를 수십 번 파싱하면
 * 메모리도 시간도 감당이 안 되므로, 이 수를 넘으면 절차적 캐릭터로 대체한다.
 * 같은 원소 적이 우글거릴 때 앞의 몇만 진짜 모델을 쓰는 셈인데,
 * 아무것도 안 보이는 것보다는 낫다.
 */
const MAX_VRM_INSTANCES = 3;

export class CharacterLoader {
  constructor({ outlines = true } = {}) {
    this.outlines = outlines;
    this.loader = new GLTFLoader();
    this.loader.register((parser) => new VRMLoaderPlugin(parser));
    // id → Promise<ArrayBuffer>. **VRM 객체가 아니라 파일 바이트를 캐시한다.**
    //
    // 예전에는 VRM 객체를 캐시하고 _wrapVRM 에서 root.add(vrm.scene) 을 했다.
    // Object3D.add 는 이전 부모에서 떼어내므로, 같은 원소의 두 번째 개체가
    // 첫 번째의 몸을 통째로 빼앗아 갔다 — 먼저 만들어진 쪽이 투명해진 것이다.
    // 내려받기는 한 번, 파싱은 개체마다 한 번이 옳다.
    this._buffers = new Map();
    this._counts = new Map();  // id → 지금 살아 있는 VRM 개체 수
    this.loaded = new Set();
  }

  /** 이 원소에 3D 모델 파일이 있는가 */
  static has(id) {
    return AVAILABLE.has(id);
  }

  /**
   * 원소 하나의 캐릭터를 만든다. 모델이 있으면 VRM, 없으면 절차적 생성.
   * @param {object} el elements.js의 원소 객체
   * @returns {Promise<THREE.Object3D>} userData.parts / userData.vrm 이 채워진 그룹
   */
  async build(el) {
    if (!AVAILABLE.has(el.id)) return this._procedural(el);
    // 같은 원소를 너무 많이 세우면 파싱 비용이 감당이 안 된다
    if ((this._counts.get(el.id) ?? 0) >= MAX_VRM_INSTANCES) return this._procedural(el);

    try {
      const vrm = await this._newVRM(el.id);
      if (!vrm) return this._procedural(el);
      return this._wrapVRM(vrm, el);
    } catch (err) {
      console.warn(`${el.id}.vrm 로드 실패 — 절차적 생성으로 대체`, err);
      return this._procedural(el);
    }
  }

  _procedural(el) {
    const model = buildCharacter(el, { outlines: this.outlines });
    model.userData.source = "procedural";
    return model;
  }

  /** 파일 바이트를 한 번만 내려받는다 */
  _buffer(id) {
    let p = this._buffers.get(id);
    if (!p) {
      p = fetch(`${MODEL_DIR}${id}.vrm`).then((r) => {
        if (!r.ok) throw new Error(`${id}.vrm ${r.status}`);
        return r.arrayBuffer();
      });
      this._buffers.set(id, p);
    }
    return p;
  }

  /**
   * 개체 하나짜리 VRM을 새로 만든다.
   *
   * three-vrm에는 안전한 복제 수단이 없다. 스킨드 메시를 그냥 clone() 하면
   * 스켈레톤이 원본을 가리키고, SkeletonUtils로 복제해도 vrm.humanoid 가
   * 원본 본을 들고 있어 애니메이션이 엉뚱한 몸에 걸린다.
   * 그래서 캐시한 바이트를 개체마다 다시 파싱한다 — 내려받기는 한 번뿐이다.
   */
  async _newVRM(id) {
    const buf = await this._buffer(id);
    const gltf = await this.loader.parseAsync(buf.slice(0), MODEL_DIR);
    return gltf.userData.vrm || null;
  }

  /**
   * VRM을 게임이 쓰는 형태로 감싼다.
   *
   * 절차적 캐릭터와 인터페이스를 맞춰야 Player/NPC 코드가 둘을 구분하지 않아도 된다.
   * userData.vrm 이 있으면 매 프레임 vrm.update(dt) 를 불러줘야 스프링본이 움직인다.
   */
  _wrapVRM(vrm, el) {
    // 안 보이는 정점과 흩어진 스켈레톤을 정리한다. VRoid 기본 출력은
    // 이걸 안 하면 드로우콜과 스키닝 비용이 필요 이상으로 크다.
    VRMUtils.removeUnnecessaryVertices(vrm.scene);
    VRMUtils.combineSkeletons(vrm.scene);
    // VRM 0.0은 뒤를 보고 서 있다. 1.0이면 아무 일도 하지 않는다.
    VRMUtils.rotateVRM0(vrm);

    vrm.scene.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = true;
      o.receiveShadow = true;
      // 스킨드 메시는 경계 상자가 바인드 포즈 기준이라 팔을 뻗으면 잘못 컬링된다
      o.frustumCulled = false;
    });

    // 키를 게임 기준(1.75m)에 맞춘다. VRoid 모델은 대개 1.4~1.6m로 나온다.
    const size = new THREE.Box3().setFromObject(vrm.scene).getSize(new THREE.Vector3());
    if (size.y > 0.2) {
      const scale = BODY.height / size.y;
      vrm.scene.scale.setScalar(scale);
    }

    const root = new THREE.Group();
    root.add(vrm.scene);
    root.userData.vrm = vrm;
    root.userData.elementId = el.id;
    root.userData.source = "vrm";
    root.userData.parts = {}; // 절차적 쪽과 형태를 맞춰둔다 (VRM은 본으로 움직인다)

    this.loaded.add(el.id);
    this._counts.set(el.id, (this._counts.get(el.id) ?? 0) + 1);
    // 개체가 사라질 때 자리를 돌려준다 — 안 돌려주면 재생성 때 절차적으로 밀린다
    root.userData.releaseVRM = () => {
      this._counts.set(el.id, Math.max(0, (this._counts.get(el.id) ?? 1) - 1));
    };
    return root;
  }
}

/**
 * 매 프레임 호출. VRM이면 스프링본(머리카락·치맛자락) 물리를 돌리고,
 * 절차적이면 아무것도 하지 않는다 (그쪽은 animateCharacter가 담당).
 */
export function updateCharacter(model, dt) {
  const vrm = model?.userData?.vrm;
  if (vrm) vrm.update(dt);
}

/**
 * VRM에는 걷기 애니메이션이 들어 있지 않다 (VRoid는 T포즈만 내보낸다).
 * 본을 직접 흔들어 최소한의 이동감을 준다. 나중에 Mixamo 등에서
 * 애니메이션 클립을 붙이면 이 함수를 대체한다.
 *
 * @param {THREE.Object3D} model
 * @param {number} time 누적 시간(초)
 * @param {number} speed 0=정지, 1=전력
 */
const easeOut = (k) => 1 - (1 - k) * (1 - k);
const easeIn = (k) => k * k;

/** @param {number} attackT 0~1 */
export function animateVRM(model, time, speed, attackT = null) {
  const vrm = model?.userData?.vrm;
  if (!vrm?.humanoid) return;

  const swing = Math.sin(time * 8) * (0.12 + speed * 0.6);
  const breathe = Math.sin(time * 1.6) * 0.04;
  const attacking = attackT !== null && attackT >= 0 && attackT <= 1;

  const set = (name, x, z) => {
    const node = vrm.humanoid.getNormalizedBoneNode(name);
    if (!node) return;
    node.rotation.x = x;
    if (z !== undefined) node.rotation.z = z;
  };

  set("leftUpperLeg", swing * speed);
  set("rightUpperLeg", -swing * speed);
  set("leftLowerLeg", Math.max(0, -swing * speed) * 0.8);
  set("rightLowerLeg", Math.max(0, swing * speed) * 0.8);

  // VRM의 T포즈에서 왼팔은 +X, 오른팔은 −X를 향한다.
  // z를 양수로 주면 +X가 +Y(위)로 돌아 만세 자세가 되므로 왼팔은 음수라야 내려온다.
  // −π/2가 완전히 수직이고, 그보다 조금 덜 줘야 몸통에 붙지 않고 자연스럽다.
  const ARM_DOWN = 1.32;
  set("leftUpperArm", -swing * speed * 0.7, -ARM_DOWN - breathe * (1 - speed));

  if (attacking) {
    // 오른팔을 들었다가 내리친다. z를 줄여 팔을 위로 올리고 x로 앞뒤를 만든다.
    // armZ를 ARM_DOWN(1.32, 팔이 아래로 내려온 상태)보다 항상 작게 유지한다.
    // 값이 작을수록 팔이 옆으로 들리므로, 휘두르는 궤도가 몸통 바깥을 지난다.
    // 0.55 아래로는 내리지 않아야 어깨가 뒤틀리지 않는다.
    const OUT = 0.62; // 휘두르는 동안 유지할 최소 벌림
    let armX, armZ;
    if (attackT < 0.3) {
      const k = easeOut(attackT / 0.3);
      armX = -1.5 * k;                        // 뒤로 젖힘
      armZ = ARM_DOWN - (ARM_DOWN - OUT) * k; // 어깨를 옆으로 들어올림
    } else if (attackT < 0.52) {
      const k = easeIn((attackT - 0.3) / 0.22);
      armX = -1.5 + 2.4 * k;                  // 빠르게 내리침
      armZ = OUT;                             // 벌린 채 유지 — 여기서 좁히면 몸을 스친다
    } else {
      const k = easeOut((attackT - 0.52) / 0.48);
      armX = 0.9 * (1 - k);
      armZ = OUT + (ARM_DOWN - OUT) * k;      // 서서히 원위치
    }
    set("rightUpperArm", armX, armZ);
    set("rightLowerArm", -Math.sin(attackT * Math.PI) * 0.7, 0.18);

    // 허리를 같이 틀어야 팔만 도는 인형처럼 안 보인다
    const spine = vrm.humanoid.getNormalizedBoneNode("spine");
    if (spine) {
      spine.rotation.x = speed * 0.08 + breathe * 0.3;
      spine.rotation.y = -Math.sin(attackT * Math.PI) * 0.35;
    }
    return;
  }

  set("rightUpperArm", swing * speed * 0.7, ARM_DOWN + breathe * (1 - speed));

  // 팔꿈치를 살짝 굽혀야 막대처럼 뻣뻣해 보이지 않는다
  set("leftLowerArm", 0, -0.18);
  set("rightLowerArm", 0, 0.18);

  const spine = vrm.humanoid.getNormalizedBoneNode("spine");
  if (spine) {
    spine.rotation.x = speed * 0.08 + breathe * 0.3;
    spine.rotation.y *= 0.85; // 공격이 끝나면 허리를 서서히 되돌린다
  }
}
