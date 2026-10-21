# Entscheidungen zu den offenen Issues

Stand 2026-10-21 („Issues auf null“). Ein Abschnitt je Issue: was getan wurde, was nicht, warum.
Entscheidungen der Klasse E sind eigene Entscheidungen bzw. Bestätigungen früherer Nutzerentscheidungen,
wie sie in den Issues beschrieben sind; die Wiedervorlage steht jeweils dabei.

## #32 Ladefehler-Hinweis für zu alte Browser
Behoben. Ein `SyntaxError` des Modulgraphen, der nicht nach fehlendem Export aussieht (Versionsmix), zeigt
„Dieser Browser ist zu alt für Truckload …“ ohne „Neu laden“. Die Textauswahl `tlLadefehlerText` steht im
Inline-Skript von `index.html` (läuft vor dem Modulgraphen, darf also kein JSON-Modul importieren) und ist in
`tests/pwa.test.js` geprüft. Die Mindestversion von Electron in NYX steht schon in `docs/nyx-sammlungen.md`
(Chromium ≥ 123); ob NYX sie erfüllt, ist Sache von NYX. Die Meldungstexte der Browser für fehlende
JSON-Modul-Syntax sind nicht an echten alten Browsern geprüft (Heuristik: alles, was nicht nach fehlendem
Export klingt).

## #19 Traversen-Dialog, zwei Randfälle
Behoben: Der Dialog sperrt „Hinzufügen“ nicht mehr stumm, sondern zeigt unter „Stück pro Wagen“ den Grund
(`classicSubmitError` in `js/ui/truss-wizard.js`, Meldungen von `splitWagons`/`trussDims`).
Entschieden (E): Ein beim Abbruch des Lade-Assistenten übrig bleibender neuer Wagen-Typ bleibt in „Eigene
Cases“, wie bei „+ Neues Case“; aufgeräumt wird über 🗑. Der Typ entsteht erst mit „Hinzufügen“, ein
vorhandener passender wird wiederverwendet (`findMatchingWagon`). Wiedervorlage, wenn Nutzer verwaiste Wagen-Typen
als Störung melden.

## #6 Marke („company“) und Sammlung trennen
Behoben: Wandert ein Listen-Case (ID aus `data/meine.json`) in eine benannte Sammlung und zurück nach „Meine
Sammlung“, bekommt es die Marke der mitgelieferten Fassung zurück (`moveCase(c, target, shipped)`, aufgerufen
in `moveCaseTo` mit `CASE_LIBRARY`). Ohne mitgelieferte Fassung (eigenes Case) entfällt `company` wie bisher;
nichts wird aus dem Namen abgeleitet. Kein neues Feld. Der Hinweistext (`title`) am Wizard-Filter
„Standardkatalog“ sagt jetzt, was er zeigt: Cases ohne Firmenmarke.
Entschieden (E): `company` ist nur der Name der Sammlung, in der das Case zuletzt lag, nicht der Name des
Baums; wer nach Oberfirma filtert, nimmt den Sammlungsfilter. Das Verschieben einer Sammlung ändert die
`company` ihrer Cases nicht. Wiedervorlage, wenn eine Marke über Sammlungsgrenzen hinweg gebraucht wird
(das wäre ein Datenmodell-Thema, mit NYX abzustimmen).

## #27 Service-Worker, Versionsmix bei langsamem Netz
Geprüft, nicht geändert (E, die in der Anleitung vorgesehene Rückfalllösung). Die Regel „alles eines Clients
aus dem Cache“ (wie `degraded` sie schon anwendet) schließt den Mix nicht aus, weil der Cache selbst gemischt
wird: `networkFirst` schreibt jede frisch geholte Datei in denselben Cache `truckload-v<Version>`. Ist eine
neue Fassung ausgeliefert und der Service Worker noch der alte, enthält der Cache nach ein paar frischen Abrufen
neue und alte Dateien nebeneinander; „ab jetzt nur noch Cache“ bedient dann ebenfalls Mix. Eine sichere Lösung
braucht einen Zwischenspeicher je Seitenaufruf, der erst vollständig geholt und dann im Ganzen übernommen
wird – das ist ein Umbau von `sw.js` weit über eine kleine Änderung hinaus, und er ließe sich ohne Browser und
ohne langsames Netz nicht abnehmen. Der Rest wird vom Ladefehler-Hinweis in `index.html` („Bitte neu laden“)
aufgefangen; die Voraussetzung für den Mix (Timeout von 3 s genau während einer Auslieferung) ist selten.
Wiedervorlage, wenn der Hinweis in der Praxis gemeldet wird. Die Asset-Liste ist unverändert.

## #35 Rest aus „Projektdatei vollständig“
Behoben: (1) Kopierte Fahrzeuge tragen in `#truck-select` ◇ statt ★ und den `title` „Aus der Projektdatei – nicht
in deiner Bibliothek“ (`truckMarke`). (2) Die Entscheidungen über Kopien sind reine Helfer in
`js/model/mitgefuehrt.js` (`istKopieCase`, `istKopieTruck`, `truckMarke`, `truckStiftSperre`) und von
`planView.js` benutzt (Stift am Fahrzeug, `editTruck`-Guard, Stift in der Ablage, Inspector); getestet an der
Datennaht mit echtem `bestandOf` (`tests/app-core.test.js`). Die DOM-Verdrahtung selbst ist nicht im Browser
gefahren. (3) `createBestandsSync` wiederholt ein fehlgeschlagenes `savePlan` einmal nach 500 ms; erst danach
Fehlerstatus. (4) Testlücken: Rollback von `projectRuleSets`/`ruleSets` beim gescheiterten Import,
`checkPlan` prüft `mitgefuehrt.version` jetzt gegen `MITGEFUEHRT_VERSION` (Version 2 wird mit Plan-Namen
abgelehnt, bisher nur „ist eine Zahl“), `null`-Einträge in `mitgefuehrt.cases/trucks`.
Eigene Entscheidung: Eine Datei mit künftiger Kopie-Version wird abgelehnt statt still gelesen; ändert sich das
Format, muss `MITGEFUEHRT_VERSION` zusammen mit einer Lese-Migration erhöht werden.

## #38 Import: null in Datensätzen, Grenzen der Maße-Nachfrage
Behoben: `cleanCases` (`js/store/repo.js`) entfernt beim Laden `null` bei Feldern, die fehlen dürfen, aber nicht
`null` sein dürfen (`content`, `tippable`, `stackable`, `wheels`, `dimsInclWheels`, `company`, `legacy`,
`onlyInPlan`, und in `truss` `wagonW`, `profileId`, `standing`); es gilt der Vorgabewert. Felder, die `null`
ausdrücklich erlauben (`maxTopLoad`, `stock`, `kind`, `layers`, `wheelH`), bleiben unberührt. Maße und Gewicht
werden nie angefasst. Gelesen wurde `checkCase` (`js/store/io.js`). Der bereinigte Stand wird nicht
zurückgeschrieben; er entsteht bei jedem Laden neu und landet mit dem nächsten Speichern des Cases in der
Datenbank. Regressionstest mit einem Datensatz im alten Schema (`tests/repo.test.js`).
Entschieden (E), Entscheidung des Nutzers zu #10: Die Maße-Nachfrage beim Import gilt nur für Cases der
Sicherung; Traversenwagen (Maße aus `truss`), Sammlungsdateien und die mitgeführte Kopie im Plan lehnen ein
Case ohne Maße weiter ab; eine Ergänzung gilt je Case-ID (bei verschiedenen Fehlern derselben ID in Plan-Kopie
und Top-Level-Liste wird nur der Top-Level-Eintrag nachgefragt). `MAX_DEPTH` (4) gilt nur in der Oberfläche;
eine tiefere Kette aus fremder Datei lädt. Wiedervorlage, wenn Importe in der Praxis an diesen Grenzen scheitern.

## #8 Überlagerungen wiederherstellen
Behoben: Ein Listen-Case, das als Überlagerung vorliegt (eigener Datensatz mit der ID eines Eintrags aus
`data/meine.json`: bearbeitet, verschoben, umbenannte Firma, ausgeblendet), bekommt in der Materialverwaltung
„Original wiederherstellen“ (Rückfrage `showConfirm`). Das entfernt den Datensatz über `repo.writeCases`
in der Warteschlange `serial`, danach gilt wieder die mitgelieferte Fassung samt künftigen Korrekturen
(`persistence.restoreOriginal`; reine Entscheidung `originalOf`/`istUeberlagerung` in `js/model/material.js`).
Ausgeblendete (gelöschte) Listen-Cases liegen als Überlagerung mit `legacy: true` in „Meine Sammlung“ und
standen bisher in keiner Ansicht; dafür gibt es den Eintrag „Ausgeblendet“ links in der Materialverwaltung
(erscheint nur, wenn es etwas gibt), dort dieselbe Aktion. Eigene Entscheidung: Nur Überlagerungen lassen sich
zurücksetzen; die in `meine.json` selbst als `legacy` geführten Einträge bleiben, wie sie geliefert werden.
Stücke in Ladeplänen behalten die ID; ihre Maße folgen der wiederhergestellten Fassung (die Rückfrage nennt die
Zahl der Pläne). Nicht im Browser gefahren.

## #11 Kleine Härtungen der Sammlungen
Behoben: (1) Dateidialog „Sammlung importieren“: Fehlt das `cancel`-Ereignis, gilt der Dialog nach
`focus` auf `window` und kurzer Frist (1 s) ohne gewählte Datei als abgebrochen und gibt den Knopf frei
(`watchFileDialogClose` in `js/app/download.js`, mit Zeitgeber und Fenster als Testnähte). Nicht an einem
echten alten Browser geprüft. (2) Sammlungsdateien bekommen dieselben Altschema-Reparaturen wie die Sicherung
(zu hohe Rollenhöhe → Rollen abgewählt, zu langer Name → gekürzt) statt Ablehnung; `parseCollectionFile` liefert
`repairs`, die Oberfläche nennt sie nach dem Import. Eine Beschriftung (`MAX_LABEL`) gibt es am Case nicht, sie
gehört zum Stück im Ladeplan; im Sammlungsformat ist sie also nicht zu reparieren. Jeder andere Verstoß lehnt die
Datei weiter ab.
Entschieden (E): Die Schreib-Warteschlange wartet auf offene Meldungen (`showAlert`) in einem Vorgang. Die
Reihenfolge der Schreibvorgänge ist wichtiger als ein schnelles Fortsetzen; eine Meldung innerhalb eines
Vorgangs ist selten. Wiedervorlage, wenn Nutzer ein „hängendes“ Speichern hinter einer offenen Meldung melden.

## #18 Technische Schulden der Modellschicht
Behoben: (1) `caseShape(c, p, box = boxOf(c, p))` und `trussShape(c, p, box = boxOf(c, p))`: die Zusage steht
jetzt in der Signatur; Aufrufer mit eigener Box bleiben unverändert und unverlangsamt. (2) `orderForStacking(group,
truck)` aus `buildStacks` (`js/model/packer.js`) herausgezogen (Orientierung wählen, Boden-/Nicht-Boden-Stücke
trennen und sortieren), ohne Verhaltensänderung: `tests/packer-golden.test.js` und `packer-property.test.js`
bestehen unverändert. (3) Struktursperre für `toPiece` (`tests/modell-schulden.test.js`): jedes Feld aus
`PIECE_FIELDS` muss „Alles neu packen“ platziert wie in der Ablage überleben; ein neues Stückfeld ohne
Nachziehen in `pickPieceFields` lässt den Test fehlschlagen (er verlangt dort auch einen Beispielwert).
Entschieden (E): Traversen-Maße `l/w/h` bleiben gespeichert und zusätzlich abgeleitet (`normalizeCase` beim
Import, `normalizeOwnCases` beim Laden teilen dieselbe Funktion); ein Umbau (nur `trussDims` liefern) wäre ein
Datenmodell-Eingriff mit Migration und ist nicht Teil dieses Auftrags. `validatePlan` läuft weiter komplett
bei jeder Planänderung (Kollisionsprüfung O(n²)); ein Raster ohne realen Bedarf wird nicht gebaut.
Wiedervorlage, wenn Pläne dreistellige Platzierungszahlen erreichen und die Bedienung spürbar stockt.

## #31 Grund in der Ablage vollständiger nennen
Behoben (`js/model/unplacedReason.js`): Zusätzlich zu den Maßen nennt die Ablage (1) „zu schwer für die
Nutzlast des Fahrzeugs (X kg, erlaubt Y kg)“, wenn das Stück allein schon über der Nutzlast liegt (Gewicht
0 kg = unbekannt und fehlende Nutzlast zählen nicht), und (2) „erlaubte Lagen …: darf nur auf anderen Stücken
stehen“, wenn die für das Stück geltenden Lagen (`pieceLayers`) Lage 1 nicht enthalten. Mehrere Gründe stehen
durch „; “ getrennt. Das sind Tatsachen aus Stück, Case-Typ und Fahrzeug, keine Behauptung über die Ursache
der Ablage. Kein Grund steht weiter dort, wo er geraten wäre: „kein Platz“, Pack-Regeln und alles, was von den
anderen Stücken abhängt. Eigene Entscheidung: Eine leere Schnittmenge von Stück- und Case-Lagen ist kein Grund,
weil `pieceLayers` dann auf die Lagen des Case-Typs zurückfällt. Der frühere Test „egal welches Gewicht → null“
galt der alten Fassung und wurde angepasst.

## #28 Oberflächen-Kleinigkeiten
Behoben: (1) Der Inspector zeigt „stehend“ bzw. „stehend, um 180° gedreht“ statt „stehend, 180°“; gemeint ist
die Drehung um die senkrechte Achse (`orientationText`, `js/ui/inspector.js`). (2) Verschwindet die gewählte
Sammlung aus dem Filter „Suchen in“ des Lade-Assistenten, springt er weiter auf „Standardkatalog“, zeigt jetzt
aber „Sammlung nicht mehr vorhanden – Filter zurückgesetzt.“, bis der Filter geändert wird
(`companyFilterAfterChange`, `js/ui/wizard-items.js`).
Abweichung von der Anleitung: Die Lagenwahl endet nicht bei „bis 3“, sondern bietet in Inspector, Wizard und
Case-Editor schon die Lagen 1–4 an; mehr gibt es nicht und wird nicht ergänzt: `layersValid` und das
Datenformat kennen nur 1–4 (eine Lage 5 im Stück wäre eine Datenmodelländerung, die ältere Versionen nicht
mehr läsen), der Packer stapelt höchstens 4 Lagen, und eine Lage 5 entsteht nur von Hand und wird von
`validate.js` gewarnt. Damit ist der Punkt erledigt (E).
Entschieden (E): Der Wizard schreibt jedem Stück die Gewerkfarbe ausdrücklich ins Stück (später geänderte
Gewerk-/Case-Farben erreichen vorhandene Stücke nicht; im Inspector lässt sich die Farbe je Stück ändern).
Tippen kann Nachbarn überlappen, weil nur `z` nachgeführt wird; das verhält sich seit jeher wie „Drehen“, und
die Prüfung meldet es. Im Wizard neu angelegte Cases bleiben nach Abbruch in der Bibliothek, wie beim
Case-Editor (Aufräumen über 🗑 in der Materialverwaltung). Wiedervorlage jeweils bei Nutzerbeschwerden.
