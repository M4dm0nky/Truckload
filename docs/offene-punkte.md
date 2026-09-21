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

**„−“ in der Ablage trifft ein beliebiges Stück.**
`removeUnplaced(plan, caseId)` entfernt den ersten Eintrag dieses Case-Typs. Seit die
Ablage die einzelnen Beschriftungen zeigt („Licht 1, Licht 2, Licht 3“), erwartet man,
gezielt eines entfernen zu können.

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
- Farbwerte fließen unescaped in `style="fill:…"`. Kein Skript-Vektor, aber aus einer
  fremden Importdatei wäre eine CSS-Wert-Injektion denkbar; `checkCase` prüft `color` beim
  Case-Typ nicht (bei Stück-Farben schon).
- Im Wizard neu angelegte Cases bleiben in der Bibliothek, auch wenn man den Wizard danach
  abbricht. Entspricht dem Verhalten des Case-Editors.
- `toPiece` in `js/model/actions.js` listet die Stück-Felder einzeln auf. Ein künftiges
  neues Feld muss dort nachgezogen werden, sonst geht es beim „Alles neu packen“ verloren.
- Das Druckspalten-Layout bei sehr langen Beschriftungen ist nie geprüft worden. Durch die
  40-Zeichen-Grenze entschärft.

## Ideen, die noch niemand beauftragt hat

- Gewichte im Inspector schnell nachtragen können, ohne den Case-Editor zu öffnen.
- Mehrere Trucks je Show, mit Verteilung der Cases auf die Fahrzeuge.
- Ladereihenfolge nach Ausladereihenfolge statt nach Position.
