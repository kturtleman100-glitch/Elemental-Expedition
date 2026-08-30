import * as THREE from "three";

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

/**
 * 셀셰이딩 머티리얼. 같은 색은 재사용해 드로우콜과 메모리를 아낀다.
 * @param {number} color 16진 색상
 * @param {{emissive?:number, transparent?:boolean, opacity?:number}} [opts]
 */
export function toonMaterial(color, opts = {}) {
  const key = `${color}|${opts.emissive || 0}|${opts.opacity ?? 1}`;
  const cached = materialCache.get(key);
  if (cached) return cached;

  const mat = new THREE.MeshToonMaterial({
    color,
    gradientMap: getToonGradient(),
    emissive: opts.emissive || 0x000000,
    transparent: opts.transparent || (opts.opacity !== undefined && opts.opacity < 1),
    opacity: opts.opacity ?? 1,
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
