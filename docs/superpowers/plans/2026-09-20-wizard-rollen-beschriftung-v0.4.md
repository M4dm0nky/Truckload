# Truckload V 0.4.0 – Wizard-Bedienkonzept, Rollen als Maß, Beschriftung, Tipprichtung

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps mit `- [ ]`.

## Context

Das bisherige Bedienkonzept geht von der Case-Bibliothek aus: Case anklicken, Anzahl per
`prompt()` eintippen, in die Ablage legen, packen. Der Nutzer arbeitet aber andersherum: Er
startet einen Load und stellt dann zusammen, was mitfährt. Jedes einzelne Stück braucht dabei
eine eigene Beschriftung und Farbe (nicht nur der Case-Typ), weil im Truck „Licht 3“ und
„Ton 2“ unterscheidbar sein müssen.

Dazu drei konkrete Mängel aus der Praxis:

1. **Rollen fehlen im Maß.** Heute ist die eingetragene Höhe die Gesamthöhe *inklusive* Rollen,
   `wheelH` ist nur Deko. Wer ein Case nur als Korpusmaß kennt (oder einen Sonderbau baut),
   kann die Rollen nicht dazurechnen lassen. Nutzer-Beispiel: Box L 200 × B 80 × H 200 cm,
   Rollen dazu → **216 cm** hoch.
2. **Tipprichtung falsch.** Getippt wird derzeit mit den Rollen zur Seitenwand. Richtig ist:
   **Rollen immer zur Trucktür (Heck)**, und der Nutzer muss die Rollenrichtung frei wählen können.
3. **Kein Sonderbau-Weg.** Für einmalige Kisten in freien Maßen gibt es keinen schnellen Knopf.

Recherche Rollen: Blue-Wheel-Lenkrolle Ø 125 mm = 155 mm Bauhöhe, Ø 100 mm = 125 mm Bauhöhe
(aweo.de, rollenplus.de). Mit Rollenbrett ergibt die Ø-125-Rolle die vom Nutzer genannten
**16 cm** → Vorgabe für neue Cases; Ø 100 mm ≈ 13 cm als zweite Wahl.

## Entscheidungen (vom Nutzer bestätigt)

- **Tippen:** Standard-Tipprichtung = Rollen zur Tür. Im Inspector vier Richtungsknöpfe
  (Tür / Front / links / rechts). Auch die Auto-Beladung tippt mit Rollen zur Tür.
- **Sonderbau:** wird dauerhaft als eigenes Case (Gewerk „Sonderbau“) in der Bibliothek gespeichert.
- **Rollenmaß:** Bestehende Cases und Vorlagen bleiben unverändert (ihre Maße sind bereits
  inkl. Rollen). Neu ist ein Umschalter pro Case: *Maß inkl. Rollen* (Vorgabe) oder
  *Maß ohne Rollen – Rollen dazurechnen*. Nur beim zweiten wird `wheelH` auf die Höhe addiert.
  Neue Cases sind standardmäßig **mit** Rollen; „ohne Rollen“ ist ein Häkchen.
- **Beschriftung:** pro Stück, beim Anlegen automatisch durchnummeriert („Kabelcase 1 … 6“),
  jede Zeile überschreibbar. Steht auf **jeder Seite** des Cases (2D alle drei Ansichten, 3D alle
  vier Seiten + Deckel, Druck).
- Version **0.4.0** überall, Tag `v0.4.0`, Deploy über GitHub Pages.

## Global Constraints

- Keine npm-Abhängigkeiten, kein Build-Schritt. Reine ES-Module, Tests mit `node --test`.
- Nutzereingaben in HTML nur über `esc()` (XSS). UI-Deutsch mit „…“-Anführungszeichen.
- Begriff „tippen“, nie „kippen“.
- `npm test` (144 grün) bleibt grün; neue reine Logik per TDD.
- Eine Versionsnummer überall (`js/version.js`), per `tests/version.test.js` erzwungen.
- Alte Ladepläne und Cases müssen weiter laden (fehlende Felder = Vorgabewerte).

## Architektur in einem Absatz

Zwei Datenebenen werden sauber getrennt: der **Case-Typ** (Bibliothek: Maße, Gewicht, Gewerk,
Rollen) und das **Stück** (`placements[]` / `unplaced[]`: Position, Ausrichtung – **neu**
`label` und `color`). Der Packer arbeitet heute auf Case-Typen und erzeugt neue IDs, wodurch
Stück-Daten beim „Alles neu packen“ verloren gingen; er wird auf Stück-Objekte umgestellt.
Die Rollenhöhe wandert von reiner Deko in die Maßberechnung (`outerDims`), sodass Prüfung,
Packer, 2D, 3D und Druck automatisch mitziehen. Der Wizard ist ein neues UI-Modul über den
vorhandenen Aktionen; die Seitenleiste bleibt als Schnellzugriff bestehen.

---

### Task 1: Rollen im Maß (Logik)

**Files:** `js/model/geometry.js`, `js/store/io.js`, `js/data/preset-cases.js`,
`tests/geometry.test.js`, `tests/io.test.js`

- `geometry.js`:
  ```js
  export const DEFAULT_WHEEL_H = 12;   // Altdaten ohne Angabe
  export const NEW_CASE_WHEEL_H = 16;  // Blue Wheel Ø125 mm + Rollenbrett
  export const WHEEL_PRESETS = [
    { name: 'Blue Wheel Ø 125 mm', h: 16 },
    { name: 'Blue Wheel Ø 100 mm', h: 13 },
  ];
  export const hasWheels = c => c.wheels !== false && wheelHRaw(c) > 0;
  const wheelHRaw = c => (Number.isFinite(c.wheelH) ? c.wheelH : DEFAULT_WHEEL_H);
  export const wheelHOf = c => (hasWheels(c) ? wheelHRaw(c) : 0);
  // Außenmaße inkl. Rollen: nur wenn das eingetragene Maß sie NICHT schon enthält.
  export function outerDims(c) {
    const add = c.dimsInclWheels === false ? wheelHOf(c) : 0;
    return { l: c.l, w: c.w, h: c.h + add };
  }
  ```
- `localDims` benutzt `outerDims(c)` statt `c.l/c.w/c.h`. Damit ziehen Kollision, Auflage,
  Lagen, Schwerpunkt, Packer, 2D, 3D und Druck ohne weitere Änderung mit.
- `io.js checkCase`: `wheels` (falls vorhanden) boolesch; `dimsInclWheels` boolesch;
  bisherige Prüfung `wheelH < c.h` bleibt nur für `dimsInclWheels !== false`.
- Presets bekommen explizit `dimsInclWheels: true` (Dokumentation der Absicht, kein Maßwechsel).
- Tests: Case 200×80×200 mit `wheels:true, wheelH:16, dimsInclWheels:false` → `outerDims.h === 216`;
  dasselbe Case mit `dimsInclWheels:true` → 200; `wheels:false` → 200 und `wheelHOf === 0`;
  Altdaten ohne die neuen Felder → unverändertes Verhalten (Regression); Import lehnt
  `wheels: 'ja'` ab.
- [ ] TDD, Commit `feat: Rollenhöhe wird im Gesamtmaß mitgerechnet`

### Task 2: Rollen im Case-Editor

**Files:** `js/ui/case-editor.js`, `css/app.css`

- Neuer Block „Rollen“ im Case-Editor (nur `case-only`):
  - Häkchen „mit Rollen“ (Vorgabe an).
  - Auswahl Rollenhöhe: `WHEEL_PRESETS` + „eigene … cm“ (Zahlenfeld 1–40).
  - Radio: „Maß ist **inkl.** Rollen“ (Vorgabe) / „Maß ist **ohne** Rollen – Rollen dazurechnen“.
  - Live-Hinweis unter den Maßfeldern: „→ im Truck 200 × 80 × 216 cm“ (aus `outerDims`).
- Felder für Rollenhöhe/Radio werden ausgegraut, wenn „mit Rollen“ aus ist; bei `kind === 'truss'`
  bleibt der ganze Block ausgeblendet (Traversenwagen bringen eigene Rollen mit).
- Speichern setzt `wheels`, `wheelH`, `dimsInclWheels`. Das alte Feld „Rollenhöhe (0 = ohne
  Rollen)“ entfällt; beim Öffnen eines Cases mit `wheelH === 0` ist „mit Rollen“ aus.
- Beim Umschalten Traversenwagen → Case bleibt der bestehende Guard (`wheelH` zurücksetzen).
- [ ] `node --check`, `npm test`, Commit `feat: Rollen im Case-Editor an-/abwählbar`

### Task 3: Beschriftung und Farbe pro Stück (Modell)

**Files:** `js/model/actions.js`, `js/model/validate.js`, `js/store/io.js`,
`tests/actions.test.js`, `tests/io.test.js`

- Stück-Felder: `label?: string` (max. 40 Zeichen), `color?: string` (Hex `#rrggbb`, sonst
  Gewerkfarbe des Case-Typs). Sowohl in `placements[]` als auch in `unplaced[]`.
- `addUnplaced(plan, caseId, n, newId, { labels = [], color = null } = {})` – erzeugt n Einträge
  und übernimmt `labels[i]` bzw. `color`, wenn gesetzt.
- `placeCase`, `toTray`, `moveGroup`, `rotate`, `cycleTip` reichen unbekannte Felder unverändert
  durch (Spread bleibt); `duplicate` kopiert `label`/`color` und hängt an eine Beschriftung, die
  auf eine Zahl endet, die nächste freie Zahl an („Kabelcase 3“ → „Kabelcase 4“).
- Neue Aktion `setItemLabel(plan, id, { label, color })` – ändert Stück-Daten in `placements`
  **oder** `unplaced`.
- `validate.buildItems` legt `label` und `color` als `it.label` / `it.color` frei
  (Fallback: `c.name` bzw. `c.color`), damit alle Ansichten eine Quelle haben.
- `io.js checkPlan`: `label` – falls vorhanden – String ≤ 40 Zeichen; `color` – falls vorhanden –
  `/^#[0-9a-fA-F]{6}$/`. Gilt für `placements` und `unplaced`.
- Tests: `addUnplaced` mit 3 Labels; `duplicate` zählt hoch; `setItemLabel` trifft auch Ablage-
  Einträge; Import lehnt 60-Zeichen-Label und `color: 'rot'` ab; Plan ohne die Felder lädt.
- [ ] TDD, Commit `feat: Beschriftung und Farbe je Case-Stück`

### Task 4: Packer auf Stücke umstellen + Tipprichtung

**Files:** `js/model/geometry.js`, `js/model/packer.js`, `js/model/actions.js`,
`tests/packer.test.js`, `tests/geometry.test.js`

**4a – Stück-Identität erhalten.** `autoPack(items, truck, …)` bekommt statt einer Case-Liste
Objekte `{ id, caseId, c, label, color }`. `buildStacks`/`placeStacks` tragen das Objekt mit;
die erzeugten Placements übernehmen **`id`, `label`, `color`** des Stücks statt `newId()`.
`packAll`/`packRest` in `actions.js` übergeben entsprechend `plan.placements` und
`plan.unplaced` (jeweils mit aufgelöstem Case); `unplaced` behält seine Einträge.
Das behebt nebenbei den Altfehler, dass „Alles neu packen“ heute alle Stück-IDs neu vergibt.

**4b – Rollenrichtung.** In `geometry.js`:
```js
export const WHEEL_FACES = ['+x', '+y', '-x', '-y'];   // +x = Trucktür/Heck
export const DOOR_FACE = '+x';
// Rotation, die für diese Ausrichtung die gewünschte Rollenseite erzeugt (null = unmöglich)
export function rotForWheelFace(orientation, face) { … }   // Umkehrung von wheelFace()
```
Physikalisch erreichbar sind je Ausrichtung nur zwei der vier Richtungen ohne Wechsel der
Grundfläche; die anderen zwei drehen das Case zusätzlich um 90° im Grundriss. Das ist so
gewollt und wird im Inspector nicht versteckt.

- `actions.cycleTip`: beim Wechsel von `standing` auf eine getippte Lage wird `rot` so gesetzt,
  dass die Rollen zur Tür zeigen (`rotForWheelFace(next, DOOR_FACE)`).
- Neue Aktion `setWheelFace(plan, id, face, ctx)` – setzt `rot` passend und lässt das Case
  danach wieder absetzen (`settle`).
- `packer.chooseOrientation`: Kandidaten über alle vier `rot`-Werte; bei gleichem Score gewinnt
  zuerst `standing`, dann die Variante mit Rollen zur Tür, dann `rot === 0`.
- Tests: `rotForWheelFace` ist die exakte Umkehrung von `wheelFace` für alle 3×4 Kombinationen;
  `cycleTip` auf ein tippbares Case → `wheelFace === '+x'`; `setWheelFace` auf '-y' erreicht die
  Richtung; Auto-Beladung tippt mit Rollen zur Tür; **Regression:** Labels überleben
  `packAll` und `packRest`.
- [ ] TDD, Commit `feat: Rollen zur Trucktür tippen, Packer erhält Stück-Daten`

### Task 5: Load-Wizard

**Files:** `js/ui/load-wizard.js` (neu), `js/app.js`, `index.html`, `css/app.css`

Ein `<dialog id="dlg-wizard">` mit drei Schritten, gesteuert von `openLoadWizard(dlg, opts)`,
das ein Ergebnis `{ name, truckId, items: [{ caseId, label, color }] , autoPack: boolean }`
auflöst (oder `null` bei Abbruch). Das Modul kennt nur Daten, keine Store-Internas.

- **Schritt 1 „Load“:** Name (vorbelegt „Load <Datum>“), Fahrzeug-Auswahl. Wird übersprungen,
  wenn der Wizard aus einem bestehenden Plan heraus geöffnet wird (`opts.mode === 'add'`).
- **Schritt 2 „Cases wählen“:** Suchfeld + Gewerkfilter (gleiche Logik wie `library.js`), Liste
  aller Cases mit Stepper `−  [Anzahl]  +`. Kopfzeile rechnet live „12 Stück · 1.240 kg“.
  Zwei Knöpfe: „+ Neues Case“ (öffnet den Case-Editor, danach steht das Case mit Anzahl 1 in
  der Liste) und „⬛ Sonderbau“ (Case-Editor vorbelegt: Gewerk „Sonderbau“, Maß ohne Rollen,
  „mit Rollen“ an – damit greift direkt das 216-cm-Beispiel des Nutzers).
- **Schritt 3 „Beschriften & Farben“:** je Case-Typ eine Gruppe, darin pro Stück eine Zeile mit
  Textfeld (vorbelegt „<Name> <n>“) und Farbfeld (vorbelegt Gewerkfarbe). Je Gruppe ein Knopf
  „Farbe auf alle übernehmen“. Häkchen unten: „danach automatisch packen“ (Vorgabe an).
- Abschluss in `app.js`: Plan anlegen bzw. erweitern, `addUnplaced` je Stück mit Label/Farbe,
  danach optional `packRest`. Alles in **einem** Undo-Schritt.
- Einstiege: `#plan-new` öffnet den Wizard (ersetzt das `prompt()`); neuer Knopf
  „+ Cases hinzufügen“ in der Seitenleiste öffnet ihn im Modus `add`; das „+“ an einer
  Bibliothekszeile öffnet ihn im Modus `add` mit genau diesem Case auf Anzahl 1
  (ersetzt das zweite `prompt()`).
- Grenzen: max. 500 Stück je Wizard-Durchlauf, Labels über `esc()` ausgegeben.
- [ ] `node --check`, `npm test`, Commit `feat: Wizard zum Zusammenstellen eines Loads`

### Task 6: Beschriftung in 2D, Inspector, Ablage und Druck

**Files:** `js/ui/view2d.js`, `js/ui/caseStyle.js`, `js/ui/inspector.js`, `js/ui/library.js`,
`js/ui/print.js`, `css/app.css`

- `caseStyle.caseColors(c, mode, itemColor)` – ein gesetztes Stück-`color` schlägt die
  Gewerkfarbe (im Modus „Gewerk“ die Korpusfarbe, im Modus „Schwarz“ der Farbstreifen).
- `view2d`: statt nur der Ladenummer wird die Beschriftung mittig auf die Korpusfläche gesetzt
  (alle drei Ansichten), Ladenummer klein oben links. Schriftgröße aus der kleineren
  Rechteckseite abgeleitet, auf 6–16 cm begrenzt; bei zu wenig Platz wird die Beschriftung mit
  „…“ gekürzt, `<title>` enthält immer den vollen Text.
- `inspector`: Überschrift zeigt die Beschriftung; neue Felder „Beschriftung“ (Textfeld) und
  „Farbe“ direkt bearbeitbar → `setItemLabel`. Neue Knopfreihe „Rollen zeigen nach:
  Tür / Front / links / rechts“ (aktive Richtung markiert, unmögliche gesperrt), nur bei
  getippten Cases. Taste `W` schaltet die Rollenrichtung weiter; Hinweiszeile ergänzen.
- `library`: Ablage gruppiert weiterhin nach Case-Typ, zeigt aber die Beschriftungen der
  Stücke als Untertitel.
- `print`: neue Spalte „Beschriftung“ vor „Case“; die Ansichten übernehmen die Labels
  automatisch über `renderView`.
- [ ] `node --check`, `npm test`, Commit `feat: Beschriftung in 2D, Inspector und Druck`

### Task 7: Beschriftung in 3D auf allen Seiten

**Files:** `js/ui/view3d.js`, `js/ui/labelTexture.js` (neu), `tests/labelTexture.test.js`

- `labelTexture.js`: reine Hilfsfunktionen, ohne Three.js-Import –
  `labelPlanes(box, face)` liefert Position/Größe/Ausrichtung der fünf Beschriftungsflächen
  (vier Seiten + Deckel) mit 0,5 cm Abstand vor der Korpusfläche, und `fitFontSize(text, w, h)`
  bestimmt Schriftgröße und Umbruch. Beides ist testbar, ohne WebGL zu starten.
- `view3d.js`: pro einzigartiger Kombination `label|farbe` eine Canvas-Textur erzeugen und in
  einer `Map` cachen (Cache beim Update aufräumen, Texturen `dispose()`n). Je Case fünf
  `PlaneGeometry`-Flächen mit dieser Textur; Text steht immer waagerecht lesbar.
- Traversenwagen bekommen die Beschriftung nur auf die beiden Wagenenden.
- Tests: `labelPlanes` liefert 5 Flächen innerhalb der Box, keine schneidet den Korpus;
  `fitFontSize` bricht einen langen Text um und bleibt in der Fläche.
- [ ] TDD, `node --check`, Commit `feat: Beschriftung auf allen Case-Seiten in 3D`

### Task 8: Version 0.4.0, Prüfung, Veröffentlichung

**Files:** `js/version.js`, `package.json`, `README.md`, `index.html`, `sw.js`, `CHANGELOG.md`

- Version `0.4.0` an allen Stellen (der Test erzwingt Gleichstand), `sw.js`-Cachename und
  ASSETS um `js/ui/load-wizard.js` und `js/ui/labelTexture.js` ergänzen
  (`tests/pwa.test.js` prüft die Liste), CHANGELOG-Eintrag auf Deutsch.
- README: Abschnitt „Neuen Load anlegen“ mit dem Wizard-Ablauf.
- Browser-Prüfung mit dem vorhandenen CDP-Treiber im Scratchpad
  (`cdp.mjs` + Szenario-Skript, siehe Verifikation).
- Merge nach `main`, Tag `v0.4.0`, push, Live-Check auf
  https://m4dm0nky.github.io/Truckload/.
- [ ] Commit `chore: Version 0.4.0`, danach `superpowers:finishing-a-development-branch`

---

## Verifikation

**Automatisch (`npm test`):** Rollenmaß (216-cm-Beispiel, alle drei Rollen-Varianten,
Altdaten-Regression), Stück-Felder in Aktionen und Import, `rotForWheelFace` als Umkehrung von
`wheelFace`, Tippen mit Rollen zur Tür, Labels überleben `packAll`/`packRest`,
`labelPlanes`/`fitFontSize`, Versions-Gleichstand, Offline-Liste.

**Im Browser (headless Chrome über `cdp.mjs`), ein Durchlauf als Nutzer:**
1. „Neuer Ladeplan“ → Wizard: Name, Sattelzug, 6× Kabelcase, 2× Rack, 1× Traversenwagen,
   ein Sonderbau 200 × 80 × 200 cm mit Rollen → prüfen, dass das Sonderbau-Case **216 cm**
   hoch im Truck steht.
2. Schritt 3: Beschriftungen sind „Kabelcase 1 … 6“ vorbelegt, eine Zeile überschreiben,
   Gruppenfarbe setzen → Screenshot.
3. „Fertig“ mit automatischem Packen → keine Warnung außer ggf. „einseitig“; Screenshots
   Draufsicht / Seite / Heck: Beschriftungen auf jeder Fläche lesbar.
4. Ein Case tippen → Rollen zeigen zur Tür (Heck, rechts im Bild); über die Inspector-Knöpfe
   auf „links“ drehen und zurück; 3D-Ansicht: Beschriftung auf allen vier Seiten und dem Deckel.
5. „Alles neu packen“ → Beschriftungen und Farben sind unverändert (der Altfehler mit neuen IDs).
6. Druck-Ansicht: Spalte „Beschriftung“ gefüllt.
7. Export → Import in einen leeren Zustand → Labels, Farben und Rollenmaße kommen zurück.
