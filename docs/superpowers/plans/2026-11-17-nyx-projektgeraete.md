# NYX-Geräteübernahme – Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> Nach Freigabe nach `docs/superpowers/plans/2026-11-17-nyx-projektgeraete.md` (Branch
> `docs/nyx-projektgeraete`). **Gebaut wird erst, wenn Aniflus NYX-Häkchen in
> `docs/nyx-projektgeraete.md` steht.** Bis dahin nur Plan.

**Goal:** Truckload liest die Scheinwerfer des offenen NYX-Projekts über `truckloadHost.projektGeraete()`, der Nutzer ordnet je Gerätetyp per Klick Cases zu (Truckload zeigt bekannte Cases nur als Vorschlag), Truckload legt die Stücke an, merkt sich die Wahl am Case und bietet bei Änderungen nur die Differenz an.

**Architecture:** Reine Modelle (Namenserkennung, Abgleichsrechnung, Host-Datenprüfung) in eigenen Dateien unter `js/model/` bzw. `js/store/`, getrennt von der Oberfläche. Der Import-Dialog (`js/ui/tabellen-import.js`) bekommt eine zweite Quelle und einen neuen ersten Schritt „Geräte → Cases“; danach laufen die vorhandenen Schritte bis zur LKW-Verteilung. Neue Felder folgen den vorhandenen Mustern (`PIECE_FIELDS`, `checkCase`, `checkPlan`).

**Tech Stack:** Vanilla JS (ES-Module), `node --test`, headless Chrome über `tools/cdp.mjs`.

**Spec:** `docs/superpowers/specs/2026-11-17-nyx-projektgeraete-design.md` · Abstimmung: `docs/nyx-projektgeraete.md`

## Global Constraints

- Host-Schnittstelle exakt: `truckloadHost.projektGeraete()` → `Promise<Array<{ key, name, anzahl, hersteller?, gewerk?, vwNamen, gewichtKg? }>>`; `key` = `"gdtf:<uuid>"` oder `"vw:<inst_type>"`, wird **unverändert** gespeichert, nie zerlegt (außer zum Umhängen über `vwNamen`). Fehlt die Funktion → kein Knopf, kein automatisches Öffnen.
- **Keine Vorbelegung:** Ohne Klick des Nutzers keine Zuordnung, kein Stück, kein Schreiben am Case. Vorschläge nur, wenn Cases mit diesem `key` in `fasst.geraete` existieren; „Anderes Case suchen …“, „Neues Case“, „Nicht laden“ immer verfügbar.
- Case-Feld `fasst = { stueck: 1..99, geraete: [{ key, name }] }` (optional). Plan-Feld `nyxAbgleich = { geoeffnet: true, nichtLaden: [key…] }` (optional). Stückfelder `nyxGeraet: string`, `nyxStueck: 1..99` (optional, wandern mit wie `tipped`).
- „Verladen“ = Summe `nyxStueck` der Stücke mit `nyxGeraet` im Plan (LKW oder „Ohne LKW“). Jeder Plan gleicht sich selbst ab.
- Reduktion entfernt nur Stücke mit `nyxGeraet`: zuerst ohne LKW, Rest-Stücke (kleineres `nyxStueck`) vor vollen; stehen die nötigen auf LKW → Nutzer fragen (HTML-Dialog).
- Neue Cases aus dem Abgleich → Bibliothek „Meine Sammlung“ (normales `saveCase`), Gewerk aus `gewerk` („licht“ → „Licht“), Gewicht optional mit Vorschlag `fasst.stueck × gewichtKg`.
- Stücke aus dem Abgleich: `tipped: canTip(c)` (wie Lade-Wizard).
- Vorerst nur Scheinwerfer; keine weiteren Gerätearten.
- Keine nativen Dialoge, keine Netzabrufe, kein neuer Store. Texte Deutsch im Code, Englisch in `js/i18n/en.js`.
- Tests mit echten Datenformen; Host-Attrappe liefert genau die abgestimmte Form.

## Review Focus

1. **Host liefert Unerwartetes** (leere Liste, `anzahl` 0, doppelter `key`, fehlendes `vwNamen`, Ablehnung beim Projektwechsel): kein Absturz, verständliche Meldung, nichts geschrieben – Test in Task 4.
2. **Case wird gelöscht oder umbenannt**, nachdem es gemerkt war: Vorschlag verschwindet bzw. zeigt neuen Namen, Stücke mit `nyxGeraet` zählen weiter über `nyxStueck` – Test in Task 3.
3. **Hand angelegtes gleiches Case neben NYX-Stücken:** Reduktion fasst es nie an – Test in Task 3.
4. **Sicherung/Projektdatei-Rundreise** mit allen neuen Feldern, alte Dateien ohne sie laden unverändert – Test in Task 2.
5. **Abbruch mitten im Schritt** (Dialog schließen): keine Stücke, keine `fasst`-Änderung, außer bereits gespeicherten neuen Cases (Spec) – Test in Task 6.

---

### Task 1: Namenserkennung `stueckAusName`

**Files:** Create `js/model/stueckAusName.js` · Test `tests/stueckAusName.test.js`

**Interfaces:** Produces `stueckAusName(name: string) → number | null`.

- [ ] **Step 1: Failing tests** `stueckAusName: Fallsammlung aus der Bibliothek` – Tabelle mit erwarteten Werten, darunter: `"Mac Viper x2 -CAB"` → 2, `"Mac Ultra x1-CAB"` → 1, `"Robe Doppel-Toploader-Case BMFL"` → 2, `"Robe Einzel-Toploader-Case BMFL"` → 1, `"Elation DARTZ 360 6er Roadcase - bestückt"` → 6, `"Laka Loom 5fach -CAB"` → 5, `"Chauvet Professional Rogue R1X Spot (2) Roadcase"` → 2, `"Elation MAXIMUS/MONET 2er FIL Roadcase - 2x Proteus Maximus"` → 2; Fallen: `"Robe Doppel-Toploader-Case CycFX 8"` → 2, `"GLP X4-Bar-20 x4 -CAB"` → 4, `"D8+ 0,5t CAB x12"` → 12, `"Dolly Rack 28 HEx2 -CAB"` → 2, `"Atomic 3000"` → null, `"Packcase 120×60×60"` → null. Zusätzlich: jeder Name aus `data/meine.json` liefert `null` oder 1..99 (kein Wurf, keine 0).
- [ ] **Step 2:** `node --test tests/stueckAusName.test.js` → FAIL.
- [ ] **Step 3:** Implementieren (Regex-Folge: Einzel/Single → 1; Doppel/Double/Dual → 2; `(\d+)\s*(er|fach)\b`; `\(\d+\)`; `\bx\s?(\d+)\b` als eigenes Wort, nicht nach Buchstaben/Bindestrich-Wortteil wie „X4-Bar“; `(\d+)x\s+\S`). Erste Regel mit Treffer gewinnt, Doppel/Einzel vor Zahlen.
- [ ] **Step 4:** Test → PASS; `npm test` grün.
- [ ] **Step 5:** Commit `feat(model): Stückzahl aus dem Case-Namen`.

### Task 2: Neue Felder an Case, Plan und Stück

**Files:** Modify `js/model/pieceFields.js` (`PIECE_FIELDS`, `pickPieceFields`), `js/store/io.js` (`checkCase`, `checkPlan`, Stückprüfung ~136–191) · Test `tests/io.test.js`, `tests/pieceFields.test.js` (falls vorhanden, sonst in io.test.js)

**Interfaces:** Produces: Stückfelder `nyxGeraet` (String 1..200 Zeichen), `nyxStueck` (Ganzzahl 1..99) in `PIECE_FIELDS`/`pickPieceFields`; Case `fasst` geprüft (`stueck` Ganzzahl 1..99, `geraete` Array ≤ 50 von `{ key: String ≤ 200, name: String ≤ 200 }`); Plan `nyxAbgleich` geprüft (`geoeffnet` Boolean optional, `nichtLaden` Array ≤ 500 von String ≤ 200).

- [ ] **Step 1: Failing tests:** `pickPieceFields übernimmt nyxGeraet/nyxStueck`; `autoPack-Placements behalten nyxGeraet/nyxStueck` (über `pickPieceFields` in packer.js, echte Stückform); `io: Case mit fasst ok, fasst.stueck 0 → Fehler`; `io: Plan mit nyxAbgleich ok, nichtLaden kein Array → Fehler`; `io: Stück mit nyxStueck "2" → Fehler`; `io: Rundreise exportBundle → parseBundle behält fasst, nyxAbgleich, nyxGeraet, nyxStueck`; `io: alte Sicherung ohne Felder lädt schlüsselgleich`.
- [ ] **Step 2:** Tests → FAIL.
- [ ] **Step 3:** Felder ergänzen nach den vorhandenen Mustern (`tippedOk`, `groupOk`, `mixTop`-Prüfung).
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5:** Commit `feat(io): Felder für den NYX-Abgleich`.

### Task 3: Abgleichsrechnung (rein)

**Files:** Create `js/model/nyxAbgleich.js` · Test `tests/nyxAbgleich.test.js`

**Interfaces:**
- Consumes: `stueckAusName` (Task 1), Felder aus Task 2, `addUnplaced` (`js/model/actions.js:22`), `canTip` (`js/model/geometry.js:36`).
- Produces:
  - `stueckProCase(c) → number` – `c.fasst?.stueck ?? stueckAusName(c.name) ?? 1`.
  - `bekannteCases(key, cases) → Case[]` – Cases mit `fasst.geraete` ∋ key, aufsteigend nach `stueckProCase`.
  - `umhaengen(geraete, cases) → { cases: Case[] (nur geänderte), alias: Map<vwKey, gdtfKey> }` – für jeden `gdtf:`-Eintrag und jeden Namen in `vwNamen`: Cases mit `vw:<Name>` bekommen den gdtf-key (vw-Eintrag ersetzt).
  - `stand(plan, geraete, alias) → Array<{ key, name, anzahl, verladen, diff, nichtLaden, rest }>` – verladen = Σ `nyxStueck` der Stücke (placements + unplaced, alle LKW) mit `nyxGeraet` = key oder alias→key; `diff = anzahl − verladen`; Keys im Plan ohne NYX-Eintrag erscheinen mit anzahl 0.
  - `aufteilen(anzahl, stueck) → { cases: number, rest: number }`.
  - `stueckeAnlegen(plan, { key, caseId, c, n, stueck }, newId) → plan` – n Stücke per `addUnplaced` mit `tipped: canTip(c)`, dazu `nyxGeraet: key`, `nyxStueck: stueck`.
  - `reduktion(plan, key, minus) → { entfernen: pieceId[], aufLkw: pieceId[] }` – Auswahl nach Global Constraint; `aufLkw` = Teil, der auf LKW steht (Nutzer fragen).
  - `merken(c, key, name) → c` – fügt `{ key, name }` zu `fasst.geraete` hinzu (ohne Doppel), setzt `fasst.stueck` = `stueckProCase(c)`, wenn noch nicht gesetzt.

- [ ] **Step 1: Failing tests** (echte Plan-/Case-Formen): `aufteilen 24/2 → 12/0`, `25/2 → 12/1`; `stand: verladen aus nyxStueck, Rest in Doppelcase zählt 1`; `stand: +4 und −2`; `stand: verschwundener key → anzahl 0, diff = −verladen`; `bekannteCases: nur mit key, sortiert x1 vor x2, gelöschtes Case fehlt` (Review Focus 2); `umhaengen: vw:MAC Viper → gdtf:… bei Name in vwNamen` und Nicht-Treffer bei anderem Namen; zwei vw-Namen auf einen gdtf-key → beide umgeschrieben; `reduktion: zuerst ohne LKW, Rest vor voll` mit Treffer und Nicht-Treffer **daneben** (hand angelegtes gleiches Case ohne `nyxGeraet` bleibt, Review Focus 3); `reduktion: alle auf LKW → aufLkw gefüllt`; `stueckeAnlegen: tipped bei tippbarem Case, nicht bei Rack`; `merken: kein Doppel-Eintrag`.
- [ ] **Step 2:** Tests → FAIL.
- [ ] **Step 3:** Implementieren.
- [ ] **Step 4:** Tests → PASS; `npm test` grün.
- [ ] **Step 5:** Commit `feat(model): Abgleich NYX-Geräte ↔ Plan`.

### Task 4: Host-Zugriff `projektGeraete`

**Files:** Create `js/store/projektGeraete.js` · Test `tests/projektGeraete.test.js`

**Interfaces:** Produces `hatProjektGeraete() → boolean` (`typeof globalThis.truckloadHost?.projektGeraete === 'function'`); `ladeProjektGeraete() → Promise<Geraet[]>` – ruft den Host, prüft die Form, verwirft ungültige Einträge (ohne key/name, anzahl keine Ganzzahl ≥ 0), führt doppelte `key` zusammen (Anzahl addieren, vwNamen vereinen), wirft bei Ablehnung den Host-`Error` weiter.

- [ ] **Step 1: Failing tests** mit Host-Attrappe genau der abgestimmten Form: gültige Liste; leere Liste; Eintrag ohne `vwNamen` → `vwNamen: []`; doppelter key → zusammengeführt; `anzahl: -1`/`"3"` → verworfen; Host lehnt ab („Das Projekt wurde gewechselt …“) → Promise abgelehnt mit derselben Meldung; ohne Funktion → `hatProjektGeraete() === false` (Review Focus 1).
- [ ] **Step 2–4:** FAIL → implementieren → PASS, `npm test`.
- [ ] **Step 5:** Commit `feat(store): Projektgeräte vom NYX-Host lesen`.

### Task 5: Schritt „Geräte → Cases“ im Import-Dialog

**Files:** Modify `js/ui/tabellen-import.js` (neue Ansicht `geraete`, eigene Render-Funktion `geraeteSchrittHtml`), `js/i18n/en.js`, `css/app.css` (zwei Spalten im Stil der übrigen Import-Schritte) · Test `tests/tabellen-import.test.js` (bzw. vorhandene UI-Testdatei des Imports)

**Interfaces:**
- Consumes: Task 3 (`stand`, `bekannteCases`, `aufteilen`, `stueckProCase`).
- Produces: `openTabellenImport(dlg, { …, geraete?: { liste, stand, cases, alias }, neuesCase: async (vorgabe) → Case | null, sucheCase: async (text) → Case | null })`; Ergebnis zusätzlich `zuordnungen: Array<{ key, name, caseId, n, stueck }>`, `nichtLaden: key[]`, `reduktion: Array<{ key, entfernen, aufLkwBestaetigt }>`. Mit `geraete` beginnt die Schrittfolge mit `geraete` und endet wie gehabt (Ziel immer aktueller Plan).

- [ ] **Step 1: Failing tests** für die reinen Render-/Zustandsfunktionen: `geraeteSchrittHtml: links alle Typen mit Anzahl/Stand`; `ohne bekannten key keine Vorschlagsknöpfe, aber „Anderes Case suchen“/„Neues Case“/„Nicht laden“`; `mit bekanntem key Vorschlagsknöpfe sortiert, keiner aktiv`; `Klick auf Vorschlag → Zuordnung n/rest, Rest zeigt erneut Auswahl`; `Zuordnung lösen`; `ohne Klick ist zuordnungen leer` (Global Constraint); Differenzansicht `+4`/`−2` mit Bestätigung.
- [ ] **Step 2–4:** FAIL → implementieren → PASS, `npm test`.
- [ ] **Step 5:** Commit `feat(ui): Schritt Geräte → Cases`.

### Task 6: App-Anbindung, Knopf, automatisches Öffnen, Übernahme

**Files:** Create `js/app/projektGeraeteImport.js` (nach Muster `js/app/tabellenImport.js` `wireTabellenImport`) · Modify `index.html` (Knopf „Aus Projektdatenbank übernehmen“ neben „Tabelle importieren“, Startbildschirm und Plan; Bestätigungsdialog als `<dialog>`), `js/app.js`/Einstieg (Verdrahtung), `js/model/tabellen-uebernahme.js` oder neues `uebernimmGeraete(plan, res, newId, caseById)` in `js/model/nyxAbgleich.js`, `sw.js` ASSETS + `index.html` modulepreload für neue Module, `js/i18n/en.js` · Test `tests/projektGeraeteImport.test.js`, `tests/actions.test.js`

**Interfaces:**
- Consumes: Tasks 3–5, `saveCase` (Muster `js/app/materialScreen.js:62`), `openCaseEditor` (`js/ui/case-editor.js:47`) mit Vorgaben (Name = Gerätename + „Case“, `category: 'Licht'`, `weight` = Vorschlag, `fasst`).
- Produces: `uebernimmGeraete(plan, { zuordnungen, nichtLaden, reduktion }, newId, caseById) → plan` (Stücke anlegen, Stücke entfernen, `nyxAbgleich` setzen); App schreibt danach `merken(...)` je gewähltem Case per `saveCase` und die umgehängten Cases aus `umhaengen`.

- [ ] **Step 1: Failing tests:** `uebernimmGeraete: legt Stücke mit nyx-Feldern an, setzt geoeffnet, nichtLaden`; `entfernt nur bestätigte Reduktionen`; `Abbruch → Plan und Cases unverändert` (Review Focus 5, Aufrufort testen); `automatisch öffnen nur ohne nyxAbgleich.geoeffnet und nur mit hatProjektGeraete()`; `ohne Plan: Abbruch legt keinen Plan an, nächster Start öffnet wieder`.
- [ ] **Step 2–4:** FAIL → implementieren → PASS, `npm test`.
- [ ] **Step 5:** Browser-Abnahme headless (`tools/cdp.mjs`, Szenario im Scratchpad) mit Host-Attrappe `globalThis.truckloadHost = { …, projektGeraete: async () => [...] }` vor dem App-Start; nur neutrale `preset-*`-Cases plus im Test angelegte Cases; prüfen: Dialog öffnet automatisch, Vorschläge erscheinen erst nach gemerkter Zuordnung, Klick → Anzahl/Rest, „Übernehmen und laden“ → Stücke getippt im LKW, erneutes Öffnen zeigt „+n/−n“. Screenshots ansehen.
- [ ] **Step 6:** Commit `feat(app): Aus Projektdatenbank übernehmen`.

### Task 7: Doku, NYX, Version

**Files:** `README.md` (neuer Abschnitt „Aus Projektdatenbank übernehmen“), `docs/architektur.md`, `docs/nyx-projektgeraete.md` (oben Admin-Schritte für das Release: neue Dateien, Kanal `truckload:projektGeraete`, neue Felder, kein Store), `CHANGELOG.md`, Versionsdateien wie bei 0.32.0 (`js/version.js`, `package.json`, `index.html`, `sw.js`, `README.md`) auf 0.33.0.

- [ ] **Step 1:** Doku und Version; `npm test` (version/pwa) grün.
- [ ] **Step 2:** Commit `chore: Version 0.33.0 – Geräte aus NYX übernehmen`.
- [ ] **Step 3 (nach Rückfrage):** Merge, Push, Hinweis-Issue für NYX.

## Self-Review (erledigt)

- Spec-Abdeckung: Ziele 1–5 (T3–T6), Keine Vorbelegung (T5 Tests, Global Constraint), Rest/Differenz/Reduktion (T3, T5, T6), Umhängen (T3), Gewichts-/Gewerk-Vorschlag (T6), Getippt (T3), Je Plan (T3 `stand`), Namenserkennung (T1), Datenfelder/Rundreise (T2), Host (T4), NYX/Doku (T7).
- Namen konsistent: `stueckAusName`, `stueckProCase`, `bekannteCases`, `umhaengen`, `stand`, `aufteilen`, `stueckeAnlegen`, `reduktion`, `merken`, `hatProjektGeraete`, `ladeProjektGeraete`, `uebernimmGeraete`, Felder `fasst`, `nyxAbgleich`, `nyxGeraet`, `nyxStueck`.
- Abnahmen mit Treffer und Nicht-Treffer: Reduktion (NYX-Stück vs. Hand-Case), Umhängen (Name in vwNamen vs. anderer), Tippen (tippbar vs. Rack), Vorschläge (bekannt vs. unbekannt).
