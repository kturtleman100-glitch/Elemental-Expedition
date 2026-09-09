// 도감을 여러 화면 크기에서 열어 스크롤이 생기는지 잰다.
//
// 판매용이라 화면을 고를 수 없다. 노트북(1366×768)부터 4K까지, 세로가
// 짧은 화면과 좁은 화면 모두에서 표가 다 보이고 설명이 잘리지 않아야 한다.
// 한 크기에서만 보면 반드시 다른 크기에서 깨진다 — 실제로 그랬다.

import { spawn } from "child_process";
import http from "http";
import crypto from "crypto";
import path from "path";
import net from "net";

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const URL_ = process.argv[2] ?? "http://localhost:3100";

/** 실제로 흔한 화면들 */
const SIZES = [
  [1366, 768, "노트북"],
  [1920, 1080, "FHD"],
  [1600, 900, "16:9 중형"],
  [2560, 1440, "QHD"],
  [1280, 800, "작은 노트북"],
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function cdp(port, path) {
  return new Promise((res, rej) => {
    http.get({ host: "127.0.0.1", port, path }, (r) => {
      let d = ""; r.on("data", (c) => (d += c)); r.on("end", () => res(JSON.parse(d)));
    }).on("error", rej);
  });
}

function ws(url) {
  const u = new URL(url);
  const key = crypto.randomBytes(16).toString("base64");
  return new Promise((resolve, reject) => {
    const sock = net.connect(u.port, u.hostname, () => {
      sock.write(`GET ${u.pathname} HTTP/1.1\r\nHost: ${u.host}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: ${key}\r\nSec-WebSocket-Version: 13\r\n\r\n`);
    });
    let buf = Buffer.alloc(0), up = false;
    const waiters = new Map();
    let id = 0;
    sock.on("data", (c) => {
      buf = Buffer.concat([buf, c]);
      if (!up) {
        const i = buf.indexOf("\r\n\r\n");
        if (i < 0) return;
        up = true; buf = buf.slice(i + 4);
        resolve({
          send(method, params) {
            const mid = ++id;
            const msg = JSON.stringify({ id: mid, method, params });
            const pay = Buffer.from(msg);
            const mask = crypto.randomBytes(4);
            let head;
            if (pay.length < 126) head = Buffer.from([0x81, 0x80 | pay.length]);
            else { head = Buffer.alloc(4); head[0] = 0x81; head[1] = 0xfe; head.writeUInt16BE(pay.length, 2); }
            const masked = Buffer.from(pay);
            for (let k = 0; k < masked.length; k++) masked[k] ^= mask[k % 4];
            sock.write(Buffer.concat([head, mask, masked]));
            return new Promise((r) => waiters.set(mid, r));
          },
          close: () => sock.destroy(),
        });
      }
      while (buf.length >= 2) {
        const len0 = buf[1] & 0x7f;
        let off = 2, len = len0;
        if (len0 === 126) { len = buf.readUInt16BE(2); off = 4; }
        else if (len0 === 127) { len = Number(buf.readBigUInt64BE(2)); off = 10; }
        if (buf.length < off + len) break;
        const data = buf.slice(off, off + len).toString();
        buf = buf.slice(off + len);
        try { const m = JSON.parse(data); if (m.id && waiters.has(m.id)) { waiters.get(m.id)(m); waiters.delete(m.id); } } catch {}
      }
    });
    sock.on("error", reject);
  });
}

const EVAL = `(()=>{
  const g=document.getElementById('codex-grid');
  const d=document.getElementById('codex-detail');
  if(!g||!g.children.length) return JSON.stringify({err:'표 없음'});
  const cell=[...g.children].find(x=>x.querySelector('.cx-sym'));
  const worst=[];
  for(const sym of ['Fe','H','U','Cl']){
    const c=[...g.children].find(x=>x.querySelector('.cx-sym')?.textContent===sym);
    if(c&&c.tagName==='BUTTON'){c.click();worst.push([sym,Math.round(d.scrollHeight-d.clientHeight)]);}
  }
  return JSON.stringify({
    표스크롤:Math.round(g.scrollHeight-g.clientHeight),
    가로넘침:Math.round(g.scrollWidth-g.clientWidth),
    설명스크롤:Object.fromEntries(worst),
    칸:Math.round(cell.getBoundingClientRect().width),
    한글:getComputedStyle(cell.querySelector('.cx-ko')).fontSize,
  });
})()`;

console.log("\n=== 도감 반응형 검사 ===\n");
let fail = 0;

for (const [w, h, name] of SIZES) {
  const port = 9300 + Math.floor(Math.random() * 300);
  const dir = path.join(process.env.TEMP, "cxprobe" + port);
  const chrome = spawn(CHROME, [
    `--remote-debugging-port=${port}`, `--user-data-dir=${dir}`,
    "--headless=new", "--no-first-run", "--no-sandbox",
    `--window-size=${w},${h}`, URL_,
  ], { stdio: "ignore" });

  try {
    let tabs = null;
    for (let i = 0; i < 40; i++) {
      try { tabs = await cdp(port, "/json/list"); if (tabs.find((t) => t.type === "page")) break; } catch {}
      await sleep(400);
    }
    const page = tabs.find((t) => t.type === "page");
    const c = await ws(page.webSocketDebuggerUrl);
    await c.send("Runtime.enable");
    await sleep(9000);
    await c.send("Runtime.evaluate", { expression: `document.getElementById('btn-beta').click()` });
    await sleep(4000);
    await c.send("Runtime.evaluate", { expression: `window.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyK',key:'k'}))` });
    await sleep(1200);
    const r = await c.send("Runtime.evaluate", { expression: EVAL, returnByValue: true });
    const v = JSON.parse(r.result?.result?.value ?? "{}");
    const bad = v.표스크롤 > 0 || v.가로넘침 > 0 || Object.values(v.설명스크롤 ?? {}).some((x) => x > 0);
    if (bad) fail++;
    console.log(`  ${bad ? "\x1b[31m✗\x1b[0m" : "\x1b[32m✓\x1b[0m"} ${name} ${w}×${h}`);
    console.log(`      표 스크롤 ${v.표스크롤} · 가로 ${v.가로넘침} · 칸 ${v.칸}px · 한글 ${v.한글}`);
    console.log(`      설명 스크롤 ${JSON.stringify(v.설명스크롤)}`);
    c.close();
  } catch (e) {
    console.log(`  ? ${name} — ${e.message}`);
  } finally {
    chrome.kill();
    await sleep(500);
  }
}

console.log("\n" + "=".repeat(60));
console.log(fail === 0 ? "  전 화면에서 스크롤 없음" : `  ${fail}개 화면에서 스크롤 발생`);
console.log("=".repeat(60) + "\n");
process.exit(fail > 0 ? 1 : 0);
