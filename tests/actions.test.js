import test from 'node:test';
import assert from 'node:assert/strict';
import * as A from '../js/model/actions.js';
import { validatePlan } from '../js/model/validate.js';
import { wheelFace, DOOR_FACE, MAX_LABEL } from '../js/model/geometry.js';
import { mkCase, mkTruck, P, plan, byId, counter } from './fixtures.js';

const K = mkCase('k', 120, 60, 60);
const T = mkCase('t', 120, 60, 100, { tippable: true });
const ctx = () => ({ caseById: byId(K, T), truck: mkTruck(), newId: counter('n') });
const find = (pl, id) => pl.placements.find(p => p.id === id);

test('placeCase stapelt per Schwerkraft', () => {
  const pl = A.placeCase(plan([P('a','k',0,0,0)]), 'k', { x: 12, y: 0 }, ctx());
  const p = pl.placements.at(-1);
  assert.equal(p.x, 10);
  assert.equal(p.z, 60);
});
test('placeCase aus der Ablage entfernt das Stück dort', () => {
  const pl = A.placeCase(plan([], [{ id: 'u1', caseId: 'k' }]), 'k', { x: 0, y: 0 }, ctx(), { fromUnplacedId: 'u1' });
  assert.equal(pl.unplaced.length, 0);
  assert.equal(pl.placements[0].id, 'u1');
});
test('moveGroup nimmt den Stapel mit', () => {
  const pl = A.moveGroup(plan([P('a','k',0,0,0), P('b','k',0,0,60)]), 'a', 300, 100, ctx());
  assert.deepEqual([find(pl,'b').x, find(pl,'b').y, find(pl,'b').z], [300, 100, 60]);
});
// Der Test oben bewegt einen Stapel innerhalb derselben z-Ebene (Wurzel und Ziel beide bei z 0)
// — ddz ist dort immer 0, ein fest verdrahtetes nz = 0 bliebe unbemerkt
// (docs/code-review-2026-09-21.md, „moveGroup nimmt den Stapel mit deckt den Schwerkraftanteil
// nicht ab"). Dieser Test schiebt den Stapel auf einen bereits 2-hohen Stapel und prüft, dass
// er per Schwerkraft obendrauf landet.
test('moveGroup zieht den Schwerkraftanteil: Stapel landet auf einem anderen Stapel', () => {
  const pl = plan([
    P('a','k',0,0,0),
    P('base1','k',300,0,0), P('base2','k',300,0,60),
  ]);
  const moved = A.moveGroup(pl, 'a', 300, 0, ctx(), { grid: 1, edges: false });
  assert.equal(find(moved,'a').z, 120);
});
test('moveGroup rastet an Kanten', () => {
  const pl = A.moveGroup(plan([P('a','k',0,0,0), P('b','k',500,0,0)]), 'b', 123, 0, ctx());
  assert.equal(find(pl,'b').x, 120);
});
test('moveGroup ohne Raster (Pfeiltasten mit Shift)', () => {
  const pl = A.moveGroup(plan([P('a','k',0,0,0)]), 'a', 1, 0, ctx(), { grid: 1, edges: false });
  assert.equal(find(pl,'a').x, 1);
});
test('rotate dreht um 90°', () => {
  const pl = A.rotate(plan([P('a','k',0,0,0)]), 'a', ctx());
  assert.equal(find(pl,'a').rot, 90);
});
test('cycleTip nur bei tippbaren Cases', () => {
  assert.equal(find(A.cycleTip(plan([P('a','k',0,0,0)]), 'a', ctx()), 'a').orientation, 'standing');
  // T (120×60×100) steht bei rot 0 mit der LÄNGE (120) in Fahrtrichtung (x) -> nextTip()
  // verzweigt hier deshalb nach tipShort (verzichtet nicht wie früher fest auf tipLong).
  assert.equal(find(A.cycleTip(plan([P('a','t',0,0,0)]), 'a', ctx()), 'a').orientation, 'tipShort');
});
test('cycleTip lässt Traversenwagen unverändert (auch bei fälschlich tippable:true)', () => {
  const truss = mkCase('trs', 300, 60, 80, { kind: 'truss', tippable: true });
  const trussCtx = { caseById: byId(K, T, truss), truck: mkTruck(), newId: counter('n') };
  assert.equal(find(A.cycleTip(plan([P('a','trs',0,0,0)]), 'a', trussCtx), 'a').orientation, 'standing');
});
// Bis zur Nutzer-Rückmeldung vom 2026-09-23 setzte cycleTip bei jedem Tipp die Rollen fest zur
// Trucktür, unabhängig von der Ausgangsdrehung – stand die lange Seite in Fahrtrichtung, kippte
// das Case dadurch sichtbar zur Seite statt nach vorn. cycleTip kippt jetzt relativ zur aktuellen
// Lage (nextTip() in geometry.js, dort im Detail getestet); die Rollenrichtung danach ist nicht
// mehr garantiert und muss bei Bedarf über setWheelFace gewählt werden.
test('cycleTip: Case mit Länge in Fahrtrichtung (rot 0) kippt nach vorn (tipShort), nicht zur Seite', () => {
  const pl = A.cycleTip(plan([P('a','t',0,0,0)]), 'a', ctx());
  const p = find(pl, 'a');
  assert.equal(p.orientation, 'tipShort');
  assert.equal(p.rot, 0);
});
test('cycleTip: zweiter Tipp kippt zurück auf standing (Hin-und-zurück, nicht in eine dritte Lage)', () => {
  const once = A.cycleTip(plan([P('a','t',0,0,0)]), 'a', ctx());
  assert.equal(find(once, 'a').orientation, 'tipShort');
  const twice = A.cycleTip(once, 'a', ctx());
  const p = find(twice, 'a');
  assert.equal(p.orientation, 'standing');
  assert.equal(p.rot, 0);
});
test('setWheelFace dreht die Rollen eines getippten Cases in die gewünschte Richtung', () => {
  const tipped = A.cycleTip(plan([P('a','t',0,0,0)]), 'a', ctx());
  const pl = A.setWheelFace(tipped, 'a', '-y', ctx());
  assert.equal(wheelFace(find(pl, 'a')), '-y');
});
test('setWheelFace: unerreichbare Richtung (stehend, Rollen unten) ändert nichts', () => {
  const pl = A.setWheelFace(plan([P('a','k',0,0,0)]), 'a', '+y', ctx());
  assert.deepEqual(find(pl, 'a'), P('a','k',0,0,0));
});
test('toTray und addUnplaced', () => {
  let pl = A.toTray(plan([P('a','k',0,0,0)]), 'a');
  assert.deepEqual(pl.unplaced, [{ id: 'a', caseId: 'k' }]);
  pl = A.addUnplaced(pl, 'k', 3, counter('u'));
  assert.equal(pl.unplaced.length, 4);
  pl = A.removeUnplaced(pl, 'a');
  assert.equal(pl.unplaced.length, 3);
  assert.ok(!pl.unplaced.some(u => u.id === 'a'));
});
// Task 8 (Vorgabe des Koordinators): removeUnplaced traf vorher IMMER das erste Vorkommen eines
// Case-Typs (findIndex), unabhängig davon, welches Stück der Nutzer in der Ablage anklickte — seit
// die Ablage die einzelnen Beschriftungen zeigt, erwartet der Nutzer, gezielt EIN bestimmtes
// Stück zu entfernen (docs/code-review-2026-09-21.md, „actions.js:28-32“). Drei gleich benannte
// Stücke, das mittlere gezielt entfernt: die beiden anderen müssen unverändert bleiben.
test('removeUnplaced trifft gezielt das angegebene Stück, nicht das erste seines Case-Typs', () => {
  let pl = A.addUnplaced(plan([]), 'k', 3, counter('u'), { labels: ['Licht 1', 'Licht 2', 'Licht 3'] });
  const [first, second, third] = pl.unplaced;
  pl = A.removeUnplaced(pl, second.id);
  assert.deepEqual(pl.unplaced.map(u => u.id), [first.id, third.id]);
  assert.deepEqual(pl.unplaced.map(u => u.label), ['Licht 1', 'Licht 3']);
});
test('removeUnplaced ohne Treffer lässt den Plan unverändert', () => {
  const pl0 = plan([], [{ id: 'u1', caseId: 'k' }]);
  const pl = A.removeUnplaced(pl0, 'unbekannt');
  assert.equal(pl, pl0);
});
test('addUnplaced übernimmt Labels und Farbe', () => {
  const pl = A.addUnplaced(plan([]), 'k', 3, counter('u'), { labels: ['A', 'B', 'C'], color: '#ff0000' });
  assert.deepEqual(pl.unplaced.map(u => u.label), ['A', 'B', 'C']);
  assert.deepEqual(pl.unplaced.map(u => u.color), ['#ff0000', '#ff0000', '#ff0000']);
});
test('addUnplaced ohne Optionen bleibt abwärtskompatibel', () => {
  const pl = A.addUnplaced(plan([]), 'k', 2, counter('u'));
  assert.deepEqual(pl.unplaced, [{ id: 'u1', caseId: 'k' }, { id: 'u2', caseId: 'k' }]);
});
test('addUnplaced kürzt ein zu langes Label auf MAX_LABEL (Befund B4)', () => {
  const long = 'X'.repeat(MAX_LABEL + 20);
  const pl = A.addUnplaced(plan([]), 'k', 1, counter('u'), { labels: [long] });
  assert.equal(pl.unplaced[0].label.length, MAX_LABEL);
  assert.equal(pl.unplaced[0].label, long.slice(0, MAX_LABEL));
});
test('duplicate setzt daneben', () => {
  const pl = A.duplicate(plan([P('a','k',0,0,0)]), 'a', ctx());
  assert.equal(pl.placements[1].x, 120);
});
test('duplicate kopiert Label/Farbe und zählt hoch', () => {
  const pl = A.duplicate(plan([P('a','k',0,0,0,{ label: 'Kabelcase 3', color: '#00ff00' })]), 'a', ctx());
  assert.equal(pl.placements[1].label, 'Kabelcase 4');
  assert.equal(pl.placements[1].color, '#00ff00');
});
test('duplicate ohne Zahl am Ende hängt keine Nummer an', () => {
  const pl = A.duplicate(plan([P('a','k',0,0,0,{ label: 'Kabelcase' })]), 'a', ctx());
  assert.equal(pl.placements[1].label, 'Kabelcase');
});
// Fix-Runde 1 (Reviewer, Task 8): `nextLabel()`s `padStart` war ungetestet — ein Rückbau auf
// `${m[1]}${Number(m[2]) + 1}` (ohne padStart) blieb bei 372/372 grün. "09" -> "10" allein zeigt
// das nicht (beide Fassungen liefern zufällig 2 Ziffern) – "005" -> "6" (ohne padStart) vs. "006"
// (mit) macht den Unterschied sichtbar.
test('duplicate erhält die Stellenzahl beim Hochzählen (führende Nullen bleiben Nullen)', () => {
  const pl = A.duplicate(plan([P('a','k',0,0,0,{ label: 'Kabelcase 005' })]), 'a', ctx());
  assert.equal(pl.placements[1].label, 'Kabelcase 006');
});
test('duplicate kürzt eine über MAX_LABEL hinaus hochgezählte Nummer (Befund B4, Fix-Runde 1)', () => {
  // 40 Zeichen, endet auf "9" -> hochgezählt "10" wäre 41 Zeichen ohne Kürzung.
  const label = `${'X'.repeat(MAX_LABEL - 1)}9`;
  assert.equal(label.length, MAX_LABEL);
  const pl = A.duplicate(plan([P('a','k',0,0,0,{ label })]), 'a', ctx());
  assert.ok(pl.placements[1].label.length <= MAX_LABEL, `Label ist ${pl.placements[1].label.length} Zeichen lang`);
  // "X"*39 + "9" -> hochgezählt "X"*39 + "10" (41 Zeichen) -> gekürzt auf 40: die "0" fällt weg.
  assert.equal(pl.placements[1].label, `${'X'.repeat(MAX_LABEL - 1)}1`);
});
test('duplicate kürzt auch ein zu langes Label ohne Zahl am Ende', () => {
  const label = 'Y'.repeat(MAX_LABEL + 10);
  const pl = A.duplicate(plan([P('a','k',0,0,0,{ label })]), 'a', ctx());
  assert.equal(pl.placements[1].label.length, MAX_LABEL);
});
// Task 8: `duplicate` setzte die Kopie bisher blind neben das Original (x + dx), auch über die
// Heckkante hinaus – zwei Fehlermeldungen aus einem einzigen Duplizieren-Klick
// (docs/code-review-2026-09-21.md, „actions.js:110-118“). Nahe der Trucktür weicht die Kopie jetzt
// nach vorn (-dx) aus.
test('duplicate weicht vor der Heckkante nach vorn aus, statt über den Laderaum hinauszuragen', () => {
  const truck = mkTruck(); // l 1360
  const c = { caseById: byId(K, T), truck, newId: counter('n') };
  // Original berührt exakt die Heckkante (x + dx = 1360 = truck.l) – gültig, aber ohne jeden
  // Spielraum dahinter. Ein blindes "daneben" (x + dx) würde die Kopie auf x = 1360 setzen, deren
  // eigene Box dann bis x = 1480 reicht.
  const pl = A.duplicate(plan([P('a','k',1240,94,0)]), 'a', c);
  const copy = pl.placements[1];
  assert.ok(copy, 'die Kopie wurde angelegt');
  assert.equal(copy.x, 1120);
  const r = validatePlan(pl, c.caseById, c.truck);
  assert.ok(!r.issues.some(i => i.code === 'outOfBounds'), `keine outOfBounds-Meldung erwartet, war: ${JSON.stringify(r.issues)}`);
});
test('duplicate legt die Kopie in die Ablage, wenn nirgends im Truck Platz ist', () => {
  const tightTruck = mkTruck({ l: 120, w: 60, h: 60 });
  const c = { caseById: byId(K), truck: tightTruck, newId: counter('n') };
  const pl = A.duplicate(plan([P('a','k',0,0,0,{ label: 'Kabelcase 1' })]), 'a', c);
  assert.equal(pl.placements.length, 1, 'keine zweite Platzierung im Truck');
  assert.equal(pl.unplaced.length, 1);
  assert.equal(pl.unplaced[0].caseId, 'k');
  assert.equal(pl.unplaced[0].label, 'Kabelcase 2');
});

// Task 8: `srcExtra` übernahm bisher das GESAMTE Ablage-Objekt außer id/caseId in die neue
// Platzierung – ein Ablage-Eintrag mit einem eigenen (fremden) x/y hätte die gerade gewählte
// Mausposition überschrieben (docs/code-review-2026-09-21.md, „actions.js:38-39“). Nur
// label/color werden jetzt übernommen.
// Lage/Tippen je Stück (Task 1): addUnplaced/placeCase/cycleTip/duplicate/toTray übernehmen
// layers/tipped genauso wie label/color.

test('addUnplaced übernimmt layers und tipped', () => {
  const pl = A.addUnplaced(plan([]), 'k', 2, counter('u'), { layers: [1, 2], tipped: true });
  assert.deepEqual(pl.unplaced.map(u => u.layers), [[1, 2], [1, 2]]);
  assert.deepEqual(pl.unplaced.map(u => u.tipped), [true, true]);
});
test('addUnplaced ohne layers/tipped setzt diese Felder nicht (Regression)', () => {
  const pl = A.addUnplaced(plan([]), 'k', 1, counter('u'));
  assert.ok(!('layers' in pl.unplaced[0]));
  assert.ok(!('tipped' in pl.unplaced[0]));
});

test('placeCase: Startorientierung tipLong, wenn tipped:true und der Case-Typ tippbar ist', () => {
  const pl0 = plan([], [{ id: 'u1', caseId: 't', tipped: true, layers: [1] }]);
  const pl = A.placeCase(pl0, 't', { x: 0, y: 0 }, ctx(), { fromUnplacedId: 'u1' });
  const p = pl.placements[0];
  assert.equal(p.orientation, 'tipLong');
  assert.equal(p.tipped, true);
  assert.deepEqual(p.layers, [1]);
});
test('placeCase: tipped:true bei nicht tippbarem Case-Typ startet trotzdem standing (canTip greift)', () => {
  const pl0 = plan([], [{ id: 'u1', caseId: 'k', tipped: true }]);
  const pl = A.placeCase(pl0, 'k', { x: 0, y: 0 }, ctx(), { fromUnplacedId: 'u1' });
  assert.equal(pl.placements[0].orientation, 'standing');
});
test('placeCase: ohne tipped-Feld startet standing (Regression, Altdaten)', () => {
  const pl0 = plan([], [{ id: 'u1', caseId: 't' }]);
  const pl = A.placeCase(pl0, 't', { x: 0, y: 0 }, ctx(), { fromUnplacedId: 'u1' });
  assert.equal(pl.placements[0].orientation, 'standing');
  assert.ok(!('tipped' in pl.placements[0]));
});

test('cycleTip aktualisiert tipped passend zur neuen Orientierung', () => {
  const pl = A.cycleTip(plan([P('a', 't', 0, 0, 0)]), 'a', ctx());
  assert.equal(find(pl, 'a').orientation, 'tipShort');
  assert.equal(find(pl, 'a').tipped, true);
  const back = A.cycleTip(pl, 'a', ctx());
  assert.equal(find(back, 'a').orientation, 'standing');
  assert.equal(find(back, 'a').tipped, false);
});
test('cycleTip an einem nicht tippbaren Case ändert tipped nicht (kein tatsächliches Tippen)', () => {
  const pl = A.cycleTip(plan([P('a', 'k', 0, 0, 0)]), 'a', ctx());
  assert.ok(!('tipped' in find(pl, 'a')));
});

// Task 1: setPieceLayers/setPieceTipped ändern Lage/Tippen eines einzelnen Stücks – unabhängig
// davon, ob es platziert ist oder in der Ablage liegt (Inspector, Task 2 baut UI-Checkboxen
// darauf auf).
test('setPieceLayers setzt layers an einem Placement, Position/Orientierung bleiben unverändert', () => {
  const pl = A.setPieceLayers(plan([P('a', 'k', 10, 20, 0, { rot: 90 })]), 'a', [1], ctx());
  const p = find(pl, 'a');
  assert.deepEqual(p.layers, [1]);
  assert.equal(p.x, 10);
  assert.equal(p.y, 20);
  assert.equal(p.z, 0);
  assert.equal(p.rot, 90);
  assert.equal(p.orientation, 'standing');
});
test('setPieceLayers wirkt ebenso auf ein Ablage-Stück', () => {
  const pl = A.setPieceLayers(plan([], [{ id: 'u1', caseId: 'k' }]), 'u1', [1], ctx());
  assert.deepEqual(pl.unplaced[0].layers, [1]);
});
test('setPieceLayers: [4,3,2,1] bei Standard-Lagen entfernt ein vorhandenes layers-Feld (entspricht layersOf(c))', () => {
  const pl = A.setPieceLayers(plan([P('a', 'k', 0, 0, 0, { layers: [2] })]), 'a', [4, 3, 2, 1], ctx());
  assert.ok(!('layers' in find(pl, 'a')));
});
test('setPieceLayers: Typ mit layers:[1,2] – [1,2,3] wird zu „kein Feld“', () => {
  const c2 = mkCase('c2', 120, 60, 60, { layers: [1, 2] });
  const c = { caseById: byId(c2), truck: mkTruck(), newId: counter('n') };
  const pl = A.setPieceLayers(plan([P('a', 'c2', 0, 0, 0, { layers: [1] })]), 'a', [1, 2, 3], c);
  assert.ok(!('layers' in find(pl, 'a')));
});
test('setPieceLayers: Typ mit layers:[1,2] – [2,3] wird zu [2]', () => {
  const c2 = mkCase('c2', 120, 60, 60, { layers: [1, 2] });
  const c = { caseById: byId(c2), truck: mkTruck(), newId: counter('n') };
  const pl = A.setPieceLayers(plan([P('a', 'c2', 0, 0, 0)]), 'a', [2, 3], c);
  assert.deepEqual(find(pl, 'a').layers, [2]);
});
test('setPieceLayers: [3,4] bei Typ [1,2] liefert denselben Plan (nichts Erlaubtes übrig)', () => {
  const c2 = mkCase('c2', 120, 60, 60, { layers: [1, 2] });
  const c = { caseById: byId(c2), truck: mkTruck(), newId: counter('n') };
  const pl0 = plan([P('a', 'c2', 0, 0, 0)]);
  assert.equal(A.setPieceLayers(pl0, 'a', [3, 4], c), pl0);
});
test('setPieceLayers: [] liefert denselben Plan', () => {
  const pl0 = plan([P('a', 'k', 0, 0, 0)]);
  assert.equal(A.setPieceLayers(pl0, 'a', [], ctx()), pl0);
});
test('setPieceLayers: [0] liefert denselben Plan', () => {
  const pl0 = plan([P('a', 'k', 0, 0, 0)]);
  assert.equal(A.setPieceLayers(pl0, 'a', [0], ctx()), pl0);
});
test('setPieceLayers: [1,1] (doppelt) liefert denselben Plan', () => {
  const pl0 = plan([P('a', 'k', 0, 0, 0)]);
  assert.equal(A.setPieceLayers(pl0, 'a', [1, 1], ctx()), pl0);
});
test('setPieceLayers: unbekannte id liefert denselben Plan', () => {
  const pl0 = plan([P('a', 'k', 0, 0, 0)]);
  assert.equal(A.setPieceLayers(pl0, 'unbekannt', [1], ctx()), pl0);
});
test('setPieceLayers: fehlender Case-Typ liefert denselben Plan', () => {
  const pl0 = plan([P('a', 'weg', 0, 0, 0)]);
  assert.equal(A.setPieceLayers(pl0, 'a', [1], ctx()), pl0);
});
test('setPieceLayers: [4,3,2,1] entfernt ein vorhandenes layers-Feld auch bei einem Ablage-Stück', () => {
  const pl = A.setPieceLayers(plan([], [{ id: 'u1', caseId: 'k', layers: [2] }]), 'u1', [4, 3, 2, 1], ctx());
  assert.ok(!('layers' in pl.unplaced[0]));
});

test('setPieceTipped(false) auf getipptes Placement kippt zurück (standing) und setzt tipped:false', () => {
  const tipped = A.cycleTip(plan([P('a', 't', 0, 0, 0)]), 'a', ctx());
  assert.equal(find(tipped, 'a').orientation, 'tipShort');
  const pl = A.setPieceTipped(tipped, 'a', false, ctx());
  const p = find(pl, 'a');
  assert.equal(p.orientation, 'standing');
  assert.equal(p.tipped, false);
});
test('setPieceTipped(true) auf stehendes Placement tippt und setzt tipped:true', () => {
  const pl = A.setPieceTipped(plan([P('a', 't', 0, 0, 0)]), 'a', true, ctx());
  const p = find(pl, 'a');
  assert.notEqual(p.orientation, 'standing');
  assert.equal(p.tipped, true);
});
// Fix-Runde 1 [critical]: setPieceTipped(false) rief für ein getipptes Placement bisher cycleTip
// auf – das ist aber ein GERICHTETER „einmal weiter kippen“-Schritt (nextTip() in geometry.js),
// der je nach Ausgangs-rot auch in einer ANDEREN getippten Lage landen kann statt auf standing.
// Reproduziert mit einem Placement, wie es Auto-Pack/Import erzeugen kann (nicht über cycleTip
// selbst entstanden): tipLong/rot 0 -> cycleTip landete auf tipShort statt standing.
// Alle vier packer-typischen Ausgangslagen (tipLong/tipShort x rot 0/90) müssen auf
// { orientation: 'standing', tipped: false } führen.
for (const [orientation, rot] of [['tipLong', 0], ['tipLong', 90], ['tipShort', 0], ['tipShort', 90]]) {
  test(`setPieceTipped(false) stellt ${orientation}/rot ${rot} sicher auf standing (nicht über cycleTip)`, () => {
    const pl0 = plan([P('a', 't', 0, 0, 0, { orientation, rot, tipped: true })]);
    const pl = A.setPieceTipped(pl0, 'a', false, ctx());
    const p = find(pl, 'a');
    assert.equal(p.orientation, 'standing');
    assert.equal(p.tipped, false);
    assert.equal(p.rot, rot, 'rot bleibt erhalten (kein Umlegen über cycleTip)');
  });
}
test('setPieceTipped auf ein Ablage-Stück setzt nur das Feld', () => {
  const pl = A.setPieceTipped(plan([], [{ id: 'u1', caseId: 't' }]), 'u1', true, ctx());
  assert.equal(pl.unplaced[0].tipped, true);
});
test('setPieceTipped bei nicht tippbarem Case liefert denselben Plan', () => {
  const pl0 = plan([P('a', 'k', 0, 0, 0)]);
  assert.equal(A.setPieceTipped(pl0, 'a', true, ctx()), pl0);
});
test('setPieceTipped: gleicher Wert liefert denselben Plan (Placement, Soll=Ist)', () => {
  const pl0 = plan([P('a', 't', 0, 0, 0, { tipped: false })]);
  assert.equal(A.setPieceTipped(pl0, 'a', false, ctx()), pl0);
});
test('setPieceTipped: gleicher Wert liefert denselben Plan (Ablage)', () => {
  const pl0 = plan([], [{ id: 'u1', caseId: 't', tipped: true }]);
  assert.equal(A.setPieceTipped(pl0, 'u1', true, ctx()), pl0);
});

test('placementToUnplaced (via toTray) behält layers/tipped', () => {
  const pl = A.toTray(plan([P('a', 't', 0, 0, 0, { layers: [2], tipped: true })]), 'a');
  assert.deepEqual(pl.unplaced[0].layers, [2]);
  assert.equal(pl.unplaced[0].tipped, true);
});

test('unloadAll legt alle Stücke in die Ablage, Stück-Felder bleiben, Positionen nicht', () => {
  const pl0 = plan(
    [P('a', 't', 0, 0, 0, { label: 'Amp 1', color: '#ff0000', layers: [1, 2], tipped: true }), P('b', 'k', 200, 0, 0)],
    [{ id: 'u1', caseId: 'k' }],
  );
  const pl = A.unloadAll(pl0);
  assert.deepEqual(pl.placements, []);
  assert.deepEqual(pl.unplaced, [
    { id: 'u1', caseId: 'k' },
    { id: 'a', caseId: 't', label: 'Amp 1', color: '#ff0000', layers: [1, 2], tipped: true },
    { id: 'b', caseId: 'k' },
  ]);
});
test('unloadAll bei leerem Truck gibt denselben Plan zurück (kein leerer Undo-Schritt)', () => {
  const pl0 = plan([], [{ id: 'u1', caseId: 'k' }]);
  assert.equal(A.unloadAll(pl0), pl0);
});

test('duplicate: Ablage-Zweig behält layers/tipped', () => {
  const tightTruck = mkTruck({ l: 120, w: 60, h: 60 });
  const c = { caseById: byId(K), truck: tightTruck, newId: counter('n') };
  const pl = A.duplicate(plan([P('a', 'k', 0, 0, 0, { layers: [1], tipped: false })]), 'a', c);
  assert.deepEqual(pl.unplaced[0].layers, [1]);
  assert.equal(pl.unplaced[0].tipped, false);
});

test('placeCase übernimmt aus der Ablage nur label/color, nicht ein fremdes x/y/z/orientation', () => {
  const pl0 = plan([], [{ id: 'u1', caseId: 'k', label: 'Kiste', color: '#ff00ff', x: 999, y: 999, orientation: 'tipLong', rot: 90 }]);
  const pl = A.placeCase(pl0, 'k', { x: 40, y: 40 }, ctx(), { fromUnplacedId: 'u1' });
  const p = pl.placements[0];
  assert.equal(p.label, 'Kiste');
  assert.equal(p.color, '#ff00ff');
  assert.equal(p.x, 40);
  assert.equal(p.y, 40);
  assert.equal(p.orientation, 'standing');
  assert.equal(p.rot, 0);
});

test('setItemLabel ändert eine Platzierung', () => {
  const pl = A.setItemLabel(plan([P('a','k',0,0,0)]), 'a', { label: 'Neu', color: '#123456' });
  assert.equal(pl.placements[0].label, 'Neu');
  assert.equal(pl.placements[0].color, '#123456');
});
test('setItemLabel trifft auch Ablage-Einträge', () => {
  const pl = A.setItemLabel(plan([], [{ id: 'u1', caseId: 'k' }]), 'u1', { label: 'Ablage', color: '#abcdef' });
  assert.equal(pl.unplaced[0].label, 'Ablage');
  assert.equal(pl.unplaced[0].color, '#abcdef');
});
test('setItemLabel: nur Label ändern lässt die Farbe stehen', () => {
  const pl = A.setItemLabel(plan([P('a','k',0,0,0,{ label: 'Alt', color: '#123456' })]), 'a', { label: 'Neu' });
  assert.equal(pl.placements[0].label, 'Neu');
  assert.equal(pl.placements[0].color, '#123456');
});
test('setItemLabel: nur Farbe ändern lässt das Label stehen', () => {
  const pl = A.setItemLabel(plan([P('a','k',0,0,0,{ label: 'Alt', color: '#123456' })]), 'a', { color: '#abcdef' });
  assert.equal(pl.placements[0].label, 'Alt');
  assert.equal(pl.placements[0].color, '#abcdef');
});
test('setItemLabel: color null entfernt die Farbe', () => {
  const pl = A.setItemLabel(plan([P('a','k',0,0,0,{ label: 'Alt', color: '#123456' })]), 'a', { color: null });
  assert.equal(pl.placements[0].label, 'Alt');
  assert.equal(pl.placements[0].color, undefined);
  assert.ok(!('color' in pl.placements[0]));
});
test('setItemLabel: label "" entfernt die Beschriftung', () => {
  const pl = A.setItemLabel(plan([P('a','k',0,0,0,{ label: 'Alt', color: '#123456' })]), 'a', { label: '' });
  assert.equal(pl.placements[0].label, undefined);
  assert.ok(!('label' in pl.placements[0]));
  assert.equal(pl.placements[0].color, '#123456');
});
test('setItemLabel kürzt ein zu langes Label auf MAX_LABEL (Befund B4)', () => {
  const long = 'Z'.repeat(MAX_LABEL + 15);
  const pl = A.setItemLabel(plan([P('a','k',0,0,0)]), 'a', { label: long });
  assert.equal(pl.placements[0].label.length, MAX_LABEL);
  assert.equal(pl.placements[0].label, long.slice(0, MAX_LABEL));
});
test('setItemLabel kürzt auch bei einem Ablage-Eintrag', () => {
  const long = 'Z'.repeat(MAX_LABEL + 5);
  const pl = A.setItemLabel(plan([], [{ id: 'u1', caseId: 'k' }]), 'u1', { label: long });
  assert.equal(pl.unplaced[0].label.length, MAX_LABEL);
});
test('packAll verlädt alles', () => {
  const pl = A.packAll(plan([P('a','k',700,0,0)], [{ id: 'u1', caseId: 'k' }, { id: 'u2', caseId: 't' }]), ctx());
  assert.equal(pl.placements.length, 3);
  assert.equal(pl.unplaced.length, 0);
});
test('packRest lässt Bestehendes stehen und kollidiert nicht', () => {
  const c = ctx();
  const pl = A.packRest(plan([P('a','k',0,0,0)], [{ id: 'u1', caseId: 'k' }, { id: 'u2', caseId: 'k' }]), c);
  assert.deepEqual(find(pl,'a'), P('a','k',0,0,0));
  assert.equal(pl.placements.length, 3);
  const r = validatePlan(pl, c.caseById, c.truck);
  assert.ok(!r.issues.some(i => i.code === 'collision'));
});
test('Regression: Labels und Farben überleben packAll', () => {
  const pl0 = plan(
    [P('a', 'k', 700, 0, 0, { label: 'A', color: '#111111' })],
    [{ id: 'u1', caseId: 'k', label: 'B', color: '#222222' }],
  );
  const pl = A.packAll(pl0, ctx());
  assert.equal(find(pl, 'a').label, 'A');
  assert.equal(find(pl, 'a').color, '#111111');
  assert.equal(find(pl, 'u1').label, 'B');
  assert.equal(find(pl, 'u1').color, '#222222');
});
test('Regression: Labels und Farben überleben packRest, Bestehendes bleibt unverändert', () => {
  const pl0 = plan(
    [P('a', 'k', 0, 0, 0, { label: 'A', color: '#111111' })],
    [{ id: 'u1', caseId: 'k', label: 'B', color: '#222222' }],
  );
  const pl = A.packRest(pl0, ctx());
  assert.deepEqual(find(pl, 'a'), P('a', 'k', 0, 0, 0, { label: 'A', color: '#111111' }));
  assert.equal(find(pl, 'u1').label, 'B');
  assert.equal(find(pl, 'u1').color, '#222222');
});
test('Regression: „Alles neu packen“ vergibt keine neuen Stück-IDs mehr', () => {
  const pl0 = plan([P('a', 'k', 700, 0, 0)], [{ id: 'u1', caseId: 'k' }]);
  const pl = A.packAll(pl0, ctx());
  assert.ok(find(pl, 'a'));
  assert.ok(find(pl, 'u1'));
});

// Fix-Runde 1, [important]: ein Placement mit gelöschtem Case-Typ hat keine bekannten Maße
// (Placements speichern nur x/y/z, keine l/w/h) und kann deshalb nicht als Box-Hindernis in
// autoPack einfließen. Damit ein frisch gepacktes Case nicht unsichtbar in die alte Position
// des Waisen-Placements hineingepackt wird, nimmt packAll es sichtbar aus den Placements
// heraus und legt es in die Ablage (unplaced) – der Nutzer sieht es dort und kann reagieren,
// statt dass zwei Cases im selben Raum stehen, ohne dass irgendetwas das meldet.
// `touch()` ist die einzige Stelle, an der ein Plan seinen `updatedAt`-Zeitstempel bekommt;
// `io.mergeById` entscheidet damit beim Import, welcher Stand der neuere ist. Ein `touch`, das
// `updatedAt` vergisst, führt zu stillem Datenverlust beim Zusammenführen — kein bestehender
// Test hätte das je bemerkt (docs/code-review-2026-09-21.md, „actions.test.js prüft updatedAt
// nirgends"). Ausgangspunkt ist immer ein fest in der Vergangenheit liegendes `updatedAt`, damit
// der Vergleich nicht von der Auflösung von `Date.now()` abhängt (kein Race bei sehr schneller
// Ausführung im selben Millisekunden-Fenster).
const OLD = '2000-01-01T00:00:00.000Z';
const withOld = pl => ({ ...pl, updatedAt: OLD });
const newerThanOld = result =>
  assert.ok(new Date(result.updatedAt).getTime() > new Date(OLD).getTime(),
    `updatedAt (${result.updatedAt}) sollte neuer sein als ${OLD}`);

const touchCases = [
  ['emptyPlan', () => A.emptyPlan('p', 'P', 't')],
  ['placeCase', () => A.placeCase(withOld(plan([P('a','k',0,0,0)])), 'k', { x: 400, y: 0 }, ctx())],
  ['moveGroup', () => A.moveGroup(withOld(plan([P('a','k',0,0,0)])), 'a', 300, 100, ctx())],
  ['rotate', () => A.rotate(withOld(plan([P('a','k',0,0,0)])), 'a', ctx())],
  ['cycleTip', () => A.cycleTip(withOld(plan([P('a','t',0,0,0)])), 'a', ctx())],
  ['setWheelFace', () => {
    const tipped = A.cycleTip(plan([P('a','t',0,0,0)]), 'a', ctx());
    return A.setWheelFace(withOld(tipped), 'a', '-y', ctx());
  }],
  ['addUnplaced', () => A.addUnplaced(withOld(plan([])), 'k', 1, counter('u'))],
  ['removeUnplaced', () => A.removeUnplaced(withOld(plan([], [{ id: 'u1', caseId: 'k' }])), 'u1')],
  ['duplicate', () => A.duplicate(withOld(plan([P('a','k',0,0,0)])), 'a', ctx())],
  ['setItemLabel', () => A.setItemLabel(withOld(plan([P('a','k',0,0,0)])), 'a', { label: 'Neu' })],
  ['removePlacement', () => A.removePlacement(withOld(plan([P('a','k',0,0,0)])), 'a')],
  ['toTray', () => A.toTray(withOld(plan([P('a','k',0,0,0)])), 'a')],
  ['packAll', () => A.packAll(withOld(plan([P('a','k',700,0,0)])), ctx())],
  ['packRest', () => A.packRest(withOld(plan([P('a','k',0,0,0)], [{ id: 'u1', caseId: 'k' }])), ctx())],
];
for (const [name, run] of touchCases) {
  test(`${name} setzt updatedAt neuer als die Eingabe (touch()-Regression)`, () => newerThanOld(run()));
}

test('packAll nimmt ein Placement mit gelöschtem Case-Typ aus den Placements heraus und legt es in die Ablage', () => {
  const pl0 = plan([
    P('ghost', 'weg', 0, 0, 0, { label: 'Geistercase' }),
    P('a', 'k', 700, 0, 0),
  ]);
  const pl = A.packAll(pl0, ctx());
  assert.ok(!find(pl, 'ghost'), 'die Waise steht nicht mehr in den Placements');
  const inTray = pl.unplaced.find(u => u.id === 'ghost');
  assert.ok(inTray, 'die Waise landet in der Ablage statt an ihrer alten Position stehen zu bleiben');
  assert.equal(inTray.caseId, 'weg');
  assert.equal(inTray.label, 'Geistercase');
  // Das frisch gepackte Case darf jetzt am Platz der ehemaligen Waise landen, ohne dass
  // irgendwo eine Kollision übersehen wird (die Waise ist ja aus den Placements raus).
  assert.equal(pl.placements.length, 1);
});
test('packRest nimmt ein bereits platziertes Waisen-Placement ebenfalls aus den Placements heraus', () => {
  const c = ctx();
  const pl0 = plan(
    [P('ghost', 'weg', 0, 0, 0, { label: 'Geistercase' }), P('a', 'k', 0, 94, 0)],
    [{ id: 'u1', caseId: 'k' }],
  );
  const pl = A.packRest(pl0, c);
  assert.ok(!find(pl, 'ghost'));
  assert.ok(pl.unplaced.find(u => u.id === 'ghost'));
  assert.ok(find(pl, 'a'), 'das gesunde Placement bleibt an Ort und Stelle stehen');
  const r = validatePlan(pl, c.caseById, c.truck);
  assert.ok(!r.issues.some(i => i.code === 'collision'));
});
