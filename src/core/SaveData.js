// 저장과 이어하기.
//
// 서버가 없으므로 localStorage에 넣는다. Vercel 정적 배포와도 맞는다.
//
// 두 가지를 반드시 지킨다.
//  1. version 필드 — 개발 중 구조가 바뀌면 마이그레이션으로 옛 저장을 살린다.
//     없으면 갱신할 때마다 플레이어의 진행이 날아간다.
//  2. 모든 접근을 try/catch — 시크릿 모드나 저장소 차단 시 예외가 난다.
//     그때도 저장만 안 될 뿐 게임은 돌아가야 한다.

const PREFIX = "ee.save.";
const SETTINGS_KEY = "ee.settings";
const VERSION = 3;
export const SLOT_COUNT = 3;

/** localStorage가 실제로 쓸 수 있는지 (시크릿 모드 등에서 false) */
export function storageAvailable() {
  try {
    const k = "ee.probe";
    localStorage.setItem(k, "1");
    localStorage.removeItem(k);
    return true;
  } catch {
    return false;
  }
}

function read(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

// ---------------- 마이그레이션 ----------------

/**
 * 옛 저장을 현재 구조로 올린다. 한 단계씩 순서대로 태운다.
 * 새 버전을 올릴 때 여기에 한 칸을 추가하면 옛 저장이 살아난다.
 */
function migrate(data) {
  let d = { ...data };

  if ((d.version ?? 1) < 2) {
    // v1 → v2: 퀘스트 기록과 세력 평판이 없던 시절
    d.quests ??= { state: {}, counters: {} };
    d.reputation ??= {};
    d.version = 2;
  }

  if (d.version < 3) {
    // v2 → v3: 화합물 해금과 하이브리드 자세가 추가됨
    d.player ??= {};
    d.player.compounds ??= [];
    d.player.hybridMode ??= "striker";
    d.version = 3;
  }

  return d;
}

// ---------------- 저장 ----------------

export function slotKey(i) { return PREFIX + i; }

/**
 * @param {number} slot 0~2
 * @param {object} ctx { player, codex, flags, reputation, questLog, world }
 */
export function save(slot, ctx) {
  const p = ctx.player;
  const data = {
    version: VERSION,
    savedAt: Date.now(),
    playtime: Math.round(ctx.playtime ?? 0),

    player: {
      x: p.position.x, y: p.position.y, z: p.position.z,
      yaw: p.yaw,
      hp: p.hp,
      electrons: p.electrons.value,
      level: p.progress.level,
      exp: p.progress.exp,
      chapter: p.progress.chapter,
      owned: [...p.progress.owned],
      equipped: [...p.progress.equipped],
      compounds: [...(p.progress.compounds ?? [])],
      hybridMode: p.hybridMode,
      activeSlot: p.activeSlot,
    },

    codex: ctx.codex.toJSON(),
    flags: [...ctx.flags],
    reputation: ctx.reputation.toJSON(),
    quests: ctx.questLog.toJSON(),
  };

  return write(slotKey(slot), data);
}

/** @returns {object|null} 마이그레이션까지 끝난 데이터 */
export function load(slot) {
  const raw = read(slotKey(slot));
  if (!raw) return null;
  return migrate(raw);
}

export function clear(slot) {
  try { localStorage.removeItem(slotKey(slot)); return true; } catch { return false; }
}

/** 슬롯 목록 — 타이틀 화면과 저장 메뉴에 쓴다 */
export function listSlots() {
  const out = [];
  for (let i = 0; i < SLOT_COUNT; i++) {
    const d = load(i);
    out.push(d ? {
      slot: i,
      empty: false,
      level: d.player?.level ?? 1,
      chapter: d.player?.chapter ?? 1,
      owned: (d.player?.owned ?? []).length,
      codex: (d.codex ?? []).length,
      playtime: d.playtime ?? 0,
      savedAt: d.savedAt ?? 0,
    } : { slot: i, empty: true });
  }
  return out;
}

export function hasAnySave() {
  return listSlots().some((s) => !s.empty);
}

/** 가장 최근에 저장한 슬롯 — "이어하기"가 이걸 연다 */
export function latestSlot() {
  const filled = listSlots().filter((s) => !s.empty);
  if (filled.length === 0) return -1;
  return filled.sort((a, b) => b.savedAt - a.savedAt)[0].slot;
}

// ---------------- 불러오기 적용 ----------------

/**
 * 저장 데이터를 실제 게임 객체에 되돌린다.
 * @param {object} data load()의 반환값
 * @param {object} ctx save()와 같은 구성
 */
export function apply(data, ctx) {
  const p = ctx.player;
  const d = data.player ?? {};

  p.position.set(d.x ?? 0, d.y ?? 0, d.z ?? 0);
  p.prevPosition.copy(p.position);
  p.yaw = d.yaw ?? 0;
  p.velocityY = 0;
  p.dead = false;

  p.progress.level = d.level ?? 1;
  p.progress.exp = d.exp ?? 0;
  p.progress.chapter = d.chapter ?? 1;
  p.progress.owned = new Set(d.owned ?? []);
  p.progress.equipped = (d.equipped ?? []).filter(Boolean);
  p.progress.compounds = new Set(d.compounds ?? []);
  p.hybridMode = d.hybridMode ?? "striker";

  ctx.codex.fromJSON(data.codex ?? []);

  ctx.flags.clear();
  for (const f of data.flags ?? []) ctx.flags.add(f);

  for (const [k, v] of Object.entries(data.reputation ?? {})) {
    ctx.reputation.values[k] = v;
  }

  const q = data.quests ?? {};
  Object.assign(ctx.questLog.state, q.state ?? {});
  Object.assign(ctx.questLog.counters, q.counters ?? {});

  // 장착 원소를 복원한 뒤 능력치를 다시 계산해야 순서가 맞다
  ctx.onLoaded?.();
  const slot = d.activeSlot ?? 0;
  if (!p.setSlot(slot)) p._recalcStats();

  // 체력·전자는 최대치 재계산 뒤에 넣어야 잘리지 않는다
  p.hp = Math.min(p.hpMax, d.hp ?? p.hpMax);
  p.electrons.value = Math.min(p.electrons.max, d.electrons ?? p.electrons.max);

  return true;
}

// ---------------- 설정 ----------------

const DEFAULT_SETTINGS = {
  sensitivity: 0.4,      // 0~1
  cameraLock: true,      // 전투 시 카메라 자동 추적
  tier: "auto",          // auto | high | mid | low
  shadows: true,
  particles: true,
};

export function loadSettings() {
  return { ...DEFAULT_SETTINGS, ...(read(SETTINGS_KEY) ?? {}) };
}

export function saveSettings(s) {
  // 설정은 저장 슬롯과 별개 키에 둔다 — 새 게임을 시작해도 유지되어야 한다
  return write(SETTINGS_KEY, s);
}

// ---------------- 표시용 ----------------

export function formatPlaytime(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return h > 0 ? `${h}시간 ${m}분` : `${m}분`;
}

export function formatDate(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
