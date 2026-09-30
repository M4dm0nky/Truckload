import test from 'node:test';
import assert from 'node:assert/strict';
import { CATEGORIES } from '../js/data/categories.js';
import { PRESET_CASES } from '../js/data/preset-cases.js';
import { CASE_LIBRARY } from '../js/data/case-library.js';
import { checkCase } from '../js/store/io.js';

const unique = xs => new Set(xs).size === xs.length;
const byName = name => CASE_LIBRARY.find(c => c.name === name);

// Die kleinen 19"-Racks ohne Rollen: wheelH ist bei denen 0 statt der sonst
// festen 12 cm, weil sie laut Name und Maßen keine Rollen haben (siehe
// js/data/case-library.js).
const RACKS_OHNE_ROLLEN = new Set([
  '19" 1HE -CAB', '19" 2HE -CAB', '19" 3HE -CAB', '19" 4HE -CAB', '19" 5HE -CAB', '19" 6HE -CAB',
]);

test('genau 137 Cases aus der Liste', () => {
  assert.equal(CASE_LIBRARY.length, 137);
});

test('IDs eindeutig, beginnen mit lib- und kollidieren nicht mit den Vorlagen', () => {
  assert.ok(unique(CASE_LIBRARY.map(c => c.id)));
  assert.ok(CASE_LIBRARY.every(c => c.id.startsWith('lib-')));
  const presetIds = new Set(PRESET_CASES.map(c => c.id));
  assert.ok(CASE_LIBRARY.every(c => !presetIds.has(c.id)));
});

test('jede category kommt in CATEGORIES vor', () => {
  const names = new Set(CATEGORIES.map(c => c.name));
  for (const c of CASE_LIBRARY) assert.ok(names.has(c.category), c.name);
});

test('Maße sind endliche Zahlen > 0 und innerhalb sinnvoller Grenzen', () => {
  for (const c of CASE_LIBRARY) {
    assert.ok(Number.isFinite(c.l) && c.l > 0 && c.l <= 400, c.name);
    assert.ok(Number.isFinite(c.w) && c.w > 0 && c.w <= 250, c.name);
    assert.ok(Number.isFinite(c.h) && c.h > 0 && c.h <= 250, c.name);
  }
});

test('jeder Eintrag besteht checkCase', () => {
  for (const c of CASE_LIBRARY) assert.doesNotThrow(() => checkCase(c), c.name);
});

test('feste Werte je Eintrag', () => {
  for (const c of CASE_LIBRARY) {
    assert.equal(c.builtin, true, c.name);
    assert.equal(c.source, 'liste', c.name);
    assert.equal(c.tippable, true, c.name);
    assert.equal(c.stackable, true, c.name);
    assert.equal(c.maxTopLoad, null, c.name);
    assert.equal(c.stock, null, c.name);
    // Rollenhöhe ist überall 13 cm (Blue Wheel Ø 100 mm, seit V0.8.2), außer bei Cases ohne
    // Rollen (kleine 19"-Racks, seit V0.8.2 auch Pulte/Hazer unter 45 cm) – die tragen 0.
    if (c.wheels !== false) assert.equal(c.wheelH, 13, c.name);
    if (RACKS_OHNE_ROLLEN.has(c.name)) assert.equal(c.wheels, false, c.name);
    assert.equal(c.dimsInclWheels, true, c.name);
    assert.equal(c.layers, undefined, c.name);
    assert.equal(typeof c.company, 'string', c.name);
  }
});

test('kein Eintrag hat ein negatives Gewicht', () => {
  for (const c of CASE_LIBRARY) assert.ok(c.weight >= 0, c.name);
});

test('jeder Eintrag mit Gewicht > 0 trägt „Gewicht geschätzt“ in note oder ist eine der beiden FR10-Zeilen', () => {
  const fr10 = new Set(['FR10 x2 -RentAll', 'FR10 x6 -Motion']);
  for (const c of CASE_LIBRARY) {
    if (c.weight > 0) {
      const isEstimateNote = typeof c.note === 'string' && c.note.includes('Gewicht geschätzt');
      assert.ok(isEstimateNote || fr10.has(c.name), c.name);
    }
  }
});

test('die beiden FR10-Zeilen haben die unveränderten Originalgewichte', () => {
  assert.equal(byName('FR10 x2 -RentAll').weight, 73.52);
  assert.equal(byName('FR10 x6 -Motion').weight, 276);
});

test('Stichprobe: Mac Ultra x2 -CAB', () => {
  const c = byName('Mac Ultra x2 -CAB');
  assert.ok(c);
  assert.equal(c.l, 150);
  assert.equal(c.w, 60);
  assert.equal(c.h, 100);
  assert.equal(c.category, 'Licht');
  assert.equal(c.content, 'Martin');
  assert.equal(c.company, 'CAB');
});

test('Stichprobe: Atomic 3000 x4 no wheels -CAB hat wheels: false', () => {
  const c = byName('Atomic 3000 x4 no wheels -CAB');
  assert.ok(c);
  assert.equal(c.wheels, false);
});

test('Stichprobe: 19" 6HE -CAB hat die gemessene Höhe aus der Quelle, nicht die gerechnete', () => {
  const c = byName('19" 6HE -CAB');
  assert.ok(c);
  assert.equal(c.h, 32);
  assert.equal(c.l, 60);
  assert.equal(c.w, 60);
});

test('Stichprobe: 19" 2HE -CAB hat die gemessene Höhe aus der Quelle, nicht die gerechnete', () => {
  const c = byName('19" 2HE -CAB');
  assert.ok(c);
  assert.equal(c.h, 15);
  assert.equal(c.l, 60);
  assert.equal(c.w, 60);
});

test('gefüllte Maße aus der Quelle werden nie durch eine Rack-Formel überschrieben', () => {
  // Regressionstest für den Fehler, bei dem gemessene Rack-Höhen (2 HE, 6 HE)
  // verworfen und durch h = HE * 4,45 + Aufschlag ersetzt wurden. Die vier
  // tatsächlich gerechneten Racks (1, 4, 5, 16 HE) dürfen dagegen nicht mit den
  // gemessenen Werten der 2/3/6-HE-Racks kollidieren.
  const gemessen = { '19" 2HE -CAB': 15, '19" 3HE -CAB': 19, '19" 6HE -CAB': 32 };
  for (const [name, h] of Object.entries(gemessen)) {
    assert.equal(byName(name).h, h, name);
  }
  const gerechnet = ['19" 1HE -CAB', '19" 4HE -CAB', '19" 5HE -CAB', '19" 16HE on wheels-CAB'];
  for (const name of gerechnet) {
    const c = byName(name);
    assert.ok(c, name);
    assert.ok(!Object.values(gemessen).includes(c.h), `${name} darf keinen der gemessenen Werte tragen`);
  }
});

test('Stichprobe: 19" 1HE -CAB hat die aus den drei gemessenen Racks abgeleitete Höhe', () => {
  const c = byName('19" 1HE -CAB');
  assert.ok(c);
  assert.equal(c.h, 10.1);
  assert.equal(c.l, 60);
  assert.equal(c.w, 60);
});

test('kleine 19" -Racks (1-6 HE) haben keine Rollen, der 16-HE-Eintrag „on wheels“ schon', () => {
  for (const name of RACKS_OHNE_ROLLEN) {
    const c = byName(name);
    assert.ok(c, name);
    assert.equal(c.wheels, false, name);
    assert.equal(c.wheelH, 0, name);
  }
  const mitRollen = byName('19" 16HE on wheels-CAB');
  assert.ok(mitRollen);
  assert.notEqual(mitRollen.wheels, false);
  assert.equal(mitRollen.wheelH, 13); // Blue Wheel Ø 100 mm (Nutzerangabe 2026-09-28)
});

test('die fünf unbrauchbaren Rigging-Zeilen fehlen', () => {
  const gone = [
    'Motorsteuerung (Koffer -BBM',
    'Bolzenkoffer -BBM',
    'FD34 x2 -CAB',
    'HOF BOLT -CAB',
    'Dolly "Drohne" -CAB',
  ];
  for (const name of gone) assert.equal(byName(name), undefined, name);
});

test('Firmenschreibweise ist zusammengeführt (motion/Motion, RentALL/RentAll)', () => {
  const companies = new Set(CASE_LIBRARY.map(c => c.company));
  assert.ok(!companies.has('motion'));
  assert.ok(!companies.has('RentALL'));
  assert.ok(companies.has('Motion'));
  assert.ok(companies.has('RentAll'));
});

// Maßprüfung 2026-09-28 (Nutzerangabe: Listenhöhen sind inkl. Rollen gemessen, Rollen sind
// Blue Wheel Ø 100 mm; die kleinen Cases unter ca. 45 cm haben keine Rollen).
import { PRESET_CASES as PRESETS_ALL } from '../js/data/preset-cases.js';
import { outerDims, wheelHOf } from '../js/model/geometry.js';

const BUILTINS = [...PRESETS_ALL, ...CASE_LIBRARY];

test('mitgelieferte Cases: Belegung = eingetragenes Maß (inkl. Rollen), keine Änderung durch Rollenhöhe', () => {
  for (const c of BUILTINS) {
    assert.notEqual(c.dimsInclWheels, false, c.id);
    assert.deepEqual(outerDims(c), { l: c.l, w: c.w, h: c.h }, c.id);
  }
});

test('mitgelieferte Cases mit Rollen: 13 cm (Blue Wheel Ø 100 mm)', () => {
  for (const c of BUILTINS.filter(c => wheelHOf(c) > 0)) assert.equal(c.wheelH, 13, c.id);
});

test('kleine Cases ohne Rollen', () => {
  const ids = ['lib-mlvt-63a-19-cab', 'lib-chamsys-mq100-cab', 'lib-chamsys-mq500-cab', 'lib-chamsys-wing-compact-cab',
    'lib-zr44-cab', 'lib-look-viper-nt-cab', 'lib-sf-data-ii-cab', 'lib-sf-tourhazer-ii-cab'];
  for (const id of ids) {
    const c = CASE_LIBRARY.find(x => x.id === id);
    assert.ok(c, id);
    assert.equal(wheelHOf(c), 0, id);
  }
  const small = CASE_LIBRARY.filter(c => !c.legacy && c.h < 45 && wheelHOf(c) > 0);
  assert.deepEqual(small.map(c => c.id), []);
});

test('Regression Altdaten: eigenes Case ohne wheelH, Maß ohne Rollen → weiter h + 12', () => {
  const own = { id: 'o', l: 100, w: 60, h: 70, dimsInclWheels: false };
  assert.equal(outerDims(own).h, 82);
});

// Nachrecherche 2026-09-30 (docs/casemasse-gewichte.md, „Nachrecherche 2026-09-30“): 24 der bis
// dahin bewusst bei 0 kg belassenen Cases bekommen ein Gewicht, gemeinsam mit dem Nutzer geklärt
// (reale Konfiguration bei Verteilern/Kabeln, Standardwert nach Volumen bei leeren Rack-/
// Dolly-Gehäusen). Vier weitere werden auf Nutzerwunsch „legacy“ (aus der Auswahl entfernt,
// bestehende Ladepläne laden sie unverändert weiter).
test('Nachrecherche 2026-09-30: neue Gewichte', () => {
  const expect = {
    'ChamSys Wing Compact -CAB': 20,
    'Intellipix -BBM': 40,
    'Powerlock-VT groß -CAB': 140,
    'Powerlock-VT klein -CAB': 50,
    'MLVT 24ch -CAB': 75,
    'MLVT 48ch -CAB': 75,
    'MLVT 63A 19" -CAB': 75,
    'MLVT 63A Hotpatch ROW -CAB': 75,
    'Laka Loom 20-30 -CAB': 75,
    'Laka Loom 28-40 -CAB': 95,
    'Laka Loom 45m -CAB': 120,
    'Powerlocksatz 10m -BBM': 80,
    'Powerlocksatz 10m -CAB': 70,
    'Dimmer 24ch -CAB': 70,
    'Dimmer 48ch -CAB': 120,
    'Datarack braun -CAB': 30,
    'Datarack schwarz -CAB': 20,
    'Rack 16HE Deckel -CAB': 30,
    'Rack Amp 12 HE Schieber -CAB': 30,
    'Schubladencase 90 -CAB': 25,
    'Dolly Rack 28 HEx2 -CAB': 115,
    'Markus Tools -ROW only -CAB': 30,
    'Dimmerdolly (klein/Rack) -BBM': 150,
    'Dimmerdolly (klein/Rack) -CAB': 200,
  };
  for (const [name, weight] of Object.entries(expect)) {
    const c = byName(name);
    assert.ok(c, name);
    assert.equal(c.weight, weight, name);
    assert.ok(typeof c.note === 'string' && c.note.length > 0, `${name} braucht eine Quellenangabe`);
  }
});

test('Nachrecherche 2026-09-30: vier Cases sind jetzt legacy (auf Nutzerwunsch aus der Auswahl entfernt)', () => {
  for (const name of ['63A VT Haube -BBM', 'Rigpack -CAB', 'Lakabaum (flach) -BBM', 'Lakabaum (Transflex) -BBM']) {
    const c = byName(name);
    assert.ok(c, name);
    assert.equal(c.legacy, true, name);
  }
});

test('Nachrecherche 2026-09-30: bewusst weiter bei 0 kg belassene Cases sind unverändert', () => {
  for (const name of [
    '4lite x6 -CAB', 'Asym Flood x1 -CAB', 'Asym Flood x6 -CAB', '2-light x12 -CAB', '8-light x6 -CAB',
    '4-light HORZ x8 -CAB', 'Dolly 6-Bar -CAB', 'Dolly 2kW -CAB', 'Dolly 6-Bar silber -CAB',
    'Das K - Annahme -Kraftklub', 'Base Station -Motion', 'motion Cam', 'Gunnar Arkaos Server -CAB',
    'Gunnar Monitor -CAB', 'Gunnar Tools -CAB', 'Sunstrips Sandwich -CAB', 'Case klein Adapter -Jäger',
    'V-Mat (Schubladen tipbar) -BBM', 'FD34 2m CUSTOMIZE -CAB', 'Slick -CAB', 'Laka Loom 5fach -CAB',
    'MoCo 12ch -CAB', 'MoCo 32ch -CAB',
  ]) {
    const c = byName(name);
    assert.ok(c, name);
    assert.equal(c.weight, 0, name);
  }
});
