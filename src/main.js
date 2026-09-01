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
import { getElement, PLAYER_ELEMENT } from "./data/elements.js";
import { hasDialogue } from "./data/dialogue.js";
import { Reputation } from "./data/factions.js";
import { Dialogue } from "./ui/Dialogue.js";
import { Codex } from "./ui/Codex.js";
import { HUD } from "./ui/HUD.js";
import { Particles } from "./fx/Particles.js";
import { Encounters } from "./combat/Encounters.js";
import { TargetLock } from "./combat/TargetLock.js";
import { Projectiles } from "./combat/Projectile.js";
import { PartyUI } from "./ui/PartyUI.js";
import { Inventory } from "./ui/Inventory.js";
import { Minimap } from "./ui/Minimap.js";
import { QuestUI } from "./ui/Quest.js";
import { QuestLog } from "./data/quests.js";
import { bondBonuses } from "./data/bonds.js";

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
const hudRoot = document.getElementById("hud"); // HUD 클래스 인스턴스와 이름이 겹치지 않게
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
  // 표시 갱신을 값이 바뀔 때만 하도록 마지막 값을 기억해둔다
  const lastHud = { hp: -1, e: -1, exp: -1, talk: null, target: null };
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
    if (uiRefs?.party.open) {
      if (action === "party" || action === "menu") uiRefs.party.hide();
      return;
    }
    if (uiRefs?.inventory.open) {
      if (action === "inventory" || action === "menu") uiRefs.inventory.hide();
      return;
    }

    if (action === "attack") {
      const r = player.tryAttack(encounters.alive, cameraRig.yawRadians, lockTarget);
      if (!r) return;

      if (r.kind === "cast") {
        // 마법 — 투사체를 날린다. 맞았을 때 피해가 계산된다.
        projectiles.fire({
          from: { x: player.position.x, y: 1.15, z: player.position.z },
          toward: r.aimAt,
          speed: r.style.projectileSpeed ?? 22,
          element: player.element,
          damage: { critical: r.critical },
          fromPlayer: true,
          target: r.target,
        });
        particles.burst({ x: player.position.x, y: 1.15, z: player.position.z },
          player.element.family, 0.35);
        return;
      }

      if (r.kind === "melee" && r.hit) {
        hud.popDamage({ x: r.hit.position.x, y: 1.4, z: r.hit.position.z }, r.result);
        particles.burst({ x: r.hit.position.x, y: 1.1, z: r.hit.position.z },
          player.element.family, r.result.mult >= 1.7 ? 1.5 : 1);
        if (r.died) onEnemyDown(r.hit);
      }
      return;
    }
    if (action === "stance") {
      const mode = player.toggleStance();
      if (mode) {
        lastHud.e = -1; // 표시를 즉시 갱신
        hud.toast(mode === "caster" ? "마법 자세" : "무기 자세", "#c4a8f0");
      } else {
        hud.toast(`${player.element.ko}은(는) 자세를 바꿀 수 없다`, "#9a9488");
      }
      return;
    }
    if (action.startsWith("slot")) {
      const i = Number(action.slice(4)) - 1;
      if (player.setSlot(i)) hud.toast(`${player.element.ko} (${player.element.sym})`, "#56ccf2");
      return;
    }
    if (action === "targetNext") {
      targetLock.cycle(player.position, encounters.alive);
      return;
    }
    if (action === "party") {
      document.exitPointerLock?.();
      uiRefs?.party.show();
      return;
    }
    if (action === "inventory") {
      document.exitPointerLock?.();
      uiRefs?.inventory.show();
      return;
    }
    if (action === "quest") {
      uiRefs?.questUI.toggle();
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

  // 플레이어 모델 — uue.vrm 이 있으면 절차적 자리표시를 교체한다.
  // NPC와 함께 병렬로 받도록 여기서는 약속만 만들어 둔다.
  const playerModelPromise = charLoader.build(PLAYER_ELEMENT);
  // VRM은 하나에 14~17MB다. for 안에서 await하면 넷을 줄줄이 기다려
  // 부팅이 네 배로 길어진다. 한꺼번에 띄워 병렬로 받는다.
  const specs = NPC_PLACEMENTS.map((spec) => ({ spec, el: getElement(spec.elementId) }))
    .filter((x) => x.el);

  let loadedCount = 0;
  const models = await Promise.all(
    specs.map(({ el }) =>
      charLoader.build(el).then((model) => {
        loadedCount++;
        setLoadingProgress(
          85 + (loadedCount / specs.length) * 12,
          "마을 사람들을 부르는 중... (" + loadedCount + "/" + specs.length + ")"
        );
        return model;
      })
    )
  );

  const npcs = [];
  specs.forEach(({ spec }, i) => {
    const model = models[i];
    scene.add(model);
    npcs.push(new NPC(model, spec));
    // NPC도 벽처럼 통과하지 못하게 막는다
    world.collision.addBox(spec.x, spec.z, 0.8, 0.8, 0, 1.8);
  });

  // ---- 진행 상태 ----
  // 6단계에서 SaveData가 이 셋을 그대로 직렬화한다.
  const flags = new Set();
  const reputation = new Reputation();
  const codex = new Codex();
  const questLog = new QuestLog();

  const partyUI = new PartyUI(player, (m, c) => hud.toast(m, c));
  const inventory = new Inventory(player, (m, c) => hud.toast(m, c));
  const minimap = new Minimap(document.getElementById("minimap"), player, cameraRig);
  const questUI = new QuestUI(questLog);

  // 인연 보너스를 능력치에 반영한다. 편성이 바뀔 때만 다시 계산한다.
  let bondSig = "";
  function applyBonds() {
    const sig = player.progress.equipped.join(",");
    if (sig === bondSig) return;
    bondSig = sig;
    player.bondMult = bondBonuses(player.progress.equipped).mult;
    player._recalcStats();
  }

  /** 퀘스트 완료 확인 — 보상 지급까지 */
  function checkQuests() {
    const done = questLog.checkComplete({ flags, codexSize: codex.found.size });
    for (const q of done) {
      hud.toast("[완료] " + q.title, "#8fe388");
      const rw = q.reward ?? {};
      if (rw.exp) {
        const g = player.progress.addExp(rw.exp);
        if (g.leveled) hud.toast("레벨 " + player.progress.level, "#8fe388");
      }
      if (rw.rep) reputation.add(rw.rep[0], rw.rep[1]);
      if (rw.element) {
        const el = getElement(rw.element);
        if (el && player.progress.acquire(rw.element)) {
          codex.discover(rw.element);
          hud.toast(el.ko + "(" + el.sym + ")이(가) 동료가 되었다", "#56ccf2");
          applyBonds();
        }
      }
    }
  }

  const particles = new Particles(scene);
  const encounters = new Encounters(scene, { outlines: device.tierName !== "low", loader: charLoader });
  const projectiles = new Projectiles(scene, particles);
  const targetLock = new TargetLock();
  const hud = new HUD(camera);

  /** 적을 쓰러뜨렸을 때의 보상 처리 — 근접과 투사체가 함께 쓴다 */
  function onEnemyDown(enemy) {
    const gain = player.progress.addExp(enemy.expReward);
    hud.toast(`${enemy.element.ko} 격파  +${enemy.expReward} EXP`, "#f2c94c");
    if (gain.leveled) {
      player._recalcStats();
      hud.toast(`레벨 ${player.progress.level}`, "#8fe388");
    }
    // 쓰러뜨린 원소를 얻는다 — 이 게임의 성장은 원소 수집이다
    if (player.progress.acquire(enemy.element.id)) {
      codex.discover(enemy.element.id);
      hud.toast(`${enemy.element.ko}(${enemy.element.sym})의 힘을 얻었다`, "#56ccf2");
      applyBonds();
    }
    questLog.onDefeat(enemy.element.id);
    checkQuests();
  }

  player.onDamaged = (result) => {
    hud.popDamage({ x: player.position.x, y: 1.2, z: player.position.z }, result);
  };
  player.onDeath = () => {
    hud.toast("쓰러졌다… 마을로 돌아간다", "#eb5757");
    setTimeout(() => {
      player.revive(world.spawnPoint);
      targetLock.clear();
    }, 1600);
  };

  const dialogue = new Dialogue({
    onEffect: (fx) => {
      if (fx.flag) flags.add(fx.flag);
      if (fx.rep) reputation.add(fx.rep[0], fx.rep[1]);
      if (fx.codex) codex.discover(fx.codex);
      checkQuests();
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

  player.setModel(await playerModelPromise, scene);
  cameraRig.refreshModel();

  const game = new Game();
  Object.assign(game.state, { scene, camera, renderer, player, world, device, input, cameraRig });

  uiRefs = { dialogue, codex, party: partyUI, inventory, questUI, talkTo, nearestTalkable };
  applyBonds();

  // 논리는 update(고정 틱), 표시는 render(프레임당 1회).
  //
  // DOM을 틱에서 건드리면 안 된다. 틱은 120Hz이고 프레임당 최대 5번 도는데,
  // style.width 하나만 써도 브라우저가 레이아웃을 다시 계산한다.
  // 초당 600번이면 화면이 멈춘다 — 실제로 그렇게 됐었다.
  let lockTarget = null;
  let questTick = 0;
  let talkTarget = null;

  game.addSystem({
    update(dt) {
      // 대화·도감이 열려 있으면 플레이어를 멈춘다. 카메라와 NPC는 계속 살아 있다.
      const uiOpen = dialogue.active || codex.open || partyUI.open || inventory.open;

      // 락온 — 카메라 갱신 전에 타겟을 정해야 이번 틱에 반영된다
      lockTarget = uiOpen ? null : targetLock.update(player.position, cameraRig.yawRadians, encounters.alive);
      cameraRig.setLockTarget(lockTarget);
      cameraRig.update(dt);

      if (!uiOpen) {
        player.update(dt, input, cameraRig.yawRadians);
        encounters.update(dt, player, particles, world.collision, projectiles);
        projectiles.update(dt, encounters.alive, player, (enemy, dmg) => {
          const { result, died } = player.resolveHit(enemy, dmg?.critical);
          hud.popDamage({ x: enemy.position.x, y: 1.4, z: enemy.position.z }, result);
          if (died) onEnemyDown(enemy);
        });
      }
      for (const npc of npcs) npc.update(dt, player.position);

      particles.update(dt);

      // 전투 중에는 대화를 걸 수 없다
      talkTarget = uiOpen || targetLock.inCombat ? null : nearestTalkable();

      if (!uiOpen) {
        questLog.onMove(player.position.x, player.position.z);
        questTick -= dt;
        if (questTick <= 0) { questTick = 0.5; checkQuests(); }
      }
    },
  });

  const compass = new Compass(document.getElementById("compass"), player, cameraRig);


  game.addRenderable({
    render(alpha, frameDt) {
      const dt = frameDt ?? 0.016;

      player.syncMesh(alpha);
      world.followLight(player.position.x, player.position.z);
      cameraRig.render(alpha);
      compass.render();
      minimap.enemies = encounters.enemies;
      minimap.npcs = npcs.map((n) => ({ x: n.x, z: n.z }));
      minimap.render();
      questUI.render({ flags, codexSize: codex.found.size });
      dialogue.update(dt);
      hud.render(dt);

      // ---- DOM 갱신: 프레임당 1회, 값이 바뀌었을 때만 ----
      const hp = Math.ceil(player.hp);
      const e = Math.floor(player.electrons.value);
      const exp = player.progress.exp;
      if (hp !== lastHud.hp || e !== lastHud.e || exp !== lastHud.exp) {
        lastHud.hp = hp; lastHud.e = e; lastHud.exp = exp;
        hud.updateBars({
          hp: player.hp, hpMax: player.hpMax,
          electrons: player.electrons,
          exp: player.progress.exp, expToNext: player.progress.expToNext,
          level: player.progress.level,
          style: player.style,
        });
      }

      if (lockTarget !== lastHud.target || (lockTarget && lockTarget.hp !== lastHud.targetHp)) {
        lastHud.target = lockTarget;
        lastHud.targetHp = lockTarget?.hp;
        hud.updateTarget(lockTarget, lockTarget ? player.affinityTo(lockTarget) : null);
      }

      if (talkTarget !== lastHud.talk) {
        lastHud.talk = talkTarget;
        interactHint.hidden = !talkTarget;
        if (talkTarget) interactName.textContent = `${talkTarget.element.ko} (${talkTarget.element.sym})`;
      }
    },
  });

  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    compass?.resize();
    particles?.onResize();
    minimap?.resize();
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
    hudRoot.hidden = false;
    // HUD가 숨겨져 있는 동안엔 캔버스 크기가 0으로 측정된다. 보인 뒤에 다시 잰다.
    compass.resize();
    minimap.resize();
    loop.start();
  }
}

boot();
