// Gespeicherte und exportierte Daten bleiben sprachfrei (#42): Die Sprache betrifft nur die
// Oberfläche. Erzeugte Namen entstehen beim Anlegen (in der damaligen Sprache) und werden
// danach nie neu übersetzt; Gewerke bleiben deutsch.
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { setLang } from '../js/i18n/i18n.js';
import { exportBundle, parseBundle } from '../js/store/io.js';
import { addLkw } from '../js/model/lkw.js';
import { dollyStackCase } from '../js/model/audioDolly.js';
import { mkCase, mkTruck, plan, P } from './fixtures.js';

afterEach(() => setLang('de'));

const NOW = new Date('2026-10-28T10:00:00Z');
const ohneStempel = text => {
  const j = JSON.parse(text);
  delete j.exportedAt;
  return j;
};

// Zustand unter Deutsch aufbauen: Gewerk „Licht“, Mehr-LKW-Plan mit erzeugtem LKW-Namen,
// Dolly-Stack mit erzeugtem Namen.
function zustandDe() {
  setLang('de');
  const licht = mkCase('licht', 120, 60, 60, { category: 'Licht' });
  const dolly = dollyStackCase(mkCase('k2', 80, 60, 50, { name: 'K2', category: 'Licht' }), 4);
  const truck = mkTruck();
  let n = 0;
  const base = plan([P('pl1', 'licht', 0, 0, 0)]);
  const multi = addLkw(base, {}, () => `id${++n}`);
  return { cases: [licht, dolly], trucks: [truck], plans: [multi] };
}

test('Export unter Englisch ist identisch zum Export unter Deutsch', () => {
  const zustand = zustandDe();
  const namen = zustand.plans[0].lkws.map(l => l.name);
  assert.deepEqual(namen, ['LKW 1', 'LKW 2'], 'erzeugte Namen entstehen auf Deutsch');
  assert.match(zustand.cases[1].name, /\(auf Dolly\)$/);
  setLang('de');
  const de = ohneStempel(exportBundle(zustand, NOW));
  setLang('en');
  const en = ohneStempel(exportBundle(zustand, NOW));
  assert.deepEqual(en, de);
  assert.equal(en.cases[0].category, 'Licht', 'Gewerk bleibt deutsch');
  assert.deepEqual(en.plans[0].lkws.map(l => l.name), ['LKW 1', 'LKW 2']);
});

// Fixture wie in tests/io.test.js (Regression altes Schema), ohne neue Felder.
const altesBundle = JSON.stringify({
  format: 'truckload', version: 1,
  cases: [{ id: 'legacy-case', name: 'Altes Case', content: '', category: 'Sonstiges', l: 80, w: 60, h: 50, weight: 42, tippable: false, stackable: true }],
  trucks: [{ id: 'legacy-truck', name: 'Alter Sattel', l: 1360, w: 248, h: 270, payload: 24000 }],
  plans: [{ id: 'legacy-plan', name: 'Alte Tour', truckId: 'legacy-truck',
    placements: [{ id: 'p1', caseId: 'legacy-case', x: 0, y: 0, z: 0, orientation: 'standing', rot: 0 }] }],
});

test('Sicherung im alten Schema lädt unter Englisch mit denselben Datensätzen wie unter Deutsch', () => {
  setLang('de');
  const de = parseBundle(altesBundle);
  setLang('en');
  const en = parseBundle(altesBundle);
  assert.deepEqual(en, de);
  assert.equal(en.cases[0].name, 'Altes Case');
});
