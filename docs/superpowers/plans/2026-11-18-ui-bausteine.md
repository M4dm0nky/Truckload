# UI-Bausteine (Stufe B1) – Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Truckloads Bedienelement-Gestaltung in `css/ui.css` bündeln, nur aus Tokens (Schnittstelle Version 2), bewacht von einem Test, ohne dass sich die Web-App sichtbar ändert.

**Architecture:** Werte bleiben in `css/app.css` (`:root` + Modus-Blöcke), Bausteine wandern nach `css/ui.css`, das `index.html` **vor** `app.css` lädt. Bereich für Bereich bekommen Knöpfe und Felder Varianten-Klassen im Markup, die ersetzte lokale Regel wird gelöscht. Ein CSS-Zerleger ohne Abhängigkeit (`tests/css-scan.js`) speist den Wächter. Abgenommen wird über einen Pixelvergleich vorher/nachher mit `tools/cdp.mjs`.

**Tech Stack:** Vanilla CSS/ES-Module, `node --test`, headless Chrome über `tools/cdp.mjs`.

**Spec:** `docs/superpowers/specs/2026-11-18-ui-bausteine-design.md` (immer mitlesen, §-Verweise unten beziehen sich darauf)

## Global Constraints

- Keine npm-Abhängigkeit, kein Build-Schritt. Jede neue Datei unter `css/`/`js/` in `ASSETS` von `sw.js` (`tests/pwa.test.js`).
- Keine neuen Texte außerhalb `tools/`. Falls doch: nur über `t()` plus Eintrag in `js/i18n/en.js`.
- Die 18 Tokens von Version 1 bleiben in Name, Reihenfolge und Wert unverändert; neue Tokens hinten an `THEME_TOKENS`.
- Erlaubte sichtbare Unterschiede, abschließend (Spec §6): Überlauf-Fix im Popup (#45), Felder der Tabellen-Import-Liste `3px 5px` → `2px 6px`, Kantenglättung einzelner Pixel.
- Gewählt schlägt hover über **Spezifität**, nicht über Quellreihenfolge.
- `.on` bleibt der Gewählt-Zustand; kein Wechsel auf `aria-pressed`.
- Varianten-Klassen (fest, von allen Tasks benutzt): Knopf `.small` `.mini` `.large` `.chip` `.quiet` `.list-item`; Feld `.small` `.error` `.warn` `.color-compact`. Bestehend und unverändert: `.primary` `.danger` `.seg` `.on` `.editor` `.hint` `.banner` `.banner-warn` `.banner-close` `.lkw-tab`.
- Keine Versionsnummer anfassen (`js/version.js`, `CHANGELOG.md`, `sw.js`-Cache-Name), bis Task 10 sie mit dem Nutzer abstimmt.
- Sub-Agents starten weder NYX noch einen Browser außerhalb von `tools/cdp.mjs`; gestartete `http.server`-Prozesse werden am Task-Ende beendet.
- Scratchpad für Bildvergleich: `SP=/private/tmp/claude-501/-Users-robs-Git-NYX/aeced5ff-872b-4f47-8606-9c22e6b23a20/scratchpad/tl-b1` (nicht im Repo, Truckloads Regel).

## Review Focus

1. **Ein `.on`-Knopf außerhalb der bekannten Gruppen** (z. B. `#mode-2d`, `#colors-black` in `.seg`, Reiter im Tabellen-Import) muss danach genau so aussehen wie vorher – kein generisches `button.on`. Abgedeckt durch die Shots „Kopfleiste“ und „Tabellen-Import“ in Task 1 und die Selektor-Sperre in Task 8.
2. **Gewählter Knopf unter der Maus** behält Akzentfüllung bzw. Akzentrand. Shot `hover-gewaehlt` in Task 1.
3. **`input.className = …` überschreibt die Variante** (`js/ui/tabellen-import.js:647`): Nach einer Eingabe muss das Feld weiter `small` tragen. Test in Task 5.
4. **Gesperrtes Gewichtsfeld im Inspector** (Kopie) darf nicht blasser werden (Disabled-Regel bleibt Popup-gebunden). Shot `inspector-kopie` in Task 1.
5. **Hellmodus über Systemeinstellung** (ohne `data-theme`) zeigt die Warnfarbe `#7a5a00` als Text. Prüfung in Task 2 (`theme.test.js`) und Shot-Satz „hell“.

---

### Task 1: Bildvergleich vorbereiten und Vorher-Bilder aufnehmen

Vor jeder CSS-Änderung. Ergebnis liegt nur im Scratchpad.

**Files:**
- Create: `$SP/szenario.mjs`, `$SP/vergleich.mjs`, `$SP/vorher/*.png`

**Interfaces:**
- Produces: `node tools/cdp.mjs $SP/szenario.mjs $SP/<ordner>` erzeugt je Bild `<name>-dunkel.png` und `<name>-hell.png`; `node $SP/vergleich.mjs $SP/vorher $SP/nachher` druckt je Bild `name  abweichende_pixel` und schreibt `$SP/diff/<name>.png`, Exit-Code 0 auch bei Abweichungen.

- [ ] **Step 1: Szenario schreiben.** Fester Viewport 1440×900. Zustand über `p.eval` mit den App-Modulen aufbauen (Store/Aktionen), nicht klicken. Hell = `document.documentElement.dataset.theme='light'`, dunkel = `'dark'`, zusätzlich ein Lauf „hell-system“ ohne Attribut per CDP `Emulation.setEmulatedMedia` mit `prefers-color-scheme: light` (falls `cdp.mjs` das nicht durchreicht: über `p.eval` nicht möglich → dann nur `data-theme`, und im Plan-Fortschritt notieren). 3D-Bereich (`.view3d`) vor jedem Shot auf `visibility:hidden` setzen. Bilder (Namen fest):
  `start`, `kopfleiste`, `plan-2d`, `bibliothek`, `inspector`, `inspector-kopie` (gesperrtes Gewichtsfeld), `lade-assistent`, `tabellen-import` (Liste mit `rot`- und `gelb`-Feld, Reiter-Segment), `material` (gewählte Firma), `lkw-reiter` (gewählt, `none`), `popup-case-editor` (Art-Schalter, Schnelllängen), `popup-regeln`, `popup-auswahl-lang` (#45), `banner` (Fehlerbanner sichtbar), `geraete-schritt` (gewählte Zeile), `hover-normal`, `hover-gewaehlt` (Maus über `#mode-2d` bzw. einem normalen Knopf), `fokus-knopf`, `fokus-feld` (per `p.key('Tab')`).
- [ ] **Step 2: Vergleich schreiben.** Ohne Abhängigkeit: Chrome per `cdp.mjs` öffnen, beide PNGs als `data:`-URL in `<img>` laden, über Canvas `getImageData` vergleichen; Pixel gilt als abweichend bei Δ > 8 in einem Kanal. Diffbild: abweichende Pixel rot auf grau.
- [ ] **Step 3: Server starten, aufnehmen, beenden.**
  Run: `python3 -m http.server 8766 & node tools/cdp.mjs $SP/szenario.mjs $SP/vorher; kill %1`
  Expected: 57 PNGs (19 Namen × 3 Läufe), keines leer (Datei > 10 kB).
- [ ] **Step 4: Gegenprobe.** `vergleich.mjs $SP/vorher $SP/vorher` → alle Zeilen `0`. Zweiter Lauf des Szenarios nach `$SP/vorher2` und Vergleich → alle `0` (sonst ist eine Aufnahme nicht deterministisch: Ursache beheben, z. B. Animation/Cursor, bevor es weitergeht).

### Task 2: Tokens Version 2

**Files:**
- Modify: `css/app.css:9-33`, `js/ui/themeTokens.js`
- Test: `tests/theme.test.js`

**Interfaces:**
- Produces: `THEME_VERSION === 2`; `THEME_TOKENS` = 18 alte + in dieser Reihenfolge: `--tl-control-height`, `--tl-control-height-sm`, `--tl-control-font-size`, `--tl-control-font-size-sm`, `--tl-button-pad`, `--tl-button-pad-sm`, `--tl-field-pad`, `--tl-field-pad-sm`, `--tl-button-weight`, `--tl-button-primary-weight`, `--tl-button-bg`, `--tl-button-hover-bg`, `--tl-button-hover-border`, `--tl-selected-bg`, `--tl-selected-text`, `--tl-selected-border`, `--tl-marked-border`, `--tl-dialog-radius`, `--tl-dialog-pad`, `--tl-dialog-title-size`, `--tl-dialog-divider`, `--tl-backdrop`, `--tl-warn`, `--tl-warn-text`.

- [ ] **Step 1: Failing tests.** In `tests/theme.test.js`: `DUNKEL2` mit den Standards aus Spec §4 (`auto`, `auto`, `inherit`, `12px`, `5px 10px`, `2px 8px`, `5px 8px`, `2px 6px`, `inherit`, `600`, `var(--tl-raised)`, `var(--tl-button-bg)`, `var(--tl-text-muted)`, `var(--tl-accent)`, `var(--tl-on-accent)`, `var(--tl-accent)`, `var(--tl-accent)`, `12px`, `18px`, `18px`, `transparent`, `rgba(0,0,0,.5)`, `#f2b705`, `#f2b705`). Tests: `'Token-Liste Version 2 = Version 1 + neue, feste Reihenfolge'` (`THEME_VERSION === 2`, `THEME_TOKENS` deepEqual `[...Object.keys(DUNKEL), ...Object.keys(DUNKEL2)]`), `'Standardwerte Version 2'` (`:root` je Wert, `--tl-theme-version` `'2'`), `'Warntext je Modus'` (Hellmodus-Media und `data-theme="light"`: `--tl-warn-text` `#7a5a00`; `data-theme="dark"`: `#f2b705`), `'Warn-Aliasse'` (`--warn` = `var(--tl-warn)`, `--warn-text` = `var(--tl-warn-text)`). Den bestehenden Test `'Token-Liste Version 1 …'` auf die ersten 18 Einträge umstellen (`THEME_TOKENS.slice(0, 18)`).
- [ ] **Step 2:** `node --test tests/theme.test.js` → FAIL (Version 1, Tokens fehlen).
- [ ] **Step 3: Implementieren.** Tokens in `:root` eintragen; `--warn-text` in den drei Modus-Blöcken in `--tl-warn-text` umbenennen; `--warn`/`--warn-text` in `:root` zu Aliassen. Kommentar in `themeTokens.js` nach Spec §4 („in `:root`; in die Modus-Blöcke nur, wenn der Wert je Modus abweicht“). Kein Baustein benutzt die Tokens schon.
- [ ] **Step 4:** `npm test` → PASS. Vergleich `vorher`/`nachher` (Task-1-Befehle mit Ordner `nachher`) → alle `0`.
- [ ] **Step 5: Commit** `feat(theme): Gestaltungs-Schnittstelle Version 2, Tokens (#48)`

### Task 3: CSS-Zerleger und Wächter-Funktionen

Reine Logik, TDD. Noch nicht auf die echten Dateien scharf geschaltet (Task 8).

**Files:**
- Create: `tests/css-scan.js` (Hilfsmodul wie `tests/i18n-scan.js`)
- Test: `tests/css-scan.test.js`

**Interfaces:**
- Produces:
  - `parseCss(text: string) → Array<{ selector: string, decls: Array<{prop: string, value: string}>, media: string|null, line: number }>` – Kommentare entfernt, `@media`-Inhalt aufgelöst (`media` = Bedingung), Selektorlisten in Einzelregeln aufgeteilt (eine Regel je Selektor).
  - `targetCompound(selector: string) → string` – letztes zusammengesetztes Glied (Kombinatoren ` `, `>`, `+`, `~`).
  - `uiClasses(rules) → Set<string>` – alle Klassennamen, die in Selektoren von `ui.css` vorkommen.
  - `isControlTarget(compound: string, ui: Set<string>) → boolean` – nennt `button|input|select|textarea|dialog` oder `.btn` oder eine Klasse aus `ui`. Pseudoklassen/-elemente und Attributselektoren werden vor dem Prüfen entfernt.
  - `LOOK_PROPS: RegExp` – `^(padding|height|min-height|font|line-height|color|background|border|box-shadow|opacity|outline|cursor|text-align)` (Präfix, also auch `font-size`, `border-radius`).
  - `findControlStyling(rules, ui) → Array<{selector, prop, line}>`
  - `findColorLiterals(rules) → Array<{selector, prop, value, line}>` – `#hex`, `rgb(`, `rgba(`, `hsl(`, `hsla(`, benannte CSS-Farben außer `transparent`/`currentColor`; ausgenommen Regeln mit Selektor `:root…` (Token-Blöcke, auch in `@media`) und Selektoren, die mit `svg` beginnen; Werte in `--*`-Deklarationen ebenfalls ausgenommen.

- [ ] **Step 1: Failing tests** mit einem eingebetteten Schnipsel:
  ```css
  :root { --x: #fff; }
  .a button { padding: 2px; flex: 1; }
  .b { color: #123; }
  svg .c { fill: rgba(0,0,0,.5); }
  @media (max-width: 600px) { .d input:hover { font-size: 12px; } }
  .e, .f select { margin: 0; border-color: red; }
  .lib-item:hover { background: var(--bg); }
  .klein { padding: 1px; }
  ```
  mit `ui = new Set(['klein'])`. Erwartet: `findControlStyling` = genau `[.a button padding]`, `[.d input:hover font-size]`, `[.f select border-color]`, `[.klein padding]` (nicht `flex`, nicht `margin`, nicht `.lib-item:hover`). `findColorLiterals` = genau `[.b color #123]`, `[.f select border-color red]` (nicht `:root`, nicht `svg .c`). Zusätzlich Tests für `targetCompound('.view figcaption .zoom button') === 'button'`, `targetCompound('.x > .y.z:hover') === '.y.z:hover'`, und dass `parseCss` die Zeilennummer der Regel liefert.
- [ ] **Step 2:** `node --test tests/css-scan.test.js` → FAIL (Modul fehlt).
- [ ] **Step 3:** Implementieren.
- [ ] **Step 4:** → PASS, `npm test` grün.
- [ ] **Step 5: Commit** `test(ui): CSS-Zerleger für den Bausteine-Wächter (#48)`

### Task 4: `css/ui.css` anlegen und Musterseite

`ui.css` enthält alle Bausteine aus Spec §5 als Kopie mit Tokens. Die alten Regeln in `app.css` bleiben **noch** stehen und gewinnen (spätere Quelle), deshalb ändert sich nichts.

**Files:**
- Create: `css/ui.css`, `tools/muster.html`
- Modify: `index.html:12` (davor `<link rel="stylesheet" href="css/ui.css">`), `sw.js:17` (`'css/ui.css',` vor `'css/app.css'`)

**Interfaces:**
- Consumes: Tokens aus Task 2, Klassennamen aus „Global Constraints“.
- Produces: Selektoren, die Tasks 5–7 voraussetzen:
  - Gemeinsam: `button, .btn, select, input, textarea { font: inherit; color: inherit; }` als erste Regel (heute `app.css:38`), danach die Größen.
  - Quellreihenfolge in `ui.css`: Basis → `:hover` → `.primary`/`.danger` → Varianten → Zustände. `button.primary` und `button:hover` haben dieselbe Spezifität; heute gewinnt `.primary` als spätere Regel (Hauptknopf behält beim Überfahren den Akzentrand), das muss so bleiben.
  - Knopf: `button, .btn` (Basis, `min-height: var(--tl-control-height)`, `padding: var(--tl-button-pad)`, `font-size: var(--tl-control-font-size)`, `font-weight: var(--tl-button-weight)`, `background: var(--tl-button-bg)`), `button:hover, .btn:hover` (`background: var(--tl-button-hover-bg)`, `border-color: var(--tl-button-hover-border)`), `button:disabled`, `:focus-visible`, `button.primary` (Gewicht `--tl-button-primary-weight`), `button.danger`, `button.small` (`--tl-button-pad-sm`, `min-height: var(--tl-control-height-sm)`), `button.mini` (`1px 8px`, `--tl-control-font-size-sm`, Gewicht 400), `button.large` (`10px 20px`, `15px`), `button.chip` (`3px 10px`, `--tl-control-font-size-sm`, Radius `999px`), `button.quiet` (ohne Rand/Hintergrund, `16px`, `line-height: 1`, `2px 6px`), `button.list-item` (`text-align: left`), `a.btn`.
  - Feld: `select, input, textarea` (`padding: var(--tl-field-pad)`, `min-height: var(--tl-control-height)`), `select { max-width: 100% }`, `input.small, select.small` (`--tl-field-pad-sm`), `input.error` (Rand + `box-shadow: 0 0 0 1px` in `--danger`), `input.warn` (Rand `--tl-warn`), `input.color-compact` (`padding: 2px; height: 30px`).
  - Gewählt: `.seg button.on, .seg button.on:hover` (gefüllt mit `--tl-selected-*`), `.lkw-tab.on, .lkw-tab.on:hover` (gefüllt + Gewicht 600), `button.list-item.on, button.list-item.on:hover` (nur `border-color: var(--tl-marked-border)`).
  - Segment: `.seg-label`, `.editor .kind-switch` samt `label` und `label:has(input:checked)` (gefüllt).
  - Reiter: `.lkw-tab`, `.lkw-tab small`, `.lkw-tab.none:not(.on)`.
  - Popup: `dialog` (Radius `--tl-dialog-radius`), `dialog::backdrop` (`--tl-backdrop`), `.editor` (`--tl-dialog-pad`), `.editor h2` (`--tl-dialog-title-size`, `border-bottom: 1px solid var(--tl-dialog-divider)`), `.editor label` (mit `grid-template-columns: minmax(0, 1fr)`), `.editor label > input|select|textarea`, `.editor .row`, `.editor .check`, `.editor fieldset`, `.editor menu` (`border-top: 1px solid var(--tl-dialog-divider)`), `.editor input:disabled, .editor select:disabled`, `.editor label:has(> input:disabled), .editor label:has(> select:disabled)`.
  - Hinweis: `.hint`, `.banner`, `.banner-warn`, `.banner-close` (nur Position; Optik über `.quiet`).
  - Trennlinien unter `h2`/über `menu` sind `transparent` und dürfen Abstände nicht verändern: `1px`-Rand nur, wenn er schon heute Platz hat, sonst `box-shadow` statt `border`. Im Vergleich in Step 4 prüfen.

- [ ] **Step 1:** `css/ui.css` schreiben (Kopfkommentar: Zweck, Regel „nur Tokens, Ansichten gestalten Knopf/Feld nie selbst“, Verweis auf Spec). Werte exakt aus den heutigen Regeln (Spec §5, Zeilenangaben dort).
- [ ] **Step 2:** `index.html`, `sw.js` ergänzen. `npm test` → PASS (`pwa.test.js` kennt die Datei).
- [ ] **Step 3:** `tools/muster.html` nach Spec §9: ohne Parameter zwei `iframe`s (`?theme=dark`, `?theme=light`) nebeneinander; mit Parameter setzt die Seite `data-theme` und zeigt jeden Baustein in jedem Zustand. Hover und Fokus dauerhaft sichtbar über eine Hilfsklasse **nur in der Musterseite** (`<style>` dort, kein Eintrag in `ui.css`). Lädt `../css/app.css` und `../css/ui.css` in Ladereihenfolge der App. Vorher prüfen: `tests/i18n*.test.js`, `tests/i18n-scan.js` und `tests/pwa.test.js` lesen `tools/` nicht (sonst melden).
- [ ] **Step 4:** Vergleich `vorher`/`nachher` → alle `0` außer `popup-auswahl-lang` (der Überlauf-Fix greift schon hier, weil `app.css` für `.editor label` keine Spaltenbreite und für `select` keine Höchstbreite setzt). Jede andere Abweichung kommt von einer neuen Regel in `ui.css`, die es heute nicht gibt (z. B. Trennlinie), und wird behoben. Shot der Musterseite nach `$SP/muster.png` (`cdp.mjs`, 1600×1200, ganze Seite).
- [ ] **Step 5: Commit** `feat(ui): Bausteine in css/ui.css und Musterseite tools/muster.html (#48)`
- [ ] **Step 6: HALT.** Hauptsession zeigt dem Nutzer `$SP/muster.png` und den Link `http://localhost:8766/tools/muster.html`. Weiter erst nach Freigabe.

### Task 5: Knöpfe und Felder umziehen

**Files:**
- Modify: `css/app.css` (löschen), `index.html` (Zoom-Knöpfe Zeilen 255–257: `class="mini"`; `#error-banner-close`, `#tab-warning-close`: `class="banner-close quiet"`), `js/app/screens.js:30` (`class="start-plan-item list-item"`; Startknopf der Startkarte: `large`), `js/ui/library.js` (Knöpfe in `.lib-group-head` und `.lib-item`: `small`), `js/ui/material.js:62-66` (`list-item` + `on`), `js/ui/geraete-schritt.js:141` (`ge-row list-item`), `js/ui/case-editor.js:100`, `js/ui/truss-wizard.js:61` (`quick-len chip`), `js/ui/inspector.js:26` (`insp-weight small`), Farbwahl im Inspector (`color-compact`), `js/ui/tabellen-import.js:149,647`
- Test: `tests/tabellen-import.test.js`, ggf. HTML-Tests in `tests/library.test.js`, `tests/inspector.test.js`, `tests/app-screens.test.js`

**Interfaces:**
- Consumes: Selektoren aus Task 4.
- Produces: `FELD_KLASSE = { rot: 'error', gelb: 'warn' }` in `js/ui/tabellen-import.js`; Felder der Liste tragen `class="small"` bzw. `class="small error"`/`"small warn"`.

- [ ] **Step 1: Failing test.** `tests/tabellen-import.test.js:108` erwartet `data-k="hoehe" value="" class="small error"`. Neuer Test `'Feldzustand behält die Größe nach Eingabe'`: das Element, das der `input`-Handler an Zeile 647 erhält, hat danach `className` `'small error'` bzw. `'small'` (mit den vorhandenen DOM-Testhilfen aus `tests/dom.test.js`/`fixtures.js`; gibt es keinen Weg, die Zeile isoliert zu testen, die Klassenbildung als exportierte Funktion `feldKlasse(stufe: 'rot'|'gelb'|undefined) → string` herausziehen und die testen).
- [ ] **Step 2:** → FAIL.
- [ ] **Step 3:** Markup-Klassen setzen (Liste oben). In `app.css` löschen: Zeilen 38–45 (`button…`/`select…`-Basis, `:focus-visible`, `button:disabled`, `.primary`, `.danger`), `.banner-close` (49), `.start-card .primary` (67), `.start-plan-item` (69, `width:100%` bleibt als eigene Regel), `.view figcaption .zoom button` (86, `white-space: nowrap` bleibt), `.editor .quick-len` (151), `.lib-group-head button`/`.lib-item button` (202, 207), `.inspector input.insp-weight` (nur `padding`; `width`/`display` bleiben), `.insp-label input[type="color"]` (226), `.ti-list input` (nur `padding`), `.ti-list input.rot/.gelb` (296–297), `.mat-firms button` (nur `text-align`; `display`/`justify-content` bleiben), `.mat-firms button.on` (251), `.ge-row.on` (316), `a.btn` (Optik; `text-decoration`/`display` gehören zum Baustein in `ui.css`).
- [ ] **Step 4:** `npm test` → PASS. Vergleich → `0` überall außer `tabellen-import` (Feldhöhe, erlaubt). Jede andere Abweichung vor dem Commit beheben.
- [ ] **Step 5: Commit** `refactor(ui): Knöpfe und Felder aus den Bausteinen (#48)`

### Task 6: Gewählt-Zustand, Segment, Reiter

**Files:**
- Modify: `css/app.css` (löschen: 58–59, 146–149, 229, 260–263, 289), `js/ui/inspector.js:81` (`class="insp-wheels seg"`)

- [ ] **Step 1:** Alle `.on`-Erzeuger durchgehen (`grep -rnE "'on'|' on'|class=\"on\"|toggle\('on'" js index.html`) und je Stelle festhalten, unter welchem Baustein-Selektor sie danach liegt: `.seg button.on`, `.lkw-tab.on`, `button.list-item.on` oder **keiner** (dann darf sie auch heute keine Gestaltung haben, z. B. `.wiz-dot.on` ist kein Knopf und bleibt in `app.css`). Liste als Kommentar in den Commit-Text.
- [ ] **Step 2:** Lokale Regeln löschen, `insp-wheels` um `seg` ergänzen.
- [ ] **Step 3:** `npm test` → PASS. Vergleich → wie nach Task 5 (`hover-gewaehlt`, `kopfleiste`, `lkw-reiter`, `inspector`, `popup-case-editor`, `tabellen-import`-Reiter unverändert).
- [ ] **Step 4: Commit** `refactor(ui): Gewählt-Zustand, Segment und Reiter aus den Bausteinen (#48)`

### Task 7: Popup und Hinweise

**Files:**
- Modify: `css/app.css` (löschen: 47–48, 133–143, 153–154; Breiten je Dialog-ID bleiben)

- [ ] **Step 1:** Regeln löschen.
- [ ] **Step 2:** `npm test` → PASS. Vergleich → wie nach Task 6 (`popup-auswahl-lang` weicht seit Task 4 ab, Diffbild zeigt: läuft nicht mehr seitlich über), alle anderen Popups `0`.
- [ ] **Step 3: Commit** `refactor(ui): Popup und Hinweise aus den Bausteinen, Überlauf behoben (#45, #48)`

### Task 8: Wächter scharf schalten

**Files:**
- Create: `tests/ui-bausteine.test.js`
- Modify: `tests/theme.test.js:75-80` (liest `css/ui.css`)

**Interfaces:**
- Consumes: `tests/css-scan.js` (Task 3).

- [ ] **Step 1: Tests.** `'app.css gestaltet keine Bedienelemente'` (`findControlStyling(parseCss(app), uiClasses(parseCss(ui)))` → `[]`, Meldung listet Selektor/Eigenschaft/Zeile), `'keine Farbliterale außerhalb der Token-Blöcke'` (beide Dateien → `[]`), `'ui.css kennt kein generisches button.on'` (kein Selektor in `ui.css`, dessen Zielglied `button.on` ohne Kontext ist – sichert Review Focus 1), `'ui.css wird vor app.css geladen'` (Reihenfolge der `<link>` in `index.html` und der Einträge in `sw.js`). Prüfung 3 aus Spec §8 (Längen in `ui.css`) nur, wenn sie mit höchstens fünf benannten Ausnahmen auskommt; sonst weglassen und im PR begründen. `theme.test.js`: Regex-Test auf `css/ui.css` umstellen, Muster an die neuen Regeln anpassen (`button, .btn` liest `--tl-button-bg` und `--tl-radius`, Felder `--tl-input` und `--tl-radius`).
- [ ] **Step 2:** `npm test` → PASS. Falls rot: Rest-Regel in `app.css` umziehen, nicht ausnehmen.
- [ ] **Step 3: Rot-Nachweis.** `.lib-item button { padding: 2px 8px; }` in `app.css` zurücklegen → `node --test tests/ui-bausteine.test.js` FAIL mit genau dieser Regel; `.b { color: #123 }` → FAIL; beides wieder entfernen → PASS. Ausgabe für den PR-Text festhalten.
- [ ] **Step 4: Commit** `test(ui): Wächter für Bausteine und Farbliterale (#48)`

### Task 9: Gesamtvergleich und Abnahme

- [ ] **Step 1:** Szenario komplett nach `$SP/nachher`, Vergleich, Diffbilder.
  Expected: `0` überall außer `tabellen-import-*` (Feldhöhe) und `popup-auswahl-lang-*` (Überlauf). Kantenglättung: Abweichung < 50 Pixel und im Diffbild nur an Schriftkanten.
- [ ] **Step 2: HALT.** Hauptsession legt dem Nutzer die Zahlentabelle, die Diffbilder der zwei erlaubten Abweichungen und Vorher/Nachher von `popup-auswahl-lang` vor. Weiter erst nach Abnahme.

### Task 10: NYX-Probe, Doku, Version, PR

Nur Hauptsession (Urteil, Nutzertexte, öffentliche Schritte).

- [ ] **Step 1: NYX-Probe** (Spec §7) in einem eigenen NYX-Worktree: Submodul auf diesen Branch, `TOKENS_JE_VERSION[2]` in `frontend/src/lib/truckload/theme.js` vorläufig belegen, Truckload-Tab im Dev-Start ansehen (Nutzer). Fehlt ein Token oder ist einer überflüssig: hier im Branch nachziehen (Task 2 Tests mit), Task 9 wiederholen.
- [ ] **Step 2: Doku.** `docs/nyx-host.md` „Gestaltung“: Version 2, Token-Tabelle mit Standards, Regel „Bausteine in `css/ui.css`, Ansichten gestalten Knopf/Feld nie selbst, `tests/ui-bausteine.test.js` prüft“, Abschnitt „Für den Admin: zu tun vor dem Heben auf <Version>“ (neue Datei `css/ui.css`, NYX-Paket nimmt sie über `**/*` mit, nichts zu tun bis B3). `docs/architektur.md`: `css/ui.css` und `tests/css-scan.js`. Truckloads `CLAUDE.md`, Grundregeln: „Knopf und Feld nur über `css/ui.css` (Bausteine, nur Tokens); Ansichten setzen dort nur Anordnung. `tests/ui-bausteine.test.js` erzwingt das, Muster in `tools/muster.html`.“
- [ ] **Step 3: Version.** Nächste Nummer vorschlagen (voraussichtlich `0.33.1`, Grundlage ist der zuletzt veröffentlichte Stand) und vom Nutzer bestätigen lassen; dann `js/version.js`, `package.json`, `README.md`, `index.html`, `sw.js`-Cache-Name, `CHANGELOG.md` (`tests/version.test.js`). `npm test` → PASS.
- [ ] **Step 4: PR** an `M4dm0nky/Truckload` (Branch `feat/ui-bausteine`), Text: Zweck, erlaubte Abweichungen mit Diffbildern, Rot-Nachweis aus Task 8, Hinweis „Marco merged; NYX hebt danach und macht B3“. Kommentar in #48 mit Link. Beides vorher dem Nutzer zeigen.
