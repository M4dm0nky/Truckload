# Aufräumen Phase C – Struktur der Logik (V 0.13.7)

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use `- [ ]`.

**Goal:** Jede Regel und jeder Grenzwert der Logik steht an genau einer Stelle. Eine Änderung
(neues Stückfeld, anderer Grenzwert) betrifft dann eine Datei statt sieben. Das Verhalten bleibt
gleich.

**Architecture:**
- Neue kleine Module: `js/model/limits.js` (Grenzwerte), `js/model/items.js`
  (Item-Modell/Ansichtshilfen), `js/model/pieceFields.js` (Stückfelder) und `js/model/slug.js`.
- `archBoxes`/`ARCH_SIDES` ziehen nach `geometry.js`, `PACK_ORDERS` nach `packRules.js`.
- `state.js` zieht nach `js/store/`.
- Tote Pfade werden entfernt.
- Alle Importe einschließlich der Tests werden direkt umgestellt. Keine Re-Exporte, keine
  Übergangsschicht. Eigene Entscheidung: Das Repo hat keine externen Nutzer, also wäre eine
  Übergangsschicht nur toter Code.

**Tech Stack:** ES-Module ohne Build, `node --test`.

**Spec:** `/Users/marcohoch/.claude/plans/ich-h-tte-gern-eine-stateful-melody.md`, „Phase C“;
Befunde I2–I6, M5–M8, M10 aus dem Logik-Review.

## Global Constraints

- Keine npm-Abhängigkeit, kein Build. Jede neue `js/`-Datei in `sw.js` ASSETS **und** als
  `modulepreload` in `index.html`. Gelöschte/verschobene Dateien dort entfernen. Beides prüft
  `tests/pwa.test.js`.
- **Kein Verhalten ändern**, einzige Ausnahme Task 3d (fehlendes `rot`). Alle bestehenden Tests
  bleiben inhaltlich gleich. Nur Importpfade dürfen angepasst werden. Tests, die tote
  Funktionen prüfen, fallen mit diesen weg.
- `model/` importiert nie `ui/` oder `store/`. Neue Zyklen sind verboten (Kontrolle:
  `node -e` mit dynamischem Import aller Module oder einfach `npm test`).
- Alte gespeicherte Daten laden weiter; Regressionstest im alten Schema für 3d.
- Commits enden mit `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`; nie `git add -f`.
- Version **0.13.7** (bestätigt) erst in Task 4.

## Review Focus

1. **Grenzwerte identisch:** Jede Zahl in `limits.js` entspricht exakt dem bisherigen Literal an
   jeder Stelle (`io.js`, `validate.js`, `material.js`, `truss.js`, `case-editor.js`). Bisher
   unterschiedliche Werte werden **nicht** stillschweigend vereinheitlicht, sondern im Report
   gemeldet.
2. **Stückfelder:** Nach der Umstellung auf `pickPieceFields` übernimmt jede der sieben Stellen
   dieselben Felder wie vorher. Die Unterschiede, z. B. dass `addUnplaced` die Beschriftung kürzt,
   bleiben erhalten.
3. **Packer ohne String-Regeln:** Alte Pläne mit `packOrder` (String) packen genauso wie vorher.
   Test mit altem Schema.
4. **canTip:** Ein importiertes Traversen-Case mit fälschlich `tippable: true` wird nirgends
   getippt (Packer, Orientierungen, Validierung).

---

### Task 1: Grenzwerte und Zuständigkeiten

**Files:**
- Create: `js/model/limits.js`, `js/model/items.js`, `tests/limits.test.js`.
- Modify: `js/model/validate.js`, `js/model/geometry.js`, `js/model/packer.js`,
  `js/model/packRules.js`, `js/model/material.js`, `js/model/truss.js`,
  `js/model/audioDolly.js`, `js/model/actions.js`, `js/store/io.js`, `js/ui/*` (Importe),
  `sw.js`, `index.html`, Tests (Importpfade).

- [ ] **`js/model/limits.js`**: alle Grenzwerte als benannte Konstanten.
  - Aus `validate.js`: `CASE_LIMITS`.
  - Aus `geometry.js`: `MAX_LABEL`.
  - Aus `material.js`: `MAX_FIRM`.
  - Traversen-Grenzen aus `io.js` (~l.55–62): Länge 1–1000, Breite ≤ 40 klassisch bzw. ≤ 200
    stehend, Stückzahl 1–12, `wagonW` ≤ 200. Benennung z. B. `TRUSS_LIMITS = { length: 1000,
    width: 40, standingWidth: 200, count: 12, wagonW: 200 }`.
  - Firmenname-Länge in `io.js` (`company.length <= 80`) nutzt `MAX_FIRM`, ebenso
    `io.js:~144` (`name.length > 80`), falls das dieselbe Bedeutung hat. Sonst eine eigene
    benannte Konstante und im Report erklären.
  - `MAX_TRUSS_WIDTH` in `truss.js` bleibt die abgeleitete Konstante. `TRUSS_LIMITS.width`
    muss ihr entsprechen; Test.
- [ ] **`layersValid(l)`** in `limits.js` (nicht leer, eindeutig, ganze Zahlen 1–4) ersetzt die drei
  Kopien in `io.js` (~l.38–40, ~l.111–113) und `actions.js` (`isValidLayers`, ~l.230). Tests für
  gültig/leer/doppelt/0/5/1.5.
- [ ] **`js/model/items.js`**: `buildItems` und `aboveLayer` aus `validate.js` hierher.
  `validate.js` importiert `buildItems` von dort.
- [ ] **`archBoxes` und `ARCH_SIDES`** nach `geometry.js`; **`PACK_ORDERS`** nach `packRules.js`.
  `io.js` importiert nicht mehr `packer.js`.
- [ ] Alle Importe in `js/` **und** `tests/` umstellen. Stale Kommentare „nicht mehr exportiert
  (docs/code-review…)“ an den betroffenen Stellen streichen. Neue Dateien in `sw.js` und
  `index.html` eintragen.
- [ ] Modul-Karte im Report: wer importiert was. Keine Kante `model → store/ui`, kein Zyklus.
- [ ] `npm test`; Commit `refactor: Grenzwerte in limits.js, Item-Modell in items.js, klare Zuständigkeiten`.

### Task 2: Stückfelder an einer Stelle

**Files:** Create `js/model/pieceFields.js`, `tests/pieceFields.test.js`. Modify
`js/model/actions.js` (`addUnplaced`, `placeCase`, `duplicate`, `placementToUnplaced`,
`toPiece`), `js/model/packer.js` (`autoPack`), `js/model/items.js` (`buildItems`), `sw.js`,
`index.html`.

- [ ] **Bestandsaufnahme zuerst:** Für jede der 7 Stellen im Report notieren, welche Felder sie
  heute übernimmt und wie (z. B. Label gekürzt oder nicht, `group` getrimmt oder nicht).
- [ ] **`js/model/pieceFields.js`:**
  `export const PIECE_FIELDS = ['label', 'color', 'layers', 'tipped', 'group'];` und
  `export function pickPieceFields(src)`. Die Funktion liefert nur die vorhandenen, nicht
  `undefined`-Felder, damit alte Daten ohne diese Felder unverändert bleiben (keine
  `layers: undefined`-Schlüssel neu erzeugen). Tests zuerst.
- [ ] Die 7 Stellen auf `pickPieceFields` umstellen. Abweichungen (Kürzung, Trim, Vorgaben)
  bleiben **an der jeweiligen Stelle** als Nachbearbeitung erhalten. Verhalten identisch.
- [ ] Neuer Test: ein Stück mit allen Feldern übersteht `placeCase` → `placementToUnplaced` →
  `packAll` (`autoPack`) → `duplicate` → `unloadAll` ohne Feldverlust.
- [ ] `docs/architektur.md`: Die Aufzählung der Kopierstellen (~l.62–66) durch einen Satz zu
  `PIECE_FIELDS` ersetzen.
- [ ] `npm test`; Commit `refactor: Stückfelder an einer Stelle (PIECE_FIELDS)`.

### Task 3: Tote Pfade, eine Tipp-Regel, Kleinkram

**Files:** `js/model/actions.js`, `js/model/packer.js`, `js/model/packRules.js`,
`js/model/geometry.js`, `js/model/truss.js`, `js/model/validate.js`, `js/model/audioDolly.js`,
`js/data/case-library.js`, `js/store/io.js`, `js/store/autosave.js`, `js/state.js` →
`js/store/state.js`, `js/app.js` (Import), Tests, `sw.js`, `index.html`, `docs/architektur.md`.

- [ ] **3a Tote Pfade weg.**
  - `setPackOrder` (`actions.js` ~l.366) und seine Tests entfernen.
  - Im Packer: String-Regeln einmal am Eingang von `autoPack` in Regeln umwandeln. In
    `orderSorts`/`buildStacks` nur noch Regel-Arrays. Altdaten-Lesen (`legacyRules`/`rulesFor`
    für `plan.packOrder`) **bleibt**.
  - Packer-Tests, die die String-Form nutzen, auf Regeln umstellen. Dazu ein Test mit altem
    Plan (`packOrder: 'count'`, keine `packRules`), der dasselbe Ergebnis wie vorher liefert.
    Ergebnis vor der Änderung festhalten.
  - Ungenutzte Exporte prüfen (`grep` in `js/`):
    - `faceSlab`, `autosave.peek`, `markDirty`, die Re-Exporte `MAX_LABEL, CASE_LIMITS` in
      `io.js`, `MAX_RULE_VALUE`, `ruleKey`.
    - Nur in Tests genutzt: entweder entfernen, samt Test, falls die Funktion sonst nichts
      tut, oder Export behalten und im Report begründen.
    - Nur intern genutzt: Export entfernen.
- [ ] **3b Eine Tipp-Regel.**
  - `isTruss` und `canTip` nach `geometry.js`, damit kein Zyklus entsteht. `truss.js`
    importiert sie von dort und exportiert sie weiter, wenn `ui/` sie aus `truss.js` holt.
    Oder die UI-Importe umstellen; Entscheidung im Report.
  - `pieceOrientations` (`geometry.js` ~l.48) und `validate.js` (~l.112) nutzen `canTip`.
  - Die Verteidigungs-Kommentare (`truss.js` ~l.42–61, `validate.js` ~l.101–111, `packer.js`
    ~l.8–15) auf je 1–2 Zeilen kürzen.
  - Test: ein Traversen-Case mit `tippable: true` (importierte Altdaten) hat nur `standing` als
    Orientierung, wird vom Packer nicht getippt und erzeugt keine Validierungswarnung zum
    Tippen.
- [ ] **3c Kleine Umzüge.**
  - `slug` nach `js/model/slug.js`. `case-library.js` und `audioDolly.js` importieren von dort.
  - `js/state.js` nach `js/store/state.js`, Importe in `app.js` und Tests anpassen.
  - `docs/architektur.md`: `state.js` in der Schichtentabelle nennen.
- [ ] **3d Fehlendes `rot` (einzige Verhaltensänderung).** Eine Platzierung ohne `rot` aus
  einer sehr alten Version lädt, scheitert aber beim eigenen Export/Import (`io.js` ~l.130
  verlangt `rot`). Fix: In `placementOk` fehlendes `rot` als 0 gelten lassen bzw. vor der
  Prüfung `rot ?? 0` setzen. Regressionstest mit altem Datensatz (Platzierung ohne `rot`) →
  Import gelingt, `rot` wird 0.
- [ ] `npm test`; Commit(s) `refactor: tote Pfade entfernt, eine Tipp-Regel, slug/state verschoben`
  und `fix: Platzierungen ohne rot lassen sich wieder importieren`.

### Task 4: Version 0.13.7

- [ ] Version an allen sechs Stellen auf 0.13.7. CHANGELOG kurz in Nutzersprache: „Intern
  aufgeräumt: Grenzwerte und Regeln stehen jeweils an einer Stelle. Sehr alte Ladepläne ohne
  Drehwinkel lassen sich wieder sichern und einlesen.“ `npm test`. Commit
  `chore: Version 0.13.7 – Aufräumen Phase C`.
