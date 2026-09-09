// NPC에게 실제로 다가갈 수 있는지 확인한다.
//
// 도감 100%가 주민 NPC 대화로 이어져 있으므로, 한 명이라도 집이나 바위에
// 파묻히면 진엔딩이 실제로는 불가능해진다. 사람이 서른 명을 일일이 찾아다니며
// 확인하는 것보다 이쪽이 빠르고 정확하다.
//
// 판정 방법: NPC 자리가 아니라 **주변 여덟 방향**을 잰다.
// NPC마다 자기 자리에 충돌 상자가 있어서(main.js), 제자리를 재면
// 전원이 "자기 자신에게 파묻혔다"고 나온다. 대화하려면 곁에 설 수만 있으면 되므로
// 다가설 자리가 하나라도 있으면 통과다.
//
// 사용법: node tools/probe-npc.mjs [주소]

import { spawn } from "child_process";
import http from "http";
import crypto from "crypto";
import net from "net";

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const URL_ = process.argv[2] ?? "http://localhost:3100";
const PORT = 9226;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const chrome = spawn(CHROME, [
  "--headless=new", "--use-gl=swiftshader", "--enable-unsafe-swiftshader",
  "--remote-debugging-port=" + PORT,
  "--user-data-dir=" + process.env.TEMP + "\\chrome-npc",
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

const MEASURE = `(() => {
  const d = window.__debug;
  if (!d) return JSON.stringify({ error: "window.__debug 없음" });
  const col = d.world.collision, terrain = d.world.terrain;

  const npcs = [];
  d.scene.traverse((o) => {
    if (o.userData?.elementId && o.userData?.source && o.parent === d.scene) {
      npcs.push({ id: o.userData.elementId, x: o.position.x, z: o.position.z, y: o.position.y });
    }
  });

  const R = 0.30, REACH = 1.6;
  const dirs = [[1,0,"동"],[-1,0,"서"],[0,1,"남"],[0,-1,"북"],
                [0.7,0.7,"남동"],[-0.7,0.7,"남서"],[0.7,-0.7,"북동"],[-0.7,-0.7,"북서"]];
  const rows = npcs.map((n) => {
    let open = 0; const blocked = [];
    for (const [dx, dz, name] of dirs) {
      const px = n.x + dx * REACH, pz = n.z + dz * REACH;
      const r = col.resolve(px, pz, R, n.y, n.y + 1.75);
      if (Math.hypot(r.x - px, r.z - pz) < 0.05) open++; else blocked.push(name);
    }
    return {
      id: n.id, x: +n.x.toFixed(1), z: +n.z.toFixed(1), open, blocked: blocked.join(""),
      floatGap: +(n.y - terrain.heightAt(n.x, n.z)).toFixed(2),
      slope: +terrain.slopeAt(n.x, n.z).toFixed(2),
      water: +terrain.waterDepth(n.x, n.z).toFixed(2),
    };
  });
  return JSON.stringify(rows);
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
    return r.result?.result?.value;
  };

  for (let i = 0; i < 80; i++) {
    if (await ev(`document.getElementById("title-screen")?.hidden === false`)) break;
    await sleep(500);
  }
  await ev(`document.getElementById("btn-beta")?.click()`);
  await sleep(4000);

  const raw = await ev(MEASURE);
  const rows = JSON.parse(raw || "[]");
  const bar = "=".repeat(70);
  console.log(bar);
  console.log("  NPC 접근성 — 주변 8방향 중 설 수 있는 곳");
  console.log(bar);
  console.log("  캐릭터 " + rows.length + "체\n");

  const groups = [
    ["★ 다가갈 수 없음 (대화 불가)", rows.filter((r) => r.open === 0)],
    ["비좁음 (2곳 이하)", rows.filter((r) => r.open > 0 && r.open <= 2)],
    ["지면에서 뜨거나 묻힘", rows.filter((r) => Math.abs(r.floatGap) > 0.4)],
    ["급경사", rows.filter((r) => r.slope > 0.6)],
    ["물속", rows.filter((r) => r.water > 0.35)],
  ];
  let bad = 0;
  for (const [label, list] of groups) {
    if (!list.length) { console.log("  " + label + ": 없음"); continue; }
    bad += list.length;
    console.log("  " + label + " " + list.length + "건");
    for (const r of list) {
      console.log("    " + r.id.padEnd(4) + " (" + String(r.x).padStart(7) + "," +
        String(r.z).padStart(7) + ")  열린방향 " + r.open + "/8" +
        (r.blocked ? "  막힘:" + r.blocked : "") +
        "  뜸 " + r.floatGap + "m  경사 " + r.slope + "  물 " + r.water + "m");
    }
  }

  const tight = rows.filter((r) => r.open < 8).sort((a, b) => a.open - b.open).slice(0, 6);
  console.log("\n  가장 비좁은 곳");
  if (!tight.length) console.log("    모두 사방이 트여 있다");
  for (const r of tight) console.log("    " + r.id.padEnd(4) + " " + r.open + "/8  막힘:" + (r.blocked || "-"));

  console.log("\n" + bar);
  console.log(bad === 0 ? "  통과 — 모든 NPC에게 다가갈 수 있다" : "  " + bad + "건 확인 필요");
  console.log(bar);

  ws.close();
  process.exitCode = bad === 0 ? 0 : 1;
} catch (e) {
  console.log("탐침 실패: " + e.message);
} finally {
  chrome.kill();
  await sleep(400);
  process.exit(process.exitCode ?? 0);
}
