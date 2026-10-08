import test from 'node:test';
import assert from 'node:assert/strict';
import { CATEGORIES, colorFor } from '../js/data/categories.js';
import { PRESET_CASES } from '../js/data/preset-cases.js';
import { PRESET_TRUCKS, DEFAULT_TRUCK_ID } from '../js/data/preset-trucks.js';
import { trussDims, isTruss } from '../js/model/truss.js';

const unique = xs => new Set(xs).size === xs.length;

test('Farbe pro Gewerk, Fallback Sonstiges', () => {
  assert.equal(colorFor('Licht'), CATEGORIES.find(c => c.name === 'Licht').color);
  assert.equal(colorFor('gibt es nicht'), colorFor('Sonstiges'));
});
test('Case-Vorlagen gültig', () => {
  assert.ok(unique(PRESET_CASES.map(c => c.id)));
  const mega = PRESET_TRUCKS.find(t => t.id === 'preset-mega');
  for (const c of PRESET_CASES) {
    assert.ok(c.builtin && c.id.startsWith('preset-'), c.id);
    assert.ok(c.l > 0 && c.w > 0 && c.h > 0 && c.weight >= 0, c.id);
    assert.ok(CATEGORIES.some(k => k.name === c.category), c.id);
    assert.ok(c.l <= mega.l && c.w <= mega.w && c.h <= mega.h, c.id);
    assert.ok(c.wheelH >= 0 && c.wheelH < c.h, c.id);
  }
});
test('Traversenwagen-Vorlagen sind vom Typ truss mit passenden Maßen', () => {
  const trussCases = PRESET_CASES.filter(isTruss);
  assert.equal(trussCases.length, 27);
  for (const c of trussCases) {
    assert.ok(c.truss && c.truss.length > 0 && c.truss.width > 0 && c.truss.count > 0, c.id);
    const dims = trussDims(c.truss);
    assert.equal(c.l, dims.l, c.id);
    assert.equal(c.w, dims.w, c.id);
    assert.equal(c.h, dims.h, c.id);
    assert.equal(c.tippable, false, c.id);
    assert.deepEqual(c.layers, [1, 2], c.id);
    assert.equal(c.wheelH, 0, c.id);
  }
});
// Nutzerwunsch 2026-10-08: die 8 festen „…4er/6er (auf Dolly)“-Vorlagen aus V 0.10.0 sind
// komplett entfernt (nicht nur legacy) – Dolly-Stacks entstehen nur noch über den Dolly-Dialog.
test('Die alten festen Audio-Dolly-Stack-Vorlagen sind entfernt', () => {
  assert.ok(!PRESET_CASES.some(c => /-(4er|6er)-dolly$/.test(c.id)));
  assert.ok(!PRESET_CASES.some(c => /\(auf Dolly\)/.test(c.name)));
});
test('Legacy-Traversen-Presets aus V0.2 existieren weiter (für alte Ladepläne)', () => {
  const byId = id => PRESET_CASES.find(c => c.id === id);
  const legacy1 = byId('preset-truss-29-3m');
  const legacy2 = byId('preset-truss-dolly');
  assert.ok(legacy1, 'preset-truss-29-3m fehlt');
  assert.ok(legacy2, 'preset-truss-dolly fehlt');
  assert.equal(legacy1.legacy, true);
  assert.equal(legacy2.legacy, true);
});
// Gewerk Audio (Nutzerwunsch 2026-10-06): PA-Lautsprecher-Vorlagen, recherchiert mit Quelle
// (docs/casemasse-gewichte.md). Neutral wie alle Vorlagen – kein `company`-Feld, das steht für
// die Verleihfirma des Nutzers (case-library.js), nicht den Geräte-Hersteller.
const AUDIO_IDS = [
  'preset-k2', 'preset-v8v12', 'preset-leopard', 'preset-wpc', 'preset-wps', 'preset-hdl20a',
  'preset-geom620', 'preset-geom6b',
  'preset-ks28', 'preset-v-sub', 'preset-900-lfc', 'preset-sub-8006-as', 'preset-ls18',
];
test('Audio-Vorlagen (Gewerk Ton) sind vollständig und neutral', () => {
  const audio = PRESET_CASES.filter(c => AUDIO_IDS.includes(c.id));
  assert.equal(audio.length, 13, 'erwartet: 13 Einzelboxen (Array-Tops + Subs)');
  assert.ok(audio.every(c => c.category === 'Ton'), 'alle Audio-Vorlagen müssen im Gewerk Ton stehen');
  for (const c of audio) {
    assert.equal(c.company, undefined, c.id);
    assert.equal(c.tippable, false, c.id);
    assert.ok(c.stackable, c.id);
    assert.ok(c.weight > 0, c.id);
    assert.equal(c.wheelH, 0, c.id);
    assert.equal(c.kind, 'speaker', c.id);
  }
});

test('Die 13 Audio-Einzelboxen tragen dollyPrompt, die Dolly-Stacks/übrigen Presets nicht', () => {
  const singleBoxIds = [
    'preset-k2', 'preset-v8v12', 'preset-leopard', 'preset-wpc', 'preset-wps', 'preset-hdl20a',
    'preset-geom620', 'preset-geom6b',
    'preset-ks28', 'preset-v-sub', 'preset-900-lfc', 'preset-sub-8006-as', 'preset-ls18',
  ];
  for (const id of singleBoxIds) {
    const c = PRESET_CASES.find(x => x.id === id);
    assert.ok(c, `${id} fehlt`);
    assert.equal(c.dollyPrompt, true, id);
  }
  const others = PRESET_CASES.filter(c => !singleBoxIds.includes(c.id));
  for (const c of others) assert.ok(!c.dollyPrompt, c.id);
});

// Subs liegen flach (Nutzerangabe): die kleinste recherchierte Achse wird zur Höhe. Keine feste
// Stapel-Vorlage – der Nutzer packt beim Laden so viele in einen Load, wie passen.
test('Sub-Vorlagen sind liegend angelegt (kleinste Achse = Höhe) und ohne Stack-Vorlage', () => {
  const subs = ['preset-ks28', 'preset-v-sub', 'preset-900-lfc', 'preset-sub-8006-as', 'preset-ls18'];
  for (const id of subs) {
    const c = PRESET_CASES.find(x => x.id === id);
    assert.ok(c, `${id} fehlt`);
    assert.ok(c.h <= c.l && c.h <= c.w, `${id}: Höhe ${c.h} ist nicht die kleinste Achse (${c.l}×${c.w})`);
    assert.ok(!PRESET_CASES.some(x => x.id === `${id}-4er-dolly`), `${id} darf keine Stack-Vorlage haben`);
  }
});

test('Fahrzeug-Vorlagen gültig', () => {
  assert.ok(unique(PRESET_TRUCKS.map(t => t.id)));
  assert.ok(PRESET_TRUCKS.some(t => t.id === DEFAULT_TRUCK_ID));
  for (const t of PRESET_TRUCKS) assert.ok(t.builtin && t.l > 0 && t.w > 0 && t.h > 0 && t.payload > 0, t.id);
});

test('Audio-Vorlagen: 8 Array-Tops speakerType "top", 5 Subs "sub", jede mit cabinetColor', () => {
  const tops = ['preset-k2', 'preset-v8v12', 'preset-leopard', 'preset-wpc', 'preset-wps', 'preset-hdl20a', 'preset-geom620', 'preset-geom6b'];
  const subs = ['preset-ks28', 'preset-v-sub', 'preset-900-lfc', 'preset-sub-8006-as', 'preset-ls18'];
  for (const id of tops) assert.equal(PRESET_CASES.find(c => c.id === id)?.speakerType, 'top', id);
  for (const id of subs) assert.equal(PRESET_CASES.find(c => c.id === id)?.speakerType, 'sub', id);
  for (const id of [...tops, ...subs]) assert.match(PRESET_CASES.find(c => c.id === id).cabinetColor, /^#[0-9a-f]{6}$/, id);
});
