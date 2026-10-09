# Aufräumen Phase D – Struktur der Oberfläche (V 0.13.8)

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use `- [ ]`.

**Goal:** UI-Module hängen nicht mehr über Kreuz voneinander ab (Materialseite → Wizard,
Traversen-Dialog → Case-Editor). Gemeinsame Helfer haben einen eigenen Ort. Die beiden großen
Dateien (`load-wizard.js` 580, `view3d.js` 817 Zeilen) geben ihre reinen, testbaren Teile ab.
Sichtbares Verhalten bleibt gleich.

**Architecture:**
- Neue Module:
  - `js/ui/caseInfo.js`: Case-Zusammenfassungen und Traversen-Profilname.
  - `js/ui/wizard-items.js`: reine Wizard-Logik.
  - `js/ui/view3d-parts.js`: reine Bauteil-Geometrie, ohne Three.js-Objekte.
  - `js/ui/textMetrics.js`: Textbreiten-Schätzung.
- Kleine gemeinsame Helfer in bestehenden Modulen:
  - `showPick` in `confirmDialog.js`.
  - `caseIdAt`/`toSvg` in `view2d.js`, von `zoom2d.js` mitgenutzt.
- Wie in Phase C: alle Importe einschließlich der Tests direkt umstellen, keine Re-Exporte.

**Tech Stack:** ES-Module ohne Build, `node --test`, Browser-Probe mit `tools/cdp.mjs`.

**Spec:** `/Users/marcohoch/.claude/plans/ich-h-tte-gern-eine-stateful-melody.md`, „Phase D“;
Befunde I6–I9, M1–M10 aus dem UI-Review.

## Global Constraints

- Keine npm-Abhängigkeit, kein Build. Jede neue `js/`-Datei in `sw.js` ASSETS **und** als
  `modulepreload` in `index.html`, beide alphabetisch (geprüft von `tests/pwa.test.js`).
- **Kein sichtbares Verhalten ändern.** Jeder angezeigte Text bleibt an jeder Stelle zeichengleich.
  Vor dem Zusammenlegen der Formatierer wird der heutige Text je Aufrufstelle per Test
  festgehalten.
- Nutzerstrings in HTML nur über `esc()`. Deutsche Texte mit „…“ (schließend U+201C), „tippen“.
- Keine Re-Exporte. Importe in `js/` und `tests/` direkt umstellen.
- Commits enden mit `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`; nie `git add -f`.
- Version **0.13.8** (bestätigt) erst in Task 4.

## Review Focus

1. **Texte zeichengleich:** Seitenleiste, Wizard-Liste und Materialseite zeigen für
   Case, Traverse, Pre-Rig, Dolly-Stack und Sonderbau exakt dieselben Zeilen wie vor der Änderung.
   Snapshot-Tests in Task 1.
2. **3D sieht gleich aus:** Nach dem Herauslösen der Bauteil-Funktionen zeigt 3D Case,
   Lautsprecher-Stack und Traverse wie vorher. Screenshot-Vergleich vorher und nachher in Task 2.
3. **Dialoge doppelt öffnen:** Wizard, Pack-Regeln und Fahrzeug-Editor überstehen einen zweiten
   Aufruf, während einer offen ist, ohne doppelte Close-Listener (Task 3).

---

### Task 1: Gemeinsame Case-Texte und Konstanten (`caseInfo.js`)

**Files:** Create `js/ui/caseInfo.js`, `tests/caseInfo.test.js`. Modify `js/ui/load-wizard.js`
(`caseLine`), `js/ui/library.js` (`trussProfileLabel`, `trussLabel`, `caseDetail`),
`js/ui/material.js`, `js/ui/truss-wizard.js` (`QUICK_LENGTHS`, Profilname ~l.157),
`js/ui/case-editor.js` (`QUICK_LENGTHS`), Tests, `sw.js`, `index.html`.

- [ ] **Snapshot zuerst.** `tests/caseInfo.test.js` hält für typische Cases die heutigen Texte fest:
  - Normales Case, Case mit Firma, Traverse 34er 3 m mit `wagonW`, Pre-Rig (`standing`),
    Dolly-Stack (`kind: 'speaker'`, `unitH`), Sonderbau.
  - Je einmal die Ausgabe von `caseLine` (Wizard und Materialseite) und `caseDetail`
    (Seitenleiste).
  - Erwartungswerte aus dem **alten** Code erzeugen, z. B. per Node-Skript auf dem
    Ausgangsstand, und als Literale in den Test schreiben.
- [ ] **`js/ui/caseInfo.js`:**
  - `caseLine(c)` (bisher `load-wizard.js`), `caseDetail(c)` (bisher `library.js`, inklusive
    `trussLabel`), `trussProfileName(width)` und `QUICK_LENGTHS`.
  - Gleiche Logik, die bisher doppelt war, wird intern geteilt. Die Ausgaben bleiben zeichengleich
    zum Snapshot. Die bisher unterschiedlichen Zahlenformate (`toFixed(2).replace` vs.
    `toLocaleString`) bleiben je Aufrufstelle erhalten, wenn sie heute verschieden aussehen.
  - Im Report aufführen, wo sich die Formate unterscheiden, als mögliche spätere
    Vereinheitlichung. Nicht jetzt ändern.
- [ ] Alle Aufrufer umstellen. Danach importiert `material.js` nicht mehr `load-wizard.js` und
  `truss-wizard.js` nicht mehr `case-editor.js`.
- [ ] `npm test`; Commit `refactor: Case-Texte und Schnelllängen in caseInfo.js`.

### Task 2: Große Dateien entflechten

**Files:** Create `js/ui/wizard-items.js`, `js/ui/view3d-parts.js`, `js/ui/textMetrics.js`,
`tests/view3d-parts.test.js`. Modify `js/ui/load-wizard.js`, `js/ui/view3d.js`,
`js/ui/labelTexture.js`, `js/ui/view2d.js`, Tests (Importpfade), `sw.js`, `index.html`.

- [ ] **`wizard-items.js`:** die reinen Funktionen aus `load-wizard.js` (~l.10–110):
  `searchInOptionsHtml`, `stockDefaultFor`, `refreshWizardCases`, `capToRoom`,
  `reduceWizardItem`, `defaultWizardLayers`, `countWithoutLayer`, `setLayerForAll`,
  `setTippedForAll`, `bulkState`. `load-wizard.js` importiert sie, Tests ebenso.
- [ ] **`view3d-parts.js`:** reine Bauteil-Funktionen aus `view3d.js`, die nur Zahlen/Boxen liefern
  und keine Three-Objekte brauchen:
  - `edgeBars`, `latchBoxes`, `speakerUnits`, `speakerDollyFrame`, `speakerUnitParts`,
    `faceZigzag`, `trussPoint`, `textColorFor`.
  - `speakerUnitParts` liefert statt eines Materials einen **Material-Schlüssel**;
    `view3d.js` ordnet ihn zu.
  - Funktionen, die Konstanten oder Closures aus `createView3d` brauchen, bekommen diese als
    Parameter, oder die Konstanten ziehen mit um.
  - Neue Tests in `tests/view3d-parts.test.js`, je Funktion mindestens ein Fall mit
    nachgerechneten Werten.
  - **Vorher/Nachher-Screenshots** in 3D (Case, K2-Stack auf Dolly, 34er-Traverse, Pre-Rig) im
    eigenen kleinen Prüf-Fahrzeug, s. CLAUDE.md „Fallstrick 3D“, und vergleichen. Pixelgleich ist
    nicht nötig, aber sichtbar gleich.
- [ ] **`textMetrics.js`:** `estimateTextWidth` (und die Konstante dazu) aus `labelTexture.js`;
  `labelTexture.js` und `view2d.js` importieren von dort.
- [ ] `view3d.js` Kleinkram:
  - Temporäre Variable `bodyMesh` (~l.721) streichen.
  - `MAT_SEAM_BAND` = `MAT_ALU` zusammenlegen, wenn die Parameter wirklich gleich sind.
  - Eine Hilfsfunktion `edgeMaterial(selected, bad)` für das 4× wiederholte Ternary.
  - Eine Funktion `labelText(seq, label)` für den 3× gebauten Etikett-Text.
- [ ] `npm test`; Commit(s) `refactor: reine Wizard- und 3D-Bauteil-Logik in eigene Module`.

### Task 3: Kleine gemeinsame Helfer, Dialog-Schutz, Sicherheit

**Files:** `js/ui/confirmDialog.js`, `js/app.js` (`pickOption`), `js/ui/view2d.js`,
`js/ui/zoom2d.js`, `js/ui/load-wizard.js`, `js/ui/pack-rules.js`, `js/ui/truck-editor.js`,
`js/ui/dom.js`, `js/ui/print.js`, `js/ui/inspector.js`, `js/ui/case-editor.js`,
`js/ui/dolly-wizard.js`, `css/app.css`.

- [ ] **`showPick(title, options)`** nach `confirmDialog.js` (aus `app.js` `pickOption`, mit
  `returnValue`-Reset und `esc()`). `app.js` nutzt es. Bestehender `#dlg-pick` bleibt.
- [ ] **`caseIdAt(e)`** (`e.target.closest('g.case')?.dataset.id ?? null`) in `view2d.js`
  exportieren. `zoom2d.js` nutzt es für seine zwei Stellen.
  - Die doppelte `toSvg` (`view2d.js` ~l.241, `zoom2d.js` ~l.61) auf eine zusammenführen,
    wenn die Signaturen vereinbar sind. Sonst im Report begründen.
  - `drop` (`view2d.js` ~l.285): `JSON.parse` in `try/catch`.
- [ ] **„Schon offen“-Schutz** wie in `case-editor.js`
  (`if (dlg.open) { dlg.returnValue = 'cancel'; dlg.close(); }`) in `load-wizard.js`,
  `pack-rules.js` und `truck-editor.js`. Beim Wizard prüfen, dass der Material-Ausflug
  (`suspended`) dadurch nicht stört.
- [ ] **`safeColor(c)`** in `dom.js` (gleiche Prüfung wie `SWATCH_COLOR_RE`, sonst Fallback
  `#888`), verwendet in `view2d.js` (`style: --mark:` ~l.91, `fill`/`stroke`) und `print.js`.
  Test in `tests/dom.test.js`.
- [ ] **Escaping einheitlich:** `esc()` auch an den heute unkritischen Stellen:
  `case-editor.js` (~l.49 `k.name`, ~l.64 `p.name`), `inspector.js` (~l.61 `weight`),
  `print.js` (~l.58 `weight`), `dolly-wizard.js` (~l.52 `base.l`).
- [ ] **Barrierefreiheit klein:**
  - `aria-label` an Knöpfen, die nur „−“, „+“, „×“, „↑“ oder „↓“ zeigen (`load-wizard.js`,
    `pack-rules.js`).
  - Ein `:focus-visible`-Stil in `css/app.css` (Rahmen in `--accent`).
  - Die Textfarbe auf Akzentflächen als Variable `--on-accent` statt 6× `#111`.
  - Toten Selektor `.start-plan-item small` entfernen.
- [ ] Browser-Probe:
  - Wizard (Stückzahl-Knöpfe, Material-Ausflug), Pack-Regeln öffnen.
  - Fahrzeug bearbeiten, und das zweimal hintereinander.
  - In der Materialseite kopieren (Auswahl-Dialog, Escape → nichts passiert).
  - 2D-Klick, Drag aus der Ablage.
- [ ] `npm test`; Commit `refactor: gemeinsame UI-Helfer, Dialog-Schutz, einheitliches Escaping`.

### Task 4: Version 0.13.8

- [ ] Version an allen sechs Stellen auf 0.13.8. CHANGELOG kurz: „Intern aufgeräumt: Oberflächen-
  Module hängen nicht mehr über Kreuz voneinander ab; kleinere Verbesserungen für die Bedienung
  per Tastatur (sichtbarer Fokus, Beschriftungen für Symbolknöpfe).“ `npm test`. Commit
  `chore: Version 0.13.8 – Aufräumen Phase D`.
