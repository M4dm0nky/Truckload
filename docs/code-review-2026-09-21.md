# Code-Review zum Meilenstein V 0.6.0

Datum: 2026-09-21. Geprüft wurde der **gewachsene Bestand** über alle sechs Versionen
hinweg, nicht ein einzelner Diff — 3.569 Zeilen Anwendungscode und 1.828 Zeilen Tests,
aufgeteilt auf drei parallele Reviews (Modell, Oberfläche, Daten und Verdrahtung).

Einstufungen: `[blocking]` muss vor der nächsten Veröffentlichung weg, `[important]`
sollte behoben werden, `[nit]` Kleinigkeit, `[suggestion]` Alternative zum Abwägen.

Summe: 7 × blocking, 25 × important, 24 × nit, 19 × suggestion.

Vom Controller nachgerechnet und bestätigt: der Absturz durch `updatedAt` aus fremder
Datei, der Autosave ohne Fehlerbehandlung, die überlappenden Rollen bei schmalen Cases,
der überhöhte Packer-Score, die Rollenhöhe gegen `checkCase`. Eine Korrektur: Die
vorbelegte Beschriftung sprengt die 40-Zeichen-Grenze **nicht** bei den mitgelieferten
Cases (längster Name 33 Zeichen), sondern erst bei selbst angelegten Cases mit einem
Namen über 37 Zeichen — der Editor erlaubt bis zu 80.

Schichtübergreifend geprüft und in Ordnung: kein UI-Modul importiert den Store, kein
Modell-Modul die Oberfläche, kein DOM-Zugriff im Modell, alle fünf reinen Module sind
wirklich rein, jedes hat Tests, kein toter Code, keine liegengebliebenen Marker.

---

# Teil 1 — Modellschicht

# Code-Review Modellschicht — Truckload V 0.6.0

Stand: `main` @ 19b1710, `npm test` = 239 grün. Geprüft: `js/model/{geometry,validate,actions,packer,truss,caseShape}.js`
und die zugehörigen Tests. Alle Korrektheitsbefunde sind mit `node` gegen den echten Code nachgerechnet;
die Testbefunde stammen aus einem Mutationslauf über eine Arbeitskopie (Basis dort: 238 grün, `pwa.test.js`
fällt dort nur wegen des fehlenden `vendor/`-Ordners aus).

**Einstufungen:** 0 × blocking · 8 × important · 7 × nit · 7 × suggestion

---

## Was gut gelöst ist

- **`outerDims` als einzige Maßquelle** trägt. `localDims` → `effectiveDims` → `boxOf` ist eine saubere
  Kette; kein Modul unter `js/model/` greift an `outerDims` vorbei auf `c.l/c.w/c.h` zu (einzige
  Ausnahme ist `trussDims`, das die Maße ja erzeugt). Der Regressionstest mit Altdaten
  (`geometry.test.js`, „Altdaten ohne neue Felder“) sichert genau das ab, was die Projektregel verlangt.
- **`rotForWheelFace` ↔ `wheelFace`** ist über alle 3 × 4 Kombinationen als exakte Umkehrung getestet
  (`geometry.test.js`), nicht an drei Beispielen. Das ist die richtige Form für so eine Zusage.
- **Die Stück-Daten überleben den Packer.** `toPiece` → `autoPack` → `stripCase` hält `id`/`label`/`color`
  durch, in beiden Richtungen (Placement *und* Ablage), und drei Regressionstests in `actions.test.js`
  benennen den historischen Fehler ausdrücklich.
- **Die Kommentare an den heiklen Stellen** (`chooseOrientation`-Türvorrang, `swap` in `placeStacks`,
  `applyField`-Teilsemantik, `trussShape`-Aufbau) erklären das *Warum*, nicht das *Was*. Der Kommentar in
  `packer.test.js` vor den beiden Regressionstests, der begründet, warum der davorstehende Test den Fehler
  *nicht* fängt, ist vorbildlich — genau diese Selbstprüfung fehlt an anderen Stellen (s. u.).
- **`orphans`/`missing`** sind konsequent: kein Stück geht verloren, auch nicht bei fehlendem Case-Typ.

---

## Korrektheit und Randfälle

### [important] `caseShape.js:17-22` — Rollen überlappen bei schmalen Cases, mit echten Bibliotheksdaten

`d = wh * 0.8`, `inset = Math.max(3, d * 0.4)`. Ist eine Achse in der Rollenebene kürzer als
`2 * (inset + d)`, rücken die beiden Rollen ineinander. Bei der Vorgabe `wh = 12` sind das 26,88 cm.

Nachgerechnet über die ganze `CASE_LIBRARY` (stehend, `rot 0`):

| Case | Maß | Folge |
|---|---|---|
| `AF-1 -CAB` | 44 × 23 × 58, `wheelH 12` | 2 Rollenpaare überlappen (y: 3,84–13,44 gegen 9,56–19,16) |
| `SF TourHazer II -CAB` | 53 × 25 × 41, `wheelH 12` | dito |

Bei noch schmaleren Cases (der Case-Editor erlaubt `min="1"`) ragen die Rollen zusätzlich aus der Box:
20 × 40 × 40 mit `wheelH 12` → `box.x1 = 20`, aber `wheel.x1 = 16,16` bei gleichzeitiger Überlappung;
unter 13,44 cm Kantenlänge steht die Rolle komplett außerhalb.

Bemerkenswert: `trussShape` löst genau dieses Problem sauber (`wheelD = Math.min(DOLLY_WHEEL_D, dollyLen/3, dollyW/3)`
und ein begrenzter `inset`) — `caseShape` hat die Begrenzung nie bekommen. Das ist eine Copy-Paste-Variante
mit Lücke.

**Vorschlag:** dieselbe Begrenzung wie in `trussShape` übernehmen, z. B.
`const d = Math.min(wh * 0.8, dim1 / 3, dim2 / 3)` über die beiden Achsen aus `wheelAxes(face)`, und
`inset = Math.max(0, Math.min(3, (dim - 2*d) / 2))`. Anschließend `pairwiseNoOverlap` aus
`caseShape.test.js` über alle Ausrichtungen × `rot`-Werte für ein schmales Case laufen lassen (s. Testteil).

### [important] `validate.js:52,63-67` — Placements mit fehlendem Case-Typ werden von keiner Kollisionsprüfung erfasst, und `packAll` packt in sie hinein

`buildItems` wirft Placements ohne Case-Typ in `missing` und sie kommen in `items` nicht mehr vor. Damit
nehmen sie an *keiner* Prüfung teil außer `missingCase` — insbesondere nicht an der Kollisionsprüfung.
`actions.js:170` behält sie aber an ihrer alten Position im Plan, und `packAll` übergibt sie auch nicht
als `obstacles` an `autoPack`.

Nachgerechnet:

```
plan: [P('ghost','weg',0,0,0), P('a','k',400,0,0)]        // 'weg' fehlt in der Bibliothek
packAll(...) → placements: [ ['a','k',0,0,0], ['ghost','weg',0,0,0] ]
validatePlan(...) → codes: ['missingCase', 'imbalance']    // KEIN 'collision'
```

Das frisch gepackte Case `a` steht exakt im selben Raum wie `ghost`, und der Plan meldet dazu nichts. In
der 2D/3D-Ansicht sieht man zwei Cases ineinander. `packRest` hat denselben Fehler
(`obstacles: items.map(...)` enthält die Waisen ebenfalls nicht).

**Vorschlag:** `buildItems` zusätzlich eine Ersatz-Box für `missing` liefern lassen (aus dem letzten
bekannten Maß gibt es nichts — also entweder Waisen-Placements beim Packen mit ihrer gespeicherten Box als
Hindernis führen, falls eine vorliegt, oder sie in `packAll`/`packRest` in die Ablage schieben statt sie
am Platz zu lassen). Mindestens muss die Meldung sagen, dass die Position ungeprüft bleibt.

### [important] `packer.js:10-12` — der Füllgrad-Score kennt die 4-Lagen-Grenze des eigenen Packers nicht

`const layers = c.stackable ? Math.floor(truck.h / d.dz) : 1;` — `buildStacks` stapelt aber nie höher als
4 (`packer.js:68,81`). Bei flachen Cases bewertet `chooseOrientation` damit eine Lagenzahl, die nie
zustande kommt.

Konkret, Case 120 × 60 × 30, tippbar, Standard-Truck (1360 × 248 × 270), 24 Stück:

| Kandidat | dz | `layers` laut Score | erreichbar | Score | Score mit Deckel 4 |
|---|---|---|---|---|---|
| standing rot 0 | 30 | **9** | 4 | **0,968** | 0,430 |
| tipLong rot 0 | 60 | 4 | 4 | 0,860 | **0,860** |

`chooseOrientation` wählt `standing`. `autoPack(24 Stück)` liefert dann 6 Stapel à 4 Lagen = **120 cm
Bauhöhe bei 270 cm Laderaum und 2,40 Lademeter**. Mit `tipLong` (dy 30 → 8 Spalten nebeneinander)
passen dieselben 24 Stück in eine einzige x-Reihe = **1,20 Lademeter**. Der Packer verschenkt hier die
Hälfte der Ladefläche, und zwar systematisch bei allen flachen, stapelbaren Cases (19"-Racks, Kabelcases).

Dieselbe Stelle ignoriert auch `layersOf(c)`: ein Case mit `layers: [1]` bekommt `layers = 9` in den Score,
obwohl `buildStacks` es garantiert allein auf den Boden stellt.

**Vorschlag:**
```js
const cap = Math.max(...layersOf(c));              // 4er-Grenze steckt in DEFAULT_LAYERS
const layers = c.stackable ? Math.min(cap, Math.floor(truck.h / d.dz)) : 1;
```
Der Mutationslauf zeigt: diese Änderung lässt alle 239 Tests grün — es gibt also auch keinen Test, der
das jetzige Verhalten festhält. Ein Test, der für 120 × 60 × 30 die Lademeter prüft, gehört dazu.

### [important] `truss.js:8-13` — `trussDims` erzwingt die Breitengrenze nicht, die es selbst voraussetzt

`w = 2*width <= 60 ? 60 : 80` unterstellt stillschweigend `width <= 40`. Die Grenze steht nur in
`case-editor.js:59` (`max="40"`) und `io.js:37`. Bei `width = 45`:

```
trussDims({length:300,width:45,count:2}) → { l:300, w:80, h:62 }
trussShape(...).pieces → [ y -5…40 ], [ y 40…85 ]     // Box ist y 0…80
```

Beide Traversenstücke ragen aus dem Wagen; in 3D stehen sie im Nachbar-Case, in der Kollisionsprüfung
taucht davon nichts auf, weil dort nur die Box zählt. Heute unerreichbar — aber die Zusage aus
`docs/architektur.md` („Die Außenmaße werden **immer** aus diesen Parametern gerechnet“) gilt dann nur,
solange zwei andere Dateien mitspielen.

**Vorschlag:** `export const MAX_TRUSS_WIDTH = DOLLY_WIDTHS.at(-1) / 2;` in `truss.js`, von
`case-editor.js` und `io.js` importieren statt die 40 dreimal zu schreiben, und in `trussDims` die Breite
klemmen oder werfen.

### [important] `validate.js:58,65,78,80,95,101,104` — die Meldungstexte nennen den Case-Typ-Namen, nicht die Stück-Beschriftung

`docs/architektur.md` sagt: „`buildItems()` … legt `it.label` und `it.color` … frei. **Alle** Ansichten,
der Inspector und der Druck lesen von dort — nicht selbst aus dem Case.“ `validatePlan` baut `it.label`
auf, benutzt es aber nirgends und schreibt durchweg `it.c.name`. Inspector (`inspector.js:49,67`) und
Druck (`print.js:17`) geben `i.message` wörtlich aus.

```
P('a','k',1300,0,0,{ label: 'Front-Case 3' })
→ "k ragt über den Laderaum hinaus."        // statt "Front-Case 3 …"
```

Bei mehreren Exemplaren desselben Typs kann der Nutzer die Meldung keinem Stück zuordnen — genau der
Grund, aus dem es die Stück-Beschriftung gibt.

**Vorschlag:** in `validatePlan` einmal `const n = it.label` statt `it.c.name` setzen (die Variable `n`
gibt es in der ersten Schleife schon, in den anderen fehlt sie). Nebenbei werden die Texte dann typografisch
einheitlich: heute stehen `„…“` nur in den beiden Lagen-Meldungen, die übrigen sechs kommen ohne
Anführungszeichen.

### [important] `validate.js:60` — getippte Traversenwagen melden „darf nicht getippt werden“, obwohl die Geometrie die Lage gar nicht auswertet

`effectiveDims` (`geometry.js:35`) zwingt `kind === 'truss'` auf `standing`; `cycleTip`/`setWheelFace`
verweigern die Änderung. `validatePlan` prüft aber stumpf `orientation !== 'standing' && !c.tippable`.

```
P('a','tr',0,94,0,{ orientation:'tipLong' })  // tr = Traversenwagen, tippable:false
→ "Traversenwagen darf nicht getippt werden."
```

Ein importierter Plan (`io.js` lässt jede Orientierung für jedes Placement durch) zeigt damit eine
Dauerwarnung, die der Nutzer nicht wegbekommt: Die Ansicht sieht korrekt aus, `cycleTip` ändert nichts,
und die Meldung bleibt. **Vorschlag:** `if (!isTruss(it.c) && it.p.orientation !== 'standing' && !it.c.tippable)`
— und in `normalizeCase` / beim Laden die Orientierung von Traversen-Placements auf `standing` ziehen.

### [nit] `validate.js:77` — Division durch null bei einer Grundfläche von 0

`area / footprintArea(it.box)` wird `NaN`, wenn `l` oder `w` 0 ist; `NaN < 0.8` ist `false`, das Case
schwebt also ohne Meldung:

```
Case 0 × 60 × 60 bei z = 100, nichts darunter → issues: ['imbalance'] — kein 'unsupported'
```

`io.js:18` fängt das beim Import ab, der Case-Editor über `min="1"`, die mitgelieferten Daten haben es
nicht. Also nicht erreichbar, aber eine stille Falschaussage, wenn es doch einmal passiert.
**Vorschlag:** `const fa = footprintArea(it.box); if (fa <= 0 || area / fa < SUPPORT_MIN)`.
Dasselbe gilt für `volumeRatio` (`validate.js:132`) bei einem Truckmaß 0.

### [nit] `geometry.js:49` — `wheelFace` liefert `undefined` bei einem `rot` außerhalb 0/90/180/270

`FACE_CYCLE[(i + rot/90) % 4]` — bei `rot = -90` kommt Index `-1` heraus, bei `rot = 45` ein Bruch, in
beiden Fällen `undefined`. `caseShape` nimmt dann keinen der fünf `else if`-Zweige, der Korpus füllt die
ganze Box und vier Rollen werden mit `undefined`-Achsen gebaut. `io.js` prüft `ROTATIONS`, aber IndexedDB-
Daten laufen nicht durch `checkPlan`. **Vorschlag:** `((i + Math.round((p.rot ?? 0) / 90)) % 4 + 4) % 4`.

### [nit] `actions.js:104-108` — `nextLabel` zählt die letzte Zahl im Text hoch, nicht die Nummer des Stücks

```
'Case 09'       → 'Case 10'    // führende Null weg
'Case 3 von 8'  → 'Case 3 von 9'
```
Die zweite Form ist in der Praxis üblich („Amp 2 von 6“). **Vorschlag:** die Stellenzahl erhalten
(`String(n+1).padStart(m[2].length,'0')`) und beim Duplizieren nichts hochzählen, wenn hinter der Zahl
noch Text steht.

### [nit] `actions.js:28-32` — `removeUnplaced` trifft den ersten Eintrag des Typs, nicht den zuletzt angelegten

```
addUnplaced(…, labels:['A','B','C']) ; removeUnplaced(…, 'k')
→ übrig: [{u2,'B'}, {u3,'C'}]      // 'A' ist weg
```
Wer im Wizard drei beschriftete Stücke anlegt und einmal auf „−“ tippt, verliert die erste Beschriftung,
nicht die letzte. **Vorschlag:** von hinten suchen (`findLastIndex`) oder unbeschriftete bevorzugen.

### [nit] `actions.js:110-118` — `duplicate` setzt das Duplikat blind neben das Original, auch über die Heckkante hinaus

```
P('a','k',1300,94,0) im 1360er Truck → Kopie bei x = 1420
→ issues: ['outOfBounds','outOfBounds']
```
Zwei Fehlermeldungen als Ergebnis eines Kopierbefehls ist eine unfreundliche Vorgabe.
**Vorschlag:** falls `x + dx > truck.l`, stattdessen `-dx` versuchen, sonst in y ausweichen; notfalls
in die Ablage legen.

### [suggestion] `actions.js:70-79` — `reorient` lässt den Stapel über dem gedrehten Case stehen

```
[P('a',…,z 0), P('b',…,z 60)]  → issues: []
cycleTip(…,'a')                → a: tipLong/rot 270 (neue Höhe 120), b bleibt bei z 60
                               → issues: [['b','unsupported']]
```
`stackAbove(id, items)` wird zwar berechnet und aus den Hindernissen ausgeschlossen, aber der Stapel wird
nicht nachgezogen. Das ist vertretbar (der Nutzer sieht die Warnung sofort), sollte aber eine bewusste
Entscheidung mit Kommentar sein — heute sieht es wie ein Versehen aus, weil `moveGroup` genau das Gegenteil tut.

### [suggestion] `validate.js:112-117` — der Schwerpunkt wird in x berechnet, aber nur in y geprüft

`cog.x` fließt in keine Prüfung. Für die Praxis ist die Achslastverteilung in x (Stützlast, Hinterachse)
mindestens so wichtig wie die Seitenlage — und das Modell hat die Zahl bereits. Entweder eine Prüfung
ergänzen (dafür bräuchte der Truck einen Radstand/Achsabstand) oder im Kommentar festhalten, dass
bewusst nur die Seitenlage geprüft wird.

---

## Invarianten, die niemand erzwingt

### [important] `geometry.js:35`, `actions.js:86,99` — `isTruss` existiert, wird im Modell aber nicht benutzt

`truss.js:15` exportiert `isTruss`; die gesamte UI (`view2d`, `view3d`, `library`, `load-wizard`,
`case-editor`) benutzt sie. Im Modell steht dreimal das Literal `kind === 'truss'` bzw. `kind !== 'truss'`,
dazu ein viertes Mal in `io.js:33`. `truss.js` importiert nichts, ein Import aus `geometry.js` und
`actions.js` erzeugt also keinen Zyklus.

Dazu kommt, dass `actions.js:86` und `actions.js:99` dieselbe Bedingung `!(c.tippable && c.kind !== 'truss')`
doppelt tragen — eine Änderung an der Tippbarkeitsregel muss an zwei Stellen nachgezogen werden.
**Vorschlag:** `const canTip = c => c.tippable === true && !isTruss(c);` in `geometry.js`, von
`actions.js`, `packer.js` (`chooseOrientation`, Zeile 6) und `validate.js` (Zeile 60) benutzen. Damit wäre
auch der Befund „getippte Traverse meldet notTippable“ von oben mit erledigt.

### [important] `packer.js:7` / `io.js:7` — die vier gültigen Rotationen stehen zweimal als Literal da

`[0, 90, 180, 270]` in `packer.js:7` und `const ROTATIONS = [0, 90, 180, 270]` in `io.js:7`, während
`ORIENTATIONS` und `WHEEL_FACES` ordentlich aus `geometry.js` kommen. **Vorschlag:** `export const ROTATIONS`
neben `ORIENTATIONS` in `geometry.js` und beide Stellen darauf umstellen.

### [nit] `validate.js:9` — die Radkastenseiten sind stringly typed, die Konstante liegt in der falschen Schicht

`a.side === 'both' ? ['left','right'] : [a.side]`. Ein `side: 'Left'` oder ein fehlendes `side` ergibt
`[undefined]` und damit stillschweigend einen Radkasten an der rechten Wand. `ARCH_SIDES` steht in
`io.js:8`, also in der Speicher- statt in der Modellschicht. **Vorschlag:** `ARCH_SIDES` nach
`validate.js` (oder `geometry.js`) und `io.js` importiert sie von dort.

### [suggestion] `validate.js:49` — `code` wird von niemandem außer den Tests gelesen

Kein UI-Modul und `app.js` werten `issue.code` aus (`grep` auf `code ===`, `'collision'` etc. in `js/ui`
und `js/app.js` liefert nichts). Entweder ist das ein bewusster Erweiterungspunkt — dann gehört ein Satz
in `architektur.md` — oder die Codes sollten eine benannte Konstantenliste (`ISSUE_CODES`) bekommen,
damit ein Tippfehler in einem neuen `add(...)`-Aufruf auffällt.

### [suggestion] `validate.js:122` — `if (is.placementId)` filtert statt auf `null` zu prüfen

Ein leerer String als Placement-ID (aus einer Fremddatei; `io.js` prüft nur `typeof === 'string'`) fiele
stillschweigend aus `byPlacement` heraus, die Meldung verschwände im Inspector. `!= null` ist hier die
Absicht.

---

## Wiederverwendung

### [important] `packer.js:65-90` — `withFloor` und `withoutFloor` sind derselbe Block, zweimal geschrieben

Die beiden Schleifen sind Zeile für Zeile gleich; der einzige Unterschied ist der `else`-Zweig (neuen
Stapel anlegen vs. `unplaced.push`). Das ist die klassische Copy-Paste-Variante: Eine Änderung an der
Stapelregel (z. B. der 4er-Deckel oder ein `best fit` statt `find`) muss doppelt gemacht werden, und
genau so ein halber Rückbau bliebe heute grün (s. Testteil, M13).

**Vorschlag:**
```js
const addTo = (e, onMiss) => { … };                       // gemeinsamer Rumpf
for (const e of withFloor)    addTo(e, () => stacks.push(newStack(e)));
for (const e of withoutFloor) addTo(e, () => unplaced.push(e.it));
```

### [suggestion] `truss.js:59-69` vs. `caseShape.js:17-30` — zwei Rollen-Generatoren mit unterschiedlicher Sorgfalt

Beide setzen vier Rollen in die Ecken einer Fläche, beide über eine Achsenabbildung. `trussShape` begrenzt
Durchmesser und Randabstand, `caseShape` nicht (s. erster Befund). Eine gemeinsame Hilfsfunktion
`cornerBoxes(faceBox, axes, size, inset)` in `geometry.js` würde beide bedienen und die Lücke schließen.

### [suggestion] `actions.js:10-13` — `otherBoxes` ruft `buildItems` ein zweites Mal auf

`moveGroup` (Zeile 49) und `reorient` (Zeile 76) bauen die Items schon selbst und rufen dann `otherBoxes`,
das sie noch einmal baut. Bei jeder Maus-Bewegung eines Stapels läuft `buildItems` also doppelt über alle
Placements. **Vorschlag:** `otherBoxes(items, truck, excludeIds)` statt `(plan, ctx, excludeIds)` — dann
ist auch die Abhängigkeit von `ctx` weg und die Funktion rein.

### [nit] `geometry.js:96-101` / `validate.js:34-44` — `supportersOf` wird pro Item über alle Items gefiltert

`layerMap` ruft `supportersOf` für jedes Item auf, `validatePlan` gleich danach noch einmal für dieselben
Items (Zeile 72), und `stackAbove` ein drittes Mal. Das ist dreimal O(n²). Bei 200 Placements sind das
120 000 `footprintOverlapArea`-Aufrufe pro Neuzeichnen. **Vorschlag:** die Supporter einmal in
`buildItems` (oder einer `supportGraph(items)`-Funktion) berechnen und durchreichen — dann verschwindet
auch die halb angelegte `supporters`-Map in `validatePlan:69`, die heute nur für die Lastverteilung
gefüllt wird.

---

## Abstraktion und Signaturen

### [nit] `caseShape(c, p, box)` und `trussShape(c, p, box)` — `box` ist aus `(c, p)` ableitbar

`box === boxOf(c, p)` gilt bei allen heutigen Aufrufern, wird aber nirgends erzwungen. Ein Aufrufer, der
eine skalierte oder verschobene Box übergibt, bekommt stillschweigend Unsinn.
**Vorschlag:** `box = boxOf(c, p)` als Vorgabewert (`function caseShape(c, p, box = boxOf(c, p))`) — die
Aufrufer, die die Box schon haben, sparen weiterhin den Aufruf, die Zusage steht aber in der Signatur.

### [nit] `actions.js:34` — `placeCase(plan, caseId, x, y, ctx, fromUnplacedId)` hat sechs Parameter, davon zwei Positionen

Der sechste Parameter schaltet außerdem das Verhalten um (neues Stück vs. Stück aus der Ablage).
**Vorschlag:** `placeCase(plan, caseId, { x, y }, ctx, { fromUnplacedId })` oder zwei Funktionen
(`placeNew` / `placeFromTray`) — die Verzweigung in Zeile 37 ist heute bereits zwei Aufgaben in einer
Funktion.

### [nit] `actions.js:38-39` — `srcExtra` überschreibt `x/y/z/orientation/rot`

```js
const base = { …, x: snap(x), y: snap(y), z: 0, orientation: 'standing', rot: 0, ...srcExtra };
```
Trägt ein Ablage-Eintrag jemals ein `x` (aus einer Fremddatei — `io.js:65` verbietet in `unplaced` keine
Zusatzfelder), gewinnt der alte Wert gegen die Mausposition. **Vorschlag:** `srcExtra` auf die bekannten
Stückfelder einschränken (`const { label, color } = src ?? {}`), so wie `toTray` und `toPiece` es bereits
tun — dann ist auch das Wissen darüber, was ein „Stück“ ausmacht, nur noch an einer Stelle.

### [suggestion] `packer.js:53` — `buildStacks` macht drei Dinge

Orientierung wählen, sortieren, stapeln. Der `entries`-Aufbau mit `chooseOrientation` (Zeile 55) und die
Trennung `withFloor`/`withoutFloor` (60-63) wären als eigene Funktion `orderForStacking(itemList, truck)`
für sich testbar — heute lässt sich die Sortierregel („leichtere Deckelcases zuerst als Basis“) nur
indirekt über das Stapelergebnis prüfen.

---

## Abgeleiteter Zustand

### [suggestion] Nichts Abgeleitetes wird gespeichert — das ist richtig so, hat aber eine Ausnahme

`layers`, `sequence`, `load` und `totals` werden konsequent berechnet und nicht im Plan abgelegt; `boxOf`
ist reine Ableitung. Gut. Die Ausnahme sind die Traversen-Maße `l/w/h` am Case: sie *sind* abgeleitet
(`trussDims`), werden aber persistiert und müssen deshalb an zwei Stellen nachnormalisiert werden
(`normalizeCase` beim Import, `normalizeOwnCases` beim Laden). `docs/architektur.md` beschreibt das
ausdrücklich — es bleibt trotzdem ein Duplikat, das auseinanderlaufen kann. **Zum Abwägen:** `l/w/h` für
`kind === 'truss'` gar nicht speichern und `outerDims` bei `isTruss(c)` direkt `trussDims(c.truss)`
liefern lassen. Dann kann kein veralteter Wert mehr existieren und `normalizeOwnCases` entfällt.

### [nit] `app.js:47` — `validatePlan` läuft komplett bei jeder Zustandsänderung

Das ist bei den heutigen Größenordnungen unkritisch und die Einfachheit ist es wert. Falls die
Placement-Zahl je dreistellig wird, ist der O(n²)-Kollisionsteil (`validate.js:63`) plus die drei
Supporter-Läufe (s. o.) die Stelle, die zuerst weh tut — ein Gitter (`Map` über 100-cm-Zellen in x)
reicht dafür völlig.

---

## Testqualität

Die Tests sind überwiegend verhaltensorientiert und lesen sich gut. Der Mutationslauf zeigt aber eine
Reihe von Regeln, deren Rückbau **unbemerkt grün bliebe**. Jede Zeile unten wurde tatsächlich ausgeführt
(238 grün = alles grün, `pwa.test.js` ausgenommen):

| Rückbau | Ergebnis |
|---|---|
| `validate.js`: Radkästen zählen nicht mehr als Auflage (`archSup` raus) | **238 grün** |
| `geometry.js`: `EPS = 0.5` → `0.05` | **238 grün** |
| `actions.js`: `touch()` setzt kein `updatedAt` mehr | **238 grün** |
| `packer.js`: 4-Lagen-Deckel `s.items.length < 4` → `< 99` | **238 grün** |
| `validate.js`: `loadSequence` innerhalb eines Stapels oben zuerst | **238 grün** |
| `validate.js`: `layerMap`-Rückfall `?? 1` → `?? 0` | **238 grün** |
| `validate.js`: `volumeRatio` immer 0 | **238 grün** |
| `actions.js`: `moveGroup` ohne Schwerkraft (`nz = 0`) | **238 grün** |
| `caseShape.js`: `inset` ohne Untergrenze / `d = wh` statt `wh*0.8` | **238 grün** |
| `truss.js`: `DOLLY_L = 60` → `40`; Rollen-`inset` ohne Begrenzung; `railW` ohne Begrenzung | **238 grün** |
| `packer.js`: Score mit 4-Lagen-Deckel (die *Verbesserung* von oben) | **238 grün** |

Zum Gegenbeweis: `notStackable`, `overload`, `tooHeavy`, `imbalance`, `SUPPORT_MIN`, `notTippable`,
Radkasten-Kollision, `layer`/`tooManyLayers`, Tür-Vorrang, `% 360` beim Swap, `stackAbove`-Brückenregel,
`snapToEdges`, `dollyLen`-Begrenzung, `trussDims`-Wagenbreite und die Label-Übernahme in `addUnplaced`
werden alle sauber gefangen. Die Abdeckung ist also nicht schlecht — sie hat Löcher an bestimmten Stellen.

### [important] `packer.test.js:„Stapel wird nie höher als 4 Lagen"` prüft nicht, was der Name sagt

```js
const c = mkCase('a', 120, 60, 60);              // 60 cm hoch
buildStacks(items(c, 5), mkTruck());             // Truck 270 cm
assert.deepEqual(stacks.map(s => s.items.length), [4, 1]);
```
Der fünfte Case scheitert nicht am 4-Lagen-Deckel, sondern an `canAddToStack`s Höhenprüfung:
4 × 60 = 240, +60 = 300 > 270. Entfernt man `s.items.length < 4` komplett, bleibt der Test grün
(nachgewiesen). Damit ist die Regel aus `architektur.md` („Mehr als vier Lagen sind nicht vorgesehen. Der
Packer hält sich daran“) im Packer ungetestet — geprüft ist sie nur in `validate.js`.

**Vorschlag:** flache Cases nehmen, bei denen die Truckhöhe nicht greift, z. B. 120 × 60 × 30, 5 Stück im
Standard-Truck: erwartet `[4, 1]` und nicht `[5]`. (Achtung: dieser Test kollidiert mit dem Score-Befund
oben — er sollte auf `buildStacks` mit einer fest vorgegebenen Orientierung zielen oder nach dem Fix an
`chooseOrientation` geschrieben werden.)

### [important] Kein einziger Test fasst die Toleranz `EPS = 0.5` an

`EPS` ist laut `architektur.md` „die Toleranz für alle Überlappungs- und Auflageprüfungen“ und steckt in
`overlaps`, `footprintOverlapArea`, `supportersOf`, `stackAbove` und `layerMap`. Die Tests arbeiten
ausschließlich mit exakt anschließenden Boxen (`0/60/120`), also im Grenzfall 0. `EPS` auf `0.05` zu
setzen ändert an den 239 Tests nichts — der Rückbau der gesamten Toleranz bliebe unbemerkt, und mit ihm
jeder Fehler, der den Grenzwert falsch herum anwendet.

**Vorschlag:** drei Tests mit Werten *um* die Toleranz herum, die die beiden Seiten festnageln:
```js
// 0,4 cm Spalt: gilt noch als Auflage; 0,6 cm: nicht mehr
assert.deepEqual(codes(validatePlan(plan([P('a','k',0,94,0), P('b','k',0,94,60.4)]),…), 'b'), []);
assert.deepEqual(codes(validatePlan(plan([P('a','k',0,94,0), P('b','k',0,94,60.6)]),…), 'b'), ['unsupported']);
// 0,4 cm Durchdringung: keine Kollision; 0,6 cm: Kollision
```

### [important] `actions.test.js` prüft `updatedAt` nirgends

`touch()` ist die einzige Stelle, an der ein Plan seinen Zeitstempel bekommt, und `io.mergeById`
entscheidet damit beim Zusammenführen, welcher Stand gewinnt. `touch = plan => plan` lässt alle Tests
grün — ein solcher Rückbau (oder eine neue Aktion, die `touch` vergisst) führt dazu, dass ein Import
stillschweigend die neuere Fassung überschreibt. Das ist Datenverlust ohne Warnung.

**Vorschlag:** ein Test, der über *alle* exportierten Aktionen aus `actions.js` läuft und prüft, dass ein
verändertes Ergebnis ein neueres `updatedAt` trägt als die Eingabe. So ist auch jede künftige Aktion
automatisch erfasst.

### [important] `loadSequence` ist für Stapel ungetestet

`validate.test.js:„Kennzahlen und Reihenfolge"` prüft zwei Cases nebeneinander (x 0 und 120, beide z 0).
Die eigentliche Zusage — im selben Stapel wird von unten nach oben geladen — steckt nur im dritten
Sortierkriterium und ist nicht geprüft: die Sortierung auf „z absteigend“ umzudrehen lässt alles grün.
Beim Beladen bedeutet das eine Ladereihenfolge, die man so nicht laufen kann.
**Vorschlag:** ein Dreierstapel an gleicher x/y-Position mit erwarteter Reihenfolge 1/2/3 von unten.

### [nit] `truss.test.js` ist stellenweise tautologisch — und weiß es zum Teil selbst

Der Kommentar vor „Höhen-Konstanten haben die freigegebenen Werte“ benennt das Problem vorbildlich. Es
gilt aber weiter für die übrigen Tests: `mkTrussCase` baut die Box mit `trussDims`, und die Erwartungen
werden aus `DOLLY_H`, `DOLLY_WHEEL_H` usw. abgeleitet. `DOLLY_L` von 60 auf 40, die Rollen-`inset`-Grenze
und die `railW`-Grenze lassen sich folglich ersatzlos streichen, ohne dass ein Test anschlägt — obwohl
zwei Tests („sehr kurzer Wagen“, „schmale Spur“) genau diese Grenzen zum Thema haben. Sie greifen nur
deshalb nicht, weil ihre Fälle die Grenze nicht scharf treffen.
**Vorschlag:** die Grenzfälle härten — `mkTrussCase(30, 29, 2)` (dollyLen 15 < 3 × Rollendurchmesser) und
eine Spur, in der `2 * chordInset < RAIL_W` gilt — und dort feste Zahlen prüfen, nicht Beziehungen.

### [nit] `caseShape.test.js` prüft die Rollen nur an einem großen Case und nur in zwei Lagen

`C = 120 × 60 × 80` in `standing` und `tipLong/rot 0`. `pairwiseNoOverlap` ist genau das richtige
Werkzeug — es läuft nur an den Fällen vorbei, in denen es etwas fände.
**Vorschlag:** eine Schleife über `ORIENTATIONS × [0,90,180,270]` für ein schmales Case (44 × 23 × 58,
`wheelH 12` — der echte `AF-1 -CAB`), die `pairwiseNoOverlap` *und* „alle Rollen innerhalb der Box“
prüft. Der Test ist heute rot (s. erster Befund) und wird mit dem Fix grün.

### [nit] `validate.test.js` — Radkasten als Auflage ist ungetestet

`validate.js:74-76` zählt Radkastenoberkanten ausdrücklich als Auflagefläche; der Radkasten-Test prüft
nur die Kollision. Streicht man `archSup`, bleibt alles grün — und jedes Case, das im Sprinter korrekt
auf dem Radkasten steht, bekäme plötzlich „steht nicht sicher“.
**Vorschlag:** ein Case bei `x 215, z 30` im `SPRINTER`, erwartet `[]`.

### [nit] `actions.test.js:„moveGroup nimmt den Stapel mit"` deckt den Schwerkraftanteil nicht ab

Weil Wurzel und Ziel beide auf z 0 liegen, ist `ddz` immer 0; `nz = 0` fest zu verdrahten lässt den Test
grün. **Vorschlag:** einen Stapel auf einen anderen Stapel schieben und `z` des Ergebnisses prüfen.

### [suggestion] Es fehlt ein Eigenschaftstest über die ganze Schicht

Die wertvollste Zusage der Schicht — „`autoPack` erzeugt nie einen Plan mit Placement-Fehlern, und die
Summe aus `placements` und `unplaced` ist die Eingabe“ — ist für zwei feste Fälle geprüft (10 Kabelcases,
40 im Sprinter). Ein Lauf über z. B. 50 zufällige Case-Mischungen (fester Seed, kein npm-Paket nötig) mit
den beiden Zusicherungen würde die meisten der oben gefundenen Lücken in einem Test erschlagen — und hätte
den Waisen-Befund und den Orientierungs-Befund vermutlich von selbst gezeigt.

---

# Teil 2 — Oberflächenschicht

# Code-Review: Oberflächenschicht Truckload V 0.6.0

Meilenstein-Review über `js/ui/**`, `css/app.css`, `index.html` und die zugehörigen Tests.
Stand: `main` @ 19b1710, `npm test` → 239/239 grün.

Belege wurden mit einem selbst gebauten CDP-Treiber in headless Chrome erzeugt
(`scratchpad/cdp.mjs` lag nicht vor und wurde neu geschrieben; Szenarien `s-label.mjs`,
`s-truss.mjs`, `s-color.mjs`, `s-3dlabel.mjs`, `s-print.mjs`, Screenshots unter
`scratchpad/out/`). Am Repository wurde nichts geändert.

**Zusammenfassung:** 4 × `[blocking]`, 8 × `[important]`, 11 × `[nit]`, 7 × `[suggestion]`.

---

## 1. Blocking

### B1 — Beschriftung landet am falschen Case `[blocking]`

`js/ui/inspector.js:31` (Eingabefeld) · `js/app.js:181–185` (`change`-Handler, `withSel`)

Der Inspector rendert das Beschriftungsfeld ohne jeden Bezug zu dem Stück, zu dem es gehört.
`app.js` liest beim `change`-Ereignis die **aktuelle** Auswahl:

```js
const withSel = fn => { const id = store.get().selectedId; if (id) fn(id); };
$('#inspector').addEventListener('change', e => {
  if (e.target.name === 'label') return withSel(id => edit((p, c) => A.setItemLabel(p, id, { label: e.target.value.trim() })));
```

`change` feuert erst beim Verlassen des Feldes. Klickt der Nutzer direkt von dem Feld auf ein
anderes Case in der Draufsicht, läuft in derselben Geste zuerst `pointerdown` → `select(neu)`
(der Store ist sofort umgestellt, das Neuzeichnen hängt an `requestAnimationFrame`), danach der
Fokusverlust → `change`. `withSel` liest dann bereits die **neue** Auswahl.

Szenario (belegt, `s-label.mjs`): zwei Stücke desselben Case-Typs im Truck, Stück 1 ausgewählt,
in das Beschriftungsfeld „XYZ“ getippt, danach Stück 2 in der Draufsicht angeklickt.

```
GETIPPT INS FELD: Kabelcase TruckmaßXYZ 120×60×60
ERGEBNIS { "selected": "case2", "case1label": null, "case2label": "Kabelcase TruckmaßXYZ 120×60×60" }
```

Stück 1 behält seine alte Beschriftung, Stück 2 bekommt die fremde — ohne jede Rückmeldung.
Dasselbe gilt für das Farbfeld daneben. Das ist stille Datenverfälschung in genau dem Feld, das
auf dem Ausdruck steht und mit dem der Nutzer im Truck arbeitet.

**Vorschlag:** Die Zugehörigkeit im Markup festschreiben, statt sie zur Ereigniszeit zu erraten.
In `inspector.js` `<section class="insp-sel" data-id="${esc(selected.id)}">` setzen und in
`app.js` `e.target.closest('[data-id]')?.dataset.id` verwenden statt `withSel`. Zusätzlich auf
`input` statt `change` umstellen wäre eine Alternative, löst das Problem aber nur zufällig.

### B2 — CSS-Einschleusung über die Farbe eines importierten Case `[blocking]`

`js/store/io.js:16–42` (`checkCase` prüft `color` **nicht**) · `js/ui/library.js:50,86` ·
`js/ui/load-wizard.js:99` · `js/ui/inspector.js:28` · `js/ui/view2d.js:117–120`

`checkPlan` prüft Stückfarben streng (`colorOk`, `/^#[0-9a-fA-F]{6}$/`, io.js:58/64/65).
`checkCase` prüft `c.color` gar nicht. Fünf Stellen bauen daraus per Zeichenkette ein
`style`-Attribut:

```js
<span class="swatch" style="background:${esc(c.color)}"></span>
```

`esc()` maskiert `"` und `'` und verhindert damit das Verlassen des Attributs — aber innerhalb
des `style`-Attributs braucht ein Angriff keine Anführungszeichen. `;`, `:`, `(` und `)` gehen
unverändert durch.

Szenario (belegt, `s-color.mjs` + `out/color-inject.png`): eine fremde Sicherungsdatei (das
Austauschformat ist ausdrücklich für fremde Dateien gedacht, `parseBundle` „prüft streng, weil
die Datei von außen kommt“) enthält ein Case mit

```json
"color": "red;position:fixed;inset:0;width:100vw;height:100vw;z-index:9999;background-image:url(http://…)"
```

`parseBundle` nimmt es an, der Wert wandert unverändert in IndexedDB, und die Bibliothek rendert:

```
computedPosition: "fixed"   computedWidth: "1600px"   computedZIndex: "9999"
rect: { x: 0, y: 0, width: 1600, height: 1600 }
```

Der Screenshot zeigt die komplette Oberfläche von einem ferngeladenen Bild überdeckt. Folgen:
Netzwerk-Rückruf an einen fremden Server bei jedem Öffnen der App (auch offline-installiert),
und eine bildschirmfüllende, frei gestaltbare Fläche über der echten Bedienoberfläche —
ausreichend für eine vorgetäuschte Eingabemaske. Der Angriffsweg ist realistisch: die Datei
kommt vom Kollegen, vom Verleiher, aus der WhatsApp-Gruppe.

**Vorschlag:** `colorOk` aus io.js:58 auch in `checkCase` anwenden (ein `#RRGGBB`-Case ist die
einzige Form, die der Editor je erzeugt: `<input type="color">`). Zusätzlich — weil Altdaten aus
IndexedDB nicht durch `parseBundle` gehen — in `js/ui/dom.js` einen Filter einziehen und alle
fünf Stellen darüber leiten:

```js
export const cssColor = v => (/^#[0-9a-fA-F]{3,8}$/.test(String(v ?? '')) ? v : '#888');
```

### B3 — Vorgabe-Rollenhöhe erzeugt Cases, die der eigene Import ablehnt `[blocking]`

`js/ui/case-editor.js:42` (`wheelHCustom min="1" max="40"`, kein Bezug zu `h`) ·
`js/model/geometry.js:4` (`NEW_CASE_WHEEL_H = 16`) · `js/store/io.js:20–21`

`checkCase` verlangt `c.wheelH < c.h`, solange das Maß die Rollen enthält
(`dimsInclWheels !== false`). Der Case-Editor kennt diese Kopplung nicht: die Rollenhöhe wird
unabhängig von der Höhe gewählt, Vorgabe für neue Cases ist 16 cm, Vorgabe für
„Maß ist inkl. Rollen“ ist gesetzt.

Szenario (belegt, `node`): flaches Pedal-/Deckelcase 40 × 30 × **12** cm, „mit Rollen“,
Rollenhöhe auf der Vorgabe 16 cm, „Maß ist inkl. Rollen“ — genau der Weg, den ein Nutzer ohne
Umschalten geht. Speichern gelingt, der Plan arbeitet damit. Beim späteren Einlesen der eigenen
Sicherung:

```
checkCase → REJECT: Case „Pedalcase flach“ hat ungültige Eigenschaften.
```

Und zwar bricht `parseBundle` **das gesamte Bündel** ab (io.js:86) — ein einziges flaches Case
macht die komplette Sicherung unlesbar. Jedes Case unter 16 cm Höhe ist betroffen; in dieser
Branche sind das Deckel-, Molton-, Klein­teilcases und Pult-Abdeckungen.

**Vorschlag:** Im Editor prüfen und anzeigen. `updateOuterDimsHint()` weiß bereits alles Nötige;
dort einen Hinweis setzen und im `submit`-Handler (case-editor.js:229) `e.preventDefault()`,
wenn `inclChecked && currentWheelH() >= Number(f.h.value)`. Das Muster steht daneben schon
vorbildlich für die Traversenbreite (`trussWidthHint`, s. Lob L8).

### B4 — Vorbelegte Beschriftung sprengt die 40-Zeichen-Grenze `[blocking]`

`js/ui/load-wizard.js:152,167` · `js/ui/inspector.js:31` · `js/ui/case-editor.js:21`
(`name maxlength="80"`) · `js/store/io.js:57` (`labelOk` ≤ 40)

`architektur.md` nennt das ausdrücklich als Falle: „`maxlength` in der Oberfläche und die Grenze
in `checkPlan` müssen zusammenpassen“. Die Zahlen passen (beide 40) — nur greift `maxlength`
nur bei Tastatureingabe, nicht bei einem vorbelegten Wert. Der Wizard belegt vor:

```js
{ label: `${c.name} ${i + 1}`, color: colorFor(c.category) }   // load-wizard.js:152
<input name="label" value="${esc(it.label)}" maxlength="40">   // load-wizard.js:167
```

Der Case-Name darf 80 Zeichen lang sein. Szenario (belegt, `node`): eigenes Case
„Sonderbau Rack 19 Zoll 12 HE Amping links“ (41 Zeichen) → Vorgabe-Beschriftung 43 Zeichen →
der Nutzer klickt nur „Fertig“, ohne das Feld anzufassen. Export gelingt (beim Export wird nicht
geprüft), Import:

```
parseBundle → REJECT: Ladeplan „L“ enthält ungültige Platzierungen.
```

Derselbe Weg über den Inspector: dort wird `value="${esc(selected.label)}"` vorbelegt, und
`selected.label` fällt laut `buildItems` auf den Case-Namen zurück — ein Zeichen löschen genügt,
um 41 Zeichen zu schreiben.

**Vorschlag:** An einer Stelle kürzen, nicht an vieren. Eine Konstante `MAX_LABEL = 40` aus
`js/store/io.js` exportieren, in `labelOk` verwenden, und `A.setItemLabel` / `A.addUnplaced` auf
`label.slice(0, MAX_LABEL)` festlegen — dann ist die Grenze unabhängig vom Eingabeweg dicht.
Zusätzlich einen Test in der Art von `tests/version.test.js`, der die `maxlength`-Attribute in
`js/ui/*.js` gegen `MAX_LABEL` hält (s. S6).

---

## 2. Important

### I1 — 3D-Beschriftung wird auf nicht-quadratischen Flächen verzerrt `[important]`

`js/ui/view3d.js:116–158` (`LABEL_REF`, `labelTextureFor`, `labelMesh`)

Die Textur ist immer 256 × 256 px und wird für eine **quadratische** Fläche von 40 × 40 cm
umbrochen (`LABEL_REF = 40`). `labelMesh` skaliert dieselbe Textur dann auf die tatsächliche
Fläche:

```js
mesh.scale.set(Math.max(pl.width, 0.001), Math.max(pl.height, 0.001), 1);
```

Auf der Längsseite eines 120 × 60-Case ist das eine Streckung 2 : 1. Der Kommentar
(view3d.js:112–115) beschreibt das als Absicht, die Folge ist aber sichtbar falsch: der Umbruch
wird für ein Quadrat gerechnet, also bricht „AMPRACK 1“ in zwei Zeilen um, und diese zwei Zeilen
werden anschließend über die doppelt so breite Fläche gezogen.

Beleg: `s-3dlabel.mjs`, `out/3d-label.png` — Prüf-Fahrzeug 150 × 90 × 90 mit einem einzigen
Case 120 × 60 × 60 (Vorgehen nach `CLAUDE.md`, „Fallstrick 3D“). Auf der Längsseite stehen
breitgezogene, flache Buchstaben „AMPRACK“ über die volle Kastenbreite, darunter eine winzige
„1“; der Text nutzt die Fläche schlecht und hat sichtbar eine andere Laufweite als auf der
Stirnseite. In 2D ist dasselbe Stück sauber gesetzt.

**Vorschlag:** Das Seitenverhältnis in den Cache-Schlüssel und in die Leinwand aufnehmen —
`key = JSON.stringify([text, color, ratioBucket])` mit z. B. auf 0,25 gerundetem
`pl.width / pl.height`, Leinwand `256 × Math.round(256 / ratio)`, und `fitFontSize` mit der
echten `pl.width`/`pl.height` aufrufen. Die Bucketbildung hält den Cache klein, und der
Aufräummechanismus über `usedLabelKeys` trägt das unverändert mit.

### I2 — Auf dem Ausdruck wird keine Beschriftung gekürzt `[important]`

`js/ui/view2d.js:223–235` (`fitLabelText`) · `js/ui/print.js:26–28` · `css/app.css`
(`.print-root { display: none; }`) · `css/print.css` (`media="print"`)

`fitLabelText` kürzt über `getComputedTextLength()`. `buildPrint` zeichnet in `#print-root`,
das zu diesem Zeitpunkt `display: none` ist — die Regel, die es sichtbar macht, steht in
`print.css` und gilt nur `media="print"`, also erst nach `window.print()`. Ein nicht
gerendertes SVG-Textelement liefert Länge 0, die Abbruchbedingung
`el.getComputedTextLength() <= maxWidth` ist sofort wahr, gekürzt wird nie.

Szenario (belegt, `s-print.mjs`), Beschriftung „Kabelcase Strom Bühne links komplett“ (36
Zeichen, also innerhalb der erlaubten 40) auf einem 120 × 60-Case:

```
onScreen: "Kabelcase S…"                            (gekürzt, passt in den Kasten)
inPrint : "Kabelcase Strom Bühne links komplett"    (voll)   printLen: 0
```

Auf dem Papier — dem Blatt, das im Truck mitgeht — läuft die Beschriftung über den Kasten
hinaus und über die Nachbarn. Betroffen sind beide Ansichten des Ausdrucks.

**Vorschlag:** Nicht auf die Messung verlassen. Die Zeichenzahl aus der Breite abschätzen
(`labelTexture.js` hat mit `CHAR_ASPECT` und `estimateTextWidth` genau diese Schätzung schon,
ohne DOM) und nur dann per `getComputedTextLength` nachjustieren, wenn die Messung > 0 liefert.
Damit werden 2D und 3D nebenbei auf dieselbe Textmetrik gezogen (s. S3).

### I3 — `TUBE_R_RATIO` steht zweimal `[important]`

`js/ui/view2d.js:69` vs. `js/model/truss.js:17`

```js
// view2d.js
const TUBE_R_RATIO = 0.085; // Gurtrohr-Radius = Traversenbreite × Faktor (siehe js/model/truss.js)
```

`view3d.js:4` importiert die Konstante korrekt aus dem Modell, `view2d.js` hält eine Kopie mit
einem Kommentar, der auf das Original verweist. `trussShape()` rechnet mit demselben Wert die
Lage der Auflageleisten aus (`chordInset`, truss.js:129). Wer den Wert im Modell anpasst — etwa
für ein neues Profil —, bekommt Leisten und 3D-Rohre an der neuen Stelle und 2D-Rohre an der
alten; nichts schlägt fehl, die Ansichten zeigen nur verschiedene Wagen.

**Vorschlag:** In `view2d.js` `TUBE_R_RATIO` aus `../model/truss.js` importieren (der Import
der Datei besteht bereits, Zeile 7) und die lokale Konstante löschen.

### I4 — `DETAIL_MIN` steht zweimal `[important]`

`js/ui/view2d.js:11` und `js/ui/view3d.js:8`, beide `= 40`

Die Schwelle entscheidet, ob ein Case als Flightcase mit Profilen, Kugelecken, Deckelfuge und
Griffen oder als einfacher Kasten erscheint. Beide Ansichten rechnen sie inzwischen richtig aus
den echten 3D-Korpusmaßen (view2d.js:277, view3d.js:465) — genau deshalb fällt eine Abweichung
der Konstanten sofort als 2D/3D-Unterschied auf: ein Case knapp an der Schwelle wäre in einer
Ansicht detailliert und in der anderen nicht.

**Vorschlag:** Nach `js/ui/caseStyle.js` verschieben (dort steht schon `CASE_BLACK` als
gemeinsame Quelle für beide Ansichten) und in beiden Ansichten importieren.

### I5 — In 3D fehlt die Nummer des Stücks `[important]`

`js/ui/view2d.js:246–250` (`label-seq`) vs. `js/ui/view3d.js` (kein `seq`)

2D schreibt in jede Case-Ecke die laufende Nummer aus `result.sequence`. Ausdruck
(`print.js:21`, Spalte „Nr.“) und Inspector (`inspector.js:28`, „3. Amp links“) sprechen den
Nutzer ausschließlich über diese Nummer an. In der 3D-Ansicht kommt sie nirgends vor — auf dem
Screenshot `out/3d-label.png` trägt der Kasten nur den Text der Beschriftung. Wer den Ausdruck
in der Hand hat und in 3D nachschaut, welches Case Nr. 14 ist, findet es nicht.

**Vorschlag:** Die Nummer in 3D mit ausgeben. Am wenigsten Aufwand: sie in den Texturtext
aufnehmen (`labelTextureFor(`${it.seq}. ${it.label}`, …)`). Sauberer: eine zweite, kleine
Ebene auf der Deckelfläche, analog zur `label-seq`-Ecke in 2D.

### I6 — Kein Abbau der 3D-Ansicht; der Fehlerpfad verliert WebGL-Kontexte `[important]`

`js/ui/view3d.js:11–41` (kein `dispose`, `ResizeObserver` ohne `disconnect`) ·
`js/app.js:243–255` (`catch { view3d = null; view3dLoading = null; }`)

`createView3d` gibt nur `{ update }` zurück. Renderer, `ResizeObserver`, `OrbitControls` und die
geteilten Geometrien/Materialien (view3d.js:44–76) bleiben am Container hängen. Solange die
Ansicht einmal entsteht, ist das folgenlos. Der Fehlerpfad in `app.js` setzt aber sowohl
`view3d` als auch `view3dLoading` zurück, ohne aufzuräumen:

```js
} catch {
  $('#view3d').textContent = '3D-Ansicht konnte nicht geladen werden (vendor/ fehlt?).';
  view3d = null; view3dLoading = null;
}
```

Der `try`-Block umfasst auch `view3d.update(...)`. Wirft also **eine** Aktualisierung — etwa
weil ein Traversenwagen-Case aus einer fremden Datei `c.truss` nicht hat und `addTruss` auf
`c.truss.width` (view3d.js:406) stolpert —, wird beim nächsten Rendern ein **zweiter** kompletter
Renderer samt GL-Kontext erzeugt; `container.replaceChildren()` (view3d.js:15) entfernt nur die
alte Leinwand, gibt den Kontext aber nicht frei. Chrome hält rund 16 Kontexte, danach verliert
er stillschweigend die ältesten. Das Ergebnis ist eine 3D-Ansicht, die nach einigen
Fehlversuchen dauerhaft schwarz bleibt.

**Vorschlag:** `createView3d` ein `dispose()` mitgeben (`observer.disconnect()`,
`controls.dispose()`, `clear()`, alle `shared`-Ressourcen + `labelTexCache`/`bodyMatCache`/
`bandMatCache` disposen, `renderer.dispose()`, `renderer.forceContextLoss()`), und in `app.js`
im `catch` `view3d?.dispose()` aufrufen, bevor neu gebaut wird.

### I7 — Ausgeblendetes Pflichtfeld blockiert „Speichern“ ohne Rückmeldung `[important]`

`js/ui/case-editor.js:59` (`trussWidthCustom … required`) · `:153,216`
(`trussWidthCustomLabel.hidden = …`) · `:184` (`applyKind` aktiviert alle Traversen-Felder)

Bei `kind === 'truss'` sind alle Felder der Traversen-Gruppe aktiv — auch das Feld „eigene
Breite“, das ausgeblendet wird, sobald ein Standardprofil gewählt ist. `required` bleibt.
Ausgeblendet heißt nicht `disabled`, die Formularprüfung greift also weiter, kann den Fehler aber
nicht anzeigen.

Szenario (belegt, `s-truss.mjs`): neues Case → „Traversenwagen“ → Breite „eigene …“ → Feld
leeren → zurück auf „34er (F34)“ → „Speichern“.

```json
{ "customLabelHidden": true, "customRequired": true, "customDisabled": false,
  "customValue": "", "formValid": false, "invalid": ["trussWidthCustom"],
  "dialogStillOpen": true, "result": "KEINE-REAKTION" }
LOGS: error: An invalid form control with name='trussWidthCustom' is not focusable.
```

Der Knopf reagiert nicht, der Dialog bleibt offen, es erscheint keine Meldung, und die einzige
Spur steht in der Browser-Konsole. Für den Nutzer ist die App kaputt.

**Vorschlag:** Die Sichtbarkeit und die Prüfpflicht zusammen schalten. In beiden Stellen, die
`trussWidthCustomLabel.hidden` setzen, zusätzlich
`f.trussWidthCustom.disabled = f.trussWidthCustom.required = !custom` — dasselbe Muster, das
`updateWheelsUi()` (Zeile 123–129) für die Rollenhöhe schon richtig anwendet.

### I8 — Tote Erreichbarkeitsprüfung bei der Rollenrichtung `[important]`

`js/ui/inspector.js:20–21` · `js/model/geometry.js:52–61` · `docs/architektur.md:68`

Der Inspector deaktiviert Richtungsknöpfe, die für die aktuelle Lage nicht erreichbar sind:

```js
const reachable = rotForWheelFace(selected.p.orientation, face) != null;
```

`rotForWheelFace` liefert `null` nur für `standing` und für unbekannte Seiten. Für `tipLong` und
`tipShort` gibt es für alle vier Richtungen eine Rotation:

```
tipLong  +x=270 +y=0  -x=90  -y=180
tipShort +x=0   +y=90 -x=180 -y=270
```

Und der Knopfblock wird überhaupt nur gerendert, wenn `selected.p.orientation !== 'standing'`
(Zeile 13). Der `disabled`-Zweig ist damit unerreichbar. `docs/architektur.md:68–69` behauptet
dagegen: „Physikalisch sind je Ausrichtung nur zwei der vier Richtungen ohne Wechsel der
Grundfläche erreichbar; das wird nicht kaschiert.“ Eines von beidem stimmt nicht — entweder
fehlt die Einschränkung im Modell (dann kann der Nutzer ein Case in eine Lage bringen, die es in
Wirklichkeit nicht gibt), oder die Dokumentation und die UI-Prüfung sind Überbleibsel.

Dasselbe betrifft die Tastatur: `ACTIONS.wheelFace` (app.js:169–174) schaltet blind durch
`WHEEL_FACES` und fragt `reachable` gar nicht ab — konsistent nur, solange alles erreichbar ist.

**Vorschlag:** Entscheiden und an einer Stelle festhalten. Wenn die Einschränkung gilt, gehört
sie in `rotForWheelFace` mit einem Test in `tests/geometry.test.js`; wenn nicht, gehören die
Zeilen 20–21 in `inspector.js` und der Absatz in `architektur.md` weg.

---

## 3. Nits

### N1 — Schriftfarbe der Beschriftung: 2D fest, 3D abgeleitet `[nit]`
`css/app.css` (`svg .case .label { fill: #fff; … stroke: #000; }`) vs. `js/ui/view3d.js:105–111`
(`textColorFor`). In 3D kippt die Schrift bei hellem Hintergrund auf Dunkel, in 2D bleibt sie
immer weiß mit schwarzer Kontur. Im Modus „Gewerk“ auf einem gelben Case (`#f0a500`) sieht das
in beiden Ansichten unterschiedlich aus. Die Kontur rettet die Lesbarkeit, der Unterschied
bleibt. Vorschlag: `textColorFor` nach `caseStyle.js` heben und in 2D als `style`-Attribut
setzen.

### N2 — Laminat-Struktur nur in einem Modus `[nit]`
`js/ui/view2d.js:183` zeichnet das Laminat-Muster nur bei `colorMode === 'black'`;
`js/ui/view3d.js:169` hängt `bumpMap: LAM_TEX` an **jedes** Korpusmaterial. Im Modus „Gewerk“
haben die Cases in 3D also Struktur, in 2D nicht.

### N3 — Griffe auf der Längsseite gibt es nur in 2D `[nit]`
`js/ui/view2d.js:217–218` zeichnet in der Seitenansicht zwei Griffe auf der Längsseite, sobald
`bw >= 100`. `js/ui/view3d.js:272–285` (`handleMeshes`) setzt Griffe ausschließlich auf die
beiden Stirnseiten (`x0`/`x1`), längenunabhängig. Ein 120-cm-Case zeigt in 2D Längsgriffe, in
3D nie.

### N4 — `drawTruss` bekommt `colorMode` und benutzt es nicht `[nit]`
`js/ui/view2d.js:103,270`. Der Parameter ist tot. Beide Ansichten umgehen für Traversenwagen
`caseColors()` und rechnen die Markenfarbe selbst (`it.color ?? c.color`, view2d.js:106,
view3d.js:377) — die Folge ist, dass der Umschalter „Schwarz / Gewerk“ an Traversenwagen
wirkungslos ist, während er an Cases alles verändert. Immerhin sind 2D und 3D hier untereinander
gleich. Vorschlag: `caseColors(c, colorMode, it.color)` auch hier verwenden und den Streifen aus
`colors.stripe ?? colors.body` speisen.

### N5 — `it.color ?? c.color` ist überflüssig und steht zweimal `[nit]`
`js/ui/view2d.js:106`, `js/ui/view3d.js:377`. `buildItems()` legt `it.color` bereits als
`p.color ?? c.color` frei (`validate.js:23`); der zweite Rückfall kann nie greifen. Zwei Kopien
einer Regel, die das Modell schon kennt — genau die Art Stelle, an der 2D und 3D später
auseinanderlaufen.

### N6 — 2D rechnet für Traversenwagen Rollen aus, die es dann nicht zeichnet `[nit]`
`js/ui/view2d.js:257–266`: `wheelFace`, `caseShape` und die Rollenausgabe laufen **vor** dem
`isTruss`-Zweig. Heute folgenlos, weil `normalizeCase()` bei Traversenwagen `wheelH: 0` erzwingt
und `caseShape` dann `wheels: []` liefert. `view3d.js:454` steigt für Traversenwagen dagegen
sofort aus (`continue`). Käme je ein Traversen-Case mit `wheelH > 0` durch, zeigte 2D vier
Phantomrollen und 3D nicht. Vorschlag: den `isTruss`-Zweig in `drawCase` nach vorne ziehen.

### N7 — Firmenfilter im Wizard veraltet nach „+ Neues Case“ `[nit]`
`js/ui/load-wizard.js:42` baut die Firmenliste einmal beim Öffnen; `addNewCase` (Zeile 136–142)
verändert `cases`, aktualisiert aber nur die Liste. `js/ui/library.js:60–65`
(`renderCompanyOptions`) macht es richtig und merkt sich sogar die Auswahl. Zwei Verbraucher
derselben `companiesOf()`-Hilfsfunktion, zwei Verhaltensweisen.

### N8 — Leere Liste ohne Erklärung im Wizard `[nit]`
`js/ui/load-wizard.js:114` zeigt bei null eigenen Cases „Keine Treffer.“, obwohl gar nicht
gefiltert wurde. `js/ui/library.js:73` sagt an derselben Stelle das Richtige: „Noch keine
eigenen Cases – „+ Neues Case“ oder eine Vorlage kopieren.“ Für einen neuen Nutzer ist der
Wizard genau der erste Ort, an dem er hinschaut.

### N9 — „+ Neues Case“ umgeht die 500er-Grenze `[nit]`
`js/ui/load-wizard.js:140`: `counts.set(c.id, (counts.get(c.id) ?? 0) + 1)` ohne die
`total() < MAX_ITEMS`-Prüfung, die `inc` (Zeile 125) hat. Danach blockiert `validateStep`
„Weiter“ mit „Maximal 500 Stück je Wizard-Durchlauf“ — behebbar, aber unnötig.

### N10 — 3D-Hintergrund friert beim Erzeugen ein `[nit]`
`js/ui/view3d.js:20` liest `--bg` einmal aus `getComputedStyle(document.body)`. `css/app.css`
hat einen `prefers-color-scheme: light`-Zweig; wechselt das System die Darstellung, ziehen
Oberfläche und 2D mit, der 3D-Hintergrund bleibt dunkel.

### N11 — Kleinigkeiten in `index.html` `[nit]`
- `<div class="group seg" title="Case-Farbe">` trägt einen Tooltip neben einer sichtbaren
  Beschriftung `<span class="seg-label">Case-Farbe</span>` — doppelt.
- `<label class="btn" title="…">Importieren<input id="import" type="file" hidden></label>`:
  ein `label` ist kein fokussierbares Bedienelement; „Importieren“ ist per Tastatur nicht
  erreichbar, während alle Nachbarn `<button>` sind. Vorschlag: `tabindex="0"` plus
  Tasten-Handler, oder einen echten `<button>`, der `input.click()` auslöst.

---

## 4. Suggestions

### S1 — Eine `swatch()`-Hilfsfunktion statt vier Kopien `[suggestion]`
`js/ui/library.js:50,86`, `js/ui/load-wizard.js:99`, `js/ui/inspector.js:28` bauen viermal
dasselbe `<span class="swatch" style="background:…">`. Eine Funktion in `dom.js` wäre der
natürliche Ort für die Farbprüfung aus B2 — dann ist die Lücke an **einer** Stelle zu.

### S2 — Die dreiteilige Case-Liste gemeinsam rendern `[suggestion]`
`js/ui/library.js:72–75` und `js/ui/load-wizard.js:113–116` haben denselben Aufbau (drei
Überschriften mit Zählern, drei Leertexte) und unterscheiden sich nur in der Zeilen-Funktion und
in den Leertexten (siehe N8). `caseGroups.js` teilt bereits die Filterlogik; eine
`renderGroups(target, groups, rowFn, emptyTexts)` daneben würde die Darstellung mitziehen.

### S3 — Eine Textmetrik für 2D und 3D `[suggestion]`
`js/ui/labelTexture.js` (`fitFontSize`, `wrapText`, `estimateTextWidth`, umbricht) und
`js/ui/view2d.js:14–17,223–250` (`LABEL_MIN/MAX/RATIO`, kürzt mit „…“) lösen dieselbe Aufgabe
mit verschiedenen Verfahren und verschiedenen Ergebnissen — derselbe Text steht auf demselben
Case in 2D gekürzt und in 3D umgebrochen. `labelTexture.js` ist DOM-frei und getestet; 2D könnte
es mitbenutzen. Das löst nebenbei I2.

### S4 — Farb-Materialcaches begrenzen `[suggestion]`
`js/ui/view3d.js:162–180`: `bodyMatCache` und `bandMatCache` wachsen pro verwendeter Farbe und
werden nie freigegeben — `shared(…)` schützt sie ausdrücklich vor `clear()`. Der Beschriftungs-
Cache direkt darüber macht es vorbildlich richtig (`usedLabelKeys`, Zeile 516–524). Dasselbe
Muster hier anwenden: die in diesem `update()` benutzten Schlüssel sammeln, den Rest am Ende
disposen. Jedes Material ist außerdem ein eigenes Shader-Programm, nicht nur ein paar Bytes.

### S5 — Inspector und Ablage nicht bei jedem Bild neu bauen `[suggestion]`
`js/ui/inspector.js:52` und `js/ui/library.js:82` setzen bei **jedem** Rendern `innerHTML`.
Beim Ziehen eines Case in der Draufsicht läuft `onDrag → edit → store.update → scheduleRender`
pro Bild; dabei werden das komplette Inspector-Formular (inklusive des Feldes aus B1) und die
Ablageliste 60-mal je Sekunde neu erzeugt. `library.update` macht es für die Case-Liste schon
richtig (`casesChanged`); für die Ablage und den Inspector fehlt die entsprechende Bedingung.

### S6 — Die Grenzen prüfbar machen `[suggestion]`
Das Projekt erzwingt Querbezüge bereits per Test (`tests/version.test.js` über fünf Dateien,
`tests/pwa.test.js` über die Asset-Liste). Für die Grenzen der Oberfläche gibt es das nicht,
obwohl `architektur.md` sie ausdrücklich als Falle nennt — B3 und B4 wären damit nicht
entstanden. Vorschlag: `tests/ui-limits.test.js`, das `js/ui/*.js` als Text liest und prüft, dass
jedes `maxlength` für `name="label"` gleich `MAX_LABEL` aus `io.js` ist, und dass jedes
`required`-Feld in `case-editor.js`, das per `hidden` verschwinden kann, dabei auch `disabled`
gesetzt bekommt.

### S7 — Latent: derselbe `<dialog>` zweimal offen `[suggestion]`
`js/ui/case-editor.js:256` hängt den `close`-Listener an `dlg` selbst — dieser überlebt das
`dlg.innerHTML = …` des nächsten Aufrufs. Heute unerreichbar, weil `#dlg-case` nur aus zwei
`await`-Pfaden bedient wird und der Dialog modal ist. Käme je ein zweiter Aufruf vor einem
`close` dazu, löste der alte Listener beim Schließen des neuen Dialogs aus und läse über das
festgehaltene `f` die Werte des abgehängten Formulars. Ein `dlg.returnValue = 'cancel';
dlg.close()` zu Beginn von `openCaseEditor` wäre eine billige Absicherung.

---

## 5. Was gut gelöst ist

- **L1 — Der Beschriftungs-Cache in 3D räumt auf.** `usedLabelKeys` + die Schleife in
  `view3d.js:516–524` lösen das Problem „geteilte Ressource, die `clear()` nie anfasst“
  vollständig und mit einem Kommentar, der den Grund nennt. Das ist das Muster, dem S4 folgen
  sollte.
- **L2 — `composeMatrix()` statt eines geteilten `dummy`-Object3D.** `instanceMatrix.js` ist
  DOM- und Three-frei, getestet, und der Kommentar (Zeile 1–7) beschreibt exakt den Fehler, den
  die Lösung verhindert — eine durchgesickerte Zylinderrotation. Vorbildliche Verschriftlichung
  einer Fehlerursache.
- **L3 — Die `userData.shared`-Disziplin.** `clear()` (view3d.js:425–433) ist knapp, korrekt,
  und alle fünf Geometrien werden in einer Schleife markiert (Zeile 49), sodass keine vergessen
  werden kann.
- **L4 — Der SVG-Pfad ist bauartbedingt sicher.** `svgEl()` setzt ausschließlich über
  `setAttribute`, und der Case-Tooltip geht über `textContent` (`view2d.js:284`). Dadurch ist der
  SVG-Zweig von B2 nicht betroffen — der einzige Angriffsweg ist die per Zeichenkette gebaute
  HTML-Seite.
- **L5 — Alle drei Anzeigestellen benutzen `outerDims()`.** Bibliothek (`library.js:46`),
  Wizard (`load-wizard.js:12`), Inspector (`inspector.js:25`). Das ist die Regel aus
  `architektur.md:85`, und sie wird ausnahmslos eingehalten.
- **L6 — `caseColors(c, mode, itemColor)` mit drittem Parameter in beiden Ansichten.**
  `view2d.js:274` und `view3d.js:452`. Der Fehler aus V 0.4.0 ist weg und bleibt weg, weil
  `caseStyle.js` einen eigenen Test hat.
- **L7 — `svgUid()` pro `<svg>`-Element.** `view2d.js:21–25` bindet die Verlaufs-IDs an das
  Element, damit App-Ansicht und Druckansicht gleichzeitig existieren können — ein Detail, an dem
  viele SVG-Codebasen scheitern.
- **L8 — Die Traversenbreite wird in der Oberfläche **und** in `checkCase` auf 40 cm begrenzt,
  mit einem sichtbaren Hinweis (`trussWidthHint`) und einem `preventDefault` im `submit`.
  Genau das ist der Gegenentwurf zu B3; das Muster steht also schon in derselben Datei bereit.
- **L9 — Ereignisdelegation durchgängig.** Bibliothek, Inspector und Wizard hängen ihre Handler
  an stabile Container, nicht an die neu erzeugten Zeilen; die Dialog-`close`-Listener sind
  `{ once: true }`. Es sammeln sich keine Listener an.
- **L10 — Rechenbare Geometrie ist aus der UI herausgelöst.** `caseGroups.js`,
  `labelTexture.js`, `instanceMatrix.js`, `projection.js`, `caseStyle.js` liegen unter `js/ui/`,
  haben aber keine DOM- oder Three-Abhängigkeit und eigene Tests. Das ist der Grund, warum diese
  Schicht trotz fehlender DOM-Tests überhaupt prüfbar ist.
- **L11 — Der Detailgrad wird in 2D aus den echten 3D-Korpusmaßen bestimmt** (`view2d.js:276–277`
  mit Begründung im Kommentar), nicht aus der projizierten Fläche — deshalb sieht dasselbe Case
  in Draufsicht, Seiten- und Rückansicht gleich aus.

---

# Teil 3 — Daten und Verdrahtung

# Review: Speicher-, Daten- und Verdrahtungsschicht (Truckload V 0.6.0)

Stand: `main` @ 19b1710, `npm test` = 239/239 grün. Geprüft: `js/app.js`, `js/state.js`,
`js/store/*`, `js/data/*`, `sw.js`, `manifest.webmanifest`, `js/version.js` und die
zugehörigen Tests. Alle Korrektheitsbefunde sind mit `node -e` gegen den echten Code
belegt, nicht abgeleitet.

Anmerkung zur Arbeitsweise: `CLAUDE.md` nennt einen CDP-Treiber `cdp.mjs` im Scratchpad
der Sitzung — der lag hier nicht vor. Die Befunde unten brauchen ihn nicht, sie sind alle
in reinem Node reproduzierbar; der Hinweis steht nur, damit die Anleitung nachgezogen
werden kann (nit 18).

---

## Was gut gelöst ist

Bevor die Befunde kommen — mehreres in dieser Schicht ist überdurchschnittlich sorgfältig:

- **Die Schichtgrenze hält wirklich.** `grep -rn "from '.*store/\|from '.*state.js'" js/`
  liefert außerhalb von `js/app.js` **null** Treffer. Die Zusage aus
  `docs/architektur.md` („`js/app.js` ist bewusst der einzige Ort mit Store-Wissen“) ist
  nicht nur Prosa. Auch `indexedDB` kommt ausschließlich in `js/store/db.js` vor.
- **`mergeOwnWithBuiltins` (`js/store/repo.js:15`)** ist korrekt, und der Kommentar
  darüber erklärt den eigentlichen Grund (Verbraucher bauen eine `Map`, letzter gewinnt) —
  genau die Art Begründung, die eine spätere „Vereinfachung“ verhindert. `tests/repo.test.js`
  prüft die ID-Kollision gegen Preset *und* Bibliothek und zusätzlich, dass jede ID genau
  einmal vorkommt.
- **`normalizeOwnCases`** löst die Migration alter Traversenwagen an genau einer Stelle
  und teilt sich `normalizeCase()` mit dem Import — keine zweite Wahrheit. Der Test dazu
  beschreibt das Fehlerbild („Lücke in Seiten-/Rückansicht“), nicht nur die Assertion.
- **Kopie statt Überschreiben bei Vorlagen**: `js/ui/case-editor.js:14`
  (`isNew = !c || c.builtin`) vergibt beim Bearbeiten eines mitgelieferten Cases eine neue
  UUID und setzt `builtin: false`; der Löschen-Knopf ist für Vorlagen ausgeblendet. Dadurch
  kann eine Bearbeitung nicht aus dem Export herausfallen (`exportBundle` filtert
  `!c.builtin`) — ein Fehler, der hier naheliegend gewesen wäre und nicht drin ist.
- **Undo-Schwelle beim Ziehen**: `js/ui/view2d.js:353-356` ruft `onDragStart()` erst nach
  4 px Bewegung. Ein reiner Klick füllt die Historie also nicht mit identischen Zuständen —
  der klassische Fehler an dieser Stelle.
- **`tests/pwa.test.js` leitet die Soll-Liste aus dem Dateisystem ab** (`filesIn('js')`,
  `filesIn('vendor')`), statt sie zu wiederholen. Damit ist die Offline-Liste für `js/` und
  `vendor/` strukturell vollständig, nicht nur zufällig — geprüft: alle 33 Einträge
  existieren, kein `js/`- oder `vendor/`-File fehlt.
- **Die 137 Bibliotheks-Cases sind in sich stimmig** (eigene Nachrechnung, s. Befund 8):
  keine doppelte ID über Presets + Bibliothek hinweg, jedes `category` in `CATEGORIES`,
  jeder Eintrag besteht `checkCase`, kein Eintrag überschreitet den Megatrailer
  (1360×248×300). Das ist mit `tests/caseLibrary.test.js` auch abgesichert.
- **`switchPlan` (`js/app.js:253-257`) sichert den bisherigen Plan ausdrücklich vor dem
  Wechsel**, und `plan-del` (`js/app.js:277`) löscht den Timer mit einem Kommentar, der
  sagt warum. Beide Stellen zeigen, dass die Autosave-Falle bekannt war — es fehlt nur der
  dritte Fall (Befund 3).
- **`store.update` nimmt durchweg Funktions-Updater** (`st => …`), nicht `store.get()`-
  Schnappschüsse — bis auf den Import (Befund 5) ist das konsequent durchgezogen.

---

## [blocking]

### 1. Eine präparierte Datei macht die App dauerhaft unstartbar — mit allen Daten darin

`js/store/io.js:59-68` (`checkPlan`) prüft `id`, `name`, `truckId`, `placements`,
`unplaced`, `label` und `color` — aber **nicht `updatedAt`**. `js/app.js:30` verlässt sich
beim Start darauf, dass das ein String ist:

```js
const latest = [...data.plans].sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''))[0];
```

Szenario, vollständig durchgerechnet:

1. Der Nutzer importiert ein Bundle mit
   `plans: [{ id: "0-evil", name: "Tour", truckId: "preset-sattel", placements: [], unplaced: [], updatedAt: 5 }]`.
   `parseBundle` **akzeptiert** das (verifiziert).
2. `js/app.js:353` schreibt den Plan mit `repo.savePlan` nach IndexedDB. `5` ist
   structured-cloneable, landet also unverändert im Store.
3. Beim nächsten Start liefert `db.getAll('plans')` die Pläne in Schlüsselreihenfolge, also
   nach `id` sortiert — `"0-evil"` steht vorn. Die Sortierung in Zeile 30 ruft dann
   `(5).localeCompare(...)` auf:

```
CRASH  evil zuerst, 2 gute -> (b.updatedAt ?? "").localeCompare is not a function
```

4. `js/app.js` ist ein Top-Level-`await`-Modul; der Fehler fliegt aus der Modulauswertung.
   `index.html` hat weder `window.onerror` noch ein `<noscript>`-Ersatz — der Nutzer sieht
   eine tote Seite. **Es gibt keine Oberfläche mehr, mit der er den Plan löschen könnte.**
   Alle Ladepläne, eigenen Cases und Fahrzeuge sind nur noch über die DevTools erreichbar.

Die ID steuert der Absender der Datei, der Absturz ist also erzwingbar, nicht zufällig.
Ohne Absturz (wenn die ID hinten einsortiert) gewinnt der fremde Plan trotzdem immer die
„zuletzt bearbeitet“-Auswahl, weil eine Nicht-Zeichenkette in der Sortierung nach oben
rutscht.

**Vorschlag:** zwei Stellen, beide klein.
- In `checkPlan`: `if (p.updatedAt !== undefined && typeof p.updatedAt !== 'string') throw …`.
  Dasselbe für `checkCase`/`checkTruck`, denn `mergeById` liest `updatedAt` auch dort.
- In `js/app.js:30` defensiv werden: `const ts = x => (typeof x?.updatedAt === 'string' ? x.updatedAt : '')`
  und danach `ts(b).localeCompare(ts(a))`. Ein Datenfehler darf den Start nicht kosten.
- Zusätzlich `js/app.js:29` in `try/catch` fassen und bei einem Fehler wenigstens eine
  Meldung plus Export-Möglichkeit anbieten, statt weiß zu bleiben.

### 2. Der Autosave meldet Erfolg, bevor er einen hat — ein Schreibfehler verliert alles Folgende

`js/app.js:82`:

```js
saveTimer = setTimeout(() => { lastSaved = s.plan; repo.savePlan(s.plan); }, 400);
```

`lastSaved` wird **vor** dem Schreiben gesetzt, `repo.savePlan` liefert ein Promise, das
niemand `await`et und dessen `catch` fehlt. `js/store/db.js:18-25` lehnt bei `tx.onerror`
ab — also bei Quota-Überschreitung, bei einem abgebrochenen Transaktionslauf, bei
Safari-Storage-Eviction, im privaten Fenster.

Szenario: Der Nutzer packt einen großen Plan, das Quota ist erschöpft. Der erste
`savePlan` schlägt fehl (unhandled rejection, nur in der Konsole sichtbar — die sieht
niemand). `lastSaved` zeigt aber schon auf den neuen Plan. Der Nutzer arbeitet eine Stunde
weiter; jeder weitere Speicherversuch scheitert genauso und meldet nichts. Beim nächsten
Öffnen steht der Stand von vor einer Stunde da. Die App hat zu keinem Zeitpunkt
signalisiert, dass etwas nicht gesichert ist. Für eine App, deren Daten nirgendwo sonst
liegen, ist das der teuerste mögliche Fehlerpfad.

**Vorschlag:** `lastSaved` erst im `then` setzen, den `catch` behandeln und den Fehler
sichtbar machen (ein dauerhaftes Banner „Nicht gespeichert — bitte per ‚Sichern‘
exportieren“, kein `alert`, das den Nutzer nur wegklickt). Gleichzeitig eine
`saving`-Anzeige/`Zuletzt gesichert hh:mm` in die Toolbar — der Nutzer hat heute keinerlei
Rückmeldung darüber, ob sein Stand in der Datenbank ist.

### 3. Fenster schließen innerhalb von 400 ms verwirft die letzte Änderung

`js/app.js:77-83` ist ein reiner Debounce ohne Flush. Es gibt im ganzen Projekt kein
`beforeunload`, `pagehide` oder `visibilitychange` (geprüft: `grep` über `js/` und
`index.html` — null Treffer).

Szenario: Der Nutzer benennt den Plan um (`js/app.js:268`, `edit(...)` → Timer auf 400 ms)
und schließt sofort den Tab, oder wechselt auf dem Tablet die App weg und das System
verwirft die Seite. Der neue Name ist weg. Dasselbe für die letzte Case-Verschiebung nach
einem Drag, für das letzte `packRest`, für die zuletzt gesetzte Beschriftung. Während eines
Drags wird der Timer bei **jeder** Mausbewegung neu gesetzt (`onDrag` → `edit` → subscribe →
`clearTimeout`), der Stand ist also während der gesamten Ziehbewegung ungesichert.

Dass die anderen zwei Fälle (`switchPlan`, `plan-del`) ausdrücklich behandelt sind, zeigt,
dass die Falle bekannt war — nur der häufigste Fall fehlt.

**Vorschlag:** die Flush-Logik aus `switchPlan` in eine Funktion `flushSave()` ziehen und
zusätzlich an `visibilitychange` (`document.visibilityState === 'hidden'`) und `pagehide`
hängen. `visibilitychange` ist der verlässliche Haken, `beforeunload` wird auf Mobilgeräten
oft nicht gefeuert. `switchPlan` und `plan-del` rufen dann dieselbe Funktion.

---

## [important]

### 4. `mergeById`: ein Objekt als `updatedAt` gewinnt gegen jeden lokalen Stand

`js/store/io.js:94`: `if (!cur || (x.updatedAt ?? '') >= (cur.updatedAt ?? ''))`. Der
Vergleich ist ein String-Vergleich ohne Typprüfung. `{}` wird zu `'[object Object]'`, und
`'[' (0x5b) > '2' (0x32)` — der Datei-Stand gewinnt also **immer**:

```
Gewinner: [ 'aus der Datei' ]     // lokal: updatedAt 2026-09-21T12:00Z, Datei: updatedAt {}
```

Szenario: Der Nutzer importiert das Backup eines Kollegen, in dem ein Plan ein defektes
`updatedAt` trägt (aus einer Fremdsoftware, per Hand editiert, oder böswillig). Sein
heutiger Stand desselben Plans wird in der Oberfläche **und** in IndexedDB ersetzt
(`js/app.js:353` schreibt den Gewinner), obwohl der Meldungstext hinterher „neuere lokale
Stände behalten“ verspricht. Rückgängig geht nichts: `store.resetHistory()` (Zeile 363)
löscht direkt danach die Undo-Historie.

Am Rande, dieselbe Zeile: `>=` bedeutet bei Gleichstand „Datei gewinnt“. Das widerspricht
dem Meldungstext ebenfalls, ist praktisch aber folgenlos, weil `touch()` Millisekunden
stempelt.

**Vorschlag:** in `mergeById` nur Strings als Zeitstempel akzeptieren
(`const ts = x => (typeof x?.updatedAt === 'string' ? x.updatedAt : '')`), und `>` statt
`>=` verwenden, damit der Meldungstext stimmt. Zusammen mit Befund 1 löst eine Typprüfung
in `checkPlan` beide Probleme an der Wurzel.

### 5. Der Import ist ein Lese-dann-Schreiben-Ablauf über zwei `await` hinweg

`js/app.js:344-362`: `s0 = store.get()` wird vor `await file.text()` … nein, direkt danach
genommen — aber `mergedCases`/`mergedTrucks`/`mergedPlans` werden aus `s0` gebildet und
erst **nach** `await Promise.all([...])` (Zeile 352-354, ein Dutzend IndexedDB-Schreibvorgänge)
in den Store geschrieben. Dazwischen läuft die Oberfläche weiter: der Datei-Dialog ist kein
`<dialog>`, die Tastatur-Sperre in Zeile 196 (`document.querySelector('dialog[open]')`)
greift also nicht.

Szenario: Der Nutzer wählt eine große Backup-Datei aus, drückt während des Schreibens noch
`r` (Rotieren) auf ein ausgewähltes Case. Dann gilt in Zeile 361:

```js
plan: mergedPlans.find(p => p.id === s.plan.id) ?? s.plan
```

`mergedPlans.find(...)` liefert das **`s0`-Objekt** des Plans (denn der lokale Stand hat
gewonnen) — nicht `s.plan`. Die Rotation wird also zurückgenommen, obwohl der Import diesen
Plan gar nicht verändern wollte. `planChanged` (Zeile 355) vergleicht ebenfalls gegen `s0`
und ist damit falsch, die Historie wird nicht zurückgesetzt, obwohl der Plan unter den
Füßen ausgetauscht wurde.

**Vorschlag:** das Mischen in den Updater ziehen, damit es auf dem aktuellen Zustand
rechnet: erst `parseBundle` + Schreiben nach IndexedDB, dann
`store.update(s => { const cases = mergeById(s.cases, b.cases); … })`. Alternativ die
Oberfläche für die Dauer des Imports sperren — das Mischen im Updater ist aber die
ehrlichere Lösung, weil sie keine Annahme über die Laufzeit macht.

### 6. `checkCase` hat keine Obergrenze — der Import erzeugt Daten, die der eigene Editor ablehnt

`js/store/io.js:18-19` prüft nur `num(c[k]) && c[k] > 0`. `js/ui/case-editor.js:15` setzt
dagegen `max="2000"`. Verifiziert:

```
Riesencase akzeptiert: 1000000000 cm (Editor erlaubt max 2000)
```

Das ist genau die Falle, vor der `docs/architektur.md` unter „Was leicht übersehen wird“
warnt („`maxlength` in der Oberfläche und die Grenze in `checkPlan` müssen zusammenpassen“) —
für `label` ist sie eingehalten (40 ↔ 40, `js/ui/inspector.js:31`, `js/ui/load-wizard.js:167`),
für die Maße und das Gewicht nicht.

Szenario: Ein Case mit `l: 1e9` landet in der Bibliothek. Es ist per Drag platzierbar; die
2D-Ansicht skaliert auf die Truck-Breite, das Case zeichnet ein Rechteck von 10^9 cm — die
`viewBox` ist unbrauchbar, die 3D-Box mit `1e9³` erzeugt beim Zentrieren der Kamera
Rundungsmüll. Der Nutzer kann das Case zwar löschen, der Zustand ist also nicht
unentrinnbar — aber die Abweichung zwischen Editor und Importprüfung sollte weg.
Analog: `weight` hat nach unten eine Grenze (`< 0`), nach oben keine.

**Vorschlag:** in `checkCase` dieselben Grenzen wie im Editor (`l/w/h ≤ 2000`,
`weight ≤ 100000`) und in `checkPlan` eine Grenze für `x/y/z` (z. B. `|v| ≤ 10000`). Die
Grenzen als exportierte Konstanten in `io.js` halten und aus `case-editor.js` in das
`max=`-Attribut einsetzen, damit sie nicht wieder auseinanderlaufen — der Test dazu ist
ein Zweizeiler.

### 7. Zwei offene Tabs überschreiben sich gegenseitig, lautlos

Es gibt keine Synchronisation zwischen Browser-Kontexten: kein `BroadcastChannel`, kein
`storage`-Event, keine Versionsprüfung beim Schreiben. Jeder Tab hält seinen eigenen Store
(`js/app.js:33`) und schreibt den **ganzen** Plan (`db.put`, `js/store/db.js:28`).

Szenario: Der Nutzer hat die PWA auf dem Tablet offen und öffnet sie zusätzlich am Rechner
(oder nur einen zweiten Tab, was bei einer App, die man „nebenbei offen lässt“, normal ist).
Beide haben Plan „Tour Nord“ vom Morgen geladen. Am Rechner setzt er 20 Cases; auf dem
Tablet tippt er eine Beschriftung. Der 400-ms-Autosave des Tablets schreibt seinen
kompletten, alten Plan-Snapshot über den frischen — die 20 Cases sind weg, und kein Tab
merkt es, weil beide weiter ihren eigenen Stand anzeigen.

**Vorschlag:** mindestens erkennen statt lösen. Ein `BroadcastChannel('truckload')`, über
den jeder Tab nach dem Schreiben `{planId, updatedAt}` sendet; empfängt ein Tab eine
neuere Marke für den Plan, den er gerade offen hat, sperrt er das Speichern und meldet
„Dieser Ladeplan wurde in einem anderen Fenster geändert — neu laden“. Das ist deutlich
weniger Aufwand als echtes Mischen und verhindert den Datenverlust.

### 8. 70 von 137 Bibliotheks-Cases wiegen 0 kg — die App zeigt daraus eine plausible Gesamtzahl

Nachgerechnet: `CASE_LIBRARY.filter(c => !c.weight).length === 70`. Das ist in
`js/data/case-library.js:26-29` bewusst so dokumentiert und entspricht der Haltung aus
`CLAUDE.md` („lieber 0 kg als eine erfundene Zahl“) — **an der Datenquelle**. Die
Anzeige hält sich nicht daran:

- `js/model/validate.js:108` summiert `it.c.weight` ohne Unterscheidung zwischen „0 kg“ und
  „unbekannt“.
- `js/ui/inspector.js:56` druckt daraus `„1.240 / 24.000 kg Nutzlast“` plus einen
  Fortschrittsbalken.
- `js/model/validate.js:112-114` rechnet den Schwerpunkt mit denselben Nullen.

Szenario: Der Nutzer packt einen Sattelauflieger ausschließlich aus Bibliotheks-Cases,
davon acht ohne Gewicht. Die Anzeige sagt „3.100 / 24.000 kg“ mit grünem Balken — eine
plausibel aussehende, aber frei erfundene Zahl, und `tooHeavy` (Zeile 109) schlägt nie an.
Genau der Fehlertyp, den `CLAUDE.md` unter „Haltung“ als schlimmer als eine fehlende Angabe
bezeichnet.

**Vorschlag:** `buildItems`/`validatePlan` zählen mit, wie viele Stücke `weight === 0`
tragen, und die Anzeige schreibt „3.100 kg *(8 Cases ohne Gewichtsangabe)*“ statt einer
glatten Summe; der Nutzlastbalken bekommt eine gestrichelte Unsicherheitszone oder wird
grau, sobald `unknownWeights > 0`. Im Inspector „Gewicht: unbekannt“ statt „0 kg“. Das ist
kein Datenbefund an der Bibliothek, sondern der fehlende Weg der Unsicherheit durch die
Schichten.

### 9. Eigene Cases erscheinen in UUID-Reihenfolge

`js/store/repo.js:30` nimmt `db.getAll('cases')` unverändert; IndexedDB liefert nach
Schlüssel sortiert, der Schlüssel ist `crypto.randomUUID()`. `groupCases`
(`js/ui/caseGroups.js:19`) filtert nur und sortiert nicht.

Szenario: Der Nutzer legt „Amp-Rack 1“, „Amp-Rack 2“, „Kabelcase blau“ an. In der
Bibliothek stehen sie in zufälliger Reihenfolge, und sie **springt bei jeder Bearbeitung**,
weil `js/app.js:91` das bearbeitete Case ans Ende des Arrays hängt
(`[...st.cases.filter(...), value]`) — innerhalb der Sitzung also eine andere Reihenfolge
als nach einem Neuladen. Bei 5 Cases fällt das kaum auf, bei 50 ist die Liste unbenutzbar.

**Vorschlag:** in `loadAll()` die eigenen Cases per `localeCompare(…, 'de')` nach Namen
sortieren, oder — sauberer, weil es die Sitzungs-Inkonsistenz mit erschlägt — in
`groupCases` sortieren. Dann ist die Reihenfolge unabhängig davon, woher die Liste kommt.
Dasselbe gilt für `trucks` (`js/store/repo.js:32`, `[...PRESET_TRUCKS, ...trucks]`).

### 10. Der Import überschreibt unwiderruflich und ohne Sicherung

`js/app.js:352-363` schreibt die Gewinner sofort nach IndexedDB und ruft danach
`store.resetHistory()`. Es gibt keine Vorschau („diese 3 Pläne werden ersetzt“), keinen
Abbruch, kein automatisches Backup des vorherigen Stands. Der Meldungstext (Zeile 364)
kommt erst, wenn alles schon geschrieben ist.

Szenario: Der Nutzer will ein altes Backup „nur mal anschauen“ und wählt versehentlich die
Version von vorletzter Woche. Alle Pläne, die er seitdem nicht angefasst hat, sind auf dem
alten Stand — die konkret ersetzten sind die, deren `updatedAt` in der Datei neuer ist.
Rückweg: keiner.

**Vorschlag:** vor dem Schreiben eine Zusammenfassung mit `confirm` zeigen („Ersetzt wird:
2 Ladepläne (‚Tour Nord‘, ‚Messe Köln‘), 4 Cases. Neu hinzu: 11 Cases.“). Optional davor
still ein Voll-Backup ablegen (derselbe `exportBundle`-String in einen
`backups`-Object-Store, die letzten drei behalten) — das ist bei IndexedDB billig und wäre
das einzige Netz, das diese App überhaupt hat.

### 11. Ein Fehler in `loadAll()` liefert eine weiße Seite ohne Text

`js/app.js:29` (`await repo.loadAll()`) steht ungeschützt auf Modulebene, und
`js/store/db.js:7` merkt sich das Promise (`dbPromise ??=`) — auch ein abgelehntes. Wenn
`indexedDB.open` scheitert (privates Fenster mit blockiertem Speicher, deaktivierte
Cookies/Site-Data, korrupte Datenbank), bricht die Modulauswertung ab. `index.html` hat
weder einen Fehler-Handler noch einen Text-Fallback (geprüft: nur die Importmap und
`<script type="module" src="js/app.js">`).

Szenario: Ein Kollege öffnet die Seite im privaten Fenster, um „mal reinzuschauen“. Er
sieht das leere Gerüst ohne jede Erklärung und meldet „die App ist kaputt“.

**Vorschlag:** `loadAll()` in `try/catch` und im Fehlerfall im leeren Zustand starten
(`{cases: [], trucks: [], plans: []}` plus die Vorlagen) mit einem deutlichen Banner
„Speicher nicht verfügbar — Änderungen gehen beim Schließen verloren“. Damit ist die App
benutzbar und der Nutzer gewarnt, statt beides nicht.

### 12. Die Toolbar baut beide `<select>` bei jedem Frame neu

`js/app.js:243-250` setzt in einem Render-Hook `#plan-select.innerHTML` und
`#truck-select.innerHTML` bei **jedem** Render — also bei jedem `requestAnimationFrame`
während eines Drags, weil `edit()` → `subscribe` → `scheduleRender()` läuft.

Szenario: Der Nutzer klappt die Fahrzeugliste auf und zieht mit der anderen Hand kein Case —
gut. Aber: er klappt die Planliste auf, und im Hintergrund feuert irgendein Render (etwa
weil die 3D-Ansicht per Hook `store.update` auslöst oder eine Auswahl gesetzt wird) — die
Liste klappt zu, die Auswahl per Tastatur ist verloren. Zusätzlich werden pro Sekunde bis
zu 60 Mal ~25 Optionen aus Strings gebaut und geparst, während die Ziehbewegung ohnehin
das Rendern der drei SVGs trägt.

**Vorschlag:** die erzeugte Markup-Zeichenkette merken und nur bei Änderung zuweisen
(`if (html !== lastPlanHtml) …`). Zwei Zeilen, und der Fokus-/Aufklapp-Fehler ist mit weg.

---

## [nit]

### 13. `tests/pwa.test.js` deckt `css/` und `icons/` nicht strukturell ab

`tests/pwa.test.js:37-38` leitet `js/` und `vendor/` per `filesIn()` ab, nennt `css/app.css`
und `css/print.css` aber fest. Eine neue `css/dialogs.css` oder ein neues Icon im Manifest
fiele damit nicht auf und fehlte offline — dieselbe Regel, die `CLAUDE.md` für `js/` und
`css/` ausdrücklich aufstellt, wird für `css/` nur stichprobenartig geprüft.

**Vorschlag:** `...filesIn('css')` und `...filesIn('icons')` in `needed` aufnehmen (letzteres
ggf. nur für die im Manifest genannten Icons).

### 14. `checkPlan` erzwingt keine eindeutigen Stück-IDs

`js/store/io.js:62-66` prüft jedes Placement einzeln. Ein Bundle mit zweimal `id: "a"` im
selben Plan wird akzeptiert (verifiziert). Folge: `A.removePlacement` (`filter`) löscht
beide auf einmal, `moveGroup` findet über `items.find` nur das erste, `result.sequence`
(eine `Map`) zählt nur eines — die Nummerierung im Druck springt.

**Vorschlag:** in `checkPlan` `new Set(ids).size === ids.length` über `placements` und
`unplaced` zusammen prüfen.

### 15. Ein beschädigtes Bundle wird als leerer Import gemeldet, nicht als Fehler

`js/store/io.js:83-85` benutzt `arr()`, das alles Nicht-Array still zu `[]` macht.
`{"format":"truckload","version":1,"cases":"boom"}` wird akzeptiert und meldet
„Importiert: 0 Cases, 0 Fahrzeuge, 0 Ladepläne“. Der Nutzer hält seine Datei danach für in
Ordnung.

**Vorschlag:** `if (data.cases !== undefined && !Array.isArray(data.cases)) throw …`, analog
für `trucks`/`plans`. Auch: ein Bundle ganz ohne Inhalt sollte „Die Datei enthält keine
Daten.“ sagen statt dreimal „0“.

### 16. Der `catch` der 3D-Ansicht verschluckt auch Fehler aus `update()`

`js/app.js:311-321`: der `try` umschließt sowohl `createView3d` als auch `view3d.update(...)`.
Ein Fehler beim Aktualisieren (etwa eine kaputte Geometrie durch ein Case mit absurden
Maßen, s. Befund 6) reißt die ganze Ansicht ab und zeigt die irreführende Meldung
„vendor/ fehlt?“. Zusätzlich wird bei jedem folgenden Frame `createView3d` neu versucht,
und `textContent = …` hat den Container vorher geleert — ein erfolgreicher zweiter Versuch
hängt dann seinen Canvas neben einen Textknoten.

**Vorschlag:** `createView3d` und `update` getrennt fangen; nach dem Laden-Fehler ein
`view3dFailed = true` setzen und nicht endlos neu versuchen.

### 17. `plan.notes` wird nicht geprüft

`js/store/io.js:85` setzt `notes: p?.notes ?? ''`, `checkPlan` sieht das Feld nie an. Ein
Objekt oder eine 2-MB-Zeichenkette kommt durch. Wo `notes` angezeigt wird, ist es heute
(soweit geprüft) nicht im DOM — sobald es das wird, ist die Lücke eine.

**Vorschlag:** `typeof p.notes === 'string' && p.notes.length <= 2000` in `checkPlan`.

### 18. `cdp.mjs` fehlt im Scratchpad

`CLAUDE.md` („Prüfen“ → „Im Browser“) verspricht `cdp.mjs` im Scratchpad-Verzeichnis der
Sitzung. Hier lagen dort nur `probe1.mjs`/`probe2.mjs` und ein `mut/`-Verzeichnis. Entweder
gehört der Treiber ins Repo (z. B. `tools/cdp.mjs`, er ist kein npm-Abhängigkeits-Problem)
oder die Anweisung muss sagen, wie er entsteht.

---

## [suggestion]

### 19. `setMode`/`setCaseColors` schreiben DOM-Zustand an den Render-Hooks vorbei

`js/app.js:220-238` setzt `hidden`, `classList.toggle('on')` usw. direkt, und die Zeilen
237-238 wiederholen das noch einmal für den Startzustand. Damit existiert abgeleiteter
Zustand (`s.mode`, `s.caseColors` → Klassen) an drei Stellen statt in `render()`. Heute
funktioniert es, weil nur diese beiden Funktionen den Modus setzen — aber ein Undo, das
irgendwann auch `mode` umfasst, oder ein zweiter Auslöser bringt die Anzeige lautlos aus
dem Tritt. Abwägen: ein `renderHooks.push(s => { … })` mit denselben vier Zeilen macht die
Toolbar zur Ableitung und die beiden Startzeilen überflüssig.

### 20. Ein importiertes Case darf sich eine `lib-…`-ID greifen

`js/store/io.js:14` erkennt Vorlagen an `builtin` oder `id.startsWith('preset-')` — die 137
Bibliotheks-IDs beginnen aber mit `lib-` (`js/data/case-library.js:34`). Ein Bundle mit
`{id: "lib-packwuerfel-bbm", builtin: false, …}` kommt also durch, landet in IndexedDB und
verdeckt über `mergeOwnWithBuiltins` **dauerhaft** den mitgelieferten Eintrag — der Nutzer
sieht unter demselben Namen andere Maße und hat keinen Hinweis, dass ein Eintrag der
gelieferten Liste ersetzt wurde. Abwägen: `isPreset` um `id.startsWith('lib-')` erweitern
(dann sind fremde `lib-`-Cases beim Import schlicht raus), oder solche IDs beim Import auf
eine neue UUID umschreiben und die Verweise in den mitgebrachten Plänen mitziehen.

### 21. Verweise beim Import prüfen und melden

`parseBundle` prüft jeden Datensatz für sich, nie die Beziehungen: ein Plan darf auf eine
`caseId` zeigen, die in der Datei fehlt und lokal nicht existiert, und auf eine unbekannte
`truckId` (beides verifiziert akzeptiert). Die App fängt das ab — `orphans` in
`js/model/actions.js:155` und der Fahrzeug-Fallback in `js/app.js:41` —, aber der Nutzer
erfährt nichts. Abwägen: nach dem Mischen zählen, wie viele Stücke auf ein unbekanntes Case
zeigen, und das in die Erfolgsmeldung aufnehmen („… 3 Stücke verweisen auf Cases, die nicht
in der Datei waren“).

### 22. Ein gelöschtes Fahrzeug lässt andere Pläne mit einem toten Verweis zurück

`js/app.js:294-299` biegt nur den **aktuellen** Plan auf `DEFAULT_TRUCK_ID` um. Alle anderen
Pläne behalten die tote `truckId`; `ctx()` fällt beim Öffnen still auf den Sattelauflieger
zurück. Der Löschen-Dialog warnt zwar („wird in n Ladeplänen verwendet“), aber danach
ändert sich die Ladefläche dieser Pläne unbemerkt — mit anderen Prüfergebnissen. Abwägen:
alle betroffenen Pläne beim Löschen umbiegen und speichern, oder die tote ID stehen lassen
und im Inspector als Hinweis zeigen („Fahrzeug gelöscht, gerechnet wird mit …“).

### 23. Der Abstand zwischen `plan.updatedAt` und `stamp()` ist zweierlei

`js/store/repo.js:7` (`stamp`) und `js/model/actions.js:5` (`touch`) tun dasselbe in zwei
Modulen, und `js/app.js:268`, `:272`, `:286`, `:298`, `:304` schreiben `updatedAt` noch ein
drittes Mal von Hand (`new Date().toISOString()`). Fünf handgeschriebene Stempel sind fünf
Gelegenheiten, einen zu vergessen — und ein vergessener Stempel heißt beim nächsten Import
„die Datei ist neuer“ und überschreibt echte Arbeit (Befund 4/10). Abwägen: `touch` aus
`actions.js` exportieren und in `app.js` ausschließlich das benutzen, oder `edit()` den
Stempel selbst setzen lassen, wenn sich der Plan verändert hat.

---

## Zusammenfassung

| Einstufung | Anzahl |
|---|---|
| blocking | 3 |
| important | 9 |
| nit | 6 |
| suggestion | 5 |

Die drei blockierenden Befunde hängen an derselben Wurzel: der Speicherpfad ist
optimistisch (er meldet Erfolg, bevor er einen hat) und der Importpfad prüft ein Feld
nicht, auf das der Startpfad sich verlässt. Beides ist mit je wenigen Zeilen zu schließen.
Die Struktur darunter — Schichtgrenze, Mischregeln, Migration, Testabdeckung der Daten — ist
auffallend solide; die Lücken sitzen alle an den Rändern, wo die App mit der Welt redet:
Schreiben in die Datenbank, Lesen aus einer fremden Datei, Schließen des Fensters.
