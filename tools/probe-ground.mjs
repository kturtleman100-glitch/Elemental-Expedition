// 지면과 소품의 실제 높이를 재서 어긋남을 찾는다.
//
// "떠 있다"는 눈으로는 알아도 몇 미터인지, 어느 쪽이 틀렸는지는 알 수 없다.
// window.__debug로 씬을 직접 열어 숫자로 확인한다.
//
// 사용법: node tools/probe-ground.mjs [주소]

import { spawn } from "child_process";
import http from "http";
import crypto from "crypto";
import net from "net";

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const URL_ = process.argv[2] ?? "http://localhost:3100";
const PORT = 9225;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const chrome = spawn(CHROME, [
  "--headless=new", "--use-gl=swiftshader", "--enable-unsafe-swiftshader",
  "--remote-debugging-port=" + PORT,
  "--user-data-dir=" + process.env.TEMP + "\\chrome-ground",
  "--no-first-run", "--window-size=1280,800", URL_,
], { stdio: "ignore" });

function getJSON(path) {
  return new Promise((res, rej) => {
    http.get({ host: "127.0.0.1", port: PORT, path }, (r) => {
      let b = ""; r.on("data", (c) => (b += c));
      r.on("end", () => { try { res(JSON.parse(b)); } catch (e) { rej(e); } });
    }).on("error", rej);
  });
}

function connectWS(wsUrl) {
  const u = new global.URL(wsUrl);
  return new Promise((resolve, reject) => {
    const key = crypto.randomBytes(16).toString("base64");
    const sock = net.connect(Number(u.port), u.hostname, () => {
      sock.write(`GET ${u.pathname}${u.search} HTTP/1.1\r\nHost: ${u.host}\r\n` +
        `Upgrade: websocket\r\nConnection: Upgrade\r\n` +
        `Sec-WebSocket-Key: ${key}\r\nSec-WebSocket-Version: 13\r\n\r\n`);
    });
    let buf = Buffer.alloc(0), open = false;
    const handlers = [];
    sock.on("data", (chunk) => {
      buf = Buffer.concat([buf, chunk]);
      if (!open) {
        const i = buf.indexOf("\r\n\r\n");
        if (i < 0) return;
        if (!buf.slice(0, i).toString().includes("101")) return reject(new Error("핸드셰이크 실패"));
        buf = buf.slice(i + 4); open = true; resolve(api);
      }
      while (buf.length >= 2) {
        const op = buf[0] & 0x0f;
        let len = buf[1] & 0x7f, off = 2;
        if (len === 126) { len = buf.readUInt16BE(2); off = 4; }
        else if (len === 127) { len = Number(buf.readBigUInt64BE(2)); off = 10; }
        if (buf.length < off + len) return;
        const payload = buf.slice(off, off + len);
        buf = buf.slice(off + len);
        if (op === 1) { const m = JSON.parse(payload.toString()); handlers.forEach((h) => h(m)); }
      }
    });
    sock.on("error", reject);
    let nextId = 1;
    const api = {
      send(method, params = {}) {
        const id = nextId++;
        const data = Buffer.from(JSON.stringify({ id, method, params }));
        const head = data.length < 126
          ? Buffer.from([0x81, 0x80 | data.length])
          : Buffer.concat([Buffer.from([0x81, 0xfe]),
              (() => { const b = Buffer.alloc(2); b.writeUInt16BE(data.length); return b; })()]);
        const mask = crypto.randomBytes(4);
        const masked = Buffer.from(data);
        for (let i = 0; i < masked.length; i++) masked[i] ^= mask[i % 4];
        sock.write(Buffer.concat([head, mask, masked]));
        return new Promise((res) => {
          const h = (m) => { if (m.id === id) { handlers.splice(handlers.indexOf(h), 1); res(m); } };
          handlers.push(h);
        });
      },
      on(fn) { handlers.push(fn); },
      close() { sock.destroy(); },
    };
  });
}

// 브라우저 안에서 돌 검사 코드. 씬의 실제 정점을 읽어 heightAt과 대조한다.
const MEASURE = `(() => {
  const d = window.__debug;
  if (!d) return JSON.stringify({ error: "window.__debug 없음" });
  const { scene, world } = d;
  const terrain = world.terrain;
  const out = { grounds: [], mismatch: [], strays: [] };

  // 씬에 있는 모든 메시를 훑어, 넓고 평평한 판을 찾는다
  scene.traverse((o) => {
    if (!o.isMesh || !o.geometry?.attributes?.position) return;
    o.updateMatrixWorld(true);
    const g = o.geometry;
    if (!g.boundingBox) g.computeBoundingBox();
    const bb = g.boundingBox;
    const sx = bb.max.x - bb.min.x, sz = bb.max.z - bb.min.z, sy = bb.max.y - bb.min.y;
    if (sx > 40 && sz > 40) {
      out.grounds.push({
        name: o.name || "(이름없음)",
        size: [+sx.toFixed(1), +sy.toFixed(1), +sz.toFixed(1)],
        posY: +o.position.y.toFixed(3),
        worldMinY: +(bb.min.y + o.position.y).toFixed(2),
        worldMaxY: +(bb.max.y + o.position.y).toFixed(2),
        verts: g.attributes.position.count,
      });
    }
  });

  // 지형 메시의 정점 높이가 heightAt과 맞는가
  const v = new THREE_V3();
  function THREE_V3() { return { x: 0, y: 0, z: 0 }; }
  let worst = 0, worstAt = null, checked = 0;
  scene.traverse((o) => {
    if (!o.isMesh || !o.geometry?.attributes?.position) return;
    const g = o.geometry;
    if (!g.boundingBox) g.computeBoundingBox();
    const bb = g.boundingBox;
    if (bb.max.x - bb.min.x < 40 || bb.max.z - bb.min.z < 40) return;
    const p = g.attributes.position;
    const step = Math.max(1, Math.floor(p.count / 40));
    for (let i = 0; i < p.count; i += step) {
      const wx = p.getX(i) + o.position.x;
      const wz = p.getZ(i) + o.position.z;
      const wy = p.getY(i) + o.position.y;
      const want = terrain.heightAt(wx, wz);
      const err = Math.abs(wy - want);
      checked++;
      if (err > worst) { worst = err; worstAt = { x: +wx.toFixed(1), z: +wz.toFixed(1), mesh: +wy.toFixed(2), want: +want.toFixed(2) }; }
    }
  });
  out.vertexCheck = { checked, worstError: +worst.toFixed(3), worstAt };

  // 소품 메시의 바닥이 지면과 맞는가
  scene.traverse((o) => {
    if (!o.isMesh || !o.geometry?.attributes?.position) return;
    const g = o.geometry;
    if (!g.boundingBox) g.computeBoundingBox();
    const bb = g.boundingBox;
    const sx = bb.max.x - bb.min.x, sz = bb.max.z - bb.min.z;
    if (sx > 40 && sz > 40) return;        // 지형 판은 건너뛴다
    if (bb.max.y - bb.min.y < 0.05) return;
    // 소품 묶음은 청크 하나가 통째로 하나의 메시라 아주 크다. 샘플로 본다
    const p = g.attributes.position;
    if (p.count < 12) return;
    const step = Math.max(1, Math.floor(p.count / 60));
    let float = 0, sunk = 0, n = 0, sumGap = 0;
    for (let i = 0; i < p.count; i += step) {
      const wx = p.getX(i) + o.position.x;
      const wz = p.getZ(i) + o.position.z;
      const wy = p.getY(i) + o.position.y;
      const ground = terrain.heightAt(wx, wz);
      const gap = wy - ground;
      // 정점 하나하나는 위쪽에 있을 수 있으니, 아주 아래인지 아주 위인지만 센다
      if (gap > 0.02) float++; else sunk++;
      sumGap += gap; n++;
    }
    if (n > 0) {
      out.strays.push({
        name: o.name || "(소품묶음)",
        verts: p.count,
        posY: +o.position.y.toFixed(2),
        아래정점: sunk, 위정점: float,
        평균높이차: +(sumGap / n).toFixed(2),
      });
    }
  });
  out.strays = out.strays.slice(0, 8);

  out.player = {
    x: +d.player.position.x.toFixed(1),
    y: +d.player.position.y.toFixed(2),
    z: +d.player.position.z.toFixed(1),
    지형높이: +terrain.heightAt(d.player.position.x, d.player.position.z).toFixed(2),
  };
  return JSON.stringify(out);
})()`;

try {
  let targets = null;
  for (let i = 0; i < 50; i++) {
    try { targets = await getJSON("/json/list"); if (targets.length) break; } catch {}
    await sleep(300);
  }
  const page = targets.find((t) => t.type === "page" && t.url.includes("http")) ?? targets[0];
  const ws = await connectWS(page.webSocketDebuggerUrl);
  await ws.send("Runtime.enable");

  const ev = async (expr) => {
    const r = await ws.send("Runtime.evaluate", { expression: expr, returnByValue: true });
    if (r.result?.exceptionDetails) return { __err: r.result.exceptionDetails.text + " " +
      (r.result.exceptionDetails.exception?.description ?? "") };
    return r.result?.result?.value;
  };

  for (let i = 0; i < 80; i++) {
    if (await ev(`document.getElementById("title-screen")?.hidden === false`)) break;
    await sleep(500);
  }
  await ev(`document.getElementById("btn-beta").click()`);
  await sleep(4000);

  const raw = await ev(MEASURE);
  if (raw?.__err) { console.log("측정 실패: " + raw.__err); }
  else {
    const r = JSON.parse(raw);
    const bar = "=".repeat(70);
    console.log(bar);
    console.log("  플레이어");
    console.log(bar);
    console.log(`  위치 (${r.player.x}, ${r.player.z})  발밑 y=${r.player.y}  지형높이=${r.player.지형높이}`);

    console.log("\n" + bar);
    console.log("  넓은 판(지면) 목록 — 여러 개면 서로 겹쳐 보인다");
    console.log(bar);
    for (const g of r.grounds.slice(0, 12)) {
      console.log(`  ${String(g.size[0]).padStart(6)}x${String(g.size[2]).padEnd(6)} ` +
        `높이범위 ${String(g.worldMinY).padStart(7)} ~ ${String(g.worldMaxY).padEnd(7)} ` +
        `정점 ${String(g.verts).padStart(5)}  posY=${g.posY}`);
    }
    console.log(`  (총 ${r.grounds.length}개)`);

    console.log("\n" + bar);
    console.log("  지형 메시 정점이 heightAt과 맞는가");
    console.log(bar);
    const vc = r.vertexCheck;
    console.log(`  ${vc.checked}개 표본 · 최대 오차 ${vc.worstError}m`);
    if (vc.worstAt) console.log(`  가장 어긋난 곳: (${vc.worstAt.x}, ${vc.worstAt.z}) ` +
      `메시 ${vc.worstAt.mesh}m vs 지형 ${vc.worstAt.want}m`);

    console.log("\n" + bar);
    console.log("  소품 묶음의 정점 높이 분포");
    console.log(bar);
    for (const s of r.strays) {
      console.log(`  정점 ${String(s.verts).padStart(6)}  지면아래 ${String(s.아래정점).padStart(3)} / ` +
        `지면위 ${String(s.위정점).padStart(3)}  평균 +${s.평균높이차}m  posY=${s.posY}`);
    }
  }
  ws.close();
} catch (e) {
  console.log("탐침 실패: " + e.message);
} finally {
  chrome.kill();
  await sleep(400);
  process.exit(0);
}
