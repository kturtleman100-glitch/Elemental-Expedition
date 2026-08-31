import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

// 게임 전체가 공유하는 셀셰이딩 시스템.
// 머티리얼·외곽선·조명·하늘을 여기서만 만들어야 화면 전체의 톤이 갈리지 않는다.
//
// 저사양(모바일) 등급에서는 외곽선과 림라이트를 줄인다 — Device.js의 프리셋을 그대로 따른다.

let gradientMap = null;

/** 3단 계조 램프. 그림자 쪽을 충분히 낮춰야 셀셰이딩 특유의 경계가 생긴다. */
export function getToonGradient() {
  if (gradientMap) return gradientMap;
  const data = new Uint8Array([72, 158, 255]);
  gradientMap = new THREE.DataTexture(data, 3, 1, THREE.RedFormat);
  gradientMap.minFilter = THREE.NearestFilter;
  gradientMap.magFilter = THREE.NearestFilter;
  gradientMap.generateMipmaps = false;
  gradientMap.needsUpdate = true;
  return gradientMap;
}

const materialCache = new Map();
let matSeq = 0;
const texKeys = new WeakMap();

/** 텍스처마다 안정된 캐시 키를 붙인다 — 객체를 키로 문자열화할 수 없어서다 */
function texKey(tex) {
  if (!tex) return "0";
  let k = texKeys.get(tex);
  if (!k) { k = "t" + ++matSeq; texKeys.set(tex, k); }
  return k;
}

/**
 * 셀셰이딩 머티리얼. 같은 조합은 재사용해 드로우콜과 메모리를 아낀다.
 *
 * 머티리얼이 같아야 three.js가 배치를 묶을 수 있으므로, 색·텍스처가 같으면
 * 반드시 같은 인스턴스를 돌려주는 것이 중요하다.
 *
 * @param {number} color 16진 색상 (텍스처가 있으면 곱해지는 색조)
 * @param {{emissive?:number, opacity?:number, map?:THREE.Texture,
 *          repeat?:[number,number], side?:number}} [opts]
 */
export function toonMaterial(color, opts = {}) {
  const key = `${color}|${opts.emissive || 0}|${opts.opacity ?? 1}|${texKey(opts.map)}|${opts.repeat || ""}|${opts.side || 0}`;
  const cached = materialCache.get(key);
  if (cached) return cached;

  let map = opts.map || null;
  // 같은 텍스처를 다른 반복 횟수로 쓰려면 복제해야 한다 (repeat은 텍스처가 들고 있다)
  if (map && opts.repeat) {
    map = map.clone();
    map.needsUpdate = true;
    map.repeat.set(opts.repeat[0], opts.repeat[1]);
  }

  const mat = new THREE.MeshToonMaterial({
    color,
    map,
    gradientMap: getToonGradient(),
    emissive: opts.emissive || 0x000000,
    transparent: opts.transparent || (opts.opacity !== undefined && opts.opacity < 1),
    opacity: opts.opacity ?? 1,
    side: opts.side || THREE.FrontSide,
  });
  materialCache.set(key, mat);
  return mat;
}

const OUTLINE_COLOR = 0x0b0e14;
let outlineMaterial = null;

function getOutlineMaterial() {
  if (!outlineMaterial) {
    outlineMaterial = new THREE.MeshBasicMaterial({
      color: OUTLINE_COLOR,
      side: THREE.BackSide,
    });
  }
  return outlineMaterial;
}

/**
 * 백페이스를 부풀려 겹치는 외곽선. 실루엣이 배경에서 분리되어
 * 38명의 캐릭터를 멀리서도 구분할 수 있게 해준다.
 * @returns {THREE.Mesh|null} 저사양 등급이면 null
 */
export function makeOutline(mesh, thickness = 0.05, enabled = true) {
  if (!enabled) return null;
  const outline = new THREE.Mesh(mesh.geometry, getOutlineMaterial());
  outline.position.copy(mesh.position);
  outline.rotation.copy(mesh.rotation);
  outline.scale.copy(mesh.scale).multiplyScalar(1 + thickness);
  outline.castShadow = false;
  outline.receiveShadow = false;
  return outline;
}

/**
 * 같은 모양을 여러 곳에 놓을 때 쓰는 배치기.
 *
 * 풀 500포기를 개별 메시로 두면 드로우콜 500회지만, InstancedMesh로 묶으면 1회다.
 * 모바일에서 드로우콜은 150회 안쪽으로 유지해야 하므로 잔풀·돌·꽃처럼
 * 수가 많은 것은 반드시 이걸 거친다.
 *
 * 사용법:
 *   const b = new InstancedBatch();
 *   b.add(geo, mat, pos, rot, scale);   // 여러 번
 *   b.build(scene);                      // 한 번
 */
export class InstancedBatch {
  constructor() {
    this.groups = new Map();
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._e = new THREE.Euler();
    this._v = new THREE.Vector3();
    this._s = new THREE.Vector3();
  }

  /**
   * @param {THREE.BufferGeometry} geo 인스턴스끼리 공유되는 지오메트리
   * @param {THREE.Material} mat toonMaterial()의 반환값
   * @param {[number,number,number]} pos
   * @param {[number,number,number]} [rot] 오일러 라디안
   * @param {[number,number,number]|number} [scale]
   */
  add(geo, mat, pos, rot = [0, 0, 0], scale = 1) {
    if (!geo.userData._batchId) geo.userData._batchId = "g" + ++matSeq;
    if (!mat.userData._batchId) mat.userData._batchId = "m" + ++matSeq;
    const key = geo.userData._batchId + "|" + mat.userData._batchId;

    let g = this.groups.get(key);
    if (!g) { g = { geo, mat, items: [] }; this.groups.set(key, g); }

    const s = typeof scale === "number" ? [scale, scale, scale] : scale;
    g.items.push([pos, rot, s]);
  }

  /** 모아둔 것을 InstancedMesh로 만들어 씬에 붙인다. 만들어진 개수를 반환. */
  build(scene, { castShadow = true, receiveShadow = true } = {}) {
    let meshes = 0;
    for (const { geo, mat, items } of this.groups.values()) {
      const inst = new THREE.InstancedMesh(geo, mat, items.length);
      inst.castShadow = castShadow;
      inst.receiveShadow = receiveShadow;

      items.forEach(([pos, rot, s], i) => {
        this._e.set(rot[0], rot[1], rot[2]);
        this._q.setFromEuler(this._e);
        this._v.set(pos[0], pos[1], pos[2]);
        this._s.set(s[0], s[1], s[2]);
        this._m.compose(this._v, this._q, this._s);
        inst.setMatrixAt(i, this._m);
      });

      inst.instanceMatrix.needsUpdate = true;
      scene.add(inst);
      meshes++;
    }
    const total = [...this.groups.values()].reduce((n, g) => n + g.items.length, 0);
    this.groups.clear();
    return { drawCalls: meshes, instances: total };
  }
}

/**
 * 모양이 제각각인 정적 물체를 재질별로 하나의 메시로 합친다.
 *
 * InstancedBatch는 "같은 모양의 반복"에만 쓸 수 있다. 집처럼 크기와 구성이
 * 매번 다른 건물은 인스턴싱이 안 되는 대신, 어차피 움직이지 않으므로
 * 지오메트리를 월드 좌표로 구워 재질별로 합쳐버릴 수 있다.
 *
 * 집 한 채가 메시 40여 개인데 22채면 900개가 넘는다. 재질이 7종이면
 * 병합 후에는 7개가 된다. 외곽선은 전부 같은 재질이라 통째로 1개가 된다.
 *
 * 대가는 물체별 프러스텀 컬링을 잃는 것이다. 마을 하나 규모에서는
 * 컬링으로 아끼는 것보다 드로우콜로 아끼는 쪽이 훨씬 크다.
 */
export class MergedBatch {
  constructor() {
    this.groups = new Map();
  }

  /**
   * @param {THREE.BufferGeometry} geo
   * @param {THREE.Material} mat
   * @param {THREE.Matrix4} matrixWorld 이미 월드로 갱신된 행렬
   */
  add(geo, mat, matrixWorld) {
    if (!mat.userData._mergeId) mat.userData._mergeId = "mm" + ++matSeq;
    const key = mat.userData._mergeId;

    let g = this.groups.get(key);
    if (!g) { g = { mat, geos: [] }; this.groups.set(key, g); }

    const baked = geo.clone();
    baked.applyMatrix4(matrixWorld);
    // 병합에는 없는 속성이 섞이면 실패한다. 위치·법선·UV만 남긴다.
    for (const name of Object.keys(baked.attributes)) {
      if (name !== "position" && name !== "normal" && name !== "uv") baked.deleteAttribute(name);
    }
    g.geos.push(baked);
  }

  /** 씬에 붙이고 통계를 반환한다 */
  build(scene, { castShadow = true, receiveShadow = true } = {}) {
    let drawCalls = 0, source = 0;

    for (const { mat, geos } of this.groups.values()) {
      source += geos.length;
      const merged = geos.length === 1 ? geos[0] : mergeGeometries(geos, false);
      if (!merged) { console.warn("지오메트리 병합 실패 — 속성이 어긋났다"); continue; }

      const mesh = new THREE.Mesh(merged, mat);
      mesh.castShadow = castShadow;
      mesh.receiveShadow = receiveShadow;
      // 합쳐진 덩어리는 경계 상자가 마을 전체라 컬링이 의미 없다. 계산을 생략한다.
      mesh.frustumCulled = false;
      scene.add(mesh);
      drawCalls++;

      if (geos.length > 1) for (const g of geos) g.dispose();
    }

    this.groups.clear();
    return { drawCalls, source };
  }
}

/**
 * 3점 조명. 림라이트가 캐릭터 윤곽을 배경에서 떼어놓는 핵심이다.
 * @param {THREE.Scene} scene
 * @param {import('../core/Device.js').Device} device
 */
export function setupLighting(scene, device) {
  const lowTier = device.tierName === "low";

  const key = new THREE.DirectionalLight(0xfff4e2, 1.45);
  key.position.set(28, 42, 24);
  if (device.tier.shadows) {
    key.castShadow = true;
    key.shadow.mapSize.set(device.tier.shadowMapSize, device.tier.shadowMapSize);
    key.shadow.camera.left = -45;
    key.shadow.camera.right = 45;
    key.shadow.camera.top = 45;
    key.shadow.camera.bottom = -45;
    key.shadow.camera.far = 140;
    key.shadow.bias = -0.0016;
  }
  scene.add(key);

  const fill = new THREE.DirectionalLight(0x93b4d6, 0.5);
  fill.position.set(-32, 18, 20);
  scene.add(fill);

  // 저사양에서는 림라이트를 생략해 광원을 2개로 줄인다.
  if (!lowTier) {
    const rim = new THREE.DirectionalLight(0xbfd8ff, 0.75);
    rim.position.set(-12, 24, -38);
    scene.add(rim);
  }

  scene.add(new THREE.AmbientLight(0x51607a, 0.5));

  return { key, fill };
}

const SKY_VERTEX = /* glsl */ `
  varying vec3 vWorldPosition;
  void main() {
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPosition.xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const SKY_FRAGMENT = /* glsl */ `
  uniform vec3 topColor;
  uniform vec3 horizonColor;
  uniform vec3 bottomColor;
  uniform float offset;
  uniform float exponent;
  varying vec3 vWorldPosition;

  void main() {
    float h = normalize(vWorldPosition + offset).y;
    vec3 sky = mix(horizonColor, topColor, pow(max(h, 0.0), exponent));
    vec3 col = h < 0.0 ? mix(horizonColor, bottomColor, pow(max(-h, 0.0), 0.6)) : sky;
    gl_FragColor = vec4(col, 1.0);
  }
`;

/**
 * 그라데이션 스카이돔. 단색 하늘은 그 자체로 화면을 싸구려로 만든다.
 * 안개 색을 지평선 색과 맞춰야 멀리 있는 지형이 하늘에 자연스럽게 녹는다.
 */
export function makeSky(scene, device, palette) {
  const geo = new THREE.SphereGeometry(400, 24, 16);
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      topColor: { value: new THREE.Color(palette.skyTop) },
      horizonColor: { value: new THREE.Color(palette.skyHorizon) },
      bottomColor: { value: new THREE.Color(palette.skyBottom) },
      offset: { value: 12 },
      exponent: { value: 0.75 },
    },
    vertexShader: SKY_VERTEX,
    fragmentShader: SKY_FRAGMENT,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
  });
  const sky = new THREE.Mesh(geo, mat);
  scene.add(sky);

  scene.fog = new THREE.Fog(
    palette.fog,
    device.tier.drawDistance * 0.4,
    device.tier.drawDistance
  );

  return sky;
}
