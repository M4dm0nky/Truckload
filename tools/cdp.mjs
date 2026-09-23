// Minimaler CDP-Treiber für Browser-Szenarien (siehe CLAUDE.md, „Prüfen“ → „Im Browser“).
// Steuert lokales Chrome headless per Chrome-DevTools-Protokoll, ohne npm-Abhängigkeit – reines
// Node (WebSocket ist ab Node 22 global verfügbar). Stand bis Task 8 nur als Ad-hoc-Skript im
// Scratchpad einzelner Sitzungen, jede Sitzung mit CDP-Bedarf musste ihn neu schreiben, weil das
// Scratchpad-Verzeichnis sitzungsgebunden und nicht Teil des Repos ist
// (docs/code-review-2026-09-21.md, „18. cdp.mjs fehlt im Scratchpad“). Jetzt fester Teil des
// Repos, keine Anwendungslaufzeit-Abhängigkeit (läuft nie im Browser der App).
//
// Aufruf: node tools/cdp.mjs ./mein-szenario.mjs ./ausgabe
// Ein Szenario ist ein ES-Modul mit `export default async function (p)`; `p` bietet goto, eval,
// shot, mouse, key, sleep und logs (Details: CLAUDE.md).
import { spawn } from 'node:child_process';
import fs from 'node:fs';

const CHROME = process.env.TL_CHROME_BIN ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9333;
const scenario = process.argv[2];
const outDir = process.argv[3] ?? '.';
if (!scenario) {
  console.error('Aufruf: node tools/cdp.mjs ./mein-szenario.mjs [./ausgabe]');
  process.exit(1);
}
fs.mkdirSync(outDir, { recursive: true });

const userDir = fs.mkdtempSync('/tmp/tlcdp-');
const chrome = spawn(CHROME, [
  '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${userDir}`,
  '--no-first-run', '--no-default-browser-check', '--window-size=1600,1000',
  '--use-gl=swiftshader', '--enable-unsafe-swiftshader', 'about:blank',
], { stdio: 'ignore' });

const sleep = ms => new Promise(r => setTimeout(r, ms));

let wsUrl = null;
for (let i = 0; i < 60 && !wsUrl; i++) {
  await sleep(250);
  try {
    const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
    wsUrl = list.find(t => t.type === 'page')?.webSocketDebuggerUrl ?? null;
  } catch { /* noch nicht da */ }
}
if (!wsUrl) { chrome.kill(); throw new Error(`Chrome/CDP nicht erreichbar (Pfad geprüft: ${CHROME}; TL_CHROME_BIN überschreibt ihn).`); }

const ws = new WebSocket(wsUrl);
await new Promise(r => ws.addEventListener('open', r, { once: true }));
let id = 0;
const pending = new Map();
const logs = [];
ws.addEventListener('message', ev => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) {
    const { res, rej } = pending.get(m.id);
    pending.delete(m.id);
    m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result);
  } else if (m.method === 'Runtime.consoleAPICalled') {
    logs.push(`${m.params.type}: ${m.params.args.map(a => a.value ?? a.description).join(' ')}`);
  } else if (m.method === 'Log.entryAdded') {
    logs.push(`${m.params.entry.level}: ${m.params.entry.text}`);
  } else if (m.method === 'Runtime.exceptionThrown') {
    logs.push(`exception: ${m.params.exceptionDetails.text} ${m.params.exceptionDetails.exception?.description ?? ''}`);
  }
});
const send = (method, params = {}) => new Promise((res, rej) => {
  const n = ++id;
  pending.set(n, { res, rej });
  ws.send(JSON.stringify({ id: n, method, params }));
});

await send('Page.enable'); await send('Runtime.enable'); await send('Log.enable');

const p = {
  send,
  logs,
  async goto(url) {
    await send('Page.navigate', { url });
    await sleep(1500);
  },
  async eval(fn, ...args) {
    const expr = `(async () => { return (${fn}).apply(null, ${JSON.stringify(args)}); })()`;
    const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
    return r.result.value;
  },
  async shot(name) {
    const r = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(`${outDir}/${name}.png`, Buffer.from(r.data, 'base64'));
  },
  async mouse(type, x, y) {
    await send('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: 1, buttons: type === 'mousePressed' ? 1 : 0 });
  },
  async wheel(x, y, deltaX, deltaY) {
    await send('Input.dispatchMouseEvent', { type: 'mouseWheel', x, y, deltaX, deltaY });
  },
  async key(text) {
    for (const ch of text) {
      await send('Input.dispatchKeyEvent', { type: 'keyDown', text: ch });
      await send('Input.dispatchKeyEvent', { type: 'keyUp' });
    }
  },
  sleep,
};

try {
  const mod = await import(scenario.startsWith('/') ? scenario : `${process.cwd()}/${scenario}`);
  await mod.default(p);
} finally {
  ws.close();
  chrome.kill();
  try { fs.rmSync(userDir, { recursive: true, force: true }); } catch { /* egal */ }
}
