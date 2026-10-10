# Mehrere LKW in einem Plan – Spec und Plan (V 0.14.0)

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use `- [ ]`.

**Goal:** Ein Ladeplan kann mehrere LKW haben (Reiter). Der Nutzer legt die LKW an und hakt je LKW an,
welche Gewerke hineindürfen; „Alles neu packen“ verteilt die Stücke je Gewerk gleichmäßig und packt
jeden LKW. Teilprojekt 3 der Spec `docs/superpowers/specs/2026-10-09-abschluss-design.md`.

## Spec (Nutzerentscheidungen 2026-10-09/10; Einzelheiten darunter sind eigene Entscheidungen)

**Entscheidungen des Nutzers:** ein Plan mit Reitern je LKW · der Nutzer weist LKW Gewerke zu ·
Verteilung je Gewerk **gleichmäßig** · ein LKW **ohne** angehakte Gewerke ist der **Rest-LKW** und nimmt
alles · Gewerke, die kein LKW annimmt, bleiben in der Ablage **mit Hinweis** (nur wenn es keinen
Rest-LKW gibt; mit Rest-LKW landen sie dort) · Version **0.14.0** (Minor, annotierter Tag `v0.14.0`).

**Datenmodell (abwärtskompatibel):**
- `plan.lkws?: [{ id: string, name: string, truckId: string, categories: string[] }]`. Fehlt das
  Feld (oder ist die Liste leer), ist der Plan ein normaler Ein-LKW-Plan wie bisher
  (`plan.truckId`); nichts ändert sich, **keine Migration alter Daten**.
- Mit `plan.lkws` trägt jedes Stück (Platzierung und Ablage-Eintrag) optional `lkw: <lkw.id>`.
  Stück ohne `lkw` (oder mit unbekannter ID) ist **nicht zugeordnet**. `plan.truckId` bleibt als
  Rückfallwert (z. B. für alte Programmstände) auf dem Fahrzeug des ersten LKW.
- Ein LKW mit `categories: []` ist der **Rest-LKW** (höchstens einer ist sinnvoll; mehrere sind
  erlaubt, dann gleichmäßig wie bei jedem Gewerk).
- `lkw` ist **kein** Teil von `PIECE_FIELDS`; die Zuordnung wird beim Zurückschreiben der
  Ansicht gesetzt (siehe unten), damit der Packer und die Aktionen unverändert bleiben.

**Ansicht je LKW (Kernidee):** `lkwView(plan, lkwId)` liefert einen **normalen Ein-LKW-Plan**
`{ ...plan ohne lkws, truckId: lkw.truckId, placements/unplaced nur dieses LKW }`. Alle bestehenden
Funktionen (Aktionen, `validatePlan`, Packer, Ansichten, Inspector, Rückgängig) arbeiten darauf.
`mergeLkwView(plan, lkwId, view)` schreibt das Ergebnis zurück und setzt `lkw` an allen Stücken des
LKW; Stücke der anderen LKW und die nicht zugeordneten bleiben unberührt.

**Verteilung (`distributeLkws`)**, nur bei „Alles neu packen“ und nur bei ≥ 2 LKW:
1. Alle Stücke des Plans (Platzierungen und Ablage, auch nicht zugeordnete) werden neu verteilt.
2. Für jedes Stück ist die Menge der zulässigen LKW: alle LKW, die sein Gewerk
   (`case.category`) angehakt haben; ist die Menge leer, die Rest-LKW; gibt es auch keinen
   Rest-LKW, bleibt das Stück **nicht zugeordnet** (Ablage, Hinweis).
3. Gleichmäßig: Stücke je Gewerk nach Volumen absteigend (stabil, nach Ablagereihenfolge), jedes
   Stück an den zulässigen LKW mit der **kleinsten Auslastung** = max(Bodenfläche der bisher
   zugeteilten Stücke / Bodenfläche des Laderaums, Gewicht der bisher zugeteilten Stücke / Nutzlast);
   Gleichstand: der frühere LKW. Gewicht 0 zählt 0 (unbekannt, keine erfundene Zahl).
   Bodenfläche = Grundfläche in der Packorientierung des Stücks (`chooseOrientation`), ohne
   passende Orientierung zählt das Stück nicht in die Fläche und bleibt unzuteilbar im
   Rest/nicht zugeordnet.
4. Jeder LKW wird mit dem bestehenden Packer gepackt (`packAll` auf seiner Ansicht, mit den
   Pack-Regeln des Plans). Was in seinem LKW nicht passt, wird **einmal** an die übrigen
   zulässigen LKW des Gewerks weitergegeben (`packRest` dort); was auch dann nicht passt, bleibt in
   der Ablage seines ersten LKW.
5. Die Reihenfolge der LKW ist die Listenreihenfolge; das Ergebnis ist deterministisch.

**Ablauf einzelner Aktionen (je gewählter Reiter):** „Alles neu packen“ bei ≥ 2 LKW = Verteilung
(Plan weit, **ein** Rückgängig-Schritt). „Rest einpacken“, „Truck entladen“, Drag, Tastatur,
Inspector wirken nur auf den gewählten LKW (Ansicht). Neu hinzugefügtes Material
(Wizard, `addUnplaced`) ist **nicht zugeordnet**, bis „Alles neu packen“ läuft oder der Nutzer es
einem LKW zuweist.

**Oberfläche:**
- Reiterleiste über den Ansichten **nur bei Plänen mit `lkws`**: je LKW ein Reiter
  „Name · Fahrzeug“, ein Reiter „Ohne LKW (n)“ nur wenn es nicht zugeordnete Stücke gibt (nur Ablage,
  keine Fahrzeugansicht), ein Knopf „+ LKW“ und „LKW bearbeiten“ (Dialog: Name, Fahrzeug,
  Gewerke-Haken, Löschen mit Rückfrage; löschen ordnet die Stücke des LKW **nicht zu**).
- Ein Ein-LKW-Plan bekommt in der Kopfleiste einen Knopf „Mehrere LKW“: wandelt den Plan um
  (ein LKW mit dem bisherigen Fahrzeug, Name „LKW 1“, `categories: []`, alle Stücke diesem LKW
  zugeordnet), dann „+ LKW“.
- Die Fahrzeugauswahl der Kopfleiste und „Fahrzeug bearbeiten“ wirken auf den gewählten LKW.
- Inspector: Auswahlfeld „LKW“ je Stück (verschieben; eine Platzierung wandert in die Ablage des
  Ziel-LKW, eine Ablage-Zeile in die des Ziel-LKW, „Ohne LKW“ ist wählbar).
- Eine Summenzeile im Reiterbereich: Gesamtzahl, Gesamtgewicht, nicht zugeordnet n
  (mit den betroffenen Gewerken, z. B. „12 Stücke ohne LKW (Strom)“).
- Seitenleiste „Load“ zeigt die Stücke des gewählten LKW (Ablage, Alles Material); im Reiter
  „Ohne LKW“ die nicht zugeordneten.
- Druck: Dokumentenauswahl um „alle LKW“/„dieser LKW“ ergänzt (Ladeplan, Abhakliste,
  Ausladeliste, Etiketten); bei „alle“ je LKW ein Abschnitt mit LKW-Name im Kopf.
- Abwärtskompatibilität: Export/Import (Prüfung `plan.lkws`, `piece.lkw`), Autosave, alte
  Sicherungen ohne `lkws` laden unverändert; ein Fahrzeug-Verweis auf ein gelöschtes Fahrzeug fällt
  auf das Standardfahrzeug zurück (wie heute bei Plänen).

## Global Constraints

- Keine npm-Abhängigkeit, kein Build. Neue Dateien in `sw.js` ASSETS **und** `modulepreload`
  (geprüft von `tests/pwa.test.js`). `js/app/*` importiert nie `js/app.js`; kein Import-Zyklus.
- **Ein-LKW-Pläne verhalten sich byte-identisch wie vorher** (Packer, Validierung, Export, Druck):
  Differenzlauf gegen den Stand vor diesem Teilprojekt; Regressionstest mit Altschema-Plänen.
- Modelländerungen: Regressionstest mit einem Datensatz im alten Schema.
- Keine erfundenen Zahlen; Gewicht 0 = unbekannt. Eigene Entscheidungen als „eigene Entscheidung“
  benennen. Nutzerstrings nur über `esc()`; Deutsch mit „…“ (schließend U+201C); „tippen“.
- Commits enden mit `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`; nie `git add -f`.
- Version **0.14.0** (vom Nutzer gewählt) nur in Task 5, mit annotiertem Tag `v0.14.0`.

## Prüfung je Task

`npm test` und der Browser-Rundgang `scratchpad/smokeE.mjs`
(`/private/tmp/claude-501/-Users-marcohoch-Library-CloudStorage-Dropbox-Privat-Incomming-github-Truckload/1d41c3e7-6ff5-420d-9d8c-00affc425a71/scratchpad/smokeE.mjs`;
`(python3 -m http.server $P &); TL_PORT=$P node tools/cdp.mjs <smokeE.mjs> <out>`, Ports 8800–8809):
alle Flags wahr, `keys:{before:0,after:90,undone:0}`, `logs:[]`, `ver` = aktuelle Version. Ab Task 3
zusätzlich ein Mehr-LKW-Rundgang (Szenario im Scratchpad, siehe Task 3).

## Review Focus

1. Ein-LKW-Pläne byte-identisch (Differenzlauf ≥ 20.000 Instanzen; Export/Import-Roundtrip).
2. `mergeLkwView` verliert und vertauscht nie ein Stück: Summe aller Stücke vor und nach jeder
   Aktion gleich, IDs eindeutig, Stücke anderer LKW unberührt.
3. Verteilung: deterministisch, gleichmäßig nach dem genannten Maß, Rest-LKW und
   Ohne-Zuordnung-Regeln, kein Stück doppelt, Gewicht 0 unkritisch.
4. Rückgängig nach „Alles neu packen“ (mehrere LKW) stellt den Zustand vor der Verteilung her.
5. Alte Sicherungen (ohne `lkws`) importieren unverändert; neue Sicherungen mit `lkws` ebenso, auch
   wenn Stücke auf unbekannte LKW verweisen (→ nicht zugeordnet, gemeldet, nicht abgelehnt).

---

### Task 1: Modell – LKW, Ansicht, Zurückschreiben, Import-Prüfung

**Files:** `js/model/lkw.js` (neu), `js/store/io.js`, `js/model/limits.js`, `sw.js`, `index.html`,
`tests/lkw.test.js` (neu), `tests/io.test.js`.

- [ ] Reine Funktionen in `js/model/lkw.js` (+ Tests zuerst):
  - `lkwsOf(plan)` → Liste (leer bei Ein-LKW-Plan), `isMultiLkw(plan)`.
  - `lkwView(plan, lkwId)`, `unassignedView(plan)` (nur Ablage-Stücke ohne gültigen `lkw`,
    Platzierungen ohne `lkw` gibt es nicht; kommen sie aus Altdaten vor, gelten sie als
    nicht zugeordnet und werden in die Ablage verschoben, siehe unten).
  - `mergeLkwView(plan, lkwId, view)` setzt `lkw` an allen Stücken der Ansicht und liefert den
    Plan mit unveränderten Stücken der anderen LKW; verändert `plan.lkws` nicht.
  - `convertToMulti(plan)`, `addLkw(plan, { name, truckId, categories })`,
    `updateLkw(plan, id, patch)`, `removeLkw(plan, id)` (Stücke werden nicht zugeordnet:
    `lkw` entfernt, Platzierungen wandern in die Ablage), `moveToLkw(plan, pieceId, lkwIdOrNull)`
    (Platzierung → Ablage des Ziels, Ablage-Zeile → Ziel). Alle immer mit `stamp`.
  - Grenzen in `limits.js`: höchstens 12 LKW je Plan, Name höchstens `NAME_MAX`,
    Gewerke aus `CATEGORIES`.
- [ ] `io.js`: `checkPlan` prüft `lkws` (Array von Objekten mit eindeutiger `id`, Namen,
  `truckId` String, `categories` Array von Strings); `piece.lkw` String; ein unbekannter
  `lkw`-Verweis wird **repariert** (Feld entfernt, gemeldet unter „Beim Import angepasst“),
  nicht abgelehnt. Fehlendes `lkws` bleibt gültig. Tests mit Altschema- und Neuschema-Bundles,
  Export/Import-Roundtrip eines Mehr-LKW-Plans (Gleichheit).
- [ ] **Invariante prüfen:** `lkwView` + `mergeLkwView` mit der Identität ergibt den Plan
  unverändert; Eigenschaftstest (≥ 200 zufällige Pläne, fester Seed): Anzahl und IDs der Stücke
  bleiben nach beliebigen Folgen von `addLkw/removeLkw/moveToLkw/mergeLkwView` erhalten.
- [ ] `npm test` + Rundgang (Port 8800); Commits je Schritt.

### Task 2: Verteilung und Packen

**Files:** `js/model/lkw.js`, `js/model/actions.js` (nur `packAllLkws`-Aufrufstelle falls nötig),
`tests/lkw-distribute.test.js` (neu), `tests/packer-property.test.js` (nur Ein-LKW-Gleichheit).

- [ ] `distributeLkws(plan, ctx)` und `packAllLkws(plan, ctx)` wie in der Spec (Schritte 1–5).
  Bei `!isMultiLkw(plan)` ruft `packAllLkws` exakt das bisherige `packAll` auf (identisch).
  Pack-Regeln (`rulesFor(plan)`, `mixTopFor(plan)`) gelten für jeden LKW.
- [ ] Tests (zuerst): zwei Gewerke auf zwei LKW exakt zugeteilt; ein Gewerk auf zwei LKW
  gleichmäßig (Zuteilung literal geprüft, Gleichstand → früherer LKW); Rest-LKW nimmt Gewerke ohne
  Haken; ohne Rest-LKW bleibt ein Gewerk nicht zugeordnet; Überlauf eines LKW geht an den zweiten
  zulässigen LKW; Gewicht 0; Stück ohne passende Orientierung; Determinismus (zweimal gleich);
  Summe aller Stücke gleich vor/nach; ein-LKW-Plan: `packAllLkws` == `packAll` (50 feste und
  ≥ 5.000 zufällige Instanzen im Differenzlauf im Scratchpad, **nicht** im Repo).
- [ ] `npm test` + Rundgang (Port 8801); Commits je Schritt.

### Task 3: App-Verdrahtung und Oberfläche

**Files:** `js/app/core.js`, `js/app/planView.js`, `js/app/plans.js`, `js/app/persistence.js`,
`js/app/importExport.js`, `js/app.js`, `js/ui/library.js`, `js/ui/inspector.js`,
`js/ui/lkw-editor.js` (neu), `js/ui/lkw-tabs.js` (neu), `index.html`, `css/app.css`, `sw.js`,
Tests (reine Teile).

- [ ] **Zustand:** `activeLkw` im Store (nicht gespeichert, nicht im Rückgängig); bei
  Planwechsel auf den ersten LKW (oder `null` bei Ein-LKW-Plänen); löschen/umbauen setzt gültig
  zurück. Reine Funktion `activeLkwOf(plan, activeLkw)` mit Tests.
- [ ] **`js/app/core.js`:** `ctxOf`/`deriveOf`/`edit`: Bei Mehr-LKW-Plänen arbeitet `edit(fn)` auf
  `lkwView(plan, activeLkw)` mit dem Fahrzeug des LKW und schreibt per `mergeLkwView` zurück
  (ein History-Schritt); `deriveOf` validiert die Ansicht des aktiven LKW. Ein-LKW-Pläne gehen
  unverändert denselben Weg wie bisher. Tests mit Fake-Store.
- [ ] **Reiterleiste** (`lkw-tabs.js`, rein darstellend, Aktionen über Callbacks) und
  **LKW-Dialog** (`lkw-editor.js`: Name, Fahrzeug aus `s.trucks`, Gewerke-Haken, Löschen mit
  Rückfrage; Texte „…“). Knopf „Mehrere LKW“ in der Kopfleiste (nur bei Ein-LKW-Plänen), „+ LKW“.
- [ ] **Packen:** „Alles neu packen“ ruft bei Mehr-LKW-Plänen `packAllLkws` (ein Rückgängig-Schritt)
  und meldet nicht zugeordnete Stücke mit Gewerken per `showAlert` (wie `warnIfUnplaced`:
  Text „12 Stücke ohne LKW (Strom)“); „Rest einpacken“/„Truck entladen“ wirken auf den aktiven
  LKW.
- [ ] **Fahrzeugauswahl** und „Fahrzeug bearbeiten/löschen“ wirken auf den aktiven LKW
  (`updateLkw`); Fahrzeug löschen setzt betroffene LKW auf das Standardfahrzeug (analog
  `persistence.deleteTruck`, auch für `lkws` aller Pläne).
- [ ] **Inspector:** Auswahlfeld „LKW“ je Stück (`moveToLkw`), ändert Auswahl/Ansicht
  entsprechend; Summenzeile (Gesamt/ohne LKW) im Reiterbereich.
- [ ] **Seitenleiste:** zeigt Ablage/Material des aktiven LKW bzw. des Reiters „Ohne LKW“.
- [ ] **Browser-Rundgang** (neues Szenario `smokeLkw.mjs` im Scratchpad, `p.eval` = Funktion,
  Zustand per Modulimporte wie in `smokeE.mjs`): Plan mit zwei Gewerken (Ton, Licht), umwandeln in
  zwei LKW (Ton → LKW 1, Licht → LKW 2), „Alles neu packen“: Reiter zeigen die richtigen Stücke,
  Summen stimmen, Rückgängig stellt den Zustand her, Stück verschieben, LKW löschen, Export →
  Import-Parse Gleichheit; Screenshots ansehen. Ein-LKW-Rundgang `smokeE.mjs` unverändert grün.
- [ ] `npm test`; Commits je Schritt.

### Task 4: Druck

**Files:** `js/ui/print.js`, `js/app/chrome.js`, `index.html`, `css/print.css`, Tests.

- [ ] Dokumentenauswahl (`#print-doc`) bleibt; neu ein Umschalter „dieser LKW / alle LKW“ (nur bei
  Mehr-LKW-Plänen sichtbar). Bei „alle“ druckt jedes Dokument je LKW einen Abschnitt (mit
  Seitenumbruch) und in der Kopfzeile den LKW-Namen und das Fahrzeug (`headInfo` bekommt den
  LKW); Etiketten alle zusammen in einer Folge. Bei Ein-LKW-Plänen unverändert (Test auf
  Gleichheit des Markups gegen vorher).
- [ ] Tests auf Markup (LKW-Name, Reihenfolge, Seitenumbruch-Klasse) und Browser-Druckvorschau
  mit gestubbtem `window.print` für beide Modi.
- [ ] `npm test` + Rundgang (Port 8803); Commits je Schritt.

### Task 5: Doku und Version 0.14.0

- [ ] `docs/architektur.md` (Abschnitt „Mehrere LKW“: Datenmodell, Ansicht/Zurückschreiben,
  Verteilung, Reiter, Druck, Import), `README.md` (neuer Abschnitt „Mehrere LKW in einem Plan“),
  `docs/offene-punkte.md` (Teilprojekt 3 aus „Teilprojekte“ streichen; ehrlicher Rest: nur
  Verteilung beim neu Packen, kein automatisches Umverteilen bei manuellen Änderungen, keine
  Optimierung der Gewerkegrenzen, Verteilmaß ist eine Heuristik).
- [ ] Version **0.14.0** an den sechs Stellen, CHANGELOG in Nutzersprache, Doku-Köpfe „Stand“;
  `npm test` + beide Rundgänge. Commit `chore: Version 0.14.0 – Mehrere LKW in einem Plan`; nach
  dem Merge `git tag -a v0.14.0 -m "Version 0.14.0"` und `git push origin main --tags`.
