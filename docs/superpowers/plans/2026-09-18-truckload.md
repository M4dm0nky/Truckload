# Truckload – Ladeplaner für Cases (Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lokale Browser-App, mit der Cases (auf Rollen, stehend oder gekippt, gestapelt) in einen LKW geplant, in Drauf-/Seiten-/Rückansicht und 3D visualisiert, geprüft und als Ladeplan gedruckt werden – mit eigener, speicherbarer Case- und Fahrzeug-Bibliothek.

**Architecture:** Reines HTML/CSS/JS (ES-Module, kein Build). Die gesamte Fachlogik (Geometrie, Kippen, Prüfungen, Auto-Beladung, Aktionen, Import/Export, Undo) liegt in reinen JS-Modulen ohne DOM und wird mit `node --test` getestet. Die UI (SVG-2D, Three.js-3D, Dialoge) ruft nur diese Module auf. Daten liegen in IndexedDB, Backup per JSON-Export.

**Tech Stack:** Vanilla JS (ES2022, ES-Module), SVG, Three.js 0.169 (lokal in `vendor/`), IndexedDB, `node --test` (Node ≥ 20), Start über `python3 -m http.server` (via `start.command`).

**Spec:** Abschnitt „Spec“ unten; wird in Task 1 nach `docs/superpowers/specs/2026-09-18-truckload-design.md` kopiert.

## Global Constraints

- Keine npm-Abhängigkeiten, kein Build-Schritt. `package.json` nur für `"type": "module"` und `npm test`.
- Einheiten intern: **cm** und **kg**. Anzeige: cm, Positionen/Lademeter in m.
- Koordinaten: **x = Länge ab Stirnwand (0) Richtung Tür**, **y = Breite ab linker Wand (Fahrerseite, 0)**, **z = Höhe ab Boden**.
- UI-Sprache Deutsch. Code-Bezeichner Englisch.
- Nutzereingaben (Case-Namen, Inhalt) werden in HTML immer über `esc()` ausgegeben.
- Vorlagen (Cases/Fahrzeuge) sind `builtin: true`, nicht editierbar; Bearbeiten legt eine eigene Kopie an. Vorlagenmaße sind als „Richtwert“ gekennzeichnet.
- App läuft über `http://localhost:8765` (ES-Module funktionieren nicht über `file://`; feste Portnummer, damit IndexedDB-Daten erhalten bleiben).
- Toleranz für Geometrievergleiche: `EPS = 0.5` cm.

---

## Spec

### Zweck
Veranstaltungstechnik wird größtenteils in Cases auf Rollen transportiert. Cases werden im LKW gestapelt und oft **gekippt** („getippt“: nach vorne auf die Seite gelegt). Das Tool plant und visualisiert die Ladung und prüft sie.

### Datenmodell
- **Case** `{ id, builtin, name, content, category, color, l, w, h, weight, tippable, stackable, maxTopLoad|null, stock|null, note?, updatedAt }` – `l ≥ w` nicht erzwungen; `l,w,h` = Maße **stehend inkl. Rollen**.
- **Truck** `{ id, builtin, name, l, w, h, payload, wheelArches: [{x, l, w, h, side:'left'|'right'|'both'}], note?, updatedAt }` – Innenmaße.
- **Plan** `{ id, name, truckId, placements: [Placement], unplaced: [{id, caseId}], notes, updatedAt }`.
- **Placement** `{ id, caseId, x, y, z, orientation: 'standing'|'tipLong'|'tipShort', rot: 0|90|180|270 }`.

### Lage/Kippen
Lokale Maße (a entlang x, b entlang y, c Höhe) je Lage:
- `standing`: a=l, b=w, c=h – Rollen unten.
- `tipLong` (auf die lange Seite gekippt): a=l, b=h, c=w – Rollen zeigen Richtung +y.
- `tipShort` (auf die Stirnseite gekippt): a=h, b=w, c=l – Rollen zeigen Richtung +x.
`rot` 90/270 tauscht a und b; die Rollenseite dreht mit (+x → +y → −x → −y).

### Prüfungen (live)
`outOfBounds`, `collision`, `arch` (Radkasten), `notTippable`, `unsupported` (< 80 % Auflagefläche), `notStackable`, `overload` (Last obendrauf > maxTopLoad, Last wird flächenanteilig nach unten verteilt), `missingCase`, planweit `tooHeavy` (> Nutzlast) und `imbalance` (Schwerpunkt seitlich > 10 % der Breite aus der Mitte). Kennzahlen: Gewicht, Lademeter, Volumenauslastung, Schwerpunkt, Ladereihenfolge (nach x, dann y, dann z).

### Auto-Vorschlag
Pro Case beste Lage wählen (Füllgrad Breite × Füllgrad Höhe; bei Gleichstand stehend, dann 0°). Gleiche Grundfläche → Stapel (schwer unten, Stapelbarkeit und maxTopLoad beachten). Stapel per Extreme-Point-Heuristik von der Stirnwand aus platzieren (Radkästen sind Hindernisse). „Alles neu packen“ oder „Rest einpacken“ (bestehende Platzierungen bleiben).

### UI
Topbar (Ladeplan, Fahrzeug, Auto-Pack, 2D/3D, Undo/Redo, Sichern/Importieren, Drucken) · links Bibliothek (Suche, Gewerk-Filter, eigene + Vorlagen, „Noch nicht verladen“-Ablage) · Mitte Draufsicht (Drag & Drop, Raster 5 cm, Kanten-Snap 8 cm, Schwerkraft-Stapeln, Stapel wandern mit) + Seitenansicht (von links) + Rückansicht (von der Tür) bzw. 3D (OrbitControls) · rechts Inspector (Auswahl, Aktionen, Warnungen, Kennzahlen). Tasten: R drehen, T kippen, D duplizieren, Entf löschen, Pfeile schieben (Shift = 1 cm), Cmd/Strg+Z / +Shift+Z.

### Speicherung
IndexedDB (`cases`, `trucks`, `plans`), Autosave 400 ms. Export = JSON-Datei (nur eigene Cases/Fahrzeuge + alle Pläne), Import = Zusammenführen nach `id` (neueres `updatedAt` gewinnt).

### Druck
A4 quer: Kopf (Plan, Fahrzeug, Datum, Gewicht/Nutzlast, Lademeter), Draufsicht + Seitenansicht mit Nummern, Ladeliste in Reihenfolge (Nr, Case, Inhalt, Lage, Position, Gewicht), Warnungen.

### Vorlagen (Richtwerte, recherchiert)
„Truckmaß“ = Case-Breiten 60/80/120 cm, die in 240 cm Innenbreite aufgehen (Megacase, Gäng-Case). US-„Truck Pack“: 22,5″ Raster, 45×22,5×30″ / 30×22,5×30″ / 22,5×22,5×30″ inkl. Rollen (OSP, Gator, Brady).

---

## Dateistruktur

```
index.html                 App-Shell
start.command              Doppelklick-Start (macOS), öffnet http://localhost:8765
package.json               {"type":"module"}, npm test
css/app.css  css/print.css
vendor/three.module.min.js  vendor/addons/controls/OrbitControls.js
js/app.js                  Controller: Store, Rendering, Events
js/state.js                Store + Undo/Redo
js/data/categories.js      Gewerke + Farben
js/data/preset-cases.js    Case-Vorlagen
js/data/preset-trucks.js   Fahrzeug-Vorlagen
js/model/geometry.js       Maße, Lage, Boxen, Snap, Schwerkraft, Stapel
js/model/validate.js       Prüfungen + Kennzahlen
js/model/packer.js         Auto-Beladung
js/model/actions.js        Plan-Operationen (rein)
js/store/io.js             Export/Import/Merge (rein)
js/store/db.js             IndexedDB
js/store/repo.js           Vorlagen + DB zusammenführen
js/ui/dom.js               esc(), h()-Helfer
js/ui/projection.js        2D-Projektion (rein)
js/ui/view2d.js            SVG-Render + Maus
js/ui/view3d.js            Three.js-Ansicht
js/ui/library.js           Bibliothek + Ablage
js/ui/case-editor.js  js/ui/truck-editor.js
js/ui/inspector.js         Auswahl + Kennzahlen
js/ui/print.js             Druckansicht
tests/*.test.js  tests/fixtures.js
```

---

### Task 1: Projekt-Setup

**Files:**
- Create: `package.json`, `start.command`, `.gitignore`, `README.md`, `tests/fixtures.js`, `tests/smoke.test.js`, `docs/superpowers/specs/2026-09-18-truckload-design.md`, `docs/superpowers/plans/2026-09-18-truckload.md`

**Interfaces:**
- Produces: `tests/fixtures.js` → `mkCase(id,l,w,h,extra)`, `mkTruck(extra)`, `P(id,caseId,x,y,z,extra)`, `plan(placements, unplaced)`, `byId(...cases)`, `counter(prefix)`.

- [ ] **Step 1: git init + Doku kopieren**

```bash
cd "/Users/marcohoch/Library/CloudStorage/Dropbox/Incomming/github/Truckload"
git init
mkdir -p docs/superpowers/specs docs/superpowers/plans
cp /Users/marcohoch/.claude/plans/ich-brauch-ein-tool-ancient-cray.md docs/superpowers/plans/2026-09-18-truckload.md
```
Den Abschnitt „Spec“ dieses Plans als `docs/superpowers/specs/2026-09-18-truckload-design.md` speichern (Überschrift `# Truckload – Design`).

- [ ] **Step 2: Dateien anlegen**

`package.json`:
```json
{ "name": "truckload", "private": true, "type": "module", "scripts": { "test": "node --test" } }
```

`start.command`:
```bash
#!/bin/bash
cd "$(dirname "$0")"
PORT=8765
( sleep 1; open "http://localhost:$PORT" ) &
python3 -m http.server $PORT
```
Danach `chmod +x start.command`.

`.gitignore`:
```
.DS_Store
node_modules/
```

`README.md`: Kurzbeschreibung, Start (`start.command` doppelklicken bzw. `python3 -m http.server 8765`), Tests (`npm test`), Hinweis „Daten liegen im Browser – regelmäßig *Sichern* (JSON-Export) in Dropbox ablegen“, Tastenkürzel.

`tests/fixtures.js`:
```js
export const mkCase = (id, l, w, h, extra = {}) => ({
  id, name: id, content: '', category: 'Sonstiges', color: '#999999',
  l, w, h, weight: 100, tippable: false, stackable: true, maxTopLoad: null, ...extra,
});
export const mkTruck = (extra = {}) => ({
  id: 't', name: 'T', l: 1360, w: 248, h: 270, payload: 24000, wheelArches: [], ...extra,
});
export const SPRINTER = mkTruck({ l: 430, w: 178, h: 194, payload: 1000,
  wheelArches: [{ x: 215, l: 100, w: 22, h: 30, side: 'both' }] });
export const P = (id, caseId, x, y, z, extra = {}) =>
  ({ id, caseId, x, y, z, orientation: 'standing', rot: 0, ...extra });
export const plan = (placements, unplaced = []) =>
  ({ id: 'plan', name: 'Test', truckId: 't', placements, unplaced, notes: '' });
export const byId = (...cases) => new Map(cases.map(c => [c.id, c]));
export const counter = (prefix = 'n') => { let i = 0; return () => `${prefix}${++i}`; };
```

`tests/smoke.test.js`:
```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkCase } from './fixtures.js';
test('fixtures laden', () => assert.equal(mkCase('a', 1, 2, 3).h, 3));
```

- [ ] **Step 3: Tests laufen lassen** – `npm test` → 1 pass.

- [ ] **Step 4: Commit**
```bash
git add -A && git commit -m "chore: Projekt-Setup, Spec und Plan"
```

---

### Task 2: Geometrie (`js/model/geometry.js`)

**Files:**
- Create: `js/model/geometry.js`
- Test: `tests/geometry.test.js`

**Interfaces:**
- Produces: `EPS`, `ORIENTATIONS`, `localDims(c, orientation)`, `effectiveDims(c, p) → {dx,dy,dz}`, `boxOf(c, p) → Box{x0,y0,z0,x1,y1,z1}`, `wheelFace(p) → 'bottom'|'+x'|'+y'|'-x'|'-y'`, `overlaps(A,B)`, `footprintOverlapArea(A,B)`, `footprintArea(B)`, `gravityZ(foot, boxes)`, `snap(v, grid=5)`, `snapToEdges(pos, len, edges, tol=8)`, `supportersOf(item, items)`, `stackAbove(rootId, items) → id[]` (inkl. root), `faceSlab(box, face, t)`. `items` = `[{id, box, ...}]`.

- [ ] **Step 1: Failing tests schreiben** – `tests/geometry.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { effectiveDims, boxOf, wheelFace, overlaps, footprintOverlapArea, gravityZ,
  snap, snapToEdges, stackAbove, faceSlab } from '../js/model/geometry.js';
import { mkCase } from './fixtures.js';

const C = mkCase('k', 120, 60, 80);
const B = (x0, y0, z0, x1, y1, z1) => ({ x0, y0, z0, x1, y1, z1 });

test('stehend 0°', () => assert.deepEqual(effectiveDims(C, { orientation: 'standing', rot: 0 }), { dx: 120, dy: 60, dz: 80 }));
test('stehend 90°', () => assert.deepEqual(effectiveDims(C, { orientation: 'standing', rot: 90 }), { dx: 60, dy: 120, dz: 80 }));
test('180° = 0°', () => assert.deepEqual(effectiveDims(C, { orientation: 'standing', rot: 180 }), { dx: 120, dy: 60, dz: 80 }));
test('gekippt Längsseite: Höhe wird Tiefe', () => assert.deepEqual(effectiveDims(C, { orientation: 'tipLong', rot: 0 }), { dx: 120, dy: 80, dz: 60 }));
test('gekippt Stirnseite: Länge wird Höhe', () => assert.deepEqual(effectiveDims(C, { orientation: 'tipShort', rot: 0 }), { dx: 80, dy: 60, dz: 120 }));
test('unbekannte Lage wirft', () => assert.throws(() => effectiveDims(C, { orientation: 'x', rot: 0 })));

test('boxOf', () => assert.deepEqual(boxOf(C, { x: 10, y: 20, z: 30, orientation: 'standing', rot: 0 }), B(10, 20, 30, 130, 80, 110)));

test('Rollenseite', () => {
  assert.equal(wheelFace({ orientation: 'standing', rot: 90 }), 'bottom');
  assert.equal(wheelFace({ orientation: 'tipLong', rot: 0 }), '+y');
  assert.equal(wheelFace({ orientation: 'tipLong', rot: 90 }), '-x');
  assert.equal(wheelFace({ orientation: 'tipShort', rot: 0 }), '+x');
  assert.equal(wheelFace({ orientation: 'tipShort', rot: 180 }), '-x');
});

test('berührende Boxen überlappen nicht', () => assert.equal(overlaps(B(0,0,0,10,10,10), B(10,0,0,20,10,10)), false));
test('überlappende Boxen', () => assert.equal(overlaps(B(0,0,0,10,10,10), B(5,5,5,20,20,20)), true));
test('Grundflächen-Überlappung', () => {
  assert.equal(footprintOverlapArea(B(0,0,0,10,10,10), B(5,0,50,15,10,60)), 50);
  assert.equal(footprintOverlapArea(B(0,0,0,10,10,10), B(10,0,0,20,10,10)), 0);
});
test('gravityZ = höchste Oberkante darunter', () => {
  assert.equal(gravityZ(B(0,0,0,10,10,0), []), 0);
  assert.equal(gravityZ(B(5,0,0,15,10,0), [B(0,0,0,10,10,60), B(0,0,60,10,10,90), B(50,0,0,60,10,200)]), 90);
});
test('snap', () => { assert.equal(snap(62), 60); assert.equal(snap(63), 65); assert.equal(snap(7, 1), 7); });
test('snapToEdges', () => {
  assert.equal(snapToEdges(115, 60, [120]), 120); // Anfang rastet
  assert.equal(snapToEdges(62, 60, [120]), 60);   // Ende rastet
  assert.equal(snapToEdges(200, 60, [120]), 200); // zu weit weg
});
test('stackAbove: nur was allein auf dem Stapel steht', () => {
  const items = [
    { id: 'A', box: B(0,0,0,100,60,60) },
    { id: 'Bx', box: B(0,0,60,100,60,120) },
    { id: 'C', box: B(0,0,120,100,60,180) },
    { id: 'D', box: B(100,0,0,200,60,60) },
    { id: 'E', box: B(50,0,60,150,60,100) }, // überbrückt A und D
  ];
  assert.deepEqual(stackAbove('A', items).sort(), ['A', 'Bx', 'C']);
});
test('faceSlab', () => {
  assert.deepEqual(faceSlab(B(0,0,0,100,60,50), '+x', 3), B(97,0,0,100,60,50));
  assert.deepEqual(faceSlab(B(0,0,0,100,60,50), 'bottom', 3), B(0,0,0,100,60,3));
  assert.deepEqual(faceSlab(B(0,0,0,100,60,50), '-y', 3), B(0,0,0,100,3,50));
});
```

- [ ] **Step 2: `npm test` → FAIL (Modul fehlt).**

- [ ] **Step 3: Implementierung** – `js/model/geometry.js`:

```js
export const EPS = 0.5;
export const ORIENTATIONS = ['standing', 'tipLong', 'tipShort'];
const FACE_CYCLE = ['+x', '+y', '-x', '-y'];
const BASE_WHEEL_FACE = { standing: 'bottom', tipLong: '+y', tipShort: '+x' };

export function localDims(c, orientation) {
  switch (orientation) {
    case 'standing': return { a: c.l, b: c.w, c: c.h };
    case 'tipLong':  return { a: c.l, b: c.h, c: c.w };
    case 'tipShort': return { a: c.h, b: c.w, c: c.l };
    default: throw new Error(`Unbekannte Lage: ${orientation}`);
  }
}

export function effectiveDims(c, p) {
  const { a, b, c: h } = localDims(c, p.orientation);
  return (p.rot ?? 0) % 180 === 90 ? { dx: b, dy: a, dz: h } : { dx: a, dy: b, dz: h };
}

export function boxOf(c, p) {
  const d = effectiveDims(c, p);
  return { x0: p.x, y0: p.y, z0: p.z, x1: p.x + d.dx, y1: p.y + d.dy, z1: p.z + d.dz };
}

export function wheelFace(p) {
  const base = BASE_WHEEL_FACE[p.orientation];
  if (base === 'bottom') return 'bottom';
  const i = FACE_CYCLE.indexOf(base);
  return FACE_CYCLE[(i + (p.rot ?? 0) / 90) % 4];
}

export function overlaps(A, B) {
  return A.x0 < B.x1 - EPS && B.x0 < A.x1 - EPS
      && A.y0 < B.y1 - EPS && B.y0 < A.y1 - EPS
      && A.z0 < B.z1 - EPS && B.z0 < A.z1 - EPS;
}

export function footprintOverlapArea(A, B) {
  const ox = Math.min(A.x1, B.x1) - Math.max(A.x0, B.x0);
  const oy = Math.min(A.y1, B.y1) - Math.max(A.y0, B.y0);
  return ox > EPS && oy > EPS ? ox * oy : 0;
}

export const footprintArea = B => (B.x1 - B.x0) * (B.y1 - B.y0);

export function gravityZ(foot, boxes) {
  let z = 0;
  for (const b of boxes) if (footprintOverlapArea(foot, b) > 0) z = Math.max(z, b.z1);
  return z;
}

export const snap = (v, grid = 5) => Math.round(v / grid) * grid;

export function snapToEdges(pos, len, edges, tol = 8) {
  let best = pos, bestDist = tol;
  for (const e of edges) {
    const d0 = Math.abs(pos - e);
    if (d0 < bestDist) { best = e; bestDist = d0; }
    const d1 = Math.abs(pos + len - e);
    if (d1 < bestDist) { best = e - len; bestDist = d1; }
  }
  return best;
}

export function supportersOf(item, items) {
  if (item.box.z0 <= EPS) return [];
  return items.filter(o => o.id !== item.id
    && Math.abs(o.box.z1 - item.box.z0) <= EPS
    && footprintOverlapArea(o.box, item.box) > 0);
}

export function stackAbove(rootId, items) {
  const set = new Set([rootId]);
  for (const it of [...items].sort((a, b) => a.box.z0 - b.box.z0)) {
    if (set.has(it.id) || it.box.z0 <= EPS) continue;
    const sup = supportersOf(it, items);
    if (sup.length && sup.every(s => set.has(s.id))) set.add(it.id);
  }
  return [...set];
}

export function faceSlab(b, face, t) {
  switch (face) {
    case '+x': return { ...b, x0: b.x1 - t };
    case '-x': return { ...b, x1: b.x0 + t };
    case '+y': return { ...b, y0: b.y1 - t };
    case '-y': return { ...b, y1: b.y0 + t };
    case 'bottom': return { ...b, z1: b.z0 + t };
    default: throw new Error(`Unbekannte Seite: ${face}`);
  }
}
```

- [ ] **Step 4: `npm test` → alle PASS.**

- [ ] **Step 5: Commit** – `git add -A && git commit -m "feat: Geometrie, Kipplagen, Snap und Stapel-Logik"`

---

### Task 3: Prüfungen & Kennzahlen (`js/model/validate.js`)

**Files:**
- Create: `js/model/validate.js`
- Test: `tests/validate.test.js`

**Interfaces:**
- Consumes: geometry.js (`EPS, boxOf, overlaps, footprintOverlapArea, footprintArea, supportersOf`).
- Produces:
  - `SUPPORT_MIN = 0.8`
  - `archBoxes(truck) → Box[]`
  - `buildItems(plan, caseById) → { items: [{id, p, c, box}], missing: Placement[] }`
  - `loadSequence(items) → Map<id, nr>`
  - `validatePlan(plan, caseById, truck) → { issues: [{placementId|null, code, message}], byPlacement: Map<id, issue[]>, load: Map<id, kg>, sequence: Map<id, nr>, items, totals: { weight, payload, cog: {x,y}|null, loadMeters, volumeRatio, count } }`

- [ ] **Step 1: Failing tests** – `tests/validate.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { validatePlan, archBoxes } from '../js/model/validate.js';
import { mkCase, mkTruck, SPRINTER, P, plan, byId } from './fixtures.js';

const K = mkCase('k', 120, 60, 60);
const codes = (r, id) => (r.byPlacement.get(id) ?? []).map(i => i.code).sort();
const planCodes = r => r.issues.filter(i => !i.placementId).map(i => i.code);

test('leerer Plan', () => {
  const r = validatePlan(plan([]), byId(K), mkTruck());
  assert.deepEqual(r.issues, []);
  assert.equal(r.totals.weight, 0);
  assert.equal(r.totals.cog, null);
});
test('Kollision auf beiden Cases', () => {
  const r = validatePlan(plan([P('a','k',0,0,0), P('b','k',60,0,0)]), byId(K), mkTruck());
  assert.deepEqual(codes(r,'a'), ['collision']);
  assert.deepEqual(codes(r,'b'), ['collision']);
});
test('über den Laderaum hinaus', () => {
  const r = validatePlan(plan([P('a','k',1300,0,0)]), byId(K), mkTruck());
  assert.deepEqual(codes(r,'a'), ['outOfBounds']);
});
test('schwebt ohne Auflage', () => {
  const r = validatePlan(plan([P('a','k',0,0,60)]), byId(K), mkTruck());
  assert.deepEqual(codes(r,'a'), ['unsupported']);
});
test('sauber gestapelt: keine Probleme, Last unten', () => {
  // y=94 → mittig (Mitte 124), sonst meldet die Prüfung „einseitig“
  const r = validatePlan(plan([P('a','k',0,94,0), P('b','k',0,94,60)]), byId(K), mkTruck());
  assert.deepEqual(r.issues, []);
  assert.equal(r.load.get('a'), 100);
});
test('halbe Auflage reicht nicht', () => {
  const r = validatePlan(plan([P('a','k',0,0,0), P('b','k',60,0,60)]), byId(K), mkTruck());
  assert.deepEqual(codes(r,'b'), ['unsupported']);
});
test('auf nicht stapelbarem Case', () => {
  const N = mkCase('n', 120, 60, 60, { stackable: false });
  const r = validatePlan(plan([P('a','n',0,0,0), P('b','k',0,0,60)]), byId(K, N), mkTruck());
  assert.deepEqual(codes(r,'b'), ['notStackable']);
});
test('Überlast wird durchgereicht', () => {
  const W = mkCase('w', 120, 60, 60, { maxTopLoad: 150 });
  const r = validatePlan(plan([P('a','w',0,0,0), P('b','k',0,0,60), P('c','k',0,0,120)]), byId(K, W), mkTruck());
  assert.equal(r.load.get('a'), 200);
  assert.deepEqual(codes(r,'a'), ['overload']);
});
test('gekippt, obwohl nicht kippbar', () => {
  const r = validatePlan(plan([P('a','k',0,0,0,{ orientation: 'tipLong' })]), byId(K), mkTruck());
  assert.deepEqual(codes(r,'a'), ['notTippable']);
});
test('Radkasten', () => {
  assert.equal(archBoxes(SPRINTER).length, 2);
  const S = mkCase('s', 60, 60, 60);
  const r = validatePlan(plan([P('a','s',220,0,0)]), byId(S), SPRINTER);
  assert.deepEqual(codes(r,'a'), ['arch']);
});
test('zu schwer', () => {
  const r = validatePlan(plan([P('a','k',0,0,0), P('b','k',0,60,0)]), byId(K), mkTruck({ payload: 150 }));
  assert.ok(planCodes(r).includes('tooHeavy'));
});
test('einseitige Ladung', () => {
  const r = validatePlan(plan([P('a','k',0,0,0)]), byId(K), mkTruck());
  assert.ok(planCodes(r).includes('imbalance'));
});
test('fehlender Case-Typ', () => {
  const r = validatePlan(plan([P('a','weg',0,0,0)]), byId(K), mkTruck());
  assert.deepEqual(codes(r,'a'), ['missingCase']);
});
test('Kennzahlen und Reihenfolge', () => {
  const r = validatePlan(plan([P('hinten','k',120,0,0), P('vorn','k',0,0,0)]), byId(K), mkTruck());
  assert.equal(r.totals.weight, 200);
  assert.equal(r.totals.cog.x, 120);
  assert.equal(r.totals.loadMeters, 2.4);
  assert.equal(r.sequence.get('vorn'), 1);
  assert.equal(r.sequence.get('hinten'), 2);
});
```

- [ ] **Step 2: `npm test` → FAIL.**

- [ ] **Step 3: Implementierung** – `js/model/validate.js`:

```js
import { EPS, boxOf, overlaps, footprintOverlapArea, footprintArea, supportersOf } from './geometry.js';

export const SUPPORT_MIN = 0.8;
export const IMBALANCE_RATIO = 0.1;

export function archBoxes(truck) {
  return (truck.wheelArches ?? []).flatMap(a => {
    const sides = a.side === 'both' ? ['left', 'right'] : [a.side];
    return sides.map(s => ({
      x0: a.x, x1: a.x + a.l,
      y0: s === 'left' ? 0 : truck.w - a.w,
      y1: s === 'left' ? a.w : truck.w,
      z0: 0, z1: a.h,
    }));
  });
}

export function buildItems(plan, caseById) {
  const items = [], missing = [];
  for (const p of plan.placements) {
    const c = caseById.get(p.caseId);
    if (!c) { missing.push(p); continue; }
    items.push({ id: p.id, p, c, box: boxOf(c, p) });
  }
  return { items, missing };
}

export function loadSequence(items) {
  const sorted = [...items].sort((a, b) =>
    a.box.x0 - b.box.x0 || a.box.y0 - b.box.y0 || a.box.z0 - b.box.z0);
  return new Map(sorted.map((it, i) => [it.id, i + 1]));
}

export function validatePlan(plan, caseById, truck) {
  const { items, missing } = buildItems(plan, caseById);
  const issues = [];
  const add = (placementId, code, message) => issues.push({ placementId, code, message });
  const arches = archBoxes(truck);

  for (const p of missing) add(p.id, 'missingCase', 'Case-Typ ist nicht mehr in der Bibliothek.');

  for (const it of items) {
    const b = it.box, n = it.c.name;
    if (b.x0 < -EPS || b.y0 < -EPS || b.z0 < -EPS
      || b.x1 > truck.l + EPS || b.y1 > truck.w + EPS || b.z1 > truck.h + EPS)
      add(it.id, 'outOfBounds', `${n} ragt über den Laderaum hinaus.`);
    if (arches.some(a => overlaps(a, b))) add(it.id, 'arch', `${n} kollidiert mit einem Radkasten.`);
    if (it.p.orientation !== 'standing' && !it.c.tippable) add(it.id, 'notTippable', `${n} darf nicht gekippt werden.`);
  }

  for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
    if (!overlaps(items[i].box, items[j].box)) continue;
    add(items[i].id, 'collision', `${items[i].c.name} überschneidet sich mit ${items[j].c.name}.`);
    add(items[j].id, 'collision', `${items[j].c.name} überschneidet sich mit ${items[i].c.name}.`);
  }

  const supporters = new Map();
  for (const it of items) {
    if (it.box.z0 <= EPS) continue;
    const sup = supportersOf(it, items);
    supporters.set(it.id, sup);
    const archSup = arches.filter(a => Math.abs(a.z1 - it.box.z0) <= EPS);
    const area = [...sup.map(s => s.box), ...archSup]
      .reduce((s, bx) => s + footprintOverlapArea(bx, it.box), 0);
    if (area / footprintArea(it.box) < SUPPORT_MIN)
      add(it.id, 'unsupported', `${it.c.name} steht nicht sicher (unter ${SUPPORT_MIN * 100} % Auflage).`);
    for (const s of sup) if (!s.c.stackable)
      add(it.id, 'notStackable', `${it.c.name} steht auf ${s.c.name}, das nicht stapelbar ist.`);
  }

  const load = new Map(items.map(it => [it.id, 0]));
  for (const it of [...items].sort((a, b) => b.box.z0 - a.box.z0)) {
    const sup = supporters.get(it.id) ?? [];
    const areas = sup.map(s => footprintOverlapArea(s.box, it.box));
    const sum = areas.reduce((a, b) => a + b, 0);
    if (!sum) continue;
    const total = it.c.weight + load.get(it.id);
    sup.forEach((s, k) => load.set(s.id, load.get(s.id) + total * areas[k] / sum));
  }
  for (const it of items) {
    const max = it.c.maxTopLoad;
    if (max != null && load.get(it.id) > max + 1e-6)
      add(it.id, 'overload', `Auf ${it.c.name} lasten ${Math.round(load.get(it.id))} kg (max. ${max} kg).`);
  }

  const weight = items.reduce((s, it) => s + it.c.weight, 0);
  if (weight > truck.payload)
    add(null, 'tooHeavy', `Gesamtgewicht ${Math.round(weight)} kg überschreitet die Nutzlast von ${truck.payload} kg.`);

  const cog = weight ? {
    x: items.reduce((s, it) => s + it.c.weight * (it.box.x0 + it.box.x1) / 2, 0) / weight,
    y: items.reduce((s, it) => s + it.c.weight * (it.box.y0 + it.box.y1) / 2, 0) / weight,
  } : null;
  if (cog && Math.abs(cog.y - truck.w / 2) > IMBALANCE_RATIO * truck.w)
    add(null, 'imbalance', `Ladung ist einseitig: Schwerpunkt ${Math.round(Math.abs(cog.y - truck.w / 2))} cm aus der Mitte.`);

  const volume = items.reduce((s, { box: b }) => s + (b.x1 - b.x0) * (b.y1 - b.y0) * (b.z1 - b.z0), 0);

  const byPlacement = new Map();
  for (const is of issues) if (is.placementId) {
    if (!byPlacement.has(is.placementId)) byPlacement.set(is.placementId, []);
    byPlacement.get(is.placementId).push(is);
  }

  return {
    issues, byPlacement, load, items, sequence: loadSequence(items),
    totals: {
      weight, payload: truck.payload, cog,
      loadMeters: items.length ? Math.max(...items.map(it => it.box.x1)) / 100 : 0,
      volumeRatio: volume / (truck.l * truck.w * truck.h),
      count: items.length,
    },
  };
}
```

- [ ] **Step 4: `npm test` → PASS.** (Hinweis: Im Test „einseitige Ladung“ liegt der Schwerpunkt bei y=30, Mitte 124 → 94 cm > 24,8 cm.)

- [ ] **Step 5: Commit** – `git add -A && git commit -m "feat: Ladungsprüfung, Lastverteilung und Kennzahlen"`

---

### Task 4: Auto-Beladung (`js/model/packer.js`)

**Files:**
- Create: `js/model/packer.js`
- Test: `tests/packer.test.js`

**Interfaces:**
- Consumes: `ORIENTATIONS, effectiveDims, overlaps` (geometry.js), `archBoxes` (validate.js).
- Produces:
  - `chooseOrientation(c, truck) → { orientation, rot: 0|90, d: {dx,dy,dz}, score } | null` (null = passt nicht)
  - `buildStacks(caseList, truck) → { stacks: [{key, dx, dy, height, weight, items: [{c, o, z}]}], unplaced: Case[] }`
  - `placeStacks(stacks, truck, obstacles=[]) → { placed: [{stack, box, swap}], failed: stack[] }`
  - `autoPack(caseList, truck, { obstacles=[], newId }) → { placements: Placement[], unplaced: caseId[] }` – `caseList` ist ein Case-Objekt **pro Stück**.

- [ ] **Step 1: Failing tests** – `tests/packer.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { chooseOrientation, buildStacks, autoPack } from '../js/model/packer.js';
import { validatePlan } from '../js/model/validate.js';
import { mkCase, mkTruck, SPRINTER, plan, byId, counter } from './fixtures.js';

const times = (c, n) => Array.from({ length: n }, () => c);
const placementIssues = r => r.issues.filter(i => i.placementId);

test('nicht kippbar → stehend', () => {
  const c = mkCase('a', 120, 60, 100, { tippable: false });
  assert.equal(chooseOrientation(c, mkTruck()).orientation, 'standing');
});
test('kippbar → gekippt, wenn es besser füllt', () => {
  const c = mkCase('a', 120, 60, 100, { tippable: true });
  assert.notEqual(chooseOrientation(c, mkTruck()).orientation, 'standing');
});
test('zu groß → null', () => {
  assert.equal(chooseOrientation(mkCase('a', 2000, 60, 60), mkTruck()), null);
});
test('Stapel respektieren maxTopLoad', () => {
  const c = mkCase('a', 120, 60, 60, { maxTopLoad: 150 });
  const { stacks } = buildStacks(times(c, 4), mkTruck());
  assert.deepEqual(stacks.map(s => s.items.length), [2, 2]);
});
test('nicht stapelbar → Einzelstapel', () => {
  const c = mkCase('a', 120, 60, 60, { stackable: false });
  assert.equal(buildStacks(times(c, 3), mkTruck()).stacks.length, 3);
});
test('10 Kabelcases: 3 Stapel an der Stirnwand, fehlerfrei', () => {
  const K = mkCase('k', 120, 60, 60);
  const truck = mkTruck();
  const { placements, unplaced } = autoPack(times(K, 10), truck, { newId: counter('p') });
  assert.equal(placements.length, 10);
  assert.deepEqual(unplaced, []);
  assert.ok(placements.every(p => p.x === 0));
  assert.equal(Math.max(...placements.map(p => p.z)), 180);
  assert.deepEqual(placementIssues(validatePlan(plan(placements), byId(K), truck)), []);
});
test('Sprinter mit Radkästen: fehlerfrei, nichts geht verloren', () => {
  const S = mkCase('s', 60, 60, 60);
  const { placements, unplaced } = autoPack(times(S, 40), SPRINTER, { newId: counter('p') });
  assert.equal(placements.length + unplaced.length, 40);
  assert.ok(placements.length > 20);
  assert.deepEqual(placementIssues(validatePlan(plan(placements), byId(S), SPRINTER)), []);
});
test('Hindernisse werden umgangen', () => {
  const K = mkCase('k', 120, 60, 60);
  const obstacles = [{ x0: 0, y0: 0, z0: 0, x1: 120, y1: 248, z1: 60 }];
  const { placements } = autoPack([K], mkTruck(), { obstacles, newId: counter('p') });
  assert.equal(placements[0].x, 120);
});
```

- [ ] **Step 2: `npm test` → FAIL.**

- [ ] **Step 3: Implementierung** – `js/model/packer.js`:

```js
import { ORIENTATIONS, effectiveDims, overlaps } from './geometry.js';
import { archBoxes } from './validate.js';

export function chooseOrientation(c, truck) {
  const opts = [];
  for (const orientation of c.tippable ? ORIENTATIONS : ['standing']) {
    for (const rot of [0, 90]) {
      const d = effectiveDims(c, { orientation, rot });
      if (d.dx > truck.l || d.dy > truck.w || d.dz > truck.h) continue;
      const layers = c.stackable ? Math.floor(truck.h / d.dz) : 1;
      const cols = Math.floor(truck.w / d.dy);
      const score = (cols * d.dy / truck.w) * (layers * d.dz / truck.h);
      opts.push({ orientation, rot, d, score });
    }
  }
  const pref = o => (o.orientation === 'standing' ? 0 : 1) * 2 + (o.rot ? 1 : 0);
  opts.sort((p, q) => q.score - p.score || pref(p) - pref(q));
  return opts[0] ?? null;
}

function canAddToStack(stack, c, dz, truck) {
  if (stack.height + dz > truck.h + 1e-6) return false;
  if (!stack.items.at(-1).c.stackable) return false;
  let above = c.weight;
  for (let i = stack.items.length - 1; i >= 0; i--) {
    const s = stack.items[i].c;
    if (s.maxTopLoad != null && above > s.maxTopLoad) return false;
    above += s.weight;
  }
  return true;
}

export function buildStacks(caseList, truck) {
  const stacks = [], unplaced = [];
  const entries = caseList.map(c => ({ c, o: chooseOrientation(c, truck) }));
  for (const e of entries) if (!e.o) unplaced.push(e.c);
  const ok = entries.filter(e => e.o).sort((a, b) =>
    b.c.weight - a.c.weight || b.o.d.dx * b.o.d.dy - a.o.d.dx * a.o.d.dy);
  for (const { c, o } of ok) {
    const key = `${o.d.dx}x${o.d.dy}`;
    const target = stacks.find(s => s.key === key && canAddToStack(s, c, o.d.dz, truck));
    if (target) {
      target.items.push({ c, o, z: target.height });
      target.height += o.d.dz;
      target.weight += c.weight;
    } else {
      stacks.push({ key, dx: o.d.dx, dy: o.d.dy, height: o.d.dz, weight: c.weight, items: [{ c, o, z: 0 }] });
    }
  }
  return { stacks, unplaced };
}

export function placeStacks(stacks, truck, obstacles = []) {
  const blocked = [...archBoxes(truck), ...obstacles];
  const points = [{ x: 0, y: 0 }, ...blocked.flatMap(b => [
    { x: b.x1, y: b.y0 }, { x: b.x0, y: b.y1 }, { x: b.x1, y: 0 }, { x: 0, y: b.y1 },
  ])];
  const placed = [], failed = [];
  for (const s of [...stacks].sort((a, b) => b.weight - a.weight)) {
    points.sort((p, q) => p.x - q.x || p.y - q.y);
    let hit = null;
    for (const pt of points) {
      for (const swap of s.dx === s.dy ? [false] : [false, true]) {
        const dx = swap ? s.dy : s.dx, dy = swap ? s.dx : s.dy;
        const box = { x0: pt.x, y0: pt.y, z0: 0, x1: pt.x + dx, y1: pt.y + dy, z1: s.height };
        if (box.x1 > truck.l + 1e-6 || box.y1 > truck.w + 1e-6) continue;
        if (blocked.some(b => overlaps(b, box))) continue;
        hit = { box, swap };
        break;
      }
      if (hit) break;
    }
    if (!hit) { failed.push(s); continue; }
    blocked.push(hit.box);
    placed.push({ stack: s, ...hit });
    points.push({ x: hit.box.x1, y: hit.box.y0 }, { x: hit.box.x0, y: hit.box.y1 });
  }
  return { placed, failed };
}

export function autoPack(caseList, truck, { obstacles = [], newId } = {}) {
  const { stacks, unplaced } = buildStacks(caseList, truck);
  const { placed, failed } = placeStacks(stacks, truck, obstacles);
  const placements = [];
  for (const { stack, box, swap } of placed) {
    for (const it of stack.items) {
      placements.push({
        id: newId(), caseId: it.c.id, x: box.x0, y: box.y0, z: it.z,
        orientation: it.o.orientation, rot: swap ? (it.o.rot + 90) % 180 : it.o.rot,
      });
    }
  }
  const left = [...unplaced, ...failed.flatMap(s => s.items.map(i => i.c))];
  return { placements, unplaced: left.map(c => c.id) };
}
```

- [ ] **Step 4: `npm test` → PASS.** Falls der Sprinter-Test „arch“ meldet: prüfen, dass `placeStacks` Radkästen in `blocked` hat (3D-Overlap Stapel z0=0 vs. Radkasten).

- [ ] **Step 5: Commit** – `git add -A && git commit -m "feat: Auto-Beladung mit Stapeln und Extreme-Point-Platzierung"`

---

### Task 5: Gewerke & Vorlagen

**Files:**
- Create: `js/data/categories.js`, `js/data/preset-cases.js`, `js/data/preset-trucks.js`
- Test: `tests/presets.test.js`

**Interfaces:**
- Produces: `CATEGORIES: [{name,color}]`, `colorFor(name)`, `PRESET_CASES: Case[]`, `PRESET_TRUCKS: Truck[]`, `DEFAULT_TRUCK_ID = 'preset-sattel'`.

- [ ] **Step 1: Failing tests** – `tests/presets.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { CATEGORIES, colorFor } from '../js/data/categories.js';
import { PRESET_CASES } from '../js/data/preset-cases.js';
import { PRESET_TRUCKS, DEFAULT_TRUCK_ID } from '../js/data/preset-trucks.js';

const unique = xs => new Set(xs).size === xs.length;

test('Farbe pro Gewerk, Fallback Sonstiges', () => {
  assert.equal(colorFor('Licht'), CATEGORIES.find(c => c.name === 'Licht').color);
  assert.equal(colorFor('gibt es nicht'), colorFor('Sonstiges'));
});
test('Case-Vorlagen gültig', () => {
  assert.ok(unique(PRESET_CASES.map(c => c.id)));
  const mega = PRESET_TRUCKS.find(t => t.id === 'preset-mega');
  for (const c of PRESET_CASES) {
    assert.ok(c.builtin && c.id.startsWith('preset-'), c.id);
    assert.ok(c.l > 0 && c.w > 0 && c.h > 0 && c.weight >= 0, c.id);
    assert.ok(CATEGORIES.some(k => k.name === c.category), c.id);
    assert.ok(c.l <= mega.l && c.w <= mega.w && c.h <= mega.h, c.id);
  }
});
test('Fahrzeug-Vorlagen gültig', () => {
  assert.ok(unique(PRESET_TRUCKS.map(t => t.id)));
  assert.ok(PRESET_TRUCKS.some(t => t.id === DEFAULT_TRUCK_ID));
  for (const t of PRESET_TRUCKS) assert.ok(t.builtin && t.l > 0 && t.w > 0 && t.h > 0 && t.payload > 0, t.id);
});
```

- [ ] **Step 2: `npm test` → FAIL.**

- [ ] **Step 3: Implementierung**

`js/data/categories.js`:
```js
export const CATEGORIES = [
  { name: 'Licht', color: '#e8b10c' },
  { name: 'Ton', color: '#3b7dd8' },
  { name: 'Video', color: '#8a5cd6' },
  { name: 'Rigging', color: '#6b7a8f' },
  { name: 'Strom', color: '#e8741c' },
  { name: 'Bühne', color: '#a07845' },
  { name: 'Backline', color: '#1fa67a' },
  { name: 'Sonstiges', color: '#9aa3ad' },
];
export const colorFor = name =>
  (CATEGORIES.find(c => c.name === name) ?? CATEGORIES.at(-1)).color;
```

`js/data/preset-cases.js` (Maße cm stehend inkl. Rollen, Gewicht = beladen, Richtwert):
```js
import { colorFor } from './categories.js';

const NOTE = 'Richtwert – Maße und Gewicht an dein Case anpassen';
const P = (id, name, category, l, w, h, weight, opts = {}) => ({
  id: `preset-${id}`, builtin: true, name, content: '', category, color: colorFor(category),
  l, w, h, weight, tippable: true, stackable: true, maxTopLoad: null, stock: null, note: NOTE, ...opts,
});

// Truckmaß (EU): Breiten 60/80/120 cm, gehen in 240 cm Innenbreite auf (Megacase, Gäng-Case).
// Truck Pack (US): 22,5″-Raster, Höhe 30″ inkl. Rollen (OSP, Gator, Brady).
export const PRESET_CASES = [
  P('kabel-120x60x60', 'Kabelcase Truckmaß 120×60×60', 'Strom', 120, 60, 60, 110),
  P('kabel-120x60x80', 'Kabelcase Truckmaß 120×60×80', 'Strom', 120, 60, 80, 140),
  P('pack-80x60x60', 'Packcase Truckmaß 80×60×60', 'Sonstiges', 80, 60, 60, 70),
  P('pack-60x60x60', 'Packcase Truckmaß 60×60×60', 'Sonstiges', 60, 60, 60, 50),
  P('pack-120x80x80', 'Packcase Truckmaß 120×80×80', 'Sonstiges', 120, 80, 80, 150),
  P('us-full', 'Truck Pack 45×22,5×30″ (US)', 'Sonstiges', 114, 57, 76, 120),
  P('us-half', 'Truck Pack ½ 30×22,5×30″ (US)', 'Sonstiges', 76, 57, 76, 80),
  P('us-quarter', 'Truck Pack ¼ 22,5×22,5×30″ (US)', 'Sonstiges', 57, 57, 76, 55),
  P('rack-12he', '19″-Rack 12 HE auf Rollen', 'Ton', 80, 60, 85, 90, { tippable: false }),
  P('rack-20he', '19″-Rack 20 HE auf Rollen', 'Ton', 80, 60, 120, 140, { tippable: false, maxTopLoad: 80 }),
  P('mh-2er', 'Moving-Head-Case (2 Stück)', 'Licht', 120, 60, 85, 120, { tippable: false }),
  P('led-8er', 'LED-Wall-Case (8 Panels)', 'Video', 120, 60, 110, 220, { tippable: false }),
  P('distro-63a', 'Stromverteiler 63 A', 'Strom', 80, 60, 90, 110, { tippable: false }),
  P('foh-pult', 'FOH-Pult-Case', 'Ton', 150, 80, 110, 160, { tippable: false, stackable: false }),
  P('truss-29-3m', 'Traverse 29er Dreipunkt 3 m', 'Rigging', 300, 29, 29, 15, { tippable: false }),
  P('truss-dolly', 'Traversen-Dolly 29er (8× 2 m)', 'Rigging', 200, 60, 70, 180, { tippable: false }),
];
```

`js/data/preset-trucks.js` (Innenmaße cm, Nutzlast kg, Richtwerte):
```js
const NOTE = 'Richtwert – mit dem echten Fahrzeug abgleichen';
const T = (id, name, l, w, h, payload, wheelArches = []) =>
  ({ id: `preset-${id}`, builtin: true, name, l, w, h, payload, wheelArches, note: NOTE });

export const PRESET_TRUCKS = [
  T('sprinter', 'Transporter (Sprinter L3H2)', 430, 178, 194, 1000,
    [{ x: 215, l: 100, w: 22, h: 30, side: 'both' }]),
  T('koffer35', '3,5-t-Koffer', 420, 210, 220, 900),
  T('lkw75', 'LKW 7,5 t', 620, 245, 240, 2800),
  T('lkw12', 'LKW 12 t', 720, 245, 250, 5000),
  T('sattel', 'Sattelauflieger Standard', 1360, 248, 270, 24000),
  T('mega', 'Megatrailer', 1360, 248, 300, 24000),
];
export const DEFAULT_TRUCK_ID = 'preset-sattel';
```

- [ ] **Step 4: `npm test` → PASS.**
- [ ] **Step 5: Commit** – `git add -A && git commit -m "feat: Gewerke, Case- und Fahrzeug-Vorlagen"`

---

### Task 6: Speicherung – Import/Export, IndexedDB, Repository

**Files:**
- Create: `js/store/io.js`, `js/store/db.js`, `js/store/repo.js`
- Test: `tests/io.test.js` (db/repo brauchen den Browser → manuell in Task 13)

**Interfaces:**
- Produces:
  - io.js: `FORMAT='truckload'`, `VERSION=1`, `exportBundle({cases,trucks,plans}, now=new Date()) → string`, `parseBundle(text) → {cases,trucks,plans}` (wirft `Error` mit deutscher Meldung), `mergeById(existing, incoming) → array`, `backupFileName(now) → 'truckload-backup-YYYY-MM-DD.json'`
  - db.js: `getAll(store)`, `put(store, obj)`, `del(store, id)`, `persist()`; Stores `'cases'|'trucks'|'plans'`
  - repo.js: `loadAll() → {cases, trucks, plans}` (Vorlagen + eigene), `saveCase(c)`, `deleteCase(id)`, `saveTruck(t)`, `deleteTruck(id)`, `savePlan(p)`, `deletePlan(id)`, `stamp(obj) → {...obj, updatedAt}`

- [ ] **Step 1: Failing tests** – `tests/io.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { exportBundle, parseBundle, mergeById, backupFileName } from '../js/store/io.js';
import { mkCase, mkTruck, plan } from './fixtures.js';

const own = mkCase('own', 120, 60, 60);
const builtin = { ...mkCase('preset-x', 1, 1, 1), builtin: true };

test('Export enthält nur eigene Cases/Fahrzeuge und alle Pläne', () => {
  const json = JSON.parse(exportBundle({ cases: [own, builtin], trucks: [mkTruck(), { ...mkTruck(), id: 'b', builtin: true }], plans: [plan([])] }, new Date('2026-09-18T10:00:00Z')));
  assert.equal(json.format, 'truckload');
  assert.equal(json.version, 1);
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
```

- [ ] **Step 2: `npm test` → FAIL.**

- [ ] **Step 3: Implementierung**

`js/store/io.js`:
```js
export const FORMAT = 'truckload';
export const VERSION = 1;

const num = v => typeof v === 'number' && Number.isFinite(v);
const arr = v => (Array.isArray(v) ? v : []);

function checkCase(c) {
  if (!c || typeof c.id !== 'string' || typeof c.name !== 'string') throw new Error('Case ohne ID oder Name in der Datei.');
  for (const k of ['l', 'w', 'h']) if (!num(c[k]) || c[k] <= 0) throw new Error(`Case „${c.name}“ hat ungültige Maße.`);
  if (!num(c.weight) || c.weight < 0) throw new Error(`Case „${c.name}“ hat ein ungültiges Gewicht.`);
}
function checkTruck(t) {
  if (!t || typeof t.id !== 'string' || typeof t.name !== 'string') throw new Error('Fahrzeug ohne ID oder Name in der Datei.');
  for (const k of ['l', 'w', 'h', 'payload']) if (!num(t[k]) || t[k] <= 0) throw new Error(`Fahrzeug „${t.name}“ hat ungültige Werte.`);
}
function checkPlan(p) {
  if (!p || typeof p.id !== 'string' || typeof p.name !== 'string' || !Array.isArray(p.placements))
    throw new Error('Ungültiger Ladeplan in der Datei.');
}

export function exportBundle({ cases, trucks, plans }, now = new Date()) {
  return JSON.stringify({
    format: FORMAT, version: VERSION, exportedAt: now.toISOString(),
    cases: cases.filter(c => !c.builtin), trucks: trucks.filter(t => !t.builtin), plans,
  }, null, 2);
}

export function parseBundle(text) {
  let data;
  try { data = JSON.parse(text); } catch { throw new Error('Die Datei ist kein gültiges JSON.'); }
  if (data?.format !== FORMAT) throw new Error('Keine Truckload-Datei.');
  if (!num(data.version) || data.version > VERSION) throw new Error('Die Datei stammt aus einer neueren Version.');
  const cases = arr(data.cases), trucks = arr(data.trucks);
  const plans = arr(data.plans).map(p => ({ ...p, unplaced: arr(p?.unplaced), notes: p?.notes ?? '' }));
  cases.forEach(checkCase); trucks.forEach(checkTruck); plans.forEach(checkPlan);
  return { cases, trucks, plans };
}

export function mergeById(existing, incoming) {
  const map = new Map(existing.map(x => [x.id, x]));
  for (const x of incoming) {
    const cur = map.get(x.id);
    if (!cur || (x.updatedAt ?? '') >= (cur.updatedAt ?? '')) map.set(x.id, x);
  }
  return [...map.values()];
}

export const backupFileName = (now = new Date()) =>
  `truckload-backup-${now.toISOString().slice(0, 10)}.json`;
```

`js/store/db.js`:
```js
const DB_NAME = 'truckload';
const DB_VERSION = 1;
const STORES = ['cases', 'trucks', 'plans'];
let dbPromise;

function open() {
  return (dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      for (const s of STORES) if (!req.result.objectStoreNames.contains(s))
        req.result.createObjectStore(s, { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  }));
}

function run(store, mode, fn) {
  return open().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(store, mode);
    const req = fn(tx.objectStore(store));
    tx.oncomplete = () => resolve(req?.result);
    tx.onerror = () => reject(tx.error);
  }));
}

export const getAll = store => run(store, 'readonly', s => s.getAll());
export const put = (store, value) => run(store, 'readwrite', s => s.put(value));
export const del = (store, id) => run(store, 'readwrite', s => s.delete(id));
export async function persist() {
  try { await navigator.storage?.persist?.(); } catch { /* optional */ }
}
```

`js/store/repo.js`:
```js
import * as db from './db.js';
import { PRESET_CASES } from '../data/preset-cases.js';
import { PRESET_TRUCKS } from '../data/preset-trucks.js';

export const stamp = obj => ({ ...obj, updatedAt: new Date().toISOString() });

export async function loadAll() {
  await db.persist();
  const [cases, trucks, plans] = await Promise.all([db.getAll('cases'), db.getAll('trucks'), db.getAll('plans')]);
  return { cases: [...PRESET_CASES, ...cases], trucks: [...PRESET_TRUCKS, ...trucks], plans };
}
export const saveCase = c => db.put('cases', c);
export const deleteCase = id => db.del('cases', id);
export const saveTruck = t => db.put('trucks', t);
export const deleteTruck = id => db.del('trucks', id);
export const savePlan = p => db.put('plans', p);
export const deletePlan = id => db.del('plans', id);
```

- [ ] **Step 4: `npm test` → PASS.**
- [ ] **Step 5: Commit** – `git add -A && git commit -m "feat: Import/Export, IndexedDB und Repository"`

---

### Task 7: Plan-Aktionen & Undo (`js/model/actions.js`, `js/state.js`)

**Files:**
- Create: `js/model/actions.js`, `js/state.js`
- Test: `tests/actions.test.js`, `tests/state.test.js`

**Interfaces:**
- Consumes: geometry.js, validate.js (`archBoxes, buildItems`), packer.js (`autoPack`).
- `ctx = { caseById: Map, truck, newId: () => string }`
- Produces (alle rein, geben neuen Plan zurück oder denselben, wenn nichts passiert):
  - `emptyPlan(id, name, truckId)`
  - `addUnplaced(plan, caseId, n, newId)`
  - `placeCase(plan, caseId, x, y, ctx, fromUnplacedId=null)` – x/y = linke/vordere Ecke, Raster 5, z per Schwerkraft
  - `moveGroup(plan, id, x, y, ctx, { grid=5, edges=true }={})` – verschiebt Case + was allein darauf steht
  - `rotate(plan, id, ctx)`, `cycleTip(plan, id, ctx)`, `duplicate(plan, id, ctx)`
  - `removePlacement(plan, id)`, `toTray(plan, id)`, `removeUnplaced(plan, caseId)` (entfernt ein Stück)
  - `packAll(plan, ctx)`, `packRest(plan, ctx)`
  - state.js: `createStore(initial, {limit=50}) → { get, subscribe(fn) → unsubscribe, update(fn, {history=false}), checkpoint(), undo(), redo(), resetHistory(), canUndo(), canRedo() }` – Historie umfasst nur `state.plan`.

- [ ] **Step 1: Failing tests** – `tests/actions.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import * as A from '../js/model/actions.js';
import { validatePlan } from '../js/model/validate.js';
import { mkCase, mkTruck, P, plan, byId, counter } from './fixtures.js';

const K = mkCase('k', 120, 60, 60);
const T = mkCase('t', 120, 60, 100, { tippable: true });
const ctx = () => ({ caseById: byId(K, T), truck: mkTruck(), newId: counter('n') });
const find = (pl, id) => pl.placements.find(p => p.id === id);

test('placeCase stapelt per Schwerkraft', () => {
  const pl = A.placeCase(plan([P('a','k',0,0,0)]), 'k', 12, 0, ctx());
  const p = pl.placements.at(-1);
  assert.equal(p.x, 10);
  assert.equal(p.z, 60);
});
test('placeCase aus der Ablage entfernt das Stück dort', () => {
  const pl = A.placeCase(plan([], [{ id: 'u1', caseId: 'k' }]), 'k', 0, 0, ctx(), 'u1');
  assert.equal(pl.unplaced.length, 0);
  assert.equal(pl.placements[0].id, 'u1');
});
test('moveGroup nimmt den Stapel mit', () => {
  const pl = A.moveGroup(plan([P('a','k',0,0,0), P('b','k',0,0,60)]), 'a', 300, 100, ctx());
  assert.deepEqual([find(pl,'b').x, find(pl,'b').y, find(pl,'b').z], [300, 100, 60]);
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
test('cycleTip nur bei kippbaren Cases', () => {
  assert.equal(find(A.cycleTip(plan([P('a','k',0,0,0)]), 'a', ctx()), 'a').orientation, 'standing');
  assert.equal(find(A.cycleTip(plan([P('a','t',0,0,0)]), 'a', ctx()), 'a').orientation, 'tipLong');
});
test('toTray und addUnplaced', () => {
  let pl = A.toTray(plan([P('a','k',0,0,0)]), 'a');
  assert.deepEqual(pl.unplaced, [{ id: 'a', caseId: 'k' }]);
  pl = A.addUnplaced(pl, 'k', 3, counter('u'));
  assert.equal(pl.unplaced.length, 4);
  pl = A.removeUnplaced(pl, 'k');
  assert.equal(pl.unplaced.length, 3);
});
test('duplicate setzt daneben', () => {
  const pl = A.duplicate(plan([P('a','k',0,0,0)]), 'a', ctx());
  assert.equal(pl.placements[1].x, 120);
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
```

`tests/state.test.js`:
```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '../js/state.js';

test('undo/redo nur für den Plan', () => {
  const s = createStore({ plan: { v: 1 }, selectedId: null });
  let calls = 0; s.subscribe(() => calls++);
  s.update(st => ({ ...st, plan: { v: 2 } }), { history: true });
  s.update(st => ({ ...st, selectedId: 'x' }));
  assert.equal(s.canUndo(), true);
  s.undo();
  assert.deepEqual(s.get().plan, { v: 1 });
  assert.equal(s.get().selectedId, 'x');
  s.redo();
  assert.deepEqual(s.get().plan, { v: 2 });
  assert.equal(calls, 4);
});
test('checkpoint vor Drag', () => {
  const s = createStore({ plan: { v: 1 } });
  s.checkpoint();
  s.update(st => ({ ...st, plan: { v: 2 } }));
  s.update(st => ({ ...st, plan: { v: 3 } }));
  s.undo();
  assert.deepEqual(s.get().plan, { v: 1 });
});
test('Limit', () => {
  const s = createStore({ plan: { v: 0 } }, { limit: 2 });
  for (let i = 1; i <= 5; i++) s.update(st => ({ ...st, plan: { v: i } }), { history: true });
  s.undo(); s.undo(); s.undo();
  assert.deepEqual(s.get().plan, { v: 3 });
});
test('unverändert → kein Event', () => {
  const s = createStore({ plan: {} });
  let calls = 0; s.subscribe(() => calls++);
  s.update(st => st, { history: true });
  assert.equal(calls, 0);
  assert.equal(s.canUndo(), false);
});
```

- [ ] **Step 2: `npm test` → FAIL.**

- [ ] **Step 3: Implementierung**

`js/model/actions.js`:
```js
import { ORIENTATIONS, boxOf, effectiveDims, gravityZ, snap, snapToEdges, stackAbove } from './geometry.js';
import { archBoxes, buildItems } from './validate.js';
import { autoPack } from './packer.js';

const touch = plan => ({ ...plan, updatedAt: new Date().toISOString() });

export const emptyPlan = (id, name, truckId) =>
  touch({ id, name, truckId, placements: [], unplaced: [], notes: '' });

function otherBoxes(plan, ctx, excludeIds) {
  const { items } = buildItems(plan, ctx.caseById);
  return [...items.filter(it => !excludeIds.includes(it.id)).map(it => it.box), ...archBoxes(ctx.truck)];
}

function settle(p, c, others) {
  return { ...p, z: gravityZ(boxOf(c, { ...p, z: 0 }), others) };
}

export function addUnplaced(plan, caseId, n, newId) {
  const extra = Array.from({ length: n }, () => ({ id: newId(), caseId }));
  return touch({ ...plan, unplaced: [...plan.unplaced, ...extra] });
}

export function removeUnplaced(plan, caseId) {
  const i = plan.unplaced.findIndex(u => u.caseId === caseId);
  if (i < 0) return plan;
  return touch({ ...plan, unplaced: plan.unplaced.filter((_, k) => k !== i) });
}

export function placeCase(plan, caseId, x, y, ctx, fromUnplacedId = null) {
  const c = ctx.caseById.get(caseId);
  if (!c) return plan;
  const base = { id: fromUnplacedId ?? ctx.newId(), caseId, x: snap(x), y: snap(y), z: 0, orientation: 'standing', rot: 0 };
  const p = settle(base, c, otherBoxes(plan, ctx, []));
  return touch({
    ...plan,
    placements: [...plan.placements, p],
    unplaced: plan.unplaced.filter(u => u.id !== fromUnplacedId),
  });
}

export function moveGroup(plan, id, x, y, ctx, { grid = 5, edges = true } = {}) {
  const { items } = buildItems(plan, ctx.caseById);
  const root = items.find(it => it.id === id);
  if (!root) return plan;
  const group = stackAbove(id, items);
  const others = otherBoxes(plan, ctx, group);
  const w = root.box.x1 - root.box.x0, d = root.box.y1 - root.box.y0;
  let nx = snap(x, grid), ny = snap(y, grid);
  if (edges) {
    nx = snapToEdges(nx, w, [0, ctx.truck.l, ...others.flatMap(b => [b.x0, b.x1])]);
    ny = snapToEdges(ny, d, [0, ctx.truck.w, ...others.flatMap(b => [b.y0, b.y1])]);
  }
  const nz = gravityZ({ x0: nx, y0: ny, x1: nx + w, y1: ny + d }, others);
  const ddx = nx - root.p.x, ddy = ny - root.p.y, ddz = nz - root.p.z;
  if (!ddx && !ddy && !ddz) return plan;
  const set = new Set(group);
  return touch({
    ...plan,
    placements: plan.placements.map(p => set.has(p.id) ? { ...p, x: p.x + ddx, y: p.y + ddy, z: p.z + ddz } : p),
  });
}

function reorient(plan, id, ctx, change) {
  const p = plan.placements.find(q => q.id === id);
  const c = p && ctx.caseById.get(p.caseId);
  if (!c) return plan;
  const patch = change(p, c);
  if (!Object.keys(patch).length) return plan;
  const { items } = buildItems(plan, ctx.caseById);
  const next = settle({ ...p, ...patch }, c, otherBoxes(plan, ctx, stackAbove(id, items)));
  return touch({ ...plan, placements: plan.placements.map(q => (q.id === id ? next : q)) });
}

export const rotate = (plan, id, ctx) =>
  reorient(plan, id, ctx, p => ({ rot: ((p.rot ?? 0) + 90) % 360 }));

export const cycleTip = (plan, id, ctx) =>
  reorient(plan, id, ctx, (p, c) => c.tippable
    ? { orientation: ORIENTATIONS[(ORIENTATIONS.indexOf(p.orientation) + 1) % ORIENTATIONS.length] }
    : {});

export function duplicate(plan, id, ctx) {
  const p = plan.placements.find(q => q.id === id);
  const c = p && ctx.caseById.get(p.caseId);
  if (!c) return plan;
  const copy = settle({ ...p, id: ctx.newId(), x: p.x + effectiveDims(c, p).dx }, c, otherBoxes(plan, ctx, []));
  return touch({ ...plan, placements: [...plan.placements, copy] });
}

export const removePlacement = (plan, id) =>
  touch({ ...plan, placements: plan.placements.filter(p => p.id !== id) });

export function toTray(plan, id) {
  const p = plan.placements.find(q => q.id === id);
  if (!p) return plan;
  return touch({
    ...plan,
    placements: plan.placements.filter(q => q.id !== id),
    unplaced: [...plan.unplaced, { id: p.id, caseId: p.caseId }],
  });
}

const orphans = (plan, ctx) => plan.unplaced.filter(u => !ctx.caseById.has(u.caseId));

export function packAll(plan, ctx) {
  const list = [...plan.placements, ...plan.unplaced]
    .map(x => ctx.caseById.get(x.caseId)).filter(Boolean);
  const { placements, unplaced } = autoPack(list, ctx.truck, { newId: ctx.newId });
  return touch({
    ...plan,
    placements: [...placements, ...plan.placements.filter(p => !ctx.caseById.has(p.caseId))],
    unplaced: [...unplaced.map(caseId => ({ id: ctx.newId(), caseId })), ...orphans(plan, ctx)],
  });
}

export function packRest(plan, ctx) {
  const { items } = buildItems(plan, ctx.caseById);
  const list = plan.unplaced.map(u => ctx.caseById.get(u.caseId)).filter(Boolean);
  if (!list.length) return plan;
  const { placements, unplaced } = autoPack(list, ctx.truck, { newId: ctx.newId, obstacles: items.map(it => it.box) });
  return touch({
    ...plan,
    placements: [...plan.placements, ...placements],
    unplaced: [...unplaced.map(caseId => ({ id: ctx.newId(), caseId })), ...orphans(plan, ctx)],
  });
}
```

`js/state.js`:
```js
export function createStore(initial, { limit = 50 } = {}) {
  let state = initial;
  let past = [], future = [];
  const subs = new Set();
  const emit = () => subs.forEach(fn => fn(state));
  const pushPast = () => { past = [...past, state.plan].slice(-limit); future = []; };

  return {
    get: () => state,
    subscribe(fn) { subs.add(fn); return () => subs.delete(fn); },
    update(fn, { history = false } = {}) {
      const next = fn(state);
      if (next === state) return;
      if (history && next.plan !== state.plan) pushPast();
      state = next;
      emit();
    },
    checkpoint: pushPast,
    undo() {
      if (!past.length) return;
      future = [state.plan, ...future];
      state = { ...state, plan: past.at(-1) };
      past = past.slice(0, -1);
      emit();
    },
    redo() {
      if (!future.length) return;
      past = [...past, state.plan];
      state = { ...state, plan: future[0] };
      future = future.slice(1);
      emit();
    },
    resetHistory() { past = []; future = []; },
    canUndo: () => past.length > 0,
    canRedo: () => future.length > 0,
  };
}
```

- [ ] **Step 4: `npm test` → PASS.**
- [ ] **Step 5: Commit** – `git add -A && git commit -m "feat: Plan-Aktionen und Undo/Redo-Store"`

---

### Task 8: 2D-Projektion & DOM-Helfer (`js/ui/projection.js`, `js/ui/dom.js`)

**Files:**
- Create: `js/ui/projection.js`, `js/ui/dom.js`
- Test: `tests/projection.test.js`

**Interfaces:**
- Produces:
  - `project(box, mode, truck) → {u0,u1,v0,v1}`, mode `'top'|'side'|'rear'`. Draufsicht: Stirnwand links, linke Wand (y=0) **unten** (`v = truck.w − y`). Seitenansicht von links: `u=x`, `v = truck.h − z`. Rückansicht von der Tür: `u=y`, `v = truck.h − z`.
  - `unproject(u, v, mode, truck) → {x, y}` (nur `'top'`)
  - `drawOrder(items, mode)` – hinten zuerst, vorne zuletzt
  - `wheelStrip(mode, face) → 'u0'|'u1'|'v0'|'v1'|null`, `stripRect(r, side, t) → {x,y,width,height}`
  - dom.js: `esc(str)`, `svgEl(tag, attrs, parent)`, `fmtM(cm) → '1,20 m'`, `ORIENTATION_LABEL`

- [ ] **Step 1: Failing tests** – `tests/projection.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { project, unproject, drawOrder, wheelStrip, stripRect } from '../js/ui/projection.js';
import { esc, fmtM } from '../js/ui/dom.js';

const truck = { l: 1000, w: 250, h: 270 };
const box = { x0: 10, y0: 20, z0: 30, x1: 110, y1: 80, z1: 90 };

test('Draufsicht: linke Wand unten', () => assert.deepEqual(project(box, 'top', truck), { u0: 10, u1: 110, v0: 170, v1: 230 }));
test('Seitenansicht', () => assert.deepEqual(project(box, 'side', truck), { u0: 10, u1: 110, v0: 180, v1: 240 }));
test('Rückansicht', () => assert.deepEqual(project(box, 'rear', truck), { u0: 20, u1: 80, v0: 180, v1: 240 }));
test('unproject Draufsicht', () => assert.deepEqual(unproject(10, 230, 'top', truck), { x: 10, y: 20 }));
test('Zeichenreihenfolge', () => {
  const it = (id, x0, y0, z0) => ({ id, box: { x0, y0, z0 } });
  const items = [it('a', 0, 0, 60), it('b', 100, 100, 0)];
  assert.deepEqual(drawOrder(items, 'top').map(i => i.id), ['b', 'a']);
  assert.deepEqual(drawOrder(items, 'side').map(i => i.id), ['b', 'a']);
  assert.deepEqual(drawOrder(items, 'rear').map(i => i.id), ['a', 'b']);
});
test('Rollenstreifen', () => {
  assert.equal(wheelStrip('top', 'bottom'), null);
  assert.equal(wheelStrip('top', '+y'), 'v0');
  assert.equal(wheelStrip('side', 'bottom'), 'v1');
  assert.equal(wheelStrip('side', '+y'), null);
  assert.equal(wheelStrip('rear', '+y'), 'u1');
  assert.deepEqual(stripRect({ u0: 0, u1: 100, v0: 0, v1: 50 }, 'v1', 6), { x: 0, y: 44, width: 100, height: 6 });
});
test('esc/fmtM', () => {
  assert.equal(esc('<a href="x">&</a>'), '&lt;a href=&quot;x&quot;&gt;&amp;&lt;/a&gt;');
  assert.equal(fmtM(120), '1,20 m');
});
```

- [ ] **Step 2: `npm test` → FAIL.**

- [ ] **Step 3: Implementierung**

`js/ui/projection.js`:
```js
export function project(b, mode, truck) {
  switch (mode) {
    case 'top':  return { u0: b.x0, u1: b.x1, v0: truck.w - b.y1, v1: truck.w - b.y0 };
    case 'side': return { u0: b.x0, u1: b.x1, v0: truck.h - b.z1, v1: truck.h - b.z0 };
    case 'rear': return { u0: b.y0, u1: b.y1, v0: truck.h - b.z1, v1: truck.h - b.z0 };
    default: throw new Error(`Unbekannte Ansicht: ${mode}`);
  }
}

export function unproject(u, v, mode, truck) {
  if (mode !== 'top') throw new Error('unproject nur für die Draufsicht');
  return { x: u, y: truck.w - v };
}

const ORDER_KEY = {
  top: it => it.box.z0,     // obere Lagen zuletzt
  side: it => -it.box.y0,   // Betrachter bei y<0: kleine y zuletzt
  rear: it => it.box.x0,    // Betrachter an der Tür: große x zuletzt
};
export const drawOrder = (items, mode) => [...items].sort((a, b) => ORDER_KEY[mode](a) - ORDER_KEY[mode](b));

const STRIP = {
  top:  { '+x': 'u1', '-x': 'u0', '+y': 'v0', '-y': 'v1' },
  side: { '+x': 'u1', '-x': 'u0', bottom: 'v1' },
  rear: { '+y': 'u1', '-y': 'u0', bottom: 'v1' },
};
export const wheelStrip = (mode, face) => STRIP[mode][face] ?? null;

export function stripRect(r, side, t) {
  const w = r.u1 - r.u0, h = r.v1 - r.v0;
  switch (side) {
    case 'u0': return { x: r.u0, y: r.v0, width: t, height: h };
    case 'u1': return { x: r.u1 - t, y: r.v0, width: t, height: h };
    case 'v0': return { x: r.u0, y: r.v0, width: w, height: t };
    case 'v1': return { x: r.u0, y: r.v1 - t, width: w, height: t };
    default: throw new Error(`Unbekannte Seite: ${side}`);
  }
}
```

`js/ui/dom.js`:
```js
const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = s => String(s ?? '').replace(/[&<>"']/g, ch => ESC[ch]);

const NS = 'http://www.w3.org/2000/svg';
export function svgEl(tag, attrs = {}, parent = null) {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  parent?.appendChild(el);
  return el;
}

export const fmtM = cm => `${(cm / 100).toFixed(2).replace('.', ',')} m`;

export const ORIENTATION_LABEL = {
  standing: 'stehend',
  tipLong: 'gekippt (Längsseite)',
  tipShort: 'gekippt (Stirnseite)',
};
```

- [ ] **Step 4: `npm test` → PASS.**
- [ ] **Step 5: Commit** – `git add -A && git commit -m "feat: 2D-Projektion und DOM-Helfer"`

---

### Task 9: App-Shell, Layout, 2D-Ansichten rendern

**Files:**
- Create: `index.html`, `css/app.css`, `js/ui/view2d.js`, `js/app.js`

**Interfaces:**
- Consumes: `repo.loadAll/savePlan`, `createStore`, `validatePlan`, `emptyPlan`, `DEFAULT_TRUCK_ID`, projection.js, dom.js, `wheelFace`, `archBoxes`.
- Produces:
  - view2d.js: `renderView(svg, mode, { truck, result, selectedId, labels=true })`
  - app.js (intern, wird in Task 10–13 erweitert): `store`, `ctx(state)`, `derive(state) → {caseById, truck, newId, result}`, `edit(fn, history=true)` mit `fn(plan, ctx) → plan`, `select(id)`, `scheduleRender()`.

- [ ] **Step 1: `index.html`**

```html
<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Truckload</title>
  <link rel="stylesheet" href="css/app.css">
  <link rel="stylesheet" href="css/print.css" media="print">
  <script type="importmap">
    { "imports": { "three": "./vendor/three.module.min.js", "three/addons/": "./vendor/addons/" } }
  </script>
</head>
<body>
  <header class="topbar">
    <strong class="brand">Truckload</strong>
    <div class="group">
      <select id="plan-select" title="Ladeplan"></select>
      <button id="plan-new">Neu</button>
      <button id="plan-rename">Umbenennen</button>
      <button id="plan-dup">Duplizieren</button>
      <button id="plan-del" class="danger">Löschen</button>
    </div>
    <div class="group">
      <select id="truck-select" title="Fahrzeug"></select>
      <button id="truck-edit">Bearbeiten</button>
      <button id="truck-new">+ Fahrzeug</button>
    </div>
    <div class="group">
      <button id="pack-all" class="primary">Alles neu packen</button>
      <button id="pack-rest">Rest einpacken</button>
    </div>
    <div class="group seg">
      <button id="mode-2d" class="on">2D</button>
      <button id="mode-3d">3D</button>
    </div>
    <span class="grow"></span>
    <div class="group">
      <button id="undo" title="Rückgängig (⌘Z)">↶</button>
      <button id="redo" title="Wiederholen (⇧⌘Z)">↷</button>
      <button id="export" title="Alles als JSON-Datei sichern">Sichern</button>
      <label class="btn" title="JSON-Sicherung einlesen">Importieren<input id="import" type="file" accept=".json,application/json" hidden></label>
      <button id="print">Drucken</button>
    </div>
  </header>
  <main class="layout">
    <aside id="library" class="panel library"></aside>
    <section class="stage">
      <div id="views2d" class="views2d">
        <figure class="view view-top"><figcaption>Draufsicht <small>Stirnwand links · Tür rechts</small></figcaption><svg id="svg-top"></svg></figure>
        <figure class="view view-side"><figcaption>Seitenansicht <small>von links</small></figcaption><svg id="svg-side"></svg></figure>
        <figure class="view view-rear"><figcaption>Rückansicht <small>von der Tür</small></figcaption><svg id="svg-rear"></svg></figure>
      </div>
      <div id="view3d" class="view3d" hidden></div>
    </section>
    <aside id="inspector" class="panel inspector"></aside>
  </main>
  <dialog id="dlg-case"></dialog>
  <dialog id="dlg-truck"></dialog>
  <section id="print-root" class="print-root" aria-hidden="true"></section>
  <script type="module" src="js/app.js"></script>
</body>
</html>
```

- [ ] **Step 2: `css/app.css`** – Farb-Tokens auf `:root` (dunkles Werkstatt-Theme als Standard, helles unter `@media (prefers-color-scheme: light)`), Layout-Grid, Ansichten, Case-Zustände.

```css
:root {
  --bg: #15181d; --panel: #1d2128; --line: #2e343d; --text: #e6e9ee; --muted: #8b95a3;
  --accent: #f0a500; --danger: #e5484d; --ok: #30a46c; --truck: #232830; --grid: #2a3039;
  --radius: 8px; font: 14px/1.4 system-ui, -apple-system, "Segoe UI", sans-serif;
}
@media (prefers-color-scheme: light) {
  :root { --bg: #eef0f3; --panel: #fff; --line: #d6dbe1; --text: #1b1f24; --muted: #66707c; --truck: #f7f8fa; --grid: #e3e7ec; }
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--text); height: 100vh; display: flex; flex-direction: column; }
button, .btn, select, input, textarea { font: inherit; color: inherit; }
button, .btn { background: var(--panel); border: 1px solid var(--line); border-radius: 6px; padding: 5px 10px; cursor: pointer; }
button:hover, .btn:hover { border-color: var(--muted); }
button:disabled { opacity: .4; cursor: default; }
button.primary { background: var(--accent); border-color: var(--accent); color: #111; font-weight: 600; }
button.danger { color: var(--danger); }
select, input, textarea { background: var(--bg); border: 1px solid var(--line); border-radius: 6px; padding: 5px 8px; }

.topbar { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; padding: 8px 12px; border-bottom: 1px solid var(--line); background: var(--panel); }
.topbar .group { display: flex; gap: 4px; align-items: center; }
.brand { color: var(--accent); letter-spacing: .02em; }
.grow { flex: 1; }
.seg button.on { background: var(--accent); color: #111; border-color: var(--accent); }

.layout { flex: 1; min-height: 0; display: grid; grid-template-columns: 290px 1fr 300px; }
.panel { background: var(--panel); overflow: auto; padding: 12px; }
.library { border-right: 1px solid var(--line); }
.inspector { border-left: 1px solid var(--line); }
.stage { min-width: 0; min-height: 0; display: flex; }
.views2d { flex: 1; display: grid; grid-template-columns: 3fr 1fr; grid-template-rows: 1.2fr 1fr; gap: 10px; padding: 10px; min-height: 0; }
.view { margin: 0; display: flex; flex-direction: column; min-height: 0; background: var(--panel); border: 1px solid var(--line); border-radius: var(--radius); }
.view-top { grid-column: 1 / -1; }
.view figcaption { padding: 6px 10px; font-weight: 600; }
.view figcaption small { color: var(--muted); font-weight: 400; margin-left: 6px; }
.view svg { flex: 1; width: 100%; min-height: 0; touch-action: none; user-select: none; }
.view3d { flex: 1; min-height: 0; }

/* SVG – Einheiten sind cm */
svg .truck { fill: var(--truck); stroke: var(--muted); stroke-width: 2; }
svg .front-wall { stroke: var(--accent); stroke-width: 6; }
svg .grid line { stroke: var(--grid); stroke-width: 1; }
svg .tick { fill: var(--muted); font-size: 14px; text-anchor: middle; }
svg .arch { fill: var(--line); stroke: var(--muted); stroke-dasharray: 6 4; }
svg .case rect.body { stroke: rgba(0,0,0,.55); stroke-width: 1.5; cursor: grab; }
svg .case .wheels { fill: rgba(0,0,0,.45); pointer-events: none; }
svg .case .label { fill: #111; font-size: 16px; font-weight: 700; text-anchor: middle; dominant-baseline: central; pointer-events: none; }
svg .case.bad rect.body { stroke: var(--danger); stroke-width: 4; stroke-dasharray: 10 5; }
svg .case.sel rect.body { stroke: var(--text); stroke-width: 4; }
svg .cog { fill: none; stroke: var(--danger); stroke-width: 3; }
svg.drop-target .truck { stroke: var(--accent); stroke-width: 4; }

dialog { background: var(--panel); color: var(--text); border: 1px solid var(--line); border-radius: 12px; padding: 0; width: min(520px, 92vw); }
dialog::backdrop { background: rgba(0,0,0,.5); }
.editor { display: grid; gap: 10px; padding: 18px; }
.editor h2 { margin: 0 0 4px; font-size: 18px; }
.editor label { display: grid; gap: 4px; color: var(--muted); }
.editor label > input, .editor label > select, .editor label > textarea { color: var(--text); }
.editor .row { display: grid; grid-auto-flow: column; grid-auto-columns: 1fr; gap: 8px; }
.editor .check { display: flex; gap: 8px; align-items: center; color: var(--text); }
.editor fieldset { border: 1px solid var(--line); border-radius: 8px; }
.editor menu { display: flex; gap: 8px; padding: 0; margin: 8px 0 0; }
.hint { color: var(--muted); font-size: 12px; margin: 0; }
.print-root { display: none; }
```

- [ ] **Step 3: `js/ui/view2d.js` – Rendern**

```js
import { svgEl } from './dom.js';
import { project, drawOrder, wheelStrip, stripRect } from './projection.js';
import { wheelFace } from '../model/geometry.js';
import { archBoxes } from '../model/validate.js';

const PAD = 30;

export function renderView(svg, mode, { truck, result, selectedId, labels = true }) {
  svg.replaceChildren();
  const W = mode === 'rear' ? truck.w : truck.l;
  const H = mode === 'top' ? truck.w : truck.h;
  svg.setAttribute('viewBox', `${-PAD} ${-PAD} ${W + 2 * PAD} ${H + 2 * PAD}`);
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');

  svgEl('rect', { x: 0, y: 0, width: W, height: H, class: 'truck' }, svg);
  const grid = svgEl('g', { class: 'grid' }, svg);
  for (let u = 100; u < W; u += 100) {
    svgEl('line', { x1: u, y1: 0, x2: u, y2: H }, grid);
    svgEl('text', { x: u, y: -10, class: 'tick' }, grid).textContent = `${u / 100} m`;
  }
  if (mode !== 'rear') svgEl('line', { x1: 0, y1: 0, x2: 0, y2: H, class: 'front-wall' }, svg);

  for (const a of archBoxes(truck)) {
    if (mode === 'side' && a.y0 > 0) continue; // Seitenansicht zeigt nur den linken Radkasten
    const r = project(a, mode, truck);
    svgEl('rect', { x: r.u0, y: r.v0, width: r.u1 - r.u0, height: r.v1 - r.v0, class: 'arch' }, svg);
  }

  for (const it of drawOrder(result.items, mode)) {
    const r = project(it.box, mode, truck);
    const cls = ['case', result.byPlacement.has(it.id) && 'bad', it.id === selectedId && 'sel'].filter(Boolean).join(' ');
    const g = svgEl('g', { class: cls, 'data-id': it.id }, svg);
    svgEl('rect', { x: r.u0, y: r.v0, width: r.u1 - r.u0, height: r.v1 - r.v0, fill: it.c.color, class: 'body' }, g);
    const side = wheelStrip(mode, wheelFace(it.p));
    if (side) svgEl('rect', { ...stripRect(r, side, 6), class: 'wheels' }, g);
    if (labels) svgEl('text', { x: (r.u0 + r.u1) / 2, y: (r.v0 + r.v1) / 2, class: 'label' }, g)
      .textContent = result.sequence.get(it.id);
    svgEl('title', {}, g).textContent =
      `${result.sequence.get(it.id)}. ${it.c.name}${it.c.content ? ` – ${it.c.content}` : ''}`;
  }

  const cog = result.totals.cog;
  if (mode === 'top' && cog) svgEl('circle', { cx: cog.x, cy: truck.w - cog.y, r: 12, class: 'cog' }, svg)
    .appendChild(svgEl('title')).textContent = 'Schwerpunkt';
}
```
(`textContent` auf SVG-`<text>`/`<title>` ist sicher – kein HTML-Parsing.)

- [ ] **Step 4: `js/app.js` – Bootstrap + Rendern**

```js
import * as repo from './store/repo.js';
import { createStore } from './state.js';
import { validatePlan } from './model/validate.js';
import * as A from './model/actions.js';
import { DEFAULT_TRUCK_ID } from './data/preset-trucks.js';
import { renderView } from './ui/view2d.js';

const $ = sel => document.querySelector(sel);
const uid = () => crypto.randomUUID();

const data = await repo.loadAll();
const latest = [...data.plans].sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''))[0];
const initialPlan = latest ?? A.emptyPlan(uid(), 'Neuer Ladeplan', DEFAULT_TRUCK_ID);

export const store = createStore({
  cases: data.cases, trucks: data.trucks, plans: data.plans,
  plan: initialPlan, selectedId: null, mode: '2d',
});

export function ctx(s = store.get()) {
  return {
    caseById: new Map(s.cases.map(c => [c.id, c])),
    truck: s.trucks.find(t => t.id === s.plan.truckId) ?? s.trucks.find(t => t.id === DEFAULT_TRUCK_ID),
    newId: uid,
  };
}
export function derive(s = store.get()) {
  const c = ctx(s);
  return { ...c, result: validatePlan(s.plan, c.caseById, c.truck) };
}
export function edit(fn, history = true) {
  store.update(s => {
    const next = fn(s.plan, ctx(s));
    return next === s.plan ? s : { ...s, plan: next };
  }, { history });
}
export const select = id => store.update(s => (s.selectedId === id ? s : { ...s, selectedId: id }));

let frame = 0;
export function scheduleRender() {
  if (frame) return;
  frame = requestAnimationFrame(() => { frame = 0; render(); });
}

function render() {
  const s = store.get();
  const d = derive(s);
  const opts = { truck: d.truck, result: d.result, selectedId: s.selectedId };
  if (s.mode === '2d') {
    renderView($('#svg-top'), 'top', opts);
    renderView($('#svg-side'), 'side', opts);
    renderView($('#svg-rear'), 'rear', opts);
  }
  for (const fn of renderHooks) fn(s, d);
}
export const renderHooks = []; // Task 10–13 hängen hier Bibliothek, Inspector, Toolbar, 3D an

let saveTimer;
let lastSaved = store.get().plan;
store.subscribe(s => {
  scheduleRender();
  if (s.plan === lastSaved) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { lastSaved = s.plan; repo.savePlan(s.plan); }, 400);
});

scheduleRender();
```

- [ ] **Step 5: Manuell prüfen** – `./start.command` → Browser zeigt Topbar, drei leere Ansichten mit Laderaum (Sattel 13,6 m), Meterraster, Stirnwand orange. Konsole ohne Fehler. `npm test` weiterhin grün.

- [ ] **Step 6: Commit** – `git add -A && git commit -m "feat: App-Shell, Layout und 2D-Ansichten"`

---

### Task 10: Case-Bibliothek, Case-Editor, Drag & Drop

**Files:**
- Create: `js/ui/library.js`, `js/ui/case-editor.js`
- Modify: `js/ui/view2d.js` (Interaktion anhängen), `js/app.js` (verdrahten), `css/app.css` (Bibliotheks-Styles)

**Interfaces:**
- Produces:
  - `mountLibrary(el, handlers) → { update(state) }`; handlers: `onNew()`, `onEdit(caseId)`, `onAdd(caseId)` (fragt Anzahl), `onTrayRemove(caseId)`.
  - Drag-Daten: MIME `text/x-case`, JSON `{ caseId, unplacedId|null }`.
  - `openCaseEditor(dlg, caseDef|null, { usedIn=0 }) → Promise<{action:'save', value:Case} | {action:'delete'} | null>`
  - view2d.js: `attachTopInteractions(svg, { getTruck, getItem(id), onSelect(id|null), onDragStart(), onDrag(id, x, y), onDropCase(data, x, y) })`, `attachSelect(svg, onSelect)`.
- Modul-Regel: UI-Module importieren **nicht** aus `app.js` (vermeidet Zyklen); app.js reicht Handler rein.

- [ ] **Step 1: `js/ui/library.js`**

```js
import { esc } from './dom.js';
import { CATEGORIES } from '../data/categories.js';

export function mountLibrary(el, h) {
  el.innerHTML = `
    <div class="lib-head">
      <h2>Cases</h2>
      <button data-act="new" class="primary">+ Neues Case</button>
    </div>
    <input type="search" class="lib-search" placeholder="Suchen (Name oder Inhalt)">
    <select class="lib-filter"><option value="">Alle Gewerke</option>${CATEGORIES.map(c => `<option>${esc(c.name)}</option>`).join('')}</select>
    <div class="lib-list"></div>
    <h3>Noch nicht verladen</h3>
    <div class="tray"></div>`;
  const search = el.querySelector('.lib-search');
  const filter = el.querySelector('.lib-filter');
  const list = el.querySelector('.lib-list');
  const tray = el.querySelector('.tray');
  let last = null;

  const row = c => `
    <div class="lib-item" draggable="true" data-case="${esc(c.id)}" title="${esc(c.content || c.note || '')}">
      <span class="swatch" style="background:${esc(c.color)}"></span>
      <span class="lib-text"><b>${esc(c.name)}</b>
        <small>${c.l}×${c.w}×${c.h} cm · ${c.weight} kg${c.tippable ? ' · kippbar' : ''}${c.stackable ? '' : ' · nicht stapelbar'}</small></span>
      <button data-act="add" title="In die Ablage legen">+</button>
      <button data-act="edit" title="${c.builtin ? 'Als eigenes Case kopieren' : 'Bearbeiten'}">✎</button>
    </div>`;

  function renderList() {
    if (!last) return;
    const q = search.value.trim().toLowerCase();
    const cat = filter.value;
    const match = c => (!cat || c.category === cat)
      && (!q || `${c.name} ${c.content}`.toLowerCase().includes(q));
    const own = last.cases.filter(c => !c.builtin && match(c));
    const presets = last.cases.filter(c => c.builtin && match(c));
    list.innerHTML = `
      <h3>Eigene Cases (${own.length})</h3>${own.map(row).join('') || '<p class="hint">Noch keine eigenen Cases – „+ Neues Case“ oder eine Vorlage kopieren.</p>'}
      <h3>Vorlagen <small>(Richtwerte)</small></h3>${presets.map(row).join('')}`;
  }

  function renderTray() {
    const counts = new Map();
    for (const u of last.plan.unplaced) counts.set(u.caseId, [...(counts.get(u.caseId) ?? []), u.id]);
    const byId = new Map(last.cases.map(c => [c.id, c]));
    tray.innerHTML = [...counts].map(([caseId, ids]) => {
      const c = byId.get(caseId);
      return `<div class="lib-item" draggable="true" data-case="${esc(caseId)}" data-unplaced="${esc(ids[0])}">
        <span class="swatch" style="background:${esc(c?.color ?? '#888')}"></span>
        <span class="lib-text"><b>${ids.length}× ${esc(c?.name ?? 'Unbekanntes Case')}</b></span>
        <button data-act="tray-remove" title="Eins entfernen">−</button></div>`;
    }).join('') || '<p class="hint">Leer. Mit „+“ Cases hierher legen, dann ziehen oder „Rest einpacken“.</p>';
  }

  search.addEventListener('input', renderList);
  filter.addEventListener('change', renderList);
  el.addEventListener('click', e => {
    const btn = e.target.closest('button[data-act]');
    if (!btn) return;
    const caseId = btn.closest('[data-case]')?.dataset.case;
    ({ new: () => h.onNew(), add: () => h.onAdd(caseId), edit: () => h.onEdit(caseId),
       'tray-remove': () => h.onTrayRemove(caseId) })[btn.dataset.act]?.();
  });
  el.addEventListener('dragstart', e => {
    const item = e.target.closest('[data-case]');
    if (!item) return;
    e.dataTransfer.setData('text/x-case', JSON.stringify({ caseId: item.dataset.case, unplacedId: item.dataset.unplaced ?? null }));
    e.dataTransfer.effectAllowed = 'copy';
  });

  return {
    update(state) {
      const casesChanged = !last || last.cases !== state.cases;
      last = state;
      if (casesChanged) renderList();
      renderTray();
    },
  };
}
```

CSS ergänzen:
```css
.lib-head { display: flex; justify-content: space-between; align-items: center; }
.library h2 { margin: 0; font-size: 16px; }
.library h3 { margin: 14px 0 6px; font-size: 12px; text-transform: uppercase; letter-spacing: .06em; color: var(--muted); }
.lib-search, .lib-filter { width: 100%; margin-top: 8px; }
.lib-item { display: flex; gap: 8px; align-items: center; padding: 6px; border: 1px solid transparent; border-radius: 6px; cursor: grab; }
.lib-item:hover { border-color: var(--line); background: var(--bg); }
.lib-item button { padding: 2px 8px; }
.swatch { width: 12px; height: 28px; border-radius: 3px; flex: none; }
.lib-text { flex: 1; min-width: 0; display: grid; }
.lib-text b { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-weight: 600; }
.lib-text small { color: var(--muted); }
```

- [ ] **Step 2: `js/ui/case-editor.js`**

```js
import { CATEGORIES, colorFor } from '../data/categories.js';

const DEFAULTS = { name: '', content: '', category: 'Sonstiges', l: 120, w: 60, h: 60, weight: 50,
  tippable: true, stackable: true, maxTopLoad: null, stock: null };

export function openCaseEditor(dlg, c, { usedIn = 0 } = {}) {
  const v = { ...DEFAULTS, color: colorFor('Sonstiges'), ...(c ?? {}) };
  const isNew = !c || c.builtin;
  const dim = n => `type="number" name="${n}" min="1" max="2000" step="0.5" required`;
  dlg.innerHTML = `
    <form method="dialog" class="editor">
      <h2>${isNew ? 'Neues Case' : 'Case bearbeiten'}</h2>
      ${c?.builtin ? '<p class="hint">Vorlage (Richtwert) – Speichern legt eine eigene Kopie an.</p>' : ''}
      <label>Name<input name="name" required maxlength="80" placeholder="z. B. Kabelcase Strom 1"></label>
      <label>Inhalt<textarea name="content" rows="3" placeholder="z. B. 10× Schuko 10 m, 4× CEE 32 A 25 m"></textarea></label>
      <div class="row">
        <label>Gewerk<select name="category">${CATEGORIES.map(k => `<option>${k.name}</option>`).join('')}</select></label>
        <label>Farbe<input type="color" name="color"></label>
      </div>
      <fieldset><legend>Maße stehend, inkl. Rollen (cm)</legend>
        <div class="row"><label>Länge<input ${dim('l')}></label><label>Breite<input ${dim('w')}></label><label>Höhe<input ${dim('h')}></label></div>
      </fieldset>
      <div class="row">
        <label>Gewicht beladen (kg)<input type="number" name="weight" min="0" step="0.5" required></label>
        <label>Bestand (Stück)<input type="number" name="stock" min="0" step="1"></label>
      </div>
      <label class="check"><input type="checkbox" name="tippable"> kippbar (darf auf die Seite gelegt werden)</label>
      <label class="check"><input type="checkbox" name="stackable"> stapelbar (darf etwas obendrauf)</label>
      <label>Max. Last obendrauf (kg, leer = unbegrenzt)<input type="number" name="maxTopLoad" min="0" step="1"></label>
      <menu>
        <button value="delete" class="danger" formnovalidate ${isNew ? 'hidden' : ''}>Löschen</button>
        <span class="grow"></span>
        <button value="cancel" formnovalidate>Abbrechen</button>
        <button value="save" class="primary">Speichern</button>
      </menu>
    </form>`;
  const f = dlg.querySelector('form').elements;
  f.name.value = c?.builtin ? `${v.name} (eigenes)` : v.name;
  f.content.value = v.content;
  f.category.value = v.category;
  f.color.value = v.color;
  for (const k of ['l', 'w', 'h', 'weight']) f[k].value = v[k];
  f.stock.value = v.stock ?? '';
  f.maxTopLoad.value = v.maxTopLoad ?? '';
  f.tippable.checked = v.tippable;
  f.stackable.checked = v.stackable;
  f.category.addEventListener('change', () => {
    if (f.color.value === colorFor(v.category) || f.color.value === colorFor(f.category.dataset.prev ?? v.category))
      f.color.value = colorFor(f.category.value);
    f.category.dataset.prev = f.category.value;
  });

  return new Promise(resolve => {
    dlg.addEventListener('close', () => {
      const act = dlg.returnValue;
      if (act === 'delete') {
        const msg = usedIn ? `„${v.name}“ wird in ${usedIn} Ladeplan/-plänen verwendet. Trotzdem löschen?` : `„${v.name}“ löschen?`;
        return resolve(confirm(msg) ? { action: 'delete' } : null);
      }
      if (act !== 'save') return resolve(null);
      const numOrNull = s => (s === '' ? null : Number(s));
      resolve({ action: 'save', value: {
        ...v,
        id: isNew ? crypto.randomUUID() : v.id,
        builtin: false, note: undefined,
        name: f.name.value.trim(), content: f.content.value.trim(),
        category: f.category.value, color: f.color.value,
        l: Number(f.l.value), w: Number(f.w.value), h: Number(f.h.value),
        weight: Number(f.weight.value), stock: numOrNull(f.stock.value),
        maxTopLoad: numOrNull(f.maxTopLoad.value),
        tippable: f.tippable.checked, stackable: f.stackable.checked,
      } });
    }, { once: true });
    dlg.returnValue = '';
    dlg.showModal();
  });
}
```

- [ ] **Step 3: Interaktion in `js/ui/view2d.js` ergänzen**

```js
import { unproject } from './projection.js'; // zum bestehenden Import hinzufügen

function toSvg(svg, e) {
  return new DOMPoint(e.clientX, e.clientY).matrixTransform(svg.getScreenCTM().inverse());
}

export function attachSelect(svg, onSelect) {
  svg.addEventListener('pointerdown', e => onSelect(e.target.closest('g.case')?.dataset.id ?? null));
}

export function attachTopInteractions(svg, h) {
  let drag = null;
  const truckPt = e => { const p = toSvg(svg, e); return unproject(p.x, p.y, 'top', h.getTruck()); };

  svg.addEventListener('pointerdown', e => {
    const id = e.target.closest('g.case')?.dataset.id ?? null;
    h.onSelect(id);
    if (!id) return;
    const it = h.getItem(id);
    const pt = truckPt(e);
    drag = { id, offX: pt.x - it.box.x0, offY: pt.y - it.box.y0, sx: e.clientX, sy: e.clientY, moved: false };
    svg.setPointerCapture(e.pointerId);
  });
  svg.addEventListener('pointermove', e => {
    if (!drag) return;
    if (!drag.moved) {
      if (Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < 4) return;
      drag.moved = true;
      h.onDragStart();
    }
    const pt = truckPt(e);
    h.onDrag(drag.id, pt.x - drag.offX, pt.y - drag.offY);
  });
  const end = () => { drag = null; };
  svg.addEventListener('pointerup', end);
  svg.addEventListener('pointercancel', end);

  svg.addEventListener('dragover', e => {
    if (!e.dataTransfer.types.includes('text/x-case')) return;
    e.preventDefault();
    svg.classList.add('drop-target');
  });
  svg.addEventListener('dragleave', () => svg.classList.remove('drop-target'));
  svg.addEventListener('drop', e => {
    e.preventDefault();
    svg.classList.remove('drop-target');
    const raw = e.dataTransfer.getData('text/x-case');
    if (!raw) return;
    const pt = truckPt(e);
    h.onDropCase(JSON.parse(raw), pt.x, pt.y);
  });
}
```
Hinweis: Bei `drag.offY` wird mit `box.y0` (linke Kante in Truck-Koordinaten) gerechnet; da `unproject` y korrekt zurückrechnet, bleibt der Greifpunkt stabil.

- [ ] **Step 4: In `js/app.js` verdrahten** (unter die bestehenden Exporte, vor `scheduleRender()`):

```js
import { mountLibrary } from './ui/library.js';
import { openCaseEditor } from './ui/case-editor.js';
import { attachTopInteractions, attachSelect } from './ui/view2d.js';
import { stamp } from './store/repo.js';

const usage = (s, caseId) => [s.plan, ...s.plans.filter(p => p.id !== s.plan.id)]
  .filter(p => [...p.placements, ...p.unplaced].some(x => x.caseId === caseId)).length;

async function editCase(caseId) {
  const s = store.get();
  const c = caseId ? s.cases.find(x => x.id === caseId) : null;
  const res = await openCaseEditor($('#dlg-case'), c, { usedIn: caseId ? usage(s, caseId) : 0 });
  if (!res) return;
  if (res.action === 'delete') {
    await repo.deleteCase(caseId);
    store.update(st => ({ ...st, cases: st.cases.filter(x => x.id !== caseId) }));
  } else {
    const value = stamp(res.value);
    await repo.saveCase(value);
    store.update(st => ({ ...st, cases: [...st.cases.filter(x => x.id !== value.id), value] }));
  }
}

const library = mountLibrary($('#library'), {
  onNew: () => editCase(null),
  onEdit: id => editCase(id),
  onAdd: id => {
    const n = Number.parseInt(prompt('Wie viele Stück in die Ablage legen?', '1') ?? '', 10);
    if (n > 0 && n <= 500) edit((p) => A.addUnplaced(p, id, n, uid));
  },
  onTrayRemove: id => edit(p => A.removeUnplaced(p, id)),
});
renderHooks.push(s => library.update(s));

attachTopInteractions($('#svg-top'), {
  getTruck: () => ctx().truck,
  getItem: id => derive().result.items.find(it => it.id === id),
  onSelect: select,
  onDragStart: () => store.checkpoint(),
  onDrag: (id, x, y) => edit((p, c) => A.moveGroup(p, id, x, y, c), false),
  onDropCase: ({ caseId, unplacedId }, x, y) => {
    const c = ctx().caseById.get(caseId);
    if (!c) return;
    edit((p, cx) => A.placeCase(p, caseId, x - c.l / 2, y - c.w / 2, cx, unplacedId));
  },
});
attachSelect($('#svg-side'), select);
attachSelect($('#svg-rear'), select);
```

- [ ] **Step 5: Manuell prüfen**
  1. Vorlage „Kabelcase Truckmaß 120×60×60“ in die Draufsicht ziehen → Case erscheint, Nummer 1, Rollenseite nicht sichtbar (stehend).
  2. Dasselbe Case auf das erste ziehen → landet oben (Seitenansicht zeigt 2 Lagen).
  3. Unteres Case verschieben → oberes wandert mit. Nahe an eine Wand ziehen → rastet ein.
  4. „+ Neues Case“: Name „Kabel Strom 1“, Inhalt eintragen, speichern → steht unter „Eigene Cases“. Seite neu laden → noch da (IndexedDB).
  5. „+“ bei einem Case, 5 eingeben → „5× …“ in der Ablage; aus der Ablage ziehen → Zahl sinkt.
  6. Case mit `<b>x</b>` im Namen anlegen → wird als Text angezeigt, nicht fett.

- [ ] **Step 6: Commit** – `git add -A && git commit -m "feat: Case-Bibliothek, Case-Editor und Drag & Drop"`

---

### Task 11: Inspector, Tastatur, Toolbar, Fahrzeuge & Ladepläne

**Files:**
- Create: `js/ui/inspector.js`, `js/ui/truck-editor.js`
- Modify: `js/app.js`, `css/app.css`

**Interfaces:**
- Produces:
  - `renderInspector(el, { selected: item|null, result, truck, load })` – Buttons mit `data-act` = `rotate|tip|dup|tray|delete|edit-case`, Warnungen mit `data-select="<placementId>"`.
  - `openTruckEditor(dlg, truck|null) → Promise<{action:'save', value:Truck} | {action:'delete'} | null>`
- Alle `import`-Zeilen in `app.js` stehen am Dateianfang.

- [ ] **Step 1: `js/ui/inspector.js`**

```js
import { esc, fmtM, ORIENTATION_LABEL } from './dom.js';

export function renderInspector(el, { selected, result, truck }) {
  const t = result.totals;
  const pct = Math.min(100, Math.round(t.weight / t.payload * 100));
  const sel = selected ? `
    <section class="insp-sel">
      <h2><span class="swatch" style="background:${esc(selected.c.color)}"></span>${result.sequence.get(selected.id)}. ${esc(selected.c.name)}</h2>
      ${selected.c.content ? `<p class="content">${esc(selected.c.content)}</p>` : ''}
      <dl>
        <dt>Lage</dt><dd>${ORIENTATION_LABEL[selected.p.orientation]}, ${selected.p.rot}°</dd>
        <dt>Maße stehend</dt><dd>${selected.c.l}×${selected.c.w}×${selected.c.h} cm</dd>
        <dt>Position</dt><dd>${fmtM(selected.box.x0)} ab Stirnwand · y ${Math.round(selected.box.y0)} · z ${Math.round(selected.box.z0)} cm</dd>
        <dt>Gewicht</dt><dd>${selected.c.weight} kg · Last obendrauf ${Math.round(result.load.get(selected.id) ?? 0)} kg${selected.c.maxTopLoad != null ? ` / max. ${selected.c.maxTopLoad}` : ''}</dd>
      </dl>
      <div class="btns">
        <button data-act="rotate">Drehen <kbd>R</kbd></button>
        <button data-act="tip" ${selected.c.tippable ? '' : 'disabled title="Case ist nicht kippbar"'}>Kippen <kbd>T</kbd></button>
        <button data-act="dup">Duplizieren <kbd>D</kbd></button>
        <button data-act="tray">In Ablage</button>
        <button data-act="edit-case">Case bearbeiten</button>
        <button data-act="delete" class="danger">Entfernen <kbd>Entf</kbd></button>
      </div>
      ${(result.byPlacement.get(selected.id) ?? []).map(i => `<p class="issue">${esc(i.message)}</p>`).join('')}
    </section>` : '<p class="hint">Case anklicken, um es zu bearbeiten. Ziehen verschiebt, Stapel wandern mit.</p>';

  el.innerHTML = `${sel}
    <section class="insp-totals">
      <h3>Ladung – ${esc(truck.name)}</h3>
      <div class="bar ${t.weight > t.payload ? 'over' : ''}"><span style="width:${pct}%"></span></div>
      <p>${Math.round(t.weight).toLocaleString('de-DE')} / ${t.payload.toLocaleString('de-DE')} kg Nutzlast</p>
      <dl>
        <dt>Cases</dt><dd>${t.count}</dd>
        <dt>Lademeter</dt><dd>${fmtM(t.loadMeters * 100)} von ${fmtM(truck.l)}</dd>
        <dt>Volumen</dt><dd>${Math.round(t.volumeRatio * 100)} %</dd>
        <dt>Schwerpunkt</dt><dd>${t.cog ? `${fmtM(t.cog.x)} ab Stirnwand, ${Math.round(t.cog.y - truck.w / 2)} cm aus der Mitte` : '–'}</dd>
      </dl>
    </section>
    <section class="insp-issues">
      <h3>Warnungen (${result.issues.length})</h3>
      ${result.issues.map(i => `<p class="issue" ${i.placementId ? `data-select="${esc(i.placementId)}"` : ''}>${
        i.placementId && result.sequence.has(i.placementId) ? `<b>${result.sequence.get(i.placementId)}.</b> ` : ''}${esc(i.message)}</p>`).join('')
        || '<p class="ok">Alles in Ordnung.</p>'}
    </section>
    <p class="hint">Tasten: R drehen · T kippen · D duplizieren · Pfeile schieben (⇧ = 1 cm) · Entf entfernen · ⌘Z rückgängig</p>`;
}
```

CSS ergänzen:
```css
.inspector h2 { font-size: 16px; margin: 0 0 6px; display: flex; gap: 8px; align-items: center; }
.inspector h3 { font-size: 12px; text-transform: uppercase; letter-spacing: .06em; color: var(--muted); margin: 18px 0 6px; }
.inspector dl { display: grid; grid-template-columns: auto 1fr; gap: 4px 10px; margin: 8px 0; }
.inspector dt { color: var(--muted); }
.inspector dd { margin: 0; }
.inspector .content { white-space: pre-wrap; background: var(--bg); padding: 8px; border-radius: 6px; }
.btns { display: flex; flex-wrap: wrap; gap: 6px; }
kbd { font-size: 11px; color: var(--muted); border: 1px solid var(--line); border-radius: 3px; padding: 0 4px; }
.issue { margin: 4px 0; padding: 6px 8px; border-left: 3px solid var(--danger); background: color-mix(in srgb, var(--danger) 12%, transparent); border-radius: 4px; }
.issue[data-select] { cursor: pointer; }
.ok { color: var(--ok); }
.bar { height: 10px; background: var(--bg); border-radius: 5px; overflow: hidden; }
.bar span { display: block; height: 100%; background: var(--ok); }
.bar.over span { background: var(--danger); }
```

- [ ] **Step 2: `js/ui/truck-editor.js`**

```js
export function openTruckEditor(dlg, t) {
  const isNew = !t || t.builtin;
  const arch = t?.wheelArches?.[0];
  dlg.innerHTML = `
    <form method="dialog" class="editor">
      <h2>${isNew ? 'Neues Fahrzeug' : 'Fahrzeug bearbeiten'}</h2>
      ${t?.builtin ? '<p class="hint">Vorlage (Richtwert) – Speichern legt ein eigenes Fahrzeug an.</p>' : ''}
      <label>Name<input name="name" required maxlength="80" placeholder="z. B. Firmen-7,5-Tonner"></label>
      <fieldset><legend>Laderaum innen (cm)</legend>
        <div class="row"><label>Länge<input type="number" name="l" min="50" max="2000" required></label>
        <label>Breite<input type="number" name="w" min="50" max="300" required></label>
        <label>Höhe<input type="number" name="h" min="50" max="400" required></label></div>
      </fieldset>
      <label>Nutzlast (kg)<input type="number" name="payload" min="1" required></label>
      <label class="check"><input type="checkbox" name="arches"> Radkästen im Laderaum (beidseitig)</label>
      <div class="row arch-fields">
        <label>ab Stirnwand<input type="number" name="ax" min="0"></label>
        <label>Länge<input type="number" name="al" min="1"></label>
        <label>Breite<input type="number" name="aw" min="1"></label>
        <label>Höhe<input type="number" name="ah" min="1"></label>
      </div>
      <menu>
        <button value="delete" class="danger" formnovalidate ${isNew ? 'hidden' : ''}>Löschen</button>
        <span class="grow"></span>
        <button value="cancel" formnovalidate>Abbrechen</button>
        <button value="save" class="primary">Speichern</button>
      </menu>
    </form>`;
  const f = dlg.querySelector('form').elements;
  f.name.value = t ? (t.builtin ? `${t.name} (eigenes)` : t.name) : '';
  for (const k of ['l', 'w', 'h', 'payload']) f[k].value = t?.[k] ?? '';
  f.arches.checked = !!arch;
  [f.ax.value, f.al.value, f.aw.value, f.ah.value] = arch ? [arch.x, arch.l, arch.w, arch.h] : ['', 100, 22, 30];
  const sync = () => dlg.querySelector('.arch-fields').hidden = !f.arches.checked;
  f.arches.addEventListener('change', sync); sync();

  return new Promise(resolve => {
    dlg.addEventListener('close', () => {
      const act = dlg.returnValue;
      if (act === 'delete') return resolve(confirm(`„${t.name}“ löschen?`) ? { action: 'delete' } : null);
      if (act !== 'save') return resolve(null);
      const wheelArches = f.arches.checked && f.ax.value !== ''
        ? [{ x: +f.ax.value, l: +f.al.value, w: +f.aw.value, h: +f.ah.value, side: 'both' }] : [];
      resolve({ action: 'save', value: {
        id: isNew ? crypto.randomUUID() : t.id, builtin: false,
        name: f.name.value.trim(), l: +f.l.value, w: +f.w.value, h: +f.h.value,
        payload: +f.payload.value, wheelArches,
      } });
    }, { once: true });
    dlg.returnValue = '';
    dlg.showModal();
  });
}
```

- [ ] **Step 3: `js/app.js` – Inspector, Tastatur, Toolbar**

```js
import { renderInspector } from './ui/inspector.js';
import { openTruckEditor } from './ui/truck-editor.js';
import { esc } from './ui/dom.js';

// Inspector
renderHooks.push((s, d) => {
  const selected = d.result.items.find(it => it.id === s.selectedId) ?? null;
  renderInspector($('#inspector'), { selected, result: d.result, truck: d.truck });
});
const withSel = fn => { const id = store.get().selectedId; if (id) fn(id); };
const ACTIONS = {
  rotate: id => edit((p, c) => A.rotate(p, id, c)),
  tip: id => edit((p, c) => A.cycleTip(p, id, c)),
  dup: id => edit((p, c) => A.duplicate(p, id, c)),
  tray: id => { edit(p => A.toTray(p, id)); select(null); },
  delete: id => { edit(p => A.removePlacement(p, id)); select(null); },
  'edit-case': id => editCase(store.get().plan.placements.find(p => p.id === id)?.caseId),
};
$('#inspector').addEventListener('click', e => {
  const act = e.target.closest('[data-act]')?.dataset.act;
  if (act) return withSel(ACTIONS[act]);
  const target = e.target.closest('[data-select]')?.dataset.select;
  if (target) select(target);
});

// Tastatur
document.addEventListener('keydown', e => {
  if (e.target.closest('input, textarea, select') || document.querySelector('dialog[open]')) return;
  const mod = e.metaKey || e.ctrlKey;
  if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? store.redo() : store.undo(); return; }
  if (e.key === 'Escape') return select(null);
  const key = { r: 'rotate', t: 'tip', d: 'dup', Delete: 'delete', Backspace: 'delete' }[e.key.length === 1 ? e.key.toLowerCase() : e.key];
  if (key && !mod) { e.preventDefault(); return withSel(ACTIONS[key]); }
  const arrow = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] }[e.key];
  if (arrow) withSel(id => {
    e.preventDefault();
    const step = e.shiftKey ? 1 : 5;
    const p = store.get().plan.placements.find(q => q.id === id);
    edit((pl, c) => A.moveGroup(pl, id, p.x + arrow[0] * step, p.y + arrow[1] * step, c, { grid: step, edges: false }));
  });
});

// Undo/Redo, Modus, Auto-Pack
$('#undo').onclick = () => store.undo();
$('#redo').onclick = () => store.redo();
$('#pack-all').onclick = () => {
  const s = store.get();
  if (s.plan.placements.length && !confirm('Alle Cases neu anordnen? (Rückgängig mit ⌘Z möglich)')) return;
  edit((p, c) => A.packAll(p, c));
};
$('#pack-rest').onclick = () => edit((p, c) => A.packRest(p, c));
function setMode(mode) {
  store.update(s => ({ ...s, mode }));
  $('#views2d').hidden = mode !== '2d';
  $('#view3d').hidden = mode !== '3d';
  $('#mode-2d').classList.toggle('on', mode === '2d');
  $('#mode-3d').classList.toggle('on', mode === '3d');
}
$('#mode-2d').onclick = () => setMode('2d');
$('#mode-3d').onclick = () => setMode('3d');

// Toolbar-Zustand: Planliste, Fahrzeugliste, Undo-Buttons
const allPlans = s => [s.plan, ...s.plans.filter(p => p.id !== s.plan.id)]
  .sort((a, b) => a.name.localeCompare(b.name, 'de'));
renderHooks.push((s, d) => {
  $('#plan-select').innerHTML = allPlans(s).map(p =>
    `<option value="${esc(p.id)}" ${p.id === s.plan.id ? 'selected' : ''}>${esc(p.name)}</option>`).join('');
  $('#truck-select').innerHTML = s.trucks.map(t =>
    `<option value="${esc(t.id)}" ${t.id === d.truck.id ? 'selected' : ''}>${esc(t.name)}${t.builtin ? '' : ' ★'} – ${t.l}×${t.w}×${t.h}</option>`).join('');
  $('#undo').disabled = !store.canUndo();
  $('#redo').disabled = !store.canRedo();
});

// Ladepläne
function switchPlan(plan) {
  store.update(s => ({ ...s, plans: [s.plan, ...s.plans.filter(p => p.id !== s.plan.id && p.id !== plan.id)], plan, selectedId: null }));
  store.resetHistory();
}
$('#plan-select').onchange = e => {
  const next = store.get().plans.find(p => p.id === e.target.value);
  if (next) switchPlan(next);
};
$('#plan-new').onclick = () => {
  const name = prompt('Name des Ladeplans (z. B. Show / Datum / Truck 1):', 'Neuer Ladeplan');
  if (name?.trim()) switchPlan(A.emptyPlan(uid(), name.trim(), ctx().truck.id));
};
$('#plan-rename').onclick = () => {
  const name = prompt('Neuer Name:', store.get().plan.name);
  if (name?.trim()) edit(p => ({ ...p, name: name.trim(), updatedAt: new Date().toISOString() }));
};
$('#plan-dup').onclick = () => {
  const p = store.get().plan;
  switchPlan({ ...structuredClone(p), id: uid(), name: `${p.name} (Kopie)`, updatedAt: new Date().toISOString() });
};
$('#plan-del').onclick = async () => {
  const s = store.get();
  if (!confirm(`Ladeplan „${s.plan.name}“ löschen?`)) return;
  clearTimeout(saveTimer); // sonst speichert der Autosave den gelöschten Plan erneut
  await repo.deletePlan(s.plan.id);
  const rest = s.plans.filter(p => p.id !== s.plan.id);
  const next = rest[0] ?? A.emptyPlan(uid(), 'Neuer Ladeplan', DEFAULT_TRUCK_ID);
  store.update(st => ({ ...st, plans: rest.filter(p => p.id !== next.id), plan: next, selectedId: null }));
  store.resetHistory();
};

// Fahrzeuge
$('#truck-select').onchange = e => edit(p => ({ ...p, truckId: e.target.value, updatedAt: new Date().toISOString() }));
async function editTruck(truck) {
  const res = await openTruckEditor($('#dlg-truck'), truck);
  if (!res) return;
  if (res.action === 'delete') {
    await repo.deleteTruck(truck.id);
    store.update(s => ({ ...s, trucks: s.trucks.filter(t => t.id !== truck.id) }));
    return;
  }
  const value = stamp(res.value);
  await repo.saveTruck(value);
  store.update(s => ({ ...s, trucks: [...s.trucks.filter(t => t.id !== value.id), value] }));
  edit(p => ({ ...p, truckId: value.id, updatedAt: new Date().toISOString() }));
}
$('#truck-new').onclick = () => editTruck(null);
$('#truck-edit').onclick = () => editTruck(ctx().truck);
```

- [ ] **Step 4: Manuell prüfen**
  1. Case wählen → Inspector zeigt Name, Inhalt, Lage. `R` → dreht (Draufsicht). `T` bei kippbarem Case → gekippt: Höhe ändert sich in der Seitenansicht, Rollenstreifen erscheint. `T` bei Rack → nichts.
  2. Zwei Cases übereinanderschieben → beide rot gestrichelt, Warnung „überschneidet sich“. Klick auf Warnung → Case wird ausgewählt.
  3. Pfeiltasten verschieben um 5 cm, mit Shift um 1 cm. `⌘Z` / `⇧⌘Z` funktionieren.
  4. 20 Cases in die Ablage, „Rest einpacken“ → Cases stehen von der Stirnwand aus gestapelt, keine Warnungen außer ggf. „einseitig“.
  5. Fahrzeug „Transporter“ wählen → Radkästen gestrichelt sichtbar; Case darauf ziehen → Warnung „Radkasten“.
  6. „+ Fahrzeug“ anlegen, neuen Ladeplan anlegen, zwischen Plänen wechseln, umbenennen, duplizieren, löschen. Nach Reload ist alles wie vorher.

- [ ] **Step 5: Commit** – `git add -A && git commit -m "feat: Inspector, Tastatur, Ladepläne und Fahrzeuge"`

---

### Task 12: 3D-Ansicht (`js/ui/view3d.js`)

**Files:**
- Create: `vendor/three.module.min.js`, `vendor/addons/controls/OrbitControls.js`, `js/ui/view3d.js`
- Modify: `js/app.js`

**Interfaces:**
- Consumes: `archBoxes`, `wheelFace`, `faceSlab`.
- Produces: `createView3d(container) → Promise<{ update({truck, result, selectedId}) }>` (lädt Three.js erst beim ersten Umschalten).

- [ ] **Step 1: Three.js lokal ablegen**

```bash
mkdir -p vendor/addons/controls
curl -fsSL https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.min.js -o vendor/three.module.min.js
curl -fsSL https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/controls/OrbitControls.js -o vendor/addons/controls/OrbitControls.js
head -c 200 vendor/addons/controls/OrbitControls.js   # muss "from 'three'" importieren → Importmap greift
```

- [ ] **Step 2: `js/ui/view3d.js`**

```js
import { archBoxes } from '../model/validate.js';
import { wheelFace, faceSlab } from '../model/geometry.js';

export async function createView3d(container) {
  const THREE = await import('three');
  const { OrbitControls } = await import('three/addons/controls/OrbitControls.js');

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  container.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(getComputedStyle(document.body).getPropertyValue('--bg').trim() || '#15181d');
  const camera = new THREE.PerspectiveCamera(40, 1, 1, 20000);
  camera.up.set(0, 0, 1); // Truck-Koordinaten: z = oben
  scene.add(new THREE.HemisphereLight(0xffffff, 0x404040, 2.2));
  const sun = new THREE.DirectionalLight(0xffffff, 1.4);
  sun.position.set(2000, -1500, 2500);
  scene.add(sun);
  const controls = new OrbitControls(camera, renderer.domElement);
  const content = new THREE.Group();
  scene.add(content);

  const render = () => renderer.render(scene, camera);
  controls.addEventListener('change', render);
  const resize = () => {
    const { clientWidth: w, clientHeight: h } = container;
    if (!w || !h) return;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    render();
  };
  new ResizeObserver(resize).observe(container);

  const boxMesh = (b, material) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(b.x1 - b.x0, b.y1 - b.y0, b.z1 - b.z0), material);
    m.position.set((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, (b.z0 + b.z1) / 2);
    return m;
  };
  const edges = (mesh, color) => {
    const l = new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry), new THREE.LineBasicMaterial({ color }));
    l.position.copy(mesh.position);
    return l;
  };
  function clear() {
    content.traverse(o => { o.geometry?.dispose(); o.material?.dispose?.(); });
    content.clear();
  }

  let framedFor = null;
  function update({ truck, result, selectedId }) {
    clear();
    const room = { x0: 0, y0: 0, z0: 0, x1: truck.l, y1: truck.w, z1: truck.h };
    const floor = boxMesh({ ...room, z0: -2, z1: 0 }, new THREE.MeshLambertMaterial({ color: 0x5a6068 }));
    content.add(floor, edges(boxMesh(room, new THREE.MeshBasicMaterial()), 0x8b95a3));
    const front = boxMesh({ ...room, x1: 3 }, new THREE.MeshLambertMaterial({ color: 0xf0a500, transparent: true, opacity: 0.35 }));
    content.add(front);
    for (const a of archBoxes(truck)) content.add(boxMesh(a, new THREE.MeshLambertMaterial({ color: 0x444a52 })));

    for (const it of result.items) {
      const bad = result.byPlacement.has(it.id);
      const mesh = boxMesh(it.box, new THREE.MeshLambertMaterial({
        color: it.c.color, emissive: bad ? 0x661111 : 0x000000,
      }));
      content.add(mesh, edges(mesh, it.id === selectedId ? 0xffffff : bad ? 0xe5484d : 0x111111));
      content.add(boxMesh(faceSlab(it.box, wheelFace(it.p), 3), new THREE.MeshLambertMaterial({ color: 0x222222 })));
    }

    if (framedFor !== truck.id) {
      camera.position.set(truck.l * 1.25, -truck.w * 2.2, truck.h * 2.4);
      controls.target.set(truck.l / 2, truck.w / 2, truck.h / 3);
      controls.update();
      framedFor = truck.id;
    }
    resize();
    render();
  }
  return { update };
}
```
Hinweis: Das Raum-Mesh (`MeshBasicMaterial`) wird nur für seine Kanten benutzt und nicht selbst hinzugefügt.

- [ ] **Step 3: In `js/app.js` einhängen**

```js
import { createView3d } from './ui/view3d.js';

let view3d = null, view3dLoading = null;
renderHooks.push(async (s, d) => {
  if (s.mode !== '3d') return;
  view3d ??= await (view3dLoading ??= createView3d($('#view3d')));
  view3d.update({ truck: d.truck, result: d.result, selectedId: s.selectedId });
});
```
Falls Three.js nicht lädt (Datei fehlt): im Hook `try/catch` → `$('#view3d').textContent = '3D-Ansicht konnte nicht geladen werden (vendor/ fehlt?).'`.

- [ ] **Step 4: Manuell prüfen** – Auf 3D umschalten: Laderaum als Drahtgitter, Stirnwand orange, Cases farbig, Rollenseite als dunkle Platte, fehlerhafte Cases rötlich, Maus dreht/zoomt. Zurück auf 2D, Case verschieben, wieder 3D → aktuell. Browser offline (DevTools) → 3D lädt trotzdem.

- [ ] **Step 5: Commit** – `git add -A && git commit -m "feat: 3D-Ansicht mit Three.js"`

---

### Task 13: Drucken, Sichern & Importieren

**Files:**
- Create: `js/ui/print.js`, `css/print.css`
- Modify: `js/app.js`

**Interfaces:**
- Consumes: `renderView`, `exportBundle`, `parseBundle`, `mergeById`, `backupFileName`, `repo.save*`.
- Produces: `buildPrint(root, { plan, truck, result })`.

- [ ] **Step 1: `js/ui/print.js`**

```js
import { esc, fmtM, ORIENTATION_LABEL } from './dom.js';
import { renderView } from './view2d.js';

export function buildPrint(root, { plan, truck, result }) {
  const t = result.totals;
  const rows = [...result.items].sort((a, b) => result.sequence.get(a.id) - result.sequence.get(b.id));
  root.innerHTML = `
    <header>
      <h1>${esc(plan.name)}</h1>
      <p>${esc(truck.name)} · Innen ${truck.l}×${truck.w}×${truck.h} cm · ${new Date().toLocaleDateString('de-DE')}
        · ${Math.round(t.weight).toLocaleString('de-DE')} / ${truck.payload.toLocaleString('de-DE')} kg
        · ${fmtM(t.loadMeters * 100)} Lademeter · ${t.count} Cases</p>
    </header>
    <figure><figcaption>Draufsicht (Stirnwand links)</figcaption><svg class="p-top"></svg></figure>
    <figure><figcaption>Seitenansicht (von links)</figcaption><svg class="p-side"></svg></figure>
    ${result.issues.length ? `<section class="p-issues"><b>Achtung:</b> ${result.issues.map(i => esc(i.message)).join(' · ')}</section>` : ''}
    <table>
      <thead><tr><th>Nr.</th><th>Case</th><th>Inhalt</th><th>Lage</th><th>ab Stirnwand</th><th>Höhe</th><th>kg</th></tr></thead>
      <tbody>${rows.map(it => `<tr>
        <td>${result.sequence.get(it.id)}</td><td>${esc(it.c.name)}</td><td>${esc(it.c.content)}</td>
        <td>${ORIENTATION_LABEL[it.p.orientation]}</td><td>${fmtM(it.box.x0)}</td>
        <td>${it.box.z0 > 0 ? `${Math.round(it.box.z0)} cm` : 'Boden'}</td><td>${it.c.weight}</td></tr>`).join('')}
      </tbody>
    </table>`;
  const opts = { truck, result, selectedId: null };
  renderView(root.querySelector('.p-top'), 'top', opts);
  renderView(root.querySelector('.p-side'), 'side', opts);
}
```

- [ ] **Step 2: `css/print.css`**

```css
@page { size: A4 landscape; margin: 10mm; }
body { background: #fff; color: #000; height: auto; display: block; }
body > *:not(#print-root) { display: none !important; }
#print-root { display: block !important; font: 10pt/1.35 system-ui, sans-serif; }
#print-root h1 { font-size: 16pt; margin: 0; }
#print-root figure { margin: 4mm 0; }
#print-root figcaption { font-weight: 600; font-size: 9pt; }
#print-root svg { width: 100%; height: auto; max-height: 55mm; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
#print-root svg .truck { fill: #fff; stroke: #000; }
#print-root svg .grid line { stroke: #ccc; }
#print-root svg .tick { fill: #444; }
#print-root .p-issues { border: 1px solid #c00; padding: 2mm; color: #c00; }
#print-root table { width: 100%; border-collapse: collapse; margin-top: 4mm; }
#print-root th, #print-root td { border-bottom: 1px solid #bbb; padding: 1mm 2mm; text-align: left; vertical-align: top; }
#print-root tr { break-inside: avoid; }
```

- [ ] **Step 3: `js/app.js` – Drucken, Sichern, Importieren**

```js
import { buildPrint } from './ui/print.js';
import { exportBundle, parseBundle, mergeById, backupFileName } from './store/io.js';

$('#print').onclick = () => {
  const s = store.get(), d = derive(s);
  buildPrint($('#print-root'), { plan: s.plan, truck: d.truck, result: d.result });
  window.print();
};

$('#export').onclick = () => {
  const s = store.get();
  const plans = [s.plan, ...s.plans.filter(p => p.id !== s.plan.id)];
  const blob = new Blob([exportBundle({ cases: s.cases, trucks: s.trucks, plans })], { type: 'application/json' });
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: backupFileName() });
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
};

$('#import').onchange = async e => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    const b = parseBundle(await file.text());
    await Promise.all([
      ...b.cases.map(repo.saveCase), ...b.trucks.map(repo.saveTruck), ...b.plans.map(repo.savePlan),
    ]);
    store.update(s => {
      const plans = mergeById([s.plan, ...s.plans], b.plans);
      return {
        ...s,
        cases: mergeById(s.cases, b.cases),
        trucks: mergeById(s.trucks, b.trucks),
        plans: plans.filter(p => p.id !== s.plan.id),
        plan: plans.find(p => p.id === s.plan.id) ?? s.plan,
      };
    });
    alert(`Importiert: ${b.cases.length} Cases, ${b.trucks.length} Fahrzeuge, ${b.plans.length} Ladepläne.`);
  } catch (err) {
    alert(`Import fehlgeschlagen: ${err.message}`);
  }
};
```

- [ ] **Step 4: Manuell prüfen**
  1. „Drucken“ → Vorschau A4 quer: Kopfzeile, Drauf- und Seitenansicht mit Nummern und Farben, Ladeliste in Reihenfolge, ggf. rote Warnbox. Als PDF speichern möglich.
  2. „Sichern“ → `truckload-backup-2026-…json` wird heruntergeladen; enthält eigene Cases, keine Vorlagen.
  3. In einem privaten Fenster (leerer Speicher) „Importieren“ mit dieser Datei → Cases, Fahrzeuge, Pläne sind da.
  4. Eine kaputte Datei (z. B. eine `.json` mit `{}`) → Meldung „Keine Truckload-Datei“, nichts geht kaputt.

- [ ] **Step 5: Commit** – `git add -A && git commit -m "feat: Druckansicht, Sichern und Importieren"`

---

### Task 14: Abschlussprüfung

- [ ] **Step 1: Tests** – `npm test` → alle grün, Ausgabe zeigen.
- [ ] **Step 2: Durchspiel-Szenario (Chrome, `./start.command`)**
  1. Neuer Ladeplan „Testshow Truck 1“, Fahrzeug LKW 7,5 t.
  2. Eigene Cases anlegen: „Kabel Strom 1“ (120×60×60, 110 kg, Inhalt „10× Schuko 10 m“) und „Licht Moving Heads“ (Vorlage kopieren, Inhalt eintragen).
  3. 12× Kabel, 4× Moving Head, 2× Rack 12 HE, 1× FOH-Pult in die Ablage → „Rest einpacken“.
  4. Prüfen: keine Kollisionen, FOH-Pult hat nichts obendrauf, Racks nicht gekippt, Gewichtsbalken plausibel.
  5. Ein Kabelcase kippen und auf ein anderes stellen → Rollenseite sichtbar in 2D und 3D.
  6. Undo bis zum Anfang, Redo bis zum Ende.
  7. Drucken → PDF. Sichern → JSON. Seite neu laden → Plan unverändert.
- [ ] **Step 3: Optik-Feinschliff** – mit dem `frontend-design`-Skill Layout, Abstände und Lesbarkeit prüfen (hell und dunkel), ohne die Struktur zu ändern.
- [ ] **Step 4: README** um Screenshots/Kurzanleitung ergänzen, Commit `docs: Kurzanleitung`.

---

## Verifikation (Zusammenfassung)
- Automatisch: `npm test` deckt Geometrie/Kippen, Prüfungen, Lastverteilung, Auto-Beladung (inkl. Radkästen), Aktionen/Stapel-Drag, Undo, Import/Export und Projektion ab.
- Manuell: Schritte in Task 9–14, Endszenario in Task 14.
