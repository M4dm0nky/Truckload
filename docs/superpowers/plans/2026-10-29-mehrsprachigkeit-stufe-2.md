# Mehrsprachigkeit Stufe 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aniflus Korrekturen aus dem Gegenlesen (Issue #42, Kommentar vom 2026-10-28) einarbeiten und Englisch für NYX per `sprachen.json` freischalten (V 0.21.1).

**Architecture:** Texte liegen in `js/i18n/en.js` (Schlüssel = deutscher Text). Plurale werden wie schon an anderen Stellen als Paar `n === 1 ? t('1 …') : t('{n} …', { n })` am Aufrufort gelöst. `sprachen.json` liegt im Wurzelverzeichnis und steht in der Asset-Liste von `sw.js`.

**Tech Stack:** ES-Module ohne Build, `node --test`.

**Spec:** `docs/superpowers/specs/2026-10-27-mehrsprachigkeit-design.md` (Abschnitt „`sprachen.json` und Veröffentlichung in zwei Stufen“, Glossar). Korrekturliste: Issue #42, Kommentar von Aniflu vom 2026-10-28.

## Global Constraints

- Keine npm-Abhängigkeiten, kein Build-Schritt.
- Neue Texte nur über `t()`, jeder deutsche Schlüssel braucht seinen englischen Eintrag in `js/i18n/en.js` (`tests/i18n.test.js` erzwingt das).
- Deutsch mit „…“, Englisch britisch mit typografischen Anführungszeichen “…” und Apostroph ’.
- Gespeicherte Daten werden nie übersetzt.
- Version überall gleich (`tests/version.test.js`), nur 0.21.1.

## Review Focus

1. Grenzwert `used === 1` / `n === 1`: genau bei 1 Singular, bei 2 Plural; je Aufrufort ein Test.
2. Entfernte alte Schlüssel (`Ladeplan/-plänen`, `Plan(e)`): kein Aufrufer darf sie noch benutzen, sonst erscheint auf Englisch der deutsche Text. Grep nach dem Umbau muss leer sein.
3. Deutsche Oberfläche ändert sich bei den Pluralen sichtbar (besser: „1 Ladeplan“, „2 Ladeplänen“); bestehende deutsche Testerwartungen entsprechend anpassen, nicht löschen.
4. `sprachen.json` muss gültiges JSON genau `["de","en"]` sein und offline verfügbar (Asset-Liste).
5. Keine anderen englischen Texte verändern als die gelisteten.

---

### Task 1: Plural-Paare statt „(s)“

**Files:**
- Modify: `js/ui/truck-editor.js:53`, `js/ui/case-editor.js:317`, `js/app/persistence.js:82,106,179,291`, `js/app/importExport.js:78`
- Modify: `js/i18n/en.js` (Einträge Zeilen 239, 264, 267, 270, 276 ersetzen)
- Test: `tests/app-importexport.test.js`, `tests/app-persistence.test.js`, neue Fälle in `tests/i18n-en-app.test.js` bzw. passender bestehender Datei

**Neue Schlüssel (deutsch → englisch), die alten fünf Schlüssel entfallen:**

| Deutsch | Englisch |
|---|---|
| „{name}“ wird in 1 Ladeplan verwendet. Trotzdem löschen? | “{name}” is used in 1 load plan. Delete anyway? |
| „{name}“ wird in {used} Ladeplänen verwendet. Trotzdem löschen? | “{name}” is used in {used} load plans. Delete anyway? |
| Es wird in 1 Ladeplan verwendet; die Stücke bleiben, ihre Maße ändern sich mit. | It is used in 1 load plan; the items stay, and their dimensions change with it. |
| Es wird in {used} Ladeplänen verwendet; die Stücke bleiben, ihre Maße ändern sich mit. | It is used in {used} load plans; the items stay, and their dimensions change with it. |
| Die Einträge werden in 1 Ladeplan verwendet. | The entries are used in 1 load plan. |
| Die Einträge werden in {used} Ladeplänen verwendet. | The entries are used in {used} load plans. |
| Fahrzeug gelöscht, aber 1 Plan konnte nicht aktualisiert werden: {detail}. Bitte prüfen und ggf. erneut speichern. | Truck deleted, but 1 plan could not be updated: {detail}. Please check and save again if necessary. |
| Fahrzeug gelöscht, aber {n} Pläne konnten nicht aktualisiert werden: {detail}. Bitte prüfen und ggf. erneut speichern. | Truck deleted, but {n} plans could not be updated: {detail}. Please check and save again if necessary. |
| Ladeplan „{plan}“: 1 Stück verweist auf ein Case, das weder in der Datei noch bekannt ist. | Load plan “{plan}”: 1 item refers to a case that is neither in the file nor known. |
| Ladeplan „{plan}“: {missing} Stück verweisen auf ein Case, das weder in der Datei noch bekannt ist. | Load plan “{plan}”: {missing} items refer to a case that is neither in the file nor known. |

- [ ] **Step 1:** Testerwartungen anpassen: `tests/app-importexport.test.js:128` erwartet „1 Stück verweist …“, Zeile 23 bleibt „2 Stück verweisen …“; `tests/app-persistence.test.js:179` erwartet „… aber 1 Plan konnte nicht aktualisiert werden: g. …“. Dazu je ein englischer Test (setLang('en')) für Singular und Plural an mindestens einem Löschdialog und der Importwarnung: erwartet „1 load plan“ bzw. „2 load plans“, kein „(s)“.
- [ ] **Step 2:** `npm test` – die angepassten Tests schlagen fehl.
- [ ] **Step 3:** Aufrufer auf Paare umstellen (`x === 1 ? t('…1…', {…}) : t('…{x}…', {…})`), `en.js` aktualisieren.
- [ ] **Step 4:** `npm test` grün; `grep -rn "Ladeplan/-plänen\|Plan(e)\|(s)" js` liefert keinen Treffer in diesen Texten.
- [ ] **Step 5:** Commit `fix(i18n): Plurale als Paare statt „(s)“ (#42)`.

### Task 2: Englische Formulierungen und Glossar

**Files:**
- Modify: `js/i18n/en.js` (nur Werte, keine Schlüssel)
- Modify: `docs/superpowers/specs/2026-10-27-mehrsprachigkeit-design.md` (Glossar)
- Test: `tests/i18n-en-ui.test.js:132`

**Neue Werte (Zeilennummern Stand V 0.21.0):**

| Zeile | Neu |
|---|---|
| 59 | Mouse wheel / trackpad: Automatic tells the wheel (zoom) apart from swiping (pan). Zoom or Pan forces one of the two; Ctrl or pinch always zooms. Click to switch. |
| 73 | “{name}” is not stable (less than {pct}% supported). |
| 79–82 | „The load is lopsided“ → „The load is unbalanced“, Rest unverändert |
| 89 | Collection name: max. {max} characters. |
| 94 | Max. {max} levels. |
| 119–122, 148, 149, 194 | „(at most {max} characters)“ → „(max. {max} characters)“ |
| 251 | Max. {max} collections. |
| 328 | Truss width max. 40 cm (60 cm or 80 cm dolly) |
| 340 | {name} (custom) |
| 344 | Your cases ({n}) |
| 394 | Loading metres |
| 426 | Adopt into library |
| 473 | Build a load plan |
| 529 | {lm} loading metres |
| 546 | Manufacturer’s figure |

Zeile 234 („each greater than 0 and at most {max}“) bleibt: Dort geht es um Maße, nicht um Zeichen, und „at most“ steht mitten im Satz (eigene Entscheidung).

Glossar: „Lademeter | Load metres“ → „Loading metres“, Hinweis „britisch (LDM), Aniflu“; neue Zeile „Ladung ist einseitig | The load is unbalanced“; Zeile „Übernehmen“ Hinweis ergänzen: „auch ‚In Bestand übernehmen‘“.

- [ ] **Step 1:** `tests/i18n-en-ui.test.js:132` auf `/loading metres/` ändern; zusätzlich einen Test, dass kein Wert in `EN` „lopsided“, „ %“ nach Ziffer/Platzhalter, „at most {max} characters“, „(s)“ oder ein gerades `'` enthält.
- [ ] **Step 2:** `npm test` – schlägt fehl.
- [ ] **Step 3:** Werte in `en.js` und Glossar ändern.
- [ ] **Step 4:** `npm test` grün.
- [ ] **Step 5:** Commit `fix(i18n): Englisch nach Gegenlesen durch Aniflu (#42)`.

### Task 3: `sprachen.json`, Doku, Version 0.21.1

**Files:**
- Create: `sprachen.json` mit Inhalt `["de","en"]` und Zeilenumbruch
- Modify: `sw.js` (Asset-Liste, Cache-Name), `js/version.js`, `package.json`, `README.md`, `index.html`, `CHANGELOG.md`
- Modify: `docs/nyx-host.md:74-75` (Stufe 2 ist da: NYX darf Englisch anbieten), `docs/architektur.md` (Abschnitt Sprache, falls `sprachen.json` dort als „folgt“ steht)
- Test: `tests/pwa.test.js`

- [ ] **Step 1:** Test in `tests/pwa.test.js`: `sprachen.json` ist gültiges JSON, `deepEqual(['de','en'])`, und steht in der Asset-Liste von `sw.js`.
- [ ] **Step 2:** `npm test` – schlägt fehl.
- [ ] **Step 3:** Datei anlegen, `sw.js`-Liste ergänzen, Doku nachziehen, Version auf 0.21.1 an allen Stellen, CHANGELOG-Eintrag (Korrekturen aus dem Gegenlesen, Plurale, `sprachen.json`).
- [ ] **Step 4:** `npm test` grün.
- [ ] **Step 5:** Commit `chore: Version 0.21.1 – Englisch freigeschaltet, Stufe 2 (#42)`.

### Abschluss (Hauptsitzung)

- Browser-Abnahme mit `tools/cdp.mjs` auf `?lang=en`: Löschdialog mit 1 und 2 Plänen, Statusleiste Lademeter, Materialknopf „Adopt into library“, `sprachen.json` abrufbar.
- Merge nach `main`, Push, Pages-Build abwarten, Abschlusskommentar in #42.
