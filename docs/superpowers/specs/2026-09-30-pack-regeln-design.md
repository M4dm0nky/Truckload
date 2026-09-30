# Pack-Regeln (Teil A) – Design

Stand 2026-09-30, vom Nutzer freigegeben (Plan-Freigabe im Chat). Umsetzungsplan: `docs/superpowers/plans/2026-09-30-pack-regeln.md`.

## Context

Heute gibt es beim automatischen Packen nur den Umschalter „Große zuerst“ / „Stückzahl zuerst“
(`plan.packOrder`, `orderSorts` in `js/model/packer.js`), Traversen stehen dabei fest zuletzt.
Der Nutzer will selbst bestimmen, in welcher Priorität die sortenreinen Blöcke von der Stirnwand
zur Tür kommen: Traversen zuerst/zuletzt, Motoren zuletzt, Große zuerst … – und dafür Stücke als
Gruppe ansprechen („die 20 Motorcases zum Schluss“).

Abgestimmt im Brainstorming (2026-09-30):
- Prioritätsmodell: **Rangliste von Regeln** – oberste entscheidet, bei Gleichstand die nächste.
- Ansprechbar: **eigener Gruppenname je Stück**, **Case-Typ**, **Gewerk** (dazu Traversen über `isTruss`).
  Keine automatische Motor-Erkennung.
- „zuerst“ = Stirnwand, „zuletzt“ = Tür.
- Extra: **Regelsets als Vorlage** speichern und in jedem Load übernehmen.
- Zerlegung: dieser Plan ist **Teil A** (nur Reihenfolge der Blöcke). **Teil B „Mischen erlaubt“**
  (schwer unten, leicht/klein oben, gemischte Stapel mit verschiedenen Grundflächen) folgt als
  eigene Spec – er wird später ein Schalter im selben Dialog.

`buildStacks`/`placeStacks` (Stapeln, Spurraster, Lücke der letzten Reihe) bleiben unverändert;
es ändert sich nur, welche Blöcke es gibt und in welcher Reihenfolge sie kommen.

## Design

### Datenmodell (alles optional, Altdaten laden unverändert)

- **Stück:** neues Feld `group?: string` (getrimmt, ≤ `MAX_LABEL`, leer = Feld fehlt).
- **Load:** neues Feld `packRules?: Rule[]` (höchstens 20). Fehlt es, gilt `legacyRules(plan.packOrder)`:
  - `'volume'`/fehlt → `[{by:'truss',pos:'last'}, {by:'volume'}, {by:'count'}]`
  - `'count'` → `[{by:'count'}, {by:'volume'}]`
  Das entspricht exakt den heutigen Komparatoren → gleiche Packergebnisse (Regressionstest).
  Sobald der Nutzer Regeln speichert, wird `packRules` geschrieben; `packOrder` bleibt liegen,
  wird aber nicht mehr gelesen, wenn `packRules` existiert.
- **Rule:** `{ by: 'truss'|'group'|'case'|'category', value?: string, pos: 'first'|'last' }`
  (Auswahlregel; `value` Pflicht außer bei `truss`) oder `{ by: 'volume' }` / `{ by: 'count' }`
  (Maßregel).
- **Regelset:** `{ id, name, rules, updatedAt }` in neuem IndexedDB-Store `ruleSets`
  (`js/store/db.js`: `DB_VERSION` 1 → 2, `STORES` ergänzt – `onupgradeneeded` legt fehlende Stores
  schon heute idempotent an). Kommt mit in „Sichern“/„Importieren“; Bundles ohne `ruleSets` gehen weiter.

### Reine Logik – neues Modul `js/model/packRules.js`

- `legacyRules(order)`, `rulesFor(plan)`, `normalizeRules(rules)` (verwirft Ungültiges),
  `ruleOk(rule)` (für den Import), `blockComparator(rules)`.
- `describeRule(rule, ctx)` liefert den deutschen Text („Gruppe „Motoren“: zuletzt (Tür)“,
  „Traversen: zuletzt (Tür)“, „Große zuerst“ …) – Nutzertext geht in der UI durch `esc()`.
- `moveRule(rules, i, delta)`, `removeRule(rules, i)`.
- Auswahlregel als Komparator: Rang = trifft zu ? (first → −1 : last → +1) : 0, aufsteigend.
  Maßregeln wie heute (`volumeOf` absteigend, Stückzahl absteigend). Letzter Tie-Break immer
  Name, dann Gruppe, dann `caseId` → deterministisch.

### Packer (`js/model/packer.js`)

- `orderSorts(itemList, rules)`: Block-Schlüssel = `caseId` + Gruppe (Stücke eines Typs mit
  unterschiedlichen Gruppen werden eigene Blöcke). Sortiert mit `blockComparator(rules)`.
  Ein String-Argument (`'volume'`/`'count'`) wird über `legacyRules` übersetzt → bestehende
  Tests und Aufrufer bleiben gültig. `PACK_ORDERS` bleibt für den Import alter Dateien.
- `buildStacks`/`autoPack`: Option `rules` statt `order` (beides akzeptiert); `autoPack` gibt
  `group` in die Placements weiter (wie `layers`/`tipped`).

### Aktionen (`js/model/actions.js`)

- `toPiece`, `autoPack`-Spread, `unloadAll`, `placementToUnplaced`, `duplicate`, `addUnplaced`
  nehmen `group` mit – überall dort, wo heute `tipped` mitwandert (per grep prüfen).
- Neu: `setPieceGroup(plan, id, group)` (trimmen, kürzen auf `MAX_LABEL`, leer entfernt),
  `setPackRules(plan, rules)` (normalisiert, unverändert → gleiche Referenz).
- `packAll`/`packRest` übergeben `rules: rulesFor(plan)`.

### Oberfläche

- **Werkzeugleiste** (`index.html`, `js/app.js`): `#pack-order`-Select wird zum Knopf
  „Pack-Regeln …“. Kein Store-Wissen im Dialog – Muster wie `openCaseEditor`.
- **Neuer Dialog `js/ui/pack-rules.js`** (`openPackRules({ rules, pieces, cases, ruleSets })` →
  `{ rules, repack, ruleSets }` oder `null`):
  - Liste der Regeln mit „↑“/„↓“ und „×“ (eigene Entscheidung: Knöpfe statt Ziehen – robuster,
    per Tastatur bedienbar).
  - „+ Regel“: Art (Traversen / Gruppe / Case-Typ / Gewerk / Große zuerst / Stückzahl zuerst),
    Wert-Auswahl aus dem aktuellen Load (vorhandene Gruppen, Case-Typen, Gewerke), Position
    „zuerst (Stirnwand)“ / „zuletzt (Tür)“. Regel auf etwas, das im Load fehlt: ausgegraut
    „(nicht in diesem Load)“, wirkt nicht.
  - Regelset: „Regelset übernehmen …“ (Auswahl), „Als Regelset speichern …“ (Name), „Regelset
    löschen“.
  - Knöpfe: „Abbrechen“, „Speichern“, „Speichern und neu packen“ (Vorgabe).
- **Wizard, Schritt „Beschriften“** (`js/ui/load-wizard.js`): je Stück Textfeld „Gruppe“ mit
  `<datalist>` der schon vergebenen Gruppen; in der Legende je Case-Typ „Gruppe auf alle
  übernehmen“ (wie „Farbe auf alle übernehmen“). `reduceWizardItem` nimmt `group` mit.
- **Inspector** (`js/ui/inspector.js`, `loadBlock`): Feld „Gruppe“ für platzierte und
  Ablage-Stücke → `A.setPieceGroup`.
- Seitenleiste/Liste: vorerst keine Änderung (eigene Entscheidung, YAGNI).

### Import/Export (`js/store/io.js`, `js/store/repo.js`)

- `checkPlan`: `packRules` optional, Array ≤ 20, jede Regel `ruleOk`, `value` ≤ `MAX_LABEL`;
  `group` wie `labelOk`. `packOrder`-Prüfung bleibt.
- `exportBundle`/`parseBundle`/`mergeImportedBundle`/`loadAll`: `ruleSets` wie Pläne
  (per ID, neuerer `updatedAt` gewinnt), fehlend = `[]`.

## Verifikation

- `npm test` grün, inkl. neuer Tests und `version`/`pwa`.
- Browser über `tools/cdp.mjs` (Server `python3 -m http.server 8766`): Szenario baut per
  `p.eval` einen Load im Sattelauflieger mit 20 × D8+ 1t (Gruppe „Motoren“), 8 × MLT TWO,
  12 × Packcase 120×60×60; Regeln [Gruppe Motoren zuletzt, Traversen zuerst, Große zuerst];
  „Speichern und neu packen“ → Draufsicht-Screenshot: MLTs an der Stirnwand, Motoren an der Tür.
  Dazu Screenshot des Dialogs, Regelset speichern → neuen Load anlegen → Regelset übernehmen.
- Alten Load (nur `packOrder: 'count'`) laden: Dialog zeigt [Stückzahl zuerst, Große zuerst],
  „Alles neu packen“ liefert dasselbe Ergebnis wie V 0.8.4.
