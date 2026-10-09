import test from 'node:test';
import assert from 'node:assert/strict';
import { keyFor, stepFor, attachKeyboard } from '../js/app/keyboard.js';

const ev = (key, extra = {}) => ({ key, target: { closest: () => null }, ...extra });

test('keyFor: Buchstabentasten ohne Modifikator', () => {
  assert.equal(keyFor(ev('r')), 'rotate');
  assert.equal(keyFor(ev('t')), 'tip');
  assert.equal(keyFor(ev('w')), 'wheel-face');
  assert.equal(keyFor(ev('d')), 'dup');
});
test('keyFor: Großbuchstaben (⇧ oder Feststelltaste) zählen wie klein', () => {
  assert.equal(keyFor(ev('R', { shiftKey: true })), 'rotate');
  assert.equal(keyFor(ev('D')), 'dup');
});
test('keyFor: Entf und Backspace löschen', () => {
  assert.equal(keyFor(ev('Delete')), 'delete');
  assert.equal(keyFor(ev('Backspace')), 'delete');
});
test('keyFor: Buchstaben mit ⌘/Strg sind keine Aktion (Browser-Kürzel bleiben)', () => {
  for (const k of ['r', 't', 'w', 'd']) {
    assert.equal(keyFor(ev(k, { metaKey: true })), null);
    assert.equal(keyFor(ev(k, { ctrlKey: true })), null);
  }
  assert.equal(keyFor(ev('Delete', { metaKey: true })), null);
  assert.equal(keyFor(ev('Backspace', { ctrlKey: true })), null);
});
test('keyFor: Pfeile, mit und ohne ⇧', () => {
  assert.equal(keyFor(ev('ArrowLeft')), 'move-left');
  assert.equal(keyFor(ev('ArrowRight')), 'move-right');
  assert.equal(keyFor(ev('ArrowUp')), 'move-up');
  assert.equal(keyFor(ev('ArrowDown')), 'move-down');
  assert.equal(keyFor(ev('ArrowLeft', { shiftKey: true })), 'move-left');
});
test('keyFor: Pfeile gelten auch mit ⌘/Strg (wie bisher)', () => {
  assert.equal(keyFor(ev('ArrowUp', { metaKey: true })), 'move-up');
});
test('stepFor: 5 cm, mit ⇧ 1 cm', () => {
  assert.equal(stepFor(ev('ArrowLeft')), 5);
  assert.equal(stepFor(ev('ArrowLeft', { shiftKey: true })), 1);
});
test('keyFor: ⌘Z / Strg+Z macht rückgängig, mit ⇧ wiederholt, auch bei großem Z', () => {
  assert.equal(keyFor(ev('z', { metaKey: true })), 'undo');
  assert.equal(keyFor(ev('z', { ctrlKey: true })), 'undo');
  assert.equal(keyFor(ev('z', { metaKey: true, shiftKey: true })), 'redo');
  assert.equal(keyFor(ev('Z', { metaKey: true, shiftKey: true })), 'redo');
  assert.equal(keyFor(ev('Z', { ctrlKey: true })), 'undo');
});
test('keyFor: z ohne ⌘/Strg ist nichts', () => {
  assert.equal(keyFor(ev('z')), null);
});
test('keyFor: Escape hebt die Auswahl auf, auch mit Modifikator', () => {
  assert.equal(keyFor(ev('Escape')), 'deselect');
  assert.equal(keyFor(ev('Escape', { metaKey: true })), 'deselect');
});
test('keyFor: unbekannte Tasten', () => {
  for (const k of ['a', 'Enter', 'Tab', ' ', 'F5', 'Shift', 'x']) assert.equal(keyFor(ev(k)), null);
});
test('keyFor: Eingabefeld, Textfeld, Auswahlliste oder offener Dialog -> null', () => {
  const inField = { closest: sel => (sel === 'input, textarea, select' ? {} : null) };
  assert.equal(keyFor(ev('r', { target: inField })), null);
  assert.equal(keyFor(ev('Delete', { target: inField })), null);
  assert.equal(keyFor(ev('z', { metaKey: true, target: inField })), null);
  assert.equal(keyFor(ev('Escape', { target: inField })), null);
  assert.equal(keyFor(ev('r'), { dialogOpen: true }), null);
});
test('keyFor: Ziel document (ohne closest) wirft nicht', () => {
  assert.equal(keyFor(ev('r', { target: {} })), 'rotate');
  assert.equal(keyFor(ev('r', { target: null })), 'rotate');
  assert.equal(keyFor(ev('r', { target: undefined })), 'rotate');
});

// --- attachKeyboard ---
function setup({ screen = 'plan', selectedId = 'a' } = {}) {
  let handler;
  const doc = {
    addEventListener: (t, fn) => { if (t === 'keydown') handler = fn; },
    querySelector: () => null,
  };
  const calls = [];
  const actions = new Proxy({}, { get: (_, name) => (...a) => calls.push([name, ...a]) });
  const state = { selectedId };
  attachKeyboard({ getState: () => state, screenOf: () => screen, actions, doc });
  const press = (key, extra = {}) => {
    let prevented = 0;
    handler({ key, target: { closest: () => null }, preventDefault: () => prevented++, ...extra });
    return prevented;
  };
  return { press, calls, state };
}
test('attachKeyboard: Aktion mit Auswahl wird mit der id gerufen und verhindert den Standard', () => {
  const { press, calls } = setup();
  assert.equal(press('r'), 1);
  assert.deepEqual(calls, [['rotate', 'a']]);
});
test('attachKeyboard: Aktionstaste ohne Auswahl verhindert den Standard, ruft aber nichts', () => {
  const { press, calls } = setup({ selectedId: null });
  assert.equal(press('Delete'), 1);
  assert.deepEqual(calls, []);
});
test('attachKeyboard: Rückgängig/Wiederholen brauchen keine Auswahl', () => {
  const { press, calls } = setup({ selectedId: null });
  assert.equal(press('z', { metaKey: true }), 1);
  assert.equal(press('z', { metaKey: true, shiftKey: true }), 1);
  assert.deepEqual(calls, [['undo'], ['redo']]);
});
test('attachKeyboard: Escape ohne preventDefault', () => {
  const { press, calls } = setup();
  assert.equal(press('Escape'), 0);
  assert.deepEqual(calls, [['deselect']]);
});
test('attachKeyboard: Pfeile mit Auswahl: Schritt 5, mit ⇧ 1, Richtung je Taste', () => {
  const { press, calls } = setup();
  assert.equal(press('ArrowLeft'), 1);
  press('ArrowRight', { shiftKey: true });
  press('ArrowUp');
  press('ArrowDown', { shiftKey: true });
  assert.deepEqual(calls, [
    ['move', 'a', -1, 0, 5], ['move', 'a', 1, 0, 1], ['move', 'a', 0, 1, 5], ['move', 'a', 0, -1, 1],
  ]);
});
test('attachKeyboard: Pfeile ohne Auswahl: nichts, kein preventDefault', () => {
  const { press, calls } = setup({ selectedId: null });
  assert.equal(press('ArrowLeft'), 0);
  assert.deepEqual(calls, []);
});
test('attachKeyboard: außerhalb des Plan-Bildschirms inaktiv', () => {
  for (const screen of ['start', 'material']) {
    const { press, calls } = setup({ screen });
    assert.equal(press('r'), 0);
    assert.equal(press('z', { metaKey: true }), 0);
    assert.deepEqual(calls, []);
  }
});
test('attachKeyboard: offener Dialog -> ignoriert', () => {
  let handler;
  const doc = { addEventListener: (_, fn) => { handler = fn; }, querySelector: sel => (sel === 'dialog[open]' ? {} : null) };
  const calls = [];
  attachKeyboard({ getState: () => ({ selectedId: 'a' }), screenOf: () => 'plan', actions: { rotate: () => calls.push(1) }, doc });
  handler({ key: 'r', target: { closest: () => null }, preventDefault: () => calls.push('p') });
  assert.deepEqual(calls, []);
});
test('attachKeyboard: Ziel document wirft nicht', () => {
  const { press, calls } = setup();
  assert.doesNotThrow(() => press('r', { target: {} }));
  assert.deepEqual(calls, [['rotate', 'a']]);
});
test('keyFor: Ereignis ohne key wirft nicht', () => {
  assert.equal(keyFor({ target: {} }), null);
});
