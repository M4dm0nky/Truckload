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

## #15, #20, #21 Prüflisten für Hardware
Offen bis zur Prüfung am echten Gerät bzw. mit dem Maß des Nutzers. Die Vorbereitung steht in
`docs/pruefliste-hardware.md` (Druck, Mausrad/Trackpad, Pre-Rig-Dolly) und ist als Kommentar im jeweiligen
Issue gepostet. Für #21 ist `STAND_DOLLY_INSET` exportiert und durch einen Test an die Rollenspur gebunden
(`tests/truss.test.js`); der Wert 2 cm bleibt eine Schätzung, bis gemessen ist.

## #3 Fehlende Casemaße
Entscheidung des Nutzers (2026-10-21): endgültig gestrichen. Die fünf Zeilen (Motorsteuerung-Koffer,
Bolzenkoffer, FD34 ×2, HOF BOLT, Dolly „Drohne“) werden nicht angelegt; bei dreien steht in der Quelle nur
eine einzelne Zahl, aus der sich kein Case bauen lässt. Die sechs 19″-Racks (1, 2, 4, 5, 6, 16 HE) bleiben als
`legacy` in `data/standard.json` (nicht wählbar, alte Pläne laden sie weiter); nichts wird gelöscht. Wer sie
braucht, legt sie über „Neues Case“ mit echten Maßen an. Wiedervorlage, wenn echte Maße vorliegen.

## #4 Richtwerte für Case-Anteil und Packcases
Bleiben Richtwerte, die der Nutzer pro Case überschreiben kann. Der Mindest-Case-Anteil von 15 kg ist für
kleine Cases konservativ (z. B. `SF TourHazer II`: 552 kg/m³ rechnerisch), und die Packcase-Gewichte sind eine
Auslegung der Nutzerangabe (100 kg fürs Standard-Packcase 120×60×80, die übrigen linear nach Volumen), kein
recherchierter Wert. Eine Änderung verschöbe die Gewichte bestehender Pläne unbemerkt; die Werte sind in
`docs/casemasse-gewichte.md` offengelegt. Wiedervorlage, wenn echte Gewichte vorliegen.

## #5 Listen-Cases je Firma aufteilen
Der Nutzer sortiert selbst über „Verschieben“ (Entscheidung: erst Struktur, dann Sortierung). Die Listen-Cases
bleiben gemeinsam in „Meine Sammlung“, auch CAB, BBM, Motion. Mit #6 behält ein zurückverschobenes Listen-Case
seine Marke.

## #7 Elternsammlung zeigt nur eigene Cases
Gewollt, nicht einheitlich: Die Materialverwaltung zeigt in einer Oberebene nur die Cases, die direkt in ihr
liegen (mit Zahl); der Wizard-Filter „Suchen in“ schließt die Untersammlungen ein. In der Verwaltung geht es um
den Ort eines Cases, im Wizard um das Finden. Wiedervorlage, wenn Nutzer die Verwaltungsansicht mit
Untersammlungen erwarten.

## #9 Alter Store „cases“
Bleibt als Sicherheitsnetz, kein automatisches Löschen. Gelesen wird er nur, solange der Datensatz `meine`
fehlt (Migration, `readRecords`); danach nicht mehr, seine Datensätze veralten still. Ob eine ältere
App-Version noch darauf liest, ist nicht auszuschließen (NYX muss den Store freigegeben lassen). Eine
spätere Aufräumfunktion braucht Abstimmung mit NYX. `STORES` bleibt unverändert.

## #13 Verteilung nur bei „Alles neu packen“
Neues Material (Wizard, Ablage) landet im gewählten LKW oder ohne Zuordnung („Ohne LKW“); verteilt wird bewusst
nur auf Knopfdruck („Alles neu packen“) oder per Zuweisung im Inspector. Eine automatische Umverteilung bei
jeder Änderung würde die Hand des Nutzers überschreiben.

## #14 Verteil-Heuristik
Das Maß bleibt eine Heuristik (größerer Wert aus Grundfläche/Bodenfläche und Gewicht/Nutzlast; Höhe, Stapeln und
Pack-Regeln gehen nicht ein; die Weitergabe nicht passender Reste läuft nur einmal). Die Gewerkegrenzen werden
nicht optimiert. Es gibt keinen Beleg, dass ein besseres Maß in der Praxis Vorteile brächte. Wiedervorlage, wenn
ein echter Plan eine schlechte Verteilung zeigt: dann mit der Plandatei prüfen.

## #16 Textmetrik 2D/3D
2D kürzt Beschriftungen einzeilig mit „…“, 3D bricht mehrzeilig um und verkleinert die Schrift. Das bleibt: Die
Zusammenlegung wäre eine sichtbare Verhaltensänderung, keine Aufräumarbeit; die Kommentare an beiden Stellen
verweisen aufeinander.

## #17 Inspector wird bei jedem Bild neu aufgebaut
Kein Eingriff ohne Performance-Beschwerde. Der Inspector hängt von sehr vielen Feldern gleichzeitig ab
(Position, Lage, Warnungen, Kennzahlen); ein Diffing wäre entweder grobmaschig (verpasste Änderungen, die
Fehlerklasse von UI-B1) oder so fein, dass der Gewinn klein bleibt. Die Ablage wird schon nur bei geänderter
Referenz neu aufgebaut. Wiedervorlage bei Ruckeln während des Ziehens.

## #22 `layers: [1, 2]` an Wizard-Stücken
Die gespeicherte Einschränkung bleibt eine bewusste Angabe des Stücks (der Wizard hakt Lage 1 und 2 vor). Erlaubt
der Case-Typ später mehr oder weniger Lagen, deckt die Schnittmengenregel (`pieceLayers`) den Fall ab: ein Stück
darf nie mehr als sein Typ; fällt die Schnittmenge leer, gilt der Typ.

## #23 Zoom: Linien wachsen mit
Gewollt: Linien sind in Truck-Einheiten gezeichnet und werden beim Hineinzoomen dicker. Die Schrift wächst
mit, solange der ganze Name in die Breite des Cases passt (Obergrenze: kleinere Case-Seite × 0,32); passt er
nicht, bleibt sie auf der Grundgröße und der Name wird mit „…“ gekürzt.

## #24 Deckschicht: Regalverfahren und 0-kg-Cases
Das Regalverfahren (mehrere kleine Cases nebeneinander auf einem großen, Reihen in Ankunftsreihenfolge) ist eine
Heuristik, keine optimale Packung; in einem Vergleich mit dem alten Packer an 20.000 synthetischen Fällen wich
das Ergebnis in 2.787 ab (423-mal blieb mehr unverladen, 382-mal weniger). Deshalb bleibt der Schalter
„Deckschicht mischen“ optional; ein Vergleich von Fläche und Höhe statt der festen Reihenfolge ist denkbar und
nicht umgesetzt. 0 kg heißt unbekannt, nicht leicht: ein Case ohne Gewichtsangabe kommt weder als Deckschicht auf
ein fremdes Case noch trägt es eine fremde Deckschicht. Wiedervorlage, wenn ein echter Plan davon betroffen ist.

## #25 Deckschicht: Lagen-Vorgabe 1+2
Eine Lagen-Einschränkung ist eine bewusste Nutzerangabe. Der Wizard hakt Lage 1 und 2 vor; ein Stapel aus zwei
gleichen Cases ist damit voll, eine Deckschicht bräuchte Lage 3. Das erklärt die README und wird nicht
automatisch umgangen.

## #26 Pack-Regeln: Motor-Erkennung und Namensbezug
Keine automatische Motor-Erkennung: Eine Regel auf „Motoren“ trifft nur, was der Nutzer über die Gruppe oder den
Case-Typ als Motor kennzeichnet (keine Erkennung über Gewicht, Name oder Gewerk). Gruppen- und Gewerk-Regeln
verweisen über den Namen; benennt man eine Gruppe oder ein Gewerk um, greift die Regel nicht mehr und erscheint
im Dialog ausgegraut mit „(nicht in diesem Load)“, wird aber nicht gelöscht. Case-Typ-Regeln speichern die
`caseId` und brechen beim Umbenennen nicht.

## #29 Beschriftungen: Messung im Druck, Verzerrung in 3D, Etikettenformate
Bleiben: Das Druckspalten-Layout bei sehr langen Beschriftungen ist durch die 40-Zeichen-Grenze entschärft. Der
Sicherheitsfaktor `CHAR_ASPECT` (`estimateTextWidth`, `js/ui/labelTexture.js`) ist eine Schätzung ohne DOM-Messung
im Druckmodus (gedruckte Beschriftungen können ihren Kasten um rund ein Zeichen überragen; Prüfpunkt in
`docs/pruefliste-hardware.md`). Die 3D-Beschriftung rundet das Seitenverhältnis auf 0,25-Schritte (Cache-
Schlüssel), Restverzerrung bis 33 % auf schmalen Flächen. Es gibt nur die Formate Avery 3425 und 3474; ein
weiteres braucht einen Eintrag in `#print-label-size`, eine Rasterregel in `css/print.css` und seine Maße.

## #30 Gewicht von Standardvorlagen überschreibbar
Nein. Bei Standardvorlagen und Traversenwagen bleibt das Gewicht im Inspector lesbar; der Weg ist „Kopieren“ in
der Materialverwaltung, das eine eigene Version in einer Sammlung anlegt. So bleiben die mitgelieferten Werte
mit ihrer Quelle unverändert.

## #40 NYX-Hinweis zu 0.18.0
Kein Eintrag nötig. Die Einzelheiten (neue Datei `data/traversen.json`, optionale Eigenschaft `truss.profileId`,
kein neuer Store) stehen in `docs/nyx-traversen.md`. Zur Kenntnis genommen, nichts zu tun; das Schließen mit
Kommentar erledigt der Nutzer-Assistent.
