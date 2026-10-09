# Aufbau der Anwendung

Stand V 0.13.10. Diese Datei beschreibt das Datenmodell, die Schichten und die Invarianten,
die man kennen muss, bevor man etwas ändert.

## Schichten

```
js/data/     reine Datentabellen (Vorlagen, Bibliothek, Gewerke, Fahrzeuge)
js/model/    reine Logik ohne DOM — Geometrie, Prüfung, Aktionen, Packer, Traversen
js/store/    Speicherung (IndexedDB), Datei-Austausch (JSON) und der Undo-Store (`state.js`)
js/ui/       Darstellung und Bedienung (SVG, Three.js, Dialoge)
js/app/      Verdrahtung in kleinen Modulen (Zustandshelfer, Bildschirme, Speicherpfade, Plan-Verwaltung …)
js/app.js    Startdatei: lädt die Daten, erzeugt den Store und ruft die Module aus js/app/ auf
```

Die Richtung ist strikt: `ui` benutzt `model`, nie umgekehrt. Module unter `model/` haben
keinen DOM-Zugriff und sind damit vollständig testbar. Wo aus einem UI-Modul rechenbare
Geometrie herausfällt, wandert sie in ein reines Modul — so entstanden
`js/ui/instanceMatrix.js`, `js/ui/labelTexture.js` und `js/ui/caseGroups.js`, die trotz
ihres Ordners keine Three.js- oder DOM-Abhängigkeit haben und eigene Tests besitzen.

`js/app.js` ist die Startdatei (rund 170 Zeilen): sie lädt die Daten, erzeugt den Store und die
Kern-Hüllen (`ctx`, `derive`, `edit`, `select`), rendert und ruft die Module unter `js/app/` auf.
Sie exportiert `store`, `derive`, `edit`, `select`, `scheduleRender` und `renderHooks`, damit
Browser-Szenarien Zustand aufbauen können. Dialoge und Listen unter `js/ui/` bekommen ihre
Daten als Argumente und liefern reine Ergebnisobjekte zurück (`openCaseEditor`,
`openTruckEditor`, `openLoadWizard`).

### js/app/ — die Verdrahtung

- `core.js` — reine Zustandshelfer (`ctxOf`, `deriveOf`, `allPlansOf`, `piecesOf`, Nutzungszähler).
- `screens.js` — Bildschirmwahl (`screenOf`: Material hat Vorrang, ohne gewählten Plan ist Start, sonst Plan) und Startbildschirm.
  Der Startbildschirm (`renderStartScreen`) zeigt „Neuen Load erstellen“, „Material“, die gespeicherten
  Ladepläne nach Name sortiert (oder „Noch keine gespeicherten Ladepläne.“), „Sicherung importieren“ und
  die Versionsnummer. Beim Start ist `plan` immer `null`; ein Plan wird erst durch Auswahl oder Anlegen geöffnet.
- `keyboard.js` — Tastenzuordnung (`keyFor`, rein) und der Dokument-Handler dafür.
- `guarded.js` — führt eine Speicheraktion mit genau einer Fehlermeldung aus.
- `persistence.js` — Speicherpfade für Case, Firma, Regelset und Fahrzeug: erst schreiben, dann den Store nachziehen.
- `plans.js` — Plan-Knöpfe (Neu, Umbenennen, Duplizieren, Löschen, Auswahl), Lade-Wizard und die reinen Übergänge `switchPlanState`/`deletePlanState`.
- `materialScreen.js` — Materialbildschirm samt Case-Editor-Wegen (`editCase`, `newCaseForWizard`).
- `importExport.js` — Sichern und Importieren mit Vorab-Sicherung.
- `chrome.js` — Hinweisbänder, Speicherstatus, Versionsanzeige, Druck, Service-Worker-Registrierung.
- `planView.js` — Plan-Bildschirm: Seitenleiste, Inspector, Werkzeugleiste, 2D-Interaktionen, Aktionen, Fahrzeuge, 3D-Nachladen.

Abhängigkeitsregel: `app.js` reicht Store, `edit`, `select` und die übrigen Hüllen als Parameter
an `wire…`/`mount…`/`create…` weiter (Injektion). Kein Modul unter `js/app/` importiert
`js/app.js`; untereinander benutzen sie nur `core.js` und `guarded.js`.

`js/store/autosave.js` ist seit V 0.7.0 die Buchhaltung des Autosaves: reine Logik ohne
DOM-, IndexedDB- oder Store-Wissen, alle Abhängigkeiten (Schreibfunktion, Uhr, Timer,
Status-Callback) werden ihr von `js/app.js` gespritzt. Sie führt je Plan-ID einen eigenen
Eintrag (`pending`), merkt sich fehlschlagende Schreibvorgänge getrennt (`retrying`) und
kann einen Plan für die Dauer eines Imports aus der automatischen Buchhaltung herausnehmen
(`exclude`/`include`), ohne einen schon wartenden Schreibvorgang zu verlieren. Nur dadurch
ist die Speicher-Logik mit `node --test` prüfbar, obwohl `js/app.js` selbst ein
Top-Level-`await`-Modul mit DOM-Zugriff ist.

## Service Worker und Ladefehler

`sw.js` hält die App offline vor (Asset-Liste `ASSETS`, Cache-Name `truckload-v<Version>`):

- **Netz zuerst**, am HTTP-Cache des Browsers vorbei (`cache: 'no-cache'`); der Offline-Cache springt
  nur ein, wenn das Netz fehlt, mit einem Fehler antwortet oder länger als `NETWORK_TIMEOUT_MS` (3 s)
  braucht. Der Abruf läuft dann im Hintergrund weiter und frischt den Cache auf.
- **Ein Stand pro Seitenaufruf:** Ist bei einem Client (Seitenaufruf) ein Abruf in den Timeout gelaufen,
  kommen alle weiteren Dateien dieses Clients sofort aus dem Cache, damit sich alte und neue Module nicht
  mischen. Das ist ein Zusatzschutz, kein Ausschluss: Was der Seitenaufruf vorher schon frisch bekommen hat,
  bleibt frisch (Restrisiko in `docs/offene-punkte.md`).
- **Neue Version:** `registerServiceWorker` (`js/app/chrome.js`) lädt die Seite einmal neu, wenn ein neuer
  Service Worker übernimmt (nicht beim allerersten Besuch).
- **Ladefehler-Hinweis:** Schlägt ein Modul oder sein Preload fehl, oder meldet ein fehlender Export einen
  `SyntaxError` vor dem Start der App, blendet ein Skript im `<head>` von `index.html` den Hinweis „Die App
  konnte nicht vollständig geladen werden. Bitte neu laden.“ mit Knopf „Neu laden“ ein, statt eine weiße
  Seite zu lassen.

Jede neue Datei unter `js/` oder `css/` gehört in `ASSETS`; `tests/pwa.test.js` prüft das.

## Zwei Datenebenen: Case-Typ und Stück

Das ist der wichtigste Unterschied im Modell.

**Case-Typ** — ein Eintrag in der Bibliothek. Maße, Gewicht, Gewerk, Farbe, Rollen,
erlaubte Lagen. Lebt in `plan`-unabhängigen Listen und in IndexedDB.

**Stück** — ein konkretes Exemplar in einem Ladeplan, in `plan.placements[]` (im Truck)
oder `plan.unplaced[]` (Ablage). Trägt `id`, `caseId` und — seit V 0.4.0 — eine eigene
`label` (Beschriftung, höchstens `MAX_LABEL` Zeichen) und `color`. Platzierte Stücke haben
zusätzlich `x`, `y`, `z`, `orientation` und `rot`.

Drei weitere optionale Stück-Felder schränken den Case-Typ nur ein, erweitern ihn nie, und
fallen bei Fehlen auf das bisherige Case-Typ-Verhalten zurück (Altdaten ohne diese Felder
laden also unverändert):

- `layers` — eine nichtleere Teilmenge von 1 bis 4. `pieceLayers(piece, c)`
  (`js/model/geometry.js`) bildet die Schnittmenge aus `piece.layers` und `layersOf(c)`
  (den Case-Typ-Lagen); fehlt `piece.layers` oder ist die Schnittmenge leer (z. B. weil ein
  Import das Case seither auf weniger Lagen begrenzt hat), gilt `layersOf(c)` unverändert.
- `tipped` — `true` zwingt aufs Tippen, `false` verbietet es, fehlt es, bleibt die bisherige
  Wahl beim Packer maßgeblich (`pieceOrientations(piece, c)`, nicht tippbare Case-Typen
  lassen sich davon nie überstimmen). Wird ein Stück platziert, entscheidet
  `tipped === true && canTip(c)` über die Startausrichtung (`tipLong` statt `standing`).
- `group` — ein freier, getrimmter Gruppenname (höchstens `MAX_LABEL` Zeichen), gesetzt über
  `addUnplaced({ group })` (Wizard-Schritt „Beschriften“, verdrahtet in `js/app/plans.js`) oder `A.setPieceGroup`
  (Inspector). Er wandert wie die übrigen
  Stückfelder mit: `PIECE_FIELDS` und `pickPieceFields` (`js/model/pieceFields.js`) sind die
  einzige Stelle, die diese Felder aufzählt; `addUnplaced`, `placeCase`, `duplicate`,
  `placementToUnplaced`, `toPiece`, `autoPack` und `buildItems` benutzen sie. Fehlt es, bildet ein Stück beim
  sortenreinen Packen keinen eigenen Gruppenblock, sondern läuft mit den übrigen Stücken
  seines Case-Typs (Abschnitt „Sortenrein“ unten).

Der Wizard (Schritt „Beschriften“, `js/ui/load-wizard.js`) setzt beide Felder je Stück
vor: `layers` mit `defaultWizardLayers(c)`, also den vom Case-Typ erlaubten Lagen aus
{1, 2} (Lage 3/4 nie vorab, Nutzerwunsch V 0.7.15/0.7.16), `tipped` mit `canTip(c)`.
Erlaubt ein Case-Typ weder Lage 1 noch 2, startet das Stück ohne Lage; „Fertig“ blockiert
dann (`countWithoutLayer`), bis jedes Stück eine Lage hat. Die Kopfzeile „Alle Stücke“
schaltet eine Lage bzw. „getippt“ für alle Stücke auf einmal (`setLayerForAll`,
`setTippedForAll`, Anzeige über `bulkState` inklusive „gemischt“) und hält sich dabei an
dieselben Grenzen: nur wo der Case-Typ es erlaubt, und die letzte Lage eines Stücks bleibt.
Folge der Vorbelegung: Stücke aus dem Wizard tragen `layers: [1, 2]` als gespeicherte
Einschränkung, sofern der Case-Typ mehr erlaubt (`reduceWizardItem`).

Beide Felder lassen sich danach im Inspector je Stück ändern (`A.setPieceLayers`/
`A.setPieceTipped`, `js/ui/inspector.js`), nach derselben Reduktionsregel wie
`reduceWizardItem` im Wizard: Lagen, die genau dem Case-Typ entsprechen, werden nicht
gespeichert, `tipped` gibt es nur für tippbare Case-Typen, und Aufstellen (`tipped:false`
auf einem platzierten Stück) geht direkt auf `standing`, nicht über `cycleTip`. `A.unloadAll`
(Knopf „Truck entladen“) legt alle Placements zurück in die Ablage und behält dabei Label,
Farbe, `layers` und `tipped` je Stück.

`MAX_LABEL` (= 40) liegt zusammen mit den übrigen Grenzwerten (`CASE_LIMITS`, `TRUSS_LIMITS`,
`MAX_FIRM`, `MAX_RULESET_NAME`) in `js/model/limits.js` — einem Modul ohne eigene Importe, das
`js/store/io.js` (Prüfung `labelOk`) und `js/ui/*` ebenso benutzen dürfen wie die Modellschicht.
`js/model/actions.js` kürzt jeden gesetzten oder vorbelegten Label-Wert selbst darauf
(`addUnplaced`, `applyField`, `nextLabel`) — die Oberfläche muss die Grenze also nicht mehr an
jeder Eingabestelle einzeln durchsetzen, ein `maxlength`-Attribut allein hätte einen
vorbelegten Wert (Wizard, Duplizieren) nicht erfasst.

`buildItems()` in `js/model/items.js` führt beides zu `items` zusammen und legt
`it.label` und `it.color` mit Rückfall auf Case-Name und Gewerkfarbe frei. **Alle**
Ansichten, der Inspector und der Druck lesen von dort — nicht selbst aus dem Case.

Der Packer arbeitet auf Stück-Objekten, nicht auf Case-Typen, und übernimmt `id`, `label`
und `color` in die erzeugten Platzierungen. Wer das ändert, verliert beim „Alles neu
packen“ alle Beschriftungen (genau dieser Fehler war bis V 0.4.0 drin).

## Koordinaten und Einheiten

Alles in Zentimetern und Kilogramm.

- `x` = Länge ab Stirnwand, wächst zur **Trucktür** (Heck)
- `y` = Breite ab der linken Wand
- `z` = Höhe ab Ladefläche

`EPS = 0.5` cm ist die Toleranz für alle Überlappungs- und Auflageprüfungen. Die
gespeicherten Maße bleiben die echten; Spielraum gibt es nur hier.

Neue Positionen rasten auf ein 5-cm-Raster und danach an Truckwänden und Kanten der
anderen Boxen ein (`snapPos` in `js/model/actions.js`, Toleranz 8 cm über `snapToEdges`).
Das gilt seit V 0.7.18 für das Hineinziehen aus der Liste (`placeCase`) genauso wie für das
Verschieben im Truck (`moveGroup`). Vorher rastete `placeCase` nur aufs Raster: Ein 62 cm
breiter Wagen landete neben einem anderen bei 60 statt 62 cm, ragte hinein und wurde von
`settle()` obendrauf gestellt.

## Ausrichtung und Rollenrichtung

`orientation` ist `standing`, `tipLong` oder `tipShort`; `rot` ist 0, 90, 180 oder 270.

`wheelFace(p)` sagt, zu welcher Seite die Rollen zeigen: `bottom` bei stehenden Cases,
sonst `+x`, `+y`, `-x` oder `-y`. `DOOR_FACE` ist `+x`, also die Trucktür.
`rotForWheelFace(orientation, face)` ist die Umkehrung und liefert `null`, wenn die
Richtung für diese Ausrichtung nicht erreichbar ist.

**Manuelles Tippen (`cycleTip`, seit V 0.7.3):** kippt relativ zur aktuellen Lage nach vorn/
hinten (Fahrtrichtung) — die Case-Kante, die gerade auf der x-Achse liegt, kippt nach oben
bzw. unten, die Seitenkante (y-Achse) bleibt unverändert. `nextTip(orientation, rot)`
(`geometry.js`) rechnet das rein symbolisch anhand der Dimensions-Namen (Länge/Breite/Höhe),
nicht anhand fester `rot`-Werte — welche der beiden getippten Lagen (`tipLong`/`tipShort`)
dabei herauskommt, hängt davon ab, ob gerade Länge oder Breite in Fahrtrichtung steht. Zweimal
in Folge Tippen landet deshalb wieder bei `standing` (Hin und zurück), nicht bei der jeweils
dritten Lage — die ist nur über eine Drehung (`rotate`, Taste R) vor dem Tippen erreichbar.
Das gilt für einen über Tippen selbst erreichten Zustand; bei einer vom Packer erzeugten
Ausgangslage (z. B. `tipLong` mit `rot 0`) kann `nextTip` stattdessen über die jeweils andere
Achse kippen, weil der Schritt gerichtet ist, nicht auf `standing` zielt (docs/offene-punkte.md,
„Kleinigkeiten“). Verlässlich steht das Case über das „getippt“-Häkchen im Inspector
(`setPieceTipped`, s. u.), das für `tipped:false` immer direkt `standing` setzt statt `cycleTip`
aufzurufen.
Bis V 0.7.2 setzte `cycleTip` `rot` bei jedem Übergang stattdessen fest so, dass die Rollen zur
Tür zeigen, unabhängig von der Ausgangsdrehung — stand die lange Seite in Fahrtrichtung, kippte
das Case dadurch sichtbar zur Seite statt nach vorn (Nutzer-Feedback 2026-09-23). Die
Rollenrichtung ist nach dem Tippen nicht mehr garantiert; `setWheelFace` (Taste W) dreht sie bei
Bedarf gezielt.

**Auto-Packen (`chooseOrientation`, Packer):** hiervon unberührt. Der Packer probiert weiter
alle Ausrichtungen × Drehungen durch und bevorzugt unter den tippbaren Kandidaten mit
gleichwertigem Füllgrad weiterhin die mit Rollen zur Tür.

## Rollen im Maß

Drei Felder am Case-Typ:

| Feld | Bedeutung |
|---|---|
| `wheels` | Rollen vorhanden (fehlt = ja) |
| `wheelH` | Rollenhöhe in cm (fehlt = 12, Vorgabe für neue Cases 16) |
| `dimsInclWheels` | Enthält das eingetragene Maß die Rollen schon? (fehlt = ja) |

`outerDims(c)` liefert das Außenmaß und addiert `wheelH` **nur** bei
`dimsInclWheels === false`. Diese Funktion sitzt in `localDims()`, also in der einzigen
Stelle, an der aus einem Case Maße werden — dadurch ziehen Kollisionsprüfung, Auflage,
Lagen, Schwerpunkt, Packer, 2D, 3D und Druck ohne Sonderfall mit. Anzeigen (Bibliothek,
Inspector, Wizard) müssen ebenfalls `outerDims` verwenden, nicht `c.l/c.w/c.h`.

Die mitgelieferten Cases (Liste und Vorlagen) sind **inkl. Rollen** gemessen
(`dimsInclWheels: true`) und haben Blue Wheel Ø 100 mm mit `wheelH: 13` (Nutzerangabe
2026-09-28; bis V 0.8.1 12 cm). Ihre Belegung im Truck ist damit genau das eingetragene Maß;
die Rollenhöhe bestimmt nur, wie hoch Rollen und Korpus gezeichnet werden. Kleine Cases unter
ca. 45 cm Höhe (Pulte, Hazer, kleine 19″-Racks) haben keine Rollen (`wheels: false`).
`DEFAULT_WHEEL_H = 12` gilt weiter für Altdaten ohne Angabe, damit ein eigenes Case mit
„Maß ohne Rollen“ nicht unbemerkt höher wird.

## Lagen

Ein Case trägt `layers`, eine Teilmenge von 1 bis 4 (fehlt = alle). Lage 1 ist der Boden.
`layerMap()` in `validate.js` berechnet die tatsächliche Lage als 1 plus die höchste Lage
der tragenden Cases. Mehr als vier Lagen sind nicht vorgesehen und werden als Warnung
gemeldet. Der Packer hält sich daran und stapelt nichts Schweres auf Leichteres. Seit
V 0.7.0 kennt auch der Füllgrad-Score in `chooseOrientation` (`packer.js`) diese
4-Lagen-Grenze (vorher rechnete er mit der reinen Truckhöhe) — ein flaches, stapelbares
Case wird dadurch eher getippt als sinnlos hoch gestellt, wenn Tippen weniger Lademeter
braucht.

**Sortenrein (seit V 0.8.3), Pack-Regeln (seit V 0.8.5):** `orderSorts(items, rules)` gruppiert
nach Block — `caseId` **und** Gruppe (`js/model/packRules.js`): Stücke desselben Case-Typs mit
unterschiedlicher Gruppe (oder ohne Gruppe) bilden eigene Blöcke. Sortiert wird mit
`blockComparator(rules)`. `rules` ist `plan.packRules` (höchstens 20 Regeln), oder — fehlt das
Feld — `legacyRules(plan.packOrder)` (beides über `rulesFor(plan)`), was exakt die früheren
`packOrder`-Ordnungen nachbildet: `'volume'`/fehlend → Traversen zuletzt, dann Einzelvolumen
absteigend, dann Stückzahl absteigend; `'count'` → Stückzahl absteigend, dann Einzelvolumen
absteigend (Regressionstest in `tests/packer.test.js`). Eine `Rule` ist entweder eine
Auswahlregel (`by: 'truss'|'group'|'case'|'category'`, bei den letzten drei mit `value`, dazu
`pos: 'first'|'last'`) — sie schiebt einen passenden Block vor („zuerst“, Stirnwand) oder hinter
(„zuletzt“, Tür) die unentschiedenen — oder eine Maßregel (`by: 'volume'|'count'`) ohne `value`
und `pos`, die nach Einzelvolumen bzw. Stückzahl absteigend sortiert. Bei Gleichstand aller
Regeln entscheidet der Name, dann die Gruppe, dann bleibt die Eingabereihenfolge
(`Array.prototype.sort` ist stabil). Ein alter String (`'volume'`/`'count'`, Altdaten über
`plan.packOrder`) wird einmal am Eingang von `autoPack` über `legacyRules` in Regeln übersetzt;
`orderSorts` und `buildStacks` kennen nur noch Regel-Arrays. `PACK_ORDERS` gilt weiter für den
Import alter Dateien. `buildStacks` stapelt je Block; die
nächste Sorte darf nur den letzten offenen Stapel der vorigen auffüllen. `placeStacks` stellt
Sorte für Sorte, jede nur ab dem x0 der letzten Reihe der vorigen (`minX`), und `packRest`
beginnt an der letzten Reihe der vorhandenen Ladung (`startX` = größtes x0 der Bodenstücke). Seit V
0.8.4 stellt `placeStacks` jeden Stapel zuerst im Spurraster seiner Sorte ab der linken Wand (y = k
· Stapelbreite) und fällt nur, wenn dort nichts passt (Radkästen), auf die freie Eckensuche zurück –
sonst übernahm eine Sorte die Spurlage der vorigen, und 62er-Wagen passten neben 60er-Spuren nur zu
dritt statt zu viert. Spec:
`docs/superpowers/specs/2026-09-28-sortenrein-packen-design.md`.

**Deckschicht (seit V 0.8.6):** optionaler Schalter `plan.mixTop` (`mixTopFor(plan)`,
`js/model/packRules.js`), umgesetzt in `buildStacks` (`js/model/packer.js`). Für jedes Stück
probiert `addTo` vier Wege der Reihe nach: (1) den letzten offenen Stapel des vorigen Blocks
auffüllen (`prevLast`, wie bisher), (2) einen eigenen Stapel gleicher Grundfläche (wie bisher),
(3) nur bei `mixTop`, wenn beides scheitert: als Deckschicht auf einen Stapel eines **früheren**
Blocks, (4) sonst ein neuer Stapel am Boden. Kandidaten für (3) sind die Stapel früherer Blöcke
in Entstehungsreihenfolge; es gewinnt der erste passende (näher an der Stirnwand) – deshalb
können mehrere kleine Cases auf demselben großen landen, statt sich zu verteilen (README,
Abschnitt „Deckschicht mischen“).

`capFits(s, it, c, o, truck)` prüft, ob ein Stück als Deckschicht auf Stapel `s` passt:
`belongsTogether(a, ca, b, cb)` (beide mit Gruppe → gleiche Gruppe, beide ohne → gleiches
Gewerk, gemischt → nein) zwischen dem Stück und dem Gründungsstück des Stapels,
`sameSelectorRank(rules, a, b)` (`packRules.js` – für jede Auswahlregel derselbe Rang wie der
Block des Stapels, sonst könnte eine Deckschicht ein „zuletzt“ unterlaufen), keine Traversen auf
keiner Seite, beide Gewichte bekannt (`> 0`, 0 kg = unbekannt) und nicht schwerer als das oberste
Stück, sowie dieselben Grenzen wie beim normalen Stapeln (`canAddToStack`, `pieceLayers`, 4
Lagen). Ein Stapel mit Deckschicht (`s.capped = true`) nimmt kein Stück seiner eigenen Sorte mehr
an und gilt wie ein aufgefüllter Stapel als `mixed` (steht innerhalb seines Blocks zuletzt).

## Traversenwagen

Ein eigener Case-Typ mit `kind: 'truss'` und `truss: { length, width, count }`.

Die Außenmaße werden **immer** aus diesen Parametern gerechnet (`trussDims`), nie von Hand
gepflegt: Länge = Traversenlänge, Breite = 60 oder 80 (je nachdem, ob zwei Traversen in
60 cm passen), Höhe = `DOLLY_H` plus Lagenzahl mal Traversenbreite. Deshalb normalisiert
`normalizeCase()` sie beim Import **und** beim Laden (`normalizeOwnCases` in `repo.js`) —
sonst behält ein vor einer Maßänderung angelegtes Case einen veralteten Wert.

Der Wagen selbst besteht seit V 0.6.0 aus (von unten):

| Bereich | Höhe |
|---|---|
| Rollen (`DOLLY_WHEEL_H`) | 12 cm |
| Rollbrett (`DOLLY_BOARD_H`) | 3 cm |
| Auflageleisten (`DOLLY_RAIL_H`) | 2 cm |
| **Summe `DOLLY_H`** | **17 cm** |

Die Traverse liegt **auf** den Leisten; die unterste Lage beginnt bei `z0 + DOLLY_H`. Bei
zwei Traversen nebeneinander ist neben ihnen kein Platz — deshalb tragen die Leisten, statt
seitlich zu führen. `trussShape()` liefert `dollies` (das volle Wagenvolumen, gebraucht für
die Beschriftungsfläche), `boards`, `rails`, `wheels` und `pieces`. Traversenwagen sind nie
tippbar.

### Pre-Rig-Traversen (`standing: true`)

Ein zweiter, seit V 0.7.3 unterstützter Aufbau für Moving-Light-Pre-Rig-Traversen (H.O.F. MLT,
Prolyte S36PR): `truss: { length, width, count: 1, standing: true, height, frame? }`. Anders als
der Wagen oben (mehrere Stücke auf einem gemeinsamen Flachwagen) ist hier **ein Stück immer eine
einzelne, komplett montierte Traverse** auf 4 Beinen über einem eigenen Dolly mit Rollen — so
wird sie auch fertig aufgerüstet (mit montierten Movern) in den Truck gerollt.

- `width` ist die Standfläche fürs Packen, `STAND_FOOTPRINT_W = 62` cm: 4 Stück passen genau
  nebeneinander in einen Sattelauflieger mit 248 cm Innenbreite (Nutzerangabe, bestätigt
  V 0.7.18). Gegen die Wände und die Nachbarn gilt die übliche Toleranz `EPS`.
- `height` ist die Standhöhe und wird direkt mitgegeben, statt aus `count`/`width` errechnet.
  Seit V 0.7.17 sind alle Vorlagen 115 cm hoch, auch MLT ONE (Quellen in
  `docs/mlt-truss-gewichte.md`).
- `frame: 'closed'` (MLT TWO/THREE/FOUR, Prolyte S36PR) steht für einen rundum geschlossenen
  Alu-Rahmen: Querholme an den Stirnseiten verbinden die Längsholme, und `trussShape()` meldet
  `alu: true`, womit `view3d.js` den ganzen Dolly silbern zeichnet. Fehlt `frame` (MLT ONE,
  Altdaten), bleibt es beim offenen, dunklen Rahmen mit zwei Längsholmen.
- Die Traverse ist immer das breiteste Teil (`STAND_TRUSS_W` × `STAND_TRUSS_H`, mittig in der
  Standfläche). Der Dolly (Holme, Querholme, Rollen) ist je Seite um `STAND_DOLLY_INSET` (2 cm,
  eigene optische Annahme) schmaler als die Traverse. Das betrifft nur die Darstellung, nicht
  das Packen.

`trussDims()` gibt für stehende Traversen `{l: length, w: width, h: height}` unverändert zurück,
ohne die `MAX_TRUSS_WIDTH`-Grenze zu prüfen (die gilt nur fürs Nebeneinander-Passen auf dem
Wagen). `trussShape()` liefert denselben Rückgabe-Vertrag wie oben, nur anders befüllt:
`dollies`/`boards` sind der erste Längsholm (Bezugsfläche für die Beschriftung), `rails` sind
die 4 Beine, der zweite Längsholm und gegebenenfalls die 2 Querholme, `pieces` enthält die eine
Traverse. Ein zusätzliches Feld `profileWidth` sagt view2d.js/view3d.js, mit welcher Breite die
Gurtrohre gezeichnet werden — `c.truss.width` wäre hier die Standfläche statt des Querschnitts.

### Dolly-Dialog für Line-Array-Tops und Subs (seit V 0.11.0)

Ein zweiter, dem Traversenwagen-Mechanismus nachgebildeter Dialog: die 13 Audio-Einzelbox-
Vorlagen im Gewerk „Ton“ (8 Array-Tops, 5 Subs, `docs/casemasse-gewichte.md`) tragen das Feld
`dollyPrompt: true`. Klickt der Nutzer im Lade-Wizard bei einer solchen Vorlage auf „+“, öffnet
sich `openDollyDialog()` (`js/ui/dolly-wizard.js`) statt den Stepper direkt zu erhöhen – wie
`addTruss()`/`openTrussDialog()` für Traversenwagen, nur mit einer einzigen Abfrage (Stückzahl
auf dem Dolly, keine „ohne Dolly“-Option: Line-Array-Elemente und Subwoofer stehen in der
Praxis immer auf einem Dolly). Seit V 0.12.3 fragt der Dialog zusätzlich die Wagengröße ab
(Breite × Tiefe, vorbelegt mit Boxbreite und Dolly-Stufe; Höhe fest), weil Wagen je Firma
verschieden sind; der Traversen-Dialog fragt analog nur die Wagenbreite (`truss.wagonW`). Die reine Geometrie-Funktion `dollyStackCase(baseCase, n, wagen?)`
(`js/model/audioDolly.js`) baut daraus einen neuen, konkreten Case-Typ (Fußabdruck unverändert,
Höhe = Stückzahl × Boxhöhe, Dolly-Höhe im `wheelH`-Feld statt in `h` – die vorhandene
Rollen-Zeichnung aus `caseShape()` übernimmt die Darstellung ohne eigenen Code), der über
`saveCaseValue()` gespeichert wird und danach wie ein Traversenwagen-Typ als eigene Zeile mit
normalem +/−-Stepper erscheint.

## Gewicht: 0 kg ist nicht „unbekannt“

Ein Case-Typ ohne Gewichtsangabe trägt `weight: 0` — das ist absichtlich (`CLAUDE.md`:
lieber 0 als eine erfundene Zahl), muss aber auf dem Weg durch die Schichten von einer
echten Nullangabe unterscheidbar bleiben. `validatePlan()` (`js/model/validate.js`) zählt in
`totals.withoutWeight`, wie viele Stücke einem Case-Typ mit `weight === 0` angehören, und
gibt sie im Inspector und im Druck als „N Cases ohne Gewicht“ neben der Nutzlast aus. Trägt
mindestens ein Stück kein Gewicht, wird der Schwerpunkt zusätzlich über das Volumen
geschätzt (`totals.cog` bekommt eine Kennzeichnung `source: 'volume'` statt `'weight'`), und
die Einseitigkeitswarnung greift, sobald **eine** der beiden Schätzungen (nach Gewicht oder
nach Volumen) einseitig ausfällt — eine Warnung darf durch zusätzliche Information nie
verschwinden.

## Materialbestand

Die Materialverwaltung (V 0.12.5) hat keine eigene Tabelle und keinen `DB_VERSION`-Sprung.
Die reine Logik steht in `js/model/material.js`, die Oberfläche in `js/ui/material.js`.

- **Firma = `company`-String am Case.** Die Firmenliste ist `companyList()` (zählt nur Cases im
  Bestand). Eine neu angelegte, noch leere Firma lebt nur im UI-Zustand der Materialseite, bis
  ihr erstes Case gespeichert ist. Cases ohne `company` bilden die „Standardliste“.
- **Zwei Flags.** `legacy` = ausgeblendet (gelöschte Firmen-Vorlage; alte Ladepläne behalten
  das Stück, `groupCases` blendet es in jeder Auswahl aus). `onlyInPlan` = im Wizard ohne
  „Im Materialbestand ablegen“ angelegt, gilt nur für den Load. `isInStock` = weder noch.
  Fehlen beide Felder (alte Daten), liegt das Case im Bestand. `legacy` gilt nur für `lib-`-IDs:
  an anderen eigenen Cases (alte Editor-Kopien ausgeblendeter Vorlagen) entfernt
  `io.dropStrayLegacy` es beim Laden und beim Import.
- **Bearbeiten einer `lib-`-Vorlage** speichert ein eigenes Case mit **derselben ID** und
  `builtin: false`; `mergeOwnWithBuiltins` lässt die eigene Version gewinnen. Pläne verweisen
  weiter per `caseId`. Dasselbe gilt für „Firma umbenennen“ (`renameCompany`). Beim
  Wiederherstellen einer Sicherung verliert ein lokaler mitgelieferter Eintrag in `mergeById`
  immer gegen den Datensatz aus der Datei, damit Überlagerungen ankommen. Firmennamen sind auf
  80 Zeichen begrenzt (`firmNameError`, dieselbe Grenze wie `checkCase`).
- **Löschen** entscheidet `deletionFor(c)`: jede `lib-`-ID (auch eine schon gespeicherte
  Überlagerung) → Überlagerung mit `legacy: true` (sonst käme die Vorlage beim nächsten Start
  zurück); sonstiges eigenes Case → `repo.deleteCase`; `preset-` →
  nicht löschbar (`null`), nur „Kopieren“ (`copyToCompany`, neue ID, ohne `legacy`/`onlyInPlan`).
- **Import-Regel** (`isPreset` in `js/store/io.js`): `preset-`-IDs und alles mit
  `builtin: true` werden verworfen; eigene Überlagerungen einer `lib-`-ID (`builtin: false`)
  laufen also durch Sicherung und Import.
- **Dolly-IDs je Firma**: `dolly-<slug(firma)>-<basis>-<n>`, weil die Wagenmaße
  firmenabhängig sind. Ohne Firma bleibt es bei `dolly-<basis>-<n>`; bestehende IDs ändern
  sich nie. Traversenwagen tragen `company` nur mit (ihre IDs sind UUIDs).
- **Ablageziel** (`js/ui/stock-target.js`, `applyStockTarget`): Case-Editor, Traversen- und
  Dolly-Dialog teilen den Block „Im Materialbestand ablegen“. Im Wizard (`mode: 'choose'`)
  Häkchen plus Ziel, auf der Materialseite (`mode: 'fixed'`) die vorgegebene Firma. Ohne
  Häkchen wird `onlyInPlan: true` gesetzt.
- **`groupCases` und `keep`**: Das Set `keep` enthält die IDs, die in diesem Wizard-Durchlauf
  angelegt wurden; sie umgehen alle Filter (Suche, Gewerk, Firma, `onlyInPlan`), sonst
  verschwände ein eben angelegtes Case sofort wieder aus der Liste.
- **Materialseite als eigenes Modul**: `mountMaterial` in `js/ui/material.js` bekommt nur
  Callbacks (`onEdit`, `onNewCase`, …) aus `js/app/materialScreen.js`, das Speichern und Löschen
  (`saveCase`, `removeFromStock`) liegt in `js/app/persistence.js`. Die Seite ist ein eigener Bildschirm
  (`#material-screen`, Schalter `materialOpen`). Solange er offen ist, kehrt der
  `keydown`-Handler aus `js/app/keyboard.js` sofort zurück, damit Entf, Pfeile oder Rückgängig nicht
  den dahinterliegenden Plan verändern.

## Speicherung und Austausch

Alles liegt in IndexedDB im Browser. `loadAll()` mischt eigene Cases mit den mitgelieferten:
Bei gleicher ID gewinnt immer das eigene Case, und jede ID kommt genau einmal vor
(`mergeOwnWithBuiltins`) — die Verbraucher bauen daraus eine `Map`, bei der sonst der letzte
gewänne. Schlägt das Laden aus IndexedDB fehl (privates Fenster, blockierter Speicher,
korrupte Datenbank), startet die App trotzdem mit den mitgelieferten Vorlagen
(`repo.loadAllFallback()`) und zeigt ein Banner, statt als weiße Seite abzustürzen.

Seit V 0.8.5 kommt ein eigener Store `ruleSets` dazu (Pack-Regelsets als Vorlage, `js/store/db.js`,
`DB_VERSION` 1 → 2 — `onupgradeneeded` legt fehlende Stores schon vorher idempotent an, ein
bestehendes Schema bricht dadurch nicht). Ein Regelset ist `{ id, name, rules, updatedAt }` und
läuft in Sicherung/Import wie ein Plan mit (per ID, neuerer `updatedAt`-Stand gewinnt); Bundles
ohne `ruleSets` (ältere Sicherungen) ergeben beim Einlesen einfach eine leere Liste.

Export und Import laufen über ein JSON-Bundle (`js/store/io.js`). Mitgelieferte Cases
(`builtin: true`) landen **nicht** in der Datei; Pläne verweisen weiter per `caseId` darauf.
`parseBundle` prüft streng, weil die Datei von außen kommt — unter anderem gegen
`CASE_LIMITS` (`js/model/limits.js`, Obergrenzen für Maße, Gewicht, Rollenhöhe, Stückzahl), eindeutige Stück-IDs je
Plan und einen String-Zeitstempel bei `updatedAt`. IDs, die mit `preset-` beginnen, werden
aus fremden Dateien immer verworfen, um einen mitgelieferten Katalog zu schützen. IDs mit
`lib-` und `builtin: true` werden ebenso verworfen, während eigene Überlagerungen derselben
`lib-`-ID mit `builtin: false` laufen durch, damit bearbeitete Firmen-Vorlagen Sicherung und
Import nicht verlieren (Materialverwaltung). Beim Zusammenführen gewinnt der neuere `updatedAt`-Stand (`mergeById`),
aber nur wenn **beide** Seiten einen String-Zeitstempel tragen — ein kaputter oder fehlender
Zeitstempel verliert immer gegen einen gültigen.

Vor jedem Import lädt `js/app/importExport.js` still eine Sicherung des bisherigen Stands herunter
(`preImportBackupFileName()`, gleicher Name wie `backupFileName()` plus `-vor-import`), bevor
irgendetwas in IndexedDB überschrieben wird. Das Mischen läuft synchron innerhalb eines
`store.update()`-Updaters, damit eine Änderung, die der Nutzer während des Schreibens macht,
nicht stillschweigend zurückgenommen wird; scheitert das Schreiben, wird der Store auf den
Stand vor dem Import zurückgesetzt und der Nutzer kann die eben heruntergeladene Sicherung
erneut anfordern. `js/store/autosave.js` nimmt den betroffenen Plan für die Dauer des Imports
per `exclude()`/`include()` aus der eigenen Buchhaltung, damit ein parallel laufender
Autosave-Schreibvorgang den Import nicht überholt oder rückgängig macht.

Ist die App in einem zweiten Tab oder Fenster gleichzeitig offen, meldet ein
`BroadcastChannel('truckload')` das den beteiligten Tabs — es gibt (Stand V 0.7.0) keinen
Datenabgleich, nur den Hinweis „in einem weiteren Tab offen“, damit der Nutzer nicht
lautlos den einen oder anderen Stand verliert.

## Mitgelieferte Daten

| Datei | Inhalt |
|---|---|
| `js/data/preset-cases.js` | 50 sichtbare Vorlagen: 7 Packcases (je Standardmaß eines), 6 weitere generische Cases (Richtwerte), 24 Pre-Rig-Traversen (MLT/S36PR) und 13 Audio-Einzelboxen im Gewerk „Ton“ (`dollyPrompt`, docs/casemasse-gewichte.md); dazu 7 `legacy`-Einträge, die nur noch für alte Ladepläne existieren. Feste Traversenwagen-Vorlagen gibt es nicht mehr: Wagen entstehen im Traversen-Dialog als eigene Case-Typen, Dolly-Stacks im Dolly-Dialog |
| `js/data/case-library.js` | 137 Cases aus der Excel-Tabelle des Nutzers, alle mit `source: 'liste'` und `company`; davon 15 `legacy` (ausgeblendet, u. a. Transflex-/Pack-Cases, Traversen und Rigging-Pakete der Liste), 122 sichtbar |
| `js/data/categories.js` | Gewerke und ihre Farben |
| `js/data/preset-trucks.js` | Fahrzeugvorlagen |

`legacy: true` heißt: in keiner Auswahl mehr (`groupCases`, `companiesOf` in
`js/ui/caseGroups.js`), aber weiter vorhanden, damit bestehende Ladepläne ihre Stücke mit
unverändertem Namen, Maß und Gewicht behalten. Ersetzte Einträge werden deshalb nie gelöscht,
nur ausgeblendet.

Der Firmen-Filter im Lade-Wizard (`js/ui/load-wizard.js`, Auswahl „Suchen in“) steht standardmäßig
auf „Standardkatalog“, nicht auf „Kompletter Bestand“ (Nutzerwunsch 2026-10-06: firmen-gebrandete
Cases wie die „-CAB“-Geräte sollen nie von selbst auftauchen). `NEUTRAL_COMPANY` in
`js/ui/caseGroups.js` ist der Sentinel-Wert dafür; `groupCases()` lässt damit nur Cases ohne
`company` durch — „Eigene Cases“ und alle `preset-cases.js`-Vorlagen haben nie ein
`company`-Feld und bleiben sichtbar, die ganze Gruppe „Cases aus deiner Liste“ (ausnahmslos
mit `company`) verschwindet, bis der Nutzer gezielt eine Firma oder den kompletten Bestand wählt.
Verschwindet die gewählte Firma aus den Daten, fällt der Filter auf „Standardkatalog“ zurück.

Die 7 Packcases tragen seit V 0.8.6 ein Standardgewicht statt 0 kg: `PACK(l, w, h)` in
`js/data/preset-cases.js` rechnet `Math.round(PACK_REF_KG * l * w * h / PACK_REF_VOLUME)` mit `PACK_REF_KG = 100` und
`PACK_REF_VOLUME = 120 * 60 * 80` (Referenz: das Standard-Packcase 120×60×60 ohne Rollen, also
120×60×80 inkl. Rollen, wiegt 100 kg – Nutzerangabe, keine Recherche, dokumentiert in
`docs/casemasse-gewichte.md`). Alle anderen Packcase-Maße werden danach nach Volumen ab- bzw.
aufgestuft; die Formel steht im Code, nicht die einzelnen Zahlen. Mitgelieferte Cases entstehen
bei jedem Start neu (`mergeOwnWithBuiltins`) – ein anderer Standard ist eine Codezeile, ein
einzelnes Case ändert man über „Case bearbeiten“ (eigene Kopie). Die `legacy`-Einträge behalten
ihre alten Gewichte.

`js/ui/caseGroups.js` (`groupCases`, `companiesOf`) mit den drei Abschnitten (eigene
Cases, Vorlagen, Cases aus der Liste) wird seit V0.7.11 nur noch vom Wizard benutzt
(`js/ui/load-wizard.js`, Schritt „Cases“) – dort browst man den ganzen Katalog, um
neue Case-Typen zu einem Load hinzuzufügen. Die Seitenleiste (`js/ui/library.js`)
zeigt dagegen nur noch den Inhalt des aktuellen Loads (platzierte + unplatzierte
Stücke), umschaltbar zwischen „Noch nicht geladen“ und „Alles Material“ – nicht mehr
den Katalog.

## Darstellung

`js/ui/projection.js` bildet eine 3D-Box auf die drei 2D-Ansichten ab (Draufsicht, Seite
von links, Rückansicht von der Tür). Die beiden Ansichten haben seit V 0.9.2 getrennte Aufgaben:

- **2D ist die nüchterne Planungsansicht – „Tetris“.** `js/ui/view2d.js` zeichnet jedes Stück
  als Rechteck im belegten Außenmaß inkl. Rollen (`it.box`), also genau die Fläche, die es im
  LKW einnimmt. Gefärbt über `caseColors()`; im Modus Schwarz die Gewerkfarbe als dünner
  Innenrahmen. Wo man die Rollen in einer Ansicht von der Kante sieht, markiert ein Streifen
  die Rollenzone in echter Tiefe (`wheelStripRect()` in `projection.js`: Seite aus
  `wheelStrip()`, Tiefe = Abstand zwischen Außenmaß und Korpus aus `caseShape()`).
  Traversenwagen sind Kästen im Außenmaß mit Gitterstruktur über die ganze Fläche: liegt die
  Traversenlänge in der Ansicht, Gurte mit Zickzack, von der Stirn ein Kasten mit
  Diagonalkreuz. Bis V 0.9.1 zeichnete 2D dieselben Details wie 3D und die Rollen als Kreise
  außerhalb des Korpus – die sichtbare Form deckte sich nicht mit der belegten Fläche. Der
  gedruckte Ladeplan nutzt dieselbe Zeichnung.
- **3D ist die reale Ansicht.** `js/ui/view3d.js` zeigt Flightcases mit Alu-Profil,
  Kugelecken, Deckelfuge, Griffen und Rollen, Traversenwagen mit Rollbrett und Gurtrohren, in
  Three.js mit geteilten Geometrien und Materialien (`userData.shared` — diese werden beim
  Aufräumen **nicht** verworfen; alles selbst Erzeugte muss freigegeben werden). `kind:
  'speaker'` (seit V 0.11.0, `addSpeaker()`) ist ein dritter eigener Zweig neben Flightcase und
  Traversenwagen. Nach mehreren Runden Nutzer-Feedback („es sind immer noch Cases“) wird jede
  Einzelbox eines Dolly-Stacks als eigenes Lautsprecher-Gehäuse gezeichnet, nicht als Quader mit
  aufgemalten Linien – Vorbild sind Nutzer-/Herstellerfotos des L-Acoustics K2 und K2-CHARIOT:
  - Jede Box ist eine `THREE.Group` in lokalen cm-Koordinaten (Breite `c.l`, Tiefe `c.unitD`
    mit der Front bei −y, Höhe `c.unitH`), um `p.rot` gedreht – die Front zeigt je nach Drehung
    in eine andere Richtung, der Nutzer dreht sie mit „R“. Die Stellfläche ist so tief wie der
    Dolly (`c.w`, 60/80/120 cm über `dollyDepth()`); die Box sitzt mit der Front bündig an der
    Dolly-Vorderkante, hinten bleibt der Dolly frei. Die Bounding-Box fürs Packen bleibt der
    volle Quader.
  - Array-Tops (`speakerType: 'top'`) haben ein Keilprofil (`GEO_WEDGE`, Rückseite auf
    `SPEAKER_BACK_RATIO` = 0,8 verjüngt; kalibriert an der K2-Zeichnung, 286/354 mm, eigene
    optische Annahme). Gestapelt ergibt das vorn eine gerade Fläche und hinten die typischen
    Keil-Lücken. Subs (`'sub'`) sind Quader.
  - `speakerUnitParts()`: Front mit hellerem Grillefeld im Gehäuserahmen (ab 100 cm Breite zwei
    Felder mit Mittelsteg) und Marken-Badge; Seiten mit Rigging-Platte und Griffstange. Die
    Sichtbarkeit trägt der Helligkeitskontrast Grille ↔ Gehäuse – feine Texturen oder Spalte
    verschwinden aus normaler Kamera-Distanz (Lehre aus V 0.11.2/0.11.3).
  - Gehäusefarbe aus `c.cabinetColor` (`bodyMaterial(…, plain)`, ohne Laminat-Körnung), nicht
    aus dem Farbmodus; die Gewerk-/Stück-/Gewichtsfarbe sitzt als dünne Marke außen am offenen
    Dolly-Rahmen (`speakerDollyFrame()`), die Rollen sind gelb (`MAT_WHEEL_SPEAKER`).
  - Beschriftung auf der Rückseite der untersten Box und als kleines Feld auf der Oberseite der
    obersten – nicht auf Grille oder Seiten.

  Dolly-Stacks aus früheren Versionen (ohne `kind`, teils noch mit der alten ID
  `preset-<basis>-dolly-<n>`) bekommen die fehlenden Felder über `upgradeDollyStack()`
  (`js/model/audioDolly.js`), aufgerufen aus `normalizeCase()` beim Laden und beim Import;
  Maße, Gewicht und ID bleiben unverändert. `openDollyDialog()` berechnet den Case-Typ bei jedem
  Dialog-Lauf neu (Ruling 2026-10-08, ersetzt die frühere „nicht überschreiben“-Regel aus dem
  Final-Review, die verhinderte, dass bestehende Stacks neue Darstellungsfelder bekamen).

  2D (`js/ui/view2d.js`) liest `kind` nicht und bleibt bei der nüchternen Tetris-Darstellung.

Jede der drei 2D-Ansichten lässt sich seit V 0.8.0 für sich zoomen und verschieben
(`js/ui/zoom2d.js`). Gezoomt wird allein über die `viewBox`: `renderView` setzt sie über
`applyViewBox(svg, full)`, das je SVG den Zoom aus einer `WeakMap` holt und bei einem anderen
Truck (anderes `full`) zurücksetzt. Weil jede Umrechnung Bildschirm → Truck über
`getScreenCTM()` läuft (`toSvg`), funktionieren Verschieben und Hineinziehen gezoomt ohne
Sonderfall. Die Rechnung (`zoomAt`, `panBy`, `resolveViewBox`) ist rein und getestet; der
Ausschnitt bleibt immer innerhalb des ganzen Trucks und ist mindestens `MIN_VIEW_W` (40 cm)
breit. Mausrad und Trackpad-Wischen unterscheidet `attachZoom` an der Schrittgröße
(Zeilen-Modus oder `|deltaY| ≥ 50` ohne `deltaX` gilt als Mausrad), Pinch kommt als `wheel`
mit `ctrlKey`. Der Druck (`js/ui/print.js`) nutzt eigene SVGs ohne Zoom-Zustand.

Welche Farbe ein Case bekommt, entscheidet `caseColors(c, mode, itemColor)` in
`js/ui/caseStyle.js` — gemeinsam für 2D, 3D und Druck. Die Dreier-Signatur ist ein eigens
getesteter Vertrag; der Modus `'weight'` (V 0.9.0) hat ihn deshalb nicht erweitert, sondern
verhält sich wie `'trade'` (Korpus in der übergebenen Farbe, kein Streifen). Die Gewichtsfarbe
selbst rechnen `weightRange(items)` und `weightColor(kg, range)` aus, und der Aufrufer reicht
sie als `itemColor` durch. `renderView`/`update` rechnen die Spanne **einmal je Render**, nicht
je Stück. 0 kg heißt „unbekannt“ und wird neutral grau — dieselbe Regel wie bei der Deckschicht
(siehe „Gewicht: 0 kg ist nicht ‚unbekannt‘“ weiter oben). `drawTruss` lässt den Farbmodus
bewusst außen vor: Traversen behalten ihre Markenfarbe.

Die Lagen-Durchsicht (`layerLimit` in `renderView`) zeichnet Stücke oberhalb der gewählten Lage
mit `.faint` blass. Die Lage je Stück kommt aus `result.layers` — berechnet von `layerMap()` in
`js/model/validate.js`, derselben Zahl, die der Inspector und die Druck-Tabelle als „Lage“
zeigen. Sie wird nicht neu abgeleitet, damit beide Angaben nicht auseinanderlaufen können.
In 3D werden solche Stücke **ausgeblendet** statt blass gezeichnet (`js/ui/view3d.js`,
`update()` überspringt sie): Materialien liegen dort nach Farbe im Zwischenspeicher und die
Profilstäbe laufen als ein einziges `InstancedMesh` über alle Cases — eine Transparenz je
Stück hieße, beides zu verdoppeln und zu trennen. Welche Stücke betroffen sind, entscheidet in
beiden Ansichten dieselbe Funktion `aboveLayer()` in `js/model/items.js`, damit sie nicht
auseinanderlaufen; das ausgewählte Stück ist dort immer ausgenommen. Die Spanne des
Gewichtsmodus läuft weiter über ALLE Stücke — sonst spränge die Farbskala beim Umschalten
der Lagen um.

`js/ui/print.js` erzeugt drei Dokumente in dasselbe `#print-root`: `buildPrint` (Ladeplan, mit
SVG-Ansichten), `buildChecklist` (Abhakliste) und `buildLabels` (Etiketten). Welches gilt,
steuert `js/app/chrome.js` über eine Klasse am Wurzelelement (`doc-plan`/`doc-checklist`/`doc-labels`,
bei Etiketten zusätzlich `size-large`/`size-small`), die `css/print.css` auswertet. Alle drei schreiben
nur `root.innerHTML`, brauchen dafür also kein echtes DOM, sondern nur eine Attrappe – deshalb
sind sie ohne jsdom testbar (`tests/print.test.js`). Allein `buildPrint` greift danach über
`root.querySelector` auf das DOM zu, um die SVGs einzuhängen. Die Seitenvorschrift hängt an der Druckart:
`pageRuleFor(doc)` liefert für Etiketten `@page { size: A4 portrait; margin: 0 }`, sonst `null`.
`js/app/chrome.js` hängt die Regel vor `window.print()` als `<style id="print-page">` ein und entfernt
sie im `afterprint` wieder — benannte Seiten (`@page x { … }` + `page:`) wären der direktere
Weg, werden aber von Browsern uneinheitlich unterstützt. Die Grundregel in `css/print.css`
bleibt A4 quer und gilt damit für Ladeplan und Abhakliste.

Kugelecken (nur noch in 3D) ragen nie über das Außenmaß hinaus — das gemessene Maß enthält
sie schon. Ihr Mittelpunkt liegt um den Radius nach innen versetzt (`cornerCenters3d`,
`CORNER_R` in `js/ui/caseStyle.js`). Bis V 0.8.1 saßen sie mittig auf der Ecke und standen bis
zu 6 cm über.

Beschriftungen stehen auf allen Seiten: in 2D auf jeder sichtbaren Fläche, in 3D als
Canvas-Textur auf vier Seiten plus Deckel (`js/ui/labelTexture.js` liefert die Flächen und
die Schriftgröße, ohne Three.js zu kennen). Die Schriftfarbe wird aus dem **tatsächlichen
Hintergrund** abgeleitet, nicht aus der Stückfarbe — sonst steht dunkle Schrift auf
schwarzem Case.

## Was leicht übersehen wird

- `caseColors(c, mode, itemColor)` braucht den dritten Parameter, sonst kommt die
  Stückfarbe nicht an. Genau das ist in V 0.4.0 in der 3D-Ansicht passiert.
- `setItemLabel` hat Teil-Änderungs-Semantik: ein fehlendes Feld bleibt unverändert, `null`
  oder leerer String entfernt es. Wer beide Felder immer mitgibt, löscht ungewollt.
- `maxlength` in der Oberfläche und die Grenze in `checkPlan` müssen zusammenpassen, sonst
  erzeugt die App Daten, die ihr eigener Import ablehnt.
- Der Packer lässt Stücke in der Ablage, die er nicht unterbringt — sie gehen nicht
  verloren, auch nicht bei fehlendem Case-Typ (`orphans`).
- `issue.code` (`validate.js`) ist ein bewusster Erweiterungspunkt, heute aber nur von den Tests
  gelesen — kein UI-Modul wertet ihn aus, Inspector und Druck zeigen ausschließlich `issue.message`.
  Wer eine Meldung UI-seitig unterscheiden will (Symbol, Filter, Sortierung), findet den Code dafür
  schon vor; ein Tippfehler in einem neuen `add(...)`-Aufruf fällt dabei nur über die Tests auf, es
  gibt keine benannte Konstantenliste.
- Alle Meldungstexte in `validatePlan` nennen seit V 0.7.0 `it.label` (die Stück-Beschriftung),
  nicht mehr `it.c.name` (den Case-Typ) — bei mehreren Exemplaren desselben Typs lässt sich eine
  Meldung sonst keinem Stück zuordnen.
- `ARCH_SIDES` liegt in `js/model/geometry.js` (Modellschicht, wo `archBoxes()` es tatsächlich
  braucht), nicht in `js/store/io.js`; `io.js` importiert es von dort.
