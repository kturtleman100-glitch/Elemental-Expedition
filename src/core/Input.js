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
  Escape: "menu",
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

  _requestPointerLock() {
    if (document.pointerLockElement !== this.canvas) {
      this.canvas.requestPointerLock?.();
    }
  }

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
