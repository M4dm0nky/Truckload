import test from 'node:test';
import assert from 'node:assert/strict';
import { dollyStackCase, dollyStackId, maxDollyCount, upgradeDollyStack, dollyDepth, DOLLY_WEIGHT_KG, DOLLY_HEIGHT_CM } from '../js/model/audioDolly.js';
import { checkCase, exportBundle, parseBundle } from '../js/store/io.js';
import { outerDims } from '../js/model/geometry.js';
import { mkCase } from './fixtures.js';

// Review-Fund (Final-Review, Critical #1): io.js' isPreset() filtert JEDE ID mit dem Präfix
// „preset-“ beim Import heraus, unabhängig von `builtin` – ein Dolly-Stack-Case, dessen ID aus
// der Basisbox-ID gebildet wird (preset-k2 → preset-k2-dolly-4), würde dadurch bei jedem
// Backup-Export/-Import (und beim Teilen einer Datei) verschwinden, die zugehörigen
// Platzierungen würden zu „missingCase“. Deshalb darf die ID nicht mit „preset-“/„lib-“
// beginnen.
test('dollyStackCase: Ergebnis überlebt Export/Import (io.js filtert "preset-"-IDs sonst heraus)', () => {
  const base = mkCase('preset-k2', 138, 40, 35, { weight: 56, name: 'L-Acoustics K2', category: 'Ton' });
  const c = dollyStackCase(base, 4);
  const bundle = exportBundle({ cases: [c], trucks: [], plans: [], ruleSets: [] });
  const parsed = parseBundle(bundle);
  assert.ok(parsed.cases.some(x => x.id === c.id), `${c.id} ist nach Export/Import verschwunden`);
});

test('dollyStackCase: Konstanten aus der Recherche (Carvin/SYNQ/DAS, docs/casemasse-gewichte.md)', () => {
  assert.equal(DOLLY_HEIGHT_CM, 18);
  assert.equal(DOLLY_WEIGHT_KG, 15);
});

test('dollyStackCase: Länge = Boxbreite, Tiefe = Dolly-Stufe, Höhe/Gewicht nach Formel', () => {
  const base = mkCase('preset-ls18', 78, 68, 51, { weight: 56, name: 'Nexo LS18', category: 'Ton' });
  const c = dollyStackCase(base, 3);
  assert.equal(c.l, 78);
  assert.equal(c.w, 80);
  assert.equal(c.unitD, 68);
  assert.equal(c.h, 3 * 51);
  assert.equal(c.weight, 15 + 3 * 56);
});

test('dollyStackCase: Dolly-Höhe steckt in wheelH, nicht in h (outerDims addiert sie)', () => {
  const base = mkCase('preset-ls18', 78, 68, 51, { weight: 56, name: 'Nexo LS18', category: 'Ton' });
  const c = dollyStackCase(base, 2);
  assert.equal(c.wheelH, 18);
  assert.equal(c.dimsInclWheels, false);
  assert.equal(outerDims(c).h, 2 * 51 + 18);
});

test('dollyStackCase: id/name tragen Basis-ID und Stückzahl, ohne company-Feld', () => {
  const base = mkCase('preset-ls18', 78, 68, 51, { weight: 56, name: 'Nexo LS18', category: 'Ton' });
  const c = dollyStackCase(base, 4);
  assert.equal(c.id, 'dolly-ls18-4');
  assert.equal(c.name, 'Nexo LS18 4er (auf Dolly)');
  assert.equal(c.company, undefined);
  assert.equal(c.category, 'Ton');
});

test('dollyStackCase: nie tippbar, Stack ist der volle Turm (nur Lage 1)', () => {
  const base = mkCase('preset-ls18', 78, 68, 51, { weight: 56, name: 'Nexo LS18', category: 'Ton' });
  const c = dollyStackCase(base, 1);
  assert.equal(c.tippable, false);
  assert.deepEqual(c.layers, [1]);
  assert.ok(c.stackable);
});

test('dollyStackCase: Gegenprobe L-Acoustics K2, Stückzahl 4 (reale Boxmaße)', () => {
  const k2 = mkCase('preset-k2', 138, 40, 35, { weight: 56, name: 'L-Acoustics K2', category: 'Ton' });
  const c = dollyStackCase(k2, 4);
  assert.equal(c.l, 138);
  assert.equal(c.w, 60);
  assert.equal(c.unitD, 40);
  assert.equal(c.h, 4 * 35);
  assert.equal(c.weight, 15 + 4 * 56);
});

test('dollyStackCase: Ergebnis besteht checkCase() auch bei großer Stückzahl (10 schwere Subs)', () => {
  const sub = mkCase('preset-sub-8006-as', 111, 71, 70, { weight: 96, name: 'RCF SUB 8006-AS', category: 'Ton' });
  const c = dollyStackCase(sub, 10);
  assert.doesNotThrow(() => checkCase(c));
});

test('dollyStackId: gleiche Basisbox + gleiche Stückzahl → dieselbe ID (für die Zeilen-Wiederverwendung im Dialog)', () => {
  const base = mkCase('preset-ls18', 78, 68, 51, { weight: 56, name: 'Nexo LS18', category: 'Ton' });
  assert.equal(dollyStackId(base, 3), dollyStackId(base, 3));
  assert.equal(dollyStackId(base, 3), dollyStackCase(base, 3).id);
});

// Review-Fund (Final-Review, Important #3): das Zahlenfeld im Dialog hatte keine Obergrenze –
// ein Tippfehler (z. B. 60 statt 6) hätte ein Case erzeugt, das checkCase()/CASE_LIMITS
// überschreitet. `repo.saveCase()` validiert beim Speichern nicht selbst, das Case landet also
// unbemerkt im Store und wird erst beim nächsten Export/Import zum Allen-oder-nichts-Fehler.
// maxDollyCount() liefert die größte Stückzahl, bei der sowohl Höhe als auch Gewicht innerhalb
// von CASE_LIMITS bleiben – für das Dialog-Feld „max“-Attribut, genau wie case-editor.js es für
// seine eigenen Felder schon tut.
test('maxDollyCount: größte Stückzahl, bei der Höhe UND Gewicht innerhalb CASE_LIMITS bleiben', () => {
  const k2 = mkCase('preset-k2', 138, 40, 35, { weight: 56, name: 'L-Acoustics K2', category: 'Ton' });
  const max = maxDollyCount(k2);
  const atMax = dollyStackCase(k2, max);
  const overMax = dollyStackCase(k2, max + 1);
  assert.doesNotThrow(() => checkCase(atMax));
  assert.throws(() => checkCase(overMax));
});

// Nutzer-Feedback 2026-10-08: die Dolly-Stacks sahen in 3D wie ein normales Flightcase aus
// (Kugelecken, Deckelfuge, Griffe aus js/ui/view3d.js), nicht wie PA-Lautsprecher. `kind:
// 'speaker'` gibt view3d.js einen eigenen Render-Zweig (wie `kind: 'truss'` für
// Traversenwagen), `unitH` die Höhe einer einzelnen Box im Stack, damit der Zweig die
// Trennlinien zwischen den gestapelten Boxen zeichnen kann, ohne raten zu müssen.
test('dollyStackCase: kind "speaker" und unitH für die eigene 3D-Darstellung (keine Flightcase-Optik)', () => {
  const base = mkCase('preset-ls18', 78, 68, 51, { weight: 56, name: 'Nexo LS18', category: 'Ton' });
  const c = dollyStackCase(base, 3);
  assert.equal(c.kind, 'speaker');
  assert.equal(c.unitH, 51);
  assert.doesNotThrow(() => checkCase(c));
});

test('dollyStackCase: Stückzahl 1 ist gültig (ein Dolly, eine Box)', () => {
  const base = mkCase('preset-geom6b', 37, 26, 19, { weight: 8, name: 'Nexo GEO M6B', category: 'Ton' });
  const c = dollyStackCase(base, 1);
  assert.equal(c.h, 19);
  assert.equal(c.weight, 23);
  assert.doesNotThrow(() => checkCase(c));
});

// Migration (Nutzer-Screenshot 2026-10-08): in der IndexedDB liegen Dolly-Stacks aus früheren
// Versionen ohne `kind`/`unitH` – teils noch mit der ganz alten ID `preset-<basis>-dolly-<n>`
// (vor dem ID-Fix), die ein erneuter Dialog-Lauf nie trifft. upgradeDollyStack() ergänzt nur die
// fehlenden Darstellungsfelder; Maße, Gewicht und ID bleiben unverändert.
const K2 = mkCase('preset-k2', 138, 40, 35, {
  weight: 56, name: 'L-Acoustics K2', category: 'Ton', dollyPrompt: true, kind: 'speaker',
  speakerType: 'top', cabinetColor: '#3a332e',
});
const oldStack = id => ({
  id, builtin: false, name: 'L-Acoustics K2 2er (auf Dolly)', content: '', category: 'Ton',
  color: '#888888', l: 138, w: 40, h: 70, weight: 127, tippable: false, stackable: true,
  maxTopLoad: null, wheelH: 18, dimsInclWheels: false, layers: [1],
});

test('upgradeDollyStack: Alt-Stack mit aktueller ID bekommt kind/unitH/speakerType/cabinetColor', () => {
  const c = upgradeDollyStack(oldStack('dolly-k2-2'), [K2]);
  assert.equal(c.kind, 'speaker');
  assert.equal(c.unitH, 35);
  assert.equal(c.speakerType, 'top');
  assert.equal(c.cabinetColor, '#3a332e');
});

test('upgradeDollyStack: alte ID-Form preset-<basis>-dolly-<n> wird ebenfalls erkannt', () => {
  const c = upgradeDollyStack(oldStack('preset-k2-dolly-2'), [K2]);
  assert.equal(c.kind, 'speaker');
  assert.equal(c.unitH, 35);
  assert.equal(c.id, 'preset-k2-dolly-2');
});

test('upgradeDollyStack: Länge, Höhe, Gewicht, Rollenhöhe und ID bleiben unverändert', () => {
  const before = oldStack('dolly-k2-2');
  const c = upgradeDollyStack(before, [K2]);
  for (const k of ['id', 'l', 'h', 'weight', 'wheelH', 'dimsInclWheels', 'name']) assert.equal(c[k], before[k], k);
});

// Nutzerwunsch 2026-10-08: alte Stacks belegten nur die nackte Boxentiefe (K2: 40 cm) – sechs
// passten nebeneinander in den Truck. Bewusste Maßänderung auf Nutzerwunsch: die Tiefe wird auf
// die Dolly-Stufe aufgerundet, die echte Boxentiefe bleibt in unitD erhalten.
test('upgradeDollyStack: alte Stack-Tiefe wird auf die Dolly-Stufe gezogen, Boxentiefe in unitD', () => {
  const c = upgradeDollyStack(oldStack('dolly-k2-2'), [K2]);
  assert.equal(c.w, 60);
  assert.equal(c.unitD, 40);
  assert.equal(upgradeDollyStack(c, [K2]), c);
});

// Dollys werden mit der kurzen Seite voran in den Truck geschoben: 4/3/2 nebeneinander in 248 cm
// (Nutzerangabe) → Tiefen-Stufen 60/80/120 cm. Darüber: Boxentiefe selbst, kein erfundenes Maß.
test('dollyDepth: kleinste Stufe 60/80/120, die die Boxentiefe aufnimmt', () => {
  assert.deepEqual([40, 60, 61, 72, 80, 81, 120, 130].map(dollyDepth), [60, 60, 80, 80, 80, 120, 120, 130]);
});

test('upgradeDollyStack: aktuelles Case bleibt identisch, fremde/unbekannte IDs unverändert', () => {
  const current = dollyStackCase(K2, 2);
  assert.equal(upgradeDollyStack(current, [K2]), current);
  const other = mkCase('mein-case', 60, 60, 60);
  assert.equal(upgradeDollyStack(other, [K2]), other);
  const unknownBase = oldStack('dolly-gibtsnicht-2');
  assert.equal(upgradeDollyStack(unknownBase, [K2]), unknownBase);
});

test('dollyStackCase: übernimmt speakerType und cabinetColor der Basisbox', () => {
  const c = dollyStackCase(K2, 3);
  assert.equal(c.speakerType, 'top');
  assert.equal(c.cabinetColor, '#3a332e');
});

// V 0.12.3: Wagengröße ist pro Firma verschieden und im Dolly-Dialog änderbar.
test('dollyStackCase: eigene Wagenmaße ersetzen Boxbreite/Dolly-Stufe, Höhe bleibt', () => {
  const base = { id: 'preset-k2', name: 'K2', category: 'Ton', l: 138, w: 40, h: 35, weight: 56 };
  const c = dollyStackCase(base, 2, { l: 150, w: 70 });
  assert.equal(c.l, 150);
  assert.equal(c.w, 70);
  assert.equal(c.unitD, 40);
  assert.equal(c.h, 70);
  assert.equal(c.wheelH, DOLLY_HEIGHT_CM);
});
test('dollyStackCase: ohne Wagenmaße gilt der Stand von 0.12.2', () => {
  const base = { id: 'preset-k2', name: 'K2', category: 'Ton', l: 138, w: 40, h: 35, weight: 56 };
  const c = dollyStackCase(base, 2);
  assert.equal(c.l, 138);
  assert.equal(c.w, dollyDepth(40));
});

test('dollyStackId: mit Firma eigener Namensraum, ohne Firma unverändert (alte IDs)', () => {
  const k2 = { id: 'preset-k2' };
  assert.equal(dollyStackId(k2, 2), 'dolly-k2-2');
  assert.equal(dollyStackId(k2, 2, 'CAB Berlin'), 'dolly-cab-berlin-k2-2');
});
test('dollyStackCase: Firma wird gesetzt', () => {
  const base = { id: 'preset-k2', name: 'K2', category: 'Ton', l: 138, w: 40, h: 35, weight: 56 };
  const c = dollyStackCase(base, 2, {}, 'CAB');
  assert.equal(c.company, 'CAB'); assert.equal(c.id, 'dolly-cab-k2-2');
});
test('dollyStackId: dieselbe Box mit und ohne Firma ergibt verschiedene IDs', () => {
  const k2 = { id: 'preset-k2' };
  assert.notEqual(dollyStackId(k2, 2, 'CAB'), dollyStackId(k2, 2));
});
