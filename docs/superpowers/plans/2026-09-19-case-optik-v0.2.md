# Truckload V 0.2.0 – Cases als echte Cases, Rollen sichtbar, „Tippen“

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development (oder executing-plans). Steps mit `- [ ]`.

## Context

Nutzer-Feedback zu V 0.1.1 (live auf https://m4dm0nky.github.io/Truckload/):
1. Cases sollen **wie echte Cases** aussehen (Alu-Kanten, Kugelecken, Verschlüsse, Räder). Farbe **umschaltbar**: Standard **schwarz** mit Gewerk-Farbstreifen, oder **komplett in Gewerk-Farbe** (Nutzer-Entscheidung).
2. **Rollen sichtbar** machen (2D und 3D).
3. Begriff **„Tippen“ statt „Kippen“** überall in der Oberfläche/Doku.

Heute: Cases sind einfarbige Rechtecke/Boxen in Gewerk-Farbe (`js/ui/view2d.js:29-41`, `js/ui/view3d.js:58-65`), Rollen nur als 6-cm-Streifen bzw. 3-cm-Platte (`wheelStrip`/`faceSlab`).

Vorbild (typisches Road-/Flightcase-Piktogramm): schwarzer Korpus, helle Alu-Kantenprofile, Kugelecken, zwei Butterfly-Verschlüsse an der Deckelfuge, 4 Lenkrollen an den Ecken.

## Entscheidungen

- **Umschalter „Case-Farbe: Schwarz | Gewerk“** in der Topbar (Segment-Buttons wie 2D/3D), gilt für 2D, 3D und Druck. Standard **Schwarz**. Gemerkt pro Browser in `localStorage` (`truckload.caseColors`, Zugriff in try/catch; ohne Speicher → Schwarz).
  - Schwarz: Korpus `#1c1d20` + Gewerk-Farbstreifen (`c.color`).
  - Gewerk: Korpus komplett `c.color`, kein Streifen.
  - In beiden Modi gleich: Alu-Kanten `#b8bec6`, Kugelecken `#d6dbe1`, Verschlüsse, Rollen; Nummer weiß mit dunkler Kontur (auf jeder Farbe lesbar).
- Reine Funktion `caseColors(c, mode) → { body, stripe|null }` in `js/ui/caseStyle.js` (einzige Quelle für 2D, 3D, Druck), getestet.
- Neues Case-Feld **`wheelH`** (Rollenhöhe cm, Teil der Standhöhe `h`). Default 12; `0` = keine Rollen. Fehlt es (alte Daten/Import) → 12. Vorlage Traverse: 0.
- Rollen liegen im `wheelH`-Streifen an der Rollenseite (`wheelFace`), 4 Stück an den Ecken. Geometrie/Prüfungen/Packer unverändert (Maße bleiben inkl. Rollen).
- Code-Bezeichner (`tippable`, `tipLong`, `cycleTip`) bleiben – nur Texte ändern sich.
- Version **0.2.0** überall (Test erzwingt Gleichstand), Git-Tag `v0.2.0`, Deploy über GitHub Pages (push auf `main`).

## Global Constraints
- Keine npm-Abhängigkeiten, kein Build. Nutzereingaben in HTML nur über `esc()`.
- Tests: `npm test` (derzeit 86 grün) muss grün bleiben.
- UI-Deutsch mit „…“-Anführungszeichen.

---

### Task 1: „Tippen“ statt „Kippen“

Texte ersetzen (kippbar→tippbar, Kippen→Tippen, gekippt→getippt, kippen→tippen):
- `js/ui/inspector.js:18,45`, `js/ui/library.js:25`, `js/ui/case-editor.js:28` („tippbar (darf auf die Seite getippt werden)“), `js/ui/dom.js:16-17` („getippt (Längsseite)“ / „getippt (Stirnseite)“), `js/model/validate.js:48` („darf nicht getippt werden“), `README.md:5,42`, `CHANGELOG.md` (nur neuer Eintrag, alte Einträge bleiben), Testnamen in `tests/*.test.js`.
- [ ] `grep -rni kipp` über js/, index.html, README, tests → nur noch CHANGELOG-Historie. `npm test` grün. Commit `fix: „Tippen“ statt „Kippen“`.

### Task 2: Rollenhöhe `wheelH` im Datenmodell

**Files:** `js/data/preset-cases.js`, `js/ui/case-editor.js`, `js/store/io.js`, `tests/presets.test.js`, `tests/io.test.js`, `tests/fixtures.js`
- Preset-Factory `P`: Default `wheelH: 12`; Traverse 3 m: `wheelH: 0`.
- `export const DEFAULT_WHEEL_H = 12;` und `export const wheelHOf = c => (Number.isFinite(c.wheelH) ? c.wheelH : DEFAULT_WHEEL_H);` in `js/model/geometry.js` (einzige Quelle für den Fallback).
- Case-Editor: Feld „Rollenhöhe (cm, 0 = ohne Rollen)“ (`type=number min=0 max=40 step=1`, Wert `wheelHOf(v)`), gespeichert als Zahl.
- `checkCase` (io.js): `wheelH` fehlt/`null` erlaubt, sonst endliche Zahl `0 ≤ wheelH < h` → sonst `Case „…“ hat ungültige Eigenschaften.`
- Tests: Presets haben `0 ≤ wheelH < h`, Traverse 0; Import lehnt `wheelH: -1` und `wheelH ≥ h` ab, akzeptiert fehlendes `wheelH`; `wheelHOf({})===12`, `wheelHOf({wheelH:0})===0`.
- [ ] TDD, `npm test` grün, Commit `feat: Rollenhöhe pro Case`.

### Task 3: Case-Form als reine Geometrie (`js/model/caseShape.js`)

Einzige Quelle für Korpus + Rollen, von 2D und 3D genutzt.

```js
import { wheelFace, wheelHOf } from './geometry.js';

// Zerlegt die Box eines platzierten Cases in Korpus und 4 Rollen (Truck-Koordinaten, cm).
export function caseShape(c, p, box) {
  const wh = wheelHOf(c);
  const face = wheelFace(p);
  if (wh <= 0) return { body: box, wheels: [], face: null };
  const body = { ...box };
  if (face === 'bottom') body.z0 += wh;
  else if (face === '+x') body.x1 -= wh;
  else if (face === '-x') body.x0 += wh;
  else if (face === '+y') body.y1 -= wh;
  else if (face === '-y') body.y0 += wh;
  const d = wh * 0.8;                  // Raddurchmesser, Rest = Gabel/Platte
  const inset = Math.max(3, d * 0.4);  // Abstand von der Case-Ecke
  // Die zwei Achsen in der Rollenfläche + Lage des Rollenstreifens entlang der Normalen
  const [a1, a2, n] = face === 'bottom' ? ['x', 'y', 'z'] : face.endsWith('x') ? ['y', 'z', 'x'] : ['x', 'z', 'y'];
  const slab0 = face === 'bottom' ? box.z0 : face[0] === '+' ? box[`${n}1`] - wh : box[`${n}0`];
  const pos = (axis, end) => (end ? box[`${axis}1`] - inset - d : box[`${axis}0`] + inset);
  const wheels = [];
  for (const e1 of [0, 1]) for (const e2 of [0, 1]) {
    const w = {};
    w[`${a1}0`] = pos(a1, e1); w[`${a1}1`] = w[`${a1}0`] + d;
    w[`${a2}0`] = pos(a2, e2); w[`${a2}1`] = w[`${a2}0`] + d;
    w[`${n}0`] = slab0; w[`${n}1`] = slab0 + wh;
    wheels.push(w);
  }
  return { body, wheels, face };
}
```
Tests `tests/caseShape.test.js` (Case 120×60×80, wheelH 12):
- stehend: `body.z0 === 12`, 4 Rollen, alle `z0===0 && z1===12`, alle innerhalb der Box.
- `tipLong` rot 0 (Rollen +y): `body.y1 === box.y1 - 12`, Rollen `y0 === box.y1 - 12`.
- `wheelH: 0`: `body` = Box, `wheels` leer.
- Rollen überlappen sich nicht (paarweise `overlaps` false).
- [ ] TDD, Commit `feat: Case-Form mit Rollen (Geometrie)`.

### Task 3b: Farbmodus (`js/ui/caseStyle.js`, Topbar-Umschalter)

```js
// Farben eines Cases je nach Anzeigemodus – einzige Quelle für 2D, 3D und Druck.
export const CASE_BLACK = '#1c1d20';
export const COLOR_MODES = ['black', 'trade'];
export function caseColors(c, mode) {
  return mode === 'trade' ? { body: c.color, stripe: null } : { body: CASE_BLACK, stripe: c.color };
}
```
- Tests `tests/caseStyle.test.js`: schwarz → Korpus `#1c1d20`, Streifen = Gewerk-Farbe; `trade` → Korpus = Gewerk-Farbe, kein Streifen; unbekannter Modus → schwarz.
- `index.html`: Segment nach 2D/3D: `<div class="group seg" title="Case-Farbe"><button id="colors-black" class="on">Schwarz</button><button id="colors-trade">Gewerk</button></div>`.
- `js/app.js`: State-Feld `caseColors` (Start aus `localStorage`, try/catch, Fallback `'black'`); Buttons setzen State + speichern + `on`-Klasse; `renderView`, `view3d.update` und `buildPrint` bekommen `colorMode: s.caseColors`.
- [ ] TDD für `caseColors`, `node --check`, Commit `feat: Case-Farbe umschaltbar (Schwarz | Gewerk)`.

### Task 4: 2D-Darstellung als Case (`js/ui/view2d.js`, `js/ui/projection.js`, `css/app.css`)

- `projection.js`: `wheelView(mode, face) → 'edge' | 'facing' | 'hidden'` – `edge` wenn `wheelStrip(mode, face)` ≠ null; `facing` wenn Rollen zum Betrachter zeigen (side: `-y`, rear: `+x`); sonst `hidden` (Draufsicht stehend). Test in `tests/projection.test.js`.
- `renderView` pro Case (Gruppe `g.case` bleibt, `data-id` bleibt → Drag/Selection unverändert):
  1. Unsichtbares Hit-Rechteck über die ganze Box (`class="hit"`, fill transparent) – damit Klick/Drag überall greift.
  2. Rollen (vor dem Korpus zeichnen): für jede Rolle aus `caseShape` → `project` → Kreis `class="wheel"` (Radius = min(Breite, Höhe)/2) + Nabe `class="hub"` (r/3); bei `edge` zusätzlich Gabel-Linie zum Korpus; bei `hidden` nichts.
  3. Korpus: `project(body)` → `rect.body` (fill `caseColors(c, colorMode).body`, stroke Alu 3, rx 2).
  4. Gewerk-Streifen (nur wenn `stripe` ≠ null): Rechteck 7 cm hoch, 6 cm unter der Korpus-Oberkante bzw. (Draufsicht) am oberen Rand, Breite Korpus − 12, fill `stripe`, `class="stripe"`.
  5. Kugelecken: 4 Kreise r 4 an den Korpusecken, `class="corner"`.
  6. Nur Seiten-/Rückansicht und stehendes Case: Deckelfuge (Alu-Linie bei 22 % Korpushöhe von oben) + 2 Verschlüsse (6×5-Rechtecke bei ¼ und ¾ Breite), `class="latch"`.
  7. Nummer: weiß, fett, dunkle Kontur (`paint-order: stroke; stroke:#000; stroke-width:3`), `class="label"`, mittig im Korpus (unterhalb des Streifens).
- `renderView(svg, mode, { …, colorMode = 'black' })` – neuer Parameter; `print.js` reicht ihn durch.
- Zustände: `.sel` → Korpus-Stroke `var(--accent)` 5; `.bad` → roter gestrichelter Rahmen um die ganze Box (eigenes `rect.alert`).
- CSS: Tokens `--case-body:#1c1d20; --alu:#b8bec6; --corner:#d6dbe1; --wheel:#2b2d31` in `:root` (auch Light-Theme identisch – Cases sind immer schwarz); alte `.wheels`-Regel entfernen; `print.css` erbt (Farben via `print-color-adjust`).
- `wheelStrip`/`stripRect` bleiben (von `wheelView` genutzt); nicht mehr benutzte Imports entfernen.
- [ ] `node --check`, `npm test`, Commit `feat: Cases in 2D als echte Cases mit Rollen`.

### Task 5: 3D-Darstellung als Case (`js/ui/view3d.js`)

- Geteilte Geometrien einmal anlegen (`sphere r=2.5`, `cylinder r=1 h=1` für Rollen, skaliert), Materialien einmal (Korpus `MeshStandardMaterial #1c1d20 roughness .7`, Alu `#b8bec6 metalness .6`, Gummi `#2b2d31`); in `clear()` nur nicht-geteilte Objekte disposen (`userData.shared`).
- `update({ …, colorMode })`; Korpus-Farbe/Band aus `caseColors` (Korpus-Materialien pro Farbe cachen).
- Pro Case aus `caseShape`: Korpus-Box; Alu-Kanten als `LineSegments` (EdgesGeometry, Farbe Alu / Auswahl `#f0a500` / Fehler `#e5484d`); 8 Kugelecken; nur im Schwarz-Modus Gewerk-Band (Box 0,4 cm größer als Korpus in x/y, 6 cm hoch, 6 cm unter Korpus-Oberkante, Farbe `c.color`); pro Rolle ein Zylinder (Durchmesser = Rollenbox-Kante, Achse waagrecht, in der Rollenfläche) + kleine Gabel-Box zwischen Rad und Korpus.
- Fehlerhafte Cases: Korpus `emissive #661111`.
- [ ] `node --check`, Commit `feat: Cases in 3D als echte Cases mit Rollen`.

### Task 6: Version 0.2.0, Prüfung, Veröffentlichung

- `js/version.js` → `'0.2.0'`, `package.json`, `README.md` („Version: **V 0.2.0**“), `index.html` (`V 0.2.0`), `sw.js` (`truckload-v0.2.0`, neue Datei `js/model/caseShape.js` und `js/ui/caseStyle.js` in `ASSETS` – `tests/pwa.test.js` prüft das), CHANGELOG-Eintrag `## V 0.2.0 – <Datum>` (Case-Optik, Farbe umschaltbar Schwarz/Gewerk, Rollen sichtbar + Rollenhöhe, „Tippen“).
- [ ] `npm test` grün.
- [ ] Browser-Test (headless Chrome via CDP-Skript im Scratchpad, wie bei V 0.1): Plan mit Kabelcases, Racks, Traverse packen; ein Case tippen (T); Screenshots Draufsicht/Seite/Rück/3D/Druck in **beiden Farbmodi** ansehen (Umschalter bleibt nach Reload erhalten): schwarze bzw. Gewerk-farbige Cases, Alu-Kanten, Kugelecken, Farbstreifen, Rollen unten bzw. an der Seite bei getippten Cases, Traverse ohne Rollen; Klick/Drag/Auswahl funktionieren; Konsole fehlerfrei.
- [ ] Merge nach `main`, Tag `v0.2.0`, push → GitHub Pages; live prüfen, dass `V 0.2.0` erscheint.

## Verifikation (Kurz)
- Automatisch: `npm test` (neu: caseShape, wheelView, wheelH-Import/Presets, Versions-Gleichstand, Offline-Liste).
- Visuell: Screenshots aus dem headless-Chrome-Lauf in allen Ansichten + Druck; Live-Check der Pages-Seite.
