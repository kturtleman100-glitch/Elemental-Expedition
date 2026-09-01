// VRM에서 썸네일 이미지를 제거한다.
//
// VRoid는 미리보기용 썸네일을 1~1.3MB PNG로 넣어 내보내는데, 게임에서는
// 쓰지 않는다. 39명이면 그것만 50MB다.
//
// GLB는 [헤더][JSON 청크][BIN 청크] 구조이고, 이미지 데이터는 bufferView로
// BIN 안을 가리킨다. 하나를 빼면 뒤따르는 bufferView의 offset이 전부 밀리고
// 인덱스도 하나씩 당겨지므로, 참조하는 곳을 모두 다시 매핑해야 한다.
//
// 사용법:  node tools/strip-vrm-thumbnail.mjs assets/models/*.vrm

import fs from "fs";
import path from "path";

const GLB_MAGIC = 0x46546c67;
const CHUNK_JSON = 0x4e4f534a;
const CHUNK_BIN = 0x004e4942;

function readGLB(buf) {
  if (buf.readUInt32LE(0) !== GLB_MAGIC) throw new Error("GLB가 아님");
  let off = 12;
  let json = null;
  let bin = null;
  while (off + 8 <= buf.length) {
    const len = buf.readUInt32LE(off);
    const type = buf.readUInt32LE(off + 4);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === CHUNK_JSON) json = JSON.parse(data.toString("utf8"));
    else if (type === CHUNK_BIN) bin = data;
    off += 8 + len;
  }
  if (!json) throw new Error("JSON 청크 없음");
  return { json, bin: bin ?? Buffer.alloc(0) };
}

function pad4(n) { return (4 - (n % 4)) % 4; }

function writeGLB(json, bin) {
  const jsonStr = JSON.stringify(json);
  const jsonBuf = Buffer.from(jsonStr, "utf8");
  const jsonPad = pad4(jsonBuf.length);
  const binPad = pad4(bin.length);

  const total = 12 + 8 + jsonBuf.length + jsonPad + (bin.length ? 8 + bin.length + binPad : 0);
  const out = Buffer.alloc(total);
  let o = 0;

  out.writeUInt32LE(GLB_MAGIC, o); o += 4;
  out.writeUInt32LE(2, o); o += 4;
  out.writeUInt32LE(total, o); o += 4;

  out.writeUInt32LE(jsonBuf.length + jsonPad, o); o += 4;
  out.writeUInt32LE(CHUNK_JSON, o); o += 4;
  jsonBuf.copy(out, o); o += jsonBuf.length;
  out.fill(0x20, o, o + jsonPad); o += jsonPad; // JSON 패딩은 공백

  if (bin.length) {
    out.writeUInt32LE(bin.length + binPad, o); o += 4;
    out.writeUInt32LE(CHUNK_BIN, o); o += 4;
    bin.copy(out, o); o += bin.length;
    out.fill(0x00, o, o + binPad);
  }
  return out;
}

/** 썸네일로 쓰이는 이미지 인덱스를 찾는다 (VRM 1.0 / 0.0 모두) */
function findThumbnailImage(json) {
  const ext = json.extensions ?? {};

  // VRM 1.0 — meta.thumbnailImage 가 image 인덱스를 직접 가리킨다
  const v1 = ext.VRMC_vrm?.meta?.thumbnailImage;
  if (typeof v1 === "number") return { image: v1, clear: () => delete ext.VRMC_vrm.meta.thumbnailImage };

  // VRM 0.0 — meta.texture 가 texture 인덱스를 가리킨다
  const v0 = ext.VRM?.meta?.texture;
  if (typeof v0 === "number" && v0 >= 0) {
    const tex = json.textures?.[v0];
    if (tex && typeof tex.source === "number") {
      return { image: tex.source, clear: () => { ext.VRM.meta.texture = -1; } };
    }
  }

  // 참조가 없어도 이름이 Thumbnail인 이미지는 지운다 (VRoid가 그렇게 내보낸다)
  const byName = (json.images ?? []).findIndex((im) => /thumbnail/i.test(im.name ?? ""));
  if (byName >= 0) return { image: byName, clear: () => {} };

  return null;
}

/**
 * 재질이 실제로 참조하는 texture 인덱스를 모두 모은다.
 *
 * VRoid는 썸네일에도 texture 항목을 만들어 두는데, 그 texture를 쓰는 재질은 없다.
 * "texture가 가리키니까 쓰이는 중"으로 판단하면 아무것도 지우지 못한다.
 * 재질까지 따라가야 실제 사용 여부를 알 수 있다.
 */
function texturesUsedByMaterials(json) {
  const used = new Set();
  const walk = (o) => {
    if (!o || typeof o !== "object") return;
    if (Array.isArray(o)) { o.forEach(walk); return; }
    if (typeof o.index === "number") used.add(o.index);
    for (const k of Object.keys(o)) walk(o[k]);
  };
  walk(json.materials ?? []);
  return used;
}

/** 이 이미지가 실제 재질에서 쓰이면 지우면 안 된다 */
function imageUsedByMaterial(json, imageIndex) {
  const used = texturesUsedByMaterials(json);
  return (json.textures ?? []).some((t, i) => t.source === imageIndex && used.has(i));
}

function strip(file) {
  const before = fs.statSync(file).size;
  const { json, bin } = readGLB(fs.readFileSync(file));

  const found = findThumbnailImage(json);
  if (!found) return { file, skipped: "썸네일 없음" };

  const imgIdx = found.image;
  const image = json.images?.[imgIdx];
  if (!image || typeof image.bufferView !== "number") return { file, skipped: "썸네일 데이터 없음" };

  if (imageUsedByMaterial(json, imgIdx)) {
    // 다른 재질이 같은 이미지를 쓰고 있으면 참조만 끊는다
    found.clear();
    fs.writeFileSync(file, writeGLB(json, bin));
    return { file, before, after: fs.statSync(file).size, note: "참조만 제거(재질이 공유 중)" };
  }

  const bvIdx = image.bufferView;

  // ---- BIN 재구성: 제거 대상 bufferView를 빼고 다시 이어붙인다 ----
  const views = json.bufferViews ?? [];
  const chunks = [];
  const newOffset = new Array(views.length).fill(-1);
  let cursor = 0;

  views.forEach((v, i) => {
    if (i === bvIdx) return;
    const start = v.byteOffset ?? 0;
    const part = bin.subarray(start, start + v.byteLength);
    const padding = pad4(cursor);
    if (padding) { chunks.push(Buffer.alloc(padding)); cursor += padding; }
    newOffset[i] = cursor;
    chunks.push(part);
    cursor += v.byteLength;
  });

  const newBin = Buffer.concat(chunks);

  // ---- bufferView 배열 갱신 + 인덱스 재매핑 표 ----
  const remap = new Array(views.length).fill(-1);
  const newViews = [];
  views.forEach((v, i) => {
    if (i === bvIdx) return;
    remap[i] = newViews.length;
    newViews.push({ ...v, byteOffset: newOffset[i] });
  });
  json.bufferViews = newViews;

  const fix = (obj, key) => {
    if (obj && typeof obj[key] === "number") {
      const r = remap[obj[key]];
      if (r >= 0) obj[key] = r;
      else delete obj[key];
    }
  };

  for (const a of json.accessors ?? []) {
    fix(a, "bufferView");
    if (a.sparse) {
      fix(a.sparse.indices, "bufferView");
      fix(a.sparse.values, "bufferView");
    }
  }
  for (const im of json.images ?? []) fix(im, "bufferView");

  // ---- 이 이미지만 가리키던 texture 항목도 함께 제거한다 ----
  const usedTex = texturesUsedByMaterials(json);
  const texRemap = [];
  const newTextures = [];
  (json.textures ?? []).forEach((t, i) => {
    if (t.source === imgIdx && !usedTex.has(i)) { texRemap[i] = -1; return; }
    texRemap[i] = newTextures.length;
    newTextures.push(t);
  });
  json.textures = newTextures;

  // 재질 안의 texture 인덱스를 재매핑
  const remapTexRefs = (o) => {
    if (!o || typeof o !== "object") return;
    if (Array.isArray(o)) { o.forEach(remapTexRefs); return; }
    if (typeof o.index === "number" && texRemap[o.index] !== undefined) {
      const r = texRemap[o.index];
      if (r >= 0) o.index = r;
    }
    for (const k of Object.keys(o)) remapTexRefs(o[k]);
  };
  remapTexRefs(json.materials ?? []);

  // ---- 이미지 제거 + 이미지 인덱스 재매핑 ----
  const imgRemap = [];
  const newImages = [];
  (json.images ?? []).forEach((im, i) => {
    if (i === imgIdx) { imgRemap[i] = -1; return; }
    imgRemap[i] = newImages.length;
    newImages.push(im);
  });
  json.images = newImages;

  for (const t of json.textures ?? []) {
    if (typeof t.source === "number") {
      const r = imgRemap[t.source];
      if (r >= 0) t.source = r;
      else delete t.source;
    }
  }

  found.clear();
  json.buffers = [{ byteLength: newBin.length }];

  fs.writeFileSync(file, writeGLB(json, newBin));
  return { file, before, after: fs.statSync(file).size };
}

// ---------------- 실행 ----------------
const files = process.argv.slice(2);
if (files.length === 0) {
  console.log("사용법: node tools/strip-vrm-thumbnail.mjs <파일...>");
  process.exit(1);
}

let saved = 0;
for (const f of files) {
  try {
    const r = strip(f);
    const name = path.basename(r.file);
    if (r.skipped) { console.log(`  ${name.padEnd(10)} 건너뜀 — ${r.skipped}`); continue; }
    const diff = r.before - r.after;
    saved += diff;
    console.log(
      `  ${name.padEnd(10)} ${(r.before / 1048576).toFixed(2)}MB → ${(r.after / 1048576).toFixed(2)}MB` +
      `  (−${(diff / 1048576).toFixed(2)}MB)${r.note ? "  " + r.note : ""}`
    );
  } catch (e) {
    console.log(`  ${path.basename(f)} 실패 — ${e.message}`);
  }
}
console.log(`\n총 ${(saved / 1048576).toFixed(2)}MB 절약`);
