// 전역 상태와 시스템 등록.
// 각 시스템은 { update(dt), render?(alpha) } 형태의 객체다.
// update는 Loop가 고정 틱마다 호출하고, render는 프레임마다 호출한다.

export class Game {
  constructor() {
    this.systems = [];
    this.renderables = [];
    this.tick = 0; // 지금까지 지난 논리 틱 총합 (네트워크 타임스탬프 등에 사용)

    // 다른 모듈이 자유롭게 채워 넣는 공용 상태.
    // 파일이 늘어나며 여기 항목이 늘어난다 (player, world, combat 등록 등).
    this.state = {
      scene: null,
      camera: null,
      renderer: null,
      player: null,
      world: null,
    };
  }

  addSystem(system) {
    this.systems.push(system);
    return system;
  }

  addRenderable(renderable) {
    this.renderables.push(renderable);
    return renderable;
  }

  update(dt) {
    this.tick++;
    for (const sys of this.systems) sys.update?.(dt, this);
  }

  render(alpha, frameDt) {
    for (const r of this.renderables) r.render?.(alpha, frameDt, this);
  }
}
