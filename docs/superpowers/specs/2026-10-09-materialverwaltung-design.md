# Materialverwaltung – Design (V 0.12.5)

Stand 2026-10-09, mit dem Nutzer abgestimmt (Fragen und Antworten im Abschnitt „Context“).

## Context

Eigene Cases, Dolly-Stacks und Traversenwagen liegen heute gemischt im Katalog des Lade-Wizards
(`js/ui/load-wizard.js`), zusammen mit dem Standardkatalog (`js/data/preset-cases.js`) und den
Firmenlisten aus der Excel-Tabelle (`js/data/case-library.js`: CAB 95, BBM 13, Motion 6, RentAll 4,
Jäger 2, Kraftklub 1, AED 1). Es gibt keine eigene Oberfläche, um diese Firmen zu pflegen, und
Firmen-Cases lassen sich nicht sauber bearbeiten: der Case-Editor setzt beim Speichern
`company: undefined` (`js/ui/case-editor.js` ~Z. 298), und `isPreset()` in `js/store/io.js:22`
wirft beim Import jede `lib-`-ID weg – eine bearbeitete CAB-Zeile ginge also bei Sicherung/Import
verloren.

Ziel (Nutzerangaben 2026-10-09):
- Eigener Bereich **„Material“**: Firmen ansehen, weitere Firmen anlegen, darin Cases,
  Boxen-Dollys und Traversenwagen anlegen/bearbeiten/löschen.
- Die vorhandenen Firmen bleiben, wie sie sind, und werden darin **editierbar**.
- **Standardkatalog** nur lesen; „In Firma kopieren“ für Abwandlungen.
- **Nur Katalog**, kein Bestand/keine Stückzahlprüfung.
- Im neuen Load wählt man, ob man **in einer Firma** oder im **kompletten Bestand** sucht.

Pfad: architektonisch (neuer Bereich). Ablauf laut CLAUDE.md: Spec → `superpowers:writing-plans`
→ `superpowers:subagent-driven-development`.

## Datenmodell (keine neue IndexedDB-Tabelle, kein DB_VERSION-Sprung)

- **Firma = `company`-String am Case**, wie heute. Firmenliste = `companiesOf()`
  (`js/ui/caseGroups.js`). Eine neu angelegte, noch leere Firma lebt nur im UI-Zustand der
  Materialseite, bis ihr erstes Case gespeichert ist (eigene Entscheidung: spart einen eigenen
  Store; leere Firmen haben keinen Nutzen).
- **Firmen-Case bearbeiten** = eigenes Case mit **derselben `lib-`-ID** speichern; das gibt es schon
  (`mergeOwnWithBuiltins`, `js/store/repo.js:21`), eigene Version gewinnt. Pläne verweisen weiter
  per `caseId`, laden also unverändert.
- **Firmen-Case löschen**: bei eigenem Case wie heute `repo.deleteCase`. Bei einer `lib-`-Vorlage
  eine eigene Überlagerung mit `legacy: true` speichern → verschwindet aus jeder Auswahl (bestehende
  `legacy`-Semantik, `groupCases`), alte Ladepläne behalten das Stück.
- **Firma umbenennen**: alle Cases der Firma mit neuem `company` speichern (für `lib-`-Einträge
  entstehen dabei Überlagerungen). **Firma löschen**: nur wenn leer oder nach Rückfrage alle ihre
  Cases löschen (wie oben).
- **Case-Editor**: bekommt ein Feld „Firma“ (Auswahl aus vorhandenen Firmen + „Standard/keine“),
  behält `company` statt es zu leeren; `source: 'liste'` bleibt bei bearbeiteten `lib-`-Einträgen
  erhalten, damit sie in derselben Gruppe bleiben.
- **Import/Export** (`js/store/io.js`): `isPreset()` filtert `lib-`-IDs nur noch, wenn der
  Datensatz `builtin: true` trägt; eigene Überlagerungen (`builtin: false`, `lib-`-ID) laufen durch
  Sicherung und Import. `preset-`-IDs bleiben geschützt (Standardkatalog ist nur lesbar).
- **Dolly-Stacks je Firma**: `dollyStackId(base, n, company?)` → `dolly-<firma>-<basis>-<n>`, wenn
  eine Firma gesetzt ist (Wagenmaße sind firmenabhängig, V 0.12.3); ohne Firma unverändert.
  `upgradeDollyStack`-Regex um die Firmenform erweitern. Traversenwagen tragen `company` einfach mit
  (IDs sind dort schon UUIDs).
- Regressionstests mit Datensätzen im alten Schema (CLAUDE.md): lib-Überlagerung ohne neue Felder,
  Dolly-ID alt, Bundle ohne `company`.

## Oberfläche

**Einstieg**: Knopf „Material“ auf dem Startbildschirm (`renderStartScreen`, `js/app.js:137`) und
in der Kopfleiste. Eigene Ansicht wie der Startbildschirm (neue `<section id="material-screen">`
in `index.html`, Umschaltung analog `startScreenEl`/`headerEl`/`layoutEl`).

**Aufbau** (neues Modul `js/ui/material.js`):
- Links: Liste „Standardkatalog“, dann alle Firmen alphabetisch mit Anzahl, unten „+ Firma“.
- Rechts für die gewählte Firma: Reiter Cases / Traversen / Sonderbau (`CASE_TABS`,
  `caseKind`), Suche + Gewerk-Filter (`groupCases`), Zeilen mit Maßen (`caseLine`-Logik aus
  `load-wizard.js` herauslösen und teilen), je Zeile „Bearbeiten“ / „Löschen“.
- Knöpfe je Firma: „+ Neues Case“ (`openCaseEditor`, Firma vorbelegt), „+ Traverse“
  (`openTrussDialog`), „+ Boxen-Dolly“ (Basisbox aus den `dollyPrompt`-Vorlagen wählen →
  `openDollyDialog`), „Firma umbenennen“, „Firma löschen“.
- Standardkatalog: nur Ansicht, je Zeile „In Firma kopieren …“ (neue UUID, `builtin: false`,
  gewählte Firma).
- Alle Namen über `esc()` (Firmennamen kommen aus Importdateien).

**Lade-Wizard**: der Firmenfilter `wiz-filter-company` wird zur Wahl „Suchen in“:
„Standardkatalog“ (heutiges `NEUTRAL_COMPANY`, bleibt Vorgabe – Nutzerwunsch 2026-10-06, keine
Firmen-Cases von selbst), „Kompletter Bestand“ (heutiges „Alle Firmen“), dann je Firma
„nur <Firma>“. Neue Cases/Dollys/Traversen, die im Wizard angelegt werden, bekommen die gewählte
Firma. Die Bearbeiten-Funktionen bleiben in der Materialseite; der Wizard verlinkt nicht dorthin
(eigene Entscheidung, hält den Wizard schlank).

## Kritische Dateien

- neu: `js/ui/material.js`, `tests/material.test.js` (reine Logik: Firmenliste, Umbenennen,
  Löschen-als-legacy, Kopieren), Spec `docs/superpowers/specs/2026-10-09-materialverwaltung-design.md`
- `js/app.js` (Ansicht umschalten, Speichern/Löschen-Pfade wiederverwenden: `saveCaseValue`,
  `deleteCaseDirect`, `usage`), `index.html`, `css/app.css`
- `js/ui/case-editor.js` (Feld Firma, `company`/`source` behalten)
- `js/store/io.js` (`isPreset`), `js/model/audioDolly.js` (ID mit Firma), `js/ui/dolly-wizard.js`,
  `js/ui/truss-wizard.js` (Firma durchreichen), `js/ui/load-wizard.js` + `js/ui/caseGroups.js`
  (Beschriftung „Suchen in“)
- `sw.js` (neue Datei in die Offline-Liste, `tests/pwa.test.js`), Version 0.12.5 (Patch, vorher
  bestätigen), CHANGELOG, README, `docs/architektur.md`

## Verifikation

- `npm test`, TDD für die reine Logik (Firmenliste, Umbenennen, legacy-Löschen, Kopieren,
  `isPreset`, Dolly-ID mit Firma, Altdaten-Regressionen).
- Browser über `tools/cdp.mjs`: Materialseite öffnen, Firma „Test“ anlegen, Case + Dolly +
  Traverse darin anlegen, CAB-Case bearbeiten und löschen, Sicherung exportieren/importieren und
  prüfen, dass die Änderungen bleiben; neuen Load anlegen, „nur Test“ wählen → nur deren Material.
  Screenshots der Materialseite.
- Danach `superpowers:finishing-a-development-branch`, Versionsnummer bestätigen lassen,
  committen, pushen, Pages prüfen.
