// Screenshot helper (headless Chrome over the DevTools protocol, no npm packages).
// Renders a page at a phone or desktop width, then lays the full page out as columns on one sheet,
// so a whole one-page site can be reviewed in a single image.
//   node fable/templates/tools/shot.mjs <page.html[?query]> <out.png> [width=375] [viewportHeight=812] [columnHeight=1500]
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const [, , pageArg, outArg, wArg, hArg, colArg] = process.argv;
if (!pageArg || !outArg) { console.error('usage: shot.mjs <page.html> <out.png> [width] [height] [columnHeight]'); process.exit(2); }
const width = Number(wArg || 375), height = Number(hArg || 812), colH = Number(colArg || 1500);
const [file, query = ''] = pageArg.split('?');
const url = /^https?:/.test(pageArg) ? pageArg : pathToFileURL(resolve(file)).href + (query ? '?' + query : '');

const candidates = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome', '/usr/bin/chromium'
].filter(Boolean);
const chromePath = candidates.find((p) => existsSync(p));
if (!chromePath) { console.error('Chrome not found; set CHROME_PATH'); process.exit(2); }

const port = 9300 + Math.floor(Math.random() * 400);
const profile = mkdtempSync(join(tmpdir(), 'fg-shot-'));
const chrome = spawn(chromePath, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
  '--hide-scrollbars', '--no-first-run', '--disable-gpu', '--allow-file-access-from-files', 'about:blank'], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function target() {
  for (let i = 0; i < 80; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
      const page = list.find((t) => t.type === 'page');
      if (page) return page.webSocketDebuggerUrl;
    } catch { /* not up yet */ }
    await sleep(150);
  }
  throw new Error('Chrome did not start');
}

function connect(wsUrl) {
  return new Promise((res, rej) => {
    const ws = new WebSocket(wsUrl);
    let id = 0; const pending = new Map(); const waiters = [];
    ws.onopen = () => res({
      send(method, params = {}) {
        return new Promise((ok, fail) => { pending.set(++id, { ok, fail }); ws.send(JSON.stringify({ id, method, params })); });
      },
      once(event) { return new Promise((ok) => waiters.push({ event, ok })); },
      close() { ws.close(); }
    });
    ws.onerror = rej;
    ws.onmessage = (m) => {
      const msg = JSON.parse(m.data);
      if (msg.id && pending.has(msg.id)) {
        const p = pending.get(msg.id); pending.delete(msg.id);
        msg.error ? p.fail(new Error(msg.error.message)) : p.ok(msg.result);
      } else if (msg.method) {
        for (let i = waiters.length - 1; i >= 0; i--) if (waiters[i].event === msg.method) waiters.splice(i, 1)[0].ok(msg.params);
      }
    };
  });
}

async function evaluate(cdp, expression) {
  const r = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + ' ' + (r.exceptionDetails.exception?.description || ''));
  return r.result.value;
}

let code = 0;
try {
  const cdp = await connect(await target());
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 700 });
  const loaded = cdp.once('Page.loadEventFired');
  await cdp.send('Page.navigate', { url });
  await loaded;
  await evaluate(cdp, 'document.fonts ? document.fonts.ready.then(() => true) : true');
  await sleep(700);

  // report problems that a picture would not show
  const report = await evaluate(cdp, `(() => {
    const out = { overflow: [], unfilled: 0, small: [] };
    const vw = document.documentElement.clientWidth;
    document.querySelectorAll('body *').forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.width && (r.right > vw + 1 || r.left < -1)) {
        let p = el, clipped = false;
        while ((p = p.parentElement)) { const o = getComputedStyle(p).overflowX; if (o !== 'visible') { clipped = true; break; } }
        if (!clipped && getComputedStyle(el).position !== 'fixed') out.overflow.push(el.tagName.toLowerCase() + '.' + String(el.className).split(' ')[0] + ' ' + Math.round(r.left) + '→' + Math.round(r.right));
      }
    });
    out.overflow = out.overflow.slice(0, 8);
    if (document.documentElement.scrollWidth > vw) {   // name every element past the edge, clipped or not
      out.wide = [...document.querySelectorAll('body *')].filter((el) => { const r = el.getBoundingClientRect(); return (r.width || r.height) && r.right > vw + 1; })
        .map((el) => el.tagName.toLowerCase() + '.' + String(el.className.baseVal ?? el.className).split(' ')[0] + ' ' + Math.round(el.getBoundingClientRect().left) + '→' + Math.round(el.getBoundingClientRect().right)).slice(0, 10);
    }
    out.unfilled = document.querySelectorAll('[data-t],[data-attr],[data-img],template[data-each]').length;
    document.querySelectorAll('a[href], button').forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.width && r.height && (r.height < 43.5 || r.width < 43.5)) out.small.push(el.tagName.toLowerCase() + '.' + String(el.className).split(' ')[0] + ' ' + Math.round(r.width) + 'x' + Math.round(r.height));
    });
    out.small = [...new Set(out.small)].slice(0, 12);
    out.scrollWidth = document.documentElement.scrollWidth; out.vw = vw;
    out.height = Math.ceil(document.documentElement.scrollHeight);
    return out;
  })()`);
  console.log(JSON.stringify(report));

  // show everything that animates in, and the action bar, as a visitor would have seen them
  await evaluate(cdp, `(() => {
    const s = document.createElement('style');
    s.textContent = '*,*::before,*::after{transition:none!important;animation:none!important}.fg-bar{display:none!important}';
    document.head.appendChild(s);
    document.querySelectorAll('[data-reveal]').forEach((el) => el.classList.add('is-in'));
    document.querySelectorAll('[data-parallax]').forEach((el) => { el.style.transform = 'none'; });
    return true;
  })()`);
  await sleep(250);

  const total = report.height;
  const shots = [];
  for (let y = 0; y < total; y += colH) {
    const h = Math.min(colH, total - y);
    const { data } = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: 0, y, width, height: h, scale: 1 } });
    shots.push(data);
  }

  // contact sheet
  const perSheet = Math.max(1, Math.floor(1600 / (width + 12)));
  const sheets = [];
  for (let i = 0; i < shots.length; i += perSheet) sheets.push(shots.slice(i, i + perSheet));
  for (let s = 0; s < sheets.length; s++) {
    const html = '<body style="margin:0;background:#888;display:flex;gap:12px;align-items:flex-start">' +
      sheets[s].map((d) => `<img src="data:image/png;base64,${d}" style="display:block">`).join('') + '</body>';
    const sheetW = sheets[s].length * (width + 12) - 12;
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: sheetW, height: colH, deviceScaleFactor: 1, mobile: false });
    const l2 = cdp.once('Page.loadEventFired');
    const tmp = join(profile, `sheet-${s}.html`);
    writeFileSync(tmp, html);
    await cdp.send('Page.navigate', { url: pathToFileURL(tmp).href });
    await l2; await sleep(200);
    const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' });
    const out = sheets.length === 1 ? outArg : outArg.replace(/\.png$/, `-${s + 1}.png`);
    writeFileSync(out, Buffer.from(data, 'base64'));
    console.log('saved ' + out);
  }
  cdp.close();
} catch (e) {
  console.error('shot failed: ' + e.message); code = 1;
} finally {
  chrome.kill();
  await sleep(300);
  try { rmSync(profile, { recursive: true, force: true }); } catch { /* Chrome may still hold the folder */ }
}
process.exit(code);
