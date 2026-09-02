// 게임을 실제로 시작해 걸어 보고, 청크가 이어지는지 확인한다.
//
// 지형 코드는 눈으로 봐야 맞는지 알 수 있는데 브라우저를 볼 수 없다.
// 그래서 좌하단 디버그 표시(청크 수·바이옴·고도)를 대신 읽는다.
// 키 입력은 진짜 keydown 이벤트로 넣어 실제 조작 경로를 그대로 지난다.
//
// 사용법: node tools/probe-walk.mjs [주소] [걷는 초]

import { spawn } from "child_process";
import http from "http";
import crypto from "crypto";
import net from "net";

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const URL_ = process.argv[2] ?? "http://localhost:3100";
const WALK_SEC = Number(process.argv[3] ?? 12);
const PORT = 9224;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const chrome = spawn(CHROME, [
  "--headless=new", "--use-gl=swiftshader", "--enable-unsafe-swiftshader",
  "--remote-debugging-port=" + PORT,
  "--user-data-dir=" + process.env.TEMP + "\\chrome-walk",
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

try {
  let targets = null;
  for (let i = 0; i < 50; i++) {
    try { targets = await getJSON("/json/list"); if (targets.length) break; } catch {}
    await sleep(300);
  }
  const page = targets.find((t) => t.type === "page" && t.url.includes("localhost")) ?? targets[0];
  const ws = await connectWS(page.webSocketDebuggerUrl);

  const errs = [];
  ws.on((m) => {
    if (m.method === "Runtime.exceptionThrown") {
      const d = m.params.exceptionDetails;
      errs.push((d.exception?.description ?? d.text).split("\n")[0]);
    }
    if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") {
      errs.push((m.params.args ?? []).map((a) => a.value ?? a.description).join(" "));
    }
  });
  await ws.send("Runtime.enable");
  await ws.send("Page.enable");

  const ev = async (expr) => {
    const r = await ws.send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.result?.exceptionDetails) return "EVAL오류: " + r.result.exceptionDetails.text;
    return r.result?.result?.value;
  };

  // 타이틀이 뜰 때까지 기다린다
  for (let i = 0; i < 60; i++) {
    if (await ev(`document.getElementById("title-screen")?.hidden === false`)) break;
    await sleep(500);
  }

  console.log("=".repeat(66));
  console.log("  베타로 시작해 걸어 본다");
  console.log("=".repeat(66));

  await ev(`document.getElementById("btn-beta").click()`);
  await sleep(2500);

  const readDebug = () => ev(`document.getElementById("debug-overlay")?.textContent || ""`);

  const parse = (txt) => {
    const chunk = /청크 (\d+) \(대기 (\d+)\)\s+(\S+)\s+고도 (-?[\d.]+)m/.exec(txt);
    const fps = /FPS (\d+)/.exec(txt);
    const draw = /드로우콜 (\d+)/.exec(txt);
    return {
      fps: fps ? +fps[1] : null,
      draws: draw ? +draw[1] : null,
      chunks: chunk ? +chunk[1] : null,
      queued: chunk ? +chunk[2] : null,
      biome: chunk ? chunk[3] : null,
      height: chunk ? +chunk[4] : null,
    };
  };

  const start = parse(await readDebug());
  console.log(`  시작    청크 ${start.chunks}  ${start.biome}  고도 ${start.height}m  ` +
              `드로우콜 ${start.draws}  FPS ${start.fps}`);

  // 앞으로 계속 걷는다. 진짜 keydown을 넣어 Input을 그대로 지난다.
  await ev(`window.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyW", bubbles: true }))`);

  const seen = new Set([start.biome]);
  let minFps = 999, maxQueue = 0;
  for (let t = 0; t < WALK_SEC; t++) {
    await sleep(1000);
    const d = parse(await readDebug());
    if (d.biome) seen.add(d.biome);
    if (d.fps) minFps = Math.min(minFps, d.fps);
    if (d.queued != null) maxQueue = Math.max(maxQueue, d.queued);
    if (t % 3 === 2) {
      console.log(`  ${String(t + 1).padStart(2)}초   청크 ${d.chunks}  ${d.biome}  ` +
                  `고도 ${d.height}m  드로우콜 ${d.draws}  FPS ${d.fps}`);
    }
  }
  await ev(`window.dispatchEvent(new KeyboardEvent("keyup", { code: "KeyW", bubbles: true }))`);

  const end = parse(await readDebug());
  console.log("\n" + "=".repeat(66));
  console.log(`  본 바이옴 : ${[...seen].filter(Boolean).join(" → ")}`);
  console.log(`  최저 FPS  : ${minFps === 999 ? "?" : minFps}`);
  console.log(`  최대 대기 : ${maxQueue} 청크`);
  console.log(`  최종 청크 : ${end.chunks}개 · 드로우콜 ${end.draws}`);
  console.log("=".repeat(66));

  if (errs.length) {
    console.log("\n  오류 " + errs.length + "건");
    for (const e of [...new Set(errs)].slice(0, 8)) console.log("    " + e);
  } else {
    console.log("\n  오류 없음");
  }

  ws.close();
} catch (e) {
  console.log("탐침 실패: " + e.message);
} finally {
  chrome.kill();
  await sleep(400);
  process.exit(0);
}
