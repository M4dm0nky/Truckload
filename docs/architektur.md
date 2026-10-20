# Aufbau der Anwendung

Stand V 0.17.0. Diese Datei beschreibt das Datenmodell, die Schichten und die Invarianten,
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

`js/store/db.js` hat zwei Backends: IndexedDB und, wenn NYX `globalThis.truckloadHost`
bereitstellt, `js/store/hostDb.js`. Die Wahl fällt je Aufruf; `repo.js` und alles darüber
merken nichts davon. Einzelheiten in [nyx-host.md](nyx-host.md).
Gestaltung und Drucken für einen Host stehen ebenfalls in [nyx-host.md](nyx-host.md)
(`js/ui/themeTokens.js`, `js/ui/themeColors.js`, `js/app/hostPrint.js`).

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

- `core.js` — reine Zustandshelfer (`ctxOf`, `deriveOf`, `allPlansOf`, `piecesOf` und `activeLkwOf` für Mehr-LKW-Pläne, Nutzungszähler).
- `screens.js` — Bildschirmwahl (`screenOf`: Material hat Vorrang, ohne gewählten Plan ist Start, sonst Plan) und Startbildschirm.
  Der Startbildschirm (`renderStartScreen`) zeigt „Neuen Load erstellen“, „Material“, die gespeicherten
  Ladepläne nach Name sortiert (oder „Noch keine gespeicherten Ladepläne.“), „Sicherung importieren“ und
  die Versionsnummer. Beim Start ist `plan` immer `null`; ein Plan wird erst durch Auswahl oder Anlegen geöffnet.
- `keyboard.js` — Tastenzuordnung (`keyFor`, rein) und der Dokument-Handler dafür.
- `guarded.js` — führt eine Speicheraktion mit genau einer Fehlermeldung aus.
- `persistence.js` — Speicherpfade für Case, Sammlung, Regelset und Fahrzeug: erst schreiben, dann den Store nachziehen. Alle Case-Schreibvorgänge laufen nacheinander durch eine Warteschlange (siehe „Sammlungen“).
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
  bleibt frisch (Restrisiko: Issue #27).
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
auf einem platzierten Stück) geht direkt auf `standing` (beides über `toggleTip`). `A.unloadAll`
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

**Grund in der Ablage (`unplacedReason`, `js/model/unplacedReason.js`).** Die Seitenleiste nennt
bei einem Stück in „Noch nicht geladen“ den Grund, aber nur einen, der allein aus den Maßen folgt:
`chooseOrientation` (dieselbe Auswahl wie im Packer) findet für das Stück keine Lage im Laderaum,
und zwar entweder weil es schlicht zu groß ist, oder weil `tipped: true` bzw. `tipped: false` die
einzig passende Lage ausschließt. Nutzlast, Lagen-Einschränkung und Pack-Regeln prüft die Funktion
nicht; passt das Stück geometrisch, liefert sie `null`, und es steht kein Grund da — „kein Platz“
wäre geraten, denn die Ablage füllt sich auch durch „In Ablage“, „Truck entladen“ oder einen
Wizard ohne Packen. `js/ui/library.js` berechnet die Gründe je Stand von Ablage, Cases und Fahrzeug
einmal (`reasonOf`).

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

**Manuelles Tippen (`toggleTip`, seit Abschluss Teil 1; vorher der Schritt-Weiter `cycleTip`):**
Taste T und das „getippt“-Häkchen im Inspector (`setPieceTipped`) laufen über dieselbe reine
Funktion `toggleTip(piece, case)` (`geometry.js`, als Aktion `A.toggleTipPiece`). Getippt (egal wie
erreicht, auch `tipLong`/`rot 0` vom Packer) -> `standing`, `rot` bleibt; stehend -> die erste
mögliche getippte Lage, die `nextTip(orientation, rot)` von `standing` aus liefert: sie kippt
relativ zur aktuellen Lage nach vorn (Fahrtrichtung) — die Case-Kante, die gerade auf der x-Achse
liegt, geht nach oben, die Seitenkante (y-Achse) bleibt. `nextTip` rechnet rein symbolisch anhand
der Dimensions-Namen, nicht anhand fester `rot`-Werte; welche der beiden getippten Lagen
(`tipLong`/`tipShort`) herauskommt, hängt davon ab, ob Länge oder Breite in Fahrtrichtung steht.
Nicht tippbare Cases und Traversen bleiben unverändert.
Bis V 0.7.2 setzte das Tippen `rot` bei jedem Übergang stattdessen fest so, dass die Rollen zur
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
dritt statt zu viert. Bei überfüllter Ladung merkt sich `placeStacks` je Sorte die gescheiterten Grundflächen samt Höhe
und lehnt einen Stapel mit identischer Grundfläche (auch um 90° getauscht) und mindestens gleicher
Höhe ohne neue Suche ab; die Merkliste verfällt nach jeder Platzierung. Eine bloß größere Grundfläche
genügt nicht, weil das Spurraster von der Stapelbreite abhängt. Die Punkte werden nur nach einer
Platzierung neu sortiert. Die Ausgabe bleibt unverändert (Vergleich mit dem alten Packer,
`tests/packer-golden.test.js`, `tests/packer-property.test.js`). Spec:
`docs/superpowers/specs/2026-09-28-sortenrein-packen-design.md`.

**Deckschicht (seit V 0.8.6, mehrere Stücke nebeneinander seit V 0.13.12):** optionaler Schalter
`plan.mixTop` (`mixTopFor(plan)`, `js/model/packRules.js`), umgesetzt in `buildStacks`
(`js/model/packer.js`). Für jedes Stück probiert `addTo` vier Wege der Reihe nach: (1) den letzten
offenen Stapel des vorigen Blocks auffüllen (`prevLast`, wie bisher), (2) einen eigenen Stapel gleicher
Grundfläche (wie bisher), (3) nur bei `mixTop`, wenn beides scheitert: als Deckstück auf einen Stapel
eines **früheren** Blocks, (4) sonst ein neuer Stapel am Boden. Kandidaten für (3) sind die Stapel
früherer Blöcke in Entstehungsreihenfolge; es gewinnt der erste passende (näher an der Stirnwand) –
deshalb können mehrere kleine Cases auf demselben großen landen, statt sich zu verteilen (README,
Abschnitt „Deckschicht mischen“).

*Datenstruktur.* Die Deckschicht ist **eine** Lage auf dem **obersten Hauptstück** des Stapels.
`s.cap = { n, z, row }`: `n` = Anzahl der Hauptstücke, `z` = Unterkante der Deckschicht (= Höhe des
Hauptstapels), `row` = Zustand des Regalverfahrens. Die Deckstücke stehen in `s.items` hinter den
Hauptstücken, alle auf `z = cap.z`, mit Versatz `ox`/`oy` in der Fläche des ungedrehten Stapels
(`pushCap`). Die Stapelhöhe ist Oberkante des Hauptstapels plus höchstes Deckstück, `weight` die Summe
aller Stücke, die Grundfläche bleibt die des Hauptstapels. Ein Stapel mit Deckschicht
(`s.capped = true`) nimmt kein Stück seiner eigenen Sorte mehr an, trägt nichts obendrauf und gilt wie
ein aufgefüllter Stapel als `mixed` (steht innerhalb seines Blocks zuletzt).

*Prüfung.* `capFits(s, it, c, o, truck)` entscheidet, ob ein Stück als weiteres Deckstück auf Stapel
`s` passt: `belongsTogether(a, ca, b, cb)` (beide mit Gruppe → gleiche Gruppe, beide ohne → gleiches
Gewerk, gemischt → nein) zwischen dem Stück und dem Gründungsstück des Stapels,
`sameSelectorRank(rules, a, b)` (`packRules.js` – für jede Auswahlregel derselbe Rang wie der Block des
Stapels, sonst könnte eine Deckschicht ein „zuletzt“ unterlaufen), keine Traversen auf keiner Seite,
alle Gewichte bekannt (`> 0`, 0 kg = unbekannt), das oberste Hauptstück stapelbar, `pieceLayers` und
höchstens 4 Lagen, Oberkante der Deckschicht höchstens Fahrzeughöhe. Gewicht: Die **Summe** der Deckgewichte (mit dem
neuen Stück) darf die `maxTopLoad` des obersten Hauptstücks und jeder Stücke darunter (Kette, jeweils
mit dem Gewicht der Stücke darüber) nicht überschreiten (wie beim Stapeln, nur mit der Summe). Eigene
Entscheidung: Zusätzlich darf die Summe das Gewicht des obersten Hauptstücks nicht übersteigen
(„nichts Schweres auf Leichtes“ für die Lage als Ganzes).

*Regalverfahren.* Deterministisch in Ankunftsreihenfolge, im Koordinatensystem des ungedrehten Stapels
(x entlang `dx`, y entlang `dy`): Das Stück kommt in der aktuellen Reihe rechts an das letzte (erst
Orientierung wie gewählt, sonst um 90° gedreht); passt es dort nicht, beginnt eine neue Reihe im Abstand
der Tiefe der tiefsten Stücke der bisherigen; passt auch das nicht, ist der Stapel für dieses Stück
ungeeignet und die Suche geht zum nächsten früheren Stapel weiter. Die Reihe ist kein optimales
Packen, sondern ein einfaches, nachvollziehbares Verfahren (eigene Entscheidung, siehe
Issue #24).

*Versatz im Stapel.* `autoPack` rechnet die Deckstück-Positionen in Weltkoordinaten um:
`x = box.x0 + (swap ? oy : ox)`, `y = box.y0 + (swap ? ox : oy)`. Hat `placeStacks` den Stapel im
Grundriss um 90° gedreht (`swap`), ist er transponiert – die Versätze tauschen deshalb wie die Maße,
die `rot + 90°` vertauscht. Ohne diese Transposition würden Deckstücke eines gedrehten Stapels
überstehen (der Eigenschaftstest in `tests/packer-property.test.js` schlägt an, wenn die Transposition fehlt).

*Rückfall (Hochstufen).* Scheitert „nebeneinander“ und trägt die Deckschicht des Stapels genau **ein**
Stück (`s.items.length === s.cap.n + 1`), versucht `buildStacks` das neue Stück auf diesem Deckstück
(`capFits({ ...s, cap: null }, …)`: das einzelne Deckstück gilt als oberstes Hauptstück, mit seinem
Versatz `ox`/`oy` als Fläche); gelingt das, setzt `pushCap` `s.cap = null` („Hochstufen“) und beginnt
eine neue Deckschicht auf ihm. Das ist das frühere Verhalten (Deckstück auf Deckstück). Deckschichten
mit zwei oder mehr Stücken werden nie hochgestuft. Erst „nebeneinander“, dann „übereinander“ ist eine
eigene Entscheidung.

*Validierung.* `validatePlan` braucht keine Sonderfälle: Auflage, Lagen und Last laufen über die
Geometrie der Platzierungen, die Last auf dem obersten Hauptstück ist daher die Summe der Deckstücke
(`tests/validate.test.js`, „Deckschicht nebeneinander (gepackt)“).

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

Legt der Traversen-Dialog einen Wagen-Typ an, den es mit „im Materialbestand ablegen“ schon gibt,
wird er wiederverwendet (`findMatchingWagon`, `js/model/truss.js`): gleiches Profil, gleiche Länge,
Stückzahl und Wagenbreite, gleiche Firma, weder `legacy` noch `onlyInPlan`. Ohne das Häkchen gibt
es nie einen Treffer, weil `onlyInPlan`-Typen global sind und sich zwei Loads sonst einen Typ
teilen würden.

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

**Gewicht im Inspector (`weightEditable`/`weightField`, `js/ui/inspector.js`).** Das Gewicht ist
eine Eigenschaft des Case-Typs, nicht des Stücks. Der Inspector zeigt es für eigene Cases und
Firmen-Vorlagen (`lib-`, als Überlagerung gespeichert) als Zahlenfeld mit dem Hinweis „gilt für
alle Stücke dieses Typs“; Änderungen laufen über denselben Speicherpfad wie der Case-Editor.
Standardvorlagen (`preset-`) bleiben lesbar mit Verweis auf „Kopieren“, Traversenwagen ebenfalls
(ihr Gewicht ergibt sich aus der Konstruktion).

## Materialbestand

Die Materialverwaltung (V 0.12.5) hat keine eigene Tabelle und keinen `DB_VERSION`-Sprung.
Die reine Logik steht in `js/model/material.js`, die Oberfläche in `js/ui/material.js`.

- **Sammlung statt Firma (seit V 0.17.0).** „Firma“ heißt in der Oberfläche „Sammlung“ und ist
  ein eigener Datensatz (Abschnitt „Sammlungen“ unten). `company` bleibt ein gewöhnliches Case-Feld
  und ist der Name der Sammlung, in die das Case zuletzt verschoben oder gespeichert wurde (bei
  eigenen benannten Sammlungen entspricht es deren Namen). Nicht verschobene Listen-Cases
  (`data/meine.json`, alle mit `company`) und migrierte alte Cases tragen den früheren Firmennamen,
  obwohl ihr Datensatz `meine` ist; maßgeblich ist der Datensatz, nicht `company`. `companyList()` und `renameCompany()` in `js/model/material.js` stehen noch als reine
  Funktionen, die Oberfläche benutzt sie nicht mehr. Eine leere, neu angelegte Sammlung ist ein
  echter Datensatz und kein UI-Zustand mehr. Was früher die „Standardliste“ war (Cases ohne
  `company`), liegt jetzt in „Meine Sammlung“ bzw. „Standard“.
- **Zwei Flags.** `legacy` = ausgeblendet (gelöschte Firmen-Vorlage; alte Ladepläne behalten
  das Stück, `groupCases` blendet es in jeder Auswahl aus). `onlyInPlan` = im Wizard ohne
  „Im Materialbestand ablegen“ angelegt, gilt nur für den Load. `isInStock` = weder noch.
  Fehlen beide Felder (alte Daten), liegt das Case im Bestand. `legacy` gilt nur für `lib-`-IDs:
  an anderen eigenen Cases (alte Editor-Kopien ausgeblendeter Vorlagen) entfernt
  `io.dropStrayLegacy` es beim Laden und beim Import.
- **Bearbeiten einer `lib-`-Vorlage** speichert ein eigenes Case mit **derselben ID** und
  `builtin: false`; `mergeOwnWithBuiltins` lässt die eigene Version gewinnen. Pläne verweisen
  weiter per `caseId`. Dasselbe gilt für das Verschieben in eine Sammlung und für „Sammlung
  umbenennen“ (`renameCollection`: die Cases der Sammlung ziehen mit `company` mit). Beim
  Wiederherstellen einer Sicherung verliert ein lokaler mitgelieferter Eintrag in `mergeById`
  immer gegen den Datensatz aus der Datei, damit Überlagerungen ankommen. Sammlungsnamen sind auf
  80 Zeichen begrenzt (`MAX_FIRM`, dieselbe Grenze wie `checkCase`; geprüft von
  `collectionNameError` in `js/model/collections.js`).
- **Löschen** entscheidet `deletionFor(c)`: jede `lib-`-ID (auch eine schon gespeicherte
  Überlagerung) → Überlagerung mit `legacy: true` (sonst käme die Vorlage beim nächsten Start
  zurück); sonstiges eigenes Case → `{ remove: id }`, das `repo.writeCases({ removeIds })` aus dem
  Datensatz nimmt; `preset-` → nicht löschbar (`null`), nur „Kopieren“ (`copyToCompany`, neue ID,
  ohne `legacy`/`onlyInPlan`). „Sammlung löschen“ (`deleteCollection` in `persistence.js`) wendet
  `deletionFor` auf jedes Case der Sammlung samt Untersammlungen an: die Überlagerungen der
  `lib-`-Cases gehen mit `collectionId: 'meine'` nach „Meine Sammlung“ (ausgeblendet, `company`
  bleibt), der Rest fällt mit den Datensätzen weg, alles in einem `writeMany`.
- **Import-Regel** (`isPreset` in `js/store/io.js`): `preset-`-IDs und alles mit
  `builtin: true` werden verworfen; eigene Überlagerungen einer `lib-`-ID (`builtin: false`)
  laufen also durch Sicherung und Import.
- **Dolly-IDs je Firma** (= `company`, also Name der Sammlung): `dolly-<slug(firma)>-<basis>-<n>`, weil die Wagenmaße
  firmenabhängig sind. Ohne Firma bleibt es bei `dolly-<basis>-<n>`; bestehende IDs ändern
  sich nie. Teilen zwei Firmen denselben Slug („CAB Berlin“, „CAB-Berlin“), bekommt die später
  hinzugekommene ein Suffix (`dolly-cab-berlin-2-…`); `uniqueDollySlug(firma, vorhandeneCases)`
  entscheidet das als reine Funktion, eine Firma behält dabei ihren bisherigen Slug (eigene
  Entscheidung). Traversenwagen tragen `company` nur mit (ihre IDs sind UUIDs).
- **Ablageziel** (`js/ui/stock-target.js`, `applyStockTarget`): Case-Editor, Traversen- und
  Dolly-Dialog teilen den Block „Im Materialbestand ablegen“. Im Wizard (`mode: 'choose'`)
  Häkchen plus Ziel, auf der Materialseite (`mode: 'fixed'`) die vorgegebene Sammlung (als `company`). Ohne
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

## Sammlungen (seit V 0.17.0)

Entwurf: `docs/superpowers/specs/2026-10-13-sammlungen-design.md`; für NYX: `docs/nyx-sammlungen.md`.
Reine Logik (ohne DOM und Store) steht in `js/model/collections.js`, Laden und Schreiben in
`js/store/repo.js`, Datei-Formate in `js/store/io.js`, die Speicherpfade in `js/app/persistence.js`.

- **Datenmodell.** Eine Sammlung ist ein Datensatz `{ id, name, parentId?, updatedAt, cases[] }` im
  Object Store `collections` (`DB_VERSION` 3). Im Speicher bleibt die **flache Case-Liste**; Packer
  und Oberfläche ändern sich dadurch nicht. Jedes eigene Case trägt zur Laufzeit `collectionId`,
  gespeichert wird es nicht (`recordsAfterChanges` entfernt es). `store.collections` ist die
  Meta-Liste `{ id, name, parentId?, updatedAt?, readOnly? }` ohne Cases.
- **Feste IDs.** `standard` („Standard“, `readOnly`, nie gespeichert, ein Datensatz mit dieser ID
  wird beim Laden ignoriert) und `meine` („Meine Sammlung“, beschreibbar, nicht umbenennbar,
  nicht löschbar, nicht verschiebbar). Name und `readOnly` der beiden kommen immer aus
  `withBuiltins()`, nie aus einem Datensatz. Eigene Sammlungen haben eine UUID.
- **Zuordnung.** `collectionIdOf(c)`: die gesetzte `collectionId`; sonst `standard` für
  mitgelieferte `preset-`-Cases, alles andere (auch mitgelieferte `lib-`-Cases) `meine`.
- **Zusammensetzen beim Laden.** `loadAll()` liest `collections`, setzt per `composeRecords` Meta-Liste
  und flache Case-Liste zusammen, wendet `normalizeOwnCases` an und mischt die Mitgelieferten
  dahinter (`mergeOwnWithBuiltins`, das eigene Case gewinnt je ID). Die mitgelieferten Dateien
  `data/standard.json` und `data/meine.json` werden per JSON-Modul-Import gelesen und **nicht** in
  den Store gesät.
- **Schreiben nur über `repo.writeCases`.** Es liest die Datensätze (`readRecords`), baut mit
  `recordsAfterChanges` nur die geänderten neu (Name und `parentId` kommen aus der Meta-Liste) und
  schreibt sie samt Löschungen in **einem** `db.writeMany`: alles oder nichts. Der Import einer
  Sicherung (`saveImportWinners`) setzt Cases und Sammlungen genauso zusammen und hängt Fahrzeuge,
  Pläne und Regelsets an dasselbe `writeMany`.
- **Warteschlange.** `writeCases` liest und schreibt ganze Datensätze; zwei überlappende Aufrufe
  verlören eine Änderung. Deshalb laufen `saveCase`, `removeFromStock`, `createCollection`,
  `renameCollection`, `moveCollection`, `deleteCollection`, `moveCaseTo` und
  `importCollectionFile` nacheinander durch eine Promise-Kette (`serial`, auch als `enqueue`
  exportiert). Der Zustand, aus dem ein Vorgang gebaut wird, wird erst im Schritt selbst
  gelesen; eine Ablehnung vergiftet die späteren Schritte nicht. Rückfragen
  (`showConfirm`/`showAlert`) laufen **vor** dem Einreihen bzw. innerhalb des Schritts; eine
  offene Meldung hält also spätere Schreibvorgänge an.
- **Zielsammlung eines Cases** (`resolveTarget`): ausdrückliche `collectionId` (beschreibbar);
  sonst die des schon vorhandenen Cases gleicher ID; sonst eine Sammlung mit dem Namen aus
  `company` (so entsteht „+ Neue Sammlung …“ im Wizard, in demselben Schreibvorgang); sonst
  „Meine Sammlung“. Der Name einer festen Sammlung oder ein unzulässiger Name legt keine an.
- **Migration.** Existiert kein Datensatz `meine`, aber der alte Store `cases` hat Einträge,
  entsteht `meine` daraus in **einem** `writeMany`. Nichts wird gelöscht; der alte Store wird
  nicht aufgeräumt und bleibt als Sicherheitsnetz. Scheitert das Schreiben, läuft die App mit dem
  berechneten Stand weiter und `readRecords` baut den Datensatz beim nächsten Speichern aus dem
  alten Store auf. Alte Daten laden dadurch unverändert (Regressionsfälle in
  `tests/collections-repo.test.js`).
- **`company` = Name der Sammlung, in die zuletzt verschoben wurde.** `moveCase` setzt es bei einer eigenen Sammlung auf
  deren Namen (Dolly-IDs, Traversen-Treffer und die Anzeige „· Name“ bleiben so wie bisher), bei
  „Meine Sammlung“ entfernt es das Feld und macht aus einem mitgelieferten Listen-Case eine
  Überlagerung (`builtin: false`, gleiche ID). `renameCollection` zieht `company` der Cases mit.
  Das Verschieben einer Sammlung ändert die `company` der Cases darin nicht.
- **Regeln.** Name: nicht leer, höchstens `MAX_FIRM` (80) Zeichen, nicht `__…__`, eindeutig ohne
  Groß-/Kleinschreibung über alle Sammlungen (`collectionNameError`). Tiefe höchstens `MAX_DEPTH`
  (4), keine Verschiebung in sich selbst oder unter einen Nachfahren, nicht unter „Standard“
  (`parentError`). Eine Sammlung löschen entfernt Untersammlungen mit.
- **Sicherung und Sammlungsdatei** (`js/store/io.js`). `exportBundle` trägt `collections` mit nur
  `{ id, name, parentId?, updatedAt? }` der eigenen Sammlungen; die Cases bleiben flach in `cases`
  mit `collectionId`. `parseBundle` nimmt Bundles ohne `collections` (alle Cases nach „Meine
  Sammlung“), prüft jede Sammlung (`checkCollection`, ID höchstens 64 Zeichen, `MAX_COLLECTIONS` =
  200 je Datei) und repariert mit Meldung statt abzulehnen: doppelte oder reservierte Namen
  werden mit „ (2)“ … versehen, unbekannte Oberebene oder Schleife → oberste Ebene, unbekannte
  `collectionId` → „Meine Sammlung“. `mergeImportedBundle` mischt Sammlungen per `mergeById`
  (neuerer `updatedAt` gewinnt); beim Schreiben (`saveImportWinners`) bleibt ein Case ohne
  bekannte `collectionId` in der Sammlung, in der es lokal liegt, ein neues kommt nach „Meine
  Sammlung“. Die Sammlungsdatei (`format: 'truckload-collection'`, Version 1;
  `exportCollectionFile`/`parseCollectionFile`) enthält eine Sammlung und ihren Bestand ohne
  mitgelieferte Cases und ohne `collectionId`. `importCollectionFile` mischt bei gleicher ID
  (nicht „Standard“/„Meine“) in die vorhandene Sammlung, je Case gewinnt der neuere Stand; ein
  gleicher Name unter anderer ID bekommt das Suffix „ (2)“; die Sammlung kommt auf die oberste
  Ebene und setzt `company` ihrer Cases auf ihren Namen. Eigene Entscheidung: die Sammlungsdatei
  führt die Altschema-Reparaturen des Bundles (Beschriftung, Rollenhöhe, Namenslänge) nicht aus.
- **Mitgelieferte Dateien und Überlagerungen.** Neue Einträge in `data/meine.json` erreichen
  jeden Nutzer beim nächsten Start (sie werden nicht gesät). Ein Eintrag, für den schon eine
  Überlagerung gleicher ID existiert (bearbeitet, verschoben, ausgeblendet oder mit der Sammlung
  gelöscht), bleibt dagegen in der Überlagerung stehen: spätere Änderungen an der mitgelieferten
  Version erreichen ihn nicht.
- **Oberfläche.** `js/ui/material.js` zeigt den Baum (`collectionRows`), `js/app/materialScreen.js`
  verdrahtet ihn mit `persistence`. „Kopieren“ und „In Bestand übernehmen“ fragen die Zielsammlung
  (`adoptInto`); die Liste und „Sammlung exportieren“ zeigen nur Bestand der einen Sammlung
  (`exportableCases`).

## Mehrere LKW (seit V 0.14.0)

Ein Plan kann mehrere Fahrzeuge tragen. Das ist eine Erweiterung, kein neues Modell: Ein Plan
ohne `lkws` ist weiter ein gewöhnlicher Ein-LKW-Plan, es gibt keine Migration.

**Datenmodell.** `plan.lkws?: [{ id, name, truckId, categories }]` (`js/model/lkw.js`). Fehlt das
Feld oder ist die Liste leer, gilt `plan.truckId` wie bisher. Mit `lkws` trägt jedes Stück
(Platzierung und Ablage-Eintrag) optional `lkw: <lkw.id>`; ohne oder mit unbekannter ID ist es
**nicht zugeordnet**. `lkw` gehört nicht zu `PIECE_FIELDS`. `plan.truckId` bleibt das Fahrzeug
des ersten LKW (Rückfallwert für alte Programmstände); `addLkw`/`updateLkw`/`removeLkw` halten das
ein. `categories` sind Gewerk-Namen; ein LKW mit leerer Liste ist der **Rest-LKW**. Grenzen:
höchstens `MAX_LKW` = 12 LKW (`js/model/limits.js`). Die Oberfläche verbietet, den letzten LKW zu
löschen (`removeLkw` auf dem letzten würde `lkws` entfernen und den Plan zum Ein-LKW-Plan machen).

**Ansicht und Zurückschreiben.** Packer, Aktionen, `validatePlan`, Ansichten und Inspector kennen
LKW nicht. Stattdessen liefert `lkwView(plan, lkwId)` einen normalen Ein-LKW-Plan (ohne `lkws`,
`truckId` des LKW, nur dessen Platzierungen und Ablage-Einträge, ohne das Feld `lkw`).
`mergeLkwView` schreibt das Ergebnis zurück und setzt `lkw` an allen Stücken dieses LKW; Stücke der
anderen LKW und die nicht zugeordneten bleiben unberührt. Auf einem Ein-LKW-Plan ist `lkwView`
der Plan selbst. Eine veraltete LKW-ID (Reiter nach Rückgängig oder Löschen) fällt in `lkwView`,
`mergeLkwView`, `updateLkw` und beim Ziel von `moveToLkw` auf den ersten LKW (`resolveLkwId`);
`removeLkw` mit unbekannter ID tut dagegen nichts, weil Löschen zerstörend ist.

In `js/app/core.js` hängt daran die Verdrahtung: `activeLkwOf` (gewählter Reiter, fällt bei
ungültigem Wert auf den ersten LKW), `ctxOf`/`deriveOf`/`applyEdit` arbeiten auf der Ansicht des
gewählten Reiters, und `applyEdit` schreibt sie in **einem** Rückgängig-Schritt zurück.
`applyEditWhole` wirkt auf den ganzen Plan („Alles neu packen“, Zuordnung im Inspector,
Löschen eines Fahrzeugs). Der gewählte Reiter (`activeLkw`) liegt im Store, wird nicht gespeichert
und ist nicht Teil von Rückgängig. `js/ui` importiert nichts aus `js/app/`; die dafür nötigen
Hilfen (`NO_LKW`, `piecesOf`, `stueck`, `unassignedLines`) liegen im Modell.

**Verteilung** (`js/model/lkw-distribute.js`), nur bei „Alles neu packen“ und nur ab zwei LKW.
Bei genau einem LKW wird nur dessen Ansicht gepackt, nichts umverteilt; Ein-LKW-Pläne gehen
unverändert durch `packAll`.

1. Alle Stücke (Platzierungen und Ablage, auch nicht zugeordnete) werden neu verteilt.
2. Zulässig für ein Stück sind die LKW, die sein Gewerk angehakt haben **und** deren Fahrzeug es in
   irgendeiner Orientierung aufnehmen kann (`chooseOrientation`). Ist keiner zulässig, nehmen die
   tauglichen Rest-LKW es. Gibt es auch die nicht, bleibt das Stück nicht zugeordnet (Ablage, mit
   Hinweis). Ein Case ohne Gewerk gilt als „Sonstiges“; ein Stück ohne bekannten Case bleibt nicht
   zugeordnet.
3. Gleichmäßig je Gewerk (**eigene Entscheidung**, eine Heuristik): Gewerke in der Reihenfolge von
   `CATEGORIES`, darin die Stücke nach Volumen absteigend (Gleichstand: Ablagereihenfolge); jedes
   Stück geht an den zulässigen LKW mit der kleinsten Auslastung, `max(Grundfläche der bisher
   zugeteilten Stücke / Bodenfläche des Laderaums, Gewicht der bisher zugeteilten Stücke /
   Nutzlast)`; Gleichstand: der frühere LKW. Die Auslastung zählt über alle Gewerke hinweg.
   Gewicht 0 zählt 0 (unbekannt, nichts erfunden). Die Grundfläche ist die der Packorientierung.
4. Jeder LKW wird mit `packAll` auf seiner Ansicht gepackt (Pack-Regeln und „Deckschicht mischen“
   stammen aus dem Plan und gelten für jeden LKW). Was nicht passt, wird **einmal** an die übrigen
   zulässigen LKW weitergegeben (`packRest`, in Listenreihenfolge); was auch dann nicht passt,
   bleibt in der Ablage seines ersten LKW.
5. Ergebnis deterministisch; die Reihenfolge der LKW ist die Listenreihenfolge.

Die Weitergabe läuft nur einmal: Ein Stück kann in der Ablage bleiben, obwohl ein dritter LKW Platz
gehabt hätte. „Rest einpacken“, „Truck entladen“, Ziehen, Tastatur und Inspector wirken nur auf den
gewählten LKW; es wird **nichts** automatisch umverteilt.

**Oberfläche** (`js/ui/lkw-tabs.js`, `js/ui/lkw-editor.js`, verdrahtet in `js/app/planView.js`).
Die Reiterleiste erscheint nur bei Plänen mit `lkws`: je LKW „Name · Fahrzeug (n)“, ein Reiter
„Ohne LKW (n)“ nur bei nicht zugeordneten Stücken, „+ LKW“ und „LKW bearbeiten“, darunter eine
Summenzeile (Gesamtzahl, Gewicht mit Zahl der Stücke ohne Gewicht, nicht zugeordnete je Gewerk).
Ein Ein-LKW-Plan hat in der Kopfleiste den Knopf „Mehrere LKW“, der den Dialog „Neuer LKW“
öffnet und den Plan erst beim Speichern umwandelt (`convertToMulti`: ein LKW „LKW 1“ mit dem
bisherigen Fahrzeug, ohne Haken, alle Stücke ihm zugeordnet); Abbrechen ändert nichts. Fahrzeugauswahl, „Fahrzeug
bearbeiten“ und Seitenleiste wirken auf den gewählten LKW; im Inspector verschiebt das Feld „LKW“
ein Stück (`moveToLkw`: eine Platzierung wandert in die Ablage des Ziel-LKW, „Ohne LKW“ ist wählbar,
der Reiter folgt dem Ziel). Eigene Entscheidungen:

- Der Reiter „Ohne LKW“ hat keine 2D-/3D-Ansicht, nur einen Hinweistext und die Ablage; Fahrzeugwahl,
  „Fahrzeug bearbeiten“, „Rest einpacken“ und „Truck entladen“ ruhen dort. Bearbeiten in der Ablage
  läuft über `mergeUnassignedView` (Platzierungen mit ungültigem Verweis wandern per
  `placementToUnplaced` in die Ablage).
- Beim Löschen eines LKW (mit Rückfrage) werden seine Stücke nicht zugeordnet, Platzierungen
  wandern in die Ablage.
- Der Lade-Wizard fügt bei einem Mehr-LKW-Plan das Material **nicht zugeordnet** hinzu und
  packt nicht automatisch; ein Hinweis nennt das. „Alles neu packen“ verteilt es später.
- „Alles neu packen“ fragt bei Mehr-LKW-Plänen mit vorhandenen Stücken nach und meldet danach
  Zeilen wie „12 Stücke ohne LKW (Strom)“, „n Stücke mit unbekanntem Case“ und „n Stücke passen
  nicht in den LKW …“.
- `.stage` ist ein Spaltenlayout (Reiterleiste oben).

**Fahrzeug löschen.** `deleteTruck` (`js/app/persistence.js`) biegt nicht nur `plan.truckId`,
sondern auch die `truckId` der LKW **aller** Pläne auf das Standardfahrzeug um; ein Verweis auf
ein fehlendes Fahrzeug fällt auch in der Verteilung auf das Standardfahrzeug zurück (ein LKW, dessen
Fahrzeug gar nicht aufzulösen ist, ist nicht packbar, seine Stücke bleiben in der Ablage).

**Druck** (`js/ui/print.js`, `js/app/chrome.js`). Neben der Dokumentenauswahl steht bei
Mehr-LKW-Plänen der Umschalter `#print-scope` „dieser LKW / alle LKW“; er springt beim Planwechsel
auf „dieser LKW“. „Dieser LKW“ druckt wie bisher die Ansicht. „Alle LKW“ (`buildPrintAll`,
`buildChecklistAll`, `buildUnloadListAll`, `buildLabelsAll`, Abschnitte aus `printSectionsOf`) baut je
LKW einen Abschnitt `p-lkw` (ab dem zweiten mit `p-break`, Seitenumbruch) mit „Plan – LKW-Name“ und
Fahrzeug im Kopf. Nicht zugeordnete Stücke stehen als letzter Abschnitt „Ohne LKW“ (im Ladeplan nur als
Liste, ohne Zeichnung, Ladenummer „–“, „nicht geladen“; Beschriftung und Farbe fallen auf den Case zurück). Im
Reiter „Ohne LKW“ druckt „dieser LKW“ nur diesen Abschnitt (eigene Entscheidung). Etiketten aller LKW
laufen in einem Raster, die Nummer zählt je LKW, der LKW-Name steht in einer eigenen Zeile. Das
Markup eines Ein-LKW-Plans ist unverändert (Baseline `tests/baselines/print-single.json`). Alle
Namen gehen durch `esc()`.

**Import** (`js/store/io.js`). `checkPlan` lehnt ab: mehr als 12 LKW, doppelte LKW-IDs, Felder
falschen Typs, zu lange Namen, mehr als 32 Gewerke je LKW, nicht-Text bei `piece.lkw`. Gewerke
werden nur als Text geprüft, nicht gegen `CATEGORIES` (eine spätere Umbenennung macht Dateien
nicht unlesbar). Repariert und in `repairs` gemeldet wird: ein `lkw`-Verweis auf einen unbekannten
LKW wird entfernt (auch in Plänen ohne `lkws`); in Mehr-LKW-Plänen wandern Platzierungen ohne gültigen
Verweis in die Ablage; weicht `plan.truckId` vom Fahrzeug des ersten LKW ab, wird es angeglichen;
`lkws: null` gilt als fehlend. Alte Sicherungen ohne `lkws` laden unverändert (Regressionstests mit
Altschema-Plänen in `tests/lkw.test.js` und `tests/io.test.js`).

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

Seit V 0.17.1 gibt es daneben `projectRuleSets` (`DB_VERSION` 4): dasselbe Format, aber Regelsets,
die zum Projekt gehören (in NYX in der Projektdatei). Der Dialog zeigt beide Gruppen, die
Namensprüfung gilt je Gruppe (`persistence.saveRuleSet(name, rules, mixTop, ort)`). In der
Sicherung ist es ein optionales Feld ohne Versionssprung.

### Mitgeführte Cases und Fahrzeuge (seit V 0.17.1)

Ein Plan verweist per `caseId`/`truckId` auf die Bibliothek. Damit eine Sicherung oder
NYX-Projektdatei auch auf einem Rechner vollständig ist, dem diese Einträge fehlen, trägt jeder Plan
`mitgefuehrt = { version: 1, cases, trucks }` (`js/model/mitgefuehrt.js`):

- **Inhalt:** genau die Cases und Fahrzeuge, auf die `placements`, `unplaced`, `truckId` und
  `lkws[].truckId` verweisen, vollständig, ohne `collectionId`. Neu berechnet bei jedem Speichern
  (`planZumSpeichern`, Autosave, Sichern) und wenn sich ein benutztes Case oder Fahrzeug in der
  Bibliothek ändert (`createBestandsSync`, ruht während eines Imports). Kein neuer `updatedAt`.
- **Laderegel:** die Bibliothek gewinnt immer; die Kopie füllt nur fehlende IDs. Die Ergänzung
  entsteht an **einer** Stelle, `bestandOf(s)` in `js/app/core.js`, die `ctxOf`, `deriveOf` und
  `printSectionsOf` benutzen. Ein unbekanntes `truckId` fällt erst danach aufs Standardfahrzeug.
  Materialverwaltung und Wizard lesen weiter nur die Bibliothek.
- **Merker:** `ausProjekt = { cases: Set, trucks: Set }` im abgeleiteten Zustand, nie gespeichert.
  Der Inspector zeigt dafür den Hinweis und „In meine Bibliothek übernehmen“ (Case nach „Meine
  Sammlung“, gleiche ID); Gewicht, „Case bearbeiten“, der Stift in der Ablage und „Bearbeiten“ am
  Fahrzeug sind für Kopien gesperrt.
- **Import:** `checkPlan` prüft jede Kopie mit `checkCase`/`checkTruck` (höchstens
  `MAX_MITGEFUEHRT_CASES` Cases und `MAX_LKW + 1` Fahrzeuge); `parseBundle` repariert sie vorher wie
  die übrigen Daten (Rollenhöhe, zu lange Namen).

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

Import-Regeln (Abschluss Teil 1):
- Namen: `NAME_MAX` (= 80, `js/model/limits.js`) gilt für Case-, Fahrzeug- und Ladeplan-Namen und
  entspricht den `maxlength`-Attributen der Editoren (das Umbenennen-Feld des Plans hatte vorher
  keine; Kopien kürzen den Namen via `copyName` in `js/app/plans.js`). Ein Name von Ladeplan, Case
  oder Fahrzeug über 80 Zeichen aus einer älteren Sicherung (bis V 0.13.10 möglich, z. B. ein
  Dolly-Stack aus einem langen Namen mit bis zu 91 Zeichen) wird beim Import gekürzt und gemeldet
  (eigene Entscheidung, damit eigene alte Sicherungen importierbar bleiben); bei Dolly-Namen bleibt
  der Zusatz „N er (auf Dolly)“ erhalten, die ID ändert sich nicht. `checkCase`/`checkTruck`/
  `checkPlan` selbst lehnen zu lange Namen weiter ab. Neue Dolly-Namen kürzt `dollyName`
  (`audioDolly.js`).
- Doppelte IDs innerhalb derselben Liste (Cases, Fahrzeuge, Pläne, Regelsets) lehnen die Datei ab.
- Koordinaten: `COORD_MAX` (= 2724 cm = 2 × größte mitgelieferte Fahrzeugabmessung, eigene
  Entscheidung). Eine Platzierung mit |x|, |y| oder |z| über `max(COORD_MAX, 2 × größte Abmessung
  der Fahrzeuge in der Datei)` wird nicht abgelehnt, sondern in die Ablage verschoben (Label,
  Farbe, Lagen, Tippen, Gruppe bleiben) und unter „Beim Import angepasst“ gemeldet, weil die App
  Koordinaten selbst nirgends begrenzt.
- Gewicht, Auflast und Bestand über `CASE_LIMITS` lehnen nicht ab: der Wert bleibt, `parseBundle`
  liefert ihn in `overLimit`. Verweise auf unbekannte Cases/Fahrzeuge liefert es als `unknownRefs`
  (IDs); `js/app/importExport.js` bildet daraus nach dem Mischen die Warntexte, filtert sie gegen
  den lokalen Bestand und die Gewinner des Abgleichs und zeigt höchstens 10 Zeilen.
- `repairWheelH` meldet Rollenhöhe und Rollen-Angabe (`wheels`) gemeinsam.

Vor jedem Import lädt `js/app/importExport.js` still eine Sicherung des bisherigen Stands herunter
(`preImportBackupFileName()`, gleicher Name wie `backupFileName()` plus `-vor-import`), bevor
irgendetwas in IndexedDB überschrieben wird. Das Mischen läuft synchron innerhalb eines
`store.update()`-Updaters, damit eine Änderung, die der Nutzer während des Schreibens macht,
nicht stillschweigend zurückgenommen wird; scheitert das Schreiben, wird der Store auf den
Stand vor dem Import zurückgesetzt und der Nutzer kann die eben heruntergeladene Sicherung
erneut anfordern. `js/store/autosave.js` nimmt den betroffenen Plan für die Dauer des Imports
per `exclude()`/`include()` aus der eigenen Buchhaltung, damit ein parallel laufender
Autosave-Schreibvorgang den Import nicht überholt oder rückgängig macht.

Weitere Speicher-Details (Abschluss Teil 1): `loadAll` schreibt Datensätze mit kaputtem `updatedAt`
bereinigt zurück (`sanitizeAndWriteBack`, ein `putMany`, Fehler nur geloggt). `db.open()` setzt
eine abgelehnte Promise zurück, der nächste Zugriff versucht es erneut. Plan löschen:
`removePlanPersisted` in `js/app/plans.js` (erst `autosave.flush()`, dann `deletePlan`, dann
`forget`). „Sammlung löschen“ und jeder andere Case-Schreibvorgang gehen über `repo.writeCases({ upserts,
removeIds, touchIds, deleteCollectionIds, collections })` in einer einzigen IndexedDB-Transaktion
(`db.writeMany`, wie `putMany`, nur mit Deletes); ein Fehler lässt Datenbank und Store unverändert. Der Änderungszeitpunkt wird nur von `stamp()` in `js/model/stamp.js` gesetzt (früher
`touch` in `actions.js` und `stamp` in `repo.js`).

Ist die App in einem zweiten Tab oder Fenster gleichzeitig offen, meldet ein
`BroadcastChannel('truckload')` das den beteiligten Tabs — es gibt (Stand V 0.7.0) keinen
Datenabgleich, nur den Hinweis „in einem weiteren Tab offen“, damit der Nutzer nicht
lautlos den einen oder anderen Stand verliert.

## Mitgelieferte Daten

| Datei | Inhalt |
|---|---|
| `data/standard.json` (Sammlung „Standard“; `js/data/preset-cases.js` ist nur noch ein Wrapper darüber und exportiert `PRESET_CASES`) | 201 Einträge, davon 194 sichtbare Vorlagen (seit 0.17.3 dazu 144 Hersteller-Vorlagen für Licht, Pulte und Racks, siehe docs/casemasse-gewichte.md); die ursprünglichen 57 sind 50 sichtbare Vorlagen: 7 Packcases (je Standardmaß eines), 6 weitere generische Cases (Richtwerte), 24 Pre-Rig-Traversen (MLT/S36PR) und 13 Audio-Einzelboxen im Gewerk „Ton“ (`dollyPrompt`, docs/casemasse-gewichte.md); dazu 7 `legacy`-Einträge, die nur noch für alte Ladepläne existieren. Feste Traversenwagen-Vorlagen gibt es nicht mehr: Wagen entstehen im Traversen-Dialog als eigene Case-Typen, Dolly-Stacks im Dolly-Dialog |
| `data/meine.json` (Sammlung „Meine Sammlung“; `js/data/case-library.js` ist nur noch ein Wrapper und exportiert `CASE_LIBRARY`) | 137 Cases aus der Excel-Tabelle des Nutzers, alle mit `source: 'liste'` und `company`; ein Teil davon `legacy` (ausgeblendet, u. a. Transflex-/Pack-Cases, Traversen und Rigging-Pakete der Liste) |
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
`company` durch — „Eigene Cases“ ohne `company` (auch die in „Meine Sammlung“) und alle
`standard.json`-Vorlagen bleiben sichtbar, die ganze Gruppe „Cases aus deiner Liste“ (ausnahmslos
mit `company`) und jedes Case in einer benannten Sammlung verschwindet, bis der Nutzer gezielt
eine Sammlung oder den kompletten Bestand wählt. Die Wahl einer Sammlung schließt ihre
Untersammlungen ein (`descendantIds`, Vorrang vor dem `company`-Filter). Verschwindet die gewählte
Sammlung aus den Daten, fällt der Filter auf „Standardkatalog“ zurück.

Die 7 Packcases tragen seit V 0.8.6 ein Standardgewicht statt 0 kg. Berechnet wurden sie mit
`Math.round(PACK_REF_KG * l * w * h / PACK_REF_VOLUME)`, `PACK_REF_KG = 100` und
`PACK_REF_VOLUME = 120 * 60 * 80` (Referenz: das Standard-Packcase 120×60×60 ohne Rollen, also
120×60×80 inkl. Rollen, wiegt 100 kg – Nutzerangabe, keine Recherche, dokumentiert in
`docs/casemasse-gewichte.md`). Alle anderen Packcase-Maße werden danach nach Volumen ab- bzw.
aufgestuft; die Werte stehen ausgerechnet in `data/standard.json` (der Kommentar mit Formel und
Referenz steht weiter als Kommentar in `js/data/preset-cases.js`, weil JSON keine Kommentare
kann; die Formel läuft nicht mehr zur Laufzeit). Mitgelieferte Cases entstehen bei jedem Start neu aus den
JSON-Dateien (`mergeOwnWithBuiltins`) – ein anderer Standard ist eine Änderung der Zahlen in
`data/standard.json`, ein einzelnes Case ändert man über „Case bearbeiten“ (eigene Kopie). Die `legacy`-Einträge behalten
ihre alten Gewichte.

`js/ui/caseGroups.js` (`groupCases`, `companiesOf`) mit den drei Abschnitten (eigene
Cases, Vorlagen, Cases aus der Liste) wird seit V0.7.11 nur noch vom Wizard benutzt
(`js/ui/load-wizard.js`, Schritt „Cases“) – dort browst man den ganzen Katalog, um
neue Case-Typen zu einem Load hinzuzufügen. Die Seitenleiste (`js/ui/library.js`)
zeigt dagegen nur noch den Inhalt des aktuellen Loads (platzierte + unplatzierte
Stücke), umschaltbar zwischen „Noch nicht geladen“ und „Alles Material“ – nicht mehr
den Katalog.

## Darstellung

Zahlen in Case-Zeilen und -Details formatiert `fmtNum` (`js/ui/caseInfo.js`): deutsch, höchstens
eine Nachkommastelle, ohne unnötige Nullen; nicht endliche Werte erscheinen als „–“, ein
gerundetes `-0` als „0“. Die einheitliche Rundung auf eine Stelle ist eine eigene Entscheidung.

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
  Dialog-Lauf neu und überschreibt einen vorhandenen Stack gleicher ID, damit bestehende Stacks
  neue Darstellungsfelder bekommen (eigene Entscheidung 2026-10-08 nach Nutzer-Feedback: ein
  bereits angelegter „K2 2er“ behielt sonst die alte Darstellung).

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
mit `ctrlKey`. Seit V 0.14.1 entscheidet `classifyWheel` (mit Gestenzustand; Strg zählt nicht mit),
und der Umschalter „Rad: Auto/Zoom/Schieben“ (`localStorage` `truckload.scrollMode`) kann die
Erkennung übersteuern. Die Schrift der Beschriftung wächst mit dem Zoom, solange der ganze Name noch in die
Case-Breite passt (`labelFontSize`, Obergrenze kleinere Seite × 0,32; sonst bleibt es bei der Grundgröße und der Name wird gekürzt); Linien wachsen unbegrenzt mit. Der Druck (`js/ui/print.js`) nutzt eigene SVGs ohne Zoom-Zustand.

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

`js/ui/print.js` erzeugt vier Dokumente in dasselbe `#print-root`: `buildPrint` (Ladeplan, mit
SVG-Ansichten), `buildChecklist` (Abhakliste), `buildUnloadList` (Ausladeliste, dieselbe Zeilenlogik `listDoc` mit umgekehrter Reihenfolge, Titel „Ausladeliste – …“ und Unterschriftszeile „Entladen von“) und `buildLabels` (Etiketten). Welches gilt,
steuert `js/app/chrome.js` über eine Klasse am Wurzelelement (`doc-plan`/`doc-checklist`/`doc-labels`; die Ausladeliste trägt `doc-checklist doc-unload`,
bei Etiketten zusätzlich `size-large`/`size-small`), die `css/print.css` auswertet. Alle vier schreiben
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
