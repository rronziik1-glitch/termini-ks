// Audit screenshots of the running app at phone width, incl. logged-in owner/admin screens.
//   node fable/_audit/shots.mjs <baseUrl> <outDir> <phone|-> <width> path1 path2 ...
// Logs in through the dev API (the code is returned in dev), sets the cookie in headless Chrome,
// then saves one full-page PNG per path and prints overflow / small-touch-target problems as JSON.
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, existsSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const [, , base, outDir, phone, wArg, ...paths] = process.argv;
const width = Number(wArg || 375);
mkdirSync(outDir, { recursive: true });

let cookie = '';
if (phone && phone !== '-') {
  const post = (p, body, extra = {}) => fetch(base + p, { method: 'POST', headers: { 'content-type': 'application/json', ...extra }, body: JSON.stringify(body) });
  const r1 = await (await post('/api/auth/code', { phone })).json();
  const r2 = await post('/api/auth/verify', { phone, code: r1.dev_code });
  cookie = (r2.headers.get('set-cookie') || '').split(';')[0].split('=')[1] || '';
  if (!cookie) { console.error('login failed', r1); process.exit(1); }
}

const chromePath = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const port = 9700 + Math.floor(Math.random() * 200);
const profile = mkdtempSync(join(tmpdir(), 'audit-shot-'));
const chrome = spawn(chromePath, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--hide-scrollbars', '--no-first-run', '--disable-gpu', 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function wsUrl() {
  for (let i = 0; i < 80; i++) {
    try { const l = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); const p = l.find((t) => t.type === 'page'); if (p) return p.webSocketDebuggerUrl; } catch {}
    await sleep(150);
  }
  throw new Error('no chrome');
}
function connect(u) {
  return new Promise((res, rej) => {
    const ws = new WebSocket(u); let id = 0; const pending = new Map(); const waiters = [];
    ws.onopen = () => res({
      send: (method, params = {}) => new Promise((ok, fail) => { pending.set(++id, { ok, fail }); ws.send(JSON.stringify({ id, method, params })); }),
      once: (event) => new Promise((ok) => waiters.push({ event, ok })),
      close: () => ws.close(),
    });
    ws.onerror = rej;
    ws.onmessage = (m) => {
      const msg = JSON.parse(m.data);
      if (msg.id && pending.has(msg.id)) { const p = pending.get(msg.id); pending.delete(msg.id); msg.error ? p.fail(new Error(msg.error.message)) : p.ok(msg.result); }
      else if (msg.method) for (let i = waiters.length - 1; i >= 0; i--) if (waiters[i].event === msg.method) waiters.splice(i, 1)[0].ok(msg.params);
    };
  });
}
const evaluate = async (cdp, expression) => (await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result.value;

try {
  const cdp = await connect(await wsUrl());
  await cdp.send('Page.enable'); await cdp.send('Runtime.enable'); await cdp.send('Network.enable');
  if (cookie) await cdp.send('Network.setCookie', { name: 't_session', value: cookie, url: base });
  // Paths are given without the leading "/" (Git Bash rewrites "/x" into a Windows path); "home" = "/".
  for (const raw of paths) {
    const p = raw === 'home' ? '/' : '/' + raw.replace(/^\/+/, '');
    await cdp.send('Emulation.setDeviceMetricsOverride', { width, height: 812, deviceScaleFactor: 1, mobile: true });
    const loaded = cdp.once('Page.loadEventFired');
    await cdp.send('Page.navigate', { url: base + p });
    await loaded; await sleep(2500);
    const rep = await evaluate(cdp, `(() => {
      const vw = document.documentElement.clientWidth, out = { path: ${JSON.stringify(p)}, scrollWidth: document.documentElement.scrollWidth, vw, small: [], tinyText: 0 };
      document.querySelectorAll('a[href], button, input, select, [role=button], label.switch, .chip').forEach((el) => {
        const r = el.getBoundingClientRect(); const cs = getComputedStyle(el);
        if (r.width && r.height && cs.visibility !== 'hidden' && (r.height < 43.5 || r.width < 43.5) && el.type !== 'hidden' && el.type !== 'checkbox' && el.type !== 'radio')
          out.small.push(el.tagName.toLowerCase() + '.' + String(el.className).split(' ')[0] + ' "' + (el.innerText || el.getAttribute('aria-label') || '').trim().slice(0, 24) + '" ' + Math.round(r.width) + 'x' + Math.round(r.height));
      });
      document.querySelectorAll('body *').forEach((el) => { if (el.childNodes.length && [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()) && parseFloat(getComputedStyle(el).fontSize) < 12) out.tinyText++; });
      out.small = [...new Set(out.small)].slice(0, 15);
      out.title = document.title; out.h = document.documentElement.scrollHeight;
      return out;
    })()`);
    console.log(JSON.stringify(rep));
    const h = Math.min(rep.h || 812, 3000);
    const { data } = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: 0, y: 0, width, height: h, scale: 1 } });
    writeFileSync(join(outDir, (p.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '') || 'home') + `-${width}.png`), Buffer.from(data, 'base64'));
  }
  cdp.close();
} catch (e) { console.error('failed', e.message); }
finally { chrome.kill(); await sleep(300); try { rmSync(profile, { recursive: true, force: true }); } catch {} }
