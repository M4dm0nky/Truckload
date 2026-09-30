# Deckschicht mischen (Pack-Regeln Teil B) – Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Die Packcases bekommen Standardgewichte. Ein zuschaltbarer Schalter „Deckschicht mischen“ je Load lässt leichtere, kleinere Cases derselben Gruppe bzw. desselben Gewerks auf die Stapel früherer Blöcke steigen. Die Blöcke bleiben sortenrein am Boden.

**Architecture:**
- `buildStacks` in `js/model/packer.js` bekommt einen dritten Weg zwischen „eigener Stapel“ und „neuer Stapel“: die Deckschicht auf einen Stapel eines früheren Blocks.
- Zusammengehörigkeit und Regel-Rang kommen aus `js/model/packRules.js` (`sameSelectorRank`).
- Plan-Feld `mixTop` (fehlt = aus), auch in Regelsets.
- `placeStacks` bleibt unverändert.

**Tech Stack:** Reine ES-Module, `node --test`, keine Abhängigkeiten.

**Spec:** `docs/superpowers/specs/2026-09-30-deckschicht-design.md`

## Global Constraints

- Keine npm-Abhängigkeiten, kein Build-Schritt; Tests mit `npm test`.
- Oberfläche auf Deutsch, typografische Anführungszeichen „…“. Das schließende Zeichen ist **U+201C**, nie ASCII `"` und nie U+201D. Werkzeuge verfälschen es gern, deshalb per python prüfen.
- Nutzertexte in HTML nur über `esc()` aus `js/ui/dom.js`.
- Alte Daten laden unverändert:
  - Plan ohne `mixTop` packt wie bisher.
  - Regelset ohne `mixTop` bedeutet: aus.
  - Jede Datenmodell-Änderung braucht einen Regressionstest mit Daten im alten Schema.
- Packcase-Gewicht = `Math.round(100 × l·w·h / (120·80·80))` (Nutzerangabe 2026-09-30, eigene Auslegung). Die `legacy`-Einträge bleiben unverändert.
- Eine Deckschicht nur, wenn alles davon gilt:
  - gleiche Gruppe, oder beide ohne Gruppe und gleiches Gewerk;
  - gleicher Rang in jeder Auswahlregel;
  - Grundfläche passt ganz auf das oberste Stück, auch um 90° gedreht;
  - beide Gewichte > 0, das obere ≤ das oberste Stück, und alle Stücke im Stapel > 0;
  - `canAddToStack` erfüllt, höchstens 4 Lagen, Lage erlaubt (`pieceLayers`);
  - keine Traversen, weder oben noch unten;
  - eine Ebene trägt genau ein Stück, bündig an x0/y0;
  - auf einen Stapel mit Deckschicht kommt nichts Sortengleiches mehr (`capped`).
- Neue Dateien unter `js/` in `sw.js` ASSETS (hier keine neue Datei geplant).
- Commit-Nachrichten enden mit `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Version erst am Ende nach Rückfrage (Vorschlag 0.8.5 → 0.8.6).

## Review Focus

- **0-kg-Cases** (die meisten Listen-Cases) mischen weder oben noch unten. Test in Task 3.
- **Pack-Regel „Gruppe X zuletzt“:** Ein X-Stück darf nicht als Deckschicht auf einen Block ohne diese Regel-Stellung wandern. Test in Task 3.
- **Lagen:** Stücke mit `layers: [1, 2]` kommen nie in Lage 3. Ein Stapel aus 2 gleichen Stücken mit `[1, 2]` bekommt keine Deckschicht. Test in Task 3.
- **Packcase-Gewichtsänderung:** Bestehende Packer-Tests mit Packcases (Beispiel-Load, Rack-Mix) können andere Ergebnisse liefern. Jede Änderung einer Erwartung muss begründet und kommentiert sein. Task 1.
- **Eigenschaft:** Mit `mixTop` entstehen keine Placement-Fehler, die es ohne `mixTop` nicht gab. Es geht kein Stück verloren, und nichts Schwereres liegt auf Leichterem. Test in Task 3.

---

### Task 1: Standardgewichte für Packcases

**Files:**
- Modify: `js/data/preset-cases.js` (`PACK` und Kommentar darüber)
- Modify: `tests/packcases.test.js`
- Modify: `docs/casemasse-gewichte.md` (neuer Abschnitt)
- Modify: `README.md` (Absatz „Leere Standard-Pack- und Kabelcases …“)

**Interfaces:**
- Produces: `preset-packcase-*` mit `weight = Math.round(100 * l * w * h / (120 * 80 * 80))`.

- [ ] **Step 1: Failing Test.** In `tests/packcases.test.js` im Test „je Standardmaß genau ein sichtbares Packcase …“:
  - Den Titel ändern auf `'je Standardmaß genau ein sichtbares Packcase, Gewicht nach Volumen, Name nach Maß'`.
  - `assert.equal(hit[0].weight, 0);` ersetzen durch:

```js
    // Nutzerangabe 2026-09-30: größtes Packcase 120×80×80 = 100 kg, die übrigen nach Volumen.
    assert.equal(hit[0].weight, Math.round(100 * l * w * h / (120 * 80 * 80)), `${l}×${w}×${h}`);
```

  - Dazu einen neuen Test anhängen:

```js
test('Packcase-Gewichte: Tabelle der Nutzerangabe', () => {
  const w = dims => visible.find(c => c.name === `Packcase ${dims}`).weight;
  assert.deepEqual(
    ['60×60×60', '60×60×73', '80×60×60', '120×60×60', '120×60×73', '120×60×80', '120×80×80'].map(w),
    [28, 34, 38, 56, 68, 75, 100]);
  assert.equal(byId('preset-pack-120x80x80').weight, 150, 'legacy-Eintrag behält sein altes Gewicht');
});
```

- [ ] **Step 2:** `node --test tests/packcases.test.js` ausführen. Erwartung: FAIL (Gewicht 0).
- [ ] **Step 3: Implementierung** in `js/data/preset-cases.js`:

```js
// Truckmaß (EU): Breiten 60/80/120 cm, gehen in 240 cm Innenbreite auf (Megacase, Gäng-Case).
// Leere Standard-Pack-/Kabelcases: je Maß genau eines, neutral benannt (Nutzerwunsch 2026-09-28).
// Gewicht seit V 0.8.6 als Standardwert des Nutzers (2026-09-30): das größte Packcase 120×80×80
// wiegt 100 kg, die übrigen nach Volumen abgestuft (eigene Auslegung von „große 100 kg, nach
// Volumen abstufen“, docs/casemasse-gewichte.md). Ersetzt die früheren „Kabelcase/Packcase
// Truckmaß“-Vorlagen und die leeren Pack-/Transflex-Cases aus der Liste – die bleiben unten bzw. in
// case-library.js als `legacy` für alte Ladepläne erhalten.
const PACK_REF_VOLUME = 120 * 80 * 80;
const PACK = (l, w, h) => P(`packcase-${l}x${w}x${h}`, `Packcase ${l}×${w}×${h}`, 'Sonstiges', l, w, h,
  Math.round(100 * l * w * h / PACK_REF_VOLUME));
```

- [ ] **Step 4:** `npm test` ausführen.
  - Die Packcase-Tests sind jetzt grün.
  - Schlagen **andere** Tests fehl (z. B. `tests/packer.test.js` Beispiel-Load oder Rack-Mix, die Packcases benutzen): **nicht** blind die Erwartung anpassen.
  - Erst analysieren, warum sich das Ergebnis mit dem neuen Gewicht ändert. Ist die neue Erwartung fachlich richtig (z. B. ein Stapel sortiert anders, weil jetzt ein Gewicht da ist), die Erwartung anpassen und mit einem Kommentar `// V 0.8.6: Packcases wiegen jetzt …, deshalb …` versehen.
  - Ist sie nicht richtig, DONE_WITH_CONCERNS melden.
- [ ] **Step 5: Doku.**
  - `docs/casemasse-gewichte.md`: Abschnitt „Packcases (Standardgewicht, Nutzerangabe 2026-09-30)“ mit der Tabelle aus der Spec, der Formel, dem Hinweis „Standardwert des Nutzers, kein recherchierter Wert; eigene Auslegung: größtes Packcase = 100 kg, übrige nach Volumen“ und „Legacy-Einträge unverändert“.
  - `README.md`: Im Absatz über die Packcases „mit 0 kg“ ersetzen durch „mit einem Standardgewicht (120×80×80 = 100 kg, die kleineren nach Volumen, z. B. 60×60×60 = 28 kg)“.
- [ ] **Step 6:** Anführungszeichen in allen geänderten Dateien per python prüfen, dann committen: `feat: Standardgewichte für Packcases (100 kg für 120×80×80, nach Volumen)`

---

### Task 2: `packRules.js` – Rang je Auswahlregel und `mixTopFor`

**Files:**
- Modify: `js/model/packRules.js`
- Test: `tests/packRules.test.js`

**Interfaces:**
- Produces:
  - `sameSelectorRank(rules, blockA, blockB) → boolean`: gleicher Rang in jeder Auswahlregel, Maßregeln zählen nicht.
  - `mixTopFor(plan) → boolean` (`plan?.mixTop === true`).
- `blockComparator` verhält sich unverändert. Seine Rangberechnung wird in einen Helfer `rankOf(rule, block)` ausgelagert.

- [ ] **Step 1: Failing Tests** an `tests/packRules.test.js` anhängen. Die Fixtures `big`, `small`, `truss`, `block` aus der Datei verwenden. `sameSelectorRank` und `mixTopFor` zum Import am Dateianfang hinzufügen.

```js
test('sameSelectorRank: gleicher Rang in allen Auswahlregeln, Maßregeln zählen nicht', () => {
  const mot = block(big, 2, 'Motoren'), plain = block(big, 2), tiny = block(small, 2);
  const rules = [{ by: 'group', value: 'Motoren', pos: 'last' }, { by: 'volume' }];
  assert.equal(sameSelectorRank(rules, plain, tiny), true, 'beide ohne Treffer, Volumen egal');
  assert.equal(sameSelectorRank(rules, mot, plain), false, 'Motoren zuletzt, plain nicht');
  assert.equal(sameSelectorRank(rules, mot, block(small, 1, 'Motoren')), true);
  assert.equal(sameSelectorRank([{ by: 'truss', pos: 'first' }], block(truss, 1), tiny), false);
  assert.equal(sameSelectorRank([], mot, tiny), true, 'ohne Regeln immer gleich');
});

test('mixTopFor: nur true schaltet ein (Altdaten ohne Feld = aus)', () => {
  assert.equal(mixTopFor({ mixTop: true }), true);
  assert.equal(mixTopFor({ mixTop: false }), false);
  assert.equal(mixTopFor({}), false);
  assert.equal(mixTopFor(undefined), false);
});
```

- [ ] **Step 2:** `node --test tests/packRules.test.js` ausführen. Erwartung: FAIL.
- [ ] **Step 3: Implementierung** in `js/model/packRules.js`:
  - Nach `matches` einfügen:

```js
// Rang eines Blocks in einer Auswahlregel: −1 = zuerst (Stirnwand), +1 = zuletzt (Tür), 0 = trifft nicht.
const rankOf = (r, blk) => (matches(r, blk) ? (r.pos === 'first' ? -1 : 1) : 0);

// Deckschicht (Spec 2026-09-30-deckschicht-design.md): ein Stück darf nur auf einen Block steigen,
// der in JEDER Auswahlregel denselben Rang hat – sonst würde z. B. „Gruppe Motoren: zuletzt“ durch
// eine Deckschicht weiter vorn unterlaufen. Maßregeln (Volumen, Stückzahl) spielen keine Rolle.
export const sameSelectorRank = (rules, a, b) =>
  normalizeRules(rules).every(r => MEASURE_BY.includes(r.by) || rankOf(r, a) === rankOf(r, b));

export const mixTopFor = plan => plan?.mixTop === true;
```

  - In `blockComparator` die Zeilen `const rank = blk => …; return (a, b) => rank(a) - rank(b);` ersetzen durch `return (a, b) => rankOf(r, a) - rankOf(r, b);`

- [ ] **Step 4:** `npm test` ausführen. Erwartung: alles grün, das Verhalten von `blockComparator` ist unverändert.
- [ ] **Step 5:** Anführungszeichen prüfen, dann committen: `feat: sameSelectorRank und mixTopFor für die Deckschicht`

---

### Task 3: Packer – Deckschicht in `buildStacks`

**Files:**
- Modify: `js/model/packer.js` (`buildStacks`, `autoPack`, Import aus `packRules.js`)
- Test: `tests/packer.test.js`

**Interfaces:**
- Consumes: `sameSelectorRank`, `legacyRules` (Tasks 1/2 bzw. vorhanden).
- Produces:
  - `buildStacks(itemList, truck, { order?, rules?, mixTop? = false })`
  - `autoPack(items, truck, { obstacles?, order?, rules?, mixTop? = false, startX? })`

- [ ] **Step 1: Failing Tests** an `tests/packer.test.js` anhängen. `mkItem`, `items`, `placementIssues`, `mkCase`, `mkTruck`, `plan`, `byId`, `validatePlan`, `PRESET_CASES`, `CASE_LIBRARY`, `PRESET_TRUCKS` sind in der Datei schon vorhanden.

```js
// Deckschicht (Spec 2026-09-30-deckschicht-design.md)
const bigC = mkCase('bigC', 120, 60, 80, { weight: 75, layers: [1] });
const smallC = mkCase('smallC', 60, 60, 60, { weight: 28 });
const withLayers = (list, layers) => list.map(it => ({ ...it, layers }));
const withGroup = (list, group) => list.map(it => ({ ...it, ...(group ? { group } : {}) }));
// Anzahl Stücke `capId`, die in einer Säule über einem Stück `baseId` stehen (gleiches x/y, Deckschicht bündig an x0/y0).
const onBase = (r, capId, baseId) => r.placements.filter(p => p.caseId === capId
  && r.placements.some(b => b.caseId === baseId && b.x === p.x && b.y === p.y && b.z < p.z)).length;

test('Deckschicht: kleine, leichte Cases gleichen Gewerks liegen auf den großen, Lademeter sinken', () => {
  const list = [...items(bigC, 12, 'b'), ...withLayers(items(smallC, 12, 's'), [1, 2])];
  const off = autoPack(list, mkTruck());
  const on = autoPack(list, mkTruck(), { mixTop: true });
  assert.equal(on.unplaced.length, 0);
  assert.equal(onBase(off, 'smallC', 'bigC'), 0, 'ohne Deckschicht: eigener Block');
  assert.equal(onBase(on, 'smallC', 'bigC'), 12, 'mit Deckschicht: alle 12 in Lage 2 auf den großen');
  const meters = r => validatePlan(plan(r.placements), byId(bigC, smallC), mkTruck()).totals.loadMeters;
  assert.ok(meters(on) < meters(off), `${meters(on)} < ${meters(off)}`);
  assert.deepEqual(placementIssues(validatePlan(plan(on.placements), byId(bigC, smallC), mkTruck())), []);
});

test('Deckschicht: ohne mixTop exakt wie bisher (Altdaten)', () => {
  const list = [...items(bigC, 5, 'b'), ...items(smallC, 7, 's')];
  assert.deepEqual(autoPack(list, mkTruck()), autoPack(list, mkTruck(), { mixTop: false }));
});

test('Deckschicht: nur gleiches Gewerk bzw. gleiche Gruppe', () => {
  const tonSmall = mkCase('tonSmall', 60, 60, 60, { weight: 28, category: 'Ton' });
  const r1 = autoPack([...items(bigC, 2, 'b'), ...items(tonSmall, 2, 't')], mkTruck(), { mixTop: true });
  assert.equal(onBase(r1, 'tonSmall', 'bigC'), 0, 'anderes Gewerk');
  const r2 = autoPack([...withGroup(items(bigC, 2, 'b'), 'A'), ...withGroup(items(smallC, 2, 's'), 'B')], mkTruck(), { mixTop: true });
  assert.equal(onBase(r2, 'smallC', 'bigC'), 0, 'andere Gruppe');
  const r3 = autoPack([...withGroup(items(bigC, 2, 'b'), 'A'), ...items(smallC, 2, 's')], mkTruck(), { mixTop: true });
  assert.equal(onBase(r3, 'smallC', 'bigC'), 0, 'eins mit, eins ohne Gruppe');
  const r4 = autoPack([...withGroup(items(bigC, 2, 'b'), 'A'), ...withGroup(items(smallC, 2, 's'), 'A')], mkTruck(), { mixTop: true });
  assert.equal(onBase(r4, 'smallC', 'bigC'), 2, 'gleiche Gruppe');
});

test('Deckschicht: 0 kg mischt weder oben noch unten', () => {
  const zeroSmall = mkCase('zeroSmall', 60, 60, 60, { weight: 0 });
  const zeroBig = mkCase('zeroBig', 120, 60, 80, { weight: 0, layers: [1] });
  const r1 = autoPack([...items(bigC, 2, 'b'), ...items(zeroSmall, 2, 'z')], mkTruck(), { mixTop: true });
  assert.equal(onBase(r1, 'zeroSmall', 'bigC'), 0, '0-kg-Stück nicht als Deckschicht');
  const r2 = autoPack([...items(zeroBig, 2, 'b'), ...items(smallC, 2, 's')], mkTruck(), { mixTop: true });
  assert.equal(onBase(r2, 'smallC', 'zeroBig'), 0, 'nicht auf 0-kg-Unterlage');
});

test('Deckschicht: nichts Schwereres, nichts Größeres obendrauf; 90° gedreht passt', () => {
  const heavySmall = mkCase('heavySmall', 60, 60, 60, { weight: 90 });
  const r1 = autoPack([...items(bigC, 2, 'b'), ...items(heavySmall, 2, 'h')], mkTruck(), { mixTop: true });
  assert.equal(onBase(r1, 'heavySmall', 'bigC'), 0, 'schwerer');
  const wide = mkCase('wide', 80, 80, 40, { weight: 10 });
  const r2 = autoPack([...items(bigC, 2, 'b'), ...items(wide, 2, 'w')], mkTruck(), { mixTop: true });
  assert.equal(onBase(r2, 'wide', 'bigC'), 0, '80 breit passt nicht auf 60');
  const long = mkCase('long', 60, 110, 30, { weight: 10 }); // passt nur so gedreht, dass 110 längs auf 120 liegt
  const r3 = autoPack([...items(bigC, 1, 'b'), ...items(long, 1, 'l')], mkTruck(), { mixTop: true });
  assert.equal(onBase(r3, 'long', 'bigC'), 1, 'gedreht als Deckschicht');
  assert.deepEqual(placementIssues(validatePlan(plan(r3.placements), byId(bigC, long), mkTruck())), []);
});

test('Deckschicht: Lagen je Stück gelten (Lage 3 nur, wenn das Stück sie erlaubt)', () => {
  const two = mkCase('two', 120, 60, 60, { weight: 56 });
  const list = [...withLayers(items(two, 2, 't'), [1, 2]), ...withLayers(items(smallC, 1, 's'), [1, 2])];
  const r = autoPack(list, mkTruck(), { mixTop: true });
  assert.equal(onBase(r, 'smallC', 'two'), 0, 'Stapel two ist mit 2 Lagen voll, smallC darf nicht in Lage 3');
  const list3 = [...withLayers(items(two, 2, 't'), [1, 2]), ...withLayers(items(smallC, 1, 's'), [1, 2, 3])];
  const r3 = autoPack(list3, mkTruck(), { mixTop: true });
  assert.equal(r3.placements.find(p => p.caseId === 'smallC').z, 120, 'mit Lage 3 erlaubt');
});

test('Deckschicht: Pack-Regel „Gruppe zuletzt“ wird nicht unterlaufen', () => {
  const rules = [{ by: 'group', value: 'Motoren', pos: 'last' }, { by: 'volume' }];
  const fohBig = mkCase('fohBig', 120, 60, 80, { weight: 75, layers: [1] });
  const list = [...withGroup(items(bigC, 2, 'b'), 'Motoren'), ...withGroup(items(fohBig, 2, 'f'), 'FOH'),
    ...withGroup(items(smallC, 2, 's'), 'Motoren')];
  const r = autoPack(list, mkTruck(), { rules, mixTop: true });
  assert.equal(onBase(r, 'smallC', 'fohBig'), 0, 'Motoren-Deckschicht nie auf FOH');
  assert.equal(onBase(r, 'smallC', 'bigC'), 2, 'aber auf Motoren');
});

test('Deckschicht: Traversen tragen nichts und liegen nie obendrauf', () => {
  const tr = mkCase('tr', 240, 62, 115, { kind: 'truss', category: 'Rigging', weight: 120, stackable: true, truss: { length: 240, width: 62, count: 1, standing: true, height: 115 } });
  const rigSmall = mkCase('rigSmall', 60, 60, 40, { weight: 20, category: 'Rigging' });
  const r = autoPack([...items(tr, 1, 't'), ...items(rigSmall, 1, 'r')], mkTruck(), { mixTop: true });
  assert.equal(r.placements.find(p => p.caseId === 'rigSmall').z, 0);
});

test('Deckschicht auf Deckschicht: kleinere Stücke dürfen weiter oben aufeinander, solange alle Grenzen halten', () => {
  const r = autoPack([...items(bigC, 1, 'b'), ...items(smallC, 2, 's')], mkTruck(), { mixTop: true });
  assert.equal(onBase(r, 'smallC', 'bigC'), 2, 'zweites smallC auf dem ersten (Lage 3, alle Lagen erlaubt)');
  assert.deepEqual(placementIssues(validatePlan(plan(r.placements), byId(bigC, smallC), mkTruck())), []);
});

test('Deckschicht, Eigenschaft: keine neuen Placement-Fehler, nichts geht verloren, nichts Schweres auf Leichtem', () => {
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const pool = [...PRESET_CASES, ...CASE_LIBRARY].filter(c => !c.legacy && c.weight > 0);
  const byAll = new Map([...PRESET_CASES, ...CASE_LIBRARY].map(c => [c.id, c]));
  for (let run = 0; run < 40; run++) {
    const truck = PRESET_TRUCKS[run % PRESET_TRUCKS.length];
    const list = [];
    const kinds = 2 + Math.floor(rnd() * 4);
    for (let k = 0; k < kinds; k++) {
      const c = pool[Math.floor(rnd() * pool.length)];
      const n = 1 + Math.floor(rnd() * 8);
      for (let i = 0; i < n; i++) list.push(mkItem(c, `r${run}k${k}i${i}`));
    }
    const off = autoPack(list, truck);
    const on = autoPack(list, truck, { mixTop: true });
    assert.equal(on.placements.length + on.unplaced.length, list.length, `run ${run}: Stückzahl`);
    const codes = r => new Set(placementIssues(validatePlan(plan(r.placements, r.unplaced), byAll, truck)).map(i => i.code));
    const before = codes(off);
    for (const code of codes(on)) assert.ok(before.has(code), `run ${run}: neuer Fehler ${code}`);
    for (const p of on.placements) {
      if (p.z === 0) continue;
      const below = on.placements.filter(q => q.x === p.x && q.y === p.y && q.z < p.z).sort((a, b) => b.z - a.z)[0];
      if (below) assert.ok(byAll.get(below.caseId).weight >= byAll.get(p.caseId).weight, `run ${run}: schwer auf leicht`);
    }
  }
});
```

- [ ] **Step 2:** `node --test tests/packer.test.js` ausführen. Erwartung: Die Deckschicht-Tests schlagen fehl, die Altdaten-Tests nicht.

- [ ] **Step 3: Implementierung** in `js/model/packer.js`:
  - Import erweitern: `import { legacyRules, blockComparator, volumeOf, sameSelectorRank } from './packRules.js';`
  - Nach `canAddToStack` einfügen:

```js
// Deckschicht (Spec 2026-09-30-deckschicht-design.md): gehören zwei Stücke zusammen? Beide mit
// Gruppe → gleiche Gruppe; beide ohne → gleiches Gewerk; eins mit, eins ohne → nein.
const belongsTogether = (a, ca, b, cb) =>
  (a.group || b.group) ? a.group === b.group : ca.category === cb.category;

// Passt das Stück als Deckschicht auf den Stapel `s` eines früheren Blocks? Liefert die (evtl. im
// Grundriss um 90° gedrehte) Orientierung oder null. Grundfläche ganz auf dem obersten Stück
// (100 % Auflage), Gewichte bekannt (> 0, 0 kg = unbekannt, eigene Entscheidung) und nicht schwerer
// als oben, keine Traversen, sonst dieselben Grenzen wie beim Stapeln (canAddToStack, 4 Lagen,
// Lagen je Stück).
function capFits(s, it, c, o, truck) {
  const base = s.items[0], top = s.items.at(-1);
  if (isTruss(c) || isTruss(base.c)) return null;
  if (!(c.weight > 0) || !s.items.every(x => x.c.weight > 0)) return null;
  if (!belongsTogether(it, c, base.it, base.c)) return null;
  if (s.items.length >= 4 || !pieceLayers(it, c).includes(s.items.length + 1)) return null;
  const swapped = { ...o, rot: (o.rot + 90) % 360, d: { dx: o.d.dy, dy: o.d.dx, dz: o.d.dz } };
  for (const cand of [o, swapped]) {
    if (cand.d.dx > top.o.d.dx + 1e-6 || cand.d.dy > top.o.d.dy + 1e-6) continue;
    if (canAddToStack(s, c, cand.d.dz, truck)) return cand;
  }
  return null;
}
```

  - In `buildStacks`:
    - Signatur `export function buildStacks(itemList, truck, { order = 'volume', rules, mixTop = false } = {})`.
    - Am Anfang: `const ruleList = typeof (rules ?? order) === 'string' ? legacyRules(rules ?? order) : (rules ?? order);`
    - Die Aufrufzeile auf `orderSorts(itemList, ruleList).forEach((group, sort) => {` ändern.
    - `fits` erweitern: `const fits = (s, it, c, o) => !s.capped && s.key === … (Rest unverändert)`.
    - Neuer Stapel (im `onMiss` von `withFloor`): zusätzlich `block: group` ins Stapel-Objekt.
    - `addTo` ersetzen durch:

```js
    const addTo = (list, onMiss) => {
      for (const { it, c, o } of list) {
        const usePrev = prevLast && fits(prevLast, it, c, o);
        const target = usePrev ? prevLast : own.find(s => fits(s, it, c, o));
        if (target) { push(target, it, c, o, !usePrev); last = target; continue; }
        // Deckschicht: erst wenn weder Auffüllen noch ein eigener Stapel geht, auf den ersten
        // passenden Stapel eines FRÜHEREN Blocks (näher an der Stirnwand). `last` bleibt dabei
        // unverändert – prevLast gehört weiter dem Stapel, den diese Sorte selbst zuletzt belegt hat.
        if (mixTop) {
          let cap = null, capO = null;
          for (const s of stacks) {
            if (s.sort >= sort || !sameSelectorRank(ruleList, s.block, group)) continue;
            capO = capFits(s, it, c, o, truck);
            if (capO) { cap = s; break; }
          }
          if (cap) { push(cap, it, c, capO, false); cap.capped = true; continue; }
        }
        onMiss({ it, c, o });
      }
    };
```

  - `autoPack(items, truck, { obstacles = [], order = 'volume', rules, mixTop = false, startX = 0 } = {})` ruft `buildStacks(items, truck, { order, rules, mixTop })` auf.
  - Die Rotation eines Stücks im Placement bleibt `swap ? (o.rot + 90) % 360 : o.rot`. Die Deckschicht-Orientierung trägt ihr `rot` schon.

- [ ] **Step 4:** `npm test` ausführen. Erwartung: grün. Schlägt ein vorgegebener Test gegen diesen Code fehl, die Erwartung nicht still ändern, sondern DONE_WITH_CONCERNS mit Analyse melden.
- [ ] **Step 5:** Anführungszeichen prüfen, dann committen: `feat: Deckschicht mischen im Packer (gleiche Gruppe bzw. gleiches Gewerk, leichter und kleiner)`

---

### Task 4: Aktionen und Import/Export – `mixTop`

**Files:**
- Modify: `js/model/actions.js`, `js/store/io.js`
- Test: `tests/actions.test.js`, `tests/io.test.js`

**Interfaces:**
- Consumes: `mixTopFor` (Task 2), `autoPack({ mixTop })` (Task 3).
- Produces:
  - `setMixTop(plan, on: boolean) → plan`: `true` setzt `mixTop: true`, `false` entfernt das Feld. Unverändert = gleiche Referenz.
  - `checkPlan` und `checkRuleSet` akzeptieren optional boolean `mixTop`.

- [ ] **Step 1: Failing Tests.**

  `tests/actions.test.js`:

```js
test('setMixTop: an setzt true, aus entfernt das Feld, unverändert = gleiche Referenz', () => {
  const p0 = plan([]);
  const p1 = A.setMixTop(p0, true);
  assert.equal(p1.mixTop, true);
  assert.equal(A.setMixTop(p1, true), p1);
  assert.ok(!('mixTop' in A.setMixTop(p1, false)));
  assert.equal(A.setMixTop(p0, false), p0);
});

test('packAll: mixTop legt kleine Cases als Deckschicht auf die großen', () => {
  const big = mkCase('big', 120, 60, 80, { weight: 75, layers: [1] });
  const small = mkCase('small', 60, 60, 60, { weight: 28 });
  const ctx = { caseById: byId(big, small), truck: mkTruck(), newId: counter('n') };
  let p = A.addUnplaced(plan([]), 'big', 4, counter('b'));
  p = A.addUnplaced(p, 'small', 4, counter('s'), { layers: [1, 2] });
  const onBig = r => r.placements.filter(q => q.caseId === 'small'
    && r.placements.some(b => b.caseId === 'big' && b.x === q.x && b.y === q.y)).length;
  assert.equal(onBig(A.packAll(p, ctx)), 0, 'aus: eigener Block');
  assert.equal(onBig(A.packAll(A.setMixTop(p, true), ctx)), 4, 'an: alle vier auf den großen');
});
```

  `tests/io.test.js`:

```js
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
```

- [ ] **Step 2:** `node --test tests/actions.test.js tests/io.test.js` ausführen. Erwartung: FAIL.
- [ ] **Step 3: Implementierung.**
  - `js/model/actions.js`:
    - Import `mixTopFor` zusätzlich aus `./packRules.js`.
    - Nach `setPackRules`:

```js
// Schalter „Deckschicht mischen“ je Load (Spec 2026-09-30-deckschicht-design.md). Aus = Feld fehlt,
// wie bei Altdaten; unverändert = gleiche Referenz (kein leerer Undo-Schritt).
export function setMixTop(plan, on) {
  if (mixTopFor(plan) === (on === true)) return plan;
  if (on === true) return touch({ ...plan, mixTop: true });
  const { mixTop: _drop, ...rest } = plan;
  return touch(rest);
}
```

    - `packAll`: `autoPack(list, ctx.truck, { rules: rulesFor(plan), mixTop: mixTopFor(plan) })`. `packRest` genauso mit `mixTop: mixTopFor(plan)`.
  - `js/store/io.js`:
    - `checkPlan` nach der packRules-Prüfung:
      `if (p.mixTop !== undefined && typeof p.mixTop !== 'boolean') throw new Error(\`Ladeplan „${p.name}“ hat einen ungültigen Deckschicht-Schalter.\`);`
    - `checkRuleSet`: die Bedingung um `|| (rs.mixTop !== undefined && typeof rs.mixTop !== 'boolean')` ergänzen.
- [ ] **Step 4:** `npm test` ausführen. Erwartung: grün.
- [ ] **Step 5:** Anführungszeichen prüfen, dann committen: `feat: Deckschicht-Schalter je Load und in Regelsets`

---

### Task 5: Oberfläche – Schalter im Dialog „Pack-Regeln“

**Files:**
- Modify: `js/ui/pack-rules.js`, `js/app.js`

**Interfaces:**
- Consumes: `A.setMixTop`, `mixTopFor` (Task 2/4).
- Produces:
  - `openPackRules(dlg, { rules, mixTop, targets, caseById, ruleSets, onSaveRuleSet(name, rules, mixTop), onDeleteRuleSet })` liefert `{ rules, mixTop, repack } | null`.

- [ ] **Step 1: `js/ui/pack-rules.js`:**
  - Option `mixTop = false` annehmen.
  - Nach `<ol class="rule-list"></ol>` einfügen:

```html
      <label class="check rule-mix"><input type="checkbox" name="mixTop"> Deckschicht mischen: leichtere, kleinere Cases derselben Gruppe bzw. desselben Gewerks obendrauf</label>
      <small class="hint">Cases ohne Gewicht (0 kg) werden nicht gemischt. Die Lagen je Stück gelten weiter.</small>
```

  - Nach dem Aufbau `f.mixTop.checked = mixTop === true;` setzen.
  - `apply-set`: zusätzlich `f.mixTop.checked = s.mixTop === true;`
  - `save-set`: `onSaveRuleSet?.(name, cur, f.mixTop.checked)`.
  - `resolve`: `{ rules: cur, mixTop: f.mixTop.checked, repack: v === 'repack' }`.
  - Kopfkommentar anpassen.
- [ ] **Step 2: `js/app.js`:**
  - Import `mixTopFor` aus `./model/packRules.js`.
  - `saveRuleSetValue(name, rules, mixTop)`: `stamp({ id: …, name, rules, ...(mixTop ? { mixTop: true } : {}) })`
  - Im `#pack-rules`-Handler `mixTop: mixTopFor(s.plan)` übergeben. Den Edit so fassen:
    `edit((p, cx) => { let next = A.setMixTop(A.setPackRules(p, res.rules), res.mixTop); return res.repack ? A.packAll(next, cx) : next; });`
  - Tooltip von `#pack-rules`: `… · Deckschicht an` anhängen, wenn `mixTopFor(s.plan)`.
- [ ] **Step 3:** `npm test` ausführen. Erwartung: grün.
- [ ] **Step 4: Browser-Kurzprüfung** (CLAUDE.md „Prüfen“ → „Im Browser“, Server 8766, Szenario im Scratchpad):
  - Dialog öffnen, Checkbox setzen, „Speichern und neu packen“.
  - Prüfen: `store.get().plan.mixTop === true`, und die Placements zeigen die Deckschicht.
  - Screenshot des Dialogs, `p.logs` ohne Fehler.
- [ ] **Step 5:** Anführungszeichen prüfen, dann committen: `feat: Schalter „Deckschicht mischen“ im Dialog Pack-Regeln`

---

### Task 6: Abnahme und Doku (Version erst nach Rückfrage)

**Files:**
- Modify: `README.md`, `docs/architektur.md`, `docs/offene-punkte.md`

- [ ] **Step 1: Browser-Abnahme** nach der Verifikation der Spec. Szenario:
  - Sattelauflieger, alles `tipped: false`.
  - 12 × Packcase 120×60×80 mit `layers: [1]`, 12 × Packcase 60×60×60 mit `layers: [1, 2]`.
  - Einmal ohne, einmal mit Deckschicht packen und jeweils Lademeter per `validatePlan` messen. Erwartet sind 4,80 m bzw. 3,60 m. Weicht es ab, analysieren und im Report erklären.
  - Screenshots von Seitenansicht und Draufsicht mit Deckschicht, `validatePlan` ohne Placement-Fehler.
  - Die Screenshots selbst ansehen.
- [ ] **Step 2: README.md** – nach dem Absatz zu Pack-Regeln einen Absatz „Deckschicht mischen“:
  - Was sie tut.
  - Wer auf wen darf (gleiche Gruppe, sonst gleiches Gewerk).
  - Leichter und kleiner, 0 kg mischt nicht.
  - Lagen gelten weiter, mit Vorgabe 1+2 ist ein 2er-Stapel voll.
  - Pack-Regeln bleiben gewahrt, eine Ebene je Stück, keine Traversen.
  - Im Regelset gespeichert.
- [ ] **Step 3: docs/architektur.md:**
  - Kopf „Stand V 0.8.6“.
  - Im Absatz „Sortenrein“ die Deckschicht (`mixTop`, `capFits`, `belongsTogether`, `sameSelectorRank`, `capped`, Reihenfolge der vier Wege in `addTo`).
  - Packcase-Gewichtsformel im Abschnitt „Mitgelieferte Daten“.
- [ ] **Step 4: docs/offene-punkte.md:**
  - Den Punkt „Teil B Mischen erlaubt“ als erledigt entfernen.
  - Neu: Eine Ebene trägt nur ein Stück (kein Nebeneinander kleiner Cases auf einem großen). 0-kg-Cases mischen nicht. Lagen-Vorgabe 1+2 begrenzt die Deckschicht. Die Packcase-Gewichte sind eine Auslegung der Nutzerangabe.
- [ ] **Step 5:** CHANGELOG-Eintrag nur als Entwurf in den Report. `npm test`, Anführungszeichen prüfen, dann committen: `docs: Deckschicht und Packcase-Gewichte dokumentiert`
- [ ] **Step 6 (Controller, nach Rückfrage):**
  - Version vorschlagen: 0.8.6.
  - Nach Bestätigung an allen Stellen setzen und den CHANGELOG schreiben.
  - Mergen, pushen, Pages prüfen.
