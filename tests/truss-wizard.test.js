import test from 'node:test';
import assert from 'node:assert/strict';
import { buildWagonCaseType, classicSubmitError } from '../js/ui/truss-wizard.js';
import { trussDims, wagonWeight } from '../js/model/truss.js';
import { checkCase } from '../js/store/io.js';
import { applyStockTarget } from '../js/model/material.js';

// buildWagonCaseType() ist der pure Baustein hinter dem „Truss hinzufügen“-Dialog (Task 3,
// klassischer Zweig): baut denselben Case-Typ, den T() in js/data/preset-cases.js für die festen
// Vorlagen baut, nur mit builtin:false – rein funktional, keine DOM-/Store-Berührung.

test('buildWagonCaseType: Maße und Gewicht stimmen mit trussDims()/wagonWeight() überein', () => {
  const c = buildWagonCaseType('id-1', '34er', 400, 29, 8);
  const dims = trussDims({ length: 400, width: 29, count: 8 });
  assert.equal(c.l, dims.l);
  assert.equal(c.w, dims.w);
  assert.equal(c.h, dims.h);
  assert.equal(c.weight, wagonWeight(400, 29, 8));
});

test('buildWagonCaseType: ist kein Preset (builtin:false), im Gegensatz zu den mitgelieferten Vorlagen', () => {
  const c = buildWagonCaseType('id-2', '40er', 300, 40, 4);
  assert.equal(c.builtin, false);
  assert.equal(c.id, 'id-2');
});

test('buildWagonCaseType: nie tippbar, Traversenwagen-Schema (kind/truss)', () => {
  const c = buildWagonCaseType('id-3', '34er', 200, 29, 4);
  assert.equal(c.tippable, false);
  assert.equal(c.kind, 'truss');
  assert.deepEqual(c.truss, { length: 200, width: 29, count: 4 });
});

test('buildWagonCaseType: Name nennt Profil, Länge in Metern und Stückzahl', () => {
  const c = buildWagonCaseType('id-4', '34er', 400, 29, 8);
  assert.equal(c.name, 'Traversenwagen 34er 4 m (8 Stück)');
});

test('buildWagonCaseType: Ergebnis besteht checkCase() (gültiger, speicherbarer Case)', () => {
  const c = buildWagonCaseType('id-5', '34er', 400, 29, 8);
  assert.doesNotThrow(() => checkCase(c));
});

test('buildWagonCaseType: Stückzahl an der checkCase()-Obergrenze (12) ist noch gültig', () => {
  const c = buildWagonCaseType('id-6', '34er', 300, 29, 12);
  assert.doesNotThrow(() => checkCase(c));
  assert.ok(c.truss.count <= 12);
});

test('buildWagonCaseType: eigene Wagenbreite landet in truss.wagonW und in der Breite', () => {
  const c = buildWagonCaseType('id-w', '34er', 300, 29, 4, 70);
  assert.equal(c.truss.wagonW, 70);
  assert.equal(c.w, 70);
  assert.equal(checkCase(c), undefined);
});
test('buildWagonCaseType: ohne Wagenbreite kein wagonW-Feld', () => {
  const c = buildWagonCaseType('id-x', '34er', 300, 29, 4);
  assert.ok(!('wagonW' in c.truss));
});

test('Traversenwagen + Ablageziel: Firma landet am Case, checkCase akzeptiert es', () => {
  const c = applyStockTarget(buildWagonCaseType('id-f', '34er', 300, 29, 4), { inStock: true, company: 'CAB' });
  assert.equal(c.company, 'CAB');
  assert.equal(checkCase(c), undefined);
});

// --- Katalogprofil (Task 3) ---
import { profileById, searchProfiles } from '../js/model/trussCatalog.js';
import { wagonWeightFor, findMatchingWagon } from '../js/model/truss.js';
import { buildWagonCaseType as build, punkteLabel, originText, lengthButtons, profileHitLabel, profileHitsHtml, profileOriginLine } from '../js/ui/truss-wizard.js';

test('buildWagonCaseType mit Katalogprofil: profileId, Gewicht, Name, checkCase', () => {
  const p = profileById('eurotruss-fd34');
  const c = build('id-k', 'ignoriert', 300, p.width, 8, undefined, p);
  assert.equal(c.truss.profileId, 'eurotruss-fd34');
  assert.equal(c.weight, wagonWeightFor(p, 300, 8));
  assert.equal(c.name, 'Traversenwagen Eurotruss FD34 3 m (8 Stück)');
  assert.equal(checkCase(c), undefined);
});

test('buildWagonCaseType ohne Profil: unverändert, kein profileId', () => {
  const c = build('id-o', '34er (F34)', 300, 29, 8);
  assert.equal(c.name, 'Traversenwagen 34er (F34) 3 m (8 Stück)');
  assert.equal(c.weight, wagonWeight(300, 29, 8));
  assert.ok(!('profileId' in c.truss));
});

test('findMatchingWagon: Wagen mit Profil wird gefunden, ohne Profil nicht', () => {
  const p = profileById('eurotruss-fd34');
  const c = build('id-m', 'x', 300, p.width, 4, 60, p);
  const spec = { width: p.width, length: 300, count: 4, wagonW: 60, company: '', inStock: true };
  assert.equal(findMatchingWagon([c], { ...spec, profileId: p.id }), c);
  assert.equal(findMatchingWagon([c], spec), undefined);
});

test('punkteLabel', () => {
  assert.equal(punkteLabel(2), '2-Punkt');
  assert.equal(punkteLabel(3), '3-Punkt');
  assert.equal(punkteLabel(4), '4-Punkt');
});

test('originText: Herstellerangabe, berechnet, geschätzt mit Vergleichsprofil', () => {
  assert.equal(originText('hersteller'), 'Herstellerangabe');
  assert.equal(originText('berechnet'), 'aus Metergewicht berechnet');
  assert.match(originText('geschaetzt', 'eurotruss-hd33'), /^geschätzt \(Vergleich: .*HD33.*\)$/);
  assert.equal(originText('geschaetzt'), 'geschätzt');
});

test('lengthButtons: Label im deutschen Format, title mit Herkunft', () => {
  const p = profileById('eurotruss-fd34');
  const btns = lengthButtons(p);
  assert.equal(btns.length, p.lengths.length);
  for (const b of btns) {
    assert.match(b.label, /^[\d.,]+ m · [\d.,]+ kg$/);
    assert.ok(b.title.length > 0);
  }
  const l = p.lengths[0];
  assert.equal(btns[0].cm, l.cm);
  assert.equal(btns[0].label, `${(l.cm / 100).toLocaleString('de-DE', { maximumFractionDigits: 2 })} m · ${l.kg.toLocaleString('de-DE', { maximumFractionDigits: 1 })} kg`);
});

test('lengthButtons: unbekanntes Gewicht (0) erscheint ohne kg-Angabe', () => {
  const b = lengthButtons({ id: 'x', lengths: [{ cm: 100, kg: 0, art: 'geschaetzt' }] });
  assert.equal(b[0].label, '1 m · Gewicht unbekannt');
});

test('profileHitLabel und profileHitsHtml: Name, Hersteller, Punkte, Breite; maskiert', () => {
  const p = profileById('eurotruss-fd34');
  const t = profileHitLabel(p);
  assert.ok(t.includes('FD34') && t.includes('Eurotruss') && t.includes('4-Punkt') && t.includes('29'));
  const html = profileHitsHtml([{ ...p, name: '<img onerror=x>' }]);
  assert.ok(!html.includes('<img'));
  assert.equal(profileHitsHtml([]), '<p class="hint">Kein Profil gefunden.</p>');
  assert.ok(searchProfiles('fd34').length > 0);
});

test('profileOriginLine: Länge im Katalog nennt Herkunft, sonst berechnet', () => {
  const p = profileById('eurotruss-fd34');
  assert.equal(profileOriginLine(p, p.lengths[0].cm), `Gewicht: ${originText(p.lengths[0].art, p.lengths[0].vergleich)}`);
  assert.equal(profileOriginLine(p, 333), 'Gewicht: aus Metergewicht berechnet');
  assert.equal(profileOriginLine(null, 300), '');
});

import { minLengthFor } from '../js/ui/truss-wizard.js';
test('minLengthFor: ohne Profil 50, mit Profil min(50, kürzeste Katalog-Länge)', () => {
  assert.equal(minLengthFor(null), 50);
  assert.equal(minLengthFor({ lengths: [{ cm: 25, kg: 1, art: 'berechnet' }, { cm: 100, kg: 2, art: 'berechnet' }] }), 25);
  assert.equal(minLengthFor({ lengths: [{ cm: 100, kg: 2, art: 'berechnet' }] }), 50);
  assert.equal(minLengthFor({ lengths: [{ cm: 5, kg: 0, art: 'geschaetzt' }] }), 10);
  assert.equal(minLengthFor({ lengths: [] }), 50);
  const p = profileById('eurotruss-fd34');
  assert.equal(minLengthFor(p), Math.min(50, ...p.lengths.map(l => l.cm), 50) < 10 ? 10 : Math.min(50, ...p.lengths.map(l => l.cm)));
});

test('classicSubmitError: gültige Eingabe ergibt keine Meldung', () => {
  assert.equal(classicSubmitError({ total: 16, perWagon: 8, width: 29, wagonW: 60 }), '');
});

test('classicSubmitError: Stückzahl oder Stück je Wagen ≤ 0 nennt den Grund', () => {
  const m = 'Stückzahl und Stück je Wagen müssen größer als 0 sein.';
  assert.equal(classicSubmitError({ total: 0, perWagon: 8, width: 29, wagonW: 60 }), m);
  assert.equal(classicSubmitError({ total: 8, perWagon: 0, width: 29, wagonW: 60 }), m);
  assert.equal(classicSubmitError({ total: NaN, perWagon: 8, width: 29, wagonW: 60 }), m);
});

test('classicSubmitError: zu schmaler Wagen nennt die Meldung von trussDims', () => {
  assert.match(classicSubmitError({ total: 8, perWagon: 8, width: 29, wagonW: 40 }), /Wagenbreite 40 cm ist schmaler/);
});
