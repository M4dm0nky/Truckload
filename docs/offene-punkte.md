# Offene Punkte

Stand V 0.6.0. Gesammelt aus den Code-Reviews der Versionen 0.3.0 bis 0.6.0 und aus
Hinweisen des Nutzers. Nichts davon blockiert den Betrieb; die Reihenfolge ist meine
Einschätzung der Nützlichkeit.

## Deutlich spürbar

**0 kg ist nicht von „Gewicht unbekannt“ zu unterscheiden.**
70 der 137 mitgelieferten Cases haben bewusst kein Gewicht. Besteht ein Load überwiegend
aus ihnen, fällt einiges still aus: die Nutzlastanzeige zeigt 0 kg bei vollem Laderaum, die
Warnung „Ladung ist einseitig“ wird übersprungen (bei Gesamtgewicht 0 gibt es keinen
Schwerpunkt), und die Packer-Regel „nichts Schweres auf Leichtes“ greift zwischen
gewichtslosen Cases nicht. Vorschlag: im Inspector und im Druck ein Zähler „N Cases ohne
Gewicht“ neben der Nutzlast, und die Einseitigkeitsprüfung notfalls über das Volumen statt
über das Gewicht.

**Die Auto-Beladung füllt von links.**
Dadurch löst fast jede kleine Ladung die Warnung „Ladung ist einseitig“ aus, obwohl nichts
falsch ist. Der Packer sollte die Stapel über die Breite verteilen oder mittig beginnen.

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

## Kleinigkeiten

- Der Tooltip am „+“ der Bibliothek sagt noch „In die Ablage legen“, obwohl der Knopf
  inzwischen den Wizard öffnet und mit dem voreingestellten Häkchen direkt packt.
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

## Aus der Meilenstein-Review V 0.6.0, Task 8 (2026-09-21) offen gelassen

Die meisten `[nit]`/`[suggestion]`-Befunde aus `docs/code-review-2026-09-21.md` sind mit
Task 8 behoben (siehe `.superpowers/sdd/2026-09-21-review-fixes-v0.7/task-8-report.md` für die
vollständige Liste). Bewusst offen geblieben, mit Begründung:

- **2D/3D: Schriftfarbe der Beschriftung** (N1). 2D ist fest weiß mit schwarzer Kontur
  (`css/app.css`), 3D leitet sie aus dem Hintergrund ab (`textColorFor` in `view3d.js`). Auf
  einem hellen Case (z. B. Gewerkfarbe Gelb) sieht das unterschiedlich aus; die Kontur rettet
  die Lesbarkeit in beiden Fällen. Der Vorschlag (`textColorFor` nach `caseStyle.js`, in 2D als
  `style`-Attribut setzen) berührt sowohl die Bildschirm- als auch die Druckdarstellung –
  zusammen mit der Kontur-Wechselwirkung ist das mehr als eine Zeile und bräuchte eine eigene
  Browser-Abnahme auf mehreren Case-Farben und im Ausdruck. Nutzen (Konsistenz zwischen
  Ansichten) gegen Risiko (Lesbarkeitsregression im Ausdruck) abgewogen: zurückgestellt.
- **2D/3D: Griffe auf der Längsseite nur in 2D** (N3). `view3d.js` (`handleMeshes`) setzt Griffe
  unabhängig von der Case-Länge nur auf die Stirnseiten; 2D zeichnet ab 100 cm Länge zusätzlich
  zwei auf der Längsseite. Der Fix ist eine echte 3D-Geometrieänderung (Position, Kollisionsfreiheit
  mit dem Deckelfuge-Band, InstancedMesh-Aufbau), kein Ein-Zeilen-Fix, und bräuchte ein
  Prüf-Fahrzeug samt Screenshot-Abnahme aus mehreren Blickwinkeln (`CLAUDE.md`, „Fallstrick 3D“).
  Rein kosmetisch (kein Fehlverhalten), deshalb zurückgestellt.
- **Inspector wird bei jedem Bild neu aufgebaut** (Rest von S5). Der Teil, der ohne Risiko zu
  entschärfen war – die Ablage –, wurde in Task 8 gefixt (`js/ui/library.js`, `update()` baut die
  Ablage nur noch bei geänderter `plan.unplaced`-Referenz neu). Der Inspector selbst bleibt
  unverändert: er hängt von sehr vielen Feldern gleichzeitig ab (Position, Lage, Warnungen,
  Ladungs-Kennzahlen), die sich während eines Drags des ausgewählten Cases tatsächlich bei jedem
  Bild ändern – ein Diffing wäre entweder grobmaschig (verpasst echte Änderungen, genau die
  Fehlerklasse von B1) oder so fein, dass der Gewinn gegenüber dem heutigen `innerHTML`-Aufbau
  klein wird. Ohne Performance-Beschwerde aus der Praxis nicht angefasst.
- **`layerMap`-Rückfall `?? 1` ist ungetestet** (Nachtrag Controller, Punkt 7 von 7). Ein Mutationslauf
  zeigt, dass `?? 1` → `?? 0` in `js/model/validate.js` unbemerkt bliebe. Der Zweig ist über die
  öffentliche API (`validatePlan`) nach heutigem Kenntnisstand nicht erreichbar: `layerMap` verarbeitet
  Items nach `z0` aufsteigend sortiert, und ein Unterstützer liegt per Definition (`supportersOf`)
  immer bei einem `z1`, das dem `z0` des gestützten Items entspricht – er wurde also schon
  verarbeitet, bevor das gestützte Item an der Reihe ist, und trägt bereits einen Eintrag in der
  Map. `layerMap` ist bewusst nicht mehr exportiert (siehe Kommentar dort, „zehn zu weit offene
  Exporte“); ihn nur für diesen Test zu exportieren widerspräche genau dieser vorigen Aufräumarbeit.
  `volumeRatio` (derselbe Nachtrag-Punkt) ist inzwischen mit einem echten Normalfall-Test
  abgesichert (`tests/validate.test.js`, „volumeRatio berechnet einen echten Volumenanteil“).

## Ideen, die noch niemand beauftragt hat

- Gewichte im Inspector schnell nachtragen können, ohne den Case-Editor zu öffnen.
- Mehrere Trucks je Show, mit Verteilung der Cases auf die Fahrzeuge.
- Ladereihenfolge nach Ausladereihenfolge statt nach Position.
