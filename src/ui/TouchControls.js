// 모바일 여부에 따라 터치 컨트롤 DOM을 보이거나 숨긴다.
// 실제 입력 처리(조이스틱 드래그 등)는 core/Input.js가 같은 DOM 요소에 직접 바인딩한다 —
// 이 모듈은 "보일지 말지"만 결정하는 얇은 스위치다.

export function setupTouchControls(device) {
  const el = document.getElementById("touch-controls");
  if (device.isTouch) {
    el.hidden = false;
  } else {
    el.hidden = true;
  }
}
