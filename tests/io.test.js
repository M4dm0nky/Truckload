import test from 'node:test';
import assert from 'node:assert/strict';
import { exportBundle, parseBundle, checkCase, checkTruck, checkPlan, mergeById, backupFileName, preImportBackupFileName, normalizeCase } from '../js/store/io.js';
import { CASE_LIMITS, MAX_LABEL, NAME_MAX, COORD_MAX } from '../js/model/limits.js';
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

// --- Daten-10: Name der stillen Sicherung, die app.js vor jedem Import anlegt ---
test('Dateiname der Vor-Import-Sicherung: wie backupFileName, kenntlich gemacht', () => {
  const now = new Date('2026-09-21T10:00:00Z');
  assert.equal(preImportBackupFileName(now), 'truckload-backup-2026-09-21-vor-import.json');
  assert.equal(backupFileName(now), 'truckload-backup-2026-09-21.json', 'die reguläre Sicherung bleibt unverändert');
});

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
test('Altdaten: Platzierung ohne rot lädt, der Export/Import-Kreislauf gelingt und rot ist 0', () => {
  const old = { id: 'pl1', caseId: 'own', x: 0, y: 0, z: 0, orientation: 'standing' };
  const p = plan([old]);
  const first = parseBundle(bundleWith({ cases: [own], trucks: [], plans: [p] }));
  assert.equal(first.plans[0].placements[0].rot, 0);
  const again = parseBundle(exportBundle({ cases: [own], trucks: [], plans: first.plans }));
  assert.equal(again.plans[0].placements[0].rot, 0);
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
// Befund „eine Sicherung aus V 0.5 oder V 0.6 kann heute komplett unlesbar sein“ (B4): bis
// V0.6 prüfte der Editor nicht, ob die Rollenhöhe die Case-Höhe erreicht/übersteigt – ein
// reparierbarer Wert, keine unlesbare Datei. parseBundle wählt die Rollen ab, statt die
// gesamte Datei zu verwerfen, und meldet die Reparatur.
test('Case mit wheelH >= h wird repariert (Rollen abgewählt) statt abgelehnt', () => {
  const bundle = bundleWith({ cases: [{ ...own, wheelH: own.h, wheels: true }], trucks: [], plans: [] });
  const res = parseBundle(bundle);
  assert.equal(res.cases[0].wheelH, 0);
  assert.equal(res.cases[0].wheels, false);
  assert.equal(res.repairs.length, 1);
  assert.match(res.repairs[0], /1 Case.*Rollenhöhe/);
  assert.match(res.repairs[0], /Rollenhöhe auf 0 gesetzt und Rollen abgewählt/, 'nennt Rollenhöhe UND die Rollen-Angabe (wheels)');
});
// Rückbau-Beleg für die Reparatur oben: der bestehende Test „Case mit negativem wheelH wird
// abgelehnt“ (Zeile 69) zeigt bereits, dass ein außerhalb des gültigen Bereichs liegender
// Wert – kein bekannter Altwert, sondern echter Unsinn in der Datei – weiterhin unrepariert
// abgelehnt wird.
test('Case ohne wheelH wird akzeptiert (Fallback)', () => {
  const res = parseBundle(bundleWith({ cases: [own], trucks: [], plans: [] }));
  assert.equal(res.cases[0].wheelH, undefined);
});
test('Case mit gültigem wheelH wird akzeptiert', () => {
  const res = parseBundle(bundleWith({ cases: [{ ...own, wheelH: 0 }], trucks: [], plans: [] }));
  assert.equal(res.cases[0].wheelH, 0);
});
// Die Reparatur ist kein Freifahrtschein: ein reparierbarer Wert neben einem echten
// Regelverstoß im selben Bundle lässt die Datei weiterhin komplett scheitern – Alles-oder-
// nichts gilt unverändert für jeden Fall außer den beiden reparierten.
test('Reparierbares wheelH neben einem echten Regelverstoß: die ganze Datei wird trotzdem verworfen', () => {
  const bad = bundleWith({
    cases: [{ ...own, wheelH: own.h }, { ...mkCase('kaputt', 1, 1, 1), maxTopLoad: 'viel' }],
    trucks: [], plans: [],
  });
  assert.throws(() => parseBundle(bad), /ungültige Eigenschaften/);
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

test('Case mit standing:true und width 80 cm wird akzeptiert (Pre-Rig-Traverse)', () => {
  const truss = { ...own, kind: 'truss', truss: { length: 240, width: 80, count: 1, standing: true, height: 103 } };
  const res = parseBundle(bundleWith({ cases: [truss], trucks: [], plans: [] }));
  assert.deepEqual(res.cases[0].truss, { length: 240, width: 80, count: 1, standing: true, height: 103 });
});
test('Case mit standing:true aber width 250 cm wird trotzdem abgelehnt (Grenze bei 200)', () => {
  const bad = bundleWith({ cases: [{ ...own, kind: 'truss', truss: { length: 240, width: 250, count: 1, standing: true, height: 103 } }], trucks: [], plans: [] });
  assert.throws(() => parseBundle(bad), /Traversenwagen/);
});
test('Case mit standing:true ohne height wird abgelehnt', () => {
  const bad = bundleWith({ cases: [{ ...own, kind: 'truss', truss: { length: 240, width: 80, count: 1, standing: true } }], trucks: [], plans: [] });
  assert.throws(() => parseBundle(bad), /Traversenwagen/);
});

// normalizeCase() läuft beim Datei-Import IMMER nach checkCase() (das width > 40 schon
// ablehnt, s. o.) – aber auch direkt beim App-Start über repo.normalizeOwnCases(), OHNE
// vorherige checkCase-Prüfung, für jedes eigene gespeicherte Case. Ein vor Einführung der
// 40-cm-Grenze gespeichertes eigenes Traversen-Case darf normalizeCase() dort nicht zum
// Werfen bringen (Fix-Runde 1, [blocking]: sonst fängt js/app.js den Fehler ab, verwirft
// über loadAllFallback() die GESAMTE eigene Bibliothek – alle Cases, Fahrzeuge, Ladepläne –
// und zeigt „Speicher nicht verfügbar“, obwohl nur ein einziges Case veraltet ist).
test('normalizeCase: Traversenbreite über der Grenze wirft nicht, behält die gespeicherten Maße', () => {
  const stale = {
    id: 'old-wide-truss', name: 'Alter breiter Wagen', builtin: false, kind: 'truss',
    truss: { length: 300, width: 45, count: 2 }, // vor MAX_TRUSS_WIDTH gespeichert
    l: 300, w: 90, h: 62, weight: 80, tippable: false, wheelH: 12, dimsInclWheels: true,
  };
  const normalized = normalizeCase(stale);
  assert.equal(normalized.l, stale.l);
  assert.equal(normalized.w, stale.w);
  assert.equal(normalized.h, stale.h);
  assert.equal(normalized.wheelH, 0);
  assert.equal(normalized.tippable, false);
});

// Befund „eine Sicherung aus V 0.5 oder V 0.6 kann heute komplett unlesbar sein“ (B3): der
// Wizard erlaubte bis V0.6 Beschriftungen bis 50 Zeichen, MAX_LABEL ist 40 – ein
// reparierbarer Wert (kürzen), keine unlesbare Datei. parseBundle kürzt statt zu verwerfen
// und meldet die Reparatur.
test('Ladeplan mit 50-Zeichen-Label (Wizard-Vorgabe bis V0.6) wird gekürzt statt abgelehnt', () => {
  const p = plan([P('pl1', 'own', 0, 0, 0, { label: 'x'.repeat(50) })]);
  const bundle = bundleWith({ cases: [own], trucks: [], plans: [p] });
  const res = parseBundle(bundle);
  assert.equal(res.plans[0].placements[0].label, 'x'.repeat(MAX_LABEL));
  assert.equal(res.repairs.length, 1);
  assert.match(res.repairs[0], /1 Beschriftung.*40 Zeichen/);
});
// Rückbau-Beleg: eine Beschriftung, die kein String ist (echter Unsinn, kein bekannter
// Altwert), bleibt weiterhin Alles-oder-nichts – repairLabel greift nur bei zu langen
// Zeichenketten, nicht bei falschem Typ.
test('Ladeplan mit nicht-zeichenkettigem Label bleibt abgelehnt', () => {
  const p = plan([P('pl1', 'own', 0, 0, 0, { label: 123 })]);
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
test('Ablage mit zu langem Label wird gekürzt statt abgelehnt', () => {
  const p = { ...plan([]), unplaced: [{ id: 'u1', caseId: 'own', label: 'x'.repeat(50) }] };
  const bundle = bundleWith({ cases: [own], trucks: [], plans: [p] });
  const res = parseBundle(bundle);
  assert.equal(res.plans[0].unplaced[0].label, 'x'.repeat(MAX_LABEL));
  assert.equal(res.repairs.length, 1);
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

test('Ladeplan mit numerischem updatedAt wird abgelehnt (Absturzpfad beim Laden)', () => {
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
test('Case mit riesigem Gewicht (100 Tonnen) wird übernommen und gemeldet (Warnung statt Abbruch)', () => {
  const res = parseBundle(bundleWith({ cases: [{ ...own, weight: 100000 }], trucks: [], plans: [] }));
  assert.equal(res.cases[0].weight, 100000);
  assert.equal(res.overLimit[0].field, 'weight');
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

// --- Daten-20: lib-… IDs mit builtin:true werden beim Import verworfen ---

test('Ein Case mit lib-…-ID und builtin:true wird beim Import verworfen (verdeckt sonst die Bibliothek)', () => {
  const fakeLib = { ...mkCase('lib-lakabaum-flach-bbm', 10, 10, 10), builtin: true };
  const bad = bundleWith({ cases: [own, fakeLib], trucks: [], plans: [] });
  const res = parseBundle(bad);
  assert.deepEqual(res.cases.map(c => c.id), ['own']);
});

// --- Daten-21: Verweise auf unbekannte Cases/Fahrzeuge werden strukturiert gemeldet ---
// parseBundle liefert nur die IDs (`unknownRefs`); den Warntext und den Abgleich gegen den
// lokalen Bestand erledigt js/app/importExport.js (tests/app-importexport.test.js).

test('Ladeplan mit Verweis auf unbekanntes Case wird gemeldet, aber importiert', () => {
  const p = plan([P('pl1', 'geist-case-123', 0, 0, 0)]);
  const res = parseBundle(bundleWith({ cases: [], trucks: [mkTruck()], plans: [p] }));
  assert.equal(res.plans.length, 1);
  assert.equal('warnings' in res, false);
  assert.deepEqual(res.unknownRefs, [{ planId: p.id, plan: p.name, cases: ['geist-case-123'], truck: null }]);
});
test('Ladeplan mit Verweis auf ein Standard-Case (preset-) erzeugt keinen Eintrag', () => {
  const p = plan([P('pl1', 'preset-k2', 0, 0, 0)]);
  const res = parseBundle(bundleWith({ cases: [], trucks: [mkTruck()], plans: [p] }));
  assert.equal(res.plans.length, 1);
  assert.deepEqual(res.unknownRefs, []);
});
test('Ladeplan mit Verweis auf ein Standard-Case und ein unbekanntes nennt nur das unbekannte (je Stück)', () => {
  const p = plan([P('pl1', 'preset-k2', 0, 0, 0), P('pl2', 'gibt-es-nicht', 0, 0, 0), P('pl3', 'gibt-es-nicht', 0, 0, 0)]);
  const res = parseBundle(bundleWith({ cases: [], trucks: [], plans: [p] }));
  assert.deepEqual(res.unknownRefs[0].cases, ['gibt-es-nicht', 'gibt-es-nicht']);
});
test('Ladeplan mit Verweis auf unbekanntes Fahrzeug wird gemeldet, aber importiert', () => {
  const p = { ...plan([]), truckId: 'geist-truck-123' };
  const res = parseBundle(bundleWith({ cases: [], trucks: [], plans: [p] }));
  assert.equal(res.plans.length, 1);
  assert.deepEqual(res.unknownRefs, [{ planId: p.id, plan: p.name, cases: [], truck: 'geist-truck-123' }]);
});
test('Ladeplan ohne fremde Verweise erzeugt keinen Eintrag', () => {
  const p = plan([P('pl1', 'own', 0, 0, 0)]);
  const res = parseBundle(bundleWith({ cases: [own], trucks: [mkTruck()], plans: [p] }));
  assert.deepEqual(res.unknownRefs, []);
});
test('Verweis auf ein Bibliotheks-Case (lib-…) gilt als bekannt, kein Eintrag', () => {
  const p = plan([P('pl1', 'lib-lakabaum-flach-bbm', 0, 0, 0)]);
  const res = parseBundle(bundleWith({ cases: [], trucks: [mkTruck()], plans: [p] }));
  assert.deepEqual(res.unknownRefs, []);
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

// --- Lage/Tippen je Stück (Task 1): placementOk/unplacedOk akzeptieren layers/tipped ---

test('Placement mit gültigen layers/tipped wird akzeptiert', () => {
  const p = P('a', 'own', 0, 0, 0, { layers: [1, 2], tipped: true });
  const bad = bundleWith({ cases: [own], trucks: [mkTruck()], plans: [{ ...plan([p]), truckId: 't' }] });
  const res = parseBundle(bad);
  assert.deepEqual(res.plans[0].placements[0].layers, [1, 2]);
  assert.equal(res.plans[0].placements[0].tipped, true);
});
test('Placement ohne layers/tipped wird akzeptiert (Regression, altes Schema)', () => {
  const p = P('a', 'own', 0, 0, 0);
  const bad = bundleWith({ cases: [own], trucks: [mkTruck()], plans: [{ ...plan([p]), truckId: 't' }] });
  const res = parseBundle(bad);
  assert.equal(res.plans[0].placements[0].layers, undefined);
  assert.equal(res.plans[0].placements[0].tipped, undefined);
});
test('Placement mit leeren layers wird abgelehnt', () => {
  const p = P('a', 'own', 0, 0, 0, { layers: [] });
  const bad = bundleWith({ cases: [own], trucks: [mkTruck()], plans: [{ ...plan([p]), truckId: 't' }] });
  assert.throws(() => parseBundle(bad), /ungültige Platzierungen/);
});
test('Placement mit layers außerhalb 1-4 wird abgelehnt', () => {
  const p = P('a', 'own', 0, 0, 0, { layers: [5] });
  const bad = bundleWith({ cases: [own], trucks: [mkTruck()], plans: [{ ...plan([p]), truckId: 't' }] });
  assert.throws(() => parseBundle(bad), /ungültige Platzierungen/);
});
test('Placement mit doppelten layers wird abgelehnt', () => {
  const p = P('a', 'own', 0, 0, 0, { layers: [1, 1] });
  const bad = bundleWith({ cases: [own], trucks: [mkTruck()], plans: [{ ...plan([p]), truckId: 't' }] });
  assert.throws(() => parseBundle(bad), /ungültige Platzierungen/);
});
test('Placement mit tipped als Nicht-Boolean wird abgelehnt', () => {
  const p = P('a', 'own', 0, 0, 0, { tipped: 'ja' });
  const bad = bundleWith({ cases: [own], trucks: [mkTruck()], plans: [{ ...plan([p]), truckId: 't' }] });
  assert.throws(() => parseBundle(bad), /ungültige Platzierungen/);
});
test('Ablage-Eintrag mit gültigen layers/tipped wird akzeptiert', () => {
  const bad = bundleWith({ cases: [own], trucks: [mkTruck()],
    plans: [{ ...plan([], [{ id: 'u1', caseId: 'own', layers: [1], tipped: false }]), truckId: 't' }] });
  const res = parseBundle(bad);
  assert.deepEqual(res.plans[0].unplaced[0].layers, [1]);
  assert.equal(res.plans[0].unplaced[0].tipped, false);
});
test('Ablage-Eintrag mit ungültigen layers wird abgelehnt', () => {
  const bad = bundleWith({ cases: [own], trucks: [mkTruck()],
    plans: [{ ...plan([], [{ id: 'u1', caseId: 'own', layers: [0] }]), truckId: 't' }] });
  assert.throws(() => parseBundle(bad), /ungültige Platzierungen/);
});

test('Import: Plan ohne packOrder (altes Schema) lädt unverändert', () => {
  const text = exportBundle({ cases: [], trucks: [], plans: [plan([])] });
  const b = parseBundle(text);
  assert.equal(b.plans[0].packOrder, undefined);
});

test('Import: packOrder volume/count erlaubt, anderer Wert wird abgewiesen', () => {
  for (const packOrder of ['volume', 'count']) {
    const b = parseBundle(exportBundle({ cases: [], trucks: [], plans: [{ ...plan([]), packOrder }] }));
    assert.equal(b.plans[0].packOrder, packOrder);
  }
  try {
    parseBundle(exportBundle({ cases: [], trucks: [], plans: [{ ...plan([]), packOrder: 'x' }] }));
    assert.fail('Sollte einen Fehler werfen');
  } catch (err) {
    assert.match(err.message, /^Ladeplan „.*“ hat eine unbekannte Pack-Reihenfolge\.$/);
  }
});

// Pack-Regeln (Spec 2026-09-30)
test('Import: Plan mit gültigen packRules und Stücken mit group', () => {
  const p = { ...plan([P('a', 'x', 0, 0, 0, { group: 'Motoren' })], [{ id: 'u', caseId: 'x', group: 'FOH' }]),
    packRules: [{ by: 'group', value: 'Motoren', pos: 'last' }, { by: 'volume' }] };
  const b = parseBundle(exportBundle({ cases: [], trucks: [], plans: [p] }));
  assert.deepEqual(b.plans[0].packRules, p.packRules);
  assert.equal(b.plans[0].placements[0].group, 'Motoren');
  assert.equal(b.plans[0].unplaced[0].group, 'FOH');
});

test('Import: kaputte packRules oder group werden mit Meldung abgelehnt', () => {
  const bad = [
    { ...plan([]), packRules: [{ by: 'foo' }] },
    { ...plan([]), packRules: 'volume' },
    { ...plan([]), packRules: Array.from({ length: 21 }, (_, i) => ({ by: 'group', value: `g${i}`, pos: 'last' })) },
  ];
  for (const p of bad) assert.throws(() => parseBundle(exportBundle({ cases: [], trucks: [], plans: [p] })), /Pack-Regeln/);
  const badGroup = plan([P('a', 'x', 0, 0, 0, { group: 'x'.repeat(41) })]);
  assert.throws(() => parseBundle(exportBundle({ cases: [], trucks: [], plans: [badGroup] })), /ungültige Platzierungen/);
});

test('Import: Regelsets kommen mit, kaputte werden abgelehnt, Datei ohne ruleSets (altes Schema) geht', () => {
  const rs = { id: 'rs1', name: 'Tour-Standard', rules: [{ by: 'truss', pos: 'first' }], updatedAt: '2026-09-30T10:00:00Z' };
  const b = parseBundle(exportBundle({ cases: [], trucks: [], plans: [], ruleSets: [rs] }));
  assert.deepEqual(b.ruleSets, [rs], 'eine Datei nur mit Regelsets ist nicht „leer“');
  assert.throws(() => parseBundle(exportBundle({ cases: [], trucks: [], plans: [], ruleSets: [{ ...rs, rules: [{ by: 'x' }] }] })), /Regelset/);
  assert.throws(() => parseBundle(exportBundle({ cases: [], trucks: [], plans: [], ruleSets: [{ ...rs, name: '' }] })), /Regelset/);
  const old = JSON.parse(exportBundle({ cases: [], trucks: [], plans: [plan([])] }));
  delete old.ruleSets;
  assert.deepEqual(parseBundle(JSON.stringify(old)).ruleSets, []);
});

test('Import: mixTop optional boolean in Plan und Regelset, anderes wird abgelehnt', () => {
  const b = parseBundle(exportBundle({ cases: [], trucks: [], plans: [{ ...plan([]), mixTop: true }],
    ruleSets: [{ id: 'r', name: 'X', rules: [], mixTop: true }] }));
  assert.equal(b.plans[0].mixTop, true);
  assert.equal(b.ruleSets[0].mixTop, true);
  assert.throws(() => parseBundle(exportBundle({ cases: [], trucks: [], plans: [{ ...plan([]), mixTop: 'ja' }] })), /Deckschicht/);
  assert.throws(() => parseBundle(exportBundle({ cases: [], trucks: [], plans: [], ruleSets: [{ id: 'r', name: 'X', rules: [], mixTop: 1 }] })), /Regelset/);
  const old = parseBundle(exportBundle({ cases: [], trucks: [], plans: [plan([])] }));
  assert.equal(old.plans[0].mixTop, undefined, 'altes Schema ohne Feld');
});

// Alt-Datensatz eines Dolly-Stacks (vor kind/unitH, ID noch in der Form vor dem ID-Fix): beim
// Laden/Import ergänzt normalizeCase() die Darstellungsfelder, Maße bleiben unverändert.
test('normalizeCase: alter Dolly-Stack ohne kind wird zum Lautsprecher, Tiefe auf Dolly-Stufe', () => {
  const old = mkCase('preset-k2-dolly-2', 138, 40, 70, { name: 'L-Acoustics K2 2er (auf Dolly)', category: 'Ton', weight: 127, wheelH: 18, dimsInclWheels: false, layers: [1] });
  const c = normalizeCase(old);
  assert.equal(c.kind, 'speaker');
  assert.equal(c.unitH, 35);
  assert.equal(c.speakerType, 'top');
  assert.deepEqual([c.l, c.w, c.h, c.weight, c.unitD], [138, 60, 70, 127, 40]);
});

// --- Materialverwaltung (Task 2) ---

test('Materialbestand: bearbeitete Firmen-Vorlage (lib-ID, builtin:false) überlebt Sicherung und Import', () => {
  const over = { id: 'lib-k1-cab', builtin: false, source: 'liste', company: 'CAB', name: 'K1 geändert', category: 'Ton', l: 100, w: 60, h: 80, weight: 40 };
  const text = exportBundle({ cases: [over], trucks: [], plans: [] });
  const { cases } = parseBundle(text);
  assert.equal(cases.length, 1);
  assert.equal(cases[0].id, 'lib-k1-cab');
  assert.equal(cases[0].name, 'K1 geändert');
  assert.equal(cases[0].company, 'CAB');
});
test('Materialbestand: mitgelieferte Einträge (builtin:true) bleiben beim Import ausgefiltert', () => {
  const text = JSON.stringify({ format: 'truckload', version: 1, cases: [
    { id: 'lib-x', builtin: true, name: 'X', l: 1, w: 1, h: 1, weight: 0 },
    { id: 'preset-y', builtin: false, name: 'Y', l: 1, w: 1, h: 1, weight: 0 },
    { id: 'u1', name: 'Z', l: 1, w: 1, h: 1, weight: 0 }] });
  assert.deepEqual(parseBundle(text).cases.map(c => c.id), ['u1']);
});
test('checkCase: company/legacy/onlyInPlan werden geprüft, fehlen darf jedes (altes Schema)', () => {
  const base = { id: 'a', name: 'A', l: 1, w: 1, h: 1, weight: 0 };
  checkCase(base);
  checkCase({ ...base, company: 'CAB', legacy: true, onlyInPlan: true });
  assert.throws(() => checkCase({ ...base, company: 5 }));
  assert.throws(() => checkCase({ ...base, onlyInPlan: 'ja' }));
});

// --- Grenzen beim Import (Abschluss Teil 1, Punkt 1.2) ---

const nameOf = n => 'N'.repeat(n);

test('Casename: genau NAME_MAX Zeichen gültig, eines mehr abgelehnt', () => {
  assert.doesNotThrow(() => checkCase({ ...own, name: nameOf(NAME_MAX) }));
  assert.throws(() => checkCase({ ...own, name: nameOf(NAME_MAX + 1) }), /Name.*zu lang/);
});
test('Fahrzeugname: genau NAME_MAX Zeichen gültig, eines mehr abgelehnt', () => {
  assert.doesNotThrow(() => checkTruck({ ...mkTruck(), name: nameOf(NAME_MAX) }));
  assert.throws(() => checkTruck({ ...mkTruck(), name: nameOf(NAME_MAX + 1) }), /Name.*zu lang/);
});
test('Planname: genau NAME_MAX Zeichen gültig, eines mehr abgelehnt (checkPlan)', () => {
  assert.doesNotThrow(() => checkPlan({ ...plan([]), name: nameOf(NAME_MAX) }));
  assert.throws(() => checkPlan({ ...plan([]), name: nameOf(NAME_MAX + 1) }), /Name.*zu lang/);
});
test('Planname über NAME_MAX aus einer älteren Sicherung wird gekürzt und gemeldet statt die Datei zu verwerfen (eigene Entscheidung)', () => {
  // Umbenennen und „Kopie“ hatten früher keine Grenze; die eigene Sicherung darf deshalb nicht
  // unimportierbar sein.
  const long = { ...plan([]), name: nameOf(NAME_MAX + 6) };
  const res = parseBundle(bundleWith({ cases: [], trucks: [mkTruck()], plans: [long] }));
  assert.equal(res.plans[0].name, nameOf(NAME_MAX));
  assert.equal(res.repairs.length, 1);
  assert.match(res.repairs[0], /1 Ladeplan.*Name.*gekürzt/);
});
test('Platzierungskoordinaten: bis COORD_MAX gültig, knapp darüber abgelehnt (x, y, z, auch negativ)', () => {
  for (const k of ['x', 'y', 'z']) {
    assert.doesNotThrow(() => checkPlan(plan([P('a', 'own', 0, 0, 0, { [k]: COORD_MAX })])), k);
    assert.doesNotThrow(() => checkPlan(plan([P('a', 'own', 0, 0, 0, { [k]: -COORD_MAX })])), k);
    assert.throws(() => checkPlan(plan([P('a', 'own', 0, 0, 0, { [k]: COORD_MAX + 1 })])), /Platzierungen/, k);
    assert.throws(() => checkPlan(plan([P('a', 'own', 0, 0, 0, { [k]: -COORD_MAX - 1 })])), /Platzierungen/, k);
  }
});
test('Doppelte IDs innerhalb einer Liste lehnen die Datei ab (Cases, Fahrzeuge, Pläne, Regelsets)', () => {
  const rs = { id: 'r1', name: 'Set', rules: [] };
  assert.throws(() => parseBundle(bundleWith({ cases: [own, { ...own, name: 'Zweites' }], trucks: [], plans: [] })), /Cases.*doppelt|doppelte.*Case/i);
  assert.throws(() => parseBundle(bundleWith({ cases: [], trucks: [mkTruck(), mkTruck()], plans: [] })), /Fahrzeug.*doppelt|doppelte.*Fahrzeug/i);
  assert.throws(() => parseBundle(bundleWith({ cases: [], trucks: [mkTruck()], plans: [plan([]), plan([])] })), /Ladepl.*doppelt|doppelte.*Ladepl/i);
  assert.throws(() => parseBundle(bundleWith({ cases: [], trucks: [], plans: [], ruleSets: [rs, rs] })), /Regelset.*doppelt|doppelte.*Regelset/i);
  // dieselbe ID in VERSCHIEDENEN Listen ist normal
  assert.doesNotThrow(() => parseBundle(bundleWith({ cases: [{ ...own, id: 'x' }], trucks: [{ ...mkTruck(), id: 'x' }], plans: [] })));
});
test('Gewicht/Auflast/Bestand über der Grenze: Warnung statt Abbruch, Wert bleibt unverändert', () => {
  const heavy = { ...own, id: 'heavy', name: 'Schwer', weight: CASE_LIMITS.weight + 1, maxTopLoad: CASE_LIMITS.maxTopLoad + 5, stock: CASE_LIMITS.stock + 1 };
  const res = parseBundle(bundleWith({ cases: [heavy], trucks: [], plans: [] }));
  assert.equal(res.cases[0].weight, CASE_LIMITS.weight + 1);
  assert.equal(res.cases[0].maxTopLoad, CASE_LIMITS.maxTopLoad + 5);
  assert.equal(res.cases[0].stock, CASE_LIMITS.stock + 1);
  assert.deepEqual(res.overLimit, [
    { id: 'heavy', name: 'Schwer', field: 'weight', value: CASE_LIMITS.weight + 1, max: CASE_LIMITS.weight },
    { id: 'heavy', name: 'Schwer', field: 'maxTopLoad', value: CASE_LIMITS.maxTopLoad + 5, max: CASE_LIMITS.maxTopLoad },
    { id: 'heavy', name: 'Schwer', field: 'stock', value: CASE_LIMITS.stock + 1, max: CASE_LIMITS.stock },
  ]);
});
test('Gewicht/Auflast/Bestand genau an der Grenze: keine Warnung; negativ oder keine Zahl weiterhin abgelehnt', () => {
  const edge = { ...own, weight: CASE_LIMITS.weight, maxTopLoad: CASE_LIMITS.maxTopLoad, stock: CASE_LIMITS.stock };
  assert.deepEqual(parseBundle(bundleWith({ cases: [edge], trucks: [], plans: [] })).overLimit, []);
  assert.throws(() => checkCase({ ...own, weight: -1 }), /Gewicht/);
  assert.throws(() => checkCase({ ...own, stock: 'viel' }), /ungültige Eigenschaften/);
  assert.throws(() => checkCase({ ...own, maxTopLoad: -1 }), /ungültige Eigenschaften/);
});
test('Maße (l/w/h) über der Grenze lehnen weiterhin ab', () => {
  assert.throws(() => checkCase({ ...own, l: CASE_LIMITS.l + 1 }), /ungültige Maße/);
});
test('Regression: Sicherung im alten Schema (lange Namen bis 80, keine Koordinatenextreme) lädt unverändert', () => {
  const oldCase = { id: 'alt-c', name: nameOf(80), l: 80, w: 60, h: 50, weight: 42, tippable: false, stackable: true };
  const oldTruck = { id: 'alt-t', name: nameOf(80), l: 1360, w: 248, h: 270, payload: 24000 };
  const oldPlan = { id: 'alt-p', name: nameOf(80), truckId: 'alt-t', placements: [{ id: 'p1', caseId: 'alt-c', x: 1300, y: 240, z: 260, orientation: 'standing', rot: 0 }] };
  const res = parseBundle(bundleWith({ cases: [oldCase], trucks: [oldTruck], plans: [oldPlan] }));
  assert.equal(res.cases[0].name, oldCase.name);
  assert.equal(res.plans[0].name, oldPlan.name);
  assert.deepEqual(res.plans[0].placements[0].x, 1300);
  assert.deepEqual(res.repairs, []);
  assert.deepEqual(res.overLimit, []);
});
