import test from 'node:test';
import assert from 'node:assert/strict';
import { watchFileDialogClose } from '../js/app/download.js';

function fixture() {
  const handlers = new Map();
  const win = { addEventListener: (n, f) => handlers.set(n, f), removeEventListener: (n, f) => { if (handlers.get(n) === f) handlers.delete(n); } };
  const timers = []; 
  const api = { set: (fn, ms) => { timers.push({ fn, ms }); return timers.length; }, clear: id => { timers[id - 1] = null; } };
  return { handlers, win, timers, api };
}

test('watchFileDialogClose (#11): Fokus ohne gewählte Datei meldet den Abbruch nach der Frist', () => {
  const { handlers, win, timers, api } = fixture();
  let n = 0;
  watchFileDialogClose({ files: [] }, () => n++, { win, timers: api, delayMs: 500 });
  handlers.get('focus')();
  assert.equal(n, 0);
  assert.equal(timers[0].ms, 500);
  timers[0].fn();
  assert.equal(n, 1);
  assert.equal(handlers.has('focus'), false, 'Beobachter baut sich nach dem Abbruch ab');
});

test('watchFileDialogClose (#11): ist bis zur Frist eine Datei gewählt, passiert nichts', () => {
  const { handlers, win, timers, api } = fixture();
  const input = { files: [] };
  let n = 0;
  watchFileDialogClose(input, () => n++, { win, timers: api });
  handlers.get('focus')();
  input.files = [{ name: 'x.json' }];
  timers[0].fn();
  assert.equal(n, 0);
});

test('watchFileDialogClose (#11): stop() baut Listener und wartenden Timer ab; mehrfacher Fokus setzt nur einen Timer', () => {
  const { handlers, win, timers, api } = fixture();
  let n = 0;
  const stop = watchFileDialogClose({ files: [] }, () => n++, { win, timers: api });
  handlers.get('focus')(); handlers.get('focus')();
  assert.equal(timers.length, 1);
  stop();
  assert.equal(handlers.has('focus'), false);
  assert.equal(timers[0], null);
  assert.equal(n, 0);
});
