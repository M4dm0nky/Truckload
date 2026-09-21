import test from 'node:test';
import assert from 'node:assert/strict';
import { exportBundle, parseBundle, mergeById, backupFileName, CASE_LIMITS } from '../js/store/io.js';
import { APP_VERSION } from '../js/version.js';
import { DOLLY_H } from '../js/model/truss.js';
import { mkCase, mkTruck, plan, P } from './fixtures.js';

const own = mkCase('own', 120, 60, 60);
const builtin = { ...mkCase('preset-x', 1, 1, 1), builtin: true };
const bundleWith = fields => JSON.stringify({ format: 'truckload', version: 1, ...fields });

test('Export enthält nur eigene Cases/Fahrzeuge und alle Pläne', () => {
  const json = JSON.parse(exportBundle({ cases: [own, builtin], trucks: [mkTruck(), { ...mkTruck(), id: 'b', builtin: true }], plans: [plan([])] }, new Date('2026-09-18T10:00:00Z')));
  assert.equal(json.format, 'truckload');
  assert.equal(json.version, 1);
  assert.equal(json.appVersion, APP_VERSION);
  assert.deepEqual(json.cases.map(c => c.id), ['own']);
  assert.deepEqual(json.trucks.map(t => t.id), ['t']);
  assert.equal(json.plans.length, 1);
});
test('Roundtrip', () => {
  const text = exportBundle({ cases: [own], trucks: [], plans: [plan([])] });
  const b = parseBundle(text);
  assert.deepEqual(b.cases, [own]);
  assert.deepEqual(b.plans[0].unplaced, []);
});
test('Fehlerfälle', () => {
  assert.throws(() => parseBundle('kein json'), /kein gültiges JSON/);
  assert.throws(() => parseBundle('{"format":"anders"}'), /Keine Truckload-Datei/);
  assert.throws(() => parseBundle('{"format":"truckload","version":99}'), /neueren Version/);
  const bad = JSON.stringify({ format: 'truckload', version: 1, cases: [{ ...own, l: 0 }] });
  assert.throws(() => parseBundle(bad), /ungültige Maße/);
});
test('Merge: neueres updatedAt gewinnt, Neues kommt dazu', () => {
  const a = { id: '1', v: 'alt', updatedAt: '2026-01-01' };
  const b = { id: '1', v: 'neu', updatedAt: '2026-02-01' };
  const c = { id: '2', v: 'x', updatedAt: '2026-01-01' };
  assert.deepEqual(mergeById([b], [a]), [b]);
  assert.deepEqual(mergeById([a], [b, c]), [b, c]);
});
test('Dateiname', () => assert.equal(backupFileName(new Date('2026-09-18T10:00:00Z')), 'truckload-backup-2026-09-18.json'));

test('Ladeplan mit ungültiger Lage wird abgelehnt', () => {
  const p = plan([P('pl1', 'own', 0, 0, 0, { orientation: 'sideways' })]);
  const bad = bundleWith({ cases: [own], trucks: [], plans: [p] });
  assert.throws(() => parseBundle(bad), /ungültige Platzierungen/);
});
test('Ladeplan mit ungültiger Drehung wird abgelehnt', () => {
  const p = plan([P('pl1', 'own', 0, 0, 0, { rot: 45 })]);
  const bad = bundleWith({ cases: [own], trucks: [], plans: [p] });
  assert.throws(() => parseBundle(bad), /ungültige Platzierungen/);
});
test('Ladeplan mit nicht-numerischer Position wird abgelehnt', () => {
  const p = plan([P('pl1', 'own', 'nan', 0, 0)]);
  const bad = bundleWith({ cases: [own], trucks: [], plans: [p] });
  assert.throws(() => parseBundle(bad), /ungültige Platzierungen/);
});
test('Case mit ungültigem maxTopLoad wird abgelehnt', () => {
  const bad = bundleWith({ cases: [{ ...own, maxTopLoad: 'viel' }], trucks: [], plans: [] });
  assert.throws(() => parseBundle(bad), /ungültige Eigenschaften/);
});
test('Case mit negativem wheelH wird abgelehnt', () => {
  const bad = bundleWith({ cases: [{ ...own, wheelH: -1 }], trucks: [], plans: [] });
  assert.throws(() => parseBundle(bad), /ungültige Eigenschaften/);
});
test('Case mit wheelH >= h wird abgelehnt', () => {
  const bad = bundleWith({ cases: [{ ...own, wheelH: own.h }], trucks: [], plans: [] });
  assert.throws(() => parseBundle(bad), /ungültige Eigenschaften/);
});
test('Case ohne wheelH wird akzeptiert (Fallback)', () => {
  const res = parseBundle(bundleWith({ cases: [own], trucks: [], plans: [] }));
  assert.equal(res.cases[0].wheelH, undefined);
});
test('Case mit gültigem wheelH wird akzeptiert', () => {
  const res = parseBundle(bundleWith({ cases: [{ ...own, wheelH: 0 }], trucks: [], plans: [] }));
  assert.equal(res.cases[0].wheelH, 0);
});
test('Case mit wheelH >= h wird akzeptiert, wenn dimsInclWheels: false', () => {
  const res = parseBundle(bundleWith({ cases: [{ ...own, wheelH: own.h, dimsInclWheels: false }], trucks: [], plans: [] }));
  assert.equal(res.cases[0].wheelH, own.h);
});
test('Case mit wheels: "ja" (kein Boolean) wird abgelehnt', () => {
  const bad = bundleWith({ cases: [{ ...own, wheels: 'ja' }], trucks: [], plans: [] });
  assert.throws(() => parseBundle(bad), /ungültige Eigenschaften/);
});
test('Case mit dimsInclWheels: "ja" (kein Boolean) wird abgelehnt', () => {
  const bad = bundleWith({ cases: [{ ...own, dimsInclWheels: 'ja' }], trucks: [], plans: [] });
  assert.throws(() => parseBundle(bad), /ungültige Eigenschaften/);
});
test('Case mit wheels: false wird akzeptiert', () => {
  const res = parseBundle(bundleWith({ cases: [{ ...own, wheels: false }], trucks: [], plans: [] }));
  assert.equal(res.cases[0].wheels, false);
});
test('Fahrzeug mit ungültiger Radkasten-Seite wird abgelehnt', () => {
  const t = mkTruck({ wheelArches: [{ x: 100, l: 50, w: 20, h: 30, side: 'top' }] });
  const bad = bundleWith({ cases: [], trucks: [t], plans: [] });
  assert.throws(() => parseBundle(bad), /ungültige Radkästen/);
});
test('Fahrzeug mit wheelArches als Nicht-Array wird abgelehnt (statt still zu [] zu werden)', () => {
  // Vorher: arr(t.wheelArches ?? []) machte "boom" zu [], die Prüfung bestand, und der
  // kaputte Wert landete unverändert im Fahrzeug-Objekt. archBoxes() ruft später
  // .flatMap() auf truck.wheelArches auf und stürzt dann ungefangen ab.
  const t = { ...mkTruck(), wheelArches: 'boom' };
  const bad = bundleWith({ cases: [], trucks: [t], plans: [] });
  assert.throws(() => parseBundle(bad), /ungültige Radkästen/);
});
test('Fahrzeug mit wheelArches: null wird weiterhin akzeptiert (wie fehlendes Feld)', () => {
  const t = { ...mkTruck(), wheelArches: null };
  const res = parseBundle(bundleWith({ cases: [], trucks: [t], plans: [] }));
  assert.equal(res.trucks[0].id, t.id);
});
test('Datei ohne Versionsangabe wird abgelehnt', () => {
  const bad = JSON.stringify({ format: 'truckload', cases: [], trucks: [], plans: [] });
  assert.throws(() => parseBundle(bad), /keine gültige Versionsangabe/);
});
test('Case ohne layers wird akzeptiert (Fallback)', () => {
  const res = parseBundle(bundleWith({ cases: [own], trucks: [], plans: [] }));
  assert.equal(res.cases[0].layers, undefined);
});
test('Case mit gültigen layers wird akzeptiert', () => {
  const res = parseBundle(bundleWith({ cases: [{ ...own, layers: [1, 2] }], trucks: [], plans: [] }));
  assert.deepEqual(res.cases[0].layers, [1, 2]);
});
test('Case mit leeren layers wird abgelehnt', () => {
  const bad = bundleWith({ cases: [{ ...own, layers: [] }], trucks: [], plans: [] });
  assert.throws(() => parseBundle(bad), /ungültige Eigenschaften/);
});
test('Case mit layers außerhalb 1–4 wird abgelehnt', () => {
  const bad = bundleWith({ cases: [{ ...own, layers: [5] }], trucks: [], plans: [] });
  assert.throws(() => parseBundle(bad), /ungültige Eigenschaften/);
});
test('Case mit doppelten layers wird abgelehnt', () => {
  const bad = bundleWith({ cases: [{ ...own, layers: [1, 1] }], trucks: [], plans: [] });
  assert.throws(() => parseBundle(bad), /ungültige Eigenschaften/);
});
test('Case mit gültigen Traversenwagen-Feldern wird akzeptiert', () => {
  const truss = { ...own, kind: 'truss', truss: { length: 300, width: 29, count: 4 } };
  const res = parseBundle(bundleWith({ cases: [truss], trucks: [], plans: [] }));
  assert.deepEqual(res.cases[0].truss, { length: 300, width: 29, count: 4 });
});
test('Case mit kind truss ohne truss-Werte wird abgelehnt', () => {
  const bad = bundleWith({ cases: [{ ...own, kind: 'truss' }], trucks: [], plans: [] });
  assert.throws(() => parseBundle(bad), /Traversenwagen/);
});
test('Case mit kind truss und ungültiger Traversenlänge wird abgelehnt', () => {
  const bad = bundleWith({ cases: [{ ...own, kind: 'truss', truss: { length: 0, width: 29, count: 4 } }], trucks: [], plans: [] });
  assert.throws(() => parseBundle(bad), /Traversenwagen/);
});
test('Case mit unbekanntem kind wird abgelehnt', () => {
  const bad = bundleWith({ cases: [{ ...own, kind: 'sonstwas' }], trucks: [], plans: [] });
  assert.throws(() => parseBundle(bad), /ungültige Eigenschaften/);
});
test('Case ohne kind wird akzeptiert (Fallback case)', () => {
  const res = parseBundle(bundleWith({ cases: [own], trucks: [], plans: [] }));
  assert.equal(res.cases[0].kind, undefined);
});

test('Case mit truss.width über 40 cm wird abgelehnt', () => {
  const bad = bundleWith({ cases: [{ ...own, kind: 'truss', truss: { length: 300, width: 52, count: 4 } }], trucks: [], plans: [] });
  assert.throws(() => parseBundle(bad), /Traversenwagen/);
});
test('Case mit truss und tippable true wird abgelehnt', () => {
  const bad = bundleWith({ cases: [{ ...own, kind: 'truss', truss: { length: 300, width: 29, count: 4 }, tippable: true }], trucks: [], plans: [] });
  assert.throws(() => parseBundle(bad), /Traversenwagen/);
});
test('Case mit truss.count als Bruchzahl wird abgelehnt', () => {
  const bad = bundleWith({ cases: [{ ...own, kind: 'truss', truss: { length: 300, width: 29, count: 2.5 } }], trucks: [], plans: [] });
  assert.throws(() => parseBundle(bad), /Traversenwagen/);
});
test('Case mit truss.count 13 wird abgelehnt', () => {
  const bad = bundleWith({ cases: [{ ...own, kind: 'truss', truss: { length: 300, width: 29, count: 13 } }], trucks: [], plans: [] });
  assert.throws(() => parseBundle(bad), /Traversenwagen/);
});
test('Truss wird beim Import normalisiert (l/w/h, wheelH, tippable)', () => {
  const raw = { ...own, kind: 'truss', truss: { length: 300, width: 29, count: 4 }, l: 1, w: 1, h: 999, wheelH: 12, tippable: false };
  const res = parseBundle(bundleWith({ cases: [raw], trucks: [], plans: [] }));
  const c = res.cases[0];
  assert.equal(c.l, 300);
  assert.equal(c.w, 60);
  assert.equal(c.h, DOLLY_H + 2 * 29);
  assert.equal(c.wheelH, 0);
  assert.equal(c.tippable, false);
});

test('Ladeplan mit 60-Zeichen-Label wird abgelehnt', () => {
  const p = plan([P('pl1', 'own', 0, 0, 0, { label: 'x'.repeat(60) })]);
  const bad = bundleWith({ cases: [own], trucks: [], plans: [p] });
  assert.throws(() => parseBundle(bad), /ungültige Platzierungen/);
});
test('Ladeplan mit ungültiger Farbe wird abgelehnt', () => {
  const p = plan([P('pl1', 'own', 0, 0, 0, { color: 'rot' })]);
  const bad = bundleWith({ cases: [own], trucks: [], plans: [p] });
  assert.throws(() => parseBundle(bad), /ungültige Platzierungen/);
});
test('Ladeplan mit gültigem Label/Farbe wird akzeptiert', () => {
  const p = plan([P('pl1', 'own', 0, 0, 0, { label: 'Kabelcase 1', color: '#ff00aa' })]);
  const ok = bundleWith({ cases: [own], trucks: [], plans: [p] });
  const res = parseBundle(ok);
  assert.equal(res.plans[0].placements[0].label, 'Kabelcase 1');
});
test('Ablage mit ungültigem Label wird abgelehnt', () => {
  const p = { ...plan([]), unplaced: [{ id: 'u1', caseId: 'own', label: 'x'.repeat(60) }] };
  const bad = bundleWith({ cases: [own], trucks: [], plans: [p] });
  assert.throws(() => parseBundle(bad), /ungültige Platzierungen/);
});
test('Ablage mit ungültiger Farbe wird abgelehnt', () => {
  const p = { ...plan([]), unplaced: [{ id: 'u1', caseId: 'own', color: 'rot' }] };
  const bad = bundleWith({ cases: [own], trucks: [], plans: [p] });
  assert.throws(() => parseBundle(bad), /ungültige Platzierungen/);
});
test('Ladeplan ohne Label/Farbe-Felder lädt unverändert', () => {
  const p = plan([P('pl1', 'own', 0, 0, 0)]);
  const ok = bundleWith({ cases: [own], trucks: [], plans: [p] });
  const res = parseBundle(ok);
  assert.equal(res.plans[0].placements[0].label, undefined);
});

test('Vorlagen (builtin/preset-*) werden beim Import verworfen', () => {
  const presetById = { ...mkCase('preset-y', 10, 10, 10), builtin: false };
  const bad = bundleWith({ cases: [own, builtin, presetById], trucks: [mkTruck(), { ...mkTruck({ id: 'preset-truck' }) }], plans: [] });
  const res = parseBundle(bad);
  assert.deepEqual(res.cases.map(c => c.id), ['own']);
  assert.deepEqual(res.trucks.map(t => t.id), ['t']);
});

// --- Daten-1 (blocking): updatedAt muss, falls vorhanden, ein String sein ---

test('Ladeplan mit numerischem updatedAt wird abgelehnt (Absturzpfad app.js:30)', () => {
  const p = { ...plan([]), updatedAt: 5 };
  const bad = bundleWith({ cases: [], trucks: [], plans: [p] });
  assert.throws(() => parseBundle(bad), /ungültigen Zeitstempel/);
});
test('Case mit Objekt als updatedAt wird abgelehnt', () => {
  const bad = bundleWith({ cases: [{ ...own, updatedAt: {} }], trucks: [], plans: [] });
  assert.throws(() => parseBundle(bad), /ungültigen Zeitstempel/);
});
test('Fahrzeug mit numerischem updatedAt wird abgelehnt', () => {
  const t = mkTruck({ updatedAt: 12345 });
  const bad = bundleWith({ cases: [], trucks: [t], plans: [] });
  assert.throws(() => parseBundle(bad), /ungültigen Zeitstempel/);
});
test('Case/Fahrzeug/Ladeplan mit String-updatedAt werden akzeptiert', () => {
  const c = { ...own, updatedAt: '2026-09-18T10:00:00.000Z' };
  const t = mkTruck({ updatedAt: '2026-09-18T10:00:00.000Z' });
  const p = { ...plan([]), updatedAt: '2026-09-18T10:00:00.000Z' };
  const res = parseBundle(bundleWith({ cases: [c], trucks: [t], plans: [p] }));
  assert.equal(res.cases[0].updatedAt, '2026-09-18T10:00:00.000Z');
});

// --- UI-B2 (blocking): Case-Farbe wird geprüft wie Stückfarben ---

test('Case mit CSS-Einschleusung über die Farbe wird abgelehnt', () => {
  const evil = { ...own, color: 'red;position:fixed;inset:0;width:100vw;height:100vw;z-index:9999;background-image:url(http://evil.example/x)' };
  const bad = bundleWith({ cases: [evil], trucks: [], plans: [] });
  assert.throws(() => parseBundle(bad), /ungültige Farbe/);
});
test('Case mit gültiger Hex-Farbe wird akzeptiert', () => {
  const res = parseBundle(bundleWith({ cases: [{ ...own, color: '#ff00aa' }], trucks: [], plans: [] }));
  assert.equal(res.cases[0].color, '#ff00aa');
});

// --- Daten-6: Obergrenzen für Case-Werte ---

test('Case mit riesigen Maßen (1e9 cm) wird abgelehnt', () => {
  const bad = bundleWith({ cases: [{ ...own, l: 1e9 }], trucks: [], plans: [] });
  assert.throws(() => parseBundle(bad), /ungültige Maße/);
});
test('Case mit Maß genau an der Obergrenze wird akzeptiert, darüber abgelehnt', () => {
  const ok = parseBundle(bundleWith({ cases: [{ ...own, l: CASE_LIMITS.l }], trucks: [], plans: [] }));
  assert.equal(ok.cases[0].l, CASE_LIMITS.l);
  const bad = bundleWith({ cases: [{ ...own, l: CASE_LIMITS.l + 1 }], trucks: [], plans: [] });
  assert.throws(() => parseBundle(bad), /ungültige Maße/);
});
test('Case mit riesigem Gewicht (100 Tonnen) wird abgelehnt', () => {
  const bad = bundleWith({ cases: [{ ...own, weight: 100000 }], trucks: [], plans: [] });
  assert.throws(() => parseBundle(bad), /ungültiges Gewicht/);
});
test('Case mit riesigem maxTopLoad wird abgelehnt', () => {
  const bad = bundleWith({ cases: [{ ...own, maxTopLoad: CASE_LIMITS.maxTopLoad + 1 }], trucks: [], plans: [] });
  assert.throws(() => parseBundle(bad), /ungültige Eigenschaften/);
});
test('Case mit riesigem stock wird abgelehnt', () => {
  const bad = bundleWith({ cases: [{ ...own, stock: CASE_LIMITS.stock + 1 }], trucks: [], plans: [] });
  assert.throws(() => parseBundle(bad), /ungültige Eigenschaften/);
});
test('Case mit riesiger wheelH wird abgelehnt', () => {
  const bad = bundleWith({ cases: [{ ...own, wheelH: CASE_LIMITS.wheelH + 1, dimsInclWheels: false }], trucks: [], plans: [] });
  assert.throws(() => parseBundle(bad), /ungültige Eigenschaften/);
});

// --- Daten-14: eindeutige Stück-IDs innerhalb eines Plans ---

test('Ladeplan mit doppelter Stück-ID wird abgelehnt', () => {
  const p = plan([P('dup', 'own', 0, 0, 0), P('dup', 'own', 200, 0, 0)]);
  const bad = bundleWith({ cases: [own], trucks: [], plans: [p] });
  assert.throws(() => parseBundle(bad), /doppelte Stück-IDs/);
});
test('Doppelte Stück-ID zwischen Platzierung und Ablage wird abgelehnt', () => {
  const p = { ...plan([P('dup', 'own', 0, 0, 0)]), unplaced: [{ id: 'dup', caseId: 'own' }] };
  const bad = bundleWith({ cases: [own], trucks: [], plans: [p] });
  assert.throws(() => parseBundle(bad), /doppelte Stück-IDs/);
});

// --- Daten-17: plan.notes wird geprüft ---

test('Ladeplan mit notes als Objekt wird abgelehnt', () => {
  const p = { ...plan([]), notes: { evil: true } };
  const bad = bundleWith({ cases: [], trucks: [], plans: [p] });
  assert.throws(() => parseBundle(bad), /ungültige Notizen/);
});
test('Ladeplan mit zu langen notes wird abgelehnt', () => {
  const p = { ...plan([]), notes: 'x'.repeat(2001) };
  const bad = bundleWith({ cases: [], trucks: [], plans: [p] });
  assert.throws(() => parseBundle(bad), /ungültige Notizen/);
});
test('Ladeplan mit gültigen notes wird akzeptiert', () => {
  const p = { ...plan([]), notes: 'Vorsicht beim Ausladen.' };
  const res = parseBundle(bundleWith({ cases: [], trucks: [], plans: [p] }));
  assert.equal(res.plans[0].notes, 'Vorsicht beim Ausladen.');
});

// --- Daten-4 (important): mergeById vergleicht updatedAt nur bei zwei Strings ---

test('mergeById: Objekt als updatedAt gewinnt nicht gegen einen lokalen String-Stand', () => {
  const local = { id: '1', v: 'lokal', updatedAt: '2026-01-01' };
  const evil = { id: '1', v: 'fremd', updatedAt: {} };
  assert.deepEqual(mergeById([local], [evil]), [local]);
});
test('mergeById: fehlender lokaler Zeitstempel gewinnt trotzdem gegen einen gültigen fremden', () => {
  const local = { id: '1', v: 'lokal' };
  const incoming = { id: '1', v: 'fremd', updatedAt: '2026-09-01' };
  assert.deepEqual(mergeById([local], [incoming]), [local]);
});
test('mergeById: neuer Eintrag ohne lokales Gegenstück wird trotzdem übernommen', () => {
  const incoming = { id: '2', v: 'neu', updatedAt: {} };
  assert.deepEqual(mergeById([], [incoming]), [incoming]);
});

// --- Daten-20: lib-… IDs werden wie preset-… beim Import verworfen ---

test('Ein Case mit lib-…-ID wird beim Import verworfen (verdeckt sonst die Bibliothek)', () => {
  const fakeLib = { ...mkCase('lib-lakabaum-flach-bbm', 10, 10, 10), builtin: false };
  const bad = bundleWith({ cases: [own, fakeLib], trucks: [], plans: [] });
  const res = parseBundle(bad);
  assert.deepEqual(res.cases.map(c => c.id), ['own']);
});

// --- Daten-21: Verweise auf unbekannte Cases/Fahrzeuge werden gemeldet ---

test('Ladeplan mit Verweis auf unbekanntes Case wird gemeldet, aber importiert', () => {
  const p = plan([P('pl1', 'geist-case-123', 0, 0, 0)]);
  const ok = bundleWith({ cases: [], trucks: [], plans: [p] });
  const res = parseBundle(ok);
  assert.equal(res.plans.length, 1);
  assert.ok(res.warnings.some(w => /unbekannt|weder in der Datei/.test(w)));
});
test('Ladeplan mit Verweis auf unbekanntes Fahrzeug wird gemeldet, aber importiert', () => {
  const p = { ...plan([]), truckId: 'geist-truck-123' };
  const ok = bundleWith({ cases: [], trucks: [], plans: [p] });
  const res = parseBundle(ok);
  assert.equal(res.plans.length, 1);
  assert.ok(res.warnings.some(w => /unbekanntes Fahrzeug/.test(w)));
});
test('Ladeplan ohne fremde Verweise erzeugt keine Warnung', () => {
  const p = plan([P('pl1', 'own', 0, 0, 0)]);
  const ok = bundleWith({ cases: [own], trucks: [mkTruck()], plans: [p] });
  const res = parseBundle(ok);
  assert.deepEqual(res.warnings, []);
});
test('Verweis auf ein Bibliotheks-Case (lib-…) gilt als bekannt, keine Warnung', () => {
  const p = plan([P('pl1', 'lib-lakabaum-flach-bbm', 0, 0, 0)]);
  const ok = bundleWith({ cases: [], trucks: [mkTruck()], plans: [p] });
  const res = parseBundle(ok);
  assert.deepEqual(res.warnings, []);
});

// --- Daten-15: kaputte Felder werden gemeldet statt zu leerem Import zu werden ---

test('Bundle mit kaputtem cases-Feld (kein Array) wird als Fehler gemeldet', () => {
  const bad = '{"format":"truckload","version":1,"cases":"boom","trucks":[],"plans":[]}';
  assert.throws(() => parseBundle(bad), /Cases.*beschädigt/);
});
test('Bundle ganz ohne Daten wird als Fehler gemeldet, nicht als leerer Import', () => {
  const bad = bundleWith({ cases: [], trucks: [], plans: [] });
  assert.throws(() => parseBundle(bad), /enthält keine Daten/);
});

// --- Regression: altes Schema (V 0.5/V 0.6, ohne die neuen optionalen Felder) lädt weiter ---

test('Regression: Bundle im alten Schema ohne updatedAt/notes/color/Obergrenzen-Felder lädt unverändert', () => {
  const legacyCase = {
    id: 'legacy-case', name: 'Altes Case', content: '', category: 'Sonstiges',
    l: 80, w: 60, h: 50, weight: 42, tippable: false, stackable: true,
    // kein color, kein updatedAt, kein wheelH, kein layers, kein kind, kein maxTopLoad/stock
  };
  const legacyTruck = {
    id: 'legacy-truck', name: 'Alter Sattel', l: 1360, w: 248, h: 270, payload: 24000,
    // kein wheelArches, kein updatedAt
  };
  const legacyPlan = {
    id: 'legacy-plan', name: 'Alte Tour', truckId: 'legacy-truck',
    placements: [{ id: 'p1', caseId: 'legacy-case', x: 0, y: 0, z: 0, orientation: 'standing', rot: 0 }],
    // kein unplaced, kein notes, kein updatedAt
  };
  const legacy = JSON.stringify({ format: 'truckload', version: 1, cases: [legacyCase], trucks: [legacyTruck], plans: [legacyPlan] });
  const res = parseBundle(legacy);
  assert.equal(res.cases[0].id, 'legacy-case');
  assert.equal(res.trucks[0].id, 'legacy-truck');
  assert.equal(res.plans[0].unplaced.length, 0);
  assert.equal(res.plans[0].notes, '');
  assert.equal(res.plans[0].placements[0].id, 'p1');
});
