import { Enemy } from "./Enemy.js";

// 적 배치와 리스폰.
//
// 1장 「전자 도둑」의 무대라 마을 바깥에 전자 친화팀 하수인을 깔았다.
// 할로겐이 전자를 빼앗아 간다는 설정이 전투 규칙(흡수형)과 그대로 맞물린다.
//
// 마을 안(반경 20m)에는 적을 두지 않는다 — 대화하러 온 사람이 얻어맞으면 안 된다.

const RESPAWN_DELAY = 22;
const SLEEP_RANGE = 34; // 이 거리를 넘으면 갱신도 렌더도 멈춘다

// 감지 범위가 9.5m이므로 서로 20m 이상 띄운다. 그래야 한 번에 한 마리씩
// 상대하게 되고, 실수로 둘을 끌면 그건 플레이어의 판단 착오가 된다.
export const SPAWNS = [
  // 마을 남쪽 길목 — 인(P)이 배송 중 습격당했다는 그 자리. 가장 약한 상대
  { elementId: "br", x: 4, z: 38, level: 1 },
  { elementId: "cl", x: -12, z: 52, level: 2 },
  { elementId: "br", x: 20, z: 60, level: 2 },

  // 동쪽 농경지 바깥
  { elementId: "br", x: 54, z: 6, level: 2 },
  { elementId: "as", x: 66, z: 28, level: 3 },

  // 서쪽 공방 너머
  { elementId: "cl", x: -60, z: 6, level: 3 },
  { elementId: "as", x: -70, z: 30, level: 3 },

  // 북쪽 석회암 지대 — 가장 강한 상대. 준비되면 오라는 뜻
  { elementId: "cl", x: -54, z: -54, level: 4 },
  { elementId: "hg", x: -34, z: -66, level: 4 },

  // ---- 마을 밖 ----
  // 북 석회암 고원 — 척박한 만큼 험한 것들이 산다
  { elementId: "as", x: -62, z: -100, level: 5 },
  { elementId: "hg", x: 20, z: -112, level: 6 },
  { elementId: "cl", x: -90, z: -88, level: 5 },
  { elementId: "as", x: 56, z: -104, level: 6 },

  // 동 강가와 숲
  { elementId: "br", x: 96, z: -34, level: 4 },
  { elementId: "cl", x: 108, z: 18, level: 5 },
  { elementId: "as", x: 118, z: -50, level: 6 },
  { elementId: "br", x: 100, z: 58, level: 5 },

  // 서 폐허 — 무언가를 지키고 있는 듯하다
  { elementId: "hg", x: -100, z: 28, level: 6 },
  { elementId: "cl", x: -86, z: 44, level: 5 },
  { elementId: "as", x: -114, z: 16, level: 6 },

  // 남 평원 — 마을에서 가까워 비교적 순하다
  { elementId: "br", x: -20, z: 84, level: 3 },
  { elementId: "cl", x: 24, z: 96, level: 4 },
  { elementId: "br", x: -6, z: 122, level: 4 },
];

export class Encounters {
  /**
   * @param {THREE.Scene} scene
   * @param {{outlines:boolean, authority?:boolean}} opts
   */
  constructor(scene, opts = {}) {
    this.scene = scene;
    this.outlines = opts.outlines !== false;
    this.authority = opts.authority !== false;
    this.loader = opts.loader ?? null;
    this.enemies = [];
    this._dead = []; // { spec, timer }
    // 같은 원소의 VRM을 여러 마리가 공유할 수 없다(본이 따로 놀아야 한다).
    // 대신 로더가 파일을 캐시하므로 내려받기는 한 번뿐이다.
    for (const spec of SPAWNS) this._spawn(spec);
  }

  _spawn(spec) {
    const e = new Enemy({
      ...spec,
      authority: this.authority,
      outlines: this.outlines,
    });
    this.scene.add(e.mesh);
    e._spec = spec;
    this.enemies.push(e);

    // VRM이 있으면 자리표시를 교체한다. 없으면 절차적 생성 그대로.
    if (this.loader) {
      this.loader.build(e.element).then((model) => {
        if (model.userData.source === "vrm" && e.mesh) e.setModel(model, this.scene);
      }).catch(() => {});
    }
    return e;
  }

  update(dt, player, particles, collision, projectiles) {
    for (const e of this.enemies) {
      // 멀리 있는 적은 재운다. 9마리를 전부 매 틱 갱신하고 그림자까지 그리면
      // 드로우콜과 스키닝 비용이 그대로 쌓인다. 어차피 보이지도 않는다.
      const dx = e.position.x - player.position.x;
      const dz = e.position.z - player.position.z;
      const far = dx * dx + dz * dz > SLEEP_RANGE * SLEEP_RANGE;

      if (far) {
        if (e.mesh.visible) e.mesh.visible = false;
        continue;
      }
      if (!e.mesh.visible) e.mesh.visible = true;
      e.update(dt, player, particles, collision, projectiles);
    }

    // 겹쳐 선 적을 서로 밀어낸다. 갱신 뒤에 해야 이번 프레임 위치에 반영된다.
    for (const e of this.enemies) e.separate(this.enemies, dt);

    // 쓰러진 지 오래된 개체는 치우고 대기열에 넣는다
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (e.state === "dead" && e.deadTimer > 2.5) {
        e.dispose(this.scene);
        this.enemies.splice(i, 1);
        this._dead.push({ spec: e._spec, timer: RESPAWN_DELAY });
      }
    }

    for (let i = this._dead.length - 1; i >= 0; i--) {
      this._dead[i].timer -= dt;
      if (this._dead[i].timer <= 0) {
        this._spawn(this._dead[i].spec);
        this._dead.splice(i, 1);
      }
    }
  }

  get alive() { return this.enemies.filter((e) => e.alive); }
}
