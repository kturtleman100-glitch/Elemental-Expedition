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
import { ELEMENTS, getElement, PLAYER_ELEMENT } from "./data/elements.js";
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
import { SaveMenu } from "./ui/SaveMenu.js";
import * as Save from "./core/SaveData.js";
import { ZoneManager } from "./world/Zone.js";
import { BossFight } from "./combat/Boss.js";
import { availableBosses } from "./data/bosses.js";
import { resolveEnding } from "./data/endings.js";
import { Cinematic } from "./ui/Cinematic.js";
import { PartyManager } from "./characters/PartyMember.js";

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
    if (uiRefs?.saveMenu.open) {
      if (action === "menu") uiRefs.saveMenu.hide();
      return;
    }
    if (action === "menu") {
      document.exitPointerLock?.();
      uiRefs?.saveMenu.show();
      return;
    }

    if (action === "attack") {
      const r = player.tryAttack(allEnemies(), cameraRig.yawRadians, lockTarget);
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
      targetLock.cycle(player.position, allEnemies());
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
  const cine = new Cinematic();
  const party = new PartyManager(scene, charLoader);

  // 지역 — 안개와 조명이 서서히 바뀐다
  const zoneNameEl = document.getElementById("zone-title");
  const zones = new ZoneManager(scene, world.lights, (zn) => {
    document.getElementById("zone-name").textContent = zn.name;
    document.getElementById("zone-sub").textContent = zn.sub ?? "";
    zoneNameEl.hidden = true;
    void zoneNameEl.offsetWidth; // 애니메이션 재시작
    zoneNameEl.hidden = false;
  });

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
    // 편성이 바뀌면 동료도 다시 세운다
    party.sync(player.progress.equipped, player.progress.level, getElement, player.element.id);
  }

  // ---- 보스전 ----
  const bossFight = new BossFight(scene, {
    onIntro: (b) => {
      cine.showBoss(b);
      cine.sayAll(b.def.name, b.lines.intro, b.def.color ?? 0xf2c94c);
    },
    subtitle: (name, text, color) => cine.say(name, text, color),
    onDefeat: (b) => {
      cine.sayAll(b.def.name, b.lines.defeat, b.def.color ?? 0xf2c94c);
      cine.hideBoss();
      onEnemyDown(b);
      if (b.persuaded) {
        flags.add("persuaded_chlorine");
        hud.toast("염소를 설득했다", "#8fd1d4");
      }
      autoSave("보스 격파");
    },
    onTimerEnd: () => {
      flags.add("polonium_timer_expired");
      showEnding();
    },
  });

  /** 조건이 맞는 보스를 마을 밖에 세운다 */
  function spawnBosses() {
    const list = availableBosses(flags).filter((b) => !flags.has("boss_done_" + b.id));
    // 지금은 한 번에 하나만 — 여럿을 동시에 두면 길을 잃는다
    const next = list.sort((a, b) => a.chapter - b.chapter)[0];
    if (!next) return;
    if (bossFight.boss?.def.id === next.id) return;
    bossFight.start(next.id, charLoader, device.tierName !== "low");
  }

  /** 엔딩 판정과 연출 */
  function showEnding() {
    const result = resolveEnding({ flags, reputation, codexSize: codex.found.size });
    loop.stop();
    document.exitPointerLock?.();
    cine.showEnding(result, {
      level: player.progress.level,
      owned: player.progress.owned.size,
      codex: codex.found.size,
      playtime: Save.formatPlaytime(playtime),
    });
    cine.onEndingClose = () => {
      hudRoot.hidden = true;
      titleScreen.hidden = false;
      refreshTitle();
    };
  }

  /** 퀘스트 완료 확인 — 보상 지급까지 */
  function checkQuests() {
    const done = questLog.checkComplete({ flags, codexSize: codex.found.size });
    for (const q of done) {
      hud.toast("[완료] " + q.title, "#8fe388");
      autoSave(q.title);
      const rw = q.reward ?? {};
      if (rw.exp) {
        const g = player.progress.addExp(rw.exp);
        if (g.leveled) hud.toast("레벨 " + player.progress.level, "#8fe388");
      }
      if (rw.rep) reputation.add(rw.rep[0], rw.rep[1]);
      spawnBosses();
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
    if (enemy.isBoss) flags.add("boss_done_" + enemy.def.id);
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

  // ---- 저장 ----
  let playtime = 0;
  let autoSaveTimer = 60;

  const saveContext = () => ({
    player, codex, flags, reputation, questLog, playtime,
  });

  const settings = Save.loadSettings();
  function applySettings(s) {
    input.setSensitivity(s.sensitivity);
    cameraRig.lockEnabled = s.cameraLock;
    renderer.shadowMap.enabled = s.shadows && device.tier.shadows;
    particles.points.visible = s.particles;
    particles.enabled = s.particles;
  }
  applySettings(settings);

  const saveMenu = new SaveMenu({
    getContext: saveContext,
    toast: (m, c) => hud.toast(m, c),
    onSettings: applySettings,
    // 지운 슬롯이 타이틀의 '이어하기'에 남아 있으면 안 된다
    onDeleted: () => refreshTitle(),
    onLoad: (data) => {
      Save.apply(data, { player, codex, flags, reputation, questLog, onLoaded: applyBonds });
      cameraRig.yaw = player.yaw;
      targetLock.clear();
      hud.toast("불러왔습니다", "#8fe388");
    },
    onQuit: () => {
      loop.stop();
      hudRoot.hidden = true;
      titleScreen.hidden = false;
      refreshTitle();
      document.exitPointerLock?.();
    },
  });

  /** 자동 저장 — 진행이 바뀌는 순간마다 부른다 */
  function autoSave(reason) {
    // 베타는 검증용이라 저장하지 않는다. 아니면 한 번 눌러본 것만으로
    // 정식 저장이 전체 해금 상태로 덮어써진다
    if (betaMode) return;
    const slot = Save.latestSlot();
    if (Save.save(slot < 0 ? 0 : slot, saveContext())) {
      hud.toast(reason ? "자동 저장 · " + reason : "자동 저장", "#7c9a8a");
    }
  }

  uiRefs = { dialogue, codex, party: partyUI, inventory, questUI, saveMenu, talkTo, nearestTalkable };
  applyBonds();

  // 논리는 update(고정 틱), 표시는 render(프레임당 1회).
  //
  // DOM을 틱에서 건드리면 안 된다. 틱은 120Hz이고 프레임당 최대 5번 도는데,
  // style.width 하나만 써도 브라우저가 레이아웃을 다시 계산한다.
  // 초당 600번이면 화면이 멈춘다 — 실제로 그렇게 됐었다.
  let lockTarget = null;
  let questTick = 0;

  /** 일반 적과 보스를 함께 넘긴다 — 락온·공격·투사체가 모두 이 목록을 쓴다 */
  function allEnemies() {
    const list = encounters.alive;
    return bossFight.boss?.alive ? [...list, bossFight.boss] : list;
  }
  let talkTarget = null;

  game.addSystem({
    update(dt) {
      // 대화·도감이 열려 있으면 플레이어를 멈춘다. 카메라와 NPC는 계속 살아 있다.
      const uiOpen = dialogue.active || codex.open || partyUI.open || inventory.open || saveMenu.open;

      // 락온 — 카메라 갱신 전에 타겟을 정해야 이번 틱에 반영된다
      lockTarget = uiOpen ? null : targetLock.update(player.position, cameraRig.yawRadians, allEnemies());
      cameraRig.setLockTarget(lockTarget);
      cameraRig.update(dt);

      if (!uiOpen) {
        player.update(dt, input, cameraRig.yawRadians);
        encounters.update(dt, player, particles, world.collision, projectiles);
        bossFight.update(dt, player, particles, world.collision, projectiles);
        party.update(dt, player, allEnemies(), world.collision, {
          particles, projectiles,
          onHit: (enemy, result, died) => {
            hud.popDamage({ x: enemy.position.x, y: 1.4, z: enemy.position.z }, result);
            if (died) onEnemyDown(enemy);
          },
        });
        zones.update(dt, player.position.x, player.position.z);
        projectiles.update(dt, allEnemies(), player, (enemy, dmg) => {
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
        playtime += dt;
        questLog.onMove(player.position.x, player.position.z);
        questTick -= dt;
        if (questTick <= 0) { questTick = 0.5; checkQuests(); }

        // 주기 자동 저장 — 60초마다. 진행이 바뀌는 순간에도 따로 부른다.
        autoSaveTimer -= dt;
        if (autoSaveTimer <= 0) { autoSaveTimer = 60; autoSave(); }
      }
    },
  });

  const compass = new Compass(document.getElementById("compass"), player, cameraRig);


  game.addRenderable({
    render(alpha, frameDt) {
      const dt = frameDt ?? 0.016;

      player.syncMesh(alpha);
      party.setVisible(player.mesh.visible);
      world.followLight(player.position.x, player.position.z);
      cameraRig.render(alpha);
      compass.render();
      minimap.enemies = allEnemies();
      minimap.npcs = npcs.map((n) => ({ x: n.x, z: n.z }));
      minimap.render();
      questUI.render({ flags, codexSize: codex.found.size });
      cine.update(dt);
      cine.updateBoss(bossFight.boss);
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

  /**
   * 베타 검증용 전체 해금. 저장하지 않으므로 정식 진행은 오염되지 않는다.
   * (autoSave가 돌면 덮어쓰므로 beta일 때는 자동 저장을 끈다)
   */
  function grantEverything() {
    for (const el of ELEMENTS) {
      if (el.id === player.element.id) continue; // 플레이어 자신은 제외
      player.progress.owned.add(el.id);
      codex.discover(el.id);
    }
    player.progress.level = 30;
    player.progress.chapter = 7;
    // 편성은 비워 둔다 — 파티 UI에서 직접 골라 보게 하려고
    player.progress.equipped = [];
    // 엔딩·보스 분기를 다 열어 둔다
    for (const f of ["sided_noblesse", "persuaded_chlorine", "oganesson_ally"]) flags.add(f);
    player._recalcStats();
    // electrons는 ElectronPool 객체다. 숫자를 대입하면 풀 자체가 사라져
    // 다음 틱의 electrons.update()에서 터진다
    player.hp = player.hpMax;
    player.electrons.value = player.electrons.max;
    applyBonds();
    betaMode = true;
  }

  let betaMode = false;
  const btnContinue = document.getElementById("btn-continue");
  const slotInfoEl = document.getElementById("title-slotinfo");

  /** 저장이 있으면 이어하기를 켜고 무엇을 이어받는지 보여준다 */
  function refreshTitle() {
    const slot = Save.latestSlot();
    if (slot < 0) {
      btnContinue.disabled = true;
      slotInfoEl.textContent = Save.storageAvailable() ? "" : "이 브라우저에서는 저장할 수 없습니다";
      return;
    }
    btnContinue.disabled = false;
    const s = Save.listSlots()[slot];
    slotInfoEl.textContent = `슬롯 ${slot + 1} · ${s.chapter}장 · 레벨 ${s.level} · ${Save.formatPlaytime(s.playtime)}`;
  }

  setLoadingProgress(100, "완료");
  await new Promise((r) => setTimeout(r, 150));
  loadingScreen.hidden = true;
  titleScreen.hidden = false;
  refreshTitle();

  document.getElementById("btn-new-game").addEventListener("click", () => {
    betaMode = false;
    const slot = Save.latestSlot();
    if (slot >= 0 && !confirm("새로 시작하면 이어하기가 가리키는 저장이 덮어써질 수 있습니다. 계속할까요?")) return;
    startGame();
  });
  btnContinue.addEventListener("click", () => {
    const slot = Save.latestSlot();
    const data = slot >= 0 ? Save.load(slot) : null;
    startGame();
    if (data) {
      Save.apply(data, { player, codex, flags, reputation, questLog, onLoaded: applyBonds });
      cameraRig.yaw = player.yaw;
      playtime = data.playtime ?? 0;
    }
  });

  document.getElementById("btn-beta").addEventListener("click", () => {
    startGame({ beta: true });
    hud.toast("베타 · 원소 " + player.progress.owned.size + "종 해금 (저장 안 함)", "#e2b34a");
  });

  /**
   * @param {{beta?:boolean}} [opts] beta면 모든 원소·레벨·플래그를 미리 준다.
   *   인벤토리·파티·도감처럼 "다 모아야 보이는" 화면을 검증하려면
   *   정공법으로 수십 시간을 플레이해야 하므로 우회로를 둔다.
   */
  function startGame(opts = {}) {
    if (opts.beta) grantEverything();
    document.getElementById("beta-badge").hidden = !opts.beta;
    titleScreen.hidden = true;
    hudRoot.hidden = false;
    // HUD가 숨겨져 있는 동안엔 캔버스 크기가 0으로 측정된다. 보인 뒤에 다시 잰다.
    compass.resize();
    minimap.resize();
    spawnBosses();
    loop.start();
  }
}

boot();
