// 헤드리스 크롬을 띄워 콘솔 오류와 화면 상태를 받아온다.
// 브라우저를 눈으로 볼 수 없으니, 이것이 실제 실행을 확인하는 유일한 방법이다.
// DevTools 프로토콜을 WebSocket 없이 쓰기 위해 HTTP 엔드포인트 + ws를 직접 다룬다.

import { spawn } from "child_process";
import http from "http";
import crypto from "crypto";
import net from "net";

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const URL_ = process.argv[2] ?? "http://localhost:3100";
const WAIT = Number(process.argv[3] ?? 25000);
const PORT = 9223;

const chrome = spawn(CHROME, [
  "--headless=new",
  "--disable-gpu-sandbox",
  "--use-gl=swiftshader",
  "--enable-unsafe-swiftshader",
  "--remote-debugging-port=" + PORT,
  "--user-data-dir=" + process.env.TEMP + "\\chrome-probe",
  "--no-first-run",
  "--window-size=1280,800",
  URL_,
], { stdio: "ignore" });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJSON(path) {
  return new Promise((resolve, reject) => {
    http.get({ host: "127.0.0.1", port: PORT, path }, (res) => {
      let b = ""; res.on("data", (c) => (b += c));
      res.on("end", () => { try { resolve(JSON.parse(b)); } catch (e) { reject(e); } });
    }).on("error", reject);
  });
}

// --- 아주 작은 WebSocket 클라이언트 (CDP용) ---
function connectWS(wsUrl) {
  const u = new global.URL(wsUrl);
  return new Promise((resolve, reject) => {
    const key = crypto.randomBytes(16).toString("base64");
    const sock = net.connect(Number(u.port), u.hostname, () => {
      sock.write(
        `GET ${u.pathname}${u.search} HTTP/1.1\r\n` +
        `Host: ${u.host}\r\n` +
        `Upgrade: websocket\r\nConnection: Upgrade\r\n` +
        `Sec-WebSocket-Key: ${key}\r\nSec-WebSocket-Version: 13\r\n\r\n`);
    });
    let buf = Buffer.alloc(0);
    let open = false;
    const handlers = [];

    sock.on("data", (chunk) => {
      buf = Buffer.concat([buf, chunk]);
      if (!open) {
        const i = buf.indexOf("\r\n\r\n");
        if (i < 0) return;
        if (!buf.slice(0, i).toString().includes("101")) return reject(new Error("핸드셰이크 실패"));
        buf = buf.slice(i + 4);
        open = true;
        resolve(api);
      }
      // 프레임 파싱 (마스크 없음, 서버→클라이언트)
      while (buf.length >= 2) {
        const op = buf[0] & 0x0f;
        let len = buf[1] & 0x7f;
        let off = 2;
        if (len === 126) { len = buf.readUInt16BE(2); off = 4; }
        else if (len === 127) { len = Number(buf.readBigUInt64BE(2)); off = 10; }
        if (buf.length < off + len) return;
        const payload = buf.slice(off, off + len);
        buf = buf.slice(off + len);
        if (op === 1) { const msg = JSON.parse(payload.toString()); handlers.forEach((h) => h(msg)); }
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
          : Buffer.concat([Buffer.from([0x81, 0xfe]), (() => { const b = Buffer.alloc(2); b.writeUInt16BE(data.length); return b; })()]);
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
  // 크롬이 뜰 때까지 기다린다
  let targets = null;
  for (let i = 0; i < 40; i++) {
    try { targets = await getJSON("/json/list"); if (targets.length) break; } catch {}
    await sleep(300);
  }
  if (!targets?.length) throw new Error("크롬 디버거에 붙지 못했다");

  const page = targets.find((t) => t.type === "page" && t.url.includes("localhost")) ?? targets[0];
  const ws = await connectWS(page.webSocketDebuggerUrl);

  const logs = [];
  ws.on((m) => {
    if (m.method === "Runtime.consoleAPICalled") {
      const text = (m.params.args ?? []).map((a) => a.value ?? a.description ?? a.type).join(" ");
      logs.push("[" + m.params.type + "] " + text);
    }
    if (m.method === "Runtime.exceptionThrown") {
      const d = m.params.exceptionDetails;
      logs.push("[예외] " + (d.exception?.description ?? d.text) +
        (d.url ? "\n        at " + d.url.replace(/^https?:\/\/[^/]+/, "") + ":" + (d.lineNumber + 1) : ""));
    }
    if (m.method === "Log.entryAdded" && m.params.entry.level === "error") {
      logs.push("[네트워크] " + m.params.entry.text + " " + (m.params.entry.url ?? ""));
    }
  });

  await ws.send("Runtime.enable");
  await ws.send("Log.enable");
  await ws.send("Page.enable");
  await ws.send("Page.reload", { ignoreCache: true });

  await sleep(WAIT);

  const evalJS = async (expr) => {
    const r = await ws.send("Runtime.evaluate", { expression: expr, returnByValue: true });
    return r.result?.result?.value;
  };

  const state = await evalJS(`JSON.stringify({
    loading: document.getElementById("loading-screen")?.hidden === false,
    loadingText: document.getElementById("loading-text")?.textContent,
    loadingPct: document.getElementById("loading-bar-fill")?.style.width,
    title: document.getElementById("title-screen")?.hidden === false,
    hud: document.getElementById("hud")?.hidden === false,
    error: document.getElementById("error-box")?.hidden === false
      ? document.getElementById("error-text")?.textContent : null,
  })`);

  console.log("=".repeat(64));
  console.log("  화면 상태");
  console.log("=".repeat(64));
  const s = JSON.parse(state || "{}");
  console.log("  로딩 화면 표시 :", s.loading);
  console.log("  로딩 문구      :", s.loadingText, "(" + s.loadingPct + ")");
  console.log("  타이틀 표시    :", s.title);
  console.log("  HUD 표시       :", s.hud);
  if (s.error) console.log("\n  화면의 오류 상자:\n" + s.error.split("\n").map((l) => "    " + l).join("\n"));

  console.log("\n" + "=".repeat(64));
  console.log("  콘솔 (" + logs.length + "건)");
  console.log("=".repeat(64));
  if (!logs.length) console.log("  (없음)");
  for (const l of logs.slice(0, 30)) console.log("  " + l);

  ws.close();
} catch (e) {
  console.log("탐침 실패: " + e.message);
} finally {
  chrome.kill();
  await sleep(400);
  process.exit(0);
}
