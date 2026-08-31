import * as THREE from "three";
import { Device } from "./core/Device.js";
import { Input } from "./core/Input.js";
import { Loop } from "./core/Loop.js";
import { Game } from "./core/Game.js";
import { World } from "./world/World.js";
import { Player } from "./player/Player.js";
import { CameraRig } from "./player/CameraRig.js";
import { setupTouchControls } from "./ui/TouchControls.js";
import { Compass } from "./ui/Compass.js";
import { CharacterLoader } from "./characters/CharacterLoader.js";
import { NPC, NPC_PLACEMENTS } from "./characters/NPC.js";
import { getElement } from "./data/elements.js";
import { hasDialogue } from "./data/dialogue.js";
import { Reputation } from "./data/factions.js";
import { Dialogue } from "./ui/Dialogue.js";
import { Codex } from "./ui/Codex.js";

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
  let uiRefs = null; // 아래에서 대화·도감이 만들어진 뒤 채운다
  input.onAction((action) => {
    // 대화 중에는 진행/종료만 받는다
    if (uiRefs?.dialogue.active) {
      if (action === "interact" || action === "attack" || action === "jump") uiRefs.dialogue.advance();
      else if (action === "menu") uiRefs.dialogue.close();
      return;
    }
    if (uiRefs?.codex.open) {
      if (action === "codex" || action === "menu") uiRefs.codex.hide();
      return;
    }

    if (action === "view") cameraRig.toggleView();
    else if (action === "codex") {
      document.exitPointerLock?.();
      uiRefs?.codex.show();
    } else if (action === "interact") {
      const npc = uiRefs?.nearestTalkable();
      if (npc) uiRefs.talkTo(npc);
    }
  });

  setLoadingProgress(85, "마을 사람들을 부르는 중...");
  const charLoader = new CharacterLoader({ outlines: device.tierName !== "low" });
  const npcs = [];
  for (const spec of NPC_PLACEMENTS) {
    const el = getElement(spec.elementId);
    if (!el) continue;
    const model = await charLoader.build(el);
    scene.add(model);
    npcs.push(new NPC(model, spec));
    // NPC도 벽처럼 통과하지 못하게 막는다
    world.collision.addBox(spec.x, spec.z, 0.8, 0.8, 0, 1.8);
  }

  // ---- 진행 상태 ----
  // 6단계에서 SaveData가 이 셋을 그대로 직렬화한다.
  const flags = new Set();
  const reputation = new Reputation();
  const codex = new Codex();

  const dialogue = new Dialogue({
    onEffect: (fx) => {
      if (fx.flag) flags.add(fx.flag);
      if (fx.rep) reputation.add(fx.rep[0], fx.rep[1]);
      if (fx.codex) codex.discover(fx.codex);
    },
    onClose: () => {
      // 대화가 끝나면 다시 조작을 돌려준다
      if (!device.isTouch) canvas.requestPointerLock?.();
    },
  });

  // 대화 상대는 도감에 자동 등록된다 — 만난 것 자체가 발견이다
  function talkTo(npc) {
    if (!hasDialogue(npc.element.id)) return;
    codex.discover(npc.element.id);
    document.exitPointerLock?.();
    dialogue.open(npc.element.id, flags);
  }

  /** 대화 가능한 가장 가까운 NPC */
  function nearestTalkable() {
    let best = null;
    for (const npc of npcs) {
      if (!npc.inTalkRange || !hasDialogue(npc.element.id)) continue;
      if (!best || npc.distance < best.distance) best = npc;
    }
    return best;
  }

  const interactHint = document.getElementById("interact-hint");
  const interactName = document.getElementById("interact-name");
  const interactKey = document.getElementById("interact-key");
  interactKey.textContent = device.isTouch ? "대화" : "우클릭";

  const game = new Game();
  Object.assign(game.state, { scene, camera, renderer, player, world, device, input, cameraRig });

  uiRefs = { dialogue, codex, talkTo, nearestTalkable };

  game.addSystem({
    update(dt) {
      // 대화·도감이 열려 있으면 플레이어를 멈춘다. 카메라와 NPC는 계속 살아 있다.
      const uiOpen = dialogue.active || codex.open;
      cameraRig.update(dt);
      if (!uiOpen) player.update(dt, input, cameraRig.yawRadians);
      for (const npc of npcs) npc.update(dt, player.position);

      dialogue.update(dt);

      // 상호작용 안내
      const target = uiOpen ? null : nearestTalkable();
      interactHint.hidden = !target;
      if (target) interactName.textContent = `${target.element.ko} (${target.element.sym})`;
    },
  });

  const compass = new Compass(document.getElementById("compass"), player, cameraRig);

  game.addRenderable({
    render(alpha) {
      player.syncMesh(alpha);
      cameraRig.render(alpha);
      compass.render();
    },
  });

  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    compass?.resize();
  }
  window.addEventListener("resize", resize);
  window.addEventListener("orientationchange", resize);
  resize();

  const loop = new Loop({
    device,
    preFrame: () => {
      cameraRig.applyLook(input.lookDelta);
      input.clearLook(); // 시선만 비운다 — 액션 플래그는 update가 읽어야 하므로 남겨둔다
    },
    update: (dt) => game.update(dt),
    render: (alpha, frameDt) => {
      game.render(alpha, frameDt);
      renderer.render(scene, camera);
      updateDebugOverlay(loop, device);
      input.clearFrame(); // update가 모두 끝난 뒤에 액션 플래그를 비운다
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
      `병합 ${world.stats.mergedFrom}→${world.stats.drawCalls}  인스턴스 ${world.stats.instances}\n` +
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
    // HUD가 숨겨져 있는 동안엔 캔버스 크기가 0으로 측정된다. 보인 뒤에 다시 잰다.
    compass.resize();
    loop.start();
  }
}

boot();
