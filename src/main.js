import * as THREE from "three";
import { Device } from "./core/Device.js";
import { Input } from "./core/Input.js";
import { Loop } from "./core/Loop.js";
import { Game } from "./core/Game.js";
import { World } from "./world/World.js";
import { Player } from "./player/Player.js";
import { CameraRig } from "./player/CameraRig.js";
import { setupTouchControls } from "./ui/TouchControls.js";

// ---------------------------------------------------------------
// 1단계: 움직이는 3D 월드. 렌더러 세팅 → 월드/플레이어/카메라 구성 →
// 적응형 고정 틱 루프 시작. 이후 단계(캐릭터, 전투, 저장…)는 여기에
// 새 시스템을 addSystem()/addRenderable()로 등록해 나가는 방식으로 붙는다.
// ---------------------------------------------------------------

const canvas = document.getElementById("game-canvas");
const loadingScreen = document.getElementById("loading-screen");
const loadingBarFill = document.getElementById("loading-bar-fill");
const loadingText = document.getElementById("loading-text");
const titleScreen = document.getElementById("title-screen");
const hud = document.getElementById("hud");
const debugOverlay = document.getElementById("debug-overlay");

function setLoadingProgress(pct, label) {
  loadingBarFill.style.width = `${pct}%`;
  if (label) loadingText.textContent = label;
}

async function boot() {
  setLoadingProgress(10, "기기 사양 확인 중...");
  const device = new Device();
  setupTouchControls(device);

  setLoadingProgress(30, "렌더러 준비 중...");
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: device.tierName !== "low" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, device.tier.pixelRatioCap));
  renderer.shadowMap.enabled = device.tier.shadows;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 600);

  setLoadingProgress(55, "아스티온 대륙을 그리는 중...");
  const world = new World(scene, device);

  setLoadingProgress(75, "플레이어 준비 중...");
  const player = new Player(world.spawnPoint, world.collision, { outlines: device.tierName !== "low" });
  scene.add(player.mesh);

  const cameraRig = new CameraRig(camera, player);

  const input = new Input({ canvas, device });
  input.onAction((action) => {
    if (action === "view") cameraRig.toggleView();
  });

  const game = new Game();
  Object.assign(game.state, { scene, camera, renderer, player, world, device, input, cameraRig });

  game.addSystem({
    update(dt) {
      cameraRig.update(dt);
      player.update(dt, input, cameraRig.yawRadians);
    },
  });

  game.addRenderable({
    render(alpha) {
      player.syncMesh(alpha);
      cameraRig.render(alpha);
    },
  });

  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }
  window.addEventListener("resize", resize);
  window.addEventListener("orientationchange", resize);
  resize();

  const loop = new Loop({
    device,
    preFrame: () => {
      cameraRig.applyLook(input.lookDelta);
      input.clearFrame();
    },
    update: (dt) => game.update(dt),
    render: (alpha, frameDt) => {
      game.render(alpha, frameDt);
      renderer.render(scene, camera);
      updateDebugOverlay(loop, device);
    },
  });

  let debugAccum = 0;
  function updateDebugOverlay(loop, device) {
    debugAccum++;
    if (debugAccum % 10 !== 0) return; // 과도한 DOM 갱신 방지
    const info = loop.getDebugInfo();
    const r = renderer.info.render;
    // 드로우콜이 모바일 성능의 실제 병목이다. 150회를 넘으면 경고 색으로 표시한다.
    const heavy = r.calls > 150;
    debugOverlay.style.color = heavy ? "#e8a05a" : "";
    debugOverlay.textContent =
      `FPS ${info.fps.toFixed(0)}  틱 ${info.tickHz}Hz  등급 ${info.tier}  부하 ${(info.loadRatio * 100).toFixed(0)}%\n` +
      `드로우콜 ${r.calls}  삼각형 ${(r.triangles / 1000).toFixed(0)}k  텍스처 ${renderer.info.memory.textures}\n` +
      `${device.isTouch ? "터치" : "마우스/키보드"} 입력`;
  }

  setLoadingProgress(100, "완료");
  await new Promise((r) => setTimeout(r, 150));
  loadingScreen.hidden = true;
  titleScreen.hidden = false;

  document.getElementById("btn-new-game").addEventListener("click", () => {
    startGame();
  });
  document.getElementById("btn-continue").addEventListener("click", () => {
    // 6단계에서 저장 데이터 불러오기로 연결된다. 지금은 새 게임과 동일하게 시작.
    startGame();
  });

  function startGame() {
    titleScreen.hidden = true;
    hud.hidden = false;
    loop.start();
  }
}

boot();
