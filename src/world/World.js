import * as THREE from "three";
import { Collision } from "./Collision.js";

// 1단계 — 토룡마을. 지형·조명·스카이박스와 몇 개의 장애물(집·나무)만 둔다.
// 캐릭터·NPC·퀘스트는 3단계에서 채워진다.

export class World {
  /** @param {import('../core/Device.js').Device} device */
  constructor(scene, device) {
    this.scene = scene;
    this.collision = new Collision();
    this.spawnPoint = new THREE.Vector3(0, 0, 6);

    this._buildSky(device);
    this._buildLights(device);
    this._buildGround();
    this._buildProps();
  }

  _buildSky(device) {
    this.scene.background = new THREE.Color(0x9fd3e8);
    const fogNear = device.tier.drawDistance * 0.35;
    const fogFar = device.tier.drawDistance;
    this.scene.fog = new THREE.Fog(0x9fd3e8, fogNear, fogFar);
  }

  _buildLights(device) {
    const hemi = new THREE.HemisphereLight(0xffffff, 0x3a3a2a, 0.9);
    this.scene.add(hemi);

    const sun = new THREE.DirectionalLight(0xfff2d0, 1.1);
    sun.position.set(30, 45, 20);
    if (device.tier.shadows) {
      sun.castShadow = true;
      sun.shadow.mapSize.set(device.tier.shadowMapSize, device.tier.shadowMapSize);
      sun.shadow.camera.left = -40;
      sun.shadow.camera.right = 40;
      sun.shadow.camera.top = 40;
      sun.shadow.camera.bottom = -40;
      sun.shadow.camera.far = 120;
      sun.shadow.bias = -0.0015;
    }
    this.scene.add(sun);
    this.sun = sun;
  }

  _buildGround() {
    const groundGeo = new THREE.PlaneGeometry(240, 240, 1, 1);
    const groundMat = new THREE.MeshStandardMaterial({ color: 0x6d8f4b, roughness: 1 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);

    // 마을 광장 — 살짝 다른 색의 원형 바닥으로 시선을 모은다.
    const plazaGeo = new THREE.CircleGeometry(10, 32);
    const plazaMat = new THREE.MeshStandardMaterial({ color: 0xb99a63, roughness: 1 });
    const plaza = new THREE.Mesh(plazaGeo, plazaMat);
    plaza.rotation.x = -Math.PI / 2;
    plaza.position.y = 0.01;
    plaza.receiveShadow = true;
    this.scene.add(plaza);
  }

  _buildProps() {
    // 칼슘 촌장의 집 등 — 실제 캐릭터는 3단계에서, 지금은 자리만 박스로 표시.
    this._addBox(-6, -4, 3, 3, 3, 0x8a7355, true);
    this._addBox(7, -6, 3, 3, 3, 0x8a7355, true);
    this._addBox(0, -14, 4, 3, 4, 0x8a7355, true);

    // 나무들 — 원기둥 몸통 + 구 잎.
    const treeSpots = [
      [-14, 4], [-12, -10], [13, 6], [15, -9], [-3, 18], [4, 20], [-18, -18], [18, 18],
    ];
    for (const [x, z] of treeSpots) this._addTree(x, z);
  }

  _addBox(x, z, w, h, d, color, collide) {
    const geo = new THREE.BoxGeometry(w, h, d);
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.9 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, h / 2, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.scene.add(mesh);
    if (collide) this.collision.addBox(x, z, w, d, 0, h);
    return mesh;
  }

  _addTree(x, z) {
    const trunkGeo = new THREE.CylinderGeometry(0.3, 0.4, 2.2, 6);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5b3a29, roughness: 1 });
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.set(x, 1.1, z);
    trunk.castShadow = true;
    this.scene.add(trunk);

    const leavesGeo = new THREE.IcosahedronGeometry(1.6, 0);
    const leavesMat = new THREE.MeshStandardMaterial({ color: 0x3f7d3a, roughness: 0.9, flatShading: true });
    const leaves = new THREE.Mesh(leavesGeo, leavesMat);
    leaves.position.set(x, 2.8, z);
    leaves.castShadow = true;
    this.scene.add(leaves);

    this.collision.addBox(x, z, 0.7, 0.7, 0, 2.2);
  }
}
