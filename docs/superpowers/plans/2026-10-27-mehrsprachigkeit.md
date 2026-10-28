# Mehrsprachigkeit Deutsch/Englisch – Umsetzungsplan (Stufe 1)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mit `?lang=en` zeigt Truckload eine vollständig englische Oberfläche; ohne Parameter bleibt alles exakt wie heute.

**Architecture:** Ein Modul `js/i18n/i18n.js` bestimmt die Sprache einmal beim Laden und bietet `t(deutscherText, params)`, `num`, `date`, `trade`, `builtinNote`. Der deutsche Text ist der Schlüssel; `js/i18n/en.js` ist das einzige Wörterbuch. Ein statischer Sperr-Test (`tests/i18n.test.js`) misst den Fortschritt über eine Liste noch nicht umgestellter Dateien (`PENDING`), die jede Aufgabe verkleinert und die am Ende leer sein muss.

**Tech Stack:** Reine ES-Module, `node --test`, `tools/cdp.mjs` (headless Chrome). Keine Abhängigkeiten.

**Spec:** `docs/superpowers/specs/2026-10-27-mehrsprachigkeit-design.md` (vor jeder Aufgabe lesen; Glossar dort ist verbindlich).

## Global Constraints

- Keine npm-Abhängigkeit, kein Build-Schritt; `package.json` behält nur `npm test`.
- Deutsche Oberfläche bleibt Zeichen für Zeichen gleich; bestehende Tests werden **nicht** angepasst (Ausnahme: Tests, die bewusst auf neue Kennungen statt Texte umgestellt werden, mit Begründung im Commit).
- Gespeicherte Daten bleiben sprachfrei (Gewerke deutsch, `MEINE_NAME` deutsch, Store-/Feldnamen unverändert).
- Ganze Sätze in `t()`, nie Bruchstücke; Parameter werden **vor** `t()` escaped (`esc()`), `t()` escaped nichts; in SVG weiterhin `textContent`.
- Englisch: britisch, Sentence case, Anrede „you“, Glossar der Spec; „tippen“ → „tip (onto its side)“, nie „tilt“.
- Jede neue Datei unter `js/` in die `ASSETS`-Liste von `sw.js`.
- **Kein** `sprachen.json` in Stufe 1.
- Subagenten starten die App nicht und lassen keine Prozesse laufen; Browser-Abnahme macht die Hauptsitzung (Task 9).

## Review Focus

1. Platzhalter mit Nutzertext (`{name}` = Case-Name mit `<`, `&`, „“) – muss escaped ankommen, keine doppelte Escapierung im Deutschen. → Test in Task 1 (`t` ersetzt wörtlich, ohne Escaping) und Task 6 (Inspector-HTML mit `<b>`-Case-Name auf Englisch).
2. Fehlerkette aus `io.js` (Wrapper hängt `e.message` an) – auf Englisch kein deutscher Rest. → Test in Task 4.
3. Sicherung auf Englisch exportiert, auf Deutsch importiert – identische Datensätze, Gewerk `Licht`. → Task 8.
4. Gewerk-Auswahl auf Englisch speichert den deutschen Wert. → Test in Task 6.
5. `num()` auf Deutsch identisch zum alten `toLocaleString('de-DE', …)` inkl. `useGrouping: false`. → Test in Task 1.

---

### Task 1: Sprachkern

**Files:**
- Create: `js/i18n/i18n.js`, `js/i18n/en.js`, `tests/i18n-core.test.js`
- Modify: `sw.js` (ASSETS: `js/i18n/i18n.js`, `js/i18n/en.js`)

**Interfaces:**
- Produces:
  - `export let lang` (`'de'|'en'`), aus `globalThis.location?.search` (`lang=en` → `'en'`, sonst `'de'`).
  - `export function setLang(l: 'de'|'en'): void` – nur Tests.
  - `export function t(text: string, params?: object|null, ctx?: string): string` – Schlüssel `ctx ? `${ctx}|${text}` : text`; auf Englisch `EN[key] ?? text`; dann jedes `{name}` durch `String(params.name)` ersetzen (unbekannte Platzhalter bleiben stehen). Auf Deutsch wird `ctx` ignoriert.
  - `export function num(v: number, opts?: Intl.NumberFormatOptions): string` – `v.toLocaleString(lang === 'en' ? 'en-GB' : 'de-DE', opts)`.
  - `export function date(d: Date): string` – `toLocaleDateString` mit derselben Locale.
  - `export function trade(name: string): string` – Englisch: Tabelle aus der Spec (Licht→Lighting, Ton→Sound, Video→Video, Rigging→Rigging, Strom→Power, Bühne→Staging, Backline→Backline, Sonderbau→Scenic, Sonstiges→Other), Unbekanntes unverändert; Deutsch: unverändert.
  - `export function builtinNote(c: {builtin?: boolean, note?: string}): string` – bei `builtin` `t(note)` ohne Platzhalter-Ersetzung nötig, sonst `note ?? ''`.
  - `js/i18n/en.js`: `export default { … }` (anfangs nur Einträge, die Task 1 selbst braucht – keine).

- [ ] **Step 1: Failing tests** in `tests/i18n-core.test.js`:
  - `t('Hallo {name}', { name: '<b>' })` → `'Hallo <b>'` (Deutsch, kein Escaping).
  - Nach `setLang('en')` und einem Testeintrag (Test importiert `en.js` als Objekt und setzt `EN['Hallo {name}'] = 'Hello {name}'`, räumt danach auf): → `'Hello <b>'`; fehlender Eintrag → deutscher Text; `t('Lage', null, 'Stapel')` sucht `'Stapel|Lage'`.
  - `num(1234.5, { maximumFractionDigits: 1, useGrouping: false })` → `'1234,5'` (de), `'1234.5'` (en); `num(12000)` → `'12.000'` (de), `'12,000'` (en).
  - `trade('Bühne')` → `'Bühne'` (de), `'Staging'` (en); `trade('Eigenes')` → `'Eigenes'` (en).
  - `builtinNote({ builtin: true, note: 'X' })` mit Eintrag `X→Y` → `'Y'` (en); `builtinNote({ note: 'X' })` → `'X'` (en).
  - Jeder Test setzt am Ende `setLang('de')` (in `afterEach`).
- [ ] **Step 2:** `node --test tests/i18n-core.test.js` → FAIL (Modul fehlt).
- [ ] **Step 3:** Implementieren wie in Interfaces.
- [ ] **Step 4:** `npm test` → alles grün (inkl. `tests/pwa.test.js` mit den neuen ASSETS).
- [ ] **Step 5:** Commit `feat(i18n): Sprachkern t/num/date/trade (#42)`.

### Task 2: Sperr-Test (Fortschrittsmessung)

**Files:**
- Create: `tests/i18n.test.js`, `tests/i18n-scan.js` (Hilfsfunktionen, ohne Tests)

**Interfaces:**
- Consumes: `js/i18n/en.js`.
- Produces: `PENDING` (Array von Pfaden, oben in `tests/i18n.test.js`) – alle heutigen Dateien unter `js/app`, `js/ui`, `js/model`, `js/store`, `js/data`, plus `js/app.js` und `index.html`. Spätere Tasks entfernen ihre Dateien daraus. `ALLOW` (Array `{ file, text, why }`) – Ausnahmen für Test C.

`tests/i18n-scan.js` exportiert:
- `stripComments(src: string): string` – `//…` und `/*…*/` außerhalb von Strings entfernen.
- `literals(src): Array<{ text: string, kind: 'str'|'tpl', inT: boolean, line: number }>` – einfache Tokenisierung von `'…'`, `"…"` und Template-Literalen (feste Teile eines Templates je einzeln, `${…}` verschachtelt beachtet); `inT` = Literal ist erstes Argument eines Aufrufs `t(`.
- `tCalls(src): Array<{ key: string|null, ctx: string|null, line }>` – `key` null, wenn das erste Argument kein einfaches String-Literal ist.
- `looksGerman(s: string): boolean` – Umlaute/ß, „ oder “, oder ein Wort aus einer festen Liste häufiger deutscher Wörter (`und, oder, nicht, kein, keine, der, die, das, mit, für, ist, wird, noch, alle, neu, Gewicht, Fahrzeug, laden, Löschen …`) als ganzes Wort. Muss auf der heutigen deutschen Oberfläche anschlagen und auf Englisch schweigen (Test D).

**Tests in `tests/i18n.test.js`:**
- A „Jeder `t()`-Schlüssel hat einen englischen Eintrag mit denselben Platzhaltern“ – über alle Dateien unter `js/` + `data-t*`-Texte aus `index.html` (Task 3 liefert die).
- B „Kein verwaister Eintrag in `en.js`“ – jeder Schlüssel kommt als `t()`-Literal, `data-t`-Text, Gewerk-Tabelle ausgenommen, oder als `builtinNote`-Text (Noten aus `data/*.json` mit `builtin`-Kontext und `NOTE` aus `preset-trucks.js`) vor.
- C „Kein deutscher Text außerhalb von `t()`“ – für jede Datei **nicht** in `PENDING`: kein Literal mit `looksGerman && !inT`, außer in `ALLOW`. `t(nichtLiteral)` nur in `js/i18n/i18n.js` (also `builtinNote`) erlaubt.
- D „`looksGerman` trifft“ – `true` für `'Alles neu packen'`, `'„X“ ragt über den Laderaum hinaus.'`, `'Löschen'`; `false` für `'Repack all'`, `'Load space'`, `'kg'`, `'#e8b10c'`, `'standing'`.
- E „`PENDING` enthält nur existierende Dateien“ (damit Umbenennungen auffallen).

- [ ] **Step 1:** Tests und Scanner schreiben.
- [ ] **Step 2:** `npm test` → grün, weil alle Dateien in `PENDING` stehen.
- [ ] **Step 3: Rot-Nachweis:** `js/model/slug.js` testweise aus `PENDING` nehmen und `const x = 'Gewicht unbekannt';` einfügen → Test C muss mit Datei und Zeile scheitern; ebenso ein `t('Neu')` ohne `en.js`-Eintrag → Test A rot. Beides zurücknehmen, Ausgabe im Bericht zitieren.
- [ ] **Step 4:** Commit `test(i18n): Sperr-Tests mit Fortschrittsliste (#42)`.

### Task 3: `index.html` und Startverdrahtung

**Files:**
- Create: `js/i18n/dom.js`; Modify: `index.html`, `js/app.js` (nur Aufruf), `sw.js`, `tests/i18n.test.js` (`index.html` aus `PENDING`), `tests/i18n-scan.js` (Parser für `data-t*`)

**Interfaces:**
- Produces: `export function translateDom(root: ParentNode): void` – setzt `document.documentElement.lang = lang`; auf Englisch: für `[data-t]` `textContent = t(textContent.trim())`, für `[data-t-title|data-t-aria-label|data-t-placeholder]` das jeweilige Attribut = `t(alterWert)`. Auf Deutsch nur `lang`.
- Scanner: `dataTTexts(html): string[]`.

- [ ] **Step 1:** Jeden sichtbaren deutschen Text in `index.html` (inkl. `<option>`, `<dialog>`-Inhalte, Inline-Script Z. 14–52 falls Texte) mit `data-t`/`data-t-…` markieren; Elemente mit gemischtem Inhalt (Text + Kindelemente) so aufteilen, dass jeder Text in einem eigenen `<span data-t>` steht. `<html lang="de">` bleibt der Ausgangswert.
- [ ] **Step 2:** Test C erweitern: in `index.html` (ohne `<script>`-Inhalte) kein Textknoten/Attribut mit `looksGerman`, das nicht `data-t*` trägt. Test A deckt die `data-t`-Texte → `en.js`-Einträge ergänzen.
- [ ] **Step 3:** `translateDom(document)` in `js/app.js` als erste Anweisung nach den Imports aufrufen, vor dem ersten Rendern.
- [ ] **Step 4:** `npm test` grün; Commit `feat(i18n): index.html übersetzbar (#42)`.

### Task 4: Modell und Store

**Files:** alle Dateien unter `js/model/` und `js/store/` mit deutschen Texten (u. a. `validate.js`, `packer.js`, `unplacedReason.js`, `lkw.js`, `audioDolly.js`, `truss.js`, `geometry.js`, `material.js`, `packRules.js`, `collections.js`, `actions.js`, `io.js`, `repo.js`, `autosave.js`, `db.js`, `hostDb.js`); `js/i18n/en.js`; `tests/i18n.test.js` (diese Dateien aus `PENDING`); neue Tests in `tests/i18n-en-model.test.js`.

**Regeln dieser Aufgabe:**
- Meldungen an der Erzeugung in `t()`; verschachtelte Fehler als `t('… {detail}', { detail: e.message })`.
- Erzeugte LKW-Namen: `t('LKW {n}', { n })` → „Truck {n}“.
- `MEINE_NAME` bleibt; die Firmen-Abgleiche in `collections.js:131` und `io.js:393` erkennen zusätzlich `t(MEINE_NAME)`-Englisch („My collection“) – Konstante `MEINE_NAME_EN` in `collections.js` aus `en.js` (`EN[MEINE_NAME]`), beide in `ALLOW` mit Begründung „gespeicherter Wert“.
- Suche nach Textvergleichen auf Meldungen (`.message` mit `includes/startsWith/===/match`, Regex auf deutsche Sätze) über ganz `js/` und `tests/`; Treffer auf eine Kennung (`err.code`) umstellen.
- Gewerk-Namen in `categories.js` bleiben (ALLOW: „gespeicherter Wert“).

- [ ] **Step 1: Failing tests** `tests/i18n-en-model.test.js` (alle mit `setLang('en')`/`afterEach setLang('de')`):
  - `validatePlan` mit herausragendem, kollidierendem und nicht tippbarem Case → jede `message` `!looksGerman` und ohne `{`; Case-Name `„Bühne“` darf vorkommen (Prüfung nach Herausnehmen des Namens).
  - `checkCase({ id: 'x', name: 'A', l: -1, w: 1, h: 1, weight: 1 })` wirft englische Meldung.
  - Wrapper-Fehler aus `parseBundle` (kaputte Datei, die im inneren Check scheitert) → komplette Meldung `!looksGerman`.
  - `unplacedReason`-Texte für jeden Grund `!looksGerman`.
  - Neuer LKW in Mehr-LKW-Plan heißt `'Truck 2'`.
- [ ] **Step 2:** Rot ausführen.
- [ ] **Step 3:** Umstellen, `en.js` ergänzen, Dateien aus `PENDING` nehmen.
- [ ] **Step 4:** `npm test` grün – **alle** bestehenden deutschen Tests unverändert.
- [ ] **Step 5:** Commit `feat(i18n): Modell- und Store-Meldungen übersetzbar (#42)`.

### Task 5: App-Schicht

**Files:** `js/app.js`, `js/app/*.js` (u. a. `persistence.js`, `importExport.js`, `chrome.js`, `planView.js`, `core.js`, `keyboard.js`, `materialScreen.js`, `plans.js`, `screens.js`, `hostPrint.js`, `download.js`, `guarded.js`); `en.js`; `PENDING`.

- [ ] **Step 1:** Texte in `t()`; `app.js:69` (`'LKW'`/`'Truck'`) als zwei vollständige Sätze, wo er verwendet wird.
- [ ] **Step 2:** `npm test` grün; Commit `feat(i18n): App-Schicht übersetzbar (#42)`.

### Task 6: Oberfläche – Editoren, Material, Inspector

**Files:** `js/ui/inspector.js`, `case-editor.js`, `caseInfo.js`, `caseGroups.js`, `library.js`, `material.js`, `stock-target.js`, `confirmDialog.js`, `dom.js`, `lkw-editor.js`, `lkw-tabs.js`, `truck-editor.js`, `js/data/*.js`; `en.js`; `PENDING`; Test `tests/i18n-en-ui.test.js`.

**Regeln:** alle `toLocaleString('de-DE'…)` → `num(…)`, `toLocaleDateString('de-DE')` → `date(…)`; Gewerk-Anzeige über `trade()`, Auswahl-`<option value>` bleibt deutsch, Text `trade(name)`; Hinweise mitgelieferter Cases/Fahrzeuge über `builtinNote(c)`; Sammlung `MEINE_ID` angezeigt über `t(MEINE_NAME)`. Heute alphabetisch sortierte Listen übersetzter Texte (Gewerke) nach dem angezeigten Text sortieren; feste Reihenfolgen (z. B. `CATEGORIES`, `Sonstiges` zuletzt) bleiben.

- [ ] **Step 1: Failing tests** (`setLang('en')`, mit dem vorhandenen Test-DOM-Muster dieser Module, siehe `tests/inspector.test.js`):
  - Inspector-HTML für ein Case namens `<b>&` enthält `&lt;b&gt;&amp;`, sonst kein `looksGerman` außer Nutzerdaten.
  - Case-Editor: Gewerk-Auswahl zeigt `Lighting`, gewählter Wert speichert `'Licht'`.
  - `builtinNote` für ein Standard-Case mit `'Gewicht geschätzt'` → englisch.
- [ ] **Step 2–4:** rot → umstellen → `npm test` grün.
- [ ] **Step 5:** Commit `feat(i18n): Editoren, Material, Inspector übersetzbar (#42)`.

### Task 7: Oberfläche – Assistenten, Regeln, Druck, Ansichten

**Files:** `js/ui/load-wizard.js`, `wizard-items.js`, `dolly-wizard.js`, `truss-wizard.js`, `pack-rules.js`, `print.js`, `view2d.js`, `view3d.js`, `view3d-parts.js`, `labelTexture.js`, `zoom2d.js` und übrige `js/ui/*` mit Texten; `en.js`; `PENDING` → **leer**.

- [ ] **Step 1: Failing tests** in `tests/i18n-en-ui.test.js`: `buildPrint`/`buildChecklist` (siehe `print.js`) auf Englisch → kein `looksGerman` außer Plan-/Case-Namen; Datum im Format `en-GB`.
- [ ] **Step 2–3:** rot → umstellen.
- [ ] **Step 4:** In `tests/i18n.test.js` Test F ergänzen: „`PENDING` ist leer“. `npm test` grün.
- [ ] **Step 5:** CSS-Suche `grep -n "content:\s*['\"][^'\"]" css/` – Treffer mit Text nach JS/HTML verlegen.
- [ ] **Step 6:** Commit `feat(i18n): Assistenten, Druck, Ansichten übersetzbar (#42)`.

### Task 8: Daten sprachfrei

**Files:** Test `tests/i18n-daten.test.js`.

- [ ] **Step 1:** Test „Export auf Englisch = Export auf Deutsch“: denselben Zustand (Plan mit Case Gewerk `Licht`, Mehr-LKW mit erzeugtem LKW-Namen vorher auf Deutsch angelegt) mit der Exportfunktion aus `js/store/io.js` je einmal unter `setLang('de')` und `setLang('en')` serialisieren → `deepEqual` (ohne Zeitstempel).
- [ ] **Step 2:** Test „Sicherung im alten Schema lädt auf Englisch“: vorhandene Altschema-Fixture aus `tests/` (z. B. die von `tests/io.test.js`) unter `setLang('en')` mit `parseBundle` laden → gleiche Datensätze wie unter Deutsch.
- [ ] **Step 3:** `npm test` grün; Commit `test(i18n): gespeicherte Daten bleiben sprachfrei (#42)`.

### Task 9: Browser-Abnahme (Hauptsitzung)

- [ ] **Step 1:** `python3 -m http.server 8766` im Projekt; Szenario im Scratchpad: `index.html?lang=en` – Startbildschirm, Plan anlegen (über `p.eval` und `js/app.js`), Planansicht 2D/3D, Material, Lade-Assistent, Traversen-Assistent, Pack-Regeln, Inspector mit gewähltem Case, Druckvorschau, Importfehler (kaputte Datei). Je Bildschirm `document.body.innerText` (sichtbare Elemente) mit `looksGerman` (aus `tests/i18n-scan.js` importiert) prüfen; Case-/Plan-/Firmennamen vorher herausnehmen. Screenshots.
- [ ] **Step 2:** Dasselbe ohne Parameter: kein englischer Rest, `html lang="de"`, Stichprobe Screenshots gegen `main`.
- [ ] **Step 3:** Rot-Nachweis: einen `data-t` testweise entfernen → Szenario meldet den deutschen Text.
- [ ] **Step 4:** Server und Chrome beenden, `ps -ef | grep -E "http.server|Chrome.*headless"` leer.

### Task 10: Doku, Version, Veröffentlichung Stufe 1

- [ ] **Step 1:** `CLAUDE.md`: Regel „Oberfläche auf Deutsch und Englisch, Deutsch ist die Ausgangssprache“; neue Regel „Neue Texte nur über `t()` aus `js/i18n/i18n.js`, englischer Eintrag in `js/i18n/en.js` gehört dazu; `tests/i18n.test.js` erzwingt das“. `docs/architektur.md`: Abschnitt Sprache. `docs/nyx-host.md`: `lang`-Parameter, `sprachen.json` folgt in Stufe 2. Glossar in der Spec um neu aufgetauchte Begriffe ergänzen.
- [ ] **Step 2:** Versionsnummer (Patch, 0.20.0 → 0.20.1) mit dem Nutzer abstimmen; `js/version.js`, `package.json`, `README.md`, `index.html`, `sw.js`-Cache, CHANGELOG.
- [ ] **Step 3:** `superpowers:verification-before-completion`, `superpowers:requesting-code-review` (ganzer Branch), Befunde einarbeiten.
- [ ] **Step 4:** Merge nach `main`, Push, Pages-Build prüfen (`js/version.js` live).
- [ ] **Step 5:** Kommentar in Issue #42: Stufe 1 live, Gegenlesen unter `https://m4dm0nky.github.io/Truckload/?lang=en`, Link auf `js/i18n/en.js` und die Glossar-Ergänzungen; `sprachen.json` folgt nach Korrekturen (Stufe 2).
