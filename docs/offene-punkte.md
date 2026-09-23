# Offene Punkte

Stand V 0.7.0. Gesammelt aus den Code-Reviews der Versionen 0.3.0 bis 0.7.0 und aus
Hinweisen des Nutzers. Nichts davon blockiert den Betrieb; die Reihenfolge ist meine
Einschätzung der Nützlichkeit. Erledigtes ist raus — der vollständige Abgleich aller 75
Befunde aus der Meilenstein-Review V 0.6.0 steht im Bericht zu Task 9
(`.superpowers/sdd/2026-09-21-review-fixes-v0.7/task-9-report.md`).

## Daten aus der Casemaße-Tabelle

**Fünf Zeilen fehlen ganz.** Motorsteuerung-Koffer, Bolzenkoffer, FD34 x2, HOF BOLT und
Dolly „Drohne“ hatten kein oder nur ein einzelnes Maß. Bei dreien steht in der Quelle eine
einzelne Zahl, aus der sich kein Case bauen lässt. Der Nutzer wollte sie selbst nachtragen.

**Vier 19″-Racks sind gerechnet.** 1, 4, 5 und 16 HE hatten keine Maße; die Höhe kommt aus
der Höheneinheit (4,45 cm je HE plus 5,68 cm Aufschlag, abgeleitet aus den drei gemessenen
Racks), Breite und Tiefe mit 60 × 60 geschätzt. Echte Maße würden das ersetzen.

**`JDC-1 Cube (4)` und `JDC-1 Cube` sehen nach vertauschten Stückzahlen aus.** Das Case mit
„(4)“ im Namen ist mit 60 × 60 × 58 kleiner als das mit einem Gerät (99 × 60 × 58). Die
Stückzahl kommt allein aus dem Namen; das Gewicht der beiden Zeilen ist entsprechend
fraglich.

**Drei Motorcases sind 240 cm breit** (`D8+ 0,5t CAB x4/x8/x12`). Sie passen nur in die
großen Fahrzeuge und erzeugen anderswo zwangsläufig eine Überstand-Warnung. In der Quelle
sehen Länge und Breite vertauscht aus.

**Der Mindest-Case-Anteil von 15 kg überzeichnet kleine Cases.** Bei `SF TourHazer II`
ergibt das rechnerisch 552 kg/m³. Der Richtwert ist in `docs/casemasse-gewichte.md`
offengelegt, aber für kleine Cases zu konservativ.

## Aus der Meilenstein-Review V 0.6.0 (2026-09-21) bewusst offen gelassen

Die 75 Befunde aus `docs/code-review-2026-09-21.md` sind über die Tasks 1 bis 8 der Reihe
nach abgearbeitet; der vollständige Befund-für-Befund-Abgleich (erledigt/begründet offen)
steht im Bericht zu Task 9. Was davon bewusst offen geblieben ist, mit Begründung:

- **2D/3D: Schriftfarbe der Beschriftung** (UI-N1). 2D ist fest weiß mit schwarzer Kontur
  (`css/app.css`), 3D leitet sie aus dem Hintergrund ab (`textColorFor` in `view3d.js`). Auf
  einem hellen Case (z. B. Gewerkfarbe Gelb) sieht das unterschiedlich aus; die Kontur rettet
  die Lesbarkeit in beiden Fällen. Der Vorschlag (`textColorFor` nach `caseStyle.js`, in 2D als
  `style`-Attribut setzen) berührt sowohl die Bildschirm- als auch die Druckdarstellung –
  zusammen mit der Kontur-Wechselwirkung ist das mehr als eine Zeile und bräuchte eine eigene
  Browser-Abnahme auf mehreren Case-Farben und im Ausdruck. Nutzen (Konsistenz zwischen
  Ansichten) gegen Risiko (Lesbarkeitsregression im Ausdruck) abgewogen: zurückgestellt.
- **2D/3D: Griffe auf der Längsseite nur in 2D** (UI-N3). `view3d.js` (`handleMeshes`) setzt
  Griffe unabhängig von der Case-Länge nur auf die Stirnseiten; 2D zeichnet ab 100 cm Länge
  zusätzlich zwei auf der Längsseite. Der Fix ist eine echte 3D-Geometrieänderung (Position,
  Kollisionsfreiheit mit dem Deckelfuge-Band, InstancedMesh-Aufbau), kein Ein-Zeilen-Fix, und
  bräuchte ein Prüf-Fahrzeug samt Screenshot-Abnahme aus mehreren Blickwinkeln (`CLAUDE.md`,
  „Fallstrick 3D“). Rein kosmetisch (kein Fehlverhalten), deshalb zurückgestellt.
- **Eine Textmetrik für 2D und 3D** (UI-S3). 2D kürzt Beschriftungen einzeilig mit „…“, 3D
  bricht sie mehrzeilig um und verkleinert die Schrift — zwei sichtbar unterschiedliche
  Ergebnisse für denselben Text. Eine Zusammenführung des eigentlichen Verfahrens (Kürzung vs.
  Umbruch) wäre eine sichtbare Verhaltensänderung, keine reine Aufräumarbeit, und deshalb
  bewusst nicht angefasst (Kommentare an beiden Stellen verweisen aufeinander).
- **Inspector wird bei jedem Bild neu aufgebaut** (Rest von UI-S5). Der Teil, der ohne Risiko
  zu entschärfen war – die Ablage –, ist gefixt (`js/ui/library.js`, `update()` baut die Ablage
  nur noch bei geänderter `plan.unplaced`-Referenz oder geänderten Cases neu). Der Inspector
  selbst bleibt unverändert: er hängt von sehr vielen Feldern gleichzeitig ab (Position, Lage,
  Warnungen, Ladungs-Kennzahlen), die sich während eines Drags des ausgewählten Cases
  tatsächlich bei jedem Bild ändern – ein Diffing wäre entweder grobmaschig (verpasst echte
  Änderungen, genau die Fehlerklasse von UI-B1) oder so fein, dass der Gewinn gegenüber dem
  heutigen `innerHTML`-Aufbau klein wird. Ohne Performance-Beschwerde aus der Praxis nicht
  angefasst.
- **`layerMap`-Rückfall `?? 1` ist ungetestet** (Nachtrag Controller). Ein Mutationslauf zeigt,
  dass `?? 1` → `?? 0` in `js/model/validate.js` unbemerkt bliebe. Der Zweig ist über die
  öffentliche API (`validatePlan`) nach heutigem Kenntnisstand nicht erreichbar: `layerMap`
  verarbeitet Items nach `z0` aufsteigend sortiert, und ein Unterstützer liegt per Definition
  (`supportersOf`) immer bei einem `z1`, das dem `z0` des gestützten Items entspricht – er
  wurde also schon verarbeitet, bevor das gestützte Item an der Reihe ist, und trägt bereits
  einen Eintrag in der Map. `layerMap` ist bewusst nicht mehr exportiert; ihn nur für diesen
  Test zu exportieren widerspräche genau dieser vorigen Aufräumarbeit.
- **N7 (Firmenfilter im Wizard veraltet nach „+ Neues Case“) ist behoben, aber heute
  wirkungslos.** `js/ui/case-editor.js` hat kein Formularfeld für `company` und setzt es beim
  Speichern ausdrücklich auf `undefined` — ein über „+ Neues Case“/„Sonderbau“ angelegtes Case
  kann also nie eine neue Firma mitbringen, `company` kommt heute ausschließlich aus der
  mitgelieferten Bibliothek. Der Fix (`renderCompanyOptions()` nach `addNewCase`) ist als
  Vorsorge stehen geblieben, mit Kommentar im Code — er greift automatisch, sobald der
  Case-Editor je ein Firmenfeld bekommt.
- **Import: Verweisprüfung kennt nur die eingebauten Vorlagen, nicht den lokalen
  Zustand** (Daten-21). `parseBundle` (`js/store/io.js`) meldet in `warnings`, wenn ein Plan
  auf ein Case oder Fahrzeug verweist, das weder im Bundle noch unter `CASE_LIBRARY`/
  `PRESET_TRUCKS` bekannt ist. Ein Plan, der auf ein eigenes (nicht mitgeliefertes) Case
  verweist, das lokal existiert, aber nicht im Bundle enthalten ist, erzeugt dadurch eine
  falsch-positive Warnung. `io.js` hat keinen Zugriff auf den App-Zustand; eine Prüfung nach
  dem Mischen (in `js/app.js`) wäre die genauere Lösung, ist aber nicht Teil des behobenen
  Befunds. `warnings` wird von `app.js` aktuell noch nicht gelesen (rein additiv).
- **Keine Obergrenzen für `name`-Textlängen und Platzierungskoordinaten (`x`/`y`/`z`), keine
  Prüfung doppelter IDs innerhalb derselben Liste** über die bereits vorhandene planweite
  Eindeutigkeitsprüfung hinaus. Keiner der drei Punkte ist ein Absturz- oder
  Einschleusungspfad; eine absurd lange Zeichenkette bläht höchstens die Anzeige auf.
- **`js/store/db.js`: eine einmal abgelehnte `dbPromise` bleibt dauerhaft abgelehnt.**
  Schlägt `indexedDB.open()` einmal fehl, versucht derselbe Tab es später nicht erneut — die
  App bleibt für den Rest der Sitzung im (funktionierenden, aber ungesicherten) Fallback-
  Modus. Kein belegter Datenverlustpfad, nur ein fehlender Wiederholungsversuch.
- **Keine „3D-Ansicht veraltet“-Markierung**, wenn die 3D-Ansicht nach einem Fehler in
  `update()` einfach stehen bleibt, statt neu aufgebaut zu werden — der Nutzer sieht dann
  einen möglicherweise nicht mehr aktuellen Stand, ohne Hinweis.
- **Kein `autosave.flush()`-Await vor `repo.deletePlan`.** Eine noch ausstehende Änderung an
  genau dem Plan, der gerade gelöscht wird, geht beim Löschen ohne Rückfrage unter — praktisch
  selten (derselbe Plan müsste im selben Moment geändert und gelöscht werden), aber nicht
  ausgeschlossen.
- **`touch()` (`js/model/actions.js`) und `stamp()` (`js/store/repo.js`) sind dieselbe
  Ein-Zeiler-Funktion in zwei Modulen.** `js/app.js` benutzt konsequent `stamp()`, `actions.js`
  intern `touch()` — beide sind heute vollständig getestet (kein stiller Zeitstempel-Verlust
  mehr), die Dopplung selbst ist nur noch Politur.
- **Modellschicht — mehrfach berechnete Auflage (`supportersOf`).** `layerMap`, `validatePlan`
  und `stackAbove` rufen `supportersOf` je für sich noch einmal über alle Items auf (dreimal
  O(n²) statt einmal). Bei den heutigen Plangrößen (einstellige bis niedrige zweistellige
  Stückzahl je Fahrzeug) nicht spürbar; erst relevant, falls Pläne je dreistellig werden.
- **Modellschicht — `caseShape(c, p, box)`/`trussShape(c, p, box)` erzwingen `box === boxOf(c,
  p)` nicht.** Ein Vorgabewert (`box = boxOf(c, p)`) würde die Zusage in die Signatur schreiben,
  ohne die heutigen Aufrufer (die die Box schon haben) zu verlangsamen. Bisher hat kein
  Aufrufer eine andere Box übergeben.
- **Modellschicht — `buildStacks` (`packer.js`) macht drei Dinge in einer Funktion**
  (Orientierung wählen, sortieren, stapeln). Eine eigene `orderForStacking(itemList, truck)`
  wäre für sich testbar, ist aber ein Umbau ohne Verhaltensänderung und deshalb zurückgestellt,
  solange kein konkreter Fehler daran hängt.
- **Modellschicht — Traversen-Maße `l/w/h` werden abgeleitet, aber trotzdem gespeichert.**
  `trussDims()` berechnet die Außenmaße aus `truss: {length, width, count}`; die berechneten
  Werte landen zusätzlich als `l/w/h` am Case und müssen deshalb an zwei Stellen
  nachnormalisiert werden (`normalizeCase` beim Import, `normalizeOwnCases` beim Laden) — ein
  Duplikat, das auseinanderlaufen kann, auch wenn beide Stellen dieselbe Funktion teilen.
  `outerDims(c)` könnte für `isTruss(c)` stattdessen direkt `trussDims(c.truss)` liefern und
  `l/w/h` für Traversenwagen gar nicht persistieren — das ist ein Umbau am Datenmodell mit
  Migrationsbedarf für bestehende eigene Traversenwagen, nicht für diese Version.
- **Modellschicht — `app.js` ruft `validatePlan` komplett bei jeder Zustandsänderung.** Bei
  den heutigen Plangrößen unkritisch; falls die Placement-Zahl dreistellig wird, ist die
  Kollisionsprüfung (O(n²)) die Stelle, die zuerst spürbar wird. Kein Gitter/Index gebaut,
  solange kein realer Plan das braucht.
- **Modellschicht — kein Eigenschaftstest über die ganze Schicht.** Ein Lauf über z. B. 50
  zufällige Case-Mischungen mit der Zusicherung „`autoPack` erzeugt nie einen Plan mit
  Placement-Fehlern, und die Summe aus `placements` und `unplaced` ist die Eingabe“ würde
  einen ganzen Klasse von Randfällen auf einmal abdecken. Aufwendig genug, um als eigener
  Task behandelt zu werden, statt beiläufig in Task 9 entstanden zu sein.

## Kleinigkeiten

- Der Firmenfilter springt still auf „Alle Firmen“, wenn die gewählte Firma aus den Daten
  verschwindet. Praktisch nur erreichbar, wenn man das letzte eigene Case einer Firma
  löscht.
- Der Wizard schreibt jedem Stück eine ausdrückliche Farbe, auch wenn sie der Gewerkfarbe
  entspricht. Ändert man später das Gewerk oder die Case-Farbe, bleiben die Stücke auf dem
  alten Wert.
- Die Truss-Zeile im Wizard schreibt „X kg/Stück“, obwohl `c.weight` das Gesamtgewicht des
  Wagens ist.
- Der Inspector kann bei stehenden Cases „Stehend, 180°“ anzeigen — richtig, aber für den
  Nutzer verwirrend.
- Tippen kann Nachbarn überlappen, weil nur `z` nachgeführt wird, nicht `x`/`y`. Das
  verhält sich seit jeher wie „Drehen“, und die Prüfung meldet es.
- Im Wizard neu angelegte Cases bleiben in der Bibliothek, auch wenn man den Wizard danach
  abbricht. Entspricht dem Verhalten des Case-Editors.
- `toPiece` in `js/model/actions.js` listet die Stück-Felder einzeln auf. Ein künftiges
  neues Feld muss dort nachgezogen werden, sonst geht es beim „Alles neu packen“ verloren.
- Das Druckspalten-Layout bei sehr langen Beschriftungen ist nie geprüft worden. Durch die
  40-Zeichen-Grenze entschärft.
- Der Sicherheitsfaktor bei `CHAR_ASPECT` im Druckpfad (`estimateTextWidth`,
  `js/ui/labelTexture.js`) ist eine grobe Schätzung ohne echte DOM-Messung im Druckmodus –
  gedruckte Beschriftungen können ihren Kasten um rund ein Zeichen überragen.
- Die 3D-Beschriftung rundet das Seitenverhältnis auf 0,25-Schritte (Cache-Schlüssel), damit
  bleibt eine Restverzerrung von bis zu 33 % auf schmalen Flächen.
- Der 3D-Ansicht fehlt ein `disposed`-Flag; ein doppelter `dispose()`-Aufruf ist nicht
  gesondert abgesichert (heute nicht erreichbar, weil `app.js` `view3d` nach dem Abbau sofort
  auf `null` setzt).

## Ideen, die noch niemand beauftragt hat

- Gewichte im Inspector schnell nachtragen können, ohne den Case-Editor zu öffnen.
- Mehrere Trucks je Show, mit Verteilung der Cases auf die Fahrzeuge.
- Ladereihenfolge nach Ausladereihenfolge statt nach Position.
