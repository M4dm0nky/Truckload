# Truckload V 0.7.0 – alle 75 Review-Befunde beheben

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps mit `- [ ]`.

## Context

Zum Meilenstein V 0.6.0 wurde der gewachsene Bestand erstmals **im Ganzen** geprüft statt
Diff für Diff: 3.569 Zeilen Anwendungscode, 1.828 Zeilen Tests, in drei parallelen Reviews
(Modell, Oberfläche, Daten und Verdrahtung). Ergebnis: **75 Befunde — 7 blockierend,
25 wichtig, 24 Kleinigkeiten, 19 Vorschläge.** Der vollständige Bericht liegt in
`docs/code-review-2026-09-21.md` und ist die **verbindliche Befundliste** für diesen Plan.

Der Nutzer hat entschieden: alles beheben.

Drei Befunde können Daten kosten und sind der Grund für die Reihenfolge:

1. Eine präparierte Importdatei macht die App **dauerhaft unstartbar** — `checkPlan` prüft
   `updatedAt` nicht, und die Sortierung in `app.js:30` wirft beim nächsten Start.
   `app.js` ist ein Top-Level-`await`-Modul ohne Fehlerbehandlung, die Seite bleibt tot.
2. Der Autosave setzt `lastSaved` **vor** dem Schreiben und ignoriert dessen Fehlschlag;
   zusätzlich fehlt jeder Flush beim Schließen des Fensters.
3. Die Beschriftung landet am falschen Case, weil `change` erst beim Fokusverlust feuert,
   `withSel` dann aber schon die neue Auswahl liest.

Alle drei sind vom Controller selbst nachgerechnet und bestätigt.

## Entscheidungen (vom Nutzer bestätigt)

- **Import:** Vor jedem Import lädt die App still eine Sicherungsdatei des aktuellen Stands
  herunter.
- **Gewichtslose Cases:** Im Inspector und im Druck steht „N Cases ohne Gewicht“ neben der
  Nutzlast. Fällt der Schwerpunkt mangels Gewichten aus, wird er ersatzweise über das
  Volumen gerechnet und als solcher gekennzeichnet.
- **Zwei Tabs:** Die App erkennt über den Browser-Kanal einen zweiten offenen Tab und
  blendet einen Hinweis ein. Kein Abgleich der Stände.
- Version **0.7.0**, Tag `v0.7.0`, Deploy über GitHub Pages.

## Global Constraints

- Keine npm-Abhängigkeiten, kein Build-Schritt. Reine ES-Module, Tests mit `node --test`.
- Nutzereingaben in HTML nur über `esc()`; in SVG Text nur über `textContent`. **`esc()`
  schützt nicht innerhalb von `style="…"`** — Farbwerte gehören gegen ein Muster geprüft.
- UI-Deutsch mit „…“-Anführungszeichen. Begriff „tippen“, nie „kippen“.
- `npm test` (239 grün) bleibt grün und wächst.
- Eine Versionsnummer überall (`js/version.js`), per `tests/version.test.js` erzwungen.
- Offline-Asset-Liste in `sw.js` vollständig (`tests/pwa.test.js`).
- Alte Ladepläne und Cases laden unverändert; jede Änderung am Datenmodell braucht einen
  Regressionstest mit einem Datensatz im alten Schema.
- **Jeder Task nennt am Ende, welche Befund-Nummern er erledigt hat.** Kein Befund darf
  stillschweigend entfallen; was bewusst offen bleibt, wandert begründet nach
  `docs/offene-punkte.md`.

## Architektur in einem Absatz

Es entsteht kein neues Teilsystem. Die Arbeit ist Härtung an drei Stellen: `js/store/io.js`
wird zur belastbaren Grenze gegen fremde Dateien, `js/app.js` bekommt ein verlässliches
Speicher- und Fehlerverhalten, und im Modell werden zwei Rechenfehler behoben, die
Bibliotheksdaten betreffen (überlappende Rollen bei schmalen Cases, ein Füllgrad-Score,
der die eigene 4-Lagen-Grenze nicht kennt). Dazu kommt das Zusammenführen doppelt
geschriebener Logik und eine Testschicht, die Rückbauten wirklich rot werden lässt.

---

### Task 1: Die Grenze gegen fremde Dateien (`io.js`)

**Files:** `js/store/io.js`, `tests/io.test.js`

Befunde: Daten-1 (blocking), Daten-4, Daten-6, UI-B2 (blocking), Daten-14, Daten-15,
Daten-17, Daten-20, Daten-21.

- `checkPlan`: `updatedAt` muss — falls vorhanden — eine Zeichenkette sein. Ebenso bei
  Cases, Fahrzeugen und Plänen. Das ist der Absturzpfad aus dem Context.
- `checkCase`: `color` gegen `/^#[0-9a-fA-F]{6}$/` prüfen (wie es `checkPlan` für
  Stück-Farben längst tut). Ohne das legt sich ein importiertes Case als
  `position:fixed`-Fläche über die Oberfläche.
- `checkCase`: Obergrenzen für `l`, `w`, `h`, `weight`, `wheelH`, `maxTopLoad`, `stock` —
  und `wheelH < h` auch dann erzwingen, wenn `dimsInclWheels` fehlt.
- `checkPlan`: Stück-IDs müssen innerhalb eines Plans eindeutig sein; `notes` muss, falls
  vorhanden, eine Zeichenkette sein.
- `mergeById`: `updatedAt` nur vergleichen, wenn **beide** Seiten Zeichenketten sind; sonst
  gewinnt der lokale Stand. Heute schlägt ein Objekt als `'[object Object]'` jeden
  Zeitstempel.
- `parseBundle`: IDs, die mit `preset-` oder `lib-` beginnen, werden aus fremden Dateien
  verworfen (bisher nur `preset-`).
- `parseBundle`: Verweise prüfen — ein Plan, der auf ein nicht enthaltenes und lokal
  unbekanntes Case oder Fahrzeug zeigt, wird gemeldet statt still übernommen.
- Ein Bundle, das sich zwar parsen lässt, aber keinen einzigen gültigen Datensatz enthält,
  wird als Fehler gemeldet, nicht als leerer Import.
- Tests je Punkt, jeweils mit einem Bundle, das genau diesen Fehler trägt.
- [ ] TDD, Commit `fix: Import gegen fehlerhafte und präparierte Dateien härten`

### Task 2: Speichern, Laden und Fehlerverhalten (`app.js`, `repo.js`, `db.js`)

**Files:** `js/app.js`, `js/store/db.js`, `js/store/repo.js`, `index.html`,
`tests/repo.test.js`, `tests/io.test.js`

Befunde: Daten-2 (blocking), Daten-3 (blocking), Daten-5, Daten-7, Daten-10, Daten-11,
Daten-16, Daten-22, Daten-23.

- **Autosave:** `lastSaved` erst nach erfolgreichem Schreiben setzen, die Rejection von
  `repo.savePlan` behandeln und dem Nutzer sichtbar melden. Ein fehlgeschlagener
  Schreibvorgang darf nicht dazu führen, dass alles Folgende stillschweigend verworfen wird.
- **Flush beim Verlassen:** Auf `pagehide` und `visibilitychange` (`hidden`) eine
  ausstehende Speicherung sofort ausführen.
- **Import:** Vor dem Überschreiben still eine Sicherungsdatei des aktuellen Stands
  herunterladen (Name wie `backupFileName`, ergänzt um `-vor-import`). Danach der
  bisherige Ablauf. Den Lese-dann-Schreiben-Ablauf über die `await`-Grenzen hinweg so
  umbauen, dass zwischenzeitliche Änderungen nicht verlorengehen.
- **Zweiter Tab:** Über `BroadcastChannel` erkennen, dass eine weitere Instanz läuft, und
  einen Hinweis in der Oberfläche einblenden („Truckload ist in einem weiteren Tab offen —
  Änderungen können sich gegenseitig überschreiben“).
- **Startfehler:** `loadAll()` in eine Fehlerbehandlung fassen, die statt einer weißen
  Seite eine verständliche Meldung samt Hinweis auf „Importieren“ zeigt.
- Der `catch` um die 3D-Ansicht darf nicht auch Fehler aus `update()` verschlucken.
- Ein gelöschtes Fahrzeug darf andere Pläne nicht mit einem toten Verweis zurücklassen.
- [ ] TDD wo möglich, `node --check`, Commit `fix: Speichern, Import und Startfehler absichern`

### Task 3: Rechenfehler im Modell

**Files:** `js/model/caseShape.js`, `js/model/packer.js`, `js/model/truss.js`,
`js/model/validate.js`, `js/model/geometry.js`, zugehörige Tests

Befunde: Modell-1 bis Modell-6, Modell-„Division durch null“, Modell-`wheelFace`-`undefined`.

- **`caseShape`:** Rollendurchmesser und Randabstand begrenzen, sodass die vier Rollen bei
  keiner Kantenlänge ineinanderlaufen. `trussShape` macht das bereits richtig — dieselbe
  Begrenzung übernehmen. Betroffen sind die echten Bibliotheks-Cases `AF-1 -CAB` (44×23×58)
  und `SF TourHazer II -CAB` (53×25×41).
- **`packer.chooseOrientation`:** Der Füllgrad-Score rechnet mit `Math.floor(truck.h / dz)`
  Lagen, obwohl `buildStacks` nie höher als vier stapelt. Die Lagenzahl im Score auf
  dieselbe Grenze deckeln. Wirkung: ein flaches 120×60×30-Case wird künftig getippt statt
  gestellt; 24 Stück brauchen 1,20 statt 2,40 Lademeter.
- **`validate`:** Placements mit fehlendem Case-Typ nehmen an keiner Kollisionsprüfung teil,
  und `packAll` packt in sie hinein. Sie müssen als Hindernis zählen.
- **`validate`:** Alle Meldungstexte nennen `it.c.name` statt der Stück-Beschriftung
  `it.label` — entgegen der Zusage in `docs/architektur.md`.
- **`validate`:** Ein getippter Traversenwagen meldet „darf nicht getippt werden“, obwohl
  die Geometrie die Lage gar nicht auswertet. Entweder die Lage auswerten oder die Meldung
  richtigstellen.
- **`truss.trussDims`:** Die Breitengrenze erzwingen, die die Funktion selbst voraussetzt.
- Division durch null bei einer Grundfläche von 0; `wheelFace` bei einem `rot` außerhalb
  0/90/180/270.
- [ ] TDD, Commit `fix: Rollenüberlappung, Packer-Score und Prüfmeldungen im Modell`

### Task 4: Gewichtslose Cases sichtbar machen

**Files:** `js/model/validate.js`, `js/ui/inspector.js`, `js/ui/print.js`, Tests

Befund: Daten-8.

- `validatePlan` liefert zusätzlich `totals.withoutWeight` (Anzahl der Stücke, deren
  Case-Typ 0 kg wiegt).
- Fällt der Schwerpunkt mangels Gewicht aus, wird er ersatzweise über das **Volumen**
  gerechnet; `totals.cog` trägt dann eine Kennzeichnung, und die Einseitigkeitsprüfung
  läuft darauf weiter.
- Inspector und Druck zeigen neben der Nutzlast „N Cases ohne Gewicht“; ein über das
  Volumen gerechneter Schwerpunkt wird als solcher benannt.
- [ ] TDD, Commit `feat: Cases ohne Gewicht werden sichtbar, Schwerpunkt ersatzweise über Volumen`

### Task 5: Oberfläche – die blockierenden und wichtigen Befunde

**Files:** `js/ui/inspector.js`, `js/app.js`, `js/ui/case-editor.js`,
`js/ui/load-wizard.js`, `js/ui/view3d.js`, `js/ui/print.js`, `js/ui/library.js`

Befunde: UI-B1 (blocking), UI-B3 (blocking), UI-B4 (blocking), UI-I1 bis UI-I8.

- **B1 — Beschriftung am falschen Case:** Das Eingabefeld muss die ID des Stücks tragen, zu
  dem es gehört, und der Handler diese ID benutzen statt der aktuellen Auswahl.
- **B3 — Rollenhöhe:** Der Case-Editor muss verhindern, dass `wheelH` die Case-Höhe
  erreicht oder überschreitet; sonst erzeugt die App ein Case, das ihr eigener Import
  ablehnt und damit das **gesamte** Bündel unlesbar macht.
- **B4 — Vorbelegte Beschriftung:** Der Wizard bildet `"<Name> <n>"`, ohne auf die
  40-Zeichen-Grenze zu achten. Der Editor erlaubt Namen bis 80 Zeichen, also reicht jeder
  Name über 37 Zeichen. Beim Bilden kürzen, nicht erst beim Speichern.
- **I1** 3D-Beschriftung wird auf nicht-quadratischen Flächen verzerrt.
- **I2** Auf dem Ausdruck wird keine Beschriftung gekürzt.
- **I3/I4** `TUBE_R_RATIO` und `DETAIL_MIN` stehen je zweimal — eine Quelle daraus machen.
- **I5** In 3D fehlt die Nummer des Stücks.
- **I6** Kein Abbau der 3D-Ansicht; der Fehlerpfad verliert WebGL-Kontexte.
- **I7** Ein ausgeblendetes Pflichtfeld blockiert „Speichern“ ohne Rückmeldung.
- **I8** Tote Erreichbarkeitsprüfung bei der Rollenrichtung.
- [ ] `node --check`, `npm test`, Browser-Abnahme, Commit `fix: Beschriftungsziel, Eingabegrenzen und 3D-Darstellung`

### Task 6: Doppelt geschriebene Logik zusammenführen

**Files:** `js/model/packer.js`, `js/model/validate.js`, `js/model/geometry.js`,
`js/store/io.js`, `js/ui/library.js`, `js/ui/load-wizard.js`, `js/ui/view2d.js`,
`js/ui/view3d.js`, `js/model/actions.js`

Befunde: Modell-`withFloor`/`withoutFloor`, Modell-`ROTATIONS` zweimal, Modell-`isTruss`
ungenutzt, Modell-`otherBoxes` ruft `buildItems` doppelt, Modell-Radkastenseiten stringly
typed, Modell-zwei Rollen-Generatoren, UI-S1 (`swatch()`), UI-S2 (dreiteilige Liste),
UI-S3 (Textmetrik), UI-N4, UI-N5, UI-N6.

Jede Zusammenführung einzeln und mit laufenden Tests. Wo eine Vereinheitlichung das
Verhalten ändern würde, **nicht** zusammenführen, sondern den Unterschied kommentieren.

- Die Ablage zeigt die Gewerkfarbe, obwohl daneben die Stück-Beschriftungen stehen — sie
  muss die Stück-Farbe zeigen (Befund des Controllers).
- Zehn Exporte sind öffentlich, obwohl sie nur in ihrer eigenen Datei benutzt werden
  (`SUPPORT_MIN`, `IMBALANCE_RATIO`, `loadSequence`, `layerMap`, `FORMAT`, `VERSION`,
  `DOLLY_WHEEL_D` und drei aus `app.js`). Wo sie nur für Tests offen sind, gehört ein
  Kommentar daran; sonst privat machen.
- [ ] `npm test`, Commit `refactor: doppelt geschriebene Logik zusammenführen`

### Task 7: Tests, die Rückbauten wirklich rot werden lassen

**Files:** `tests/packer.test.js`, `tests/geometry.test.js`, `tests/actions.test.js`,
`tests/validate.test.js`, `tests/caseShape.test.js`, `tests/truss.test.js`,
`tests/pwa.test.js`

Befunde: Modell-Testlücken (alle), Daten-13, UI-S6.

Ein Mutationslauf hat vier Rückbauten gefunden, die **grün bleiben**. Für jeden gilt: erst
den Rückbau vornehmen, den neuen Test schreiben, belegen dass er rot wird, Rückbau
zurücknehmen, belegen dass er grün ist. Die Belege gehören in den Bericht.

1. Der 4-Lagen-Deckel im Packer — der gleichnamige Test scheitert in Wahrheit an der
   Truckhöhe.
2. `EPS = 0.5` → `0.05` — die Toleranz ist nirgends angefasst.
3. `touch()` ohne `updatedAt` — worauf `mergeById` beim Import beruht, also stiller
   Datenverlust.
4. Die Ladereihenfolge innerhalb eines Stapels (`loadSequence`).

Dazu: tautologische Stellen in `truss.test.js` durch harte Literale ersetzen;
`caseShape.test.js` um schmale Cases und alle Lagen erweitern; Radkasten als Auflage in
`validate.test.js`; der Schwerkraftanteil in `moveGroup`; `tests/pwa.test.js` auch über
`css/` und `icons/` führen.

- [ ] TDD mit Mutationsnachweis, Commit `test: Lücken schließen, die Rückbauten durchgelassen haben`

### Task 8: Die restlichen Kleinigkeiten

**Files:** quer durch `js/ui/`, `js/app.js`, `index.html`, `js/model/actions.js`

Befunde: alle verbleibenden `[nit]` und `[suggestion]` aus den drei Berichten, die nicht in
den Tasks 1 bis 7 stecken — unter anderem UI-N1, N2, N3, N7, N8, N9, N10, N11, UI-S4, S5,
S7, Daten-9, Daten-12, Daten-18, Daten-19, Modell-`nextLabel`, Modell-`removeUnplaced`,
Modell-`duplicate` über die Heckkante, Modell-`reorient` lässt den Stapel stehen,
Modell-Schwerpunkt nur in y geprüft, Modell-`placeCase` sechs Parameter,
Modell-`srcExtra`, Modell-`code` nur von Tests gelesen, Modell-`if (is.placementId)`.

Der Task-Brief listet sie einzeln auf. Was sich als nicht sinnvoll erweist, wandert
begründet nach `docs/offene-punkte.md` statt still zu entfallen.

- [ ] `npm test`, Commit `fix: Kleinigkeiten aus der Meilenstein-Review`

### Task 9: Version 0.7.0, Prüfung, Veröffentlichung

**Files:** `js/version.js`, `package.json`, `README.md`, `index.html`, `sw.js`,
`CHANGELOG.md`, `docs/offene-punkte.md`, `docs/architektur.md`

- Version `0.7.0` überall, Cache-Name in `sw.js`, CHANGELOG-Eintrag auf Deutsch mit den
  spürbaren Änderungen: Import-Sicherung, Hinweis auf gewichtslose Cases, geänderte
  Auto-Beladung bei flachen Cases, Hinweis bei zweitem Tab.
- `docs/offene-punkte.md` neu schreiben: erledigte Punkte raus, bewusst Offengelassenes
  rein, jeweils mit Begründung.
- `docs/architektur.md` dort nachziehen, wo sich Zusagen geändert haben.
- **Abschluss-Abgleich:** Jeden der 75 Befunde aus `docs/code-review-2026-09-21.md`
  einzeln als erledigt oder begründet offen ausweisen. Diese Liste gehört in den Bericht.
- Browser-Abnahme über den CDP-Treiber (siehe Verifikation).
- Merge nach `main`, Tag `v0.7.0`, push, Live-Check.
- [ ] Commit `chore: Version 0.7.0`, danach `superpowers:finishing-a-development-branch`

---

## Verifikation

**Automatisch (`npm test`):** Alle neuen Prüfungen in `io.js` je mit einem Bundle, das
genau diesen Fehler trägt; Rollen überlappen bei keiner Kantenlänge; Packer-Score kennt die
4-Lagen-Grenze; gewichtslose Cases werden gezählt und der Ersatz-Schwerpunkt gerechnet; die
vier Mutationen aus Task 7 werden nachweislich rot; Versions-Gleichstand; Offline-Liste.

**Im Browser (headless Chrome über `cdp.mjs`, Fallstricke siehe `CLAUDE.md`):**
1. Eine Datei mit `updatedAt: 5` importieren → verständliche Fehlermeldung, App startet
   danach neu einwandfrei.
2. Eine Datei mit `color: "red;position:fixed;..."` importieren → wird abgelehnt, nichts
   legt sich über die Oberfläche.
3. Beschriftung tippen und **direkt** auf ein anderes Case klicken → der Text landet am
   richtigen Stück.
4. Import auslösen → die Sicherungsdatei wird heruntergeladen, bevor etwas überschrieben
   wird.
5. Ein Case mit 12 cm Höhe und 16 cm Rollen anlegen → der Editor verhindert es.
6. Ein Case mit 50 Zeichen Namen 6× über den Wizard anlegen → Beschriftungen bleiben unter
   40 Zeichen, Export und Import gelingen.
7. Load aus gewichtslosen Cases → „N Cases ohne Gewicht“ erscheint, der Schwerpunkt wird
   über das Volumen gerechnet und als solcher benannt.
8. Zweiter Tab → Hinweis erscheint in beiden.
9. 24 flache Cases (120×60×30) automatisch packen → getippt, rund 1,20 Lademeter.
10. Screenshots aller Ansichten, 3D mit Stücknummer, Druck mit gekürzten Beschriftungen.
