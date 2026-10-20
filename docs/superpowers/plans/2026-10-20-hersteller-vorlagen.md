# Hersteller-Vorlagen Licht, Pulte, Racks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `data/standard.json` bekommt Vorlagen für Licht-Cases (Robe, Elation, Chauvet), Pulte (DiGiCo) und Amp-Racks (d&b); alles, was die Datenbank noch nicht hat.

**Architecture:** Reine Daten. Die Rohlisten werden außerhalb des Repos (Scratchpad) geholt und per Skript in das Preset-Schema umgerechnet; im Repo landen nur die fertigen Einträge in `data/standard.json`, ein erweiterter Test und die Doku. Kein neuer Code, kein neuer Store, keine neue Datei unter `js/`, `css/`, `data/`, `icons/`, `vendor/` (deshalb bleibt `sw.js` bis auf den Cache-Namen unverändert).

**Tech Stack:** `node --test`, Python 3 (`-I`) nur für das Skript im Scratchpad, JSON.

**Spec:** Abgestimmt im Chat am 2026-10-20 (kein Spec-Dokument). Entscheidungen des Nutzers: alles, was fehlt, anlegen; Ablageort „Standard“; Traversen sind ein getrenntes Projekt; kleine Koffer, Zarges, Case-Bauer, Trucks bleiben draußen; Wagen baut der Nutzer selbst aus Einzelboxen.

## Global Constraints

- Nirgendwo im Repo (Daten, Doku, CHANGELOG, Testnamen, Commit-Texte, Issues) steht der Name der Quellseite. Das Feld `note` ist leer oder nennt nur den fachlichen Zustand („Gewicht unbekannt“). (Nutzervorgabe 2026-10-20)
- Das Gewichtsfeld heißt „Gewicht beladen (kg)“. Steht für ein Case kein belegtes Beladungsgewicht fest, ist `weight` 0 und `note` = `Gewicht unbekannt`. Nie schätzen oder rechnen. (CLAUDE.md „Haltung“)
- Keine npm-Abhängigkeiten, kein Build-Schritt. Oberfläche und Case-Namen deutsch (Nutzervorgabe 2026-10-20); Produktnamen der Hersteller bleiben unverändert. Die neuen Cases sind tippbar und haben Rollen (Nutzervorgabe).
- Bestehende Einträge in `data/standard.json` bleiben unverändert (Reihenfolge, Werte, Format). Neue Einträge werden hinten angehängt.
- Alte Daten laden weiter: keine Änderung an Feldern oder IDs vorhandener Vorlagen.
- Eine Versionsnummer überall (`js/version.js`, `package.json`, `README.md`, `index.html`, Cache-Name in `sw.js`, oberster CHANGELOG-Eintrag). Der Patch-Schritt (0.17.3) wird vor dem Commit vom Nutzer bestätigt.
- Subagenten starten die App nicht; die Abnahme im Browser macht die Hauptsession.

## Review Focus

- Doppelte Namen oder IDs bei Hersteller-Varianten (DiGiCo hat viele Modelle mit identischen Maßen): IDs müssen eindeutig sein, das Skript bricht bei Kollision ab.
- Namen mit Sonderzeichen (™, ®, `/`, Umlaute): die ID bleibt `[a-z0-9-]`, die Namenslänge bleibt unter dem App-Limit.
- Einträge mit fehlenden oder nicht lesbaren Werten (Maß oder Gewicht `null`, `-`): kein Eintrag mit geratenem Wert, Skript bricht ab statt 0 einzusetzen (außer beim dokumentierten Fall „Gewicht unbekannt“).
- Leer- und Beladen-Zeilen desselben Cases (Elation): nur eine Zeile je Case, nie beide.
- Rundung: Zoll und Pfund werden einmal am Ende auf eine Nachkommastelle gerundet, nicht über Zwischenwerte.

---

### Task 1: Rohdaten holen (Scratchpad, nicht im Repo)

**Files:**
- Create (Scratchpad, nicht committen): `<scratchpad>/hersteller/holen.py`, `<scratchpad>/hersteller/rohdaten/<slug>.json`

**Interfaces:**
- Produces: je Hersteller `rohdaten/<slug>.json` = Liste von `{ "name": str, "l_in": float, "w_in": float, "h_in": float, "weight_lb": float|null, "kategorie": str }` in der Reihenfolge der Quelle. Slugs: `robe`, `elation`, `chauvet-pro`, `digico`, `db-audio`, `l-acoustics`, `eaw`, `jbl-vtx`.

- [ ] **Step 1: Skript schreiben.** `holen.py` liest für jeden Slug die öffentlich erreichbare Herstellerseite (ein Abruf je Slug, `User-Agent` eines normalen Browsers, 2 s Pause dazwischen), zieht die eingebetteten JSON-LD-Produktdaten (`@graph` → `ItemList` → `itemListElement[].item`, Felder `name`, `depth`=Länge, `width`, `height`, `weight`, `category`) und schreibt die Rohdatei. Fehlende Werte bleiben `null`.
- [ ] **Step 2: Ausführen und Zahl der Zeilen prüfen.** Erwartet: robe 72, elation 12, chauvet-pro 9, digico 40, db-audio 22, l-acoustics 31, eaw 29, jbl-vtx 9. Weicht eine Zahl ab, melden statt anpassen.
- [ ] **Step 3: Stichprobe.** `rohdaten/elation.json` enthält `{"name":"DARTZ 360 6-Pack Road Case - loaded","l_in":44.4,"w_in":22.6,"h_in":32.6,"weight_lb":283}`; `rohdaten/digico.json` enthält `QUANTUM338 flightcase` mit 67.6 × 25.3 × 45 in und 436.5 lb.

(Kein Commit: nichts davon gehört ins Repo.)

### Task 2: Umrechnung und Auswahl (Scratchpad)

**Files:**
- Create (Scratchpad): `<scratchpad>/hersteller/bauen.py`, `<scratchpad>/hersteller/neue-presets.json`

**Interfaces:**
- Consumes: `rohdaten/*.json` aus Task 1.
- Produces: `neue-presets.json` = Liste von Preset-Objekten im Schema der vorhandenen Vorlagen, in dieser Reihenfolge: Robe, Elation, Chauvet, DiGiCo, d&b.

- [ ] **Step 1: Umrechnung.** `cm(in) = round(in * 2.54, 1)`, `kg(lb) = round(lb * 0.45359237, 1)`, jeweils einmal am Ende. Bekannte Werte: 44.4 in → 112.8, 22.6 in → 57.4, 32.6 in → 82.8, 283 lb → 128.4.
- [ ] **Step 2: Auswahl je Hersteller.**
  - `robe`: alle Zeilen. `weight` immer 0, `note` = `Gewicht unbekannt`.
  - `elation`: eine Zeile entfällt, wenn eine andere Zeile mit `name + " - "` beginnt (das Leer-Case, zu dem es beladene Varianten gibt). Übrig bleiben die 8 Zeilen mit Inhalt, `weight` = Gewicht der Zeile, `note` = `""`.
  - `chauvet-pro`: alle Zeilen. Nur `Epix Line 10 IP 10-Pack Road Case` (176 lb, beladen) behält sein Gewicht (79.8 kg); die übrigen 8 bekommen `weight` 0 und `note` = `Gewicht unbekannt`.
  - `digico`: alle Zeilen, `weight` aus der Zeile.
  - `db-audio`: nur Zeilen mit Kategorie `Audio - Amps & Processing` (15); die 7 `Touring cart …` entfallen. `weight` aus der Zeile.
  - `l-acoustics`, `eaw`, `jbl-vtx`: werden nicht angelegt (Task 5).
- [ ] **Step 3: Felder.** `id` = `preset-<hersteller-kurz>-<slug(englischer Quellname ohne ™ ®)>` mit `slug` = Kleinbuchstaben, alles außer `[a-z0-9]` → `-`, mehrfache `-` zusammen (die ID hängt am Quellnamen, nicht an der Übersetzung, und bleibt damit stabil); `builtin: true`; `content: ""`; `category`: Licht für Robe, Elation, Chauvet, Ton für DiGiCo und d&b; `color` = Farbe der Kategorie aus `js/data/categories.js` (Licht `#e8b10c`, Ton `#3b7dd8`); `tippable: true`; `stackable: true`; `maxTopLoad: null`; `stock: null`; `wheelH: 13`; `dimsInclWheels: true` (wie die vorhandenen Packcase-Vorlagen; Nutzerangabe: die Cases sind tippbar und haben Rollen; Rollenhöhe 13 cm ist der Richtwert der Packcases, keine Herstellerangabe). Bricht ab bei: doppelter ID, Name länger als die Grenze der App (siehe `nameTooLong` in `js/store/io.js`), fehlendem Maß.
- [ ] **Step 3b: Deutsche Namen.** Name = Herstellername (`Robe`, `Elation`, `Chauvet Professional`, `DiGiCo`, `d&b`) + Leerzeichen + übersetzter Quellname ohne ™ und ®. Übersetzt werden nur diese Begriffe, in dieser Reihenfolge (Groß-/Kleinschreibung des Treffers egal), alles andere (Produktnamen wie BMFL, Pointe, QUANTUM338, DARTZ 360, Modellcodes) bleibt unverändert:

  | Quelle | Name |
  |---|---|
  | `Single Top Loader Case` | `Einzel-Toploader-Case` |
  | `Dual Top Loader Case` | `Doppel-Toploader-Case` |
  | `Triple Top Loader Case` | `Dreifach-Toploader-Case` |
  | `Quad Top Loader Case` | `Vierfach-Toploader-Case` |
  | `Six-Pack Top Loader Case` | `Sechser-Toploader-Case` |
  | `Eight-Pack Top Loader Case` | `Achter-Toploader-Case` |
  | `6-Pack Road Case` / `4-PACK ROAD CASE` / `2PK ROAD CASE` | `6er Roadcase` / `4er Roadcase` / `2er Roadcase` |
  | `10-Pack Road Case` | `10er Roadcase` |
  | `Road Case` | `Roadcase` |
  | `flightcase` | `Flightcase` |
  | `Touring Rack` / `Touring rack` | `Touring-Rack` |
  | `assembly` | `Aufbau` |
  | `- loaded` am Ende | `- bestückt` |
  | `Rack` (allein, z. B. `CP Rack`) | `Rack` (bleibt) |
  | `Hybrid`, `Wash`, `Spot`, `Profile` (Lampentypen) | bleiben unverändert |

  Danach gibt das Skript alle Namen sortiert aus, und die Hauptsession liest sie durch. Jedes noch englische Wort, das kein Produktname ist, kommt als weitere Ersetzung in die Tabelle (Bericht an die Hauptsession, nicht stillschweigend).
- [ ] **Step 4: Ausführen.** Erwartet: 72 + 8 + 9 + 40 + 15 = **144** Einträge. Stichprobe in `neue-presets.json`: `Elation DARTZ 360 6er Roadcase - bestückt` (ID `preset-elation-dartz-360-6-pack-road-case-loaded`) = 112.8 × 57.4 × 82.8 cm, 128.4 kg; `Robe Einzel-Toploader-Case Pointe` (ID `preset-robe-single-top-loader-case-pointe`) = 43.4 × 40.1 × 69.1 cm, Gewicht 0 mit `Gewicht unbekannt`; `DiGiCo QUANTUM338 Flightcase` (ID `preset-digico-quantum338-flightcase`) = 171.7 × 64.3 × 114.3 cm, 198.0 kg. Alle Einträge sind `tippable: true`, `wheelH: 13`.

(Kein Commit.)

### Task 3: In `standard.json` einfügen, Test erweitern

**Files:**
- Modify: `data/standard.json` (nur Anfügen)
- Modify: `tests/dataJson.test.js`

**Interfaces:**
- Consumes: `neue-presets.json` aus Task 2; `checkCase` aus `js/store/io.js`.

- [ ] **Step 1: Test zuerst ändern (rot).** In `tests/dataJson.test.js` die Anzahl in `standard.json: Format, ID, 57 Vorlagen …` auf 201 (57 + 144) ändern und den Testnamen anpassen. Neue Tests: (a) `neue Hersteller-Vorlagen: jede besteht checkCase` (alle Einträge ab Index 57, `checkCase(c)` wirft nicht); (b) `Beispielwerte`: die Einträge `preset-elation-dartz-360-6-pack-road-case-loaded` (112.8 / 57.4 / 82.8 / 128.4; IDs bleiben englisch, Namen sind deutsch) und `preset-digico-quantum338-flightcase` (171.7 / 64.3 / 114.3 / 198) haben genau diese Werte; (c) `Gewicht unbekannt ist 0`: jeder Eintrag der neuen Vorlagen mit `note === 'Gewicht unbekannt'` hat `weight === 0` und jeder mit `weight === 0` trägt diese Notiz; (d) `Robe`: alle 72 Robe-Vorlagen haben `weight === 0`; (e) `Eigenschaften`: alle neuen Vorlagen sind `tippable === true` mit `wheelH === 13` und `dimsInclWheels === true`; (f) `deutsche Namen`: kein neuer Name enthält `Top Loader`, `Road Case`, `flightcase`, `Single`, `Dual`, `Pack`, `loaded` oder `™`/`®`, und `Robe Einzel-Toploader-Case Pointe`, `Elation DARTZ 360 6er Roadcase - bestückt` und `DiGiCo QUANTUM338 Flightcase` kommen mit genau diesen Namen vor.
- [ ] **Step 2: `npm test` laufen lassen.** Erwartet: die geänderten Tests schlagen fehl (Anzahl 57 ≠ 201 usw.).
- [ ] **Step 3: Einträge anfügen.** Per Skript im Scratchpad: `standard.json` laden, die 144 Einträge ans Ende von `cases` hängen, mit derselben Einrückung und Zeichenkodierung (UTF-8, Umlaute unverändert, Zeilenende wie bisher) zurückschreiben. Danach `git diff --stat data/standard.json` prüfen: nur hinzugefügte Zeilen, keine entfernten oder geänderten; `git diff data/standard.json | grep '^-' | grep -v '^---'` ist leer (bis auf die schließende Klammerzeile, falls das Anfügen das Komma ändert).
- [ ] **Step 4: `npm test`.** Erwartet: alles grün. Schlägt ein anderer Test wegen der Anzahl der Vorlagen fehl, zeigt der Fehler, wo die Zahl steht; nur Zahlen anpassen, nie Logik.
- [ ] **Step 5: Prüfung auf Quellenangaben.** `grep -rniE "truck ?packer|truckpacker|backline" data docs tests js CHANGELOG.md README.md` bleibt leer (Ausnahme: die Plan-Datei selbst enthält den Namen nicht).
- [ ] **Step 6: Commit.** `git add data/standard.json tests/dataJson.test.js` und committen: `feat(daten): Hersteller-Vorlagen Licht, Pulte und Racks (144)` mit der Co-Author-Zeile aus der Sitzung.

### Task 4: Doku und Version (Hauptsession, nach Freigabe der Nummer)

**Files:**
- Modify: `docs/casemasse-gewichte.md`, `docs/architektur.md` (Zeile zu `data/standard.json`, Anzahl 57 → 201), `CHANGELOG.md`, `js/version.js`, `package.json`, `README.md`, `index.html`, `sw.js` (nur Cache-Name)

- [ ] **Step 1:** Abschnitt in `docs/casemasse-gewichte.md`: Umrechnung (Zoll × 2,54, Pfund × 0,45359237, eine Nachkommastelle), die Auswahlregeln aus Task 2 Step 2, die eigenen Annahmen aus Step 3 (tippbar, stapelbar, Rollenhöhe 13 cm wie die Packcases), die Übersetzungstabelle der Namen, und dass 0 kg „unbekannt“ heißt. Keine Quellenangabe.
- [ ] **Step 2:** Anzahl in `docs/architektur.md` (Tabelle zu `data/standard.json`) auf 201 und die Beschreibung um die neuen Gruppen ergänzen.
- [ ] **Step 3:** Versionsnummer (Patch 0.17.3, vom Nutzer zu bestätigen) an allen sechs Stellen, CHANGELOG-Eintrag „Hersteller-Vorlagen für Licht, Pulte und Racks“.
- [ ] **Step 4:** `npm test` grün (`tests/version.test.js`, `tests/pwa.test.js`), dann Commit `docs: Hersteller-Vorlagen, Version 0.17.3`.

### Task 5: Boxen von L-Acoustics, EAW, JBL (Bericht, kein Anlegen)

**Files:**
- Create (Scratchpad): `<scratchpad>/hersteller/kandidaten.md`

- [ ] **Step 1:** Aus `rohdaten/l-acoustics.json`, `eaw.json`, `jbl-vtx.json` alle Zeilen listen, deren Name nicht auf Wagen oder Transporter hindeutet (nicht `Chariot`, `Touring cart`, `Roadcase`, `Production Case`, `VT`, `Flybar`). Je Zeile: Name, Maße in cm, Gewicht in kg.
- [ ] **Step 2:** Gegen die vorhandenen Ton-Vorlagen (`preset-k2`, `preset-ks28`, …) abgleichen: Name und Maß/Gewicht stimmen / weichen ab / fehlt. **Nichts in `standard.json` ändern.** Ergebnis der Hauptsession berichten; der Nutzer entscheidet, was ergänzt wird.

### Task 6: Abnahme im Browser (Hauptsession)

- [ ] **Step 1:** Mit `tools/cdp.mjs` im Lade-Assistenten nach „Dual Top Loader“ suchen und den Gewerk-Filter „Licht“ setzen; Screenshot aller Treffer. Erwartet: die Robe-Cases erscheinen, Gewicht 0 kg ohne Absturz.
- [ ] **Step 2:** Ein Elation-Case in einen Plan legen und packen; Screenshot des Fahrzeugs, das das Case zeigt (Fallstrick 3D: Prüf-Fahrzeug nur wenig größer als das Case).
- [ ] **Step 3:** Abnahme melden; Veröffentlichen erst nach Freigabe (`finishing-a-development-branch`).
