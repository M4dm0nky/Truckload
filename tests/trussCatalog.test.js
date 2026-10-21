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
