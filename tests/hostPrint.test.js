import test from 'node:test';
import assert from 'node:assert/strict';
import { druckeMitHost, druckTitel, createDruckSperre } from '../js/app/hostPrint.js';
import { pageRuleFor } from '../js/ui/print.js';

function ablauf({ rahmen = { kopf: '<k>', abschluss: '<a>', randUntenMm: 22 }, rahmenFehler = null, printFehler = null } = {}) {
  const log = [];
  const host = {
    druckRahmen: async (o) => { log.push(['rahmen', o]); if (rahmenFehler) throw new Error(rahmenFehler); return rahmen; },
    print: async (o) => { log.push(['print', o]); if (printFehler) throw new Error(printFehler); return { ok: true }; },
  };
  const deps = {
    host,
    einsetzen: (k, a) => { log.push(['einsetzen', k, a]); return () => log.push(['entfernen']); },
    setPage: (doc, rand) => log.push(['setPage', doc, rand]),
    clearPage: () => log.push(['clearPage']),
    zeigeFehler: (m) => log.push(['fehler', m]),
  };
  return { log, deps };
}

test('Ladeplan: Rahmen holen, einsetzen, Rand setzen, drucken, aufräumen', async () => {
  const { log, deps } = ablauf();
  await druckeMitHost({ ...deps, doc: 'plan', titel: 'Tour – 7,5 t' });
  assert.deepEqual(log, [
    ['rahmen', { doc: 'plan', titel: 'Tour – 7,5 t' }],
    ['einsetzen', '<k>', '<a>'],
    ['setPage', 'plan', 22],
    ['print', { doc: 'plan', titel: 'Tour – 7,5 t' }],
    ['clearPage'], ['entfernen'],
  ]);
});

test('Etiketten: kein Rahmen, kein Rand', async () => {
  const { log, deps } = ablauf();
  await druckeMitHost({ ...deps, doc: 'labels', titel: 'Tour' });
  assert.deepEqual(log, [['setPage', 'labels', null], ['print', { doc: 'labels', titel: 'Tour' }], ['clearPage']]);
});

test('druckRahmen scheitert: trotzdem drucken, ohne Rahmen', async () => {
  const { log, deps } = ablauf({ rahmenFehler: 'Kein Projekt offen.' });
  await druckeMitHost({ ...deps, doc: 'checklist', titel: 'Tour' });
  assert.deepEqual(log.map(e => e[0]), ['rahmen', 'setPage', 'print', 'clearPage']);
  assert.equal(log.find(e => e[0] === 'setPage')[2], null);
});

test('print scheitert: Fehler zeigen, trotzdem aufräumen', async () => {
  const { log, deps } = ablauf({ printFehler: 'PDF ging nicht' });
  await druckeMitHost({ ...deps, doc: 'plan', titel: 'Tour' });
  assert.deepEqual(log.slice(-3), [['fehler', 'PDF ging nicht'], ['clearPage'], ['entfernen']]);
});

test('druckTitel', () => {
  assert.equal(druckTitel('plan', { plan: { name: 'Tour' }, truck: { name: '7,5 t' } }), 'Tour – 7,5 t');
  assert.equal(druckTitel('labels', { plan: { name: 'Tour' }, truck: { name: '7,5 t' } }), 'Tour');
  assert.equal(druckTitel('checklist', { plan: { name: 'Tour' }, truck: null }), 'Tour');
});

test('druckTitel bei Mehr-LKW-Plänen: Umfang statt Fahrzeugtyp', () => {
  const plan = { name: 'Tour' }, truck = { name: '7,5 t' };
  assert.equal(druckTitel('plan', { plan, truck, lkwName: 'LKW 2' }), 'Tour – LKW 2');
  assert.equal(druckTitel('unload', { plan, truck, lkwName: 'Ohne LKW' }), 'Tour – Ohne LKW');
  assert.equal(druckTitel('checklist', { plan, truck, lkwName: 'LKW 2', alle: true }), 'Tour – alle LKW');
  assert.equal(druckTitel('labels', { plan, truck, lkwName: 'LKW 2', alle: true }), 'Tour');
});

test('Drucksperre: ein zweiter Druck während des ersten wird verworfen, danach wieder frei', async () => {
  const sperre = createDruckSperre();
  let fertig;
  const laeufe = [];
  const erster = sperre.lauf(() => { laeufe.push(1); return new Promise(r => { fertig = r; }); });
  assert.equal(sperre.laeuft, true);
  assert.equal(await sperre.lauf(() => { laeufe.push(2); }), false);
  fertig();
  assert.equal(await erster, true);
  assert.equal(sperre.laeuft, false);
  await assert.rejects(sperre.lauf(() => { throw new Error('x'); }), /x/);
  assert.equal(sperre.laeuft, false);
  assert.equal(await sperre.lauf(() => { laeufe.push(3); }), true);
  assert.deepEqual(laeufe, [1, 3]);
});

test('pageRuleFor: Rand unten nur mit Host-Angabe, Etiketten unverändert', () => {
  assert.equal(pageRuleFor('plan'), null);
  assert.equal(pageRuleFor('plan', { randUntenMm: 22 }), '@page { size: A4 landscape; margin: 10mm 10mm 22mm; }');
  assert.equal(pageRuleFor('labels', { randUntenMm: 22 }), '@page { size: A4 portrait; margin: 0; }');
});
