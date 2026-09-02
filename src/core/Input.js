// 입력 추상화 — 키보드/마우스와 터치를 게임 동작으로 번역하는 단일 창구.
// 게임 로직은 이 클래스의 moveVector / lookDelta / isPressed()만 읽으면 되고
// "지금 키보드인지 터치인지"는 몰라도 된다.
//
// 동작 목록(액션 이름은 계획서의 조작표를 그대로 따른다):
//   attack, interact, jump, inventory, party, codex, quest,
//   view, targetNext, menu

const KEY_TO_ACTION = {
  Space: "jump",
  KeyE: "inventory",
  KeyP: "party",
  KeyK: "codex",
  KeyJ: "quest",
  KeyV: "view",
  KeyF: "interact", // 트랙패드 두 손가락 탭 대체 키
  Tab: "targetNext",
  KeyT: "stance", // 하이브리드 원소의 무기/마법 자세 전환
  Escape: "menu",
  Digit1: "slot1",
  Digit2: "slot2",
  Digit3: "slot3",
  Digit4: "slot4",
};

export class Input {
  constructor({ canvas, device }) {
    this.canvas = canvas;
    this.device = device;

    this.moveVector = { x: 0, z: 0 }; // -1..1, x=좌우, z=전후(전진이 -1 관례 대신 +1=전진으로 통일)
    this.lookDelta = { x: 0, y: 0 }; // 이번 프레임의 시선 변화량 (누적 후 매 프레임 리셋)

    this._pressed = new Set();
    this._justPressed = new Set();
    this._pointerLocked = false;

    this._mouseSensitivity = 0.0022;
    this._touchLookSensitivity = 0.006;

    this._onAction = null; // (action) => void, 단발성 액션 콜백 (main.js에서 등록)

    if (this.device.isTouch) {
      this._bindTouch();
    } else {
      this._bindDesktop();
    }
  }

  onAction(fn) {
    this._onAction = fn;
  }

  isPressed(action) {
    return this._pressed.has(action);
  }

  /** 이번 프레임에 새로 눌린 액션인지 (연타 방지용). update 이후 clearFrame()으로 초기화 */
  justPressed(action) {
    return this._justPressed.has(action);
  }

  /**
   * 시선 변화량만 비운다. applyLook() 직후 프레임 앞쪽에서 호출한다.
   * 액션 플래그를 여기서 같이 지우면 update가 읽기 전에 사라져 점프가 먹지 않는다.
   */
  clearLook() {
    this.lookDelta.x = 0;
    this.lookDelta.y = 0;
  }

  /** 액션 플래그를 비운다. 반드시 update가 모두 끝난 뒤에 호출해야 한다. */
  clearFrame() {
    this.lookDelta.x = 0;
    this.lookDelta.y = 0;
    this._justPressed.clear();
  }

  setSensitivity(v) {
    this._mouseSensitivity = 0.0006 + v * 0.004;
  }

  // ---------------- 데스크톱: 키보드 + 마우스 ----------------

  _bindDesktop() {
    window.addEventListener("keydown", (e) => {
      if (e.repeat) return;
      const action = KEY_TO_ACTION[e.code];
      this._setKeyState(e.code, true);
      if (action) this._fireAction(action);
    });
    window.addEventListener("keyup", (e) => {
      this._setKeyState(e.code, false);
    });

    // 좌클릭 = 공격, 우클릭 = 상호작용
    this.canvas.addEventListener("mousedown", (e) => {
      if (e.button === 0) {
        this._pressed.add("attack");
        this._fireAction("attack");
      } else if (e.button === 2) {
        this._fireAction("interact");
      }
      this._requestPointerLock();
    });
    this.canvas.addEventListener("mouseup", (e) => {
      if (e.button === 0) this._pressed.delete("attack");
    });

    // 우클릭 상호작용을 쓰므로 브라우저 컨텍스트 메뉴는 캔버스에서 항상 막는다.
    this.canvas.addEventListener("contextmenu", (e) => e.preventDefault());

    this.canvas.addEventListener("wheel", (e) => {
      this._fireAction("targetNext");
    }, { passive: true });

    document.addEventListener("pointerlockchange", () => {
      this._pointerLocked = document.pointerLockElement === this.canvas;
    });

    document.addEventListener("mousemove", (e) => {
      if (!this._pointerLocked) return;
      this.lookDelta.x += e.movementX * this._mouseSensitivity;
      this.lookDelta.y += e.movementY * this._mouseSensitivity;
    });

    this._updateMoveVectorFromKeys();
  }

  /**
    * 마우스를 화면에 가둔다.
    *
    * Esc로 락을 푼 직후 약 1초 동안 브라우저가 재획득을 거부한다 —
    * 사용자가 빠져나갈 방법을 보장하기 위한 안전장치라 정상 동작이다.
    * 그 거부를 받아주지 않으면 처리되지 않은 Promise로 올라가 화면에
    * 빨간 오류 상자가 뜬다. 실패하면 잠깐 뒤 한 번만 다시 시도한다.
    */
  _requestPointerLock(retry = true) {
    if (document.pointerLockElement === this.canvas) return;
    const p = this.canvas.requestPointerLock?.();
    if (!p?.catch) return;   // 옛 브라우저는 Promise를 돌려주지 않는다
    p.catch(() => {
      if (!retry) return;
      clearTimeout(this._lockRetry);
      this._lockRetry = setTimeout(() => this._requestPointerLock(false), 1200);
    });
  }

  /** 바깥(대화 종료 등)에서 조작을 되돌려줄 때 */
  requestLock() { this._requestPointerLock(); }

  _setKeyState(code, down) {
    const keyName = "key:" + code;
    if (down) {
      if (!this._pressed.has(keyName)) this._justPressed.add(keyName);
      this._pressed.add(keyName);
    } else {
      this._pressed.delete(keyName);
    }
    this._updateMoveVectorFromKeys();
  }

  _updateMoveVectorFromKeys() {
    const p = this._pressed;
    let x = 0, z = 0;
    if (p.has("key:KeyW") || p.has("key:ArrowUp")) z += 1;
    if (p.has("key:KeyS") || p.has("key:ArrowDown")) z -= 1;
    if (p.has("key:KeyD") || p.has("key:ArrowRight")) x += 1;
    if (p.has("key:KeyA") || p.has("key:ArrowLeft")) x -= 1;
    const len = Math.hypot(x, z);
    if (len > 1) { x /= len; z /= len; }
    this.moveVector.x = x;
    this.moveVector.z = z;
  }

  _fireAction(action) {
    this._justPressed.add(action);
    this._onAction?.(action);
  }

  // ---------------- 모바일: 가상 조이스틱 + 터치 드래그 + 버튼 ----------------

  _bindTouch() {
    const joystickZone = document.getElementById("touch-joystick-zone");
    const joystickKnob = document.getElementById("touch-joystick-knob");
    const lookZone = document.getElementById("touch-look-zone");

    // 조이스틱
    let stickTouchId = null;
    let stickCenter = { x: 0, y: 0 };
    const maxRadius = 42;

    joystickZone.addEventListener("touchstart", (e) => {
      const t = e.changedTouches[0];
      stickTouchId = t.identifier;
      const rect = joystickZone.getBoundingClientRect();
      stickCenter = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
      e.preventDefault();
    }, { passive: false });

    joystickZone.addEventListener("touchmove", (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier !== stickTouchId) continue;
        let dx = t.clientX - stickCenter.x;
        let dy = t.clientY - stickCenter.y;
        const dist = Math.hypot(dx, dy);
        if (dist > maxRadius) { dx = (dx / dist) * maxRadius; dy = (dy / dist) * maxRadius; }
        joystickKnob.style.transform = `translate(-50%, -50%) translate(${dx}px, ${dy}px)`;
        this.moveVector.x = dx / maxRadius;
        this.moveVector.z = -dy / maxRadius; // 위로 밀면 전진(+z)
      }
      e.preventDefault();
    }, { passive: false });

    const releaseStick = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier !== stickTouchId) continue;
        stickTouchId = null;
        joystickKnob.style.transform = "translate(-50%, -50%)";
        this.moveVector.x = 0;
        this.moveVector.z = 0;
      }
    };
    joystickZone.addEventListener("touchend", releaseStick);
    joystickZone.addEventListener("touchcancel", releaseStick);

    // 시선 드래그
    let lookTouchId = null;
    let lastLook = { x: 0, y: 0 };

    lookZone.addEventListener("touchstart", (e) => {
      const t = e.changedTouches[0];
      lookTouchId = t.identifier;
      lastLook = { x: t.clientX, y: t.clientY };
      e.preventDefault();
    }, { passive: false });

    lookZone.addEventListener("touchmove", (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier !== lookTouchId) continue;
        const dx = t.clientX - lastLook.x;
        const dy = t.clientY - lastLook.y;
        lastLook = { x: t.clientX, y: t.clientY };
        this.lookDelta.x += dx * this._touchLookSensitivity;
        this.lookDelta.y += dy * this._touchLookSensitivity;
      }
      e.preventDefault();
    }, { passive: false });

    const releaseLook = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === lookTouchId) lookTouchId = null;
      }
    };
    lookZone.addEventListener("touchend", releaseLook);
    lookZone.addEventListener("touchcancel", releaseLook);

    // 버튼들
    this._bindTouchButton("btn-attack", "attack");
    this._bindTouchButton("btn-jump", "jump");
    this._bindTouchButton("btn-interact", "interact");
    this._bindTouchButton("btn-view", "view");
  }

  _bindTouchButton(elId, action) {
    const el = document.getElementById(elId);
    if (!el) return;
    el.addEventListener("touchstart", (e) => {
      this._pressed.add(action);
      this._fireAction(action);
      e.preventDefault();
    }, { passive: false });
    el.addEventListener("touchend", (e) => {
      this._pressed.delete(action);
      e.preventDefault();
    }, { passive: false });
  }
}
