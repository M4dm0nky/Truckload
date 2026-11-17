import test from 'node:test';
import assert from 'node:assert/strict';
import { mkCase, P, plan } from './fixtures.js';
import { stand } from '../js/model/nyxAbgleich.js';
import { schritte } from '../js/ui/tabellen-import.js';
import { geraeteState, geraeteAktion, geraeteErgebnis, geraeteSchrittHtml, geraeteMenuHtml, geraeteAenderung, zuordnungenVon, offenVon } from '../js/ui/geraete-schritt.js';

const VIPER = 'gdtf:viper';
const BMFL = 'gdtf:bmfl';
const caseMit = (id, name, stueck, keys) =>
  mkCase(id, 60, 40, 40, { name, fasst: { stueck, geraete: keys.map(key => ({ key, name: key })) } });
const x1 = caseMit('x1', 'Viper x1', 1, [VIPER]);
const x2 = caseMit('x2', 'Viper x2', 2, [VIPER]);
const frei = mkCase('frei', 60, 40, 40, { name: 'Sonstiges Case' });
const liste = [
  { key: VIPER, name: 'MAC Viper', anzahl: 25, vwNamen: [] },
  { key: BMFL, name: 'Robe BMFL', anzahl: 6, vwNamen: [] },
];
const neu = (p = plan([]), extra = {}) => geraeteState({ liste, stand: stand(p, liste), cases: [x2, x1, frei], alias: new Map(), plan: p, ...extra });
const nyx = (id, caseId, key, n, extra = {}) => ({ id, caseId, nyxGeraet: key, nyxStueck: n, ...extra });
const knoepfe = html => [...html.matchAll(/data-act="g-case" data-case="([^"]+)"/g)].map(m => m[1]);

test('links alle Typen mit Anzahl und Stand', () => {
  const h = geraeteSchrittHtml(neu());
  assert.match(h, /MAC Viper/); assert.match(h, /Robe BMFL/);
  assert.match(h, /<b class="ge-num">25<\/b>/); assert.match(h, /<b class="ge-num">6<\/b>/);
  assert.match(h, /offen/);
});

test('ohne Klick: leeres Ergebnis, nichts gewählt, keine Vorschläge', () => {
  const st = neu();
  assert.deepEqual(geraeteErgebnis(st), { zuordnungen: [], nichtLaden: [], reduktion: [] });
  assert.equal(st.wahl, null);
  assert.deepEqual(knoepfe(geraeteSchrittHtml(st)), []);
});

test('unbekannter key: keine Vorschläge, aber die drei Dauerknöpfe', () => {
  const st = geraeteAktion(neu(), 'waehle', { key: BMFL });
  const h = geraeteSchrittHtml(st);
  assert.deepEqual(knoepfe(h), []);
  for (const a of ['g-find', 'g-new', 'g-skip']) assert.ok(h.includes(`data-act="${a}"`), a);
});

test('bekannter key: Vorschläge nach Geräten pro Case sortiert, keiner aktiv, Dauerknöpfe auch', () => {
  const st = geraeteAktion(neu(), 'waehle', { key: VIPER });
  const h = geraeteSchrittHtml(st);
  assert.deepEqual(knoepfe(h), ['x1', 'x2']);
  assert.ok(!/aria-pressed="true"[^>]*g-case|g-case[^>]*(on|active)/.test(h));
  assert.equal(zuordnungenVon(st, VIPER).length, 0);
  for (const a of ['g-find', 'g-new', 'g-skip']) assert.ok(h.includes(`data-act="${a}"`), a);
});

test('Klick auf Vorschlag: 12× · 1 Rest, Rest bietet Cases erneut (kleine zuerst)', () => {
  const st = geraeteAktion(geraeteAktion(neu(), 'waehle', { key: VIPER }), 'case', { case: x2 });
  assert.deepEqual(zuordnungenVon(st, VIPER).map(a => [a.n, a.stueck, a.rest]), [[12, 2, 1]]);
  assert.equal(offenVon(st, VIPER), 1);
  const h = geraeteSchrittHtml(st);
  assert.match(h, /12× Viper x2 · 1 Rest/);
  assert.deepEqual(knoepfe(h), ['x1', 'x2']);   // x1 (<= Rest) zuerst
  const st2 = geraeteAktion(st, 'case', { case: x1 });
  assert.equal(offenVon(st2, VIPER), 0);
  assert.deepEqual(geraeteErgebnis(st2).zuordnungen.map(z => [z.caseId, z.n, z.stueck]), [['x2', 12, 2], ['x1', 1, 1]]);
});

test('Rest 1 in Doppelcase: ein Stück mit 1 Gerät', () => {
  let st = geraeteAktion(geraeteAktion(neu(), 'waehle', { key: VIPER }), 'case', { case: x2 });
  st = geraeteAktion(st, 'case', { case: x2 });
  const z = geraeteErgebnis(st).zuordnungen;
  assert.deepEqual(z.map(a => [a.n, a.nyxStueck]), [[12, 2], [1, 1]]);
});

test('Geräte pro Case editierbar vor und nach der Zuordnung', () => {
  let st = geraeteAktion(neu(), 'waehle', { key: VIPER });
  st = geraeteAktion(st, 'stueck', { caseId: 'x1', wert: 5 });
  assert.match(geraeteSchrittHtml(st), /value="5"[^>]*data-case="x1"/);
  st = geraeteAktion(st, 'case', { case: x1 });
  assert.deepEqual(geraeteErgebnis(st).zuordnungen.map(a => [a.n, a.stueck]), [[5, 5]]);
  st = geraeteAktion(st, 'stueck', { key: VIPER, i: 0, caseId: 'x1', wert: 25 });
  assert.deepEqual(geraeteErgebnis(st).zuordnungen.map(a => [a.n, a.stueck]), [[1, 25]]);
  geraeteAktion(st, 'stueck', { key: VIPER, i: 0, caseId: 'x1', wert: 0 });   // ungültig
  assert.equal(st.zuordnung[VIPER][0].stueck, 25);
});

test('Zuordnung lösen und neu wählen', () => {
  let st = geraeteAktion(geraeteAktion(neu(), 'waehle', { key: VIPER }), 'case', { case: x2 });
  st = geraeteAktion(st, 'loese', { key: VIPER, i: 0 });
  assert.deepEqual(geraeteErgebnis(st).zuordnungen, []);
  st = geraeteAktion(st, 'case', { case: x1 });
  assert.equal(geraeteErgebnis(st).zuordnungen[0].caseId, 'x1');
});

test('anderes Case (z. B. aus Suche) wird wie Vorschlag zugeordnet', () => {
  const st = geraeteAktion(geraeteAktion(neu(), 'waehle', { key: BMFL }), 'case', { case: frei });
  assert.deepEqual(geraeteErgebnis(st).zuordnungen.map(a => [a.key, a.name, a.caseId, a.n]), [[BMFL, 'Robe BMFL', 'frei', 6]]);
});

test('Nicht laden: umschaltbar, löscht Zuordnung', () => {
  let st = geraeteAktion(geraeteAktion(neu(), 'waehle', { key: VIPER }), 'case', { case: x2 });
  st = geraeteAktion(st, 'nichtladen', { key: VIPER });
  assert.deepEqual(geraeteErgebnis(st), { zuordnungen: [], nichtLaden: [VIPER], reduktion: [] });
  assert.match(geraeteSchrittHtml(st), /Wieder laden/);
  st = geraeteAktion(st, 'nichtladen', { key: VIPER });
  assert.deepEqual(geraeteErgebnis(st).nichtLaden, []);
});

test('Differenz: +4 und −2 links, nur bestätigte Reduktion im Ergebnis', () => {
  const p = plan([P('p1', 'x1', 0, 0, 0, nyx('p1', 'x1', BMFL, 2, { lkw: undefined }))], [nyx('u1', 'x2', VIPER, 2), nyx('u2', 'x2', VIPER, 2), nyx('u3', 'x1', BMFL, 2)]);
  const li = [{ key: VIPER, name: 'MAC Viper', anzahl: 8, vwNamen: [] }, { key: BMFL, name: 'Robe BMFL', anzahl: 2, vwNamen: [] }];
  const st = geraeteState({ liste: li, stand: stand(p, li), cases: [x1, x2], alias: new Map(), plan: p });
  const h = geraeteSchrittHtml(st);
  assert.match(h, /\+4/); assert.match(h, /−2/);
  geraeteAktion(st, 'waehle', { key: BMFL });
  const r = geraeteSchrittHtml(st);
  assert.match(r, /Viper x1/); assert.match(r, /data-act="g-red"/);
  assert.deepEqual(geraeteErgebnis(st).reduktion, []);                       // unbestätigt
  geraeteAktion(st, 'red', { key: BMFL, ja: false });
  assert.deepEqual(geraeteErgebnis(st).reduktion, []);                       // stehen lassen
  geraeteAktion(st, 'red', { key: BMFL, ja: true });
  const red = geraeteErgebnis(st).reduktion;
  assert.equal(red.length, 1); assert.equal(red[0].key, BMFL);
  assert.equal(red[0].entfernen.length, 1);
});

test('Reduktion auf LKW: Hinweis und „Trotzdem entfernen“; ohne LKW „Entfernen“', () => {
  const li = [{ key: VIPER, name: 'MAC Viper', anzahl: 0, vwNamen: [] }];
  const auf = plan([P('p1', 'x2', 0, 0, 0, { nyxGeraet: VIPER, nyxStueck: 2 })]);
  const mk = p => geraeteAktion(geraeteState({ liste: li, stand: stand(p, li), cases: [x2], alias: new Map(), plan: p }), 'waehle', { key: VIPER });
  const h = geraeteSchrittHtml(mk(auf));
  assert.match(h, /Trotzdem entfernen/); assert.match(h, /Stehen lassen/); assert.match(h, /LKW/);
  const h2 = geraeteSchrittHtml(mk(plan([], [nyx('u1', 'x2', VIPER, 2)])));
  assert.ok(!/Trotzdem entfernen/.test(h2)); assert.match(h2, /Stehen lassen/);
});

test('Hand-Stück wird in der Reduktion nicht gezeigt', () => {
  const li = [{ key: VIPER, name: 'MAC Viper', anzahl: 0, vwNamen: [] }];
  const p = plan([], [nyx('u1', 'x2', VIPER, 2), { id: 'hand', caseId: 'x2' }]);
  const st = geraeteState({ liste: li, stand: stand(p, li), cases: [x2], alias: new Map(), plan: p });
  assert.deepEqual(st.reduktionInfo[VIPER].entfernen, ['u1']);
});

test('XSS in Gerätename und Case-Name wird maskiert', () => {
  const x = '<img src=x onerror=alert(1)>';
  const li = [{ key: VIPER, name: x, anzahl: 2, vwNamen: [] }];
  const c = caseMit('c', x, 1, [VIPER]);
  const st = geraeteAktion(geraeteState({ liste: li, stand: stand(plan([]), li), cases: [c], alias: new Map(), plan: plan([]) }), 'waehle', { key: VIPER });
  assert.ok(!geraeteSchrittHtml(st).includes(x));
});

test('schritte: mit Geräten beginnt die Folge mit geraete', () => {
  assert.deepEqual(schritte([], true, true), ['geraete', 'lkws']);
  assert.deepEqual(schritte([], true), ['lkws']);
});

test('Vorschläge stehen in der Reihenfolge von bekannteCases (aufsteigend nach Geräten pro Case), auch mit Rest', () => {
  const x3 = caseMit('x3', 'Viper x3', 3, [VIPER]);
  const l5 = [{ key: VIPER, name: 'MAC Viper', anzahl: 5, vwNamen: [] }];
  let st = geraeteState({ liste: l5, stand: stand(plan([]), l5), cases: [x3, x2, x1], alias: new Map(), plan: plan([]) });
  assert.deepEqual(knoepfe(geraeteSchrittHtml(geraeteAktion(st, 'waehle', { key: VIPER }))), ['x1', 'x2', 'x3']);
  st = geraeteAktion(geraeteAktion(st, 'waehle', { key: VIPER }), 'case', { case: x3 });   // 1× x3, Rest 2
  assert.equal(offenVon(st, VIPER), 2);
  assert.deepEqual(knoepfe(geraeteSchrittHtml(st)), ['x1', 'x2', 'x3']);
});

test('Nicht laden und wieder laden: die alte Zuordnung kommt nicht zurück', () => {
  let st = geraeteAktion(geraeteAktion(neu(), 'waehle', { key: VIPER }), 'case', { case: x2 });
  st = geraeteAktion(geraeteAktion(st, 'nichtladen', { key: VIPER }), 'nichtladen', { key: VIPER });
  assert.deepEqual(zuordnungenVon(st, VIPER), []);
  assert.deepEqual(geraeteErgebnis(st).zuordnungen, []);
  assert.equal(offenVon(st, VIPER), 25);
});

test('Reduktion: Marker „auf LKW“ nur am Stück auf dem LKW', () => {
  const li = [{ key: VIPER, name: 'MAC Viper', anzahl: 0, vwNamen: [] }];
  const p = plan([P('p1', 'x2', 0, 0, 0, { nyxGeraet: VIPER, nyxStueck: 2 })], [nyx('u1', 'x1', VIPER, 1)]);
  const st = geraeteAktion(geraeteState({ liste: li, stand: stand(p, li), cases: [x1, x2], alias: new Map(), plan: p }), 'waehle', { key: VIPER });
  const lis = [...geraeteSchrittHtml(st).matchAll(/<li>(.*?)<\/li>/g)].map(m => m[1]);
  const auf = lis.find(l => l.includes('Viper x2'));
  const ohne = lis.find(l => l.includes('Viper x1'));
  assert.ok(auf.includes('ti-tag'), 'LKW-Stück markiert');
  assert.ok(!ohne.includes('ti-tag'), 'Stück ohne LKW nicht markiert');
});

test('Voll zugeordnet: ein weiterer case-Aufruf ändert nichts', () => {
  let st = geraeteAktion(geraeteAktion(neu(), 'waehle', { key: BMFL }), 'case', { case: frei });
  assert.equal(offenVon(st, BMFL), 0);
  st = geraeteAktion(st, 'case', { case: x1 });
  assert.deepEqual(st.zuordnung[BMFL].map(a => a.caseId), ['frei']);
  assert.deepEqual(geraeteErgebnis(st).zuordnungen.map(a => a.caseId), ['frei']);
});

// ---- nicht laden im Differenz-Modus ----
const diffPlan = () => plan([], [nyx('a', 'x2', BMFL, 2), nyx('b', 'x2', BMFL, 2), nyx('v', 'x2', VIPER, 2)]);
const diffSt = () => { const p = diffPlan(); return geraeteState({ liste: [{ ...liste[0], anzahl: 5 }, { ...liste[1], anzahl: 2 }], stand: stand(p, [{ ...liste[0], anzahl: 5 }, { ...liste[1], anzahl: 2 }]), cases: [x2, x1], alias: new Map(), plan: p }); };

test('nicht laden im Diff-Modus: links keine Differenz, rechts „{anzahl} Stück“ statt Differenz (Treffer)', () => {
  const st = diffSt();                 // Viper +3, BMFL −2
  geraeteAktion(st, 'nichtladen', { key: VIPER });
  const links = geraeteSchrittHtml(st);
  assert.doesNotMatch(links, /\+3/);
  assert.match(links, /<b class="ge-num">5<\/b>/);
  geraeteAktion(st, 'waehle', { key: VIPER });
  assert.match(geraeteSchrittHtml(st), /5 Stück/);
  assert.doesNotMatch(geraeteSchrittHtml(st), /3 Stück/);
});

test('Gegenprobe: ohne nicht laden zeigt der Diff-Modus +3 und „3 Stück“', () => {
  const st = diffSt();
  assert.match(geraeteSchrittHtml(st), /\+3/);
  geraeteAktion(st, 'waehle', { key: VIPER });
  assert.match(geraeteSchrittHtml(st), /3 Stück/);
});

test('Reduktions-Typ: nicht laden und wieder laden stellt die Reduktion wieder her (live-Zustand)', () => {
  const st = diffSt();
  geraeteAktion(st, 'nichtladen', { key: BMFL });
  geraeteAktion(st, 'waehle', { key: BMFL });
  assert.match(geraeteSchrittHtml(st), /nicht geladen/);
  assert.doesNotMatch(geraeteSchrittHtml(st), /−2/);
  geraeteAktion(st, 'nichtladen', { key: BMFL });
  assert.match(geraeteSchrittHtml(st), /−2/);
  assert.match(geraeteSchrittHtml(st), /Diese Stücke würden entfernt/);
  geraeteAktion(st, 'red', { key: BMFL, ja: true });
  assert.equal(geraeteErgebnis(st).reduktion.length, 1);
});

test('Typ, der schon im Plan als nicht laden steht und −2 hat: Wieder laden zeigt die Reduktion', () => {
  const p = { ...diffPlan(), nyxAbgleich: { nichtLaden: [BMFL] } };
  const l = [{ ...liste[0], anzahl: 5 }, { ...liste[1], anzahl: 2 }];
  const st = geraeteState({ liste: l, stand: stand(p, l), cases: [x2], alias: new Map(), plan: p });
  geraeteAktion(st, 'nichtladen', { key: BMFL });
  geraeteAktion(st, 'waehle', { key: BMFL });
  assert.match(geraeteSchrittHtml(st), /Diese Stücke würden entfernt/);
});

const knopf = (h, act) => new RegExp(`<button[^>]*data-act="${act}"([^>]*)>`).exec(h)[1];
const gesperrt = (h, act) => /\bdisabled\b/.test(knopf(h, act));

test('Übernehmen-Knöpfe: ohne Änderung beide gesperrt', () => {
  const h = geraeteMenuHtml(neu());
  assert.equal(geraeteAenderung(neu()), false);
  assert.ok(gesperrt(h, 'only') && gesperrt(h, 'load'));
  assert.ok(!gesperrt(h, 'cancel'));
});

test('Übernehmen-Knöpfe: Zuordnung, bestätigte Reduktion oder nichtLaden-Änderung entsperren', () => {
  const zu = geraeteAktion(geraeteAktion(neu(), 'waehle', { key: VIPER }), 'case', { case: x2 });
  assert.ok(geraeteAenderung(zu) && !gesperrt(geraeteMenuHtml(zu), 'only') && !gesperrt(geraeteMenuHtml(zu), 'load'));
  const nl = geraeteAktion(neu(), 'nichtladen', { key: BMFL });
  assert.ok(geraeteAenderung(nl) && !gesperrt(geraeteMenuHtml(nl), 'only'));
  assert.ok(gesperrt(geraeteMenuHtml(geraeteAktion(nl, 'nichtladen', { key: BMFL })), 'only'));   // zurückgenommen
  const p = plan([], [nyx('u1', 'x2', VIPER, 2), nyx('u2', 'x2', VIPER, 2)]);
  const li = [{ key: VIPER, name: 'MAC Viper', anzahl: 2, vwNamen: [] }];
  const rd = geraeteState({ liste: li, stand: stand(p, li), cases: [x1, x2], alias: new Map(), plan: p });
  assert.ok(gesperrt(geraeteMenuHtml(rd), 'load'));                                                 // −2 unbestätigt
  geraeteAktion(rd, 'red', { key: VIPER, ja: false });
  assert.ok(gesperrt(geraeteMenuHtml(rd), 'load'));                                                 // stehen lassen
  geraeteAktion(rd, 'red', { key: VIPER, ja: true });
  assert.ok(!gesperrt(geraeteMenuHtml(rd), 'load'));
});

test('Übernehmen-Knöpfe: schon gesetztes nichtLaden im Plan ist keine Änderung', () => {
  const p = { ...plan([]), nyxAbgleich: { nichtLaden: [BMFL] } };
  const st = neu(p);
  assert.ok(st.nichtLaden.has(BMFL));
  assert.equal(geraeteAenderung(st), false);
  assert.equal(geraeteAenderung(geraeteAktion(st, 'nichtladen', { key: BMFL })), true);        // wieder laden
});
