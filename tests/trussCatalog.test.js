import test from 'node:test';
import assert from 'node:assert/strict';
import { TRUSS_CATALOG, searchProfiles, profileById, pieceKg, kgPerM } from '../js/model/trussCatalog.js';
import { MAX_TRUSS_WIDTH } from '../js/model/truss.js';

test('Suche: Großschreibung und Leerzeichen sind egal', () => {
  const a = searchProfiles('fd34').map(p => p.id);
  const b = searchProfiles('FD 34').map(p => p.id);
  assert.deepEqual(a, b);
  assert.ok(a.includes('eurotruss-fd34'));
  assert.ok(a.length <= 12);
});
test('Suche: auch über Hersteller und Name', () => {
  assert.ok(searchProfiles('Eurotruss FD34').some(p => p.id === 'eurotruss-fd34'));
});
test('Suche: leer, ohne Treffer, Sonderzeichen', () => {
  assert.deepEqual(searchProfiles(''), []);
  assert.deepEqual(searchProfiles('   '), []);
  assert.deepEqual(searchProfiles('zzzz'), []);
  assert.deepEqual(searchProfiles('(*[\\'), []);
});
test('Suche: höchstens 12 Treffer, nach Name sortiert', () => {
  const r = searchProfiles('e');
  assert.ok(r.length <= 12);
  const names = r.map(p => p.name);
  assert.deepEqual(names, [...names].sort((x, y) => x.localeCompare(y)));
});
test('pieceKg: Länge im Katalog liefert den Katalogwert', () => {
  const p = profileById('eurotruss-fd34');
  const row = p.lengths.find(l => l.cm === 300);
  assert.deepEqual(pieceKg(p, 300), { kg: row.kg, art: row.art });
});
test('pieceKg: fehlende Länge wird aus dem Metergewicht berechnet', () => {
  const p = profileById('eurotruss-fd34');
  const r = pieceKg(p, 337);
  assert.equal(r.art, 'berechnet');
  assert.equal(r.kg, Math.round(kgPerM(p) * 3.37 * 10) / 10);
  assert.ok(r.kg > 0);
});
test('pieceKg: Profil ohne Längen liefert 0 und geschaetzt', () => {
  assert.deepEqual(pieceKg({ id: 'x', lengths: [] }, 300), { kg: 0, art: 'geschaetzt' });
});
test('Katalog: keine Breite über dem Wagenlimit, keine doppelten IDs', () => {
  const ids = TRUSS_CATALOG.profiles.map(p => p.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const p of TRUSS_CATALOG.profiles) {
    assert.ok(p.width <= 40 && p.width <= MAX_TRUSS_WIDTH, p.id);
    assert.match(p.id, /^[a-z0-9-]+$/);
    assert.ok([2, 3, 4].includes(p.punkte), p.id);
  }
});
test('Katalog: Schätzung hat ein existierendes Vergleichsprofil oder kg 0', () => {
  for (const p of TRUSS_CATALOG.profiles) for (const l of p.lengths) {
    if (l.art !== 'geschaetzt') continue;
    assert.ok(l.kg === 0 || (l.vergleich && profileById(l.vergleich)), `${p.id} ${l.cm}`);
  }
});
test('profileById: unbekannte ID liefert undefined', () => {
  assert.equal(profileById('gibt-es-nicht'), undefined);
});

test('Prolyte: 31 Profile, davon 10 von Prolyte', () => {
  assert.equal(TRUSS_CATALOG.profiles.length, 31);
  assert.equal(TRUSS_CATALOG.profiles.filter(p => p.hersteller === 'Prolyte').length, 10);
});
test('Prolyte: alle Längen mit Herstellergewicht, ohne Vergleich', () => {
  for (const p of TRUSS_CATALOG.profiles.filter(q => q.hersteller === 'Prolyte')) for (const l of p.lengths) {
    assert.equal(l.art, 'hersteller', `${p.id} ${l.cm}`);
    assert.ok(!('vergleich' in l), `${p.id} ${l.cm}`);
  }
});
test('Prolyte: H40L 300 cm ist 8,7 kg laut Hersteller', () => {
  assert.deepEqual(pieceKg(profileById('prolyte-h40l'), 300), { kg: 8.7, art: 'hersteller' });
});
test('Prolyte: H40D hat 13 Längen, 25 cm 2,35 kg, 500 cm 24,4 kg', () => {
  const p = profileById('prolyte-h40d');
  assert.equal(p.lengths.length, 13);
  assert.equal(p.lengths.find(l => l.cm === 25).kg, 2.35);
  assert.equal(p.lengths.find(l => l.cm === 500).kg, 24.4);
});
test('Prolyte: S36V ohne 160 cm, 300 cm 31,6 kg, 160 cm berechnet', () => {
  const p = profileById('prolyte-s36v');
  assert.ok(p);
  assert.equal(p.punkte, 4);
  assert.equal(p.width, 36);
  assert.ok(!p.lengths.some(l => l.cm === 160));
  assert.equal(p.lengths.find(l => l.cm === 300).kg, 31.6);
  assert.equal(pieceKg(p, 160).art, 'berechnet');
});
test('Prolyte: H30V 100 cm ist 7,0 kg', () => {
  assert.equal(profileById('prolyte-h30v').lengths.find(l => l.cm === 100).kg, 7.0);
});

const EUROTRUSS_KG_M = { fd32: 3, hd32: 3.8, fd33: 4.4, hd33: 5.5, hd22: 4.3, hd24: 5, fd34: 6, hd34: 7.5, hd44: 8.1, hdx45: 11 };
// Gegen das ungerundete Produkt: bei exakten Hälften (z. B. 2,25) ist Auf- wie Abrunden zulässig.
test('Eurotruss: alle Längen aus dem Katalog-Metergewicht berechnet', () => {
  for (const [k, kgM] of Object.entries(EUROTRUSS_KG_M)) {
    const p = profileById(`eurotruss-${k}`);
    assert.ok(p, k);
    for (const l of p.lengths) {
      assert.equal(l.art, 'berechnet', `${k} ${l.cm}`);
      assert.ok(Math.abs(l.kg - kgM * l.cm / 100) <= 0.05 + 1e-9, `${k} ${l.cm}: ${l.kg}`);
    }
  }
});
test('Eurotruss: Stichproben FD34, HD44, HD32, HDX45', () => {
  const kg = (id, cm) => profileById(id).lengths.find(l => l.cm === cm).kg;
  assert.equal(kg('eurotruss-fd34', 300), 18);
  assert.equal(kg('eurotruss-hd44', 400), 32.4);
  assert.equal(kg('eurotruss-hd32', 100), 3.8);
  assert.equal(kg('eurotruss-hdx45', 400), 44);
});
